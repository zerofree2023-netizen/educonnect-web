/**
 * School ingest profile registry.
 *
 * This registry is intentionally lightweight.
 * Current upload behavior is still implemented in:
 *
 * - app/api/admin/schools/[school_id]/upload/route.ts
 *
 * Profiles here are the target structure for the next refactor.
 */

import {
  XJTU_PROFILE_STATUS,
  getXjtuExpectedRows,
  isXjtuGradRawText,
  isXjtuRawText,
  isXjtuUgRawText,
  type XjtuDegreeKind,
} from "./xjtu";

export type IngestDegreeKind = "ug" | "master" | "phd";

export type SchoolIngestProfile = {
  school_key: string;
  school_name_cn: string;
  school_name_en?: string;
  isRawTextMatch: (rawText: unknown) => boolean;
  isDegreeRawTextMatch?: Partial<Record<IngestDegreeKind, (rawText: unknown) => boolean>>;
  getExpectedRows?: (kind: IngestDegreeKind) => number | null;
};

export const SCHOOL_INGEST_PROFILES: SchoolIngestProfile[] = [
  {
    school_key: XJTU_PROFILE_STATUS.school_key,
    school_name_cn: XJTU_PROFILE_STATUS.school_name_cn,
    school_name_en: XJTU_PROFILE_STATUS.school_name_en,
    isRawTextMatch: isXjtuRawText,
    isDegreeRawTextMatch: {
      ug: isXjtuUgRawText,
      master: isXjtuGradRawText,
      phd: isXjtuGradRawText,
    },
    getExpectedRows: (kind) => getXjtuExpectedRows(kind as XjtuDegreeKind),
  },
];

export function findSchoolIngestProfileByRawText(rawText: unknown): SchoolIngestProfile | null {
  return SCHOOL_INGEST_PROFILES.find((profile) => profile.isRawTextMatch(rawText)) || null;
}

export function findSchoolIngestProfileByKey(schoolKey: string): SchoolIngestProfile | null {
  const key = String(schoolKey || "").trim().toLowerCase();
  if (!key) return null;

  return (
    SCHOOL_INGEST_PROFILES.find((profile) => {
      return String(profile.school_key || "").toLowerCase() === key;
    }) || null
  );
}

export function getExpectedRowsForProfile(
  profile: SchoolIngestProfile | null | undefined,
  kind: IngestDegreeKind,
): number | null {
  if (!profile?.getExpectedRows) return null;
  return profile.getExpectedRows(kind);
}
