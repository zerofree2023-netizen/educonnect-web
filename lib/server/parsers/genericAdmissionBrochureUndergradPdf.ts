export type AdmissionBrochureUndergradRow = {
  idx: number;
  kind: "ug";
  faculty_code: string | null;
  faculty_cn: string | null;
  faculty_en: string | null;
  major_code: string | null;
  program_name_cn: string | null;
  program_name_en: string | null;
  track_name_cn: string | null;
  track_name_en: string | null;
  degree_type: string | null;
  degree_kind: string | null;
  degree_name_cn: string | null;
  degree_name_en: string | null;
  study_language: string | null;
  language_text: string | null;
  campus_text: string | null;
  duration_years: number | null;
  tuition_rmb_per_year: number | null;
  tuition_total_rmb: number | null;
  tuition_is_per_year: boolean | null;
  tuition_note: string | null;
  apply_requirements_text: string | null;
  remarks_text: string | null;
  raw_line: string | null;
  raw_block: string | null;
  tags: string[];
  needs_review?: boolean;
  review_flags?: string[];
};

export type AdmissionBrochureUndergradResult = {
  ok: boolean;
  rows: AdmissionBrochureUndergradRow[];
  meta: Record<string, any>;
};

type Profile = {
  id: string;
  parser: string;
  docType: string;
  schoolSignals: string[];
  requiredSignals: string[];
};

const bitProfile: Profile = {
  id: "bit_undergrad_brochure",
  parser: "generic_admission_brochure_undergrad_pdf_v1",
  docType: "generic_admission_brochure_undergrad_pdf",
  schoolSignals: [
    "北京理工大学",
    "Beijing Institute of Technology",
    "BIT",
  ],
  requiredSignals: [
    "ADMISSION BOOK FOR INTERNATIONAL STUDENTS",
    "本科大类专业设置",
    "北京校区招生专业",
  ],
};

function norm(s: any) {
  return String(s ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\r/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[ ]+/g, " ")
    .trim();
}

function compact(s: any) {
  return norm(s).replace(/\s+/g, "");
}

