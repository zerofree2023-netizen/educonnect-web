/**
 * XJTU generated archive manifest.
 *
 * The full raw archive was moved to:
 * - lib/server/ingest/profiles/xjtu.generated.archive.txt
 *
 * Reason:
 * - the archive contains raw TypeScript template strings/backticks
 * - keeping it as .ts makes tsc parse archived code
 */

export const XJTU_PROFILE_ARCHIVE_PATH =
  "lib/server/ingest/profiles/xjtu.generated.archive.txt";

export const XJTU_PROFILE_BLOCK_NAMES = [
  "FORCE_NEXT_CATALOG_TO_FINAL_BEFORE_GUIDE",
  "XJTU_GRAD_PHD_CATALOG_PARSE",
  "XJTU_GRAD_MASTER_CATALOG_PARSE",
  "FINAL_GENERIC_PROGRAM_CLEAN",
  "XJTU_UG_GUIDE_FINE_CLEAN",
  "XJTU_UG_FACULTY_REPAIR",
  "XJTU_UG_TUITION_RECALC_AFTER_FACULTY_REPAIR",
  "XJTU_UG_PDF_PARSE_COMPLETE_MARK",
  "XJTU_GRAD_PHD_FACULTY_REPAIR",
  "XJTU_GRAD_MASTER_FACULTY_REPAIR",
  "XJTU_GRAD_PARSE_COMPLETE_MARK",
  "XJTU_GRAD_META_FORCE_SYNC",
] as const;
