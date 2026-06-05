export type HtmlDocPurpose =
  | "program_detail"
  | "apply_guide"
  | "tuition_policy"
  | "scholarship"
  | "unknown";

export type NonPdfHtmlStrategy = {
  isHtml: boolean;
  purpose: HtmlDocPurpose;
  shouldKeepPrevCatalog: boolean;
  shouldParseGenericTuition: boolean;
  shouldParseApplyGuide: boolean;
  shouldParseProgramDetail: boolean;
  reason: string;
};

function hasAny(text: string, keys: string[]) {
  return keys.some((k) => text.includes(k));
}

export function classifyNonPdfHtmlStrategy(input: {
  kind: string;
  linkPurpose: string;
  contentType: string;
  sourceUrl?: string | null;
  rawText?: string | null;
}): NonPdfHtmlStrategy {
  const kind = String(input.kind || "");
  const linkPurpose = String(input.linkPurpose || "catalog");
  const contentType = String(input.contentType || "").toLowerCase();
  const sourceUrl = String(input.sourceUrl || "");
  const raw = String(input.rawText || "");

  const isHtml =
    contentType.includes("text/html") ||
    contentType.includes("application/xhtml") ||
    /\.html?($|\?)/i.test(sourceUrl) ||
    /\.aspx($|\?)/i.test(sourceUrl) ||
    /\.shtml($|\?)/i.test(sourceUrl);

  const base = {
    isHtml,
    purpose: "unknown" as HtmlDocPurpose,
    shouldKeepPrevCatalog: isHtml,
    shouldParseGenericTuition: false,
    shouldParseApplyGuide: false,
    shouldParseProgramDetail: false,
    reason: "",
  };

  if (!isHtml) {
    return {
      ...base,
      shouldKeepPrevCatalog: false,
      reason: "not_html",
    };
  }

  const looksProgramDetail =
    hasAny(raw, ["课程设置", "培养方案", "课程类别", "课程代码", "总学分", "研究方向"]) &&
    hasAny(raw, ["适用专业", "是否必修", "开课学期"]);

  if (looksProgramDetail) {
    return {
      ...base,
      purpose: "program_detail",
      shouldParseProgramDetail: true,
      shouldKeepPrevCatalog: true,
      reason: "html_program_detail_course_plan",
    };
  }

  const looksScholarship =
    linkPurpose === "scholarship" ||
    hasAny(raw, ["奖学金", "资助标准", "申请渠道", "中国政府奖学金"]);

  if (looksScholarship) {
    return {
      ...base,
      purpose: "scholarship",
      shouldKeepPrevCatalog: true,
      reason: "html_scholarship",
    };
  }

  const looksApplyGuide =
    linkPurpose === "apply_guide" ||
    hasAny(raw, ["申请条件", "申请资格", "入学要求", "申请材料", "申请时间", "申请步骤"]);

  if (looksApplyGuide) {
    return {
      ...base,
      purpose: "apply_guide",
      shouldParseApplyGuide: true,
      shouldKeepPrevCatalog: true,
      reason: "html_apply_guide",
    };
  }

  const looksTuition =
    linkPurpose === "tuition" &&
    hasAny(raw, ["学费", "收费标准", "费用标准", "tuition", "Tuition"]);

  if (looksTuition) {
    return {
      ...base,
      purpose: "tuition_policy",
      shouldParseGenericTuition: true,
      shouldKeepPrevCatalog: true,
      reason: "html_tuition_policy_explicit",
    };
  }

  return {
    ...base,
    purpose: "unknown",
    shouldKeepPrevCatalog: true,
    reason: "html_unknown_keep_prev_catalog",
  };
}