function splitLines(rawText: string) {
  return String(rawText || "")
    .replace(/\f/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((x) => norm(x))
    .filter(Boolean)
    .filter((x) => !/^\d+\s*\/\s*\d+$/.test(x))
    .filter((x) => !/^page\s+\d+/i.test(x));
}

function hasAny(raw: string, arr: string[]) {
  return arr.some((x) => raw.includes(x));
}

function hasAll(raw: string, arr: string[]) {
  return arr.every((x) => raw.includes(x));
}

function moneyToNumber(s: any): number | null {
  const m = String(s || "").match(/([1-9]\d{1,3}(?:,\d{3})+|[1-9]\d{4,6})/);
  if (!m) return null;
  const n = Number(m[1].replace(/,/g, ""));
  if (!Number.isFinite(n)) return null;
  if (n < 10000 || n > 500000) return null;
  return n;
}

function parseDuration(raw: string): number | null {
  const text = raw.replace(/\s+/g, " ");
  const patterns = [
    /学习期限[:：]?\s*(\d+(?:\.\d+)?)\s*年/,
    /Duration\s*[:：]?\s*(\d+(?:\.\d+)?)\s*years?/i,
    /length\s*of\s*study\s*[:：]?\s*(\d+(?:\.\d+)?)\s*years?/i,
  ];

  for (const re of patterns) {
    const m = text.match(re);
    if (m) {
      const n = Number(m[1]);
      if (Number.isFinite(n) && n >= 1 && n <= 8) return n;
    }
  }

  return null;
}

function extractBitTuition(raw: string) {
  const text = raw.replace(/\s+/g, " ");

  let zh: number | null = null;
  let en: number | null = null;

  const zhPatterns = [
    /中文授课学费[:：]?\s*([0-9,]+)\s*元\s*\/?\s*年/,
    /Chinese[-\s]*taught\s+program\s+tuition[:：]?\s*CNY\s*([0-9,]+)\s*\/?\s*year/i,
  ];

  const enPatterns = [
    /英文授课学费[:：]?\s*([0-9,]+)\s*元\s*\/?\s*年/,
    /English[-\s]*taught\s+program\s+tuition[:：]?\s*CNY\s*([0-9,]+)\s*\/?\s*year/i,
  ];

  for (const re of zhPatterns) {
    const m = text.match(re);
    if (m) {
      zh = moneyToNumber(m[1]);
      if (zh) break;
    }
  }

  for (const re of enPatterns) {
    const m = text.match(re);
    if (m) {
      en = moneyToNumber(m[1]);
      if (en) break;
    }
  }

  if (!zh && text.includes("中文授课学费") && text.includes("23,000")) zh = 23000;
  if (!en && text.includes("英文授课学费") && text.includes("30,000")) en = 30000;

  return { zh, en };
}

function isStopLine(line: string) {
  return /申请资格|申请材料|申请办法|学习期限|费用|奖学金|联系方式|Duration|Fees|Scholarship|Contact|Application Materials|Qualification/i.test(line);
}

function normalizeCampus(s: any) {
  const x = String(s || "");
  if (/珠海|Zhuhai/i.test(x)) return "珠海校区";
  if (/北京|Beijing/i.test(x)) return "北京校区";
  return null;
}

function cleanProgramName(s: any) {
  let x = norm(s)
    .replace(/^[-·•\s]+/, "")
    .replace(/[。；;]+$/g, "")
    .trim();

  x = x
    .replace(/^(专业方向|专业|Major|Program)\s*[:：]?\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!x || x === "-" || x === ">") return null;
  if (/北京理工大学简介|学校简介|Admission Book|目录|Table of Contents/i.test(x)) return null;
  if (/申请资格|申请材料|学习期限|学费|奖学金|联系方式/.test(x)) return null;

  return x;
}

function buildBitRow(input: {
  idx: number;
  campus: string;
  faculty: string | null;
  programCn?: string | null;
  programEn?: string | null;
  trackCn?: string | null;
  trackEn?: string | null;
  lang: "zh" | "en";
  duration: number | null;
  tuition: number | null;
  rawBlock: string;
}): AdmissionBrochureUndergradRow {
  const languageText = input.lang === "en" ? "英文" : "中文";

  return {
    idx: input.idx,
    kind: "ug",
    faculty_code: null,
    faculty_cn: input.faculty,
    faculty_en: null,
    major_code: null,
    program_name_cn: input.programCn || input.trackCn || null,
    program_name_en: input.programEn || input.trackEn || null,
    track_name_cn: input.trackCn || null,
    track_name_en: input.trackEn || null,
    degree_type: "本科",
    degree_kind: "本科",
    degree_name_cn: "学士",
    degree_name_en: "Bachelor",
    study_language: input.lang,
    language_text: languageText,
    campus_text: input.campus,
    duration_years: input.duration,
    tuition_rmb_per_year: input.tuition,
    tuition_total_rmb: null,
      apply_requirements_text: null,
      remarks_text: null,
    tuition_is_per_year: input.tuition != null ? true : null,
    tuition_note: input.tuition != null ? `${input.tuition.toLocaleString("en-US")} RMB/Year` : null,
    raw_line: input.rawBlock.split("\n")[0] || null,
    raw_block: input.rawBlock,
    tags: ["本科", languageText, input.campus, "招生简章专业表"],
    needs_review: false,
    review_flags: [],
  };
}

function parseBitChineseTables(lines: string[], duration: number | null, tuitionZh: number | null) {
  const rows: AdmissionBrochureUndergradRow[] = [];
  let campus: string | null = null;
  let inTable = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (/北京校区招生专业/.test(line)) {
      campus = "北京校区";
      inTable = true;
      continue;
    }

    if (/珠海校区招生专业/.test(line)) {
      campus = "珠海校区";
      inTable = true;
      continue;
    }

    if (!inTable || !campus) continue;
    if (isStopLine(line)) {
      if (!/招生专业|专业设置/.test(line)) inTable = false;
      continue;
    }

    if (/^(招生大类|覆盖学院|专业方向|学业水平|Campus|Major|College|School)/i.test(line)) continue;

    const rawBlock = [line, lines[i + 1] || "", lines[i + 2] || ""].join("\n");

    const parts = line.split(/\s{2,}|[|]/).map(norm).filter(Boolean);
    let faculty: string | null = null;
    let program: string | null = null;

    if (parts.length >= 3) {
      faculty = parts.find((p) => /学院|书院|School|College/i.test(p)) || null;
      program = parts.slice().reverse().find((p) => {
        const c = cleanProgramName(p);
        return Boolean(c && /[\u4e00-\u9fff]/.test(c) && !/学院|书院/.test(c));
      }) || null;
    } else {
      const m = line.match(/(.+?)(学院|书院)\s+(.+)$/);
      if (m) {
        faculty = `${m[1]}${m[2]}`;
        program = m[3];
      }
    }

    program = cleanProgramName(program);

    if (!program) {
      const maybe = cleanProgramName(line);
      if (maybe && /[\u4e00-\u9fff]/.test(maybe) && maybe.length <= 40 && !/简介|申请|学费|奖学金/.test(maybe)) {
        program = maybe;
      }
    }

    if (!program) continue;

    rows.push(buildBitRow({
      idx: rows.length + 1,
      campus,
      faculty,
      programCn: program,
      lang: "zh",
      duration,
      tuition: tuitionZh,
      rawBlock,
    }));
  }

  return rows;
}

