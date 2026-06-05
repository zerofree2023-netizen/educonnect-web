export type ReviewIssue = {
  school_id: string;
  school_name_cn?: string | null;
  kind?: string | null;
  degree_level?: string | null;
  program_key?: string | null;
  major_code?: string | null;
  program_name_cn?: string | null;
  program_name_en?: string | null;
  track_name_cn?: string | null;
  issue_type: string;
  severity?: "info" | "warning" | "error";
  field_name?: string | null;
  current_value?: any;
  candidate_values?: any;
  evidence?: any;
  status?: "open" | "resolved" | "ignored";
  note?: string | null;
  source_url?: string | null;
  file_id?: string | null;
};

function s(x: any) {
  return String(x ?? "").trim();
}

function hasChinese(x: any) {
  return /[\u4e00-\u9fff]/.test(s(x));
}

function toNum(x: any): number | null {
  if (x === null || x === undefined || x === "") return null;
  const n = Number(String(x).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

export function buildProgramKey(row: any) {
  const cleanPart = (x: any) =>
    String(x ?? "")
      .replace(/\s+/g, " ")
      .trim();

  const dept = cleanPart(row?.dept_code);
  const major = cleanPart(row?.major_code);
  const track = cleanPart(row?.track_code);

  const cn = cleanPart(row?.program_name_cn);
  const en = cleanPart(row?.program_name_en);
  const duration = cleanPart(row?.duration_years);

  const lang = cleanPart(
    row?.study_language ||
      row?.language_text ||
      row?.teaching_language ||
      "",
  );

  // 培养/授课模式：用于区分同一专业代码下不同项目
  // 例如 NJU 055200：
  // 新闻与传播（中外学生同班） / 3年 / 25000
  // 新闻与传播（国际学生班） / 2年 / 30000
  const mode = cleanPart(
    row?.training_mode_cn ||
      row?.teaching_mode_cn ||
      row?.class_mode_cn ||
      row?.remarks_text ||
      row?.remarks ||
      row?.tuition_note ||
      "",
  );

  const name = cn || en;

  if (dept && major && track) return `${dept}:${major}:${track}`;

  // 核心：同一 major_code 允许多个项目实例
  if (major && name && duration && lang) {
    return `${major}:${name}:${duration}:${lang}`;
  }

  if (major && name && duration) {
    return `${major}:${name}:${duration}`;
  }

  if (major && name) {
    return `${major}:${name}`;
  }

  if (major && track) return `${major}:${track}`;
  if (dept && major) return `${dept}:${major}`;
  if (major) return major;

  return name || "";
}

export function generateProgramReviewIssues(args: {
  schoolId: string;
  schoolNameCn?: string | null;
  kind?: string | null;
  rows: any[];
  meta?: any;
  fileId?: string | null;
}) {
  const {
    schoolId,
    schoolNameCn = null,
    kind = null,
    rows,
    meta = {},
    fileId = null,
  } = args;

  const issues: ReviewIssue[] = [];
  const seenKey = new Map<string, any[]>();

  for (const row of rows || []) {
    const programKey = buildProgramKey(row);
    const majorCode = s(row?.major_code);
    const programNameCn = s(row?.program_name_cn);
    const programNameEn = s(row?.program_name_en);
    const trackNameCn = s(row?.track_name_cn);

    const base = {
      school_id: schoolId,
      school_name_cn: schoolNameCn,
      kind: s(row?.kind) || kind,
      degree_level: s(row?.degree_level) || null,
      program_key: programKey || null,
      major_code: majorCode || null,
      program_name_cn: programNameCn || null,
      program_name_en: programNameEn || null,
      track_name_cn: trackNameCn || null,
      source_url: s(row?.source_url) || s(meta?.source_url) || null,
      file_id: fileId,
      status: "open" as const,
    };

    if (programKey) {
      const arr = seenKey.get(programKey) || [];
      arr.push(row);
      seenKey.set(programKey, arr);
    }

    if (!programNameCn && !programNameEn) {
      issues.push({
        ...base,
        issue_type: "missing_program_name",
        severity: "error",
        field_name: "program_name_cn",
        current_value: row,
        note: "专业中文和专业英文都为空，无法展示或匹配。",
      });
    }

    if (!s(row?.faculty_cn) && !s(row?.faculty)) {
      issues.push({
        ...base,
        issue_type: "missing_faculty",
        severity: "warning",
        field_name: "faculty_cn",
        current_value: row?.faculty_cn ?? row?.faculty ?? null,
        note: "学院为空，建议人工确认。",
      });
    }

    if (programNameEn && hasChinese(programNameEn)) {
      issues.push({
        ...base,
        issue_type: "program_en_contains_chinese",
        severity: "warning",
        field_name: "program_name_en",
        current_value: programNameEn,
        note: "专业英文里包含中文，可能是字段错位或未清洗。",
      });
    }

    const tuitionYear = toNum(row?.tuition_rmb_per_year);
    const tuitionTotal = toNum(row?.tuition_total_rmb);

    const isPhdRow =
      String(base.kind || "").toLowerCase() === "phd" ||
      String(row?.degree_type || "").includes("博士");

    if (isPhdRow && tuitionYear == null && tuitionTotal == null) {
      issues.push({
        ...base,
        issue_type: "phd_missing_tuition",
        severity: "info",
        field_name: "tuition_rmb_per_year",
        current_value: null,
        note: "博士项目暂无结构化学费，建议后续用收费PDF或项目详情页补全。",
      });
    }

    if (
      isPhdRow &&
      !s(row?.language_text) &&
      !s(row?.study_language) &&
      !s(row?.language)
    ) {
      issues.push({
        ...base,
        issue_type: "phd_missing_language",
        severity: "warning",
        field_name: "language_text",
        current_value: null,
        note: "博士项目授课语言为空，建议从目录行或详情页补全。",
      });
    }

    if (isPhdRow && !s(row?.study_mode_cn) && !s(row?.study_mode_en)) {
      issues.push({
        ...base,
        issue_type: "phd_missing_study_mode",
        severity: "info",
        field_name: "study_mode_cn",
        current_value: null,
        note: "博士项目学习方式为空，如官方未写可忽略；如有详情页建议补全。",
      });
    }

    const tuitionText = [
      row?.tuition_note,
      row?.remarks,
      row?.remarks_text,
      row?.raw_line,
    ]
      .map(s)
      .filter(Boolean)
      .join("\n");

    if (
      tuitionYear == null &&
      tuitionTotal == null &&
      /(学费|收费|元\/年|元\/学年|RMB|人民币)/i.test(tuitionText)
    ) {
      issues.push({
        ...base,
        issue_type: "tuition_text_not_structured",
        severity: "warning",
        field_name: "tuition_rmb_per_year",
        current_value: null,
        evidence: {
          tuition_text: tuitionText.slice(0, 800),
        },
        note: "文本里疑似有学费信息，但结构化学费字段为空。",
      });
    }

    const duration = toNum(row?.duration_years);
    if (duration != null && (duration < 1 || duration > 8)) {
      issues.push({
        ...base,
        issue_type: "abnormal_duration",
        severity: "warning",
        field_name: "duration_years",
        current_value: duration,
        note: "学制年限异常，建议复查。",
      });
    }

    if (s(row?.faculty_cn) && s(row?.faculty_cn) === s(row?.program_name_cn)) {
      issues.push({
        ...base,
        issue_type: "faculty_equals_program_name",
        severity: "warning",
        field_name: "faculty_cn",
        current_value: row?.faculty_cn,
        note: "学院名和专业名相同，可能字段错位。",
      });
    }
  }

  for (const [programKey, sameRows] of seenKey.entries()) {
    if (sameRows.length <= 1) continue;

    const names = Array.from(
      new Set(
        sameRows
          .map((r) => s(r?.program_name_cn) || s(r?.program_name_en))
          .filter(Boolean),
      ),
    );

    const tuitions = Array.from(
      new Set(
        sameRows
          .map((r) => toNum(r?.tuition_rmb_per_year))
          .filter((x) => x != null)
          .map(String),
      ),
    );

    if (names.length > 1) {
      const first = sameRows[0] || {};
      issues.push({
        school_id: schoolId,
        school_name_cn: schoolNameCn,
        kind: s(first?.kind) || kind,
        program_key: programKey,
        major_code: s(first?.major_code) || null,
        program_name_cn: s(first?.program_name_cn) || null,
        issue_type: "same_key_multiple_names",
        severity: "warning",
        field_name: "program_name_cn",
        candidate_values: names,
        evidence: sameRows,
        status: "open",
        source_url: s(meta?.source_url) || null,
        file_id: fileId,
        note: "同一个 program_key 出现多个专业名称，可能需要拆分研究方向或修正 key。",
      });
    }

    if (tuitions.length > 1) {
      const first = sameRows[0] || {};
      issues.push({
        school_id: schoolId,
        school_name_cn: schoolNameCn,
        kind: s(first?.kind) || kind,
        program_key: programKey,
        major_code: s(first?.major_code) || null,
        program_name_cn: s(first?.program_name_cn) || null,
        issue_type: "same_key_multiple_tuitions",
        severity: "warning",
        field_name: "tuition_rmb_per_year",
        candidate_values: tuitions.map(Number),
        evidence: sameRows,
        status: "open",
        source_url: s(meta?.source_url) || null,
        file_id: fileId,
        note: "同一个 program_key 出现多个学费值，需要人工确认。",
      });
    }
  }

  return issues;
}
