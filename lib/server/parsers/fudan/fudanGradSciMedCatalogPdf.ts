type DisciplineGroup = "理工科" | "医科";
type DegreeKind = "学术学位" | "专业学位" | null;

type TuitionRuleKey =
  | "academic_science"
  | "academic_medical"
  | "professional_consult_school"
  | null;

type FudanGradCatalogRow = {
  idx: number;
  faculty_cn: string | null;
  program_name_cn: string | null;
  program_name_en: string | null;
  track_name_cn: string | null;
  track_name_en: string | null;
  duration_years: number | null;
  study_mode_cn: string | null;
  degree_type: string | null;
  language_text: string | null;

  // ✅ 新增：用于后续学费 PDF 匹配
  degree_kind: DegreeKind;
  discipline_group: DisciplineGroup;
  tuition_rule_key: TuitionRuleKey;

  raw_line: string;
};

function clean(s: any) {
  return String(s ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/[（）]/g, (m) => (m === "（" ? "(" : ")"))
    .replace(/\s+/g, " ")
    .trim();
}

function restoreCnParen(s: any) {
  return String(s ?? "")
    .replace(/\(/g, "（")
    .replace(/\)/g, "）")
    .trim();
}

function stripIndex(s: string) {
  return clean(s).replace(/^\d+\s+/, "").trim();
}

function stripDegreePrefix(s: string) {
  return clean(s)
    .replace(/^（专业学位）/, "")
    .replace(/^\(专业学位\)/, "")
    .replace(/^（学术学位）/, "")
    .replace(/^\(学术学位\)/, "")
    .replace(/^（全日制）/, "")
    .replace(/^\(全日制\)/, "")
    .trim();
}

function stripDurationText(s: string) {
  return clean(s)
    .replace(/\d+(?:\.\d+)?\s*年/g, "")
    .replace(/\b\d+(?:\.\d+)?\s*years?\b/gi, "")
    .trim();
}

function parseDuration(s: string): number | null {
  const text = String(s || "");

  // 只接受“学制”意义上的 1-10 年，避免标题里的 2026年 被误判
  const m = text.match(/(?:^|\s)(\d+(?:\.\d+)?)\s*年(?:\s|$)/);
  if (!m) return null;

  const n = Number(m[1]);
  if (!Number.isFinite(n)) return null;
  if (n < 1 || n > 10) return null;

  return n;
}
function looksLikeFaculty(s: string) {
  const t = restoreCnParen(clean(s));

  if (!t) return false;
  if (t.includes("专业") || t.includes("方向") || t.includes("学制")) return false;

  return /(?:学院|研究院|中心|系|医院|实验室)$/.test(t);
}

function cleanProgramNameCn(s: any) {
  return restoreCnParen(
    stripDurationText(stripDegreePrefix(String(s || "")))
      .replace(/^全日制/, "")
      .replace(/^\s*[-—:：]\s*/, "")
      .trim(),
  );
}

function cleanTrackNameCn(s: any) {
  return restoreCnParen(
    stripDurationText(stripDegreePrefix(String(s || "")))
      .replace(/^全日制/, "")
      .replace(/^\s*[-—:：]\s*/, "")
      .trim(),
  );
}

function hasDegreeProgramMarker(s: string) {
  return (
    s.includes("（专业学位）") ||
    s.includes("(专业学位)") ||
    s.includes("（学术学位）") ||
    s.includes("(学术学位)")
  );
}

function hasFullTimeMarker(s: string) {
  return s.includes("（全日制）") || s.includes("(全日制)");
}

function normalizeLineForParse(s: string) {
  return restoreCnParen(clean(s));
}

function removeLeadingFacultyIfMixed(line: string) {
  const t = normalizeLineForParse(line);

  const m = t.match(
    /^(.{2,40}?(?:学院|研究院|中心|系|医院|实验室))\s+(.+)$/,
  );

  if (!m) {
    return {
      faculty: "",
      rest: t,
    };
  }

  return {
    faculty: clean(m[1]),
    rest: clean(m[2]),
  };
}

