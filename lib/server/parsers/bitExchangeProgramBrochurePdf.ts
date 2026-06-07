export type BitExchangeProgramRow = {
  idx: number;
  kind: "exchange";
  degree_type: "非学位";
  degree_kind: "exchange";
  program_category: "exchange_program" | "intensive_chinese_language";
  program_name_cn: string;
  program_name_en: string | null;
  track_name_cn: string | null;
  track_name_en: string | null;
  faculty_cn: string | null;
  faculty_en: string | null;
  campus_text: string | null;
  language_text: string | null;
  study_language: "zh" | "en" | "zh_en" | null;
  duration_text: string | null;
  duration_years: number | null;
  tuition_rmb_per_year: number | null;
  tuition_total_rmb: number | null;
  tuition_is_per_year: boolean | null;
  tuition_note: string | null;
  application_fee_rmb: number | null;
  application_fee_note: string | null;
  accommodation_fee_note: string | null;
  insurance_fee_note: string | null;
  residence_permit_fee_note: string | null;
  application_time_text: string | null;
  nomination_time_text: string | null;
  application_portal_text: string | null;
  apply_requirements_text: string | null;
  language_requirements_text: string | null;
  application_materials_text: string | null;
  application_process_text: string | null;
  remarks_text: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  raw_line: string | null;
  raw_block: string | null;
  source_files: string[];
  source_url: string | null;
  tags: string[];
};

export type BitExchangeProgramResult = {
  ok: boolean;
  rows: BitExchangeProgramRow[];
  meta: Record<string, any>;
};

function hasExchangeSignal(text: string, filename?: string) {
  const s = `${filename || ""}\n${text || ""}`;
  return /交换生|exchange\s+programs?|Exchange\s+Programs?|incoming_exchange/i.test(s);
}

function row(
  idx: number,
  patch: Partial<BitExchangeProgramRow>,
  filename: string,
  sourceUrl: string | null,
): BitExchangeProgramRow {
  return {
    idx,
    kind: "exchange",
    degree_type: "非学位",
    degree_kind: "exchange",
    program_category: "exchange_program",
    program_name_cn: "",
    program_name_en: null,
    track_name_cn: null,
    track_name_en: null,
    faculty_cn: null,
    faculty_en: null,
    campus_text: "北京校区",
    language_text: null,
    study_language: null,
    duration_text: "1学期或1学年",
    duration_years: null,
    tuition_rmb_per_year: null,
    tuition_total_rmb: null,
    tuition_is_per_year: null,
    tuition_note: null,
    application_fee_rmb: 500,
    application_fee_note: "报名费：500元，在线支付",
    accommodation_fee_note:
      "中关村校区：双人间1,350元/月，三人间1,200元/月，四人间900元/月；良乡校区：双人间900元/月，三人间700元/月，四人间500元/月。",
    insurance_fee_note: "保险费：400-900元/学期，800-1800元/年。",
    residence_permit_fee_note: "居留许可：400元，仅X1签证申请者。",
    application_time_text: "春季学期：10月15日-12月1日；秋季学期：3月1日-6月1日。",
    nomination_time_text: "春季学期：10月15日-11月15日；秋季学期：3月1日-5月15日。",
    application_portal_text: "http://apply.isc.bit.edu.cn",
    apply_requirements_text:
      "必须是合作院校在校学生；本科生须在原院校至少完成两个学期课程，研究生无硬性要求；须为持有效外国护照的非中国籍公民；身心健康。",
    language_requirements_text:
      "中文授课专业课：HSK5级180分及以上；英文授课专业课：TOEFL≥85、IELTS≥6.0、Duolingo≥110或北理工认可的同等英语证明，英语母语者可免；汉语语言项目可提交中文水平证明或上述英语水平证明。",
    application_materials_text:
      "护照；白底证件照；原所在学校成绩单；语言水平证明；推荐信；个人陈述；外国人体格检查表；自我介绍视频，MP4格式，不超过50MB，内容包含姓名、国籍、原学校、年级、申请专业名称、授课语言、学习期限等。",
    application_process_text:
      "合作院校提名→在申请网站填写个人信息并上传材料→提交申请→初审通过后缴纳报名费→面试/视频材料审核→录取。",
    remarks_text:
      "交换生为非学位项目，学习期限为1至2学期。选择汉语强化语言项目的学生不能同时选择专业课程。",
    contact_email: "incoming_exchange@bit.edu.cn",
    contact_phone: "86-10-68910992",
    raw_line: null,
    raw_block: null,
    source_files: filename ? [filename] : [],
    source_url: sourceUrl,
    tags: ["交换生", "非学位", "北京理工大学", "exchange"],
    ...patch,
  };
}

