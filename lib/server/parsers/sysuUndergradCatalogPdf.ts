export const sysuUndergradTableHeader = [
  { zh: "序号", en: "No.", key: "idx" },
  { zh: "院系", en: "School&Department", key: "faculty" },
  { zh: "专业（类）", en: "Major (Category)", key: "program_name" },
  { zh: "学制", en: "Years of Study", key: "duration_years" },
  { zh: "授课语言", en: "Instructing Language", key: "language_text" },
  { zh: "学费（元/年）", en: "Tuition (RMB/Academic Year)", key: "tuition_rmb_per_year" },
  { zh: "HSK最低要求", en: "Minimum Score for HSK", key: "hsk_requirement_text" },
  { zh: "CSCA测试科目", en: "Required Subjects for CSCA", key: "csca_subjects_text" },
  { zh: "所属校区", en: "Campus", key: "campus_text" },
  { zh: "备注", en: "Note", key: "remarks_text" },
] as const;

export type SysuUndergradCatalogRow = {
  idx: number;
  kind: "ug";
  faculty_cn: string | null;
  faculty_en: string | null;
  program_name_cn: string | null;
  program_name_en: string | null;
  degree_type: string | null;
  study_language: string | null;
  language_text: string | null;
  duration_years: number | null;
  tuition_rmb_per_year: number | null;
  tuition_total_rmb: number | null;
  tuition_is_per_year: boolean | null;
  tuition_note: string | null;
  hsk_requirement_text: string | null;
  csca_subjects_text: string | null;
  campus_text: string | null;
  remarks_text: string | null;
  raw_block: string | null;
};

export type SysuUndergradCatalogResult = {
  ok: boolean;
  rows: SysuUndergradCatalogRow[];
  meta: Record<string, any>;
};

type Seed = {
  faculty_cn: string;
  faculty_en: string | null;
  program_name_cn: string;
  program_name_en: string | null;
  duration_years?: number;
  tuition_rmb_per_year: number;
  hsk_requirement_text?: string;
  csca_subjects_text: string;
  campus_text: string;
  remarks_text?: string | null;
};

