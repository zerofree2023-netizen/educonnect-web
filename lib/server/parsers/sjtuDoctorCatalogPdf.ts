// lib/server/parsers/sjtuDoctorCatalogPdf.ts

import {
  parseSjtuDoctorCatalogPdfByGpt,
  SJTU_DOCTOR_TABLE_HEADER,
  type SjtuDoctorCatalogResult,
} from "@/lib/server/parsers/sjtuDoctorCatalogGptFallback";

export { SJTU_DOCTOR_TABLE_HEADER };
export type { SjtuDoctorCatalogResult };

export function parseSjtuDoctorCatalogPdf(
  rawText: string,
): SjtuDoctorCatalogResult {
  const r = parseSjtuDoctorCatalogPdfByGpt(rawText);

  console.log("[SJTU_DOCTOR_PARSE_RESULT]", {
    ok: r?.ok,
    rowsLen: Array.isArray(r?.rows) ? r.rows.length : -1,
    meta: r?.meta || null,
    firstRow:
      Array.isArray(r?.rows) && r.rows.length > 0 ? r.rows[0] : null,
  });

  return r;
}