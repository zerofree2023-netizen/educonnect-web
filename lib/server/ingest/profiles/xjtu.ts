/**
 * XJTU ingest profile
 *
 * School:
 * - 西安交通大学 / Xi'an Jiaotong University
 *
 * Current status:
 * - UG complete: 45 rows
 * - Master complete: 99 rows
 * - PhD complete: 88 rows
 *
 * Current executable logic is still inline in:
 * - app/api/admin/schools/[school_id]/upload/route.ts
 *
 * Snapshot archive:
 * - lib/server/ingest/profiles/xjtu.generated.ts
 *
 * This file is the stable profile entrypoint for the next refactor.
 * It is intentionally not wired into upload route yet.
 */

export type XjtuDegreeKind = "ug" | "master" | "phd";

export type XjtuProfileStatus = {
  school_key: "xjtu";
  school_name_cn: "西安交通大学";
  school_name_en: "Xi'an Jiaotong University";
  completed: Record<
    XjtuDegreeKind,
    {
      status: "complete";
      rows: number;
      parser: string;
      doc_type: string;
      marker: string;
      source_hint: string;
    }
  >;
};

export const XJTU_PROFILE_STATUS: XjtuProfileStatus = {
  school_key: "xjtu",
  school_name_cn: "西安交通大学",
  school_name_en: "Xi'an Jiaotong University",
  completed: {
    ug: {
      status: "complete",
      rows: 45,
      parser: "generic_program_catalog_v1 + xjtu_ug_overrides",
      doc_type: "xjtu_ug_catalog_pdf",
      marker: "xjtu_ug_pdf_parse_status=complete",
      source_hint: "西安交大本科.pdf",
    },
    master: {
      status: "complete",
      rows: 99,
      parser: "xjtu_grad_master_catalog_v1",
      doc_type: "xjtu_grad_catalog_pdf",
      marker: "xjtu_grad_parse_status=complete;xjtu_grad_kind=master",
      source_hint: "西安交大硕博.pdf",
    },
    phd: {
      status: "complete",
      rows: 88,
      parser: "xjtu_grad_phd_catalog_v1",
      doc_type: "xjtu_grad_catalog_pdf",
      marker: "xjtu_grad_parse_status=complete;xjtu_grad_kind=phd",
      source_hint: "西安交大硕博.pdf",
    },
  },
};

export function isXjtuRawText(rawText: unknown): boolean {
  return /西安交通大学|西安交大|XJTU/i.test(String(rawText || ""));
}

export function isXjtuUgRawText(rawText: unknown): boolean {
  const raw = String(rawText || "");
  return isXjtuRawText(raw) && /本科国际学生|本科项目|本科/.test(raw);
}

export function isXjtuGradRawText(rawText: unknown): boolean {
  const raw = String(rawText || "");
  return (
    isXjtuRawText(raw) &&
    /硕博研究生国际学生|招生目录（硕士）|招生目录（博士）|硕士研究生|博士研究生/.test(raw)
  );
}

export function getXjtuExpectedRows(kind: XjtuDegreeKind): number | null {
  return XJTU_PROFILE_STATUS.completed[kind]?.rows ?? null;
}


export type XjtuGradKind = "master" | "phd";

export type XjtuTuitionGroup =
  | "理工类"
  | "人文经管类"
  | "艺术、医学类"
  | "口腔类"
  | "药学类";

export type XjtuGradTuitionInput = {
  kind: XjtuGradKind;
  faculty_cn?: string | null;
  program_name_cn?: string | null;
  degree_name_cn?: string | null;
  language_text?: string | null;
};

export function getXjtuGradTuitionGroup(input: XjtuGradTuitionInput): XjtuTuitionGroup {
  const txt = [
    input.faculty_cn,
    input.program_name_cn,
    input.degree_name_cn,
  ].map((x) => String(x || "")).join(" ");

  if (/口腔/i.test(txt)) return "口腔类";
  if (/药学/i.test(txt)) return "药学类";
  if (/医学|临床|护理|公共卫生|基础医学|艺术|设计|美术|音乐|书法/i.test(txt)) {
    return "艺术、医学类";
  }
  if (/管理|经济|金融|法学|公共管理|人文|外语|中文|教育|马克思|哲学|社会/i.test(txt)) {
    return "人文经管类";
  }
  return "理工类";
}

export function getXjtuGradTuitionRmbPerYear(
  kind: XjtuGradKind,
  languageText: string | null | undefined,
  group: XjtuTuitionGroup,
): number {
  const isPhd = kind === "phd";
  const isEn = /英文|English|en/i.test(String(languageText || ""));

  if (isPhd) {
    if (isEn) {
      if (group === "人文经管类") return 34000;
      if (group === "药学类") return 30000;
      if (group === "艺术、医学类" || group === "口腔类") return 50000;
      return 44000;
    }

    if (group === "人文经管类") return 34000;
    if (group === "艺术、医学类") return 50000;
    return 40000;
  }

  if (isEn) {
    if (group === "人文经管类") return 30000;
    if (group === "药学类") return 30000;
    if (group === "艺术、医学类" || group === "口腔类") return 50000;
    return 39000;
  }

  if (group === "人文经管类") return 30000;
  if (group === "艺术、医学类") return 50000;
  return 34000;
}

export function getXjtuGradTuitionNote(
  kind: XjtuGradKind,
  languageText: string | null | undefined,
  group: XjtuTuitionGroup,
  amount: number,
): string {
  const degree = kind === "phd" ? "博士研究生" : "硕士研究生";
  const lang = /英文|English|en/i.test(String(languageText || "")) ? "英文授课" : "中文授课";
  return `${degree}${lang}${group}：${amount.toLocaleString("en-US")} RMB/学年。`;
}

export function applyXjtuGradTuition(input: XjtuGradTuitionInput) {
  const group = getXjtuGradTuitionGroup(input);
  const amount = getXjtuGradTuitionRmbPerYear(input.kind, input.language_text, group);
  const note = getXjtuGradTuitionNote(input.kind, input.language_text, group, amount);

  return {
    tuition_group: group,
    tuition_rmb_per_year: amount,
    tuition_is_per_year: true,
    tuition_total_rmb: null,
    tuition_note: note,
  };
}


/**
 * TODO next:
 *
 * Move these executable blocks from upload route into this profile:
 *
 * UG:
 * - XJTU_UG_GUIDE_FINE_CLEAN
 * - XJTU_UG_FACULTY_REPAIR
 * - XJTU_UG_TUITION_RECALC_AFTER_FACULTY_REPAIR
 * - XJTU_UG_PDF_PARSE_COMPLETE_MARK
 *
 * Grad:
 * - XJTU_GRAD_PHD_CATALOG_PARSE
 * - XJTU_GRAD_MASTER_CATALOG_PARSE
 * - XJTU_GRAD_PHD_FACULTY_REPAIR
 * - XJTU_GRAD_MASTER_FACULTY_REPAIR
 * - XJTU_GRAD_PARSE_COMPLETE_MARK
 * - XJTU_GRAD_META_FORCE_SYNC
 */
