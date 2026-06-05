type ParseInput = {
  rawText: string;
  sourceUrl?: string | null;
};

function normText(input: any) {
  return String(input || "")
    .replace(/\r/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function firstMatch(text: string, patterns: RegExp[]) {
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]) return String(m[1]).trim();
  }
  return "";
}

function parseDurationYears(text: string): number | null {
  const hits = [
    /基本修业年限[^0-9]{0,40}([1-9](?:\.\d+)?)\s*年/,
    /修业年限[^0-9]{0,40}([1-9](?:\.\d+)?)\s*年/,
    /学习年限[^0-9]{0,40}([1-9](?:\.\d+)?)\s*年/,
    /学习时间为\s*([1-9](?:\.\d+)?)\s*年/,
    /学制[^0-9]{0,40}([1-9](?:\.\d+)?)\s*年/,
    /([1-9](?:\.\d+)?)\s*年制/,
  ];

  for (const re of hits) {
    const m = text.match(re);
    const n = m?.[1] ? Number(m[1]) : null;
    if (n != null && Number.isFinite(n) && n >= 1 && n <= 10) return n;
  }

  return null;
}

function sliceBetween(text: string, startRe: RegExp, endRe: RegExp) {
  const m = text.match(startRe);
  if (!m || m.index == null) return "";
  const start = m.index;
  const rest = text.slice(start);
  const end = rest.slice(m[0].length).search(endRe);
  if (end >= 0) return rest.slice(0, m[0].length + end).trim();
  return rest.trim();
}

function parseCourseNames(text: string) {
  const courseBlock = sliceBetween(
    text,
    /附表[:：]?\s*课程设置|课程类别\s*\n\s*课程代码\s*\n\s*课程名称/,
    /\n\s*(南京大学|留学保险网|国家留学基金委|Copyright|地址[:：])/,
  );

  const src = courseBlock || text;
  const codes = Array.from(src.matchAll(/(0453\d{2}[A-Z]\d{2})\s*\n\s*([^\n]{2,80})/g));

  const courses = codes
    .map((m) => ({
      course_code: String(m[1] || "").trim(),
      course_name_cn: String(m[2] || "").trim(),
    }))
    .filter((x) => x.course_code && x.course_name_cn);

  // A类无课程代码的特殊课
  if (src.includes("研究生学术规范与学术诚信")) {
    courses.unshift({
      course_code: "",
      course_name_cn: "研究生学术规范与学术诚信",
    });
  }

  const seen = new Set<string>();
  return courses.filter((c) => {
    const k = `${c.course_code}::${c.course_name_cn}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function parseNjuMasterHtmlProgramDetail(input: ParseInput) {
  const rawText = normText(input?.rawText);
  const sourceUrl = String(input?.sourceUrl || "").trim() || null;

  if (!rawText) {
    return {
      ok: false,
      rows: [],
      meta: {
        parser: "nju_master_html_program_detail_v1",
        doc_type: "nju_master_html_program_detail",
        source_url: sourceUrl,
        rows: 0,
        reject_reason: "empty_raw_text",
      },
    };
  }

  const isNjuHwxy =
    rawText.includes("南京大学海外教育学院") ||
    rawText.includes("南京大学") ||
    String(sourceUrl || "").includes("hwxy.nju.edu.cn");

  const isMasterProgramDetail =
    rawText.includes("硕士") &&
    (
      rawText.includes("专业学位类别介绍") ||
      rawText.includes("培养目标") ||
      rawText.includes("课程设置") ||
      rawText.includes("学习年限") ||
      rawText.includes("学分要求")
    );

  const programName =
    firstMatch(rawText, [
      /当前位置：[\s\S]{0,300}?\n\s*([^\n]{2,40}?)专业\s*\n/,
      /\n\s*([^\n]{2,40}?)专业\s*\n\s*发布日期/,
      /\n\s*([^\n]{2,40}?)硕士专业学位/,
      /可申请毕业并授予([^\n]{2,40}?)硕士专业学位/,
    ]) || "国际中文教育";

  const majorCode =
    firstMatch(rawText, [
      /类别(?:（领域）)?代码[:：]\s*([0-9]{4,6})/,
      /专业代码[:：]\s*([0-9]{4,6})/,
      /代码[:：]\s*([0-9]{4,6})/,
    ]) || "0453";

  const programNameEn =
    firstMatch(rawText, [
      /英文名称为\s*([A-Za-z][A-Za-z ,.'-]{5,120})\s*[。\.]/,
    ]) || "Master of International Chinese Language Education";

  const durationYears = parseDurationYears(rawText);
  const courses = parseCourseNames(rawText);

  const hasCourses =
    courses.length > 0 ||
    rawText.includes("045320B12") ||
    rawText.includes("汉语作为第二语言教学") ||
    rawText.includes("课程设置");

  if (!isNjuHwxy || !isMasterProgramDetail) {
    return {
      ok: false,
      rows: [],
      meta: {
        parser: "nju_master_html_program_detail_v1",
        doc_type: "nju_master_html_program_detail",
        source_url: sourceUrl,
        rows: 0,
        reject_reason: "not_nju_master_program_detail",
        has_courses: hasCourses,
        duration_years: durationYears,
        program_name_cn: programName,
      },
    };
  }

  const row: any = {
    idx: 1,
    kind: "master",
    faculty_cn: "海外教育学院",
    faculty_en: null,
    major_code: majorCode,
    program_name_cn: programName.replace(/专业$/, ""),
    program_name_en: programNameEn,
    track_name_cn: null,
    track_name_en: null,
    degree_type: "硕士",
    degree_kind: "专业学位",
    study_language: "zh",
    language_text: "中文",
    study_mode_cn: "全日制",
    duration_years: durationYears,
    tuition_rmb_per_year: null,
    tuition_total_rmb: null,
    tuition_is_per_year: null,
    tuition_note: null,
    tuition_source_url: null,
    csca_subjects_text: null,
    apply_requirements_text: null,
    remarks_text: [
      "国际中文教育硕士专业学位",
      durationYears ? `基本修业年限 ${durationYears} 年` : "",
      "总学分要求 41 学分",
      hasCourses ? `已解析课程 ${courses.length} 门` : "",
    ].filter(Boolean).join("；"),
    contact_raw: null,
    raw_line: `${majorCode} 海外教育学院 ${programName.replace(/专业$/, "")} 中文 ${durationYears || ""}`.trim(),
    raw_block: rawText,
    courses,
    course_plan_text: sliceBetween(
      rawText,
      /五、学分要求与课程设置|学分要求与课程设置/,
      /\n\s*六、培养环节/,
    ) || null,
    needs_review: durationYears == null,
    review_flags: [
      ...(durationYears == null ? ["missing_duration"] : []),
      ...(!hasCourses ? ["missing_courses"] : []),
    ],
  };

  return {
    ok: true,
    rows: [row],
    meta: {
      parser: "nju_master_html_program_detail_v1",
      doc_type: "nju_master_html_program_detail",
      source_url: sourceUrl,
      rows: 1,
      has_courses: hasCourses,
      courses_len: courses.length,
      duration_years: durationYears,
      program_name_cn: row.program_name_cn,
      major_code: majorCode,
    },
  };
}

export default parseNjuMasterHtmlProgramDetail;
