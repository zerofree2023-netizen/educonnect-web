export type BitGradCatalogRow = {
  idx: number;
  kind: "master" | "phd";
  degree_type: "硕士" | "博士";
  degree_kind: "硕士" | "博士";
  program_category: "graduate_program";
  faculty_cn: string | null;
  faculty_en: string | null;
  major_code: string | null;
  program_name_cn: string | null;
  program_name_en: string | null;
  campus_text: string | null;
  language_text: string | null;
  study_language: string | null;
  duration_years: number | null;
  tuition_rmb_per_year: number | null;
  tuition_is_per_year: boolean | null;
  tuition_note: string | null;
  application_fee_rmb?: number | null;
  application_portal_text?: string | null;
  application_time_text?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  raw_line?: string | null;
  raw_block?: string | null;
  source_files?: string[];
  source_url?: string | null;
  tags?: string[];
};

export type BitGradCatalogResult = {
  ok: boolean;
  rows: BitGradCatalogRow[];
  meta: Record<string, any>;
};

function hasAny(s: string, arr: string[]) {
  return arr.some((x) => s.includes(x));
}

function langTextToStudyLanguage(s: string) {
  if (/英语|英文|EN/i.test(s) && /汉语|中文|CH/i.test(s)) return "zh_en";
  if (/英语|英文|EN/i.test(s)) return "en";
  if (/汉语|中文|CH/i.test(s)) return "zh";
  return null;
}

function tuitionFor(kind: "master" | "phd", programCn: string, programEn: string, languageText: string) {
  if (kind === "phd") {
    return {
      tuition_rmb_per_year: 44400,
      tuition_note: "博士：44,400元/学年",
    };
  }

  if (/MBA|工商管理硕士/i.test(`${programCn} ${programEn}`)) {
    return {
      tuition_rmb_per_year: 49000,
      tuition_note: "MBA：49,000元/学年",
    };
  }

  if (/英语|英文|EN/i.test(languageText) && !/汉语|中文|CH/i.test(languageText)) {
    return {
      tuition_rmb_per_year: 36000,
      tuition_note: "硕士英文授课：36,000元/学年",
    };
  }

  if (/汉语|中文|CH/i.test(languageText) && /英语|英文|EN/i.test(languageText)) {
    return {
      tuition_rmb_per_year: 32000,
      tuition_note: "硕士：中文授课32,000元/学年；英文授课36,000元/学年。本表同一专业含中/英文授课，年费字段按中文授课填入。",
    };
  }

  return {
    tuition_rmb_per_year: 32000,
    tuition_note: "硕士中文授课：32,000元/学年",
  };
}

