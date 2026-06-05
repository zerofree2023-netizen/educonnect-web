export type TablePdfProgramRow = {
  idx: number;
  faculty_code: string | null;
  faculty_cn: string | null;
  faculty_en: string | null;
  major_code: string | null;
  program_name_cn: string | null;
  program_name_en: string | null;
  track_name_cn: string | null;
  track_name_en: string | null;
  contact_raw: string | null;
  duration_years: number | null;
  tuition_rmb_per_year: number | null;
  tuition_total_rmb: number | null;
  tuition_is_per_year: boolean | null;
  tuition_note: string | null;
  raw_block: string | null;
};

export type TablePdfProgramParseResult = {
  ok: boolean;
  rows: TablePdfProgramRow[];
  meta: Record<string, any>;
};

type TableHeaderDef = {
  faculty?: string[];
  majorCode?: string[];
  majorName?: string[];
  track?: string[];
  contact?: string[];
  duration?: string[];
  tuition?: string[];
};

type Section = {
  faculty_code: string | null;
  lines: string[];
};

type SectionContext = {
  faculty_code: string | null;
  faculty_cn: string | null;
  faculty_en: string | null;
  contact_raw: string | null;
  duration_years: number | null;
  tuition_rmb_per_year: number | null;
  tuition_total_rmb: number | null;
  tuition_is_per_year: boolean | null;
  tuition_note: string | null;
};

type MajorEntry = {
  major_code: string | null;
  rest: string;
  raw_major_line: string;
  extra_lines: string[];
};

