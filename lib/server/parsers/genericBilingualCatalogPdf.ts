import {
  buildReviewFlags,
  standardCatalogTableHeader,
} from "@/lib/server/parsers/catalogFieldRules";

export type GenericBilingualCatalogResult = {
  ok: boolean;
  rows: any[];
  meta: Record<string, any>;
};

type Kind = "ug" | "master" | "phd" | "other";

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

function hasEn(s: any) {
  return /[A-Za-z]/.test(String(s || ""));
}

function isCnOnly(s: any) {
  const t = norm(s);
  return !!t && hasCn(t) && !hasEn(t);
}

function isEnOnly(s: any) {
  const t = norm(s);
  return !!t && hasEn(t) && !hasCn(t);
}

function leadPos(line: string) {
  const m = String(line || "").match(/^\s*/);
  return m ? m[0].length : 0;
}

function parseDuration(s: any): number | null {
  const m = String(s || "").match(/(\d+(?:\.\d+)?)\s*(?:年|year|years)/i);
  const n = m ? Number(m[1]) : null;
  return n != null && Number.isFinite(n) && n >= 1 && n <= 10 ? n : null;
}

function isFacultyCn(s: any) {
  const t = norm(s);
  if (!isCnOnly(t)) return false;
  return /(学院|书院|学部|系|中心|研究院|研究所|学校)$/.test(t);
}

function isFacultyEnStart(s: any) {
  const t = norm(s);
  if (!isEnOnly(t)) return false;
  return /^(School|Institute|College|Faculty|Department|Center|Law School|Business School)\b/i.test(t);
}

function isCscaText(s: any) {
  const t = norm(s);
  return /(文科中文|理科中文|数学|物理|化学|生物|Humanities Chinese|STEM Chinese|Mathematics|Physics|Chemistry|Biology)/i.test(t);
}

function isNoise(s: any) {
  const t = norm(s);
  if (!t) return true;
  if (/^\d+\s*\/\s*\d+$/.test(t)) return true;
  if (/^2026年本科专业目录/.test(t)) return true;
  if (/^Catalog of Undergraduate Programs/i.test(t)) return true;
  if (/^(注[:：]?|学院|专业|学制|CSCA科目要求)$/i.test(t)) return true;
  if (/^(School\/Departments|Schools\/Departments|Major|Length of Schooling|CSCA Test Subjects)$/i.test(t)) return true;
  if (/^\d+[.、]/.test(t)) return true;
  if (/本科专业均为中文授课/.test(t)) return true;
  if (/申请汉语言专业/.test(t)) return true;
  return false;
}

function isLikelyProgramCn(s: any) {
  const t = norm(s);
  if (!isCnOnly(t)) return false;
  if (isFacultyCn(t)) return false;
  if (isCscaText(t)) return false;
  if (parseDuration(t) != null) return false;
  if (t.length > 45) return false;
  return true;
}

function isLikelyProgramEn(s: any) {
  const t = norm(s);
  if (!isEnOnly(t)) return false;
  if (isFacultyEnStart(t)) return false;
  if (isCscaText(t)) return false;
  if (parseDuration(t) != null) return false;
  if (/^(School|Institute|College|Faculty|Department|Center)\b/i.test(t)) return false;
  return true;
}

function takeRemarks(rawText: string) {
  const text = String(rawText || "").replace(/\r/g, "\n");
  const m = text.match(/注[:：]?\s*([\s\S]{0,500}?)(?=\n\s*学院\s+专业|\n\s*School\/Departments|$)/);
  return m?.[1] ? norm(m[1].replace(/\n+/g, " ")) : null;
}

function splitCells(line: string) {
  const raw = String(line || "");
  const parts = raw.trim().split(/\s{2,}/).map(norm).filter(Boolean);
  return parts.map((text) => ({
    text,
    pos: raw.indexOf(text),
  }));
}

function stripInlineDuration(text: string) {
  const t = norm(text);
  const m = t.match(/^(.+?)\s+(\d+)\s*年$/);
  if (!m) return { text: t, duration: null as number | null };
  return {
    text: norm(m[1]),
    duration: Number(m[2]),
  };
}

