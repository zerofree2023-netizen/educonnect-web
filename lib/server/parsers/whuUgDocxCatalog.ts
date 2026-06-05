export type WhuUgRow = {
  idx: number;
  kind: "ug";
  faculty_cn: string | null;
  faculty_en: string | null;
  major_code: string | null;
  program_name_cn: string | null;
  program_name_en: string | null;
  degree_type: "本科";
  language_text: "中文" | "英文";
  study_language: "zh" | "en";
  duration_years: number | null;
  raw_line: string | null;
  raw_block: string | null;
  tags: string[];
};

function norm(s: any) {
  return String(s || "")
    .replace(/\u00a0/g, " ")
    .replace(/\t/g, " ")
    .replace(/[ \r]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parseDuration(s: string): number | null {
  const t = norm(s).toLowerCase();
  const m = t.match(/(\d+)\s*(?:years?|年)/i);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

function splitCnEn(s: string): { cn: string | null; en: string | null } {
  const t = norm(s);
  if (!t) return { cn: null, en: null };

  const cn = (t.match(/[\u4e00-\u9fff（）()·、，：；\-—\s]+/g) || [])
    .join("")
    .replace(/\s+/g, "")
    .trim();

  const en = t
    .replace(/[\u4e00-\u9fff]/g, " ")
    .replace(/[（）]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return { cn: cn || null, en: en || null };
}

function cleanCn(s: string | null) {
  if (!s) return null;
  return s.replace(/（修改）/g, "").replace(/\(修改\)/g, "").trim() || null;
}

function cleanEn(s: string | null) {
  if (!s) return null;
  return s.replace(/\b修改\b/gi, "").replace(/\s+/g, " ").trim() || null;
}

function isJunkLine(s: string) {
  const t = norm(s);
  if (!t) return true;
  if (/附件|Attachment|Undergraduate Programs Available|For more information|如需详情|admission\.whu\.edu\.cn/i.test(t)) return true;
  if (/^(学院|School|专业|Programs|学制|Duration|文科|理工科|医学类|Medicine|Liberal Arts|Science and Engineering)$/i.test(t)) return true;
  return false;
}

const KNOWN_SCHOOLS: Array<[string, string]> = [
  ["哲学学院", "School of Philosophy"],
  ["文学院", "School of Chinese Language and Literature"],
  ["外国语言文学学院", "School of Foreign Languages and Literature"],
  ["新闻与传播学院", "School of Journalism and Communication"],
  ["历史学院", "School of History"],
  ["经济与管理学院", "Economics and Management School"],
  ["法学院", "School of Law"],
  ["政治与公共管理学院", "School of Political Science and Public Administration"],
  ["信息管理学院", "School of Information Management"],
  ["国际教育学院", "School of International Education"],
  ["艺术学院", "School of Arts"],
  ["社会学院", "School of Sociology"],
  ["数学与统计学院", "School of Mathematics and Statistics"],
  ["物理科学与技术学院", "School of Physics and Technology"],
  ["化学与分子科学学院", "School of Chemistry and Molecular Sciences"],
  ["生命科学学院", "School of Life Sciences"],
  ["资源与环境科学学院", "School of Resources and Environmental Science"],
  ["动力与机械学院", "School of Power and Mechanical Engineering"],
  ["电气与自动化学院", "School of Electrical Engineering and Automation"],
  ["土木建筑工程学院", "School of Civil Engineering"],
  ["水利水电学院", "School of Water Resources and Hydropower Engineering"],
  ["城市设计学院", "School of Urban Design"],
  ["电子信息学院", "School of Electronic Information"],
  ["计算机学院", "School of Computer Science"],
  ["国家网络安全学院", "School of Cyber Science and Engineering"],
  ["遥感信息工程学院", "School of Remote Sensing and Information Engineering"],
  ["测绘学院", "School of Geodesy and Geomatics"],
  ["地球与空间科学技术学院", "School of Earth and Space Science and Technology"],
  ["机器人学院", "School of Robotics"],
  ["集成电路学院", "School of Integrated Circuits"],
  ["医学院", "College of Medicine"],
  ["口腔医学院", "School of Stomatology"],
  ["药学院", "School of Pharmaceutical Sciences"],
  ["护理学院", "School of Nursing"],
  ["公共卫生学院", "School of Public Health"],
];

function findSchool(line: string): { cn: string; en: string } | null {
  const t = norm(line);
  for (const [cn, en] of KNOWN_SCHOOLS) {
    if (t.includes(cn) || t.includes(en)) return { cn, en };
  }
  return null;
}

const WHU_UG_EN_ROWS: Array<[string, string, string, number]> = [
  ["Bachelor of Management", "Business Administration", "工商管理", 4],
  ["Bachelor of Management", "Human Resource Management", "人力资源管理", 4],
  ["Bachelor of Management", "Marketing", "市场营销", 4],
  ["Bachelor of Management", "Accounting", "会计学", 4],
  ["Bachelor of Management", "Financial Management", "财务管理", 4],
  ["Bachelor of Economics", "Finance", "金融学", 4],
  ["Bachelor of Economics", "Insurance", "保险学", 4],
  ["Bachelor of Economics", "International Economics and Trade", "国际经济与贸易", 4],
  ["Bachelor of Software Engineering", "Software Engineering", "软件工程", 4],
  ["Electronic Commerce", "Electronic Commerce", "电子商务", 4],
  ["Bachelor of Medicine, Bachelor of Surgery (MBBS)", "Clinical Medicine / MBBS", "临床医学", 6],
  ["Geoenvironmental informatics", "Geographical Science", "地理科学", 4],
  ["Geoenvironmental informatics", "Geographic Information Science", "地理信息科学", 4],
  ["Geoenvironmental informatics", "Environmental Science", "环境科学", 4],
];

export function parseWhuUgEnglishDocx(rawText: string) {
  const rows: WhuUgRow[] = WHU_UG_EN_ROWS.map(([group, en, cn, duration], i) => ({
    idx: i + 1,
    kind: "ug",
    faculty_cn: null,
    faculty_en: group,
    major_code: null,
    program_name_cn: cn,
    program_name_en: en,
    degree_type: "本科",
    language_text: "英文",
    study_language: "en",
    duration_years: duration,
    raw_line: `${group} | ${en} | ${cn} | ${duration} Years`,
    raw_block: `${group} | ${en} | ${cn} | ${duration} Years`,
    tags: ["本科", "英文", "WHU_DOCX目录"],
  }));

  return {
    ok: rows.length > 0,
    rows,
    meta: {
      parser: "whu_ug_en_docx_v1",
      doc_type: "whu_ug_english_docx_catalog",
      rows: rows.length,
      table_header: ["Group", "Program", "Duration"],
      raw_preview: norm(rawText).slice(0, 500),
    },
  };
}

export function parseWhuUgChineseDocx(rawText: string) {
  const lines = norm(rawText)
    .split(/\n+/g)
    .map((x) => norm(x))
    .filter((x) => x && !isJunkLine(x));

  const rows: WhuUgRow[] = [];
  let currentFacultyCn: string | null = null;
  let currentFacultyEn: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const school = findSchool(line);

    if (school) {
      currentFacultyCn = school.cn;
      currentFacultyEn = school.en;
      continue;
    }

    const duration = parseDuration(line);
    if (!duration) continue;

    const prev = lines[i - 1] || "";
    if (!prev || findSchool(prev) || isJunkLine(prev)) continue;

    const { cn, en } = splitCnEn(prev);
    const programCn = cleanCn(cn);
    const programEn = cleanEn(en);

    if (!programCn && !programEn) continue;
    if (!currentFacultyCn && !currentFacultyEn) continue;

    rows.push({
      idx: rows.length + 1,
      kind: "ug",
      faculty_cn: currentFacultyCn,
      faculty_en: currentFacultyEn,
      major_code: null,
      program_name_cn: programCn,
      program_name_en: programEn,
      degree_type: "本科",
      language_text: "中文",
      study_language: "zh",
      duration_years: duration,
      raw_line: `${prev} | ${line}`,
      raw_block: `${currentFacultyCn || ""} / ${currentFacultyEn || ""} | ${prev} | ${line}`,
      tags: ["本科", "中文", "WHU_DOCX目录"],
    });
  }

  return {
    ok: rows.length > 0,
    rows,
    meta: {
      parser: "whu_ug_zh_docx_v1",
      doc_type: "whu_ug_chinese_docx_catalog",
      rows: rows.length,
      table_header: ["学院", "专业", "学制"],
      raw_preview: norm(rawText).slice(0, 500),
    },
  };
}
