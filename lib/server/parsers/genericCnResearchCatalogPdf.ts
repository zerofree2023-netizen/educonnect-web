import {
  buildReviewFlags,
  standardCatalogTableHeader,
} from "@/lib/server/parsers/catalogFieldRules";

export type GenericCnResearchCatalogResult = {
  ok: boolean;
  rows: any[];
  meta: Record<string, any>;
};

type Kind = "master" | "phd" | "other";

function norm(s: any) {
  return String(s ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\r/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[ ]+/g, " ")
    .trim();
}

function hasCn(s: any) {
  return /[\u4e00-\u9fff]/.test(String(s || ""));
}

function isNoise(line: string) {
  const s = norm(line);
  if (!s) return true;
  if (/^\d+\s*\/\s*\d+$/.test(s)) return true;
  if (/^附件\d*/.test(s)) return true;
  if (/招生专业目录/.test(s)) return true;
  if (/^(招生单位|专业代码|专业名称|方向代码|研究方向|学科门类|学位类型|学制|授课语言|校区|导师)/.test(s)) return true;
  if (/^说明[:：]?/.test(s)) return true;
  return false;
}

function hasHeader(rawText: string) {
  const head = String(rawText || "").slice(0, 5000);
  const must = ["招生单位", "专业代码", "专业名称", "方向代码", "研究方向", "学科门类", "学位类型", "学制", "授课语言", "校区"];
  return must.filter((x) => head.includes(x)).length >= 8;
}

function hasSimpleFacultyDurationHeader(rawText: string) {
  const head = String(rawText || "").slice(0, 5000);
  return (
    /院系/.test(head) &&
    /专业名称/.test(head) &&
    /学制\s*\(?年\)?/.test(head)
  );
}

function looksLikeFacultyName(line: string) {
  const s = norm(line);
  if (!s) return false;
  if (isNoise(s)) return false;
  if (/\d/.test(s)) return false;
  if (/[A-Za-z]/.test(s)) return false;
  if (s.length < 2 || s.length > 30) return false;
  return /(学院|学部|系|中心|研究院|书院|医院|马克思主义学院)$/.test(s);
}

