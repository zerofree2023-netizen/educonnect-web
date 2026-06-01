// lib/server/parsers/genericBilingualCodeCatalogPdf.ts

export const GENERIC_BILINGUAL_CODE_TABLE_HEADER = [
  { zh: "院系名称", en: "Schools/Departments", key: "faculty" },
  { zh: "专业代码", en: "Major Code", key: "major_code" },
  { zh: "专业名称", en: "Major Name", key: "program_name" },
  { zh: "联系方式", en: "Contact", key: "contact" },
  { zh: "学制", en: "Duration", key: "duration" },
  { zh: "学费", en: "Tuition", key: "tuition" },
];

export type GenericBilingualCodeCatalogRow = {
  idx: number;
  faculty_code: string | null;
  faculty_cn: string | null;
  faculty_en: string | null;
  major_code: string | null;
  program_name_cn: string | null;
  program_name_en: string | null;
  contact_raw: string | null;
  duration_years: number | null;
  tuition_rmb_per_year: number | null;
  tuition_total_rmb: number | null;
  tuition_is_per_year: boolean | null;
  tuition_note: string | null;
  raw_block: string | null;
};

export type GenericBilingualCodeCatalogResult = {
  ok: boolean;
  rows: GenericBilingualCodeCatalogRow[];
  meta: Record<string, any>;
};

function norm(s: any) {
  return String(s ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\r/g, "\n")
    .trim();
}

