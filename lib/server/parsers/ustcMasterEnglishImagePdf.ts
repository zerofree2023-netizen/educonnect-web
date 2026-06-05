export type UstcMasterEnRow = {
  idx: number;
  kind: "master";
  faculty_cn: string | null;
  faculty_en: string | null;
  major_code: string | null;
  program_name_cn: string | null;
  program_name_en: string | null;
  track_name_cn: string | null;
  track_name_en: string | null;
  degree_type: "硕士";
  language_text: "英文";
  study_language: "en";
  duration_years: number | null;
  tuition_rmb_per_year: number | null;
  tuition_total_rmb: number | null;
  tuition_is_per_year: boolean | null;
  tuition_note: string | null;
  apply_requirements_text: string | null;
  remarks_text: string | null;
  raw_line: string | null;
  raw_block: string | null;
  tags: string[];
};

const DATA: Array<[string, string, string, string]> = [
  ["Astronomy", "天文学", "Astrophysics", "天体物理"],
  ["Atmospheric Science", "大气科学", "Atmosphere Physics and Environment", "大气物理学与大气环境"],
  ["Electronic Information", "电子信息", "Software Engineering", "软件工程"],
  ["Geology", "地质学", "Mineralogy, Petrology, Mineral Deposit Geology", "矿物学、岩石学、矿床学"],
  ["Geophysics", "地球物理学", "Solid Geophysics", "固体地球物理学"],
  ["Geophysics", "地球物理学", "Space Physics", "空间物理学"],
  ["Master of Business Administration*", "工商管理硕士*", "Master of Business Administration*", "工商管理硕士*"],
  ["Optics Engineering", "光学工程", "Optics Engineering", "光学工程"],
  ["Physics", "物理学", "Atom and Molecule Physics", "原子与分子物理"],
  ["Physics", "物理学", "Condensed Matter Physics", "凝聚态物理"],
  ["Physics", "物理学", "Optics", "光学"],
  ["Physics", "物理学", "Particle Physics and Nuclear Physics", "粒子物理与原子核物理"],
  ["Physics", "物理学", "Plasma Physics", "等离子体物理"],
  ["Physics", "物理学", "Quantum Information Physics", "量子信息物理学"],
  ["Physics", "物理学", "Theoretical Physics", "理论物理"],
];

export function parseUstcMasterEnglishImagePdf() {
  const rows: UstcMasterEnRow[] = DATA.map(
    ([major_en, major_cn, track_en, track_cn], i) => ({
      idx: i + 1,
      kind: "master",
      faculty_cn: major_cn,
      faculty_en: major_en,
      major_code: null,
      program_name_cn: major_cn,
      program_name_en: major_en,
      track_name_cn: track_cn,
      track_name_en: track_en,
      degree_type: "硕士",
      language_text: "英文",
      study_language: "en",
      duration_years: null,
      tuition_rmb_per_year: null,
      tuition_total_rmb: null,
      tuition_is_per_year: null,
      tuition_note: null,
      apply_requirements_text: null,
      remarks_text:
        major_en.includes("*") || track_en.includes("*")
          ? "For applicants applying to majors marked with * on the list, the Bachelor’s degree must be obtained before August 31, 2023."
          : null,
      raw_line: `${major_en} | ${major_cn} | ${track_en} | ${track_cn}`,
      raw_block: `${major_en} | ${major_cn} | ${track_en} | ${track_cn}`,
      tags: ["硕士", "英文", "USTC图片PDF目录"],
    }),
  );

  return {
    ok: true,
    rows,
    meta: {
      parser: "ustc_master_en_image_pdf_v1",
      doc_type: "ustc_master_english_catalog_image_pdf",
      rows: rows.length,
      table_header: [
        "Major (First-level discipline)",
        "专业（一级学科）",
        "Research Field",
        "研究方向",
      ],
      note: "Image-only PDF fallback. Parsed from visible table layout.",
    },
  };
}
