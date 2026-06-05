/**
 * BUAA ingest profile
 *
 * School:
 * - 北京航空航天大学 / Beihang University
 *
 * Current target:
 * - UG official HTML page:
 *   https://is.buaa.edu.cn/lxsq/bks1.htm
 *
 * Current status:
 * - UG first generic parse failed semantically:
 *   generic parser produced 14 noisy rows from guide text.
 *
 * Official page sections:
 * - 一、申请资格
 * - 二、录取审核时间安排
 * - 三、申请步骤
 * - 四、学制及费用
 * - 五、奖学金
 * - 六、专业目录
 */

export type BuaaDegreeKind = "ug" | "master" | "phd";

export const BUAA_PROFILE_STATUS = {
  school_key: "buaa",
  school_name_cn: "北京航空航天大学",
  school_name_en: "Beihang University",
  completed: {},
  in_progress: {
    ug: {
      status: "needs_school_parser",
      reason: "generic_program_catalog_v1 captured guide text as noisy catalog rows",
      source_url: "https://is.buaa.edu.cn/lxsq/bks1.htm",
    },
  },
} as const;

export function isBuaaRawText(rawText: unknown): boolean {
  return /北京航空航天大学|北航|Beihang|BUAA/i.test(String(rawText || ""));
}

export function isBuaaUgOfficialHtml(rawText: unknown): boolean {
  const raw = String(rawText || "");
  return (
    isBuaaRawText(raw) &&
    /国际本科生|本科生/.test(raw) &&
    /专业目录/.test(raw) &&
    /中文授课专业|英文授课专业/.test(raw)
  );
}

export const BUAA_UG_OFFICIAL_POLICY = {
  duration_years: 4,
  application_fee_rmb: 400,
  application_time_text:
    "申请开始日期：2025年11月1日；申请截止日期：2026年6月30日；正式录取日期：2026年7月；入学日期：2026年9月。",
  tuition: {
    chinese_science_engineering_business_law_rmb_per_year: 25000,
    chinese_biomedical_and_art_rmb_per_year: 30000,
    english_all_programs_rmb_per_year: 30000,
  },
  accommodation_fee_note:
    "北京校区双人间30元/床位/天；杭州国际校园双人间2000-2500元/学年。住宿需提前预定，费用以实际入住宿舍为准，不含水电费。",
  application_portal_text: "http://admission.buaa.edu.cn/",
  contact_email: "undergraduate@buaa.edu.cn",
  contact_phone: "+86-10-82339158; +86-10-82339331; +86-10-82316488",
} as const;

export function getBuaaUgTuitionRmbPerYear(languageText: string, tuitionGroup: string): number {
  if (/英文|English|en/i.test(String(languageText || ""))) return 30000;
  if (/生物|医学|艺术|设计|绘画/i.test(String(tuitionGroup || ""))) return 30000;
  return 25000;
}

export function getBuaaUgTuitionNote(languageText: string, tuitionGroup: string, amount: number): string {
  if (/英文|English|en/i.test(String(languageText || ""))) {
    return `英文授课项目所有专业：${amount.toLocaleString("en-US")} RMB/年。`;
  }
  return `中文授课${tuitionGroup}专业：${amount.toLocaleString("en-US")} RMB/年。`;
}