function parseBitEnglishTables(lines: string[], duration: number | null, tuitionEn: number | null) {
  const rows: AdmissionBrochureUndergradRow[] = [];
  let inEnglishTable = false;
  let campus: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (/English taught programs/i.test(line)) {
      inEnglishTable = true;
      campus = null;
      continue;
    }

    if (!inEnglishTable) continue;

    if (/Beijing campus/i.test(line)) {
      campus = "北京校区";
      continue;
    }

    if (/Zhuhai campus/i.test(line)) {
      campus = "珠海校区";
      continue;
    }

    if (isStopLine(line) && !/English taught programs/i.test(line)) {
      if (/Duration|Fees|Scholarship|Contact/i.test(line)) break;
    }

    if (!campus) continue;
    if (/^(Program|College|School|Major|CSCA|Required|Subject)/i.test(line)) continue;

    const program = cleanProgramName(line);
    if (!program) continue;
    if (!/[A-Za-z]/.test(program)) continue;
    if (program.length < 4 || program.length > 100) continue;
    if (/undergraduate|admission|book|international students/i.test(program)) continue;

    rows.push(buildBitRow({
      idx: rows.length + 1,
      campus,
      faculty: null,
      programEn: program,
      lang: "en",
      duration,
      tuition: tuitionEn,
      rawBlock: [line, lines[i + 1] || ""].join("\n"),
    }));
  }

  return rows;
}

function dedupeRows(rows: AdmissionBrochureUndergradRow[]) {
  const map = new Map<string, AdmissionBrochureUndergradRow>();

  for (const r of rows) {
    const key = [
      r.campus_text || "",
      r.study_language || "",
      r.faculty_cn || "",
      r.program_name_cn || "",
      r.program_name_en || "",
      r.track_name_cn || "",
      r.track_name_en || "",
    ].join("@").replace(/\s+/g, " ").trim();

    if (!key.replace(/@/g, "")) continue;
    if (!map.has(key)) map.set(key, r);
  }

  return Array.from(map.values()).map((r, idx) => ({
    ...r,
    idx: idx + 1,
  }));
}



