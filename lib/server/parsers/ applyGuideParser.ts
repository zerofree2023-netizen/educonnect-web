type ApplyGuideParsed = {
  ok: boolean;
  title: string | null;
  year: number | null;
  school_name_cn: string | null;
  degree_levels: string[];
  study_languages: string[];
  application_periods: Array<{
    label: string | null;
    start_date: string | null;
    end_date: string | null;
    raw_text: string;
  }>;
  admission_requirements: string[];
  application_materials: string[];
  tuition_text: string | null;
  scholarship_text: string | null;
  contact_text: string | null;
  source_sections: Record<string, string>;
  meta: {
    parser: "apply_guide_parser_v1";
  };
};