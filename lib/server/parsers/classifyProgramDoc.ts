export type ProgramDocType =
  | "sjtu_doctor_catalog"
  | "sjtu_master_catalog"
  | "tuition_doc"
  | "apply_guide"
  | "generic_catalog"
  | "unknown";

export function classifyProgramDoc(input: {
  raw_text: string;
  source_url?: string | null;
  filename?: string | null;
  kind?: string | null;
}) {
  const raw = String(input.raw_text || "");
  const text = raw.toLowerCase();
  const url = String(input.source_url || "").toLowerCase();
  const filename = String(input.filename || "").toLowerCase();
  const kind = String(input.kind || "").toLowerCase();

  if (
    text.includes("上海交通大学") &&
    text.includes("博士") &&
    (text.includes("专业目录") || text.includes("招生目录") || text.includes("申请考核")) &&
    !text.includes("硕士")
  ) {
    return {
      doc_type: "sjtu_doctor_catalog" as ProgramDocType,
      confidence: 0.95,
      should_parse_program_catalog: true,
      reason: "matched sjtu doctor catalog keywords",
    };
  }

  if (
    text.includes("上海交通大学") &&
    text.includes("硕士") &&
    (text.includes("专业目录") || text.includes("招生目录")) &&
    !text.includes("博士")
  ) {
    return {
      doc_type: "sjtu_master_catalog" as ProgramDocType,
      confidence: 0.95,
      should_parse_program_catalog: true,
      reason: "matched sjtu master catalog keywords",
    };
  }

  if (
    text.includes("学费") ||
    text.includes("tuition") ||
    url.includes("tuition") ||
    filename.includes("tuition")
  ) {
    return {
      doc_type: "tuition_doc" as ProgramDocType,
      confidence: 0.8,
      should_parse_program_catalog: false,
      reason: "matched tuition keywords",
    };
  }

  if (
    text.includes("申请指南") ||
    text.includes("申请办法") ||
    text.includes("how to apply")
  ) {
    return {
      doc_type: "apply_guide" as ProgramDocType,
      confidence: 0.8,
      should_parse_program_catalog: false,
      reason: "matched apply guide keywords",
    };
  }

  if (
    kind === "ug" ||
    kind === "master" ||
    kind === "phd" ||
    text.includes("专业目录") ||
    text.includes("招生目录")
  ) {
    return {
      doc_type: "generic_catalog" as ProgramDocType,
      confidence: 0.6,
      should_parse_program_catalog: true,
      reason: "generic catalog fallback",
    };
  }

  return {
    doc_type: "unknown" as ProgramDocType,
    confidence: 0.3,
    should_parse_program_catalog: false,
    reason: "no strong match",
  };
}