function extractProgramFromLine(line: string) {
  const t = normalizeLineForParse(line);

  const m = t.match(
    /（(?:专业学位|学术学位)）\s*([^\d（(]+?)(?=\s+（全日制）|\s+\d+(?:\.\d+)?年|$)/,
  );

  if (m?.[1]) {
    return cleanProgramNameCn(m[1]);
  }

  return "";
}

function extractTrackFromLine(line: string, programName: string) {
  const t = normalizeLineForParse(line);

  const m = t.match(/（全日制）\s*(.+?)(?=\s+\d+(?:\.\d+)?年|$)/);
  if (!m?.[1]) return "";

  const track = cleanTrackNameCn(m[1]);

  if (!track) return "";
  if (programName && track === programName) return "";

  return track;
}

function shouldSkipLine(line: string) {
  const t = clean(line);

  if (!t) return true;

  if (
    t.includes("序号") ||
    t.includes("院系名称") ||
    t.includes("专业名称") ||
    t.includes("专业方向") ||
    t.includes("学制")
  ) {
    return true;
  }

  if (/^[-—]+$/.test(t)) return true;

  return false;
}

// ✅ 新增：识别专业学位 / 学术学位
function detectDegreeKind(s: string): DegreeKind {
  const t = normalizeLineForParse(s);

  if (t.includes("（专业学位）")) return "专业学位";
  if (t.includes("（学术学位）")) return "学术学位";

  return null;
}

// ✅ 新增：识别理工科 / 医科
function detectDisciplineGroup(input: {
  faculty_cn?: string | null;
  program_name_cn?: string | null;
  track_name_cn?: string | null;
}): DisciplineGroup {
  const text = [
    input.faculty_cn,
    input.program_name_cn,
    input.track_name_cn,
  ]
    .filter(Boolean)
    .join(" ");

  const medicalKeywords = [
    "医学",
    "医科",
    "药学",
    "药学院",
    "护理",
    "护理学院",
    "公共卫生",
    "公共卫生学院",
    "预防医学",
    "流行病",
    "卫生统计",
    "卫生",
    "放射医学",
    "影像医学",
    "核医学",
    "神经",
    "生理",
    "病原",
    "生物医学",
    "临床",
    "疾病",
    "肿瘤",
    "免疫",
    "中西医结合",
    "基础医学院",
    "脑科学",
    "生物医药",
    "医院",
    "药物",
    "药剂",
    "药理",
    "药化",
    "营养",
    "毒理",
    "儿少",
    "妇幼",
  ];

  return medicalKeywords.some((kw) => text.includes(kw)) ? "医科" : "理工科";
}

// ✅ 新增：只生成规则 key，不直接写死学费
function buildTuitionRuleKey(input: {
  degree_kind: DegreeKind;
  discipline_group: DisciplineGroup;
}): TuitionRuleKey {
  if (input.degree_kind === "专业学位") {
    return "professional_consult_school";
  }

  if (input.degree_kind === "学术学位" && input.discipline_group === "医科") {
    return "academic_medical";
  }

  if (input.degree_kind === "学术学位" && input.discipline_group === "理工科") {
    return "academic_science";
  }

  return null;
}

export function parseFudanGradSciMedCatalogPdf(
  rawText: string,
  kind: "master" | "phd",
) {
  const text = String(rawText || "");

  const lines = text
    .split(/\n+/)
    .map(clean)
    .filter(Boolean);

  const isFudanGrad =
    text.includes("复旦大学外国留学生研究生理工医科菁英项目") &&
    text.includes("招生专业目录");

  if (!isFudanGrad) {
    return {
      ok: false,
      rows: [],
      meta: {
        parser: "fudan_grad_scimed_catalog_v4",
        reason: "not_fudan_grad_scimed_catalog",
      },
    };
  }

  const degreeType = kind === "phd" ? "博士" : "硕士";
  const rows: FudanGradCatalogRow[] = [];

  let currentFaculty = "";
  let currentProgram = "";
  let currentDuration: number | null = null;

  // ✅ 新增：学位类型也要继承，因为方向行通常不重复写“专业学位/学术学位”
  let currentDegreeKind: DegreeKind = null;

  // ✅ 关键：暂存还没学院的行。遇到学院名时，回填这些 pending rows。
  let pendingFacultyStart = 0;

  const refreshRowRules = (row: FudanGradCatalogRow) => {
    const disciplineGroup = detectDisciplineGroup({
      faculty_cn: row.faculty_cn,
      program_name_cn: row.program_name_cn,
      track_name_cn: row.track_name_cn,
    });

    row.discipline_group = disciplineGroup;
    row.tuition_rule_key = buildTuitionRuleKey({
      degree_kind: row.degree_kind,
      discipline_group: disciplineGroup,
    });
  };

  const flushPendingFaculty = (faculty: string) => {
    const f = clean(faculty);
    if (!f) return;

    for (let i = pendingFacultyStart; i < rows.length; i++) {
      if (!rows[i].faculty_cn) {
        rows[i].faculty_cn = f;
        refreshRowRules(rows[i]);
      }
    }

    pendingFacultyStart = rows.length;
  };

  for (const rawLine of lines) {
    if (shouldSkipLine(rawLine)) continue;

    let line = normalizeLineForParse(rawLine);

    if (line.includes("（学术学位）") || line.includes("(学术学位)")) {
      currentDegreeKind = "学术学位";
    } else if (line.includes("（专业学位）") || line.includes("(专业学位)")) {
      currentDegreeKind = "专业学位";
    }

    const duration = parseDuration(line);

    if (duration != null) {
      currentDuration = duration;
    }

    line = stripIndex(line);

    const mixed = removeLeadingFacultyIfMixed(line);
    if (mixed.faculty) {
      currentFaculty = mixed.faculty;
      flushPendingFaculty(currentFaculty);
      line = mixed.rest;
    }

    if (looksLikeFaculty(line)) {
      currentFaculty = line;
      flushPendingFaculty(currentFaculty);
      continue;
    }

    const degreeKindFromLine = detectDegreeKind(line);
    if (degreeKindFromLine) {
      currentDegreeKind = degreeKindFromLine;
    }

    const hasProgram = hasDegreeProgramMarker(line);
    const hasTrack = hasFullTimeMarker(line);

    let programName = "";

    if (hasProgram) {
      programName = extractProgramFromLine(line);
      if (programName) {
        currentProgram = programName;
      }
    }

    const trackName = hasTrack
      ? extractTrackFromLine(line, currentProgram || programName)
      : "";

    if (!currentProgram && !trackName) continue;

    const finalProgramName = cleanProgramNameCn(currentProgram || programName);

    if (!finalProgramName && !trackName) continue;

    const rowFaculty = currentFaculty || null;
    const rowProgram = finalProgramName || null;
    const rowTrack = trackName || null;

    const disciplineGroup = detectDisciplineGroup({
      faculty_cn: rowFaculty,
      program_name_cn: rowProgram,
      track_name_cn: rowTrack,
    });

    const tuitionRuleKey = buildTuitionRuleKey({
      degree_kind: currentDegreeKind,
      discipline_group: disciplineGroup,
    });

    rows.push({
      idx: rows.length + 1,
      faculty_cn: rowFaculty,
      program_name_cn: rowProgram,
      program_name_en: null,
      track_name_cn: rowTrack,
      track_name_en: null,
      duration_years: currentDuration,
      study_mode_cn: "全日制",
      degree_type: degreeType,
      language_text: "中文",

      degree_kind: currentDegreeKind,
      discipline_group: disciplineGroup,
      tuition_rule_key: tuitionRuleKey,

      raw_line: rawLine,
    });
  }

  rows.forEach((r, i) => {
    r.idx = i + 1;
    refreshRowRules(r);
  });

  return {
    ok: rows.length > 0,
    rows,
    meta: {
      parser: "fudan_grad_scimed_catalog_v4",
      doc_type: "fudan_grad_scimed_catalog",
      rows: rows.length,
      kind,
    },
  };
}