function norm(s: any) {
  return String(s ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\t/g, " ")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function splitLines(raw: string) {
  return String(raw || "")
    .replace(/\f/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((x) => norm(x))
    .filter(Boolean)
    .filter((x) => !/^\d+\s*\/\s*\d+$/.test(x))
    .filter((x) => !/^\d+$/.test(x));
}

function escapeRegExp(s: string) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchAny(text: string, kws: string[]) {
  const t = String(text || "").toLowerCase();
  return (kws || []).some((k) => t.includes(String(k || "").toLowerCase()));
}

function hasHeader(
  lines: string[],
  headerDef?: TableHeaderDef,
) {
  const head = lines.slice(0, 120).join(" ");

  const facultyKws = headerDef?.faculty || ["院系名称", "院系", "学院", "Schools/Departments", "School", "Department"];
  const majorCodeKws = headerDef?.majorCode || ["专业代码", "Major Code"];
  const majorNameKws = headerDef?.majorName || ["专业名称", "Major Name"];
  const trackKws = headerDef?.track || ["研究方向", "方向", "Research Fields", "Research Field", "Track"];
  const contactKws = headerDef?.contact || ["联系方式", "Contact"];
  const durationKws = headerDef?.duration || ["学制", "Duration"];
  const tuitionKws = headerDef?.tuition || ["学费", "Tuition"];

  let score = 0;
  if (matchAny(head, facultyKws)) score += 1;
  if (matchAny(head, majorCodeKws)) score += 1;
  if (matchAny(head, majorNameKws)) score += 1;
  if (matchAny(head, trackKws)) score += 1;
  if (matchAny(head, contactKws)) score += 1;
  if (matchAny(head, durationKws)) score += 1;
  if (matchAny(head, tuitionKws)) score += 1;

  return score >= 5;
}

function getFacultyCodeAtLineStart(line: string): string | null {
  const m = String(line || "").match(/^([0-9]{3})\b/);
  return m ? m[1] : null;
}

function getMajorCodeAtLineStart(line: string): string | null {
  const m = String(line || "").match(/^([0-9A-Z]{5,8})\b/);
  return m ? m[1] : null;
}

function looksLikeSectionStart(line: string) {
  return /^[0-9]{3}\b/.test(String(line || ""));
}

function looksLikeMajorStart(line: string) {
  return /^[0-9A-Z]{5,8}\s+/.test(String(line || ""));
}

function isCampusLine(line: string) {
  return /campus/i.test(line);
}

function isEmailLine(line: string) {
  return /@/.test(line) || /email[:：]?/i.test(line);
}

function isPhoneLine(line: string) {
  return (
    /tel[:：]?/i.test(line) ||
    /phone[:：]?/i.test(line) ||
    /(\+?\d[\d\- ]{7,}\d)/.test(line)
  );
}

function isContactLine(line: string) {
  return (
    isEmailLine(line) ||
    isPhoneLine(line) ||
    /contact/i.test(line) ||
    /联系方式/.test(line)
  );
}

function isDurationLine(line: string) {
  return (
    /\b\d+(?:\.\d+)?\s*(?:year|years)\b/i.test(line) ||
    /\d+(?:\.\d+)?\s*年/.test(line) ||
    /duration/i.test(line) ||
    /学制/.test(line)
  );
}

function isTuitionLine(line: string) {
  return (
    /RMB|人民币|tuition|fee|学费|元|\/year|per year|学年|每学年|\/年/i.test(line)
  );
}

function looksLikeCnOnly(line: string) {
  const s = norm(line);
  if (!s) return false;
  if (/[A-Za-z]/.test(s)) return false;
  return /[\u4e00-\u9fff]/.test(s);
}

function looksLikeEnOnly(line: string) {
  const s = norm(line);
  if (!s) return false;
  if (/[\u4e00-\u9fff]/.test(s)) return false;
  return /[A-Za-z]/.test(s);
}

function isNoiseLine(line: string) {
  const s = norm(line);
  if (!s) return true;
  if (/^\d+\s*\/\s*\d+$/.test(s)) return true;
  if (/^(Email|Email：|Email:|Tel|Tel:|Tel：|RMB\/Year)$/i.test(s)) return true;
  return false;
}

function cleanupFacultyCn(text: string) {
  let s = norm(text || "");
  s = s.replace(/\s+/g, "");
  s = s.replace(/Tel[:：]?.*$/i, "");
  s = s.replace(/Email[:：]?.*$/i, "");
  s = s.replace(/[0-9]{4,}.*$/i, "");
  s = s.replace(/RMB\/Year.*$/i, "");
  s = s.replace(/Minhang.*$/i, "");
  s = s.replace(/Xuhui.*$/i, "");
  s = s.replace(/Zhangjiang.*$/i, "");
  s = s.replace(/Lingang.*$/i, "");
  s = s.replace(/[A-Za-z].*$/i, "");
  s = s.trim();

  if (!s) return null;
  if (s === "院" || s === "-" || s === "—") return null;
  if (/^\d+$/.test(s)) return null;
  return s;
}

function cleanupFacultyEn(lines: string[]) {
  const parts = (lines || [])
    .map((x) => norm(x))
    .filter(Boolean)
    .filter((x) => looksLikeEnOnly(x))
    .filter((x) => !isCampusLine(x))
    .filter((x) => !isEmailLine(x))
    .filter((x) => !isPhoneLine(x))
    .filter((x) => !isDurationLine(x))
    .filter((x) => !isTuitionLine(x))
    .filter((x) => !/Research Fields|Major Code|Major Name|Schools\/Departments/i.test(x));

  if (parts.length === 0) return null;

  const s = parts.join(" ").replace(/\s+/g, " ").trim();
  if (!s) return null;
  if (/^(Tel|Email|RMB|Year)$/i.test(s)) return null;
  if (/^\d+$/.test(s)) return null;

  return s || null;
}

function parseDurationYearsLoose(text: any): number | null {
  const s = String(text || "");

  const patterns = [
    /(\d+(?:\.\d+)?)\s*(?:years?|year)\b/i,
    /(\d+(?:\.\d+)?)\s*年/,
    /duration[^0-9]{0,20}(\d+(?:\.\d+)?)/i,
    /学制[^0-9]{0,20}(\d+(?:\.\d+)?)/,
  ];

  for (const re of patterns) {
    const m = s.match(re);
    if (!m) continue;
    const n = Number(m[1]);
    if (Number.isFinite(n) && n >= 1 && n <= 10) return n;
  }

  return null;
}

function parseTuitionLoose(lines: string[]) {
  const text = (lines || []).join(" ");

  const nums = Array.from(text.matchAll(/([1-9]\d{3,5}(?:,\d{3})?)/g))
    .map((m) => Number(String(m[1]).replace(/,/g, "")))
    .filter((n) => Number.isFinite(n) && n >= 10000 && n <= 300000);

  if (nums.length === 0) {
    return {
      tuition_rmb_per_year: null,
      tuition_total_rmb: null,
      tuition_is_per_year: null,
      tuition_note: null,
    };
  }

  const perYearHit =
    /RMB\s*\/\s*Year|\/\s*Year|per\s*year|\/\s*year|\/年|学年|每学年/i.test(text);

  const totalHit =
    /in\s*total|total|总计|全程/i.test(text);

  const n = nums[0];

  if (perYearHit) {
    return {
      tuition_rmb_per_year: n,
      tuition_total_rmb: null,
      tuition_is_per_year: true,
      tuition_note: `${n.toLocaleString("en-US")} RMB/Year`,
    };
  }

  if (totalHit) {
    return {
      tuition_rmb_per_year: null,
      tuition_total_rmb: n,
      tuition_is_per_year: false,
      tuition_note: `${n.toLocaleString("en-US")} RMB Total`,
    };
  }

  return {
    tuition_rmb_per_year: null,
    tuition_total_rmb: null,
    tuition_is_per_year: null,
    tuition_note: null,
  };
}

function parseContactsFromText(block: string): string | null {
  const text = String(block || "");

  const emails = Array.from(
    new Set(text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []),
  );

  const phones = Array.from(
    new Set(
      (text.match(/(\+?\d[\d\- ]{7,}\d)/g) || [])
        .map((x) => x.replace(/\s+/g, " ").trim())
        .filter((x) => x.replace(/[^\d]/g, "").length >= 8)
        .filter((x) => !/^\d{3}\s+[0-9A-Z]{5,8}$/.test(x)),
    ),
  );

  const campusBits = Array.from(
    new Set(
      (text.match(/\b(?:Minhang|Xuhui|Zhangjiang|Lingang)\s+Campus\b/gi) || [])
        .map((x) => norm(x)),
    ),
  );

  const arr = [...campusBits, ...phones, ...emails];
  return arr.length > 0 ? arr.join(" | ") : null;
}

function cleanEnglishName(s: string) {
  return norm(s)
    .replace(/\bXuhui Campus\b/gi, "")
    .replace(/\bMinhang Campus\b/gi, "")
    .replace(/\bZhangjiang Campus\b/gi, "")
    .replace(/\bLingang Campus\b/gi, "")
    .replace(/\bEmail:?/gi, "")
    .replace(/\bContact:?/gi, "")
    .replace(/\bTel:?/gi, "")
    .replace(/\b\d+(?:\.\d+)?\s*(?:years?|year)\b/gi, "")
    .replace(/\b[1-9]\d{3,5}(?:,\d{3})?\b/g, "")
    .replace(/\bRMB\b/gi, "")
    .replace(/\bRMB\s*\/\s*Year\b/gi, "")
    .replace(/\bper\s*year\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseProgramAndTrack(rest: string, extraLines: string[] = []) {
  const text = norm([rest, ...extraLines].join(" "));

  let program_name_cn: string | null = null;
  let program_name_en: string | null = null;
  let track_name_cn: string | null = null;
  let track_name_en: string | null = null;

  const cnMatches = text.match(/[\u4e00-\u9fff]{2,40}/g) || [];
  const enMatches =
    text
      .match(/[A-Za-z][A-Za-z0-9&()\/,\-.\s]{2,180}/g)
      ?.map(cleanEnglishName)
      .filter(Boolean)
      .filter((x) => !/email|contact|duration|tuition|rmb|year|campus/i.test(x)) || [];

  if (cnMatches.length > 0) program_name_cn = cnMatches[0] || null;
  if (cnMatches.length > 1) track_name_cn = cnMatches[1] || null;

  if (enMatches.length > 0) program_name_en = enMatches[0] || null;
  if (enMatches.length > 1) track_name_en = enMatches[1] || null;

  return {
    program_name_cn,
    program_name_en,
    track_name_cn,
    track_name_en,
  };
}

function buildSections(lines: string[]): Section[] {
  const out: Section[] = [];
  let current: Section | null = null;

  for (const line of lines) {
    if (looksLikeSectionStart(line) && !looksLikeMajorStart(line)) {
      if (current) out.push(current);
      current = {
        faculty_code: getFacultyCodeAtLineStart(line),
        lines: [line],
      };
      continue;
    }

    if (!current) {
      current = { faculty_code: null, lines: [line] };
      continue;
    }

    current.lines.push(line);
  }

  if (current) out.push(current);
  return out;
}

function extractSectionContext(section: Section, majorEntries: MajorEntry[]): SectionContext {
  const lines = section.lines.map(norm).filter(Boolean);

  const allMajorLines = majorEntries.flatMap((m) => [m.raw_major_line, ...m.extra_lines]);
  const majorLineSet = new Set(allMajorLines.map((x) => norm(x)));

  const sharedSectionLines = lines.filter((x) => !majorLineSet.has(norm(x)));

  const cnFacultyParts: string[] = [];
  const enFacultyParts: string[] = [];

  for (const line of sharedSectionLines) {
    if (
      looksLikeCnOnly(line) &&
      !isCampusLine(line) &&
      !isContactLine(line) &&
      !isDurationLine(line) &&
      !isTuitionLine(line)
    ) {
      cnFacultyParts.push(line);
      continue;
    }

    if (
      looksLikeEnOnly(line) &&
      !isCampusLine(line) &&
      !isContactLine(line) &&
      !isDurationLine(line) &&
      !isTuitionLine(line)
    ) {
      enFacultyParts.push(line);
    }
  }

  const faculty_cn = cleanupFacultyCn(cnFacultyParts.join(""));
  const faculty_en = cleanupFacultyEn(enFacultyParts);

  const sectionText = sharedSectionLines.join("\n");
  const contact_raw = parseContactsFromText(sectionText);
  const duration_years = parseDurationYearsLoose(sectionText);
  const tuition = parseTuitionLoose(sharedSectionLines);

  return {
    faculty_code: section.faculty_code || null,
    faculty_cn,
    faculty_en,
    contact_raw,
    duration_years,
    tuition_rmb_per_year: tuition.tuition_rmb_per_year,
    tuition_total_rmb: tuition.tuition_total_rmb,
    tuition_is_per_year: tuition.tuition_is_per_year,
    tuition_note: tuition.tuition_note,
  };
}

function extractMajorEntries(section: Section): MajorEntry[] {
  const lines = section.lines.map(norm).filter(Boolean);

  const out: MajorEntry[] = [];
  let current: MajorEntry | null = null;

  for (const line of lines) {
    const sectionPrefix =
      section.faculty_code && line.startsWith(section.faculty_code + " ")
        ? norm(line.replace(new RegExp("^" + escapeRegExp(section.faculty_code) + "\\s+"), ""))
        : null;

    if (sectionPrefix) {
      const m = sectionPrefix.match(/^([0-9A-Z]{5,8})\s+(.+)$/);
      if (m) {
        if (current) out.push(current);
        current = {
          major_code: m[1],
          raw_major_line: line,
          rest: m[2],
          extra_lines: [],
        };
        continue;
      }
    }

    const m = line.match(/^([0-9A-Z]{5,8})\s+(.+)$/);
    if (m) {
      if (current) out.push(current);
      current = {
        major_code: m[1],
        raw_major_line: line,
        rest: m[2],
        extra_lines: [],
      };
      continue;
    }

    if (current) {
      current.extra_lines.push(line);
    }
  }

  if (current) out.push(current);

  return out;
}

function cleanupRows(rows: TablePdfProgramRow[]) {
  const cleanText = (s: any) =>
    String(s ?? "")
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const onlyDigits = (s: any) => /^\d+$/.test(cleanText(s));

  return (rows || [])
    .map((row, i) => {
      const next = { ...(row || {}) };

      if (cleanText(next.program_name_en)) {
        let s = cleanText(next.program_name_en);

        s = s
          .replace(/\b\d+(?:\.\d+)?\s*(?:years?|year)\b/gi, "")
          .replace(/\b[1-9]\d{3,5}(?:,\d{3})?\b/g, "")
          .replace(/\bRMB\b/gi, "")
          .replace(/\bRMB\s*\/\s*Year\b/gi, "")
          .replace(/\bper\s*year\b/gi, "")
          .replace(/\bMinhang Campus\b/gi, "")
          .replace(/\bXuhui Campus\b/gi, "")
          .replace(/\bZhangjiang Campus\b/gi, "")
          .replace(/\bLingang Campus\b/gi, "")
          .replace(/\bEmail[:：]?.*$/i, "")
          .replace(/\bTel[:：]?.*$/i, "")
          .replace(/\s+/g, " ")
          .trim();

        next.program_name_en =
          !s ||
          onlyDigits(s) ||
          /@/.test(s) ||
          /^\+?\d[\d\- ]+$/.test(s) ||
          /RMB|Year|Campus/i.test(s)
            ? null
            : s;
      } else {
        next.program_name_en = null;
      }

      if (cleanText(next.track_name_en)) {
        let s = cleanText(next.track_name_en);

        s = s
          .replace(/\b\d+(?:\.\d+)?\s*(?:years?|year)\b/gi, "")
          .replace(/\b[1-9]\d{3,5}(?:,\d{3})?\b/g, "")
          .replace(/\bRMB\b/gi, "")
          .replace(/\bRMB\s*\/\s*Year\b/gi, "")
          .replace(/\bper\s*year\b/gi, "")
          .replace(/\bEmail[:：]?.*$/i, "")
          .replace(/\bTel[:：]?.*$/i, "")
          .replace(/\s+/g, " ")
          .trim();

        next.track_name_en =
          !s ||
          onlyDigits(s) ||
          /@/.test(s) ||
          /^\+?\d[\d\- ]+$/.test(s) ||
          /RMB|Year|Campus/i.test(s)
            ? null
            : s;
      } else {
        next.track_name_en = null;
      }

      if (cleanText(next.faculty_cn)) {
        const s = cleanText(next.faculty_cn);
        if (s === "-" || s === "—" || s === "院" || /^\d+$/.test(s)) {
          next.faculty_cn = null;
        }
      } else {
        next.faculty_cn = null;
      }

      if (next.tuition_rmb_per_year != null) {
        const n = Number(next.tuition_rmb_per_year);
        if (!Number.isFinite(n) || n < 10000 || n > 300000) {
          next.tuition_rmb_per_year = null;
          next.tuition_is_per_year = null;
          next.tuition_note = null;
        }
      }

      if (
        !cleanText(next.tuition_note) &&
        next.tuition_rmb_per_year != null &&
        Number.isFinite(Number(next.tuition_rmb_per_year))
      ) {
        next.tuition_note = `${Number(next.tuition_rmb_per_year).toLocaleString("en-US")} RMB/Year`;
        next.tuition_is_per_year = true;
      }

      next.idx = i + 1;
      return next;
    })
    .filter((row) => {
      const majorCode = String(row?.major_code || "").trim();
      const faculty = String(row?.faculty_cn || "").trim();
      const cn = String(row?.program_name_cn || "").trim();
      const en = String(row?.program_name_en || "").trim();

      const cnInvalid =
        !cn ||
        cn === majorCode ||
        /^\d+$/.test(cn) ||
        cn === faculty;

      const enInvalid =
        !en ||
        /^\d+$/.test(en) ||
        /(?:email|tel|phone|contact|campus|rmb|year)/i.test(en);

      if (cnInvalid && enInvalid) return false;
      return true;
    });
}

function parseSection(section: Section, rowBaseIdx: number): TablePdfProgramRow[] {
  const majorEntries = extractMajorEntries(section);
  const ctx = extractSectionContext(section, majorEntries);

  const rows: TablePdfProgramRow[] = [];

  for (const item of majorEntries) {
    const names = parseProgramAndTrack(item.rest, item.extra_lines);

    const entryText = [item.rest, ...item.extra_lines].join(" ");
    const entryDuration = parseDurationYearsLoose(entryText);

    const entryTuitionLines = item.extra_lines.filter(
      (x) => isTuitionLine(x) || /^[1-9]\d{3,5}(?:,\d{3})?$/.test(x),
    );
    const entryTuition = parseTuitionLoose(entryTuitionLines);

    const entryContactRaw = parseContactsFromText(item.extra_lines.join("\n"));

    const duration_years =
      entryDuration != null ? entryDuration : ctx.duration_years;

    const tuition_rmb_per_year =
      entryTuition.tuition_rmb_per_year != null
        ? entryTuition.tuition_rmb_per_year
        : ctx.tuition_rmb_per_year;

    const tuition_total_rmb =
      entryTuition.tuition_total_rmb != null
        ? entryTuition.tuition_total_rmb
        : ctx.tuition_total_rmb;

    const tuition_is_per_year =
      entryTuition.tuition_is_per_year != null
        ? entryTuition.tuition_is_per_year
        : ctx.tuition_is_per_year;

    const tuition_note =
      entryTuition.tuition_note ||
      ctx.tuition_note ||
      null;

    const contact_raw = entryContactRaw || ctx.contact_raw || null;

    const cnInvalid =
      !String(names.program_name_cn || "").trim() ||
      String(names.program_name_cn || "").trim() === String(item.major_code || "").trim() ||
      /^\d+$/.test(String(names.program_name_cn || "").trim());

    const enInvalid =
      !String(names.program_name_en || "").trim() ||
      /^\d+$/.test(String(names.program_name_en || "").trim()) ||
      /^(email|tel|phone|contact|campus)$/i.test(String(names.program_name_en || "").trim()) ||
      /rmb|year/i.test(String(names.program_name_en || "").trim());

    if (cnInvalid && enInvalid) continue;

    rows.push({
      idx: rowBaseIdx + rows.length + 1,
      faculty_code: ctx.faculty_code,
      faculty_cn: ctx.faculty_cn,
      faculty_en: ctx.faculty_en,
      major_code: item.major_code || null,
      program_name_cn: names.program_name_cn,
      program_name_en: names.program_name_en,
      track_name_cn: names.track_name_cn,
      track_name_en: names.track_name_en,
      contact_raw,
      duration_years,
      tuition_rmb_per_year,
      tuition_total_rmb,
      tuition_is_per_year,
      tuition_note,
      raw_block: section.lines.filter((x) => !isNoiseLine(x)).join("\n"),
    });
  }

  return rows;
}

export function parseTablePdfProgramCatalog(
  rawText: string,
  opts?: {
    parserName?: string;
    headerDef?: TableHeaderDef;
  },
): TablePdfProgramParseResult {
  const lines = splitLines(rawText);
  const head = lines.slice(0, 100).join(" ");

  if (!hasHeader(lines, opts?.headerDef)) {
    return {
      ok: false,
      rows: [],
      meta: {
        parser: opts?.parserName || "table_pdf_program_catalog_v1",
        title: head.slice(0, 200),
        rows: 0,
        error: "header_not_matched",
      },
    };
  }

  const sections = buildSections(lines);

  let rows: TablePdfProgramRow[] = [];
  for (const section of sections) {
    const part = parseSection(section, rows.length);
    rows.push(...part);
  }

  rows = cleanupRows(rows);

  return {
    ok: rows.length > 0,
    rows,
    meta: {
      parser: opts?.parserName || "table_pdf_program_catalog_v1",
      title: head.slice(0, 200),
      rows: rows.length,
      section_count: sections.length,
    },
  };
}