const BEIJING_ROWS = [
  ["空天科学与技术学院", "School of Aerospace Engineering", "航空宇航科学与技术", "Aeronautics & Astronautics Science & Technology", "硕士、博士", "汉语；英语"],
  ["空天科学与技术学院", "School of Aerospace Engineering", "力学", "Mechanics", "硕士、博士", "汉语；英语"],

  ["机电学院", "School of Mechatronical Engineering", "兵器科学与技术", "Armament Science and Technology", "硕士、博士", "汉语；英语"],
  ["机电学院", "School of Mechatronical Engineering", "安全科学与工程", "Safety Science & Engineering", "硕士、博士", "汉语；英语"],
  ["机电学院", "School of Mechatronical Engineering", "机械工程", "Mechanical Engineering", "硕士、博士", "汉语；英语"],

  ["机械与车辆学院", "School of Mechanical Engineering", "机械工程", "Mechanical Engineering", "硕士、博士", "汉语；英语"],
  ["机械与车辆学院", "School of Mechanical Engineering", "动力工程及工程热物理", "Power Engineering and Engineering Thermophysics", "硕士、博士", "汉语；英语"],

  ["光电学院", "School of Optics and Photonics", "光学工程", "Optical Engineering", "硕士、博士", "汉语；英语"],
  ["光电学院", "School of Optics and Photonics", "仪器科学与技术", "Instrument Science and Technology", "硕士、博士", "汉语；英语"],

  ["信息与电子学院", "School of Information and Electronics", "信息与通信工程", "Information and Communication Engineering", "硕士、博士", "汉语；英语"],
  ["集成电路与电子学院", "School of Integrated Circuits and Electronics", "电子科学与技术", "Electronic Science and Technology", "硕士、博士", "汉语；英语"],
  ["集成电路与电子学院", "School of Integrated Circuits and Electronics", "集成电路科学与工程", "Integrated Circuit Science and Engineering", "硕士、博士", "汉语；英语"],

  ["自动化学院", "School of Automation", "控制科学与工程", "Control Science and Engineering", "硕士、博士", "汉语；英语"],
  ["计算机学院", "School of Computer Science and Technology", "计算机科学与技术", "Computer Science and Technology", "硕士、博士", "汉语；英语"],
  ["网络空间安全学院", "School of Cyberspace Science and Technology", "网络空间安全", "Cyberspace Science and Technology", "硕士、博士", "汉语"],
  ["材料学院", "School of Materials Science & Engineering", "材料科学与工程", "Materials Science and Engineering", "博士", "汉语"],
  ["化学与化工学院", "School of Chemistry and Chemical Engineering", "化学", "Chemistry", "硕士、博士", "汉语；英语"],
  ["化学与化工学院", "School of Chemistry and Chemical Engineering", "化学工程与技术", "Chemical Engineering and Technology", "硕士、博士", "汉语；英语"],
  ["生命学院", "School of Life Science", "生物学", "Biology", "硕士、博士", "汉语"],
  ["医学技术学院", "School of Medical Technology", "生物医学工程", "Biomedical Engineering", "硕士、博士", "汉语"],
  ["数学与统计学院", "School of Mathematics and Statistics", "数学", "Mathematics", "硕士", "汉语；英语"],
  ["数学与统计学院", "School of Mathematics and Statistics", "统计学", "Statistics", "博士", "汉语；英语"],
  ["物理学院", "School of Physics", "物理学", "Physics", "硕士、博士", "汉语；英语"],

  ["管理学院", "School of Management", "工商管理硕士 MBA", "Master of Business Administration (MBA)", "硕士", "汉语；英语"],
  ["管理学院", "School of Management", "工程管理硕士", "Master of Engineering Management", "硕士", "汉语"],
  ["管理学院", "School of Management", "管理科学与工程", "Management Science and Engineering", "硕士、博士", "汉语；英语"],
  ["管理学院", "School of Management", "工商管理学", "Business Administration", "硕士、博士", "汉语；英语"],
  ["管理学院", "School of Management", "国民经济动员学", "National Economy Mobilization", "硕士、博士", "汉语；英语"],

  ["国际组织创新学院", "School of Global Governance", "公共管理学", "Public Administration", "硕士、博士", "汉语；英语"],
  ["经济学院", "School of Economics", "应用经济学", "Applied Economics", "硕士、博士", "汉语；英语"],
  ["经济学院", "School of Economics", "理论经济学", "Theoretical Economics", "硕士、博士", "汉语"],
  ["教育学院", "School of Education", "教育学", "Education", "硕士", "汉语"],
  ["法学院", "School of Law", "法学", "Law", "硕士、博士", "汉语；英语"],
  ["外国语学院", "School of Foreign Languages", "国际中文教育", "International Chinese Language Education", "硕士", "汉语"],
  ["设计与艺术学院", "School of Design and Arts", "设计学", "Design", "硕士", "汉语"],
] as const;

const ZHUHAI_ROWS = [
  ["空天信息学域", "Aerospace and Informatics Domain", "计算机科学与技术", "Computer Science and Technology", "硕士、博士", "汉语；英语"],
  ["能源交通学域", "Energy and Transportation Domain", "机械工程", "Mechanical Engineering", "硕士、博士", "汉语；英语"],
  ["能源交通学域", "Energy and Transportation Domain", "材料科学与工程", "Materials Science and Engineering", "硕士、博士", "汉语；英语"],
  ["海洋科技学域", "Marine Science and Technology Domain", "力学", "Mechanics", "硕士、博士", "汉语"],
  ["海洋科技学域", "Marine Science and Technology Domain", "控制科学与工程", "Control Science and Engineering", "硕士、博士", "汉语"],
  ["空天信息学域", "Aerospace and Informatics Domain", "信息与通信工程", "Information and Communication Engineering", "硕士、博士", "汉语"],
  ["空天信息学域", "Aerospace and Informatics Domain", "航空宇航科学与技术", "Aeronautics & Astronautics Science & Technology", "硕士、博士", "汉语"],
  ["能源交通学域", "Energy and Transportation Domain", "动力工程及工程热物理", "Power Engineering and Engineering Thermophysics", "硕士、博士", "汉语"],
  ["社会科学学域", "Social Science Domain", "应用经济学", "Applied Economics", "硕士、博士", "汉语"],
  ["社会科学学域", "Social Science Domain", "工商管理学", "Business Administration", "硕士、博士", "汉语"],
] as const;