function parseSimpleFacultyDurationCatalog(
  rawText: string,
  kind: Kind = "other",
): GenericCnResearchCatalogResult | null {
  const text = String(rawText || "").replace(/\f/g, "\n").replace(/\r/g, "\n");

  if (!hasSimpleFacultyDurationHeader(text)) return null;

  const lines = text
    .split("\n")
    .map((x) => norm(x))
    .filter(Boolean);

  const rows: any[] = [];
  const pendingRows: Array<{ program: string; duration: any; rawLine: string }> = [];
  let currentFaculty: string | null = null;

  const simpleRowRe = /^(.+?)\s+(\d+(?:\.\d+)?)$/;

  function parseSimpleDuration(durationRaw: any) {
    const m = String(durationRaw || "").match(/(\d+(?:\.\d+)?)/);
    const n = m ? Number(m[1]) : null;
    return n != null && Number.isFinite(n) && n >= 1 && n <= 10 ? n : null;
  }

  function makeRow(faculty: string, program: string, durationRaw: any, rawLine: string) {
    const facultyCn = norm(faculty);
    const programCn = norm(program);
    const duration = parseSimpleDuration(durationRaw);

    if (!facultyCn || !programCn || !duration) return null;
    if (!hasCn(programCn)) return null;
    if (/^(院系|专业名称|学制)/.test(programCn)) return null;
    if (looksLikeFacultyName(programCn)) return null;

    const isEnglish = /英文授课|English/i.test(programCn);
    const isProfessional = /专业学位/.test(programCn);

    const row: any = {
      idx: rows.length + 1,
      kind,
      faculty_code: null,
      faculty_cn: facultyCn,
      faculty_en: null,

      major_code: null,
      program_name_cn: programCn,
      program_name_en: null,

      track_code: null,
      track_name_cn: null,
      track_name_en: null,

      discipline_category_text: null,
      degree_type:
        kind === "phd" ? "博士" :
        kind === "master" ? "硕士" :
        null,
      degree_kind: isProfessional ? "专业学位" : "学术学位",

      study_language: isEnglish ? "en" : "zh",
      language_text: isEnglish ? "英文" : "中文",

      duration_years: duration,
      duration_text: `${duration}年`,

      tuition_rmb_per_year: null,
      tuition_total_rmb: null,
      tuition_is_per_year: null,
      tuition_note: null,
      tuition_source_url: null,

      campus_text: null,
      supervisors_text: null,
      supervisor_names: null,
      supervisor_names_text: null,

      contact_raw: null,
      apply_requirements_text: null,
      remarks_text: null,

      raw_line: rawLine,
      raw_block: rawLine,
    };

    const flags = buildReviewFlags(row);
    row.needs_review = flags.length > 0;
    row.review_flags = flags;

    return row;
  }

  function flushPending(faculty: string) {
    if (!pendingRows.length) return;
    for (const pending of pendingRows.splice(0)) {
      const row = makeRow(faculty, pending.program, pending.duration, pending.rawLine);
      if (row) rows.push(row);
    }
  }

  for (const line of lines) {
    if (isNoise(line)) continue;

    const normalizedLine = norm(line);
    if (!normalizedLine) continue;

    const m = normalizedLine.match(simpleRowRe);
    if (m) {
      const left = norm(m[1]);
      const duration = m[2];

      // 情况 A：院系 + 专业 + 学制 同行
      const inlineFaculty = left.match(/^(.+?(?:学院|学部|系|中心|研究院|书院|医院|马克思主义学院))\s+(.+)$/);
      if (inlineFaculty) {
        const faculty = norm(inlineFaculty[1]);
        const program = norm(inlineFaculty[2]);

        if (looksLikeFacultyName(faculty)) {
          currentFaculty = faculty;

          // PDF 抽取可能把第一个专业放在院系行前面，先归入当前院系
          flushPending(faculty);

          const row = makeRow(faculty, program, duration, normalizedLine);
          if (row) rows.push(row);
          continue;
        }
      }

      // 情况 B：专业 + 学制，继承上一院系
      if (currentFaculty) {
        const row = makeRow(currentFaculty, left, duration, normalizedLine);
        if (row) rows.push(row);
      } else {
        // 情况 C：专业行出现在院系前面，先缓存
        pendingRows.push({ program: left, duration, rawLine: normalizedLine });
      }

      continue;
    }

    // 情况 D：单独院系行
    if (looksLikeFacultyName(normalizedLine)) {
      currentFaculty = normalizedLine;
      flushPending(currentFaculty);
      continue;
    }
  }

  const cleaned = rows
    .filter((r) => r.faculty_cn && r.program_name_cn && r.duration_years)
    .map((r, i) => {
      const next = { ...r, idx: i + 1 };
      const flags = buildReviewFlags(next);
      next.needs_review = flags.length > 0;
      next.review_flags = flags;
      return next;
    });

  const reviewSummary: Record<string, number> = {};
  for (const r of cleaned) {
    for (const f of r.review_flags || []) {
      reviewSummary[f] = (reviewSummary[f] || 0) + 1;
    }
  }

  return {
    ok: cleaned.length > 0,
    rows: cleaned,
    meta: {
      parser: "generic_cn_research_catalog_pdf_v1",
      doc_type: "generic_cn_research_catalog",
      profile: "simple_faculty_program_duration_catalog",
      rows: cleaned.length,
      table_header: ["院系", "专业名称", "学制(年)"],
      review_summary: reviewSummary,
    },
  };
}



function parseDuration(s: any) {
  const m = String(s || "").match(/(\d+(?:\.\d+)?)/);
  const n = m ? Number(m[1]) : null;
  return n != null && Number.isFinite(n) && n >= 1 && n <= 10 ? n : null;
}

function degreeTypeForKind(kind: Kind) {
  if (kind === "phd") return "博士";
  if (kind === "master") return "硕士";
  return null;
}

function normalizeCampus(s: any) {
  const t = norm(s);
  if (!t) return null;
  const m = t.match(/(广州校区[^\s,，、]*)|(珠海校区[^\s,，、]*)|(深圳校区[^\s,，、]*)|([^\s,，、]*校区[^\s,，、]*)/);
  return m ? norm(m[0]) : t;
}

function cleanSupervisor(s: any) {
  let t = norm(s);
  t = t.replace(/^导师教?姓名\s*/g, "").trim();
  if (!t) return null;
  return t;
}

function looksLikeSupervisorContinuation(line: string) {
  const s = norm(line);
  if (!s) return false;
  if (/^\d{6}\b/.test(s)) return false;
  if (/\s\d{6}\s/.test(s)) return false;
  if (/^[\u4e00-\u9fff·、，,]+$/.test(s) && s.length >= 2) return true;
  if (/^[\u4e00-\u9fff·、，,\s]+$/.test(s) && /[，,、]/.test(s)) return true;
  return false;
}


