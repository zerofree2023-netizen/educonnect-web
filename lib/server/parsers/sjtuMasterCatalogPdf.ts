export const sjtuMasterTableHeader = [
  { zh: "院系名称", en: "Schools/Departments", key: "faculty" },
  { zh: "专业代码", en: "Major Code", key: "major_code" },
  { zh: "专业名称", en: "Major Name", key: "program_name" },
  { zh: "研究方向", en: "Research Fields", key: "research_fields" },
  { zh: "联系方式", en: "Contact", key: "contact" },
  { zh: "学制", en: "Duration", key: "duration" },
  { zh: "学费", en: "Tuition", key: "tuition" },
] as const;

export type SjtuMasterCatalogRow = {
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

export type SjtuMasterCatalogResult = {
  ok: boolean;
  rows: SjtuMasterCatalogRow[];
  meta: Record<string, any>;
};

function norm(s: any) {
  return String(s ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\r/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[ ]+/g, " ")
    .trim();
}

function splitLines(rawText: string) {
  return String(rawText || "")
    .replace(/\f/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((x) => norm(x))
    .filter(Boolean)
    .filter((x) => !/^\d+\s*\/\s*\d+$/.test(x))
    .filter((x) => !/^上海交通大学\s*2026/.test(x))
    .filter((x) => !/^SJTU\s*2026/i.test(x))
    .filter((x) => !/^(院系名称|Schools\/Departments|专业代码|Major Code|专业名称|Major Name|研究方向|Research Fields|联系方式|Contact|学制|Duration|学费|Tuition)$/.test(x));
}

function isFacultyCode(line: string) {
  return /^[0-9]{3}$/.test(line);
}

function isMajorCode(line: string) {
  return /^[0-9A-Z]{5,8}$/.test(line);
}

function startsWithMajorCode(line: string) {
  return /^([0-9A-Z]{5,8})\s+(.+)$/.test(line);
}

function hasChinese(s: any) {
  return /[\u4e00-\u9fff]/.test(String(s || ""));
}

function hasEnglish(s: any) {
  return /[A-Za-z]/.test(String(s || ""));
}

function isCampusLine(s: string) {
  return /\b(?:Minhang|Xuhui|Zhangjiang|Lingang|Hongqiao)\s*(?:\/\s*(?:Minhang|Xuhui|Zhangjiang|Lingang|Hongqiao))?\s*Campus\b/i.test(s) ||
    /Greater Hongqiao Center/i.test(s);
}

function isTelLine(s: string) {
  return /tel[:：]?/i.test(s) || /\+?\d[\d\- ]{7,}\d/.test(s);
}

function isEmailLine(s: string) {
  return /email[:：]?/i.test(s) || /@/.test(s);
}

function isContactLine(s: string) {
  return isCampusLine(s) || isTelLine(s) || isEmailLine(s);
}

function parseDuration(s: string): number | null {
  const m = String(s || "").match(/(\d+(?:\.\d+)?)\s*(?:years?|year|年)\b/i);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n >= 1 && n <= 10 ? n : null;
}

function looksLikeDuration(s: string) {
  return parseDuration(s) != null;
}

function parseMoney(s: string): number | null {
  const m = String(s || "").match(/([1-9]\d{1,3}(?:,\d{3})+|[1-9]\d{4,6})/);
  if (!m) return null;

  const n = Number(String(m[1]).replace(/,/g, ""));
  if (!Number.isFinite(n)) return null;
  if (n < 10000 || n > 1000000) return null;

  // 避免专业代码 080900 / 071000 被当作学费
  if (/^[0-9A-Z]{5,8}$/.test(String(s).trim()) && !String(s).includes(",")) {
    return null;
  }

  return n;
}

function parseTuitionFromPair(line: string, nextLine?: string) {
  const pair = `${line || ""} ${nextLine || ""}`;

  if (!/(RMB|人民币|元|Year|year|学年|每学年|\/年|total|总计|全程)/i.test(pair)) {
    return null;
  }

  const n = parseMoney(pair);
  if (n == null) return null;

  if (/in\s*total|total|总计|全程/i.test(pair)) {
    return {
      tuition_rmb_per_year: null,
      tuition_total_rmb: n,
      tuition_is_per_year: false,
      tuition_note: `${n.toLocaleString("en-US")} RMB Total`,
    };
  }

  if (/RMB\s*\/\s*Year|\/\s*Year|\/\s*year|per\s*year|\/年|学年|每学年/i.test(pair)) {
    return {
      tuition_rmb_per_year: n,
      tuition_total_rmb: null,
      tuition_is_per_year: true,
      tuition_note: `${n.toLocaleString("en-US")} RMB/Year`,
    };
  }

  return null;
}

function cleanFacultyCn(parts: string[]) {
  const s = parts
    .join("")
    .replace(/\s+/g, "")
    .replace(/^院系名称/, "")
    .trim();

  if (!s || s === "-" || s === "院") return null;
  if (!/(学院|系|研究院|研究所|中心|书院|学部|法学院|医学院|药学院)$/.test(s)) {
    return s || null;
  }

  return s;
}

function cleanEnglish(s: string) {
  return norm(s)
    .replace(/\b(?:Minhang|Xuhui|Zhangjiang|Lingang|Hongqiao)\s+Campus\b/gi, "")
    .replace(/\bGreater Hongqiao Center\b/gi, "")
    .replace(/\bTel[:：]?/gi, "")
    .replace(/\bEmail[:：]?/gi, "")
    .replace(/\b\d+(?:\.\d+)?\s*(?:years?|year)\b/gi, "")
    .replace(/\b[1-9]\d{1,3}(?:,\d{3})+\b/g, "")
    .replace(/\bRMB\b/gi, "")
    .replace(/\bYear\b/gi, "")
    .replace(/\bin total\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function takeCnEnName(lines: string[], start: number) {
  let cn = "";
  let en = "";
  let used = 0;

  const first = lines[start] || "";

  const inline = first.match(/^([0-9A-Z]{5,8})\s+(.+)$/);
  const afterCode = inline ? inline[2] : first;

  if (hasChinese(afterCode)) {
    cn = afterCode.replace(/[A-Za-z].*$/, "").trim();
    const enInline = cleanEnglish(afterCode.replace(cn, ""));
    if (enInline && hasEnglish(enInline)) en = enInline;
  } else if (afterCode) {
    en = cleanEnglish(afterCode);
  }

  used = 1;

  for (let i = start + 1; i < Math.min(lines.length, start + 6); i++) {
    const l = lines[i];

    if (isFacultyCode(l) || isMajorCode(l) || startsWithMajorCode(l)) break;
    if (isContactLine(l) || looksLikeDuration(l)) break;

    const maybeTuition = parseTuitionFromPair(l, lines[i + 1]);
    if (maybeTuition) break;

    if (!cn && hasChinese(l)) {
      cn = l.trim();
      used = i - start + 1;
      continue;
    }

    if (hasEnglish(l)) {
      const cleaned = cleanEnglish(l);
      if (cleaned) {
        en = en ? `${en} ${cleaned}` : cleaned;
        used = i - start + 1;
      }
      continue;
    }

    if (hasChinese(l) && cn) break;
  }

  return {
    cn: cn || null,
    en: en || null,
    used,
  };
}

function extractContact(lines: string[]) {
  const arr: string[] = [];

  for (const l of lines) {
    if (isContactLine(l)) arr.push(l);
  }

  const text = arr.join(" ");
  const emails = Array.from(
    new Set(text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [])
  );

  const phones = Array.from(
    new Set(
      (text.match(/(\+?\d[\d\- ]{7,}\d)/g) || [])
        .map((x) => x.replace(/\s+/g, " ").trim())
        .filter((x) => x.replace(/[^\d]/g, "").length >= 8)
    )
  );

  const campuses = Array.from(
    new Set(
      (text.match(/\b(?:Minhang|Xuhui|Zhangjiang|Lingang|Hongqiao)\s+Campus\b/gi) || [])
        .map((x) => norm(x))
    )
  );

  const all = [...campuses, ...phones, ...emails];
  return all.length ? all.join(" | ") : null;
}

function extractFacultyEn(lines: string[]) {
  const arr: string[] = [];

  for (const l of lines) {
    if (!hasEnglish(l)) continue;
    if (hasChinese(l)) continue;
    if (isContactLine(l)) continue;
    if (looksLikeDuration(l)) continue;
    if (parseTuitionFromPair(l)) continue;
    if (/^(School|College|Department|Institute|Center|Faculty)\b/i.test(l)) {
      arr.push(l);
      continue;
    }
    if (arr.length > 0) arr.push(l);
  }

  const s = cleanEnglish(arr.join(" "));
  return s || null;
}

function looksLikeTrackLine(line: string) {
  const s = norm(line);
  if (!s) return false;
  if (isFacultyCode(s) || isMajorCode(s) || startsWithMajorCode(s)) return false;
  if (isContactLine(s) || looksLikeDuration(s)) return false;
  if (parseTuitionFromPair(s)) return false;
  if (/^(School|College|Department|Institute|Center)\b/i.test(s)) return false;
  if (/^(RMB\/Year|RMB|Year)$/i.test(s)) return false;
  return hasChinese(s) || hasEnglish(s);
}

function parseTrack(lines: string[], start: number) {
  let cn: string | null = null;
  let en: string | null = null;

  for (let i = start; i < Math.min(lines.length, start + 8); i++) {
    const l = lines[i];
    if (!looksLikeTrackLine(l)) break;

    if (!cn && hasChinese(l)) {
      const onlyCn = l.replace(/[A-Za-z].*$/, "").trim();
      if (onlyCn) cn = onlyCn;
    }

    if (!en && hasEnglish(l)) {
      const onlyEn = cleanEnglish(l.replace(/^[\u4e00-\u9fff\s、，；;：:（）()]+/, ""));
      if (onlyEn) en = onlyEn;
    }

    if (cn || en) break;
  }

  return { cn, en };
}

function fixSjtuMasterRows(rows: SjtuMasterCatalogRow[]) {
  const facultyByMajorPrefix: Record<string, string> = {
    "0801": "船舶海洋与建筑工程学院",
    "0814": "船舶海洋与建筑工程学院",
    "0823": "船舶海洋与建筑工程学院",
    "0824": "船舶海洋与建筑工程学院",

    "0802": "机械与动力工程学院",
    "0807": "机械与动力工程学院",
    "0827": "机械与动力工程学院",

    "0808": "电气工程学院",

    "0804": "自动化与感知学院",
    "0811": "自动化与感知学院",

    "0812": "计算机学院",
    "0839": "计算机学院",

    "0809": "信息与电子工程学院",
    "0810": "信息与电子工程学院",

    "0805": "材料科学与工程学院",

    "0701": "数学科学学院",
    "0252": "数学科学学院",

    "0702": "物理与天文学院",

    "0710": "生命科学技术学院",
    "0836": "生命科学技术学院",

    "0831": "生物医学工程学院",

    "0101": "人文学院",
    "0501": "人文学院",
    "0602": "人文学院",
    "0453": "人文学院",

    "0703": "化学化工学院",
    "0817": "化学化工学院",
    "0856": "化学化工学院",

    "0202": "安泰经济与管理学院",
    "0251": "安泰经济与管理学院",
    "1201": "安泰经济与管理学院",
    "1202": "安泰经济与管理学院",
    "1253": "安泰经济与管理学院",
    "1251": "安泰经济与管理学院",
    "1258": "安泰经济与管理学院",

    "0302": "国际与公共事务学院",
    "1204": "国际与公共事务学院",

    "0830": "环境科学与工程学院",
    "0857": "环境科学与工程学院",

    "1007": "药学院",
    "0301": "凯原法学院",

    "0552": "媒体与传播学院",
    "1354": "媒体与传播学院",

    "010108": "马克思主义学院",
    "0712": "马克思主义学院",

    "0403": "体育系",
    "0401": "教育学院",
    "125604": "中美物流研究院",

    "071000": "系统生物医学研究院",
    "0813": "设计学院",
    "1403": "设计学院",
    "0707": "海洋学院",
  };

  function isEmpty(v: any) {
    return (
      v === null ||
      v === undefined ||
      String(v).trim() === "" ||
      String(v).trim() === "-"
    );
  }

  function facultyForMajorCode(code: any) {
    const c = String(code || "").trim();
    if (!c) return null;

    if (facultyByMajorPrefix[c]) return facultyByMajorPrefix[c];

    for (const len of [5, 4]) {
      const prefix = c.slice(0, len);
      if (facultyByMajorPrefix[prefix]) return facultyByMajorPrefix[prefix];
    }

    return null;
  }

  function looksLikeMajorCodeValue(n: any, majorCode: any) {
    const num = Number(n);
    const code = String(majorCode || "").replace(/\D/g, "");
    if (!Number.isFinite(num) || !code) return false;

    const compact = String(Math.round(num));
    if (compact === code) return true;

    // 080800 经常被转成 80800
    if (compact === String(Number(code))) return true;

    return false;
  }

  function looksSuspiciousTuition(n: any, majorCode: any) {
    const num = Number(n);
    if (!Number.isFinite(num)) return false;

    if (looksLikeMajorCodeValue(num, majorCode)) return true;

    // 上海交大这份硕士目录的常见学费不是这些专业代码型数字
    const suspicious = new Set([
      20200, 30100, 30200, 45300, 50100, 70200, 70700, 80800,
      83100, 120100, 120200, 125100, 135400,
    ]);

    return suspicious.has(num);
  }

  return rows.map((row) => {
    const next: any = { ...(row || {}) };

    if (isEmpty(next.faculty_cn)) {
      const f = facultyForMajorCode(next.major_code);
      if (f) next.faculty_cn = f;
    }

    if (
      next.tuition_rmb_per_year != null &&
      looksSuspiciousTuition(next.tuition_rmb_per_year, next.major_code)
    ) {
      next.tuition_rmb_per_year = null;
      next.tuition_is_per_year = null;
      next.tuition_note = null;
    }

    if (
      next.tuition_total_rmb != null &&
      looksSuspiciousTuition(next.tuition_total_rmb, next.major_code)
    ) {
      next.tuition_total_rmb = null;
      next.tuition_is_per_year = null;
      next.tuition_note = null;
    }

    if (
      next.tuition_rmb_per_year != null &&
      !String(next.tuition_note || "").trim()
    ) {
      next.tuition_note = `${Number(next.tuition_rmb_per_year).toLocaleString("en-US")} RMB/Year`;
      next.tuition_is_per_year = true;
    }

    if (
      next.tuition_total_rmb != null &&
      !String(next.tuition_note || "").trim()
    ) {
      next.tuition_note = `${Number(next.tuition_total_rmb).toLocaleString("en-US")} RMB Total`;
      next.tuition_is_per_year = false;
    }

    return next;
  });
}

function fillSjtuMasterTuitionByFaculty(
  rows: SjtuMasterCatalogRow[],
): SjtuMasterCatalogRow[] {
  let lastTuitionRow: SjtuMasterCatalogRow | null = null;

  return rows.map((row) => {
    const next: any = { ...(row || {}) };

    const hasTuition =
      next.tuition_rmb_per_year != null ||
      next.tuition_total_rmb != null ||
      String(next.tuition_note || "").trim();

    const faculty = String(next.faculty_cn || "").trim();
    const lastFaculty = String(lastTuitionRow?.faculty_cn || "").trim();

    if (hasTuition) {
      lastTuitionRow = next;
      return next;
    }

    if (lastTuitionRow && faculty && lastFaculty && faculty === lastFaculty) {
      if (
        next.tuition_rmb_per_year == null &&
        lastTuitionRow.tuition_rmb_per_year != null
      ) {
        next.tuition_rmb_per_year = lastTuitionRow.tuition_rmb_per_year;
        next.tuition_total_rmb = null;
        next.tuition_is_per_year = true;
      }

      if (
        next.tuition_total_rmb == null &&
        lastTuitionRow.tuition_total_rmb != null
      ) {
        next.tuition_total_rmb = lastTuitionRow.tuition_total_rmb;
        next.tuition_rmb_per_year = null;
        next.tuition_is_per_year = false;
      }

      if (!String(next.tuition_note || "").trim()) {
        next.tuition_note = lastTuitionRow.tuition_note || null;
      }

      if (
        next.duration_years == null &&
        lastTuitionRow.duration_years != null
      ) {
        next.duration_years = lastTuitionRow.duration_years;
      }
    }

    return next;
  });
}

function fillSjtuMasterKnownTuition(row: SjtuMasterCatalogRow): SjtuMasterCatalogRow {
const next: any = { ...(row || {}) };
  const code = String(next.major_code || "").trim();
  const text = [
    next.program_name_cn,
    next.program_name_en,
    next.track_name_cn,
    next.track_name_en,
    next.raw_block,
  ].filter(Boolean).join(" ");

  // 先补专业名：必须放在 hasTuition return 前面
  const knownNames: Record<string, { cn: string; en: string }> = {
    "080400": { cn: "仪器科学与技术", en: "Instrument Science and Technology" },
    "081200": { cn: "计算机科学与技术", en: "Computer Science and Technology" },
    "080900": { cn: "电子科学与技术", en: "Electronic Science and Technology" },
    "120400": { cn: "公共管理学", en: "Public Administration" },
    "085700": { cn: "资源与环境", en: "Resources and Environment" },
    "055200": { cn: "新闻与传播", en: "Journalism and Communication" },
    "135400": { cn: "戏剧与影视", en: "Drama and Film Studies" },
    "071200": { cn: "科学技术史", en: "History of Science and Technology" },
  };

  const known = knownNames[code];
  if (known) {
    const cn = String(next.program_name_cn || "").trim();
    const en = String(next.program_name_en || "").trim();

    const cnBad = !cn || cn === "-";
    const enBad =
      !en ||
      en === "-" ||
      en === "Computer" ||
      /^(Public Public Affairs|Resources and|Journalism and|Drama and Film|Science and 器)/i.test(en);

    if (cnBad) next.program_name_cn = known.cn;
    if (enBad) next.program_name_en = known.en;
  }

  const hasTuition =
    next.tuition_rmb_per_year != null ||
    next.tuition_total_rmb != null;

  if (hasTuition) return next;

  let perYear: number | null = 28900;
  let total: number | null = null;

  if (code === "025200") perYear = 110000;
  if (code === "045300") perYear = 38900;
  if (code === "025100") perYear = 94000;
  if (code === "125300") perYear = 79000;
  if (code === "055200") perYear = 72000;
  if (code === "135400") perYear = 60000;

  if (code === "1258S1") {
    perYear = null;
    total = 378000;
  }

  if (code === "125100") {
    perYear = null;

    if (/非全日制|Part-time/i.test(text)) {
      total = 518000;
    } else if (/CLGO|全日制|Full-time/i.test(text)) {
      total = 368000;
    } else if (/EMBA/i.test(text)) {
      total = 828000;
    } else {
      total = 368000;
    }
  }

  if (perYear != null) {
    next.tuition_rmb_per_year = perYear;
    next.tuition_total_rmb = null;
    next.tuition_is_per_year = true;
    next.tuition_note = `${perYear.toLocaleString("en-US")} RMB/Year`;
  }

  if (total != null) {
    next.tuition_rmb_per_year = null;
    next.tuition_total_rmb = total;
    next.tuition_is_per_year = false;
    next.tuition_note = `${total.toLocaleString("en-US")} RMB Total`;
  }

  // 重要：学费总计不从 PDF 抓取。
  // 系统应根据 tuition_rmb_per_year * duration_years 自动计算总额。
  // 避免 085400 / 125100 这类专业代码被误写进 tuition_total_rmb。
  next.tuition_total_rmb = null;

  // MBA / 技术转移硕士在 PDF 中是 total price。
  // 这里为了统一系统计算逻辑，折算成年费。
  if (next.tuition_rmb_per_year == null) {
    const text = [
      next.program_name_cn,
      next.program_name_en,
      next.track_name_cn,
      next.track_name_en,
      next.raw_block,
    ].filter(Boolean).join(" ");

    if (code === "1258S1") {
      next.tuition_rmb_per_year = 189000;
      next.duration_years = next.duration_years || 2;
      next.tuition_note = "378,000 RMB Total; calculated as 189,000 RMB/Year";
      next.tuition_is_per_year = true;
    } else if (code === "125100") {
      if (/非全日制|Part-time/i.test(text)) {
        next.tuition_rmb_per_year = 207200;
        next.duration_years = next.duration_years || 2.5;
        next.tuition_note = "518,000 RMB Total; calculated as 207,200 RMB/Year";
      } else {
        next.tuition_rmb_per_year = 147200;
        next.duration_years = next.duration_years || 2.5;
        next.tuition_note = "368,000 RMB Total; calculated as 147,200 RMB/Year";
      }
      next.tuition_is_per_year = true;
    }
  }

  if (next.tuition_rmb_per_year != null) {
    next.tuition_is_per_year = true;
    next.tuition_note =
      next.tuition_note ||
      `${Number(next.tuition_rmb_per_year).toLocaleString("en-US")} RMB/Year`;
  }

  // 最终兜底：125100 非全日制 MBA
  if (
    code === "125100" &&
    (next.tuition_rmb_per_year == null ||
      String(next.tuition_rmb_per_year).trim() === "" ||
      String(next.tuition_rmb_per_year).trim() === "-")
  ) {
    const text = [
      next.program_name_cn,
      next.program_name_en,
      next.track_name_cn,
      next.track_name_en,
      next.raw_block,
      next.contact_raw,
    ].filter(Boolean).join(" ");

    if (/非全日制|Part-time/i.test(text)) {
      next.tuition_total_rmb = null;
      next.tuition_rmb_per_year = 207200;
      next.duration_years = next.duration_years || 2.5;
      next.tuition_is_per_year = true;
      next.tuition_note = "518,000 RMB Total; calculated as 207,200 RMB/Year";
    }
  }

  return next;
}

export function parseSjtuMasterCatalogPdf(rawText: string): SjtuMasterCatalogResult {
  const lines = splitLines(rawText);

  const rows: SjtuMasterCatalogRow[] = [];

  let faculty_code: string | null = null;
  let faculty_cn: string | null = null;
  let faculty_en: string | null = null;
  let contact_raw: string | null = null;
  let duration_years: number | null = null;
  let tuition_rmb_per_year: number | null = null;
  let tuition_total_rmb: number | null = null;
  let tuition_is_per_year: boolean | null = null;
  let tuition_note: string | null = null;

  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (isFacultyCode(line)) {
      faculty_code = line;

      const facultyBlock: string[] = [];
      let j = i + 1;

      while (j < lines.length) {
        const l = lines[j];
        if (isFacultyCode(l) || isMajorCode(l) || startsWithMajorCode(l)) break;
        if (isContactLine(l) || looksLikeDuration(l) || parseTuitionFromPair(l, lines[j + 1])) break;

        facultyBlock.push(l);
        j++;
      }

      const cnParts = facultyBlock.filter((x) => hasChinese(x));
      faculty_cn = cleanFacultyCn(cnParts);
      faculty_en = extractFacultyEn(facultyBlock);

      contact_raw = null;
      duration_years = null;
      tuition_rmb_per_year = null;
      tuition_total_rmb = null;
      tuition_is_per_year = null;
      tuition_note = null;

      i = j;
      continue;
    }

    let major_code: string | null = null;
    let nameStart = i;

    if (isMajorCode(line)) {
      major_code = line;
      nameStart = i + 1;
    } else {
      const m = line.match(/^([0-9A-Z]{5,8})\s+(.+)$/);
      if (m) {
        major_code = m[1];
        nameStart = i;
      }
    }

    if (major_code) {
      const name = takeCnEnName(lines, nameStart);
      const afterName = nameStart + Math.max(name.used, 1);
      const track = parseTrack(lines, afterName);

      const block: string[] = [];
      let j = i;

      while (j < lines.length) {
        const l = lines[j];

        if (j > i && (isFacultyCode(l) || isMajorCode(l) || startsWithMajorCode(l))) {
          break;
        }

        block.push(l);

        const d = parseDuration(l);
        if (d != null) duration_years = d;

        const t = parseTuitionFromPair(l, lines[j + 1]);
        if (t) {
          tuition_rmb_per_year = t.tuition_rmb_per_year;
          tuition_total_rmb = t.tuition_total_rmb;
          tuition_is_per_year = t.tuition_is_per_year;
          tuition_note = t.tuition_note;
        }

        const c = extractContact([l]);
        if (c) {
          contact_raw = extractContact(block) || contact_raw;
        }

        j++;
      }

      const fullContact = extractContact(block);
      if (fullContact) contact_raw = fullContact;

      rows.push({
        idx: rows.length + 1,
        faculty_code,
        faculty_cn,
        faculty_en,
        major_code,
        program_name_cn: name.cn,
        program_name_en: name.en,
        track_name_cn: track.cn,
        track_name_en: track.en,
        contact_raw,
        duration_years,
        tuition_rmb_per_year,
        tuition_total_rmb,
        tuition_is_per_year,
        tuition_note,
        raw_block: block.join("\n"),
      });

      i = j;
      continue;
    }

    const d = parseDuration(line);
    if (d != null) duration_years = d;

    const t = parseTuitionFromPair(line, lines[i + 1]);
    if (t) {
      tuition_rmb_per_year = t.tuition_rmb_per_year;
      tuition_total_rmb = t.tuition_total_rmb;
      tuition_is_per_year = t.tuition_is_per_year;
      tuition_note = t.tuition_note;
    }

    i++;
  }

  const cleaned = fillSjtuMasterTuitionByFaculty(
  fixSjtuMasterRows(rows)
    .filter((r) => {
      const cn = String(r.program_name_cn || "").trim();
      const en = String(r.program_name_en || "").trim();
      if (!r.major_code) return false;
      if (!cn && !en) return false;
      if (/^(Email|Tel|Contact|RMB|Year)$/i.test(en)) return false;
      return true;
    })
    .map((r, idx) => ({
      ...r,
      idx: idx + 1,
    })),
);

return {
  ok: cleaned.length > 0,
  rows: cleaned.map(fillSjtuMasterKnownTuition).map((row) => {
  
  const next: any = { ...(row || {}) };
        const code = String(next.major_code || "").trim();
        const noTuition =
          next.tuition_rmb_per_year == null ||
          String(next.tuition_rmb_per_year).trim() === "" ||
          String(next.tuition_rmb_per_year).trim() === "-";

        if (code === "125100" && noTuition) {
          const text = [
            next.program_name_cn,
            next.program_name_en,
            next.track_name_cn,
            next.track_name_en,
            next.raw_block,
            next.contact_raw,
          ]
            .filter(Boolean)
            .join(" ");

          if (/非全日制|Part-time/i.test(text)) {
            next.tuition_total_rmb = null;
            next.tuition_rmb_per_year = 207200;
            next.duration_years = next.duration_years || 2.5;
            next.tuition_is_per_year = true;
            next.tuition_note =
              "518,000 RMB Total; calculated as 207,200 RMB/Year";
          } else {
            next.tuition_total_rmb = null;
            next.tuition_rmb_per_year = 147200;
            next.duration_years = next.duration_years || 2.5;
            next.tuition_is_per_year = true;
            next.tuition_note =
              "368,000 RMB Total; calculated as 147,200 RMB/Year";
          }
        }

        return next;
      }),
    meta: {
      parser: "sjtu_master_catalog_special_v2",
      rows: cleaned.length,
      table_header: sjtuMasterTableHeader,
    },
  };
}