function levelMatches(level: string, kind: "master" | "phd") {
  if (kind === "master") return /硕士|Master/i.test(level);
  return /博士|Ph\.?D|Doctor/i.test(level);
}

export function parseBitGraduateAdmissionBrochurePdf(
  rawText: string,
  options?: { kind?: string | null; filename?: string | null; sourceUrl?: string | null }
): BitGradCatalogResult {
  const raw = String(rawText || "");
  const filename = String(options?.filename || "");
  const sourceUrl = String(options?.sourceUrl || "");
  const kindRaw = String(options?.kind || "");

  if (kindRaw !== "master" && kindRaw !== "phd") {
    return { ok: false, rows: [], meta: { parser: "bit_graduate_admission_brochure_pdf_v1", reason: "kind_not_grad" } };
  }

  const signal = `${raw}\n${filename}\n${sourceUrl}`;
  if (
    !hasAny(signal, ["北京理工大学", "Beijing Institute of Technology", "BIT"]) ||
    !hasAny(signal, ["研究生", "graduate", "Programs", "招生专业"]) ||
    !hasAny(signal, ["硕士研究生2年", "博士研究生4年", "Master", "Ph.D."])
  ) {
    return { ok: false, rows: [], meta: { parser: "bit_graduate_admission_brochure_pdf_v1", reason: "profile_not_matched" } };
  }

  const kind = kindRaw as "master" | "phd";
  const rows: BitGradCatalogRow[] = [];

  function addRows(src: readonly (readonly string[])[], campus: string) {
    for (const item of src) {
      const [facultyCn, facultyEn, programCn, programEn, level, languageText] = item;
      if (!levelMatches(level, kind)) continue;

      const tuition = tuitionFor(kind, programCn, programEn, languageText);
      const degree = kind === "master" ? "硕士" : "博士";
      rows.push({
        idx: rows.length + 1,
        kind,
        degree_type: degree,
        degree_kind: degree,
        program_category: "graduate_program",
        faculty_cn: facultyCn,
        faculty_en: facultyEn,
        major_code: null,
        program_name_cn: programCn,
        program_name_en: programEn,
        campus_text: campus,
        language_text: languageText,
        study_language: langTextToStudyLanguage(languageText),
        duration_years: kind === "master" ? 2 : 4,
        tuition_rmb_per_year: tuition.tuition_rmb_per_year,
        tuition_is_per_year: true,
        tuition_note: tuition.tuition_note,
        application_fee_rmb: 600,
        application_portal_text: "http://apply.isc.bit.edu.cn",
        application_time_text: "2025年10月15日至2026年6月1日",
        contact_email: campus === "北京校区" ? "master_phd@bit.edu.cn" : "study_in_bitzh@bitzh.edu.cn",
        contact_phone: campus === "北京校区" ? "86-10-68910992" : "86-756-3835166; 86-756-3835204",
        raw_line: programCn,
        raw_block: `${campus} | ${facultyCn} | ${programCn} | ${level} | ${languageText}`,
        source_files: filename ? [filename] : [],
        source_url: sourceUrl || null,
        tags: ["研究生", degree, "北京理工大学", "招生简章专业表"],
      });
    }
  }

  addRows(BEIJING_ROWS, "北京校区");
  addRows(ZHUHAI_ROWS, "珠海校区");

  return {
    ok: rows.length > 0,
    rows,
    meta: {
      parser: "bit_graduate_admission_brochure_pdf_v1",
      profile: "bit_graduate_programs",
      doc_type: "graduate_admission_brochure_program_catalog",
      rows: rows.length,
      kind,
      source: "BIT graduate admission brochure",
    },
  };
}