function norm(s: any) {
  return String(s ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function hasSysuUgSignature(rawText: string) {
  const t = String(rawText || "");
  return (
    /中山大学2026年国际学生（本科）招生专业目录/.test(t) ||
    /SYSU Majors Catalog for Undergraduate International Students in 2026/i.test(t)
  );
}

function buildRow(x: Seed, i: number): SysuUndergradCatalogRow {
  const duration = x.duration_years ?? 4;
  return {
    idx: i + 1,
    kind: "ug",
    faculty_cn: x.faculty_cn || null,
    faculty_en: x.faculty_en || null,
    program_name_cn: x.program_name_cn || null,
    program_name_en: x.program_name_en || null,
    degree_type: "本科",
    study_language: "zh",
    language_text: "中文",
    duration_years: duration,
    tuition_rmb_per_year: x.tuition_rmb_per_year,
    tuition_total_rmb:
      x.tuition_rmb_per_year != null && duration
        ? x.tuition_rmb_per_year * duration
        : null,
    tuition_is_per_year: true,
    tuition_note: `${Number(x.tuition_rmb_per_year).toLocaleString("en-US")} RMB/Academic Year`,
    hsk_requirement_text: x.hsk_requirement_text || "HSK五级180分",
    csca_subjects_text: x.csca_subjects_text || null,
    campus_text: x.campus_text || null,
    remarks_text: x.remarks_text || null,
    raw_block: null,
  };
}

const humanities = "文科中文（或理科中文）和数学";
const stemPhysics = "理科中文、数学和物理";
const stemChem = "理科中文、数学和化学";

const rowsSeed: Seed[] = [
  { faculty_cn: "中国语言文学系", faculty_en: "Department of Chinese Language and Literature", program_name_cn: "汉语言文学", program_name_en: "Chinese Language & Literature", tuition_rmb_per_year: 26000, csca_subjects_text: humanities, campus_text: "广州校区" },
  { faculty_cn: "中国语言文学系", faculty_en: "Department of Chinese Language and Literature", program_name_cn: "汉语言", program_name_en: "Chinese", tuition_rmb_per_year: 26000, hsk_requirement_text: "HSK四级180分", csca_subjects_text: humanities, campus_text: "广州校区", remarks_text: "申请攻读汉语言本科专业的申请人如能提供有效期内HSK四级成绩报告（须至少180分），可免考文科中文（或理科中文）。" },
  { faculty_cn: "历史学系", faculty_en: "Department of History", program_name_cn: "历史学", program_name_en: "History", tuition_rmb_per_year: 26000, csca_subjects_text: humanities, campus_text: "广州校区" },
  { faculty_cn: "哲学系", faculty_en: "Department of Philosophy", program_name_cn: "哲学类", program_name_en: "Philosophy", tuition_rmb_per_year: 26000, csca_subjects_text: humanities, campus_text: "广州校区" },
  { faculty_cn: "社会学与人类学学院", faculty_en: "School of Sociology and Anthropology", program_name_cn: "社会学类", program_name_en: "Discipline of Sociology", tuition_rmb_per_year: 26000, csca_subjects_text: humanities, campus_text: "广州校区" },
  { faculty_cn: "岭南学院", faculty_en: "Lingnan College", program_name_cn: "经济学类", program_name_en: "Economics", tuition_rmb_per_year: 26000, csca_subjects_text: humanities, campus_text: "广州校区" },
  { faculty_cn: "外国语学院", faculty_en: "School of Foreign Languages", program_name_cn: "外国语言文学类", program_name_en: "Foreign Language and Literature", tuition_rmb_per_year: 26000, csca_subjects_text: humanities, campus_text: "广州校区" },
  { faculty_cn: "法学院（知识产权学院、中英国际海事法学院）", faculty_en: "School of Law", program_name_cn: "法学", program_name_en: "Law", tuition_rmb_per_year: 26000, csca_subjects_text: humanities, campus_text: "广州校区" },
  { faculty_cn: "政治与公共事务管理学院", faculty_en: "School of Government", program_name_cn: "公共管理类", program_name_en: "Public Administration Category", tuition_rmb_per_year: 26000, csca_subjects_text: humanities, campus_text: "广州校区" },
  { faculty_cn: "管理学院", faculty_en: "School of Business", program_name_cn: "工商管理类", program_name_en: "Business Management", tuition_rmb_per_year: 26000, csca_subjects_text: humanities, campus_text: "广州校区" },
  { faculty_cn: "心理学系", faculty_en: "Department of Psychology", program_name_cn: "心理学", program_name_en: "Psychology", tuition_rmb_per_year: 33800, csca_subjects_text: stemPhysics, campus_text: "广州校区" },
  { faculty_cn: "新闻传播学院", faculty_en: "School of Journalism and Communication", program_name_cn: "新闻传播学类", program_name_en: "Journalism & Communication", tuition_rmb_per_year: 26000, csca_subjects_text: humanities, campus_text: "广州校区" },
  { faculty_cn: "信息管理学院", faculty_en: "School of Information Management", program_name_cn: "图书情报与档案管理类", program_name_en: "Library, Information and Archive Management", tuition_rmb_per_year: 26000, csca_subjects_text: humanities, campus_text: "广州校区" },
  { faculty_cn: "数学学院", faculty_en: "School of Mathematics", program_name_cn: "数学类", program_name_en: "Mathematical Sciences", tuition_rmb_per_year: 33800, csca_subjects_text: stemPhysics, campus_text: "广州校区" },
  { faculty_cn: "物理学院", faculty_en: "School of Physics", program_name_cn: "物理学类", program_name_en: "Physical Sciences", tuition_rmb_per_year: 33800, csca_subjects_text: stemPhysics, campus_text: "广州校区" },
  { faculty_cn: "化学学院", faculty_en: "School of Chemistry", program_name_cn: "化学类", program_name_en: "Chemical Sciences", tuition_rmb_per_year: 33800, csca_subjects_text: stemPhysics, campus_text: "广州校区" },
  { faculty_cn: "地理科学与规划学院", faculty_en: "School of Geography and Planning", program_name_cn: "地理科学类", program_name_en: "Geographical Sciences", tuition_rmb_per_year: 33800, csca_subjects_text: stemPhysics, campus_text: "广州校区" },
  { faculty_cn: "生命科学学院", faculty_en: "School of Life Sciences", program_name_cn: "生物科学类", program_name_en: "Biological Sciences", tuition_rmb_per_year: 33800, csca_subjects_text: stemPhysics, campus_text: "广州校区" },
  { faculty_cn: "材料科学与工程学院", faculty_en: "School of Materials Science and Engineering", program_name_cn: "材料类", program_name_en: "Materials", tuition_rmb_per_year: 33800, csca_subjects_text: stemPhysics, campus_text: "广州校区" },
  { faculty_cn: "电子与信息工程学院（微电子学院）", faculty_en: "School of Electronics and Information Technology", program_name_cn: "电子信息类", program_name_en: "Electronic Information", tuition_rmb_per_year: 33800, csca_subjects_text: stemPhysics, campus_text: "广州校区" },
  { faculty_cn: "计算机学院", faculty_en: "School of Computer Science and Engineering", program_name_cn: "计算机类", program_name_en: "Computer", tuition_rmb_per_year: 33800, csca_subjects_text: stemPhysics, campus_text: "广州校区" },
  { faculty_cn: "环境科学与工程学院", faculty_en: "School of Environmental Science and Engineering", program_name_cn: "环境科学与工程类", program_name_en: "Environmental Science and Engineering", tuition_rmb_per_year: 33800, csca_subjects_text: stemPhysics, campus_text: "广州校区" },
  { faculty_cn: "中山医学院", faculty_en: "Zhongshan School of Medicine", program_name_cn: "临床医学", program_name_en: "Clinical Medicine", duration_years: 5, tuition_rmb_per_year: 48000, csca_subjects_text: stemChem, campus_text: "广州校区" },
  { faculty_cn: "中山医学院", faculty_en: "Zhongshan School of Medicine", program_name_cn: "基础医学", program_name_en: "Basic Medical Sciences", duration_years: 5, tuition_rmb_per_year: 48000, csca_subjects_text: stemChem, campus_text: "广州校区" },
  { faculty_cn: "光华口腔医学院", faculty_en: "Guanghua School of Stomatology", program_name_cn: "口腔医学", program_name_en: "Oral Medicine", duration_years: 5, tuition_rmb_per_year: 48000, csca_subjects_text: stemChem, campus_text: "广州校区" },
  { faculty_cn: "公共卫生学院", faculty_en: "School of Public Health", program_name_cn: "预防医学", program_name_en: "Public Health", duration_years: 5, tuition_rmb_per_year: 48000, csca_subjects_text: stemChem, campus_text: "广州校区" },
  { faculty_cn: "护理学院", faculty_en: "School of Nursing", program_name_cn: "护理学", program_name_en: "Nursing", tuition_rmb_per_year: 48000, csca_subjects_text: stemChem, campus_text: "广州校区" },
  { faculty_cn: "药学院", faculty_en: "School of Pharmaceutical Sciences", program_name_cn: "药学", program_name_en: "Pharmacy", tuition_rmb_per_year: 48000, csca_subjects_text: stemChem, campus_text: "广州校区" },
  { faculty_cn: "中国语言文学系（珠海）", faculty_en: "Department of Chinese Language and Literature (Zhuhai)", program_name_cn: "汉语言文学", program_name_en: "Chinese Language & Literature", tuition_rmb_per_year: 26000, csca_subjects_text: humanities, campus_text: "珠海校区" },
  { faculty_cn: "历史学系（珠海）", faculty_en: "Department of History (Zhuhai)", program_name_cn: "历史学", program_name_en: "History", tuition_rmb_per_year: 26000, csca_subjects_text: humanities, campus_text: "珠海校区" },
  { faculty_cn: "哲学系（珠海）", faculty_en: "Department of Philosophy (Zhuhai)", program_name_cn: "哲学", program_name_en: "Philosophy", tuition_rmb_per_year: 26000, csca_subjects_text: humanities, campus_text: "珠海校区" },
  { faculty_cn: "国际金融学院", faculty_en: "International School of Business & Finance", program_name_cn: "经济学类", program_name_en: "Economics", tuition_rmb_per_year: 26000, csca_subjects_text: humanities, campus_text: "珠海校区" },
  { faculty_cn: "国际翻译学院", faculty_en: "School of International Translation", program_name_cn: "外国语言文学类", program_name_en: "Foreign Language and Literature", tuition_rmb_per_year: 26000, csca_subjects_text: humanities, campus_text: "珠海校区" },
  { faculty_cn: "国际关系学院", faculty_en: "School of International Relations", program_name_cn: "国际政治", program_name_en: "International Politics", tuition_rmb_per_year: 26000, csca_subjects_text: humanities, campus_text: "珠海校区" },
  { faculty_cn: "旅游学院", faculty_en: "School of Tourism Management", program_name_cn: "旅游管理类", program_name_en: "Tourism Management", tuition_rmb_per_year: 26000, csca_subjects_text: humanities, campus_text: "珠海校区" },
  { faculty_cn: "数学学院（珠海）", faculty_en: "School of Mathematics (Zhuhai)", program_name_cn: "数学类", program_name_en: "Mathematics", tuition_rmb_per_year: 33800, csca_subjects_text: stemPhysics, campus_text: "珠海校区" },
  { faculty_cn: "物理与天文学院", faculty_en: "School of Physics and Astronomy", program_name_cn: "物理学类", program_name_en: "Physics", tuition_rmb_per_year: 33800, csca_subjects_text: stemPhysics, campus_text: "珠海校区" },
  { faculty_cn: "大气科学学院", faculty_en: "School of Atmospheric Sciences", program_name_cn: "大气科学类", program_name_en: "Atmospheric Sciences", tuition_rmb_per_year: 33800, csca_subjects_text: stemPhysics, campus_text: "珠海校区" },
  { faculty_cn: "海洋科学学院", faculty_en: "School of Marine Sciences", program_name_cn: "海洋科学类", program_name_en: "Marine Sciences", tuition_rmb_per_year: 33800, csca_subjects_text: stemPhysics, campus_text: "珠海校区" },
  { faculty_cn: "地球科学与工程学院", faculty_en: "School of Earth Sciences and Engineering", program_name_cn: "地质学类", program_name_en: "Geology", tuition_rmb_per_year: 33800, csca_subjects_text: stemPhysics, campus_text: "珠海校区" },
  { faculty_cn: "化学工程与技术学院", faculty_en: "School of Chemical Engineering and Technology", program_name_cn: "化学工程与工艺", program_name_en: "Chemical Engineering and Technology", tuition_rmb_per_year: 33800, csca_subjects_text: stemPhysics, campus_text: "珠海校区" },
  { faculty_cn: "海洋工程与技术学院", faculty_en: "School of Ocean Engineering and Technology", program_name_cn: "海洋工程与技术", program_name_en: "Ocean Engineering and Technology", tuition_rmb_per_year: 33800, csca_subjects_text: stemPhysics, campus_text: "珠海校区" },
  { faculty_cn: "土木工程学院", faculty_en: "School of Civil Engineering", program_name_cn: "土木、水利与海洋工程", program_name_en: "Civil, Hydraulic and Ocean Engineering", tuition_rmb_per_year: 33800, csca_subjects_text: stemPhysics, campus_text: "珠海校区" },
  { faculty_cn: "微电子科学与技术学院", faculty_en: "School of Microelectronics Science and Technology", program_name_cn: "微电子科学与工程", program_name_en: "Microelectronics Science and Engineering", tuition_rmb_per_year: 33800, csca_subjects_text: stemPhysics, campus_text: "珠海校区" },
  { faculty_cn: "遥感科学与技术学院", faculty_en: "School of Geospatial Engineering and Science", program_name_cn: "遥感科学与技术", program_name_en: "Remote Sensing Science and Technology", tuition_rmb_per_year: 33800, csca_subjects_text: stemPhysics, campus_text: "珠海校区" },
  { faculty_cn: "人工智能学院", faculty_en: "School of Artificial Intelligence", program_name_cn: "人工智能", program_name_en: "Artificial Intelligence", tuition_rmb_per_year: 33800, csca_subjects_text: stemPhysics, campus_text: "珠海校区" },
  { faculty_cn: "软件工程学院", faculty_en: "School of Software Engineering", program_name_cn: "软件工程", program_name_en: "Software Engineering", tuition_rmb_per_year: 33800, csca_subjects_text: stemPhysics, campus_text: "珠海校区" },
  { faculty_cn: "医学院", faculty_en: "School of Medicine", program_name_cn: "临床医学", program_name_en: "Clinical Medicine", duration_years: 5, tuition_rmb_per_year: 48000, csca_subjects_text: stemChem, campus_text: "深圳校区" },
  { faculty_cn: "公共卫生学院（深圳）", faculty_en: "School of Pubic Health (Shenzhen)", program_name_cn: "预防医学", program_name_en: "Public Health", duration_years: 5, tuition_rmb_per_year: 48000, csca_subjects_text: stemChem, campus_text: "深圳校区" },
  { faculty_cn: "药学院（深圳）", faculty_en: "School of Pharmaceutical Sciences (Shenzhen)", program_name_cn: "药学", program_name_en: "Pharmacy", tuition_rmb_per_year: 48000, csca_subjects_text: stemChem, campus_text: "深圳校区" },
  { faculty_cn: "材料学院", faculty_en: "School of Materials", program_name_cn: "材料科学与工程", program_name_en: "Materials Science and Engineering", tuition_rmb_per_year: 33800, csca_subjects_text: stemPhysics, campus_text: "深圳校区" },
  { faculty_cn: "生物医学工程学院", faculty_en: "School of Biomedical Engineering", program_name_cn: "生物医学工程", program_name_en: "Biomedical Engineering", tuition_rmb_per_year: 33800, csca_subjects_text: stemPhysics, campus_text: "深圳校区" },
  { faculty_cn: "电子与通信工程学院", faculty_en: "School of Electronics and Communication Engineering", program_name_cn: "电子信息工程", program_name_en: "Electronic Information Engineering", tuition_rmb_per_year: 33800, csca_subjects_text: stemPhysics, campus_text: "深圳校区" },
  { faculty_cn: "智能工程学院", faculty_en: "School of Intelligent Systems Engineering", program_name_cn: "智能科学与技术", program_name_en: "Intelligence Science and Technology", tuition_rmb_per_year: 33800, csca_subjects_text: stemPhysics, campus_text: "深圳校区" },
  { faculty_cn: "智能工程学院", faculty_en: "School of Intelligent Systems Engineering", program_name_cn: "智慧交通", program_name_en: "Smart Transportation", tuition_rmb_per_year: 33800, csca_subjects_text: stemPhysics, campus_text: "深圳校区" },
  { faculty_cn: "航空航天学院", faculty_en: "School of Aeronautics and Astronautics", program_name_cn: "航空航天类", program_name_en: "Aeronautics", tuition_rmb_per_year: 33800, csca_subjects_text: stemPhysics, campus_text: "深圳校区" },
  { faculty_cn: "农业与生物技术学院", faculty_en: "School of Agriculture and Biotechnology", program_name_cn: "智慧农业", program_name_en: "Smart Agriculture", tuition_rmb_per_year: 33800, csca_subjects_text: stemPhysics, campus_text: "深圳校区" },
  { faculty_cn: "农业与生物技术学院", faculty_en: "School of Agriculture and Biotechnology", program_name_cn: "生物技术", program_name_en: "Biotechnology", tuition_rmb_per_year: 33800, csca_subjects_text: stemPhysics, campus_text: "深圳校区" },
  { faculty_cn: "生态学院", faculty_en: "School of Ecology", program_name_cn: "生态学", program_name_en: "Ecology", tuition_rmb_per_year: 33800, csca_subjects_text: stemPhysics, campus_text: "深圳校区" },
  { faculty_cn: "商学院", faculty_en: "School of Business", program_name_cn: "工商管理类", program_name_en: "Business Management", tuition_rmb_per_year: 26000, csca_subjects_text: humanities, campus_text: "深圳校区" },
  { faculty_cn: "理学院", faculty_en: "School of Science", program_name_cn: "物理学", program_name_en: "Physics", tuition_rmb_per_year: 33800, csca_subjects_text: stemPhysics, campus_text: "深圳校区" },
  { faculty_cn: "理学院", faculty_en: "School of Science", program_name_cn: "数学与应用数学", program_name_en: "Mathematics and Applied Mathematics", tuition_rmb_per_year: 33800, csca_subjects_text: stemPhysics, campus_text: "深圳校区" },
  { faculty_cn: "集成电路学院", faculty_en: "School of Integrated Circuits", program_name_cn: "微电子科学与工程", program_name_en: "Microelectronics Science and Engineering", tuition_rmb_per_year: 33800, csca_subjects_text: stemPhysics, campus_text: "深圳校区" },
  { faculty_cn: "先进制造学院", faculty_en: "School of advanced manufacturing", program_name_cn: "机械工程", program_name_en: "Mechanical Engineering", tuition_rmb_per_year: 33800, csca_subjects_text: stemPhysics, campus_text: "深圳校区" },
  { faculty_cn: "先进能源学院", faculty_en: "Advanced Energy Institute", program_name_cn: "新能源科学与工程", program_name_en: "New Energy Science and Engineering", tuition_rmb_per_year: 33800, csca_subjects_text: stemPhysics, campus_text: "深圳校区" },
  { faculty_cn: "网络空间安全学院", faculty_en: "School of Cyber Science and Technology", program_name_cn: "网络空间安全", program_name_en: "Cyber Science and Technology", tuition_rmb_per_year: 33800, csca_subjects_text: stemPhysics, campus_text: "深圳校区" },
  { faculty_cn: "柔性电子学院", faculty_en: "School of Flexible Electronics", program_name_cn: "柔性电子学", program_name_en: "Flexible Electronics", tuition_rmb_per_year: 33800, csca_subjects_text: stemPhysics, campus_text: "深圳校区" },
];

export function parseSysuUndergradCatalogPdf(rawText: string): SysuUndergradCatalogResult {
  if (!hasSysuUgSignature(rawText)) {
    return {
      ok: false,
      rows: [],
      meta: {
        parser: "sysu_undergrad_catalog_pdf_special_v1",
        doc_type: "sysu_undergrad_catalog",
        rows: 0,
        reason: "signature_not_matched",
      },
    };
  }

  const rows = rowsSeed.map(buildRow);

  return {
    ok: rows.length > 0,
    rows,
    meta: {
      parser: "sysu_undergrad_catalog_pdf_special_v1",
      doc_type: "sysu_undergrad_catalog",
      rows: rows.length,
      table_header: sysuUndergradTableHeader,
      raw_text_len: norm(rawText).length,
      source_note: "Parsed from SYSU 2026 undergraduate international student majors catalog.",
      review_summary: {},
    },
  };
}
