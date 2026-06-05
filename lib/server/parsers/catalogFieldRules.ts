export type CatalogFieldKey =
  | "faculty_code"
  | "faculty_cn"
  | "faculty_en"
  | "major_code"
  | "program_name_cn"
  | "program_name_en"
  | "track_name_cn"
  | "track_name_en"
  | "duration_years"
  | "tuition_rmb_per_year"
  | "contact_raw"
  | "csca_subjects_text"
  | "apply_requirements_text"
  | "remarks_text";

export type HeaderRule = {
  key: CatalogFieldKey;
  zh: string[];
  en: string[];
};

function normHeader(s: any) {
  return String(s ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/[（）]/g, (m) => (m === "（" ? "(" : ")"))
    .replace(/[：:]/g, "")
    .replace(/[\/／]/g, "/")
    .replace(/\s+/g, "")
    .toLowerCase()
    .trim();
}

export const catalogHeaderRules: HeaderRule[] = [
  {
    key: "faculty_cn",
    zh: ["院系名称", "院系", "学院", "学院名称", "招生院系", "招生学院", "培养单位", "招生单位", "学校/院系", "部门"],
    en: ["schools/departments", "school/department", "school", "department", "faculty", "college", "institute"],
  },
  {
    key: "major_code",
    zh: ["专业代码", "学科代码", "招生专业代码", "专业编号"],
    en: ["major code", "program code", "discipline code", "subject code"],
  },
  {
    key: "program_name_cn",
    zh: ["专业名称", "专业", "招生专业", "学科专业", "学科/专业名称", "项目名称", "专业/项目"],
    en: ["major name", "major", "program name", "program", "degree program", "discipline", "subject"],
  },
  {
    key: "track_name_cn",
    zh: ["研究方向", "专业方向", "方向", "研究领域", "培养方向"],
    en: ["research fields", "research field", "research area", "research areas", "area", "track", "concentration", "specialization"],
  },
  {
    key: "duration_years",
    zh: ["学制", "修业年限", "学习年限", "培养年限", "学制(年)", "年限"],
    en: ["duration", "length of schooling", "length", "study period", "years", "schooling"],
  },
  {
    key: "tuition_rmb_per_year",
    zh: ["学费", "收费标准", "费用", "学费标准", "培养费"],
    en: ["tuition", "tuition fee", "fee", "fees"],
  },
  {
    key: "contact_raw",
    zh: ["联系方式", "联系", "联系人", "联系电话", "邮箱", "咨询方式"],
    en: ["contact", "contact person", "email", "tel", "phone", "telephone"],
  },
  {
    key: "csca_subjects_text",
    zh: ["csca科目要求", "csca考试科目", "考试科目", "科目要求", "测试科目", "入学考试科目"],
    en: ["csca test subjects", "test subjects", "exam subjects", "subject requirements"],
  },
  {
    key: "apply_requirements_text",
    zh: ["申请要求", "入学要求", "录取要求", "申请条件", "招生条件", "语言要求", "入学条件"],
    en: ["admission requirements", "application requirements", "entry requirements", "eligibility", "language requirements"],
  },
  {
    key: "remarks_text",
    zh: ["备注", "说明", "注意事项", "其他要求", "其他要求和注意事项", "注"],
    en: ["remarks", "notes", "note", "other requirements", "additional requirements"],
  },
];

export function inferCatalogFieldKey(headerText: any): CatalogFieldKey | null {
  const h = normHeader(headerText);
  if (!h) return null;

  let best: { key: CatalogFieldKey; score: number } | null = null;

  for (const rule of catalogHeaderRules) {
    for (const c0 of [...rule.zh, ...rule.en]) {
      const c = normHeader(c0);
      if (!c) continue;

      let score = 0;
      if (h === c) score = 100;
      else if (h.includes(c)) score = 70;
      else if (c.includes(h) && h.length >= 2) score = 50;

      if (score > 0 && (!best || score > best.score)) {
        best = { key: rule.key, score };
      }
    }
  }

  return best?.key || null;
}

export function standardCatalogTableHeader() {
  return [
    { zh: "院系名称", en: "School/Department", key: "faculty_cn" },
    { zh: "专业代码", en: "Major Code", key: "major_code" },
    { zh: "专业名称", en: "Major Name", key: "program_name_cn" },
    { zh: "研究方向", en: "Research Area", key: "track_name_cn" },
    { zh: "学制", en: "Duration", key: "duration_years" },
    { zh: "学费", en: "Tuition", key: "tuition_rmb_per_year" },
    { zh: "联系方式", en: "Contact", key: "contact_raw" },
    { zh: "CSCA科目要求", en: "CSCA Test Subjects", key: "csca_subjects_text" },
    { zh: "申请要求", en: "Admission Requirements", key: "apply_requirements_text" },
    { zh: "备注", en: "Remarks", key: "remarks_text" },
  ];
}

export function buildReviewFlags(row: any) {
  const flags: string[] = [];

  const faculty = String(row?.faculty_cn || "").trim();
  const programCn = String(row?.program_name_cn || "").trim();
  const programEn = String(row?.program_name_en || "").trim();

  if (!faculty) flags.push("missing_faculty_cn");
  if (!programCn && !programEn) flags.push("missing_program_name");
  if (programCn && /^\d+$/.test(programCn)) flags.push("program_name_looks_numeric");
  if (faculty && programCn && faculty === programCn) flags.push("faculty_equals_program");
  if (programEn && /^(school|college|institute|department)\b/i.test(programEn)) {
    flags.push("program_en_looks_like_faculty");
  }

  if (row?.duration_years == null) flags.push("missing_duration_years");

  const tuition = row?.tuition_rmb_per_year;
  if (tuition != null) {
    const n = Number(tuition);
    if (!Number.isFinite(n) || n < 10000 || n > 300000) flags.push("tuition_out_of_range");
  }

  return flags;
}