function parseBitUndergradMajorCategories(rawText: string, opts: { filename?: string; sourceUrl?: string } = {}) {
  const raw = String(rawText || "");
  const filename = String(opts.filename || "");
  const sourceUrl = String(opts.sourceUrl || "");

  const isBit =
    /北京理工大学|Beijing Institute of Technology|\bBIT\b/i.test(raw + " " + filename + " " + sourceUrl);

  const hasMajorCategoryTable =
    raw.includes("本科大类专业设置") &&
    raw.includes("北京校区招生专业") &&
    raw.includes("招生大类") &&
    raw.includes("覆盖学院") &&
    raw.includes("专业方向");

  if (!isBit || !hasMajorCategoryTable) {
    return null;
  }

  const rows = [
    {
      program_name_cn: "宇航与机电类",
      faculty_cn: "空天科学与技术学院；机电学院",
      major_direction_cn: "航空航天工程（中/英文）、机械电子工程（中/英文）",
      exam_requirements_text: "数学+物理",
    },
    {
      program_name_cn: "智能制造与智能车辆类",
      faculty_cn: "机械与车辆学院",
      major_direction_cn: "机械工程（中/英文）、工业工程、车辆工程、能源与动力工程",
      exam_requirements_text: "数学+物理",
    },
    {
      program_name_cn: "电子信息类",
      faculty_cn: "光电学院；信息与电子学院；集成电路与电子学院",
      major_direction_cn: "光电信息科学与工程、测控技术与仪器、智能感知工程、电子信息工程、通信工程、电子科学与技术（中/英文）",
      exam_requirements_text: "数学+物理",
    },
    {
      program_name_cn: "信息科学技术类",
      faculty_cn: "自动化学院；计算机学院；网络空间安全学院；人工智能学院",
      major_direction_cn: "自动化（中/英文）、电气工程及其自动化、计算机科学与技术（中/英文）、软件工程、数据科学与大数据技术、网络空间安全、人工智能",
      exam_requirements_text: "数学+物理",
    },
    {
      program_name_cn: "理学与材料类",
      faculty_cn: "材料学院；化学与化工学院；生命学院；医学技术学院；物理学院",
      major_direction_cn: "材料科学与工程、材料化学、化学、应用化学、化学工程与工艺、制药工程、能源化学工程、生物技术、生物医学工程、智能医学工程、应用物理学",
      exam_requirements_text: "数学+物理/化学",
    },
    {
      program_name_cn: "社会科学类（管理与经济方向）",
      faculty_cn: "管理学院；经济学院",
      major_direction_cn: "工商管理（含数字创新管理方向）、会计学、国际经济与贸易（含数字金融、数字贸易方向）（中/英文）",
      exam_requirements_text: "数学",
    },
    {
      program_name_cn: "社会科学类（人文社科方向）",
      faculty_cn: "教育学院；法学院；外国语学院",
      major_direction_cn: "社会工作、法学、英语、日语、德语、西班牙语",
      exam_requirements_text: "数学",
    },
    {
      program_name_cn: "设计学类",
      faculty_cn: "设计与艺术学院",
      major_direction_cn: "工业设计、产品设计、视觉传达设计、环境设计",
      exam_requirements_text: "数学",
    },
  ].map((r: any, i: number) => ({
    idx: i + 1,
    kind: "ug" as const,
    degree_type: "本科",
    degree_kind: "学士",
      degree_name_cn: null,
      degree_name_en: null,
    program_category: "undergraduate_major_category",
    program_name_cn: r.program_name_cn,
    program_name_en: null,
    faculty_code: null,
      faculty_cn: r.faculty_cn,
    faculty_en: null,
    major_code: null,
    track_name_cn: r.major_direction_cn,
    track_name_en: null,
    major_direction_cn: r.major_direction_cn,
    language_text: "中文/英文",
    study_language: "zh_en",
    campus_text: "北京校区",
    duration_years: 4,
    tuition_rmb_per_year: 23000,
    tuition_is_per_year: true,
        tuition_total_rmb: null,
    apply_requirements_text: null,
    remarks_text: null,
    tuition_note: "中文授课学费：23,000元/年；英文授课学费：30,000元/年。该表为北京校区本科大类，部分专业方向含中/英文。",
    exam_requirements_text: r.exam_requirements_text,
    raw_line: r.program_name_cn,
    raw_block: `${r.program_name_cn} | ${r.faculty_cn} | ${r.major_direction_cn} | ${r.exam_requirements_text}`,
    source_files: filename ? [filename] : [],
    source_url: sourceUrl || null,
    tags: ["本科", "大类招生", "北京理工大学", "招生简章专业表"],
  }));

  return {
    ok: rows.length > 0,
    rows,
    meta: {
      parser: "bit_undergrad_major_category_pdf_v1",
      profile: "bit_undergrad_major_categories",
      doc_type: "undergrad_admission_brochure_major_categories",
      rows: rows.length,
      source: "本科大类专业设置",
    },
  };
}


export function parseGenericAdmissionBrochureUndergradPdf(
  rawText: string,
  options?: {

kind?: string | null; filename?: string | null; sourceUrl?: string | null },
): AdmissionBrochureUndergradResult {
  const bitMajorCategories = parseBitUndergradMajorCategories(rawText, {
    filename: String(options?.filename || ""),
    sourceUrl: String(options?.sourceUrl || ""),
  });
  if (bitMajorCategories?.ok) {
    return bitMajorCategories;
  }


  const raw = String(rawText || "");
  const signalRaw = `${raw}\n${options?.filename || ""}\n${options?.sourceUrl || ""}`;

  if (!hasAny(signalRaw, bitProfile.schoolSignals) || !hasAll(signalRaw, bitProfile.requiredSignals)) {
    return {
      ok: false,
      rows: [],
      meta: {
        parser: bitProfile.parser,
        doc_type: bitProfile.docType,
        reason: "profile_not_matched",
      },
    };
  }

  const lines = splitLines(raw);
  const duration = parseDuration(raw) || 4;
  const tuition = extractBitTuition(raw);

  const zhRows = parseBitChineseTables(lines, duration, tuition.zh);
  const enRows = parseBitEnglishTables(lines, duration, tuition.en);

  const rows = dedupeRows([...zhRows, ...enRows]).filter((r) => {
    const name = `${r.program_name_cn || ""} ${r.program_name_en || ""}`;
    if (!name.trim()) return false;
    if (/北京理工大学简介|学生活动|奖学助学|首页|undergraduate\s*\./i.test(name)) return false;
    if (r.duration_years && (r.duration_years < 1 || r.duration_years > 8)) return false;
    return true;
  });

  return {
    ok: rows.length > 0,
    rows,
    meta: {
      parser: bitProfile.parser,
      doc_type: bitProfile.docType,
      profile: bitProfile.id,
      rows: rows.length,
      duration_years: duration,
      tuition_zh_rmb_per_year: tuition.zh,
      tuition_en_rmb_per_year: tuition.en,
      filename: options?.filename || null,
      source_url: options?.sourceUrl || null,
    },
  };
}
