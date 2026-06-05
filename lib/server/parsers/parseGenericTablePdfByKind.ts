export function parseGenericTablePdfByKind(raw_text: string, kind: string) {
  const text = String(raw_text || "");

  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const rows: any[] = [];
  let idx = 0;

  for (const line of lines) {
    if (!/年/.test(line)) continue;
    if (!/(人民币|\d{4,})/.test(line)) continue;

    const nameMatch = line.match(
      /^(.{2,50}?)(?:\s+\d+(?:\.\d+)?\s*年|\s+人民币|\s+\d[\d,]*\s*\/\s*学年)/
    );
    if (!nameMatch || !nameMatch[1]) continue;

    const program_name_cn = String(nameMatch[1] || "").trim();

    const durMatch = line.match(/(\d+(?:\.\d+)?)\s*年/);
    const duration_years = durMatch ? Number(durMatch[1]) : null;

    const feeMatch = line.match(/(\d[\d,]{3,})/);
    const tuition_rmb_per_year = feeMatch
      ? Number(String(feeMatch[1]).replace(/,/g, ""))
      : null;

    idx += 1;

    rows.push({
      idx,
      faculty_cn: null,
      program_name_cn,
      duration_years,
      tuition_rmb_per_year,
      raw_line: line,
    });
  }

  return {
    ok: rows.length > 0,
    rows,
    meta: {
      parser: "generic_table_pdf_v1",
      kind,
      rows: rows.length,
    },
  };
}
