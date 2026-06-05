import { parseTablePdfProgramCatalog } from "./tablePdfProgramCatalog";

type FileKind = "ug" | "master" | "phd" | "apply_guide" | "other";

export function parseGenericTablePdfByKind(rawText: string, kind: FileKind) {
  const commonHeader = {
    faculty: [
      "院系名称",
      "院系",
      "学院",
      "培养单位",
      "招生单位",
      "Schools/Departments",
      "School",
      "Department",
      "Faculty",
    ],
    majorCode: ["专业代码", "专业编号", "Major Code"],
    majorName: ["专业名称", "学科专业", "Major Name", "Program Name"],
    track: ["研究方向", "方向", "Research Fields", "Track"],
    contact: ["联系方式", "Contact"],
    duration: ["学制", "Duration"],
    tuition: ["学费", "Tuition", "Fee"],
  };

  const parserName =
    kind === "ug"
      ? "generic_ug_table_pdf_v1"
      : kind === "master"
        ? "generic_master_table_pdf_v1"
        : kind === "phd"
          ? "generic_phd_table_pdf_v1"
          : "generic_table_pdf_v1";

  const result = parseTablePdfProgramCatalog(rawText, {
    parserName,
    headerDef: commonHeader,
  });

  const degreeType =
    kind === "ug"
      ? "本科"
      : kind === "master"
        ? "硕士"
        : kind === "phd"
          ? "博士"
          : null;

  const rows = (result.rows || []).map((row, i) => ({
    ...row,
    idx: i + 1,
    kind,
    degree_type: (row as any)?.degree_type || degreeType,
  }));

  return {
    ok: rows.length > 0,
    rows,
    meta: {
      ...result.meta,
      kind,
      degree_type: degreeType,
    },
  };
}