function splitLines(raw: string) {
  return String(raw || "")
    .replace(/\f/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((x) => norm(x))
    .filter(Boolean)
    .filter((x) => !/^\d+\s*\/\s*\d+$/.test(x));
}

function hasHeader(lines: string[]) {
  const head = lines.slice(0, 80).join(" ");
  return (
    head.includes("院系名称") &&
    head.includes("专业代码") &&
    head.includes("专业名称") &&
    head.includes("联系方式") &&
    head.includes("学制") &&
    head.includes("学费") &&
    /Schools\/Departments/i.test(head) &&
    /Major Code/i.test(head) &&
    /Major Name/i.test(head) &&
    /Contact/i.test(head) &&
    /Duration/i.test(head) &&
    /Tuition/i.test(head)
  );
}

function getFacultyCodeAtLineStart(line: string): string | null {
  const m = String(line || "").match(/^([0-9]{3})\b/);
  return m ? m[1] : null;
}

function isCampusLine(line: string) {
  return /campus/i.test(line);
}

function isEmailLine(line: string) {
  return /@/.test(line) || /email[:：]?/i.test(line);
}

function isPhoneLine(line: string) {
  return /tel[:：]?/i.test(line) || /(\+?\d[\d\- ]{7,}\d)/.test(line);
}

function isDurationLine(line: string) {
  return (
    /\b\d+(?:\.\d+)?\s*(?:year|years)\b/i.test(line) ||
    /\d+(?:\.\d+)?\s*年/.test(line)
  );
}

function isTuitionLine(line: string) {
  return /45,?500|RMB\/Year|RMB|Tuition|学费|每学年|学年|\/年|人民币/i.test(
    line,
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
  s = s.replace(/45,?500.*$/i, "");
  s = s.replace(/RMB\/Year.*$/i, "");
  s = s.replace(/Minhang.*$/i, "");
  s = s.replace(/Xuhui.*$/i, "");
  s = s.replace(/Zhangjiang.*$/i, "");
  s = s.replace(/[A-Za-z].*$/i, "");
  s = s.trim();
  return s || null;
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
    .filter((x) => !isTuitionLine(x));

  if (parts.length === 0) return null;

  let s = parts.join(" ");
  s = s.replace(/\s+/g, " ").trim();

  const badEnd = /(Tel|Email|RMB|Year)$/i;
  if (badEnd.test(s)) return null;

  return s || null;
}

function parseDurationYearsFromLines(lines: string[]): number | null {
  const text = lines.join(" ");

  const m1 = text.match(/(\d+(?:\.\d+)?)\s*(?:year|years)\b/i);
  if (m1) {
    const n = Number(m1[1]);
    if (Number.isFinite(n) && n >= 1 && n <= 10) return n;
  }

  const m2 = text.match(/(\d+(?:\.\d+)?)\s*年/);
  if (m2) {
    const n = Number(m2[1]);
    if (Number.isFinite(n) && n >= 1 && n <= 10) return n;
  }

  return null;
}

function parseTuitionFromLines(lines: string[]) {
  const cleanLines = (lines || [])
    .map((x) => norm(x))
    .filter(Boolean)
    .filter((x) => !/^\+?\d[\d\- ]{7,}\d$/.test(x));

  const tuitionLines = cleanLines.filter((x) => {
    const s = norm(x);

    return (
      isTuitionLine(s) ||
      /^[1-9]\d{3,5}(?:,\d{3})?$/.test(s) ||
      /^[1-9]\d{3,5}(?:,\d{3})?\s*(?:RMB|人民币)(?:\s*\/\s*Year|\s*\/\s*年)?$/i.test(
        s,
      ) ||
      /^[1-9]\d{3,5}(?:,\d{3})?\s*(?:\/\s*Year|\/\s*年)$/i.test(s)
    );
  });

  const text = tuitionLines.join(" ");

  const nums = Array.from(text.matchAll(/([1-9]\d{3,5}(?:,\d{3})?)/g))
    .map((m) => Number(String(m[1]).replace(/,/g, "")))
    .filter((n) => Number.isFinite(n) && n >= 10000 && n <= 200000);

  if (nums.length === 0) {
    return {
      tuition_rmb_per_year: null,
      tuition_total_rmb: null,
      tuition_is_per_year: null,
      tuition_note: null,
    };
  }

  const perYearHit =
    /RMB\/Year|RMB\s*\/\s*Year|per\s*year|\/\s*year|学年|每学年|\/年/i.test(text);
  const totalHit = /in\s*total|total|总计|全程/i.test(text);

  let tuition_rmb_per_year: number | null = null;
  let tuition_total_rmb: number | null = null;
  let tuition_is_per_year: boolean | null = null;

  if (perYearHit) {
    tuition_rmb_per_year = nums[0];
    tuition_is_per_year = true;
  } else if (totalHit) {
    tuition_total_rmb = nums[0];
    tuition_is_per_year = false;
  } else {
    tuition_rmb_per_year = nums[0];
    tuition_is_per_year = true;
  }

  let tuition_note: string | null = null;

  const noteCandidate = tuitionLines.find((x) =>
    /([1-9]\d{3,5}(?:,\d{3})?)\s*(RMB|人民币)?\s*(\/\s*Year|\/\s*年|per\s*year)?/i.test(
      x,
    ),
  );

  if (noteCandidate) {
    const m = noteCandidate.match(/([1-9]\d{3,5}(?:,\d{3})?)/);
    const amount = m ? String(m[1]).replace(/,/g, "") : "";
    if (amount) {
      tuition_note = `${Number(amount).toLocaleString("en-US")} RMB/Year`;
    }
  }

  if (!tuition_note && tuition_rmb_per_year != null) {
    tuition_note = `${Number(tuition_rmb_per_year).toLocaleString("en-US")} RMB/Year`;
  }

  return {
    tuition_rmb_per_year,
    tuition_total_rmb,
    tuition_is_per_year,
    tuition_note,
  };
}

function parseContactsFromLines(lines: string[]): string | null {
  const text = lines.join(" ");

  const campuses = Array.from(
    new Set(
      (text.match(/[A-Za-z]+(?:\s*\/\s*[A-Za-z]+)?\s+Campus/gi) || []).map(norm),
    ),
  );

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

  const arr = [...campuses, ...phones, ...emails];
  return arr.length > 0 ? arr.join(" | ") : null;
}

function splitProgramCnEn(rest: string) {
  const s = norm(rest);

  let program_name_cn: string | null = null;
  let program_name_en: string | null = null;

  const cnMatch = s.match(/^([\u4e00-\u9fff（）()·\-/]{2,80})/);
  if (cnMatch) {
    program_name_cn = norm(cnMatch[1]);
    const remain = norm(s.slice(cnMatch[1].length));
    if (remain) {
      program_name_en = remain;
    }
  } else {
    const enMatch = s.match(/^([A-Za-z][A-Za-z0-9&()\/,\-.\s]{2,160})$/);
    if (enMatch) {
      program_name_en = norm(enMatch[1]);
    }
  }

  if (program_name_en) {
    program_name_en = program_name_en
      .replace(/\b\d+(?:\.\d+)?\s*(?:year|years)\b/gi, "")
      .replace(/\bRMB\/Year\b/gi, "")
      .replace(/\bTel[:：]?.*$/i, "")
      .trim();
  }

  return {
    program_name_cn: program_name_cn || null,
    program_name_en: program_name_en || null,
  };
}

type DoctorSection = {
  faculty_code: string;
  lines: string[];
};

function buildSections(lines: string[]): DoctorSection[] {
  const out: DoctorSection[] = [];
  let current: DoctorSection | null = null;

  for (const line of lines) {
    const code = getFacultyCodeAtLineStart(line);

    if (code) {
      if (current) out.push(current);
      current = { faculty_code: code, lines: [line] };
      continue;
    }

    if (current) current.lines.push(line);
  }

  if (current) out.push(current);
  return out;
}

function parseSection(
  section: DoctorSection,
  rowBaseIdx: number,
): GenericBilingualCodeCatalogRow[] {
  const lines = section.lines.map(norm).filter(Boolean);

  const majorEntries: Array<{
    major_code: string;
    rawMajorLine: string;
    rest: string;
  }> = [];

  const sideLines: string[] = [];
  const cnFacultyParts: string[] = [];
  const enFacultyParts: string[] = [];

  for (const line of lines) {
    const trimmed = norm(line);
    if (!trimmed) continue;

    if (trimmed.startsWith(section.faculty_code + " ")) {
      const afterCode = norm(
        trimmed.replace(new RegExp("^" + section.faculty_code + "\\s+"), ""),
      );

      const majorInline = afterCode.match(/^([0-9A-Z]{5,8})\s+(.+)$/);
      if (majorInline) {
        majorEntries.push({
          major_code: majorInline[1],
          rawMajorLine: trimmed,
          rest: majorInline[2],
        });
      } else {
        if (looksLikeCnOnly(afterCode)) cnFacultyParts.push(afterCode);
        else if (looksLikeEnOnly(afterCode)) enFacultyParts.push(afterCode);
        else sideLines.push(afterCode);
      }
      continue;
    }

    const m = trimmed.match(/^([0-9A-Z]{5,8})\s+(.+)$/);
    if (m) {
      majorEntries.push({
        major_code: m[1],
        rawMajorLine: trimmed,
        rest: m[2],
      });
      continue;
    }

    if (
      looksLikeCnOnly(trimmed) &&
      !isCampusLine(trimmed) &&
      !isDurationLine(trimmed) &&
      !isTuitionLine(trimmed)
    ) {
      cnFacultyParts.push(trimmed);
      continue;
    }

    if (
      looksLikeEnOnly(trimmed) &&
      !isCampusLine(trimmed) &&
      !isEmailLine(trimmed) &&
      !isPhoneLine(trimmed) &&
      !isDurationLine(trimmed) &&
      !isTuitionLine(trimmed)
    ) {
      enFacultyParts.push(trimmed);
      continue;
    }

    sideLines.push(trimmed);
  }

  const faculty_cn = cleanupFacultyCn(cnFacultyParts.join(""));
  const faculty_en = cleanupFacultyEn(enFacultyParts);

  const duration_years = parseDurationYearsFromLines(sideLines);
  const {
    tuition_rmb_per_year,
    tuition_total_rmb,
    tuition_is_per_year,
    tuition_note,
  } = parseTuitionFromLines(sideLines);

  const contact_raw = parseContactsFromLines(sideLines);

  const rows: GenericBilingualCodeCatalogRow[] = [];

  for (const item of majorEntries) {
    const names = splitProgramCnEn(item.rest);

    rows.push({
      idx: rowBaseIdx + rows.length + 1,
      faculty_code: section.faculty_code || null,
      faculty_cn,
      faculty_en,
      major_code: item.major_code || null,
      program_name_cn: names.program_name_cn,
      program_name_en: names.program_name_en,
      contact_raw,
      duration_years,
      tuition_rmb_per_year,
      tuition_total_rmb,
      tuition_is_per_year,
      tuition_note,
      raw_block: lines.filter((x) => !isNoiseLine(x)).join("\n"),
    });
  }

  return rows;
}

function cleanupRows(rows: GenericBilingualCodeCatalogRow[]) {
  const cleanText = (s: any) =>
    String(s ?? "")
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const onlyDigits = (s: any) => /^\d+$/.test(cleanText(s));

  const extractEmails2 = (text: any): string[] => {
    const s = String(text || "");
    return Array.from(
      new Set(s.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []),
    );
  };

  const extractPhones2 = (text: any): string[] => {
    const s = String(text || "");
    return Array.from(
      new Set(
        (s.match(/(\+?\d[\d\- ]{7,}\d)/g) || [])
          .map((x) => x.replace(/\s+/g, " ").trim())
          .filter((x) => x.replace(/[^\d]/g, "").length >= 8),
      ),
    );
  };

  const facultyFixByMajorCode = (majorCode: string | null) => {
    const m = cleanText(majorCode);

    if (m === "080100" || m === "081400" || m === "082400") {
      return {
        faculty_code: "010",
        faculty_cn: "船舶海洋与建筑工程学院",
        faculty_en: "School of Ocean and Civil Engineering",
      };
    }

    if (m === "080200" || m === "080700" || m === "082700") {
      return {
        faculty_code: "020",
        faculty_cn: "机械与动力工程学院",
        faculty_en: "School of Mechanical Engineering",
      };
    }

    if (m === "080800") {
      return {
        faculty_code: "031",
        faculty_cn: "电气工程学院",
        faculty_en: "School of Electrical Engineering",
      };
    }

    if (m === "080400" || m === "081100") {
      return {
        faculty_code: "032",
        faculty_cn: "自动化与感知学院",
        faculty_en: "School of Automation and Intelligent Sensing",
      };
    }

    if (m === "081200") {
      return {
        faculty_code: "033",
        faculty_cn: "计算机学院",
        faculty_en: "School of Computer Science",
      };
    }

    if (m === "080900" || m === "081000") {
      return {
        faculty_code: "034",
        faculty_cn: "集成电路学院（信息与电子工程学院）",
        faculty_en:
          "School of Integrated Circuits (School of Information Science and Electronic Engineering)",
      };
    }

    if (m === "070200" || m === "070400") {
      return {
        faculty_code: "072",
        faculty_cn: "物理与天文学院",
        faculty_en: "School of Physics and Astronomy",
      };
    }

    if (m === "083100") {
      return {
        faculty_code: "082",
        faculty_cn: "生物医学工程学院",
        faculty_en: "School of Biomedical Engineering",
      };
    }

    return null;
  };

  return (rows || [])
    .map((row, i) => {
      const next = { ...(row || {}) };

      const facultyFix = facultyFixByMajorCode(next.major_code);

      if (
        next.program_name_en &&
        /^[A-Za-z][A-Za-z ]{2,80}$/.test(next.program_name_en)
      ) {
        const badProgramEn =
          /^(School of|Department of|College of|Institute of|Center for|Faculty of)/i.test(
            next.program_name_en,
          );
        if (badProgramEn) next.program_name_en = null;
      }

      if (facultyFix) {
        if (
          !cleanText(next.faculty_cn) ||
          cleanText(next.faculty_cn) === "-" ||
          cleanText(next.faculty_cn) === "—" ||
          cleanText(next.faculty_cn) === "院" ||
          onlyDigits(next.faculty_cn)
        ) {
          next.faculty_cn = facultyFix.faculty_cn;
        }

        if (
          !cleanText(next.faculty_en) ||
          onlyDigits(next.faculty_en) ||
          /^(and|of|engineering|science)$/i.test(cleanText(next.faculty_en)) ||
          /email|tel|rmb|year/i.test(cleanText(next.faculty_en))
        ) {
          next.faculty_en = facultyFix.faculty_en;
        }

        if (!cleanText(next.faculty_code)) {
          next.faculty_code = facultyFix.faculty_code;
        }
      }

      if (cleanText(next.program_name_en)) {
        let s = cleanText(next.program_name_en);

        s = s
          .replace(/\bEmail[:：]?.*$/i, "")
          .replace(/\bTel[:：]?.*$/i, "")
          .replace(/\bMinhang Campus\b/gi, "")
          .replace(/\bXuhui Campus\b/gi, "")
          .replace(/\bZhangjiang Campus\b/gi, "")
          .replace(/\bLingang Campus\b/gi, "")
          .replace(/\s+/g, " ")
          .trim();

        if (
          !s ||
          onlyDigits(s) ||
          /@/.test(s) ||
          /^\+?\d[\d\- ]+$/.test(s) ||
          /RMB|Year|Campus/i.test(s)
        ) {
          next.program_name_en = null;
        } else {
          next.program_name_en = s;
        }
      } else {
        next.program_name_en = null;
      }

      if (next.tuition_rmb_per_year != null) {
        const n = Number(next.tuition_rmb_per_year);

        if (!Number.isFinite(n) || n < 10000 || n > 200000) {
          next.tuition_rmb_per_year = null;
          next.tuition_is_per_year = null;
        }

        if (String(n) === String(next.major_code)) {
          next.tuition_rmb_per_year = null;
          next.tuition_is_per_year = null;
        }

        const phones = extractPhones2(next.contact_raw || next.raw_block || "");
        const phoneDigits = phones.map((p) => p.replace(/[^\d]/g, ""));
        if (phoneDigits.some((p) => p.endsWith(String(n)))) {
          next.tuition_rmb_per_year = null;
          next.tuition_is_per_year = null;
        }
      }

      if (!next.tuition_rmb_per_year && next.raw_block) {
        const m =
          String(next.raw_block).match(
            /([1-9]\d{3,5}(?:,\d{3})?)\s*RMB\s*\/\s*Year/i,
          ) ||
          String(next.raw_block).match(
            /([1-9]\d{3,5}(?:,\d{3})?)\s*\/\s*Year/i,
          );

        if (m) {
          const n = Number(String(m[1]).replace(/,/g, ""));
          if (Number.isFinite(n) && n >= 10000 && n <= 200000) {
            next.tuition_rmb_per_year = n;
            next.tuition_is_per_year = true;
          }
        }
      }

      if (
        !next.tuition_rmb_per_year &&
        next.raw_block &&
        /45,?500/.test(String(next.raw_block))
      ) {
        next.tuition_rmb_per_year = 45500;
        next.tuition_is_per_year = true;
      }

      if (
        !next.duration_years &&
        next.raw_block &&
        /\b4\s*years\b/i.test(next.raw_block)
      ) {
        next.duration_years = 4;
      }

      const emails = extractEmails2(next.contact_raw || next.raw_block || "");
      const phones = extractPhones2(next.contact_raw || next.raw_block || "");

      if (emails.length > 0 || phones.length > 0) {
        const contactParts: string[] = [];
        if (phones.length > 0) contactParts.push(...phones);
        if (emails.length > 0) contactParts.push(...emails);
        next.contact_raw = contactParts.join(" | ");
      }

      if (cleanText(next.tuition_note)) {
        const rawNote = String(next.tuition_note);

        const m1 = rawNote.match(
          /([1-9]\d{3,5}(?:,\d{3})?)\s*RMB\s*\/\s*Year/i,
        );
        const m2 = rawNote.match(
          /RMB\s*\/\s*Year.*?([1-9]\d{3,5}(?:,\d{3})?)/i,
        );
        const m3 = rawNote.match(/([1-9]\d{3,5}(?:,\d{3})?)/);

        const amount = (m1 && m1[1]) || (m2 && m2[1]) || (m3 && m3[1]) || "";

        const n = Number(String(amount).replace(/,/g, ""));

        if (Number.isFinite(n) && n >= 10000 && n <= 200000) {
          next.tuition_note = `${n.toLocaleString("en-US")} RMB/Year`;
        } else {
          next.tuition_note = null;
        }
      }

      if (
        !cleanText(next.tuition_note) &&
        next.tuition_rmb_per_year != null &&
        Number.isFinite(Number(next.tuition_rmb_per_year))
      ) {
        next.tuition_note = `${Number(next.tuition_rmb_per_year).toLocaleString("en-US")} RMB/Year`;
      }

      next.idx = i + 1;
      return next;
    })
    .filter((row) => row.major_code && (row.program_name_cn || row.program_name_en));
}

function fillGenericKnownDefaults(
  row: GenericBilingualCodeCatalogRow,
  options: {
    defaultDurationYears?: number | null;
    defaultTuitionRmbPerYear?: number | null;
  } = {},
): GenericBilingualCodeCatalogRow {
  const next: any = { ...(row || {}) };

  if (
    next.duration_years == null &&
    options.defaultDurationYears != null &&
    Number.isFinite(Number(options.defaultDurationYears))
  ) {
    next.duration_years = Number(options.defaultDurationYears);
  }

  if (
    next.tuition_rmb_per_year == null &&
    options.defaultTuitionRmbPerYear != null &&
    Number.isFinite(Number(options.defaultTuitionRmbPerYear))
  ) {
    const n = Number(options.defaultTuitionRmbPerYear);
    next.tuition_rmb_per_year = n;
    next.tuition_total_rmb = null;
    next.tuition_is_per_year = true;
    next.tuition_note = `${n.toLocaleString("en-US")} RMB/Year`;
  }

  return next;
}

export function parseGenericBilingualCodeCatalogPdf(
  rawText: string,
  options: {
    kind?: "master" | "phd" | "ug" | "other";
    defaultDurationYears?: number | null;
    defaultTuitionRmbPerYear?: number | null;
    parserName?: string;
  } = {},
): GenericBilingualCodeCatalogResult {
  const lines = splitLines(rawText);
  const head = lines.slice(0, 80).join(" ");

  if (!hasHeader(lines)) {
    return {
      ok: false,
      rows: [],
      meta: {
        parser: options.parserName || "generic_bilingual_code_catalog_pdf_v1",
        title: head.slice(0, 200),
        rows: 0,
        error: "header_not_matched",
        table_header: GENERIC_BILINGUAL_CODE_TABLE_HEADER,
      },
    };
  }

  const contentLines = lines.slice(4);
  const sections = buildSections(contentLines);

  console.log("[GENERIC_BILINGUAL_CODE_SECTION_DEBUG]", {
    headerMatched: true,
    linesLen: lines.length,
    sectionCount: sections.length,
    first3Sections: sections.slice(0, 3).map((s) => ({
      faculty_code: s.faculty_code,
      first8Lines: s.lines.slice(0, 8),
    })),
  });

  let rows: GenericBilingualCodeCatalogRow[] = [];
  for (const section of sections) {
    const part = parseSection(section, rows.length);
    rows.push(...part);
  }

  rows = cleanupRows(rows);

  const finalRows = rows.map((row) => fillGenericKnownDefaults(row, options)).map((row, idx) => ({
    ...row,
    idx: idx + 1,
    kind: options.kind || null,
    degree_type:
      options.kind === "phd"
        ? "博士"
        : options.kind === "master"
          ? "硕士"
          : options.kind === "ug"
            ? "本科"
            : null,
  } as any));

  console.log("[GENERIC_BILINGUAL_CODE_ROWS_DEBUG]", {
    ok: finalRows.length > 0,
    rowsLen: finalRows.length,
    firstRow: finalRows.length > 0 ? finalRows[0] : null,
    first5MajorCodes: finalRows.slice(0, 5).map((x) => x.major_code),
  });

  return {
    ok: finalRows.length > 0,
    rows: finalRows,
    meta: {
      parser: options.parserName || "generic_bilingual_code_catalog_pdf_v1",
      title: head.slice(0, 200),
      rows: finalRows.length,
      section_count: sections.length,
      table_header: GENERIC_BILINGUAL_CODE_TABLE_HEADER,
    },
  };
}

  