export function parseGenericCnResearchCatalogPdf(
  rawText: string,
  kind: Kind = "other",
): GenericCnResearchCatalogResult {
  const text = String(rawText || "").replace(/\f/g, "\n").replace(/\r/g, "\n");

  if (!hasHeader(text)) {
    const simpleFacultyDuration = parseSimpleFacultyDurationCatalog(text, kind);
    if (
      simpleFacultyDuration &&
      Array.isArray(simpleFacultyDuration.rows) &&
      simpleFacultyDuration.rows.length > 0
    ) {
      return simpleFacultyDuration;
    }

    return {
      ok: false,
      rows: [],
      meta: {
        parser: "generic_cn_research_catalog_pdf_v1",
        doc_type: "generic_cn_research_catalog",
        rows: 0,
        error: "header_not_matched",
        table_header: standardCatalogTableHeader(),
      },
    };
  }

  const lines = text
    .split("\n")
    .map((x) => norm(x))
    .filter(Boolean);

  const rows: any[] = [];
  let lastRow: any | null = null;

  /*
   * PDF layout 行通常类似：
   * 中国语言文学系 050100 中国语言文学 06 中国现当代文学 文学 学术学位 4 中文 广州校区南校园 陈希
   */
  const rowRe =
    /^(.+?)\s+([0-9A-Z]{5,8})\s+([\u4e00-\u9fffA-Za-z（）()·\-\/]{2,80})\s+([0-9A-Z]{1,4})\s+(.+?)\s+([\u4e00-\u9fff]{1,12})\s+(学术学位|专业学位)\s+(\d+(?:\.\d+)?)\s+(中文|英文|中英文|Chinese|English)\s+([^\s]+校区[^\s]*)\s*(.*)$/;

  for (const line of lines) {
    if (isNoise(line)) continue;

    const m = line.match(rowRe);

    if (m) {
      const faculty = m[1];
      const majorCode = m[2];
      const program = m[3];
      const trackCode = m[4];
      const track = m[5];
      const discipline = m[6];
      const degreeKind = m[7];
      const duration = m[8];
      const language = m[9];
      const campus = m[10];
      const supervisors = m[11];

      const row: any = {
        idx: rows.length + 1,
        kind,
        faculty_code: null,
        faculty_cn: norm(faculty) || null,
        faculty_en: null,

        major_code: norm(majorCode) || null,
        program_name_cn: norm(program) || null,
        program_name_en: null,

        track_code: norm(trackCode) || null,
        track_name_cn: norm(track) || null,
        track_name_en: null,

        discipline_category_text: norm(discipline) || null,
        degree_type: degreeTypeForKind(kind),
        degree_kind: norm(degreeKind) || null,

        study_language:
          /英文|English/i.test(String(language || "")) ? "en" :
          /中文|Chinese/i.test(String(language || "")) ? "zh" :
          null,
        language_text: norm(language) || null,

        duration_years: parseDuration(duration),

        tuition_rmb_per_year: null,
        tuition_total_rmb: null,
        tuition_is_per_year: null,
        tuition_note: null,
        tuition_source_url: null,

        campus_text: normalizeCampus(campus),
        supervisors_text: cleanSupervisor(supervisors) || null,
        supervisor_names: cleanSupervisor(supervisors) || null,
        supervisor_names_text: cleanSupervisor(supervisors),

        contact_raw: null,
        apply_requirements_text: null,
        remarks_text: null,

        raw_line: line,
        raw_block: line,
      };

      const flags = buildReviewFlags(row);
      row.needs_review = flags.length > 0;
      row.review_flags = flags;

      rows.push(row);
      lastRow = row;
      continue;
    }

    // 导师姓名跨行续接
    if (lastRow && looksLikeSupervisorContinuation(line)) {
      const more = cleanSupervisor(line);

      const base =
        cleanSupervisor(lastRow.supervisors_text) ||
        cleanSupervisor(lastRow.supervisor_names_text) ||
        cleanSupervisor(lastRow.supervisor_names) ||
        "";

      const cleanedMerged = cleanSupervisor(
        [base, more].filter(Boolean).join(","),
      );

      lastRow.supervisors_text = cleanedMerged || null;
      lastRow.supervisor_names = cleanedMerged || null;
      lastRow.supervisor_names_text = cleanedMerged || null;
      lastRow.raw_block = [lastRow.raw_block, line].filter(Boolean).join("\n");

      const flags = buildReviewFlags(lastRow);
      lastRow.needs_review = flags.length > 0;
      lastRow.review_flags = flags;

      continue;
    }
  }

  const cleaned = rows
    .filter((r) => r.major_code && (r.program_name_cn || r.program_name_en))
    .map((r, i) => {
      const next = { ...r, idx: i + 1 };
      const flags = buildReviewFlags(next);
      next.needs_review = flags.length > 0;
      next.review_flags = flags;
      return next;
    });

  const reviewSummary: Record<string, number> = {};
  for (const r of cleaned) {
    for (const f of r.review_flags || []) {
      reviewSummary[f] = (reviewSummary[f] || 0) + 1;
    }
  }

  return {
    ok: cleaned.length > 0,
    rows: cleaned,
    meta: {
      parser: "generic_cn_research_catalog_pdf_v1",
      doc_type: "generic_cn_research_catalog",
      rows: cleaned.length,
      table_header: standardCatalogTableHeader(),
      review_summary: reviewSummary,
    },
  };
}
