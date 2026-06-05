// lib/server/parsers/sjtuUndergradCatalogPdf.ts

export type SjtuUndergradCatalogRow = {
  idx: number;
  faculty_cn: string | null;
  program_name_cn: string | null;
  major_code: string | null;
  duration_years: number | null;
  degree_type: string | null;
  study_language: string | null;
  language_text: string | null;
  csca_subjects_text: string | null;
  apply_requirements_text: string | null;
  remarks: string | null;
  raw_line: string | null;
};

export type SjtuUndergradCatalogResult = {
  ok: boolean;
  rows: SjtuUndergradCatalogRow[];
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

function cleanCompact(s: any) {
  return String(s ?? "")
    .replace(/\s+/g, "")
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
    .filter((x) => !/^SJTU\s*2026/i.test(x));
}

function isHeaderOrNoise(line: string) {
  const s = cleanCompact(line);
  if (!s) return true;

  const noise = [
    "附件一",
    "上海交通大学",
    "国际本科生",
    "招生专业目录",
    "CSCA",
    "测试科目",
    "入学考试",
    "序号",
    "学院名称",
    "招生专业名称",
    "分流专业名称",
    "学制",
    "专业类别",
    "常规批",
    "至少提供",
    "以下科目",
  ];

  return noise.some((x) => s.includes(x));
}

function parseDuration(line: string): number | null {
  const m = String(line || "").match(/([345])\s*年/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

const FACULTY_WORDS = [
  "船舶海洋与建筑工程学院",
  "机械与动力工程学院",
  "电气工程学院",
  "自动化与感知学院",
  "计算机学院",
  "软件学院",
  "电子信息与电气工程学院",
  "集成电路学院",
  "人工智能学院",
  "材料科学与工程学院",
  "航空航天学院",
  "环境科学与工程学院",
  "生物医学工程学院",
  "智慧能源创新学院",
  "溥渊未来技术学院",
  "数学科学学院",
  "物理与天文学院",
  "化学化工学院",
  "生命科学技术学院",
  "农业与生物学院",
  "药学院",
  "安泰经济与管理学院",
  "凯原法学院",
  "外国语学院",
  "人文学院",
  "国际与公共事务学院",
  "媒体与传播学院",
  "设计学院",
  "上海高级金融学院",
];

const FACULTY_BY_PROGRAM: Record<string, string> = {
  "*海洋工程类": "船舶海洋与建筑工程学院",
  "海洋工程类": "船舶海洋与建筑工程学院",

  "*机械类": "机械与动力工程学院",
  "机械类": "机械与动力工程学院",

  "电气工程及其自动化": "电气工程学院",

  "自动化": "自动化与感知学院",
  "智能感知工程": "自动化与感知学院",

  "计算机科学与技术": "计算机学院",
  "软件工程": "软件学院",
  "信息工程": "电子信息与电气工程学院",

  "电子科学与技术": "集成电路学院",
  "微电子科学与工程": "集成电路学院",

  "人工智能": "人工智能学院",
  "材料科学与工程": "材料科学与工程学院",
  "航空航天工程": "航空航天学院",
  "环境科学与工程": "环境科学与工程学院",
  "生物医学工程": "生物医学工程学院",
  "智慧能源工程": "智慧能源创新学院",
  "可持续能源": "溥渊未来技术学院",
  "健康科学与技术": "溥渊未来技术学院",

  "数学与应用数学、统计学": "数学科学学院",
  "物理学、天文学": "物理与天文学院",

  "*化学类": "化学化工学院",
  "化学类": "化学化工学院",
  "化学工程与工艺、化学": "化学化工学院",

  "*生物科学类": "生命科学技术学院",
  "生物科学类": "生命科学技术学院",

  "*自然保护与环境生态类": "农业与生物学院",
  "自然保护与环境生态类": "农业与生物学院",

  "*药学类": "药学院",
  "药学类": "药学院",
  "药学": "药学院",

  "*经济管理试验班": "安泰经济与管理学院",
  "经济管理试验班": "安泰经济与管理学院",

  "法学试验班": "凯原法学院",

  "英语": "外国语学院",
  "日语": "外国语学院",
  "德语": "外国语学院",

  "汉语言文学": "人文学院",
  "汉语言": "人文学院",

  "行政管理": "国际与公共事务学院",
  "传播学": "媒体与传播学院",

  "视觉传达设计": "设计学院",
  "工业设计": "设计学院",
  "建筑学": "设计学院",

  "金融学": "上海高级金融学院",
};

const CANONICAL_PROGRAMS = Object.keys(FACULTY_BY_PROGRAM).sort(
  (a, b) => b.length - a.length,
);

function findFacultyInText(text: string) {
  const compact = cleanCompact(text);

  for (const faculty of FACULTY_WORDS) {
    if (compact.includes(cleanCompact(faculty))) return faculty;
  }

  // 兼容 PDF 把“学院”拆成“学 院”
  const glued = compact.replace(/学\s*院/g, "学院");
  for (const faculty of FACULTY_WORDS) {
    if (glued.includes(cleanCompact(faculty))) return faculty;
  }

  return null;
}

function findProgramInText(text: string) {
  const compact = cleanCompact(text);

  for (const p of CANONICAL_PROGRAMS) {
    const pp = cleanCompact(p);
    if (compact.includes(pp)) return p;
  }

  return null;
}

function pickCsca(text: string, program: string | null) {
  const raw = String(text || "");
  const p = String(program || "");

  if (/数学/.test(raw) || /数学/.test(p)) return "数学";
  if (/物理/.test(raw) || /物理/.test(p)) return "物理";
  if (/化学/.test(raw) || /化学/.test(p)) return "化学";
  if (/生物/.test(raw) || /生物/.test(p)) return "生物";

  if (/理工农医/.test(raw)) return "理工农医";
  if (/人文社科/.test(raw)) return "人文社科";
  if (/文史哲法/.test(raw)) return "文史哲法";
  if (/经管/.test(raw)) return "经管";
  if (/艺术/.test(raw)) return "艺术";
  if (/汉语言/.test(raw)) return "汉语言";

  return null;
}

function shouldDropProgramName(name: string | null) {
  const s = String(name || "").trim();
  if (!s) return true;
  if (s === "-" || s === "—" || s === "——") return true;
  if (s === "药学院") return true;
  if (s.length < 2) return true;

  const badStarts = [
    "学与工程",
    "院",
    "学院",
    "方向",
    "以下科目",
  ];

  return badStarts.some((x) => s.startsWith(x));
}

function buildRowsFromLines(lines: string[]) {
  const rows: SjtuUndergradCatalogRow[] = [];

  let currentFaculty: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isHeaderOrNoise(line)) continue;

    const around = [
      lines[i - 1] || "",
      line,
      lines[i + 1] || "",
    ].join(" ");

    const facultyHit = findFacultyInText(around);
    if (facultyHit) currentFaculty = facultyHit;

    const program = findProgramInText(line) || findProgramInText(around);
    if (!program || shouldDropProgramName(program)) continue;

    const faculty =
      FACULTY_BY_PROGRAM[program] ||
      facultyHit ||
      currentFaculty ||
      null;

    const duration =
      parseDuration(line) ||
      parseDuration(around) ||
      4;

    const csca = pickCsca(around, program);

    const exists = rows.some(
      (r) =>
        cleanCompact(r.program_name_cn) === cleanCompact(program) &&
        cleanCompact(r.faculty_cn) === cleanCompact(faculty),
    );

    if (exists) continue;

    rows.push({
      idx: rows.length + 1,
      faculty_cn: faculty,
      program_name_cn: program,
      major_code: null,
      duration_years: duration,
      degree_type: "本科",
      study_language: "zh",
      language_text: "中文",
      csca_subjects_text: csca,
      apply_requirements_text: null,
      remarks: null,
      raw_line: around.trim(),
    });
  }

  return rows.map((r, i) => ({
    ...r,
    idx: i + 1,
  }));
}

export function parseSjtuUndergradCatalogPdf(
  rawText: string,
): SjtuUndergradCatalogResult {
  const lines = splitLines(rawText);

  const title = lines.slice(0, 40).join(" ").slice(0, 500);
  const rows = buildRowsFromLines(lines);

  return {
    ok: rows.length > 0,
    rows,
    meta: {
      parser: "sjtu_undergrad_catalog_special_v1",
      doc_type: "sjtu_undergrad_catalog",
      degree: "本科",
      kind: "ug",
      language: "中文",
      rows: rows.length,
      title,
      table_header: [
        { zh: "学院名称", key: "faculty_cn" },
        { zh: "招生专业名称", key: "program_name_cn" },
        { zh: "学制", key: "duration_years" },
        { zh: "专业类别/CSCA测试科目", key: "csca_subjects_text" },
      ],
    },
  };
}