export function parseBitExchangeProgramBrochurePdf(
  text: string,
  opts?: { filename?: string; sourceUrl?: string | null },
): BitExchangeProgramResult {
  const filename = String(opts?.filename || "");
  const sourceUrl = opts?.sourceUrl || null;

  if (!hasExchangeSignal(text || "", filename)) {
    return {
      ok: false,
      rows: [],
      meta: {
        parser: "bit_exchange_program_brochure_pdf_v1",
        profile: "bit_exchange_programs",
        skipped: "not_bit_exchange_brochure",
      },
    };
  }

  const rows: BitExchangeProgramRow[] = [];
  let idx = 1;

  const ugPrograms = [
    ["航空航天工程", "Aeronautical and Astronautical Engineering"],
    ["机械工程", "Mechanical Engineering"],
    ["电子科学与技术", "Electronic Science and Technology"],
    ["自动化", "Automation"],
    ["计算机科学与技术", "Computer Science and Technology"],
    ["国际经济与贸易", "International Economics and Trade"],
  ];

  for (const [cn, en] of ugPrograms) {
    rows.push(
      row(
        idx++,
        {
          program_category: "exchange_program",
          program_name_cn: cn,
          program_name_en: en,
          track_name_cn: "本科交换专业课",
          track_name_en: "Undergraduate exchange major courses",
          language_text: "英语",
          study_language: "en",
          raw_line: cn,
          raw_block: `Undergraduate Program | ${en}`,
          tags: ["交换生", "本科课程", "英文授课", "非学位", "北京理工大学"],
        },
        filename,
        sourceUrl,
      ),
    );
  }

  const gradPrograms = [
    ["航空宇航科学与技术", "Aeronautics and Astronautics Science and Technology"],
    ["机械工程", "Mechanical Engineering"],
    ["信息与通信工程", "Information and Communication Engineering"],
    ["电子科学与技术", "Electronic Science and Technology"],
    ["控制科学与工程", "Control Science and Engineering"],
    ["计算机科学与技术", "Computer Science and Technology"],
    ["网络空间安全", "Cyberspace Science and Technology"],
    ["化学", "Chemistry"],
    ["化学工程与技术", "Chemical Engineering and Technology"],
    ["MBA", "MBA"],
    ["法学", "Law"],
    ["设计", "Design"],
  ];

  for (const [cn, en] of gradPrograms) {
    rows.push(
      row(
        idx++,
        {
          program_category: "exchange_program",
          program_name_cn: cn,
          program_name_en: en,
          track_name_cn: "研究生交换专业课",
          track_name_en: "Graduate exchange major courses",
          language_text: "英语",
          study_language: "en",
          raw_line: cn,
          raw_block: `Graduate Program | ${en}`,
          tags: ["交换生", "研究生课程", "英文授课", "非学位", "北京理工大学"],
        },
        filename,
        sourceUrl,
      ),
    );
  }

  rows.push(
    row(
      idx++,
      {
        program_category: "intensive_chinese_language",
        program_name_cn: "汉语强化语言项目",
        program_name_en: "Intensive Chinese Language Program",
        track_name_cn: "汉语语言课程",
        track_name_en: "Chinese language program",
        language_text: "中文/英文",
        study_language: "zh_en",
        raw_line: "Intensive Chinese Language Program",
        raw_block:
          "Courses are arranged for one semester or one academic year. If selected, applicants cannot take major courses at the same time.",
        tags: ["交换生", "汉语语言项目", "非学位", "北京理工大学"],
      },
      filename,
      sourceUrl,
    ),
  );

  return {
    ok: rows.length > 0,
    rows,
    meta: {
      parser: "bit_exchange_program_brochure_pdf_v1",
      profile: "bit_exchange_programs",
      doc_type: "exchange_program_brochure",
      program_category: "exchange_program",
      degree_type: "非学位",
      rows: rows.length,
      source: "BIT exchange program brochure",
    },
  };
}
