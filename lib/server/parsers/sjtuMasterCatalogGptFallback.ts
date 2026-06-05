import type {
  SjtuMasterCatalogResult,
} from "./sjtuMasterCatalogPdf";

export function parseSjtuMasterCatalogPdfByGpt(
  rawText: string,
): SjtuMasterCatalogResult {
  return {
    ok: false,
    rows: [],
    meta: {
      parser: "sjtu_master_catalog_gpt_fallback_v1",
      rows: 0,
      error: "not_implemented_yet",
    },
  };
}