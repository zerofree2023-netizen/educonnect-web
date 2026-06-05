export type UstcMasterZhRow = {
  idx: number;
  kind: "master";
  faculty_cn: string | null;
  faculty_en: string | null;
  major_code: string | null;
  program_name_cn: string | null;
  program_name_en: string | null;
  track_name_cn: string | null;
  track_name_en: string | null;
  degree_type: "硕士";
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
  ["Astronomy", "天文学", "Astrophysics", "天体物理"],
  ["Atmospheric Science", "大气科学", "Atmosphere Physics and Environment", "大气物理学与大气环境"],
  ["Atmospheric Science", "大气科学", "Climatology and Global Change", "气候学和全球变化"],

  ["Biology", "生物学", "Biochemistry and Molecular Biology", "生物化学与分子生物学"],
  ["Biology", "生物学", "Bioinformatics", "生物信息学"],
  ["Biology", "生物学", "Biophysics", "生物物理学"],
  ["Biology", "生物学", "Cell Biology", "细胞生物学"],
  ["Biology", "生物学", "Genetics", "遗传学"],
  ["Biology", "生物学", "Microbiology", "微生物学"],
  ["Biology", "生物学", "Neurobiology", "神经生物学"],
  ["Biology", "生物学", "Structural Biology", "结构生物学"],

  ["Chemistry", "化学", "Analytical Chemistry", "分析化学"],
  ["Chemistry", "化学", "Chemical Biology", "化学生物学"],
  ["Chemistry", "化学", "Energy Chemistry", "能源化学"],
  ["Chemistry", "化学", "Inorganic Chemistry", "无机化学"],
  ["Chemistry", "化学", "Macromolecule Chemistry and Physics", "高分子化学与物理"],
  ["Chemistry", "化学", "Organic Chemistry", "有机化学"],
  ["Chemistry", "化学", "Physical Chemistry", "物理化学（含化学物理）"],

  ["Computer Science and Technology", "计算机科学与技术", "Computer Application Technology", "计算机应用技术"],
  ["Computer Science and Technology", "计算机科学与技术", "Computer Software and Theory", "计算机软件与理论"],
  ["Computer Science and Technology", "计算机科学与技术", "Computer System Structure", "计算机系统结构"],
  ["Computer Science and Technology", "计算机科学与技术", "Information Safety", "信息安全"],

  ["Control Science and Engineering", "控制科学与工程", "Control Science and Engineering", "控制科学与工程"],
  ["Cultural Heritage", "文物", "Cultural Heritage", "文物"],
  ["Cyberspace Security", "网络空间安全", "Cyberspace Security", "网络空间安全"],

  ["Electronic Science and Technology", "电子科学与技术", "Circuits and Systems", "电路与系统"],
  ["Electronic Science and Technology", "电子科学与技术", "Electronic Science and Technology", "电子科学与技术"],
  ["Electronic Science and Technology", "电子科学与技术", "Microelectronics and Solid State Electronics", "微电子学与固体电子学"],

  ["Environmental Science and Engineering", "环境科学与工程", "Environmental Science and Engineering", "环境科学与工程"],

  ["Geology", "地质学", "Geochemistry", "地球化学"],
  ["Geology", "地质学", "Mineralogy, Petrology, Mineral Deposit Geology", "矿物学、岩石学、矿床学"],
  ["Geology", "地质学", "Tectonics Geology", "构造地质学"],

  ["Geophysics", "地球物理学", "Solid Geophysics", "固体地球物理学"],
  ["Geophysics", "地球物理学", "Space Physics", "空间物理学"],

  ["History of Science and Technology", "科学技术史", "History of Science and Technology", "科学技术史"],
  ["Information and Communication Engineering", "信息与通信工程", "Information and Communication Engineering", "信息与通信工程"],

  ["Instrument Science and Technology", "仪器科学与技术", "Measuring and Testing Technologies and Instruments", "测试计量技术及仪器"],
  ["Instrument Science and Technology", "仪器科学与技术", "Precision Instrument and Machinery", "精密仪器及机械"],

  ["Integrated Circuit Science and Engineering", "集成电路科学与工程", "Integrated Circuit Design and Micro-Nano Systems", "集成电路设计与微纳系统"],
  ["Integrated Circuit Science and Engineering", "集成电路科学与工程", "Integrated Circuit Devices, Processes and Manufacturing", "集成电路器件、工艺与制造"],

  ["Journalism and Communication", "新闻与传播", "Journalism and Communication", "新闻与传播"],
  ["Law*", "法学*", "Intellectual Property*", "知识产权*"],

  ["Materials Science and Engineering", "材料科学与工程", "Materials Physics and Chemistry", "材料物理与化学"],
  ["Materials Science and Engineering", "材料科学与工程", "Materials Processing Engineering", "材料加工工程"],
  ["Materials Science and Engineering", "材料科学与工程", "Materials Science", "材料学"],

  ["Mathematics", "数学", "Applied Mathematics", "应用数学"],
  ["Mathematics", "数学", "Computing Mathematics", "计算数学"],
  ["Mathematics", "数学", "Fundamental Mathematics", "基础数学"],
  ["Mathematics", "数学", "Operational Research and Cybernetics", "运筹学与控制论"],
  ["Mathematics", "数学", "Probability and Statistics", "概率统计"],

  ["Mechanical", "机械", "Mechanical Engineering", "机械工程"],

  ["Mechanics", "力学", "Biomechanics", "生物力学"],
  ["Mechanics", "力学", "Dynamics and Control", "动力学与控制"],
  ["Mechanics", "力学", "Engineering Mechanics", "工程力学"],
  ["Mechanics", "力学", "Hydrodynamics", "流体力学"],
  ["Mechanics", "力学", "Material Mechanics and Design", "材料力学与设计"],
  ["Mechanics", "力学", "Solid Mechanics", "固体力学"],

  ["Nuclear Science and Technology", "核科学与技术", "Nuclear Energy Science and Engineering", "核能科学与工程"],
  ["Nuclear Science and Technology", "核科学与技术", "Nuclear Fuel Cycle and Materials", "核燃料循环与材料"],
  ["Nuclear Science and Technology", "核科学与技术", "Nuclear Technology and Applications", "核技术及应用"],
  ["Nuclear Science and Technology", "核科学与技术", "Radiation Proof and Environment Protection", "辐射防护及环境保护"],
  ["Nuclear Science and Technology", "核科学与技术", "Synchrotron Radiation and Application", "同步辐射及应用"],

  ["Optics Engineering", "光学工程", "Optics Engineering", "光学工程"],

  ["Physics", "物理学", "Atom and Molecule Physics", "原子与分子物理"],
  ["Physics", "物理学", "Condensed Matter Physics", "凝聚态物理"],
  ["Physics", "物理学", "Optics", "光学"],
  ["Physics", "物理学", "Particle Physics and Nuclear Physics", "粒子物理与原子核物理"],
  ["Physics", "物理学", "Plasma Physics", "等离子体物理"],
  ["Physics", "物理学", "Quantum Information Physics", "量子信息物理学"],
  ["Physics", "物理学", "Theoretical Physics", "理论物理"],

  ["Power Engineering and Engineering Thermophysics", "动力工程及工程热物理", "Engineering Thermophysics", "工程热物理"],
  ["Power Engineering and Engineering Thermophysics", "动力工程及工程热物理", "Refrigeration and Microtherm Engineering", "制冷及低温工程"],
  ["Power Engineering and Engineering Thermophysics", "动力工程及工程热物理", "Thermal Power Engineering", "热能工程"],

  ["Public Administration*", "公共管理学*", "Public Administration*", "公共管理学*"],
  ["Public Administration*", "公共管理学*", "Public Management*", "公共管理*"],

  ["Safety Science and Engineering", "安全科学与工程", "Safety Science and Engineering", "安全科学与工程"],
];