function splitInlineEnDurationNextCn(text: string) {
  const t = norm(text);
  const m = t.match(/^([A-Za-z][A-Za-z&,\-.'\s]+?)\s+(\d+)\s*年\s+([\u4e00-\u9fff].+)$/);
  if (!m) return null;
  return {
    en: norm(m[1]),
    duration: Number(m[2]),
    nextCn: norm(m[3]),
  };
}

function splitInlineCnEn(text: string) {
  const t = norm(text);
  const m = t.match(/^([\u4e00-\u9fff（）()·\-\/]{2,40})\s+([A-Za-z].+)$/);
  if (!m) return null;
  return {
    cn: norm(m[1]),
    en: norm(m[2]),
  };
}

function cleanEn(s: any) {
  return norm(s)
    .replace(/\s+/g, " ")
    .trim() || null;
}

function pushRow(rows: any[], input: {
  kind: Kind;
  faculty_cn: string | null;
  faculty_en: string | null;
  program_name_cn: string | null;
  program_name_en: string | null;
  duration_years: number | null;
  csca_subjects_text: string | null;
  remarks_text: string | null;
  raw_block: string | null;
}) {
  if (!input.program_name_cn && !input.program_name_en) return;

  const row: any = {
    idx: rows.length + 1,
    kind: input.kind,

    faculty_code: null,
    faculty_cn: input.faculty_cn,
    faculty_en: input.faculty_en,

    major_code: null,
    program_name_cn: input.program_name_cn,
    program_name_en: input.program_name_en,

    track_name_cn: null,
    track_name_en: null,

    degree_type:
      input.kind === "ug"
        ? "本科"
        : input.kind === "master"
          ? "硕士"
          : input.kind === "phd"
            ? "博士"
            : null,
    degree_kind: null,
    study_language: input.kind === "ug" ? "zh" : null,
    language_text: input.kind === "ug" ? "中文" : null,
    study_mode_cn: null,

    duration_years: input.duration_years || (input.kind === "ug" ? 4 : null),

    tuition_rmb_per_year: null,
    tuition_total_rmb: null,
    tuition_is_per_year: null,
    tuition_note: null,
    tuition_source_url: null,

    csca_subjects_text: input.csca_subjects_text,
    apply_requirements_text: null,
    remarks_text: input.remarks_text,

    contact_raw: null,
    raw_line: [
      input.faculty_cn,
      input.faculty_en,
      input.program_name_cn,
      input.program_name_en,
    ].filter(Boolean).join(" | ") || null,
    raw_block: input.raw_block,
  };

  const flags = buildReviewFlags(row);
  row.needs_review = flags.length > 0;
  row.review_flags = flags;

  rows.push(row);
}


function repairMisalignedBilingualRows(rows: any[]) {
  const out: any[] = [];
  let i = 0;

  const empty = (v: any) => !String(v ?? "").trim() || String(v ?? "").trim() === "-";

  const badProgramCn = (v: any) => {
    const t = String(v ?? "").trim();
    if (!t) return true;
    if (/^注[:：]?$/.test(t)) return true;
    if (/本科专业均为中文授课|申请汉语言专业|CSCA|School\/Departments/i.test(t)) return true;
    return false;
  };

  while (i < rows.length) {
    const cur: any = { ...(rows[i] || {}) };
    const next: any | null = rows[i + 1] ? { ...(rows[i + 1] || {}) } : null;

    if (badProgramCn(cur.program_name_cn) && empty(cur.program_name_en)) {
      i++;
      continue;
    }

    // 典型错位：
    // cur: faculty=文学院, program_cn=历史学, program_en=null
    // next: faculty=历史学院, program_cn=null, program_en=History
    // => 合并为 faculty=历史学院, program_cn=历史学, program_en=History
    if (
      next &&
      !empty(cur.program_name_cn) &&
      empty(cur.program_name_en) &&
      empty(next.program_name_cn) &&
      !empty(next.program_name_en)
    ) {
      const merged: any = { ...cur };

      merged.program_name_en = next.program_name_en;

      if (!empty(next.faculty_cn)) merged.faculty_cn = next.faculty_cn;
      if (!empty(next.faculty_en)) merged.faculty_en = next.faculty_en;

      if (merged.duration_years == null && next.duration_years != null) {
        merged.duration_years = next.duration_years;
      }

      if (!String(merged.csca_subjects_text || "").trim() && String(next.csca_subjects_text || "").trim()) {
        merged.csca_subjects_text = next.csca_subjects_text;
      }

      merged.raw_block = [cur.raw_block, next.raw_block].filter(Boolean).join("\n");
      merged.raw_line = [
        merged.faculty_cn,
        merged.faculty_en,
        merged.program_name_cn,
        merged.program_name_en,
      ].filter(Boolean).join(" | ");

      out.push(merged);
      i += 2;
      continue;
    }

    // 如果当前是“只有英文专业”的孤儿行，尽量并入上一条；
    // 但如果上一条已有英文，则丢弃这个孤儿，避免重复污染。
    if (
      out.length > 0 &&
      empty(cur.program_name_cn) &&
      !empty(cur.program_name_en)
    ) {
      const prev: any = out[out.length - 1];

      if (empty(prev.program_name_en)) {
        prev.program_name_en = cur.program_name_en;
        if (!empty(cur.faculty_cn)) prev.faculty_cn = cur.faculty_cn;
        if (!empty(cur.faculty_en)) prev.faculty_en = cur.faculty_en;
        prev.raw_block = [prev.raw_block, cur.raw_block].filter(Boolean).join("\n");
        prev.raw_line = [
          prev.faculty_cn,
          prev.faculty_en,
          prev.program_name_cn,
          prev.program_name_en,
        ].filter(Boolean).join(" | ");
      }

      i++;
      continue;
    }

    out.push(cur);
    i++;
  }

  return out.map((row: any, idx: number) => {
    const next: any = { ...(row || {}), idx: idx + 1 };

    const flags = buildReviewFlags(next);
    next.needs_review = flags.length > 0;
    next.review_flags = flags;

    return next;
  });
}


function dedupe(rows: any[]) {
  const seen = new Set<string>();
  const out: any[] = [];

  for (const r of rows) {
    const key = [
      r.faculty_cn || "",
      r.program_name_cn || "",
      r.program_name_en || "",
    ].join("::");

    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }

  return out.map((r, i) => {
    const next = { ...r, idx: i + 1 };
    const flags = buildReviewFlags(next);
    next.needs_review = flags.length > 0;
    next.review_flags = flags;
    return next;
  });
}


function parseSysuLikeUndergradGapCatalog(rawText: string, kind: Kind) {
  const raw = String(rawText || "");
  if (
    kind !== "ug" ||
    !/中山大学2026年国际学生（本科）招生专业目录|SYSU Majors Catalog for Undergraduate International Students/i.test(raw)
  ) {
    return [];
  }

  const lines = raw
    .replace(/\f/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((x) => String(x || ""))
    .filter((x) => x.trim());

  const rows: any[] = [];
  let currentFacultyCn: string | null = null;
  let currentUrl: string | null = null;

  const headerNoise =
    /(附件1|中山大学2026年国际学生|SYSU Majors Catalog|学费|单位：元|序号|School&Department|Major \(Category\)|Years of|Instructing|Tuition|Minimum|Required Subjects|Academic|Score for HSK|for CSCA|Campus|Note)/i;

  const clean1 = (v: any) => norm(v).replace(/\s+/g, " ").trim();

  function isUrlLine(line: string) {
    return /https?:\/\/\S+/i.test(line);
  }

  function getUrl(line: string) {
    return (String(line || "").match(/https?:\/\/\S+/i) || [null])[0];
  }

  function isFacultyCnLine(line: string) {
    const t = clean1(line);
    if (!t || headerNoise.test(t)) return false;
    if (!/[\u4e00-\u9fff]/.test(t)) return false;
    if (/(中文|HSK|文科中文|理科中文|数学|物理|化学|广州校区|深圳校区|珠海校区|申请|成绩|免考)/.test(t)) return false;
    if (/(类|学|语言|医学|药学|护理学|管理|工程|科学|文学|哲学|法学)$/.test(t)) return false;
    return /(学院|学系|系|中心|研究院|书院|医院)$/.test(t);
  }

  function parseCnMajorLine(line: string) {
    const t = clean1(line);
    if (!t || headerNoise.test(t)) return null;
    if (!/[\u4e00-\u9fff]/.test(t)) return null;
    if (!/(中文|英文|英语|HSK|校区)/.test(t)) return null;

    const campus = (t.match(/(广州校区|深圳校区|珠海校区)/) || [null])[0];
    const hsk = t.match(/HSK\s*([四五六])级\s*([0-9]{3})分/);
    const lang = /(英文|英语)/.test(t) ? "English" : /(中文|汉语)/.test(t) ? "Chinese" : null;

    let csca: string | null = null;
    const cscaPatterns = [
      /文科中文（或理科中文）和数学/,
      /文科中文\(或理科中文\)和数学/,
      /理科中文、数学、物理和化学/,
      /理科中文、数学和物理、化学/,
      /理科中文、数学和物理/,
      /理科中文、数学和化学/,
    ];
    for (const re of cscaPatterns) {
      const m = t.match(re);
      if (m) {
        csca = m[0];
        break;
      }
    }

    let major = t
      .replace(/文科中文（或理科中文）和数学/g, " ")
      .replace(/文科中文\(或理科中文\)和数学/g, " ")
      .replace(/理科中文、数学、物理和化学/g, " ")
      .replace(/理科中文、数学和物理、化学/g, " ")
      .replace(/理科中文、数学和物理/g, " ")
      .replace(/理科中文、数学和化学/g, " ")
      .replace(/HSK\s*[四五六]级\s*[0-9]{3}分/g, " ")
      .replace(/(广州校区|深圳校区|珠海校区)/g, " ")
      .replace(/(中文|英文|英语|汉语)\s*/g, " ");

    major = clean1(major);

    if (!major || major.length < 2) return null;
    if (/HSK|校区|文科中文|理科中文|申请|成绩|免考/.test(major)) return null;

    return {
      program_name_cn: major,
      language_text: lang,
      hsk_requirement_text: hsk ? `HSK${hsk[1]}级${hsk[2]}分` : null,
      csca_subjects_text: csca,
      campus_text: campus,
    };
  }

  function parseNoDeptFeeLine(line: string) {
    const t = clean1(line);
    const m = t.match(/^(\d{1,3})\s+(.+?)\s+([45])\s+([0-9]{2},[0-9]{3}|[0-9]{5})\b/);
    if (!m) return null;

    return {
      no: Number(m[1]),
      faculty_en: clean1(m[2]),
      duration_years: Number(m[3]),
      tuition_rmb_per_year: Number(String(m[4]).replace(/,/g, "")),
    };
  }

  function parseEnMajorLine(line: string) {
    const t = clean1(line);
    if (!t || !/[A-Za-z]/.test(t)) return null;
    if (!/\bChinese\b|\bEnglish\b|Score 180 in HSK|Campus/.test(t)) return null;

    let major = t
      .replace(/Humanities Chinese \(or STEM Chinese\), Mathematics/i, " ")
      .replace(/STEM Chinese, Mathematics, Physics, Chemistry/i, " ")
      .replace(/STEM Chinese, Mathematics, Physics/i, " ")
      .replace(/STEM Chinese, Mathematics, Chemistry/i, " ")
      .replace(/Score\s+180\s+in\s+HSK\s+Level\s+[456]/i, " ")
      .replace(/(Guangzhou|Shenzhen|Zhuhai)\s+Campus/i, " ")
      .replace(/\bChinese\b|\bEnglish\b/g, " ");

    major = clean1(major);

    if (!major || major.length < 2) return null;
    if (/^(Score|STEM|Humanities|Campus)$/i.test(major)) return null;
    return major;
  }

  for (let i = 0; i < lines.length; i += 1) {
    const line = clean1(lines[i]);
    if (!line || headerNoise.test(line)) continue;

    if (isUrlLine(line)) {
      currentUrl = getUrl(line);
      continue;
    }

    if (isFacultyCnLine(line)) {
      currentFacultyCn = line;
      continue;
    }

    const cnMajor = parseCnMajorLine(line);
    if (!cnMajor) continue;

    let noInfo: any = null;
    let enMajor: string | null = null;
    let sourceUrl = currentUrl;

    for (let j = i + 1; j < Math.min(lines.length, i + 9); j += 1) {
      const look = clean1(lines[j]);
      if (!noInfo) noInfo = parseNoDeptFeeLine(look);
      if (!enMajor) enMajor = parseEnMajorLine(look);
      if (!sourceUrl && isUrlLine(look)) sourceUrl = getUrl(look);
    }

    if (!noInfo) continue;

    rows.push({
      idx: noInfo.no,
      kind,
      faculty_code: null,
      faculty_cn: currentFacultyCn,
      faculty_en: noInfo.faculty_en,

      major_code: null,
      program_name_cn: cnMajor.program_name_cn,
      program_name_en: enMajor,

      track_name_cn: null,
      track_name_en: null,

      degree_type: "本科",
      degree_kind: null,
      study_language: cnMajor.language_text === "English" ? "en" : "zh",
      language_text: cnMajor.language_text || "Chinese",
      study_mode_cn: null,

      duration_years: noInfo.duration_years,

      tuition_rmb_per_year: noInfo.tuition_rmb_per_year,
      tuition_total_rmb: noInfo.tuition_rmb_per_year && noInfo.duration_years
        ? noInfo.tuition_rmb_per_year * noInfo.duration_years
        : null,
      tuition_is_per_year: noInfo.tuition_rmb_per_year != null ? true : null,
      tuition_note: null,
      tuition_source_url: null,

      csca_subjects_text: cnMajor.csca_subjects_text,
      hsk_requirement_text: cnMajor.hsk_requirement_text,
      apply_requirements_text: null,
      remarks_text: null,

      campus_text: cnMajor.campus_text,
      source_url: sourceUrl,

      contact_raw: null,
      raw_line: [
        currentFacultyCn,
        noInfo.faculty_en,
        cnMajor.program_name_cn,
        enMajor,
      ].filter(Boolean).join(" | ") || null,
      raw_block: lines.slice(i, Math.min(lines.length, i + 5)).join("\n"),
    });
  }

  const byIdx = new Map<number, any>();
  for (const r of rows) {
    if (!byIdx.has(Number(r.idx))) byIdx.set(Number(r.idx), r);
  }

  return Array.from(byIdx.values())
    .sort((a, b) => Number(a.idx || 0) - Number(b.idx || 0))
    .map((r, i) => {
      const next = { ...r, idx: i + 1 };
      const flags = buildReviewFlags(next);
      next.needs_review = flags.length > 0;
      next.review_flags = flags;
      return next;
    });
}


export function parseGenericBilingualCatalogPdf(
  rawText: string,
  kind: Kind = "ug",
): GenericBilingualCatalogResult {
  const lines = String(rawText || "")
    .replace(/\f/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n");

  const remarksText = takeRemarks(rawText);

  const rows: any[] = [];

  let facultyCn: string | null = null;
  let facultyEnParts: string[] = [];

  let currentDuration: number | null = null;
  let currentCscaCn: string | null = null;
  let currentCscaEn: string | null = null;

  let pendingCn: string | null = null;
  let pendingEnParts: string[] = [];
  let pendingRaw: string[] = [];

  function facultyEn() {
    return facultyEnParts.length ? cleanEn(facultyEnParts.join(" ")) : null;
  }

  function cscaText() {
    if (currentCscaCn && currentCscaEn) return `${currentCscaCn} / ${currentCscaEn}`;
    return currentCscaCn || currentCscaEn || null;
  }

  function flush() {
    if (!pendingCn && pendingEnParts.length === 0) return;

    pushRow(rows, {
      kind,
      faculty_cn: facultyCn,
      faculty_en: facultyEn(),
      program_name_cn: pendingCn,
      program_name_en: cleanEn(pendingEnParts.join(" ")),
      duration_years: currentDuration,
      csca_subjects_text: cscaText(),
      remarks_text: remarksText,
      raw_block: pendingRaw.join("\n") || null,
    });

    pendingCn = null;
    pendingEnParts = [];
    pendingRaw = [];
  }

  let tableStarted = false;

  for (const rawLine of lines) {
    const line = norm(rawLine);

    if (!tableStarted) {
      if (
        line.includes("School/Departments") ||
        line.includes("Schools/Departments") ||
        (
          line.includes("学院") &&
          line.includes("专业") &&
          line.includes("学制")
        )
      ) {
        tableStarted = true;
      }
      continue;
    }

    if (isNoise(line)) continue;

    const cells = splitCells(rawLine);
    if (cells.length === 0) continue;

    for (let ci = 0; ci < cells.length; ci++) {
      let text = norm(cells[ci].text);
      const pos = cells[ci].pos >= 0 ? cells[ci].pos : leadPos(rawLine);

      if (!text || isNoise(text)) continue;

      const inlineMix = splitInlineEnDurationNextCn(text);
      if (inlineMix) {
        if (pendingCn) {
          pendingEnParts.push(inlineMix.en);
          pendingRaw.push(rawLine);
          currentDuration = inlineMix.duration || currentDuration;
          flush();
        }
        pendingCn = inlineMix.nextCn;
        pendingRaw.push(rawLine);
        continue;
      }

      const durationHit = parseDuration(text);
      if (durationHit != null && /^(\d+(?:\.\d+)?)\s*(?:年|year|years)$/i.test(text)) {
        currentDuration = durationHit;
        continue;
      }

      const stripped = stripInlineDuration(text);
      if (stripped.duration != null) {
        currentDuration = stripped.duration;
        text = stripped.text;
      }

      if (isCscaText(text)) {
        if (hasCn(text)) currentCscaCn = text;
        else if (hasEn(text)) currentCscaEn = text;
        continue;
      }

      const cnEn = splitInlineCnEn(text);
      if (cnEn) {
        if (isFacultyCn(cnEn.cn)) {
          flush();
          facultyCn = cnEn.cn;
          facultyEnParts = [];
          if (isLikelyProgramEn(cnEn.en)) {
            pendingEnParts.push(cnEn.en);
            pendingRaw.push(rawLine);
          } else if (isFacultyEnStart(cnEn.en)) {
            facultyEnParts.push(cnEn.en);
          }
          continue;
        }

        if (isLikelyProgramCn(cnEn.cn)) {
          flush();
          pendingCn = cnEn.cn;
          if (isLikelyProgramEn(cnEn.en)) pendingEnParts.push(cnEn.en);
          pendingRaw.push(rawLine);
          continue;
        }
      }

      if (isFacultyCn(text)) {
        flush();
        facultyCn = text;
        facultyEnParts = [];
        currentDuration = stripped.duration ?? currentDuration;
        pendingRaw = [];
        continue;
      }

      if (isFacultyEnStart(text)) {
        if (pendingCn && pos >= 28) {
          pendingEnParts.push(text);
          pendingRaw.push(rawLine);
        } else {
          facultyEnParts.push(text);
        }
        continue;
      }

      if (isEnOnly(text) && facultyEnParts.length > 0 && pos < 30 && !pendingCn) {
        facultyEnParts.push(text);
        continue;
      }

      if (isEnOnly(text) && facultyEnParts.length > 0 && pos < 30 && pendingCn && ci === 0) {
        facultyEnParts.push(text);
        continue;
      }

      if (isLikelyProgramCn(text)) {
        flush();
        pendingCn = text;
        pendingRaw.push(rawLine);
        continue;
      }

      if (isLikelyProgramEn(text)) {
        if (pendingCn || pos >= 28) {
          pendingEnParts.push(text);
          pendingRaw.push(rawLine);
        } else if (facultyEnParts.length > 0) {
          facultyEnParts.push(text);
        }
        continue;
      }
    }
  }

  flush();

  let cleaned = dedupe(repairMisalignedBilingualRows(rows));

  const sysuLikeRows = parseSysuLikeUndergradGapCatalog(rawText, kind);
  if (sysuLikeRows.length >= 40) {
    cleaned = sysuLikeRows;
  }

  const reviewSummary: Record<string, number> = {};
  for (const r of cleaned) {
    for (const f of r.review_flags || []) {
      reviewSummary[f] = (reviewSummary[f] || 0) + 1;
    }
  }

  console.log("[GENERIC_BILINGUAL_CATALOG_GAP_STATE_DEBUG]", {
    inputLines: lines.length,
    rows: cleaned.length,
    first12: cleaned.slice(0, 12),
    reviewSummary,
  });

  return {
    ok: cleaned.length > 0,
    rows: cleaned,
    meta: {
      parser: cleaned === sysuLikeRows && sysuLikeRows.length > 0
        ? "generic_bilingual_sysu_undergrad_gap_table_v1"
        : "generic_bilingual_catalog_gap_state_v5_repair",
      doc_type: "generic_bilingual_catalog",
      rows: cleaned.length,
      table_header: standardCatalogTableHeader(),
      review_summary: reviewSummary,
      remarks_text: remarksText,
    },
  };
}
