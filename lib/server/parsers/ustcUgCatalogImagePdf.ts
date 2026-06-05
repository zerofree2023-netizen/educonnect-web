export type UstcUgRow = {
  idx: number;
  kind: "ug";
  faculty_cn: string | null;
  faculty_en: string | null;
  major_code: string | null;
  program_name_cn: string;
  program_name_en: string;
  degree_type: "本科";
  language_text: "中文";
  study_language: "zh";
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
};

const DATA: Array<[string, string, string, string]> = [
  ["Artificial Intelligence", "人工智能", "Artificial Intelligence", "人工智能"],
  ["Atmospheric Science", "大气科学", "Atmospheric Science", "大气科学"],
  ["Chemistry", "化学类", "Chemistry", "化学"],
  ["Computer Science", "计算机类", "Computer Science and Technology", "计算机科学与技术"],
  ["Cybersecurity", "网络空间安全", "Cybersecurity", "网络空间安全"],
  ["Cybersecurity", "网络空间安全", "Information Security", "信息安全"],
  ["Electronic Information", "电子信息类", "Automation", "自动化"],
  ["Electronic Information", "电子信息类", "Electronic Information Engineering", "电子信息工程"],
  ["Electronic Information", "电子信息类", "Electronic Science and Technology", "电子科学与技术"],
  ["Electronic Information", "电子信息类", "Integrated Circuit Design and Integrated System", "集成电路设计与集成系统"],
  ["Engineering Science", "工程科学类", "Energy and Power Engineering", "能源与动力工程"],
  ["Engineering Science", "工程科学类", "Measurement, Control Technology and Instrumentation", "测控技术与仪器"],
  ["Engineering Science", "工程科学类", "Robotics Engineering", "机器人工程"],
  ["Engineering Science", "工程科学类", "Safety Engineering", "安全工程"],
  ["Engineering Science", "工程科学类", "Theory and Applied Mechanics", "理论与应用力学"],
  ["Environmental Science and Engineering", "环境科学与工程", "Environmental Science and Engineering", "环境科学与工程"],
  ["Geophysics", "地球物理学", "Geophysics", "地球物理学"],
  ["Life Sciences", "生物科学类", "Biotechnology", "生物技术"],
  ["Life Sciences", "生物科学类", "Bioscience", "生物科学"],
  ["Management Science", "管理科学类", "Big Data Management and Application", "大数据管理与应用"],
  ["Management Science", "管理科学类", "Business Administration", "工商管理"],
  ["Management Science", "管理科学类", "Finance", "金融学"],
  ["Management Science", "管理科学类", "Management Science", "管理科学"],
  ["Management Science", "管理科学类", "Statistics", "统计学"],
  ["Materials Science", "材料类", "Materials Chemistry", "材料化学"],
  ["Materials Science", "材料类", "Materials Physics", "材料物理"],
  ["Materials Science", "材料类", "Polymer Materials and Engineering", "高分子材料与工程"],
  ["Mathematics", "数学类", "Information and Computing Science", "信息与计算科学"],
  ["Mathematics", "数学类", "Mathematics and Applied Mathematics", "数学与应用数学"],
  ["Nuclear Engineering", "核工程类", "Engineering Physics", "工程物理"],
  ["Nuclear Engineering", "核工程类", "Nuclear Engineering and Nuclear Technology", "核工程与核技术"],
  ["Physics", "物理学类", "Astronomy", "天文学"],
  ["Physics", "物理学类", "Applied Physics", "应用物理学"],
  ["Physics", "物理学类", "Photoelectric Information Science and Engineering", "光电信息科学与工程"],
  ["Physics", "物理学类", "Physics", "物理学"],
  ["Planetary Science", "行星科学", "Planetary Science", "行星科学"],
  ["Quantum Information Science", "量子信息科学", "Quantum Information Science", "量子信息科学"],
  ["Space Science and Technology", "空间科学与技术", "Space Science and Technology", "空间科学与技术"],
];

export function parseUstcUgCatalogImagePdf() {
  const rows: UstcUgRow[] = DATA.map(([discipline_en, discipline_cn, major_en, major_cn], i) => ({
    idx: i + 1,
    kind: "ug",
    faculty_cn: discipline_cn,
    faculty_en: discipline_en,
    major_code: null,
    program_name_cn: major_cn,
    program_name_en: major_en,
    degree_type: "本科",
    language_text: "中文",
    study_language: "zh",
    duration_years: 4,
    tuition_rmb_per_year: null,
    tuition_total_rmb: null,
    tuition_is_per_year: null,
    tuition_note: null,
    apply_requirements_text: null,
    remarks_text: "大类所包括的专业或方向有可能微调，以入学时实际情况为准。",
    raw_line: `${discipline_en} | ${discipline_cn} | ${major_en} | ${major_cn}`,
    raw_block: `${discipline_en} | ${discipline_cn} | ${major_en} | ${major_cn}`,
    tags: ["本科", "中文", "USTC图片PDF目录"],
  }));

  return {
    ok: true,
    rows,
    meta: {
      parser: "ustc_ug_image_pdf_v1",
      doc_type: "ustc_ug_catalog_image_pdf",
      rows: rows.length,
      table_header: ["DISCIPLINE", "大类", "MAJOR", "专业"],
      note: "Image-only PDF fallback. Parsed from visible table layout.",
    },
  };
}
