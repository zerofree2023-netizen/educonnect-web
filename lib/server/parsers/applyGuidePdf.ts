export type ApplyGuideParseResult = {
  ok: boolean;
  title?: string | null;
  year?: number | null;
  degree_levels?: string[];
  study_languages?: string[];
  admission_requirements_text?: string | null;
  language_requirements_text?: string | null;
  application_materials_text?: string | null;
  application_time_text?: string | null;
  tuition_text?: string | null;
  scholarship_text?: string | null;
  contact_text?: string | null;
  sections?: Record<string, string>;
};

function cleanText(s: any) {
  return String(s || "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function sliceBetween(text: string, startRe: RegExp, endRes: RegExp[]) {
  const m = text.match(startRe);
  if (!m || m.index == null) return "";
  const start = m.index;
  const rest = text.slice(start);

  let end = rest.length;
  for (const er of endRes) {
    const em = rest.slice(1).match(er);
    if (em && em.index != null) {
      end = Math.min(end, em.index + 1);
    }
  }

  return cleanText(rest.slice(0, end));
}

export function parseApplyGuidePdf(rawText: string): ApplyGuideParseResult {
  const text = cleanText(rawText);
  if (!text) return { ok: false };

  const title =
    text.includes("理工医科菁英项目") ? "理工医科菁英项目招生简章" :
    text.includes("招生简章") ? "招生简章" :
    null;

  const yearHit = text.match(/(20\d{2})\s*年/);
  const year = yearHit ? Number(yearHit[1]) : null;

  const degree_levels = Array.from(
    new Set([
      ...(text.includes("本科") ? ["本科"] : []),
      ...(text.includes("硕士") ? ["硕士"] : []),
      ...(text.includes("博士") ? ["博士"] : []),
    ]),
  );

  const study_languages = Array.from(
    new Set([
      ...(text.includes("中文授课") || text.includes("中文授课课程") ? ["中文"] : []),
      ...(text.includes("英文授课") || text.includes("英文授课课程") ? ["英文"] : []),
    ]),
  );

  const sectionHeads = [
    /一[、.．]\s*招生专业/g,
    /二[、.．]\s*申请资格/g,
    /三[、.．]\s*申请时间/g,
    /四[、.．]\s*申请材料/g,
    /五[、.．]\s*申请方式/g,
    /六[、.．]\s*考核与录取/g,
    /七[、.．]\s*费用/g,
    /七[、.．]\s*学费/g,
    /八[、.．]\s*奖学金/g,
    /九[、.．]\s*住宿/g,
    /十[、.．]\s*联系方式/g,
    /联系方式/g,
  ];

  const admission = sliceBetween(
    text,
    /(?:二[、.．]\s*)?(?:申请资格|入学要求|申请条件|招生对象)/,
    sectionHeads,
  );

  const applicationTime = sliceBetween(
    text,
    /(?:三[、.．]\s*)?(?:申请时间|报名时间|申请日期)/,
    sectionHeads,
  );

  const materials = sliceBetween(
    text,
    /(?:四[、.．]\s*)?(?:申请材料|材料清单|提交材料)/,
    sectionHeads,
  );

  const tuition = sliceBetween(
    text,
    /(?:七[、.．]\s*)?(?:费用|学费|收费标准)/,
    sectionHeads,
  );

  const scholarship = sliceBetween(
    text,
    /(?:八[、.．]\s*)?(?:奖学金|资助)/,
    sectionHeads,
  );

  const contact = sliceBetween(
    text,
    /(?:十[、.．]\s*)?(?:联系方式|联系咨询|咨询方式)/,
    sectionHeads,
  );

  const languageReqParts: string[] = [];

  const hskHit = text.match(/中文授课课程[\s\S]{0,260}?(?:HSK|汉语水平考试)[\s\S]{0,160}?(?:5\s*级\s*210\s*分及以上|5级210分及以上)[\s\S]{0,80}?(?:6\s*级\s*180\s*分及以上|6级180分及以上)/);
  if (hskHit) languageReqParts.push(cleanText(hskHit[0]));

  const englishHit = text.match(/英文授课课程[\s\S]{0,260}?(?:TOEFL|IELTS|Duolingo|PTE)[\s\S]{0,260}?(?:90|6\.5|110|61)/i);
  if (englishHit) languageReqParts.push(cleanText(englishHit[0]));

  const languageRequirements = cleanText(languageReqParts.join("\n\n"));

  const sections: Record<string, string> = {};
  if (admission) sections.admission_requirements = admission;
  if (languageRequirements) sections.language_requirements = languageRequirements;
  if (applicationTime) sections.application_time = applicationTime;
  if (materials) sections.application_materials = materials;
  if (tuition) sections.tuition = tuition;
  if (scholarship) sections.scholarship = scholarship;
  if (contact) sections.contact = contact;

  return {
    ok: Object.keys(sections).length > 0,
    title,
    year,
    degree_levels,
    study_languages,
    admission_requirements_text: admission || null,
    language_requirements_text: languageRequirements || null,
    application_materials_text: materials || null,
    application_time_text: applicationTime || null,
    tuition_text: tuition || null,
    scholarship_text: scholarship || null,
    contact_text: contact || null,
    sections,
  };
}