export function parseUstcMasterChineseImagePdf() {
  const rows: UstcMasterZhRow[] = DATA.map(
    ([major_en, major_cn, track_en, track_cn], i) => ({
      idx: i + 1,
      kind: "master",
      faculty_cn: major_cn,
      faculty_en: major_en,
      major_code: null,
      program_name_cn: major_cn,
      program_name_en: major_en,
      track_name_cn: track_cn,
      track_name_en: track_en,
      degree_type: "硕士",
      language_text: "中文",
      study_language: "zh",
      duration_years: null,
      tuition_rmb_per_year: null,
      tuition_total_rmb: null,
      tuition_is_per_year: null,
      tuition_note: null,
      apply_requirements_text:
        "汉语授课硕士项目申请者一般须达到 HSK 4 级；母语为中文，或能够证明高中或大学阶段以中文为教学语言者，可申请免交 HSK。",
      remarks_text:
        major_en.includes("*") || track_en.includes("*")
          ? "For applicants applying to majors marked with * on the list, the Bachelor’s degree must be obtained before August 31, 2023."
          : null,
      raw_line: `${major_en} | ${major_cn} | ${track_en} | ${track_cn}`,
      raw_block: `${major_en} | ${major_cn} | ${track_en} | ${track_cn}`,
      tags: ["硕士", "中文", "USTC图片PDF目录"],
    }),
  );

  return {
    ok: true,
    rows,
    meta: {
      parser: "ustc_master_zh_image_pdf_v1",
      doc_type: "ustc_master_chinese_catalog_image_pdf",
      rows: rows.length,
      table_header: [
        "Major (First-level discipline)",
        "专业（一级学科）",
        "Research Field",
        "研究方向",
      ],
      note: "Image-only PDF fallback. Parsed from visible table layout.",
    },
  };
}
