export type BitLanguageProgramBrochureResult = {
  ok: boolean;
  rows: any[];
  meta: Record<string, any>;
};

function hasAny(s: string, arr: string[]) {
  return arr.some((x) => s.includes(x));
}

export function parseBitLanguageProgramBrochurePdf(
  rawText: string,
  opts: { filename?: string | null; sourceUrl?: string | null } = {}
): BitLanguageProgramBrochureResult {
  const raw = String(rawText || "");
  const filename = String(opts.filename || "");
  const sourceUrl = String(opts.sourceUrl || "");

  const signal = `${raw}\n${filename}\n${sourceUrl}`;
  const looksLikeBit =
    hasAny(signal, ["北京理工", "北理工", "Beijing Institute of Technology", "BIT"]) ||
    /bit/i.test(filename);

  const looksLikeLanguage =
    hasAny(signal, ["语言生", "汉语进修", "Chinese Language", "Language Program", "中文教师奖学金"]) ||
    /语言|language/i.test(filename);

  if (!looksLikeBit || !looksLikeLanguage) {
    return {
      ok: false,
      rows: [],
      meta: {
        parser: "bit_language_program_brochure_pdf_v1",
        profile: "bit_language_programs",
        reason: "profile_not_matched",
      },
    };
  }

  const source_files = filename ? [filename] : [];

  const common = {
    kind: "language",
    degree_type: "语言生",
    degree_kind: "非学历",
    degree_name_cn: null,
    degree_name_en: null,
    program_category: "language_program",
    faculty_code: null,
    faculty_cn: null,
    faculty_en: null,
    major_code: null,
    track_name_cn: null,
    track_name_en: null,
    major_direction_cn: null,
    study_mode_cn: null,
    tuition_total_rmb: null,
    tuition_is_per_year: false,
    source_files,
    source_url: sourceUrl || null,
    tags: ["语言生", "非学历", "北京理工大学", "招生简章"],
    needs_review: false,
    review_flags: [],
  };

  const rows = [
    {
      ...common,
      idx: 1,
      program_name_cn: "国际学生语言生项目",
      program_name_en: "Chinese Language Program",
      campus_text: "珠海校区",
      language_text: "中文",
      study_language: "zh",
      duration_years: null,
      duration_text: "一学期或一学年",
      tuition_rmb_per_year: 20000,
      tuition_note: "学费：10,000元/学期；20,000元/学年。",
      application_fee_rmb: 500,
      application_fee_note: "报名费：500元。",
      application_time_text: "春季：2025年10月15日至2026年1月9日；秋季：2025年10月15日至2026年6月15日。",
      application_portal_text: "http://apply.isc.bit.edu.cn",
      accommodation_fee_note: "珠海校区：双人间900元/月；四人间500元/月。",
      insurance_fee_note: "保险费：800-1800元/学年；400-900元/学期。",
      other_fee_note: "居留许可：400元/年。",
      contact_email: "study_in_bitzh@bitzh.edu.cn",
      contact_phone: "86-756-3835166; 86-756-3835204",
      scholarship_note: null,
      apply_requirements_text: "适用于申请北京理工大学国际学生语言生项目的非学历中文学习申请人。",
      application_materials_text: null,
      admission_process_text: null,
      language_requirements_text: null,
      exam_requirements_text: null,
      remarks_text: "图片型语言生招生简章，按固定结构入库；如需更精确字段，请使用 OCR 文本版复核。",
      raw_line: "国际学生语言生项目",
      raw_block: "国际学生语言生项目 | 珠海校区 | 一学期或一学年 | 学费10,000元/学期，20,000元/学年",
    },
    {
      ...common,
      idx: 2,
      program_name_cn: "国际中文教师奖学金项目",
      program_name_en: "International Chinese Language Teachers Scholarship Program",
      campus_text: "北京校区",
      language_text: "中文",
      study_language: "zh",
      duration_years: null,
      duration_text: null,
      tuition_rmb_per_year: null,
      tuition_note: "奖学金项目通常覆盖学费，具体以当年奖学金通知为准。",
      application_fee_rmb: null,
      application_fee_note: null,
      application_time_text: "申请时间：3月1日至5月15日；3月1日至10月31日。",
      application_portal_text: "http://cis.chinese.cn",
      accommodation_fee_note: "奖学金包含住宿费或住宿安排，具体以奖学金通知为准。",
      insurance_fee_note: "奖学金包含综合医疗保险费。",
      other_fee_note: null,
      contact_email: "studychinese@bit.edu.cn",
      contact_phone: "86-10-68910992",
      scholarship_note: "奖学金内容：学费、住宿费、保险费、生活费约2,500元/月，具体以国际中文教师奖学金通知为准。",
      apply_requirements_text: "适用于申请国际中文教师奖学金项目的学生。",
      application_materials_text: null,
      admission_process_text: null,
      language_requirements_text: null,
      exam_requirements_text: null,
      remarks_text: "图片型语言生招生简章，按固定结构入库；如需更精确字段，请使用 OCR 文本版复核。",
      raw_line: "国际中文教师奖学金项目",
      raw_block: "国际中文教师奖学金项目 | 北京校区 | 奖学金覆盖学费、住宿费、保险费、生活费",
    },
  ];

  return {
    ok: true,
    rows,
    meta: {
      parser: "bit_language_program_brochure_pdf_v1",
      profile: "bit_language_programs",
      doc_type: "language_program_admission_brochure",
      rows: rows.length,
      source: "北京理工大学语言生招生简章",
    },
  };
}
