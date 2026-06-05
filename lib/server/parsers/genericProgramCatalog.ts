export type GenericProgramCatalogRow = {
  idx: number;
  kind: string;
  faculty_cn: string | null;
  faculty_en: string | null;
  major_code: string | null;
  program_name_cn: string | null;
  program_name_en: string | null;
  degree_type: string | null;
  degree_kind: string | null;
  degree_name_cn: string | null;
  language_text: string | null;
  study_language: string | null;
  duration_years: number | null;
  remarks_text: string | null;
  raw_line: string | null;
  raw_block: string | null;
  tags: string[];
};

function norm(s: any) {
  return String(s || "")
    .replace(/\u00a0/g, " ")
    .replace(/\t/g, " ")
    .replace(/\r/g, "\n")
    .replace(/[ \f]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function cleanCn(s: string | null) {
  if (!s) return null;
  return s
    .replace(/^★+/, "")
    .replace(/（修改）/g, "")
    .replace(/\(修改\)/g, "")
    .replace(/\s+/g, "")
    .trim() || null;
}

function cleanEn(s: string | null) {
  if (!s) return null;
  return s
    .replace(/\b修改\b/gi, "")
    .replace(/\s+/g, " ")
    .trim() || null;
}

function splitCnEn(s: string): { cn: string | null; en: string | null } {
  const t = norm(s);
  if (!t) return { cn: null, en: null };

  const cn = (t.match(/[\u4e00-\u9fff（）()·、，：；\-—★\s]+/g) || [])
    .join("")
    .replace(/\s+/g, "")
    .trim();

  const en = t
    .replace(/[\u4e00-\u9fff]/g, " ")
    .replace(/[（）]/g, " ")
    .replace(/★/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return {
    cn: cleanCn(cn),
    en: cleanEn(en),
  };
}

function parseDuration(s: string): number | null {
  const t = norm(s).toLowerCase();

  const m =
    t.match(/(\d+(?:\.\d+)?)\s*年/) ||
    t.match(/(\d+(?:\.\d+)?)\s*years?/i) ||
    t.match(/\b(two|three|four|five|six)\s+years?\b/i);

  if (!m) return null;

  const raw = String(m[1]).toLowerCase();
  if (raw === "two") return 2;
  if (raw === "three") return 3;
  if (raw === "four") return 4;
  if (raw === "five") return 5;
  if (raw === "six") return 6;

  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function inferDegreeType(kind: string, raw: string) {
  const k = String(kind || "").toLowerCase();
  const t = norm(raw);

  if (k === "ug" || /本科|Bachelor|Undergraduate/i.test(t)) return "本科";
  if (k === "master" || /硕士|Master/i.test(t)) return "硕士";
  if (k === "phd" || /博士|Doctor|PhD|Doctoral/i.test(t)) return "博士";
  if (k === "other" || /非学位|Non-degree/i.test(t)) return "非学位";

  return null;
}

function inferLanguage(raw: string, fallback?: string | null) {
  const t = norm(raw);
  const f = String(fallback || "").toLowerCase();

  if (/英文授课|英语授课|English[- ]?taught|授课语言\s*英文|英文\s+\d/.test(t) || f === "en") {
    return { language_text: "英文", study_language: "en" };
  }

  if (/中文授课|Chinese[- ]?taught|授课语言\s*中文|中文\s+\d/.test(t) || f === "zh") {
    return { language_text: "中文", study_language: "zh" };
  }

  if (/英文|English/.test(t) && !/中文|Chinese/.test(t)) {
    return { language_text: "英文", study_language: "en" };
  }

  if (/中文|Chinese/.test(t) && !/英文|English/.test(t)) {
    return { language_text: "中文", study_language: "zh" };
  }

  return { language_text: null, study_language: null };
}

function isHeaderOrJunk(s: string) {
  const t = norm(s);
  if (!t) return true;

  if (/附件|Attachment|Available to International Applicants|招生专业列表|招生专业目录/i.test(t)) return true;
  if (/^(学院|School|专业|Programs?|项目|Program|学制|Duration|备注|Note|文科|理工科|医学类|Liberal Arts|Science and Engineering|Medicine)$/i.test(t)) return true;
  if (/For more information|如需详情|admission\./i.test(t)) return true;

  return false;
}

function looksLikeFaculty(s: string) {
  const t = norm(s);
  if (!t || isHeaderOrJunk(t)) return false;
  if (parseDuration(t)) return false;

  return /学院|学部|研究院|实验室|医学部|临床学院|医院|中心|College|School|Faculty|Institute|Academy|Department|Hospital|Laboratory|Economics and Management/i.test(t)
    && !/专业学位|professional degree|academic degree|Bachelor|Master of|Doctor/i.test(t);
}

function looksLikeProgramCandidate(s: string) {
  const t = norm(s);
  if (!t || isHeaderOrJunk(t)) return false;
  if (looksLikeFaculty(t)) return false;

  const hasCn = /[\u4e00-\u9fff]/.test(t);
  const hasEn = /[A-Za-z]/.test(t);

  if (!hasCn && !hasEn) return false;
  if (/^(http|www\.|邮箱|电话|地址|申请|材料|流程|奖学金|费用)/i.test(t)) return false;

  return true;
}

function degreeKindFromText(s: string) {
  const t = norm(s);
  if (/专业学位|professional degree/i.test(t)) return "专业学位";
  if (/学术学位|academic degree/i.test(t)) return "学术学位";
  return null;
}

function degreeNameFromText(s: string) {
  const t = norm(s);
  const m = t.match(/(文学学士|理学学士|工学学士|医学学士|法学学士|管理学学士|经济学学士|哲学学士|艺术学学士|教育学学士|硕士|博士)/);
  return m?.[1] || null;
}

function normalizeTableTextForGenericCatalog(raw: string) {
  let t = norm(raw);

  // 删除常见表头，避免 “学院 项目 授课语言...” 被当成 faculty/program。
  t = t.replace(/学院\/部\s+项目\s+授课语言\s+学制\s+授予学位类型/g, " ");
  t = t.replace(/学院\s+项目\s+授课语言\s+授予学位类型\s+学制/g, " ");
  t = t.replace(/学院\s+项目\s+授课语言\s+学制\s+授予学位类型/g, " ");
  t = t.replace(/School\s+Programs?\s+Language\s+Duration/gi, " ");

  // 在常见学院/部/医院/学院英文 School 前切行，降低 PDF 串行文本粘连。
  t = t.replace(
    /(医学部|国际教育学院|材料科学与工程学院|电气工程学院|机械工程学院|能源与动力工程学院|法学院|公共政策与管理学院|管理学院|化学学院|经济与金融学院|人居环境与建筑工程学院|人文社会科学学院|生命科学与技术学院|外国语学院|新闻与新媒体学院|化学工程与技术学院|仪器科学与技术学院|电信学部)/g,
    "\n$1",
  );

  // 在 “学士/硕士/博士 + 学院名” 之间切行。
  t = t.replace(/(学士|硕士|博士)\s+(?=(医学部|国际教育学院|材料科学与工程学院|电气工程学院|机械工程学院|能源与动力工程学院|法学院|公共政策与管理学院|管理学院|化学学院|经济与金融学院|人居环境与建筑工程学院|人文社会科学学院|生命科学与技术学院|外国语学院|新闻与新媒体学院|化学工程与技术学院|仪器科学与技术学院|电信学部))/g, "$1\n");

  return t;
}


function buildProgramFromLookback(lines: string[], durationIndex: number) {
  const parts: string[] = [];

  for (let j = durationIndex - 1; j >= Math.max(0, durationIndex - 6); j--) {
    const x = norm(lines[j]);
    if (!x || isHeaderOrJunk(x)) continue;
    if (parseDuration(x)) continue;
    if (looksLikeFaculty(x)) break;

    if (looksLikeProgramCandidate(x)) parts.unshift(x);

    const joined = parts.join(" ");
    if (/[\u4e00-\u9fff]/.test(joined) && /[A-Za-z]/.test(joined)) break;
  }

  const raw = norm(parts.join(" "));
  const { cn, en } = splitCnEn(raw);

  return {
    raw,
    cn,
    en,
    degree_kind: degreeKindFromText(raw),
    degree_name_cn: degreeNameFromText(raw),
  };
}


function isBadGenericCatalogRow(r: any) {
  const faculty = String(r?.faculty_cn || "");
  const program = String(r?.program_name_cn || "");
  const facultyEn = String(r?.faculty_en || "");
  const programEn = String(r?.program_name_en || "");
  const raw = `${faculty} ${program} ${facultyEn} ${programEn}`;

  if (/部项目|授课语言|授予学位类型|学院项目|项目授课语言|学制授予学位/.test(raw)) return true;
  if (/^(医学学士|工学学士|文学学士|理学学士|管理学学士|经济学学士|法学学士|艺术学学士|哲学学士)$/.test(faculty)) return true;
  if (!String(r?.program_name_cn || r?.program_name_en || "").trim()) return true;
  if (!r?.duration_years) return true;

  return false;
}

function cleanGenericCatalogRows(rows: GenericProgramCatalogRow[]) {
  return (Array.isArray(rows) ? rows : [])
    .filter((r: any) => !isBadGenericCatalogRow(r))
    .map((r: any, i: number) => ({
      ...(r || {}),
      idx: i + 1,
    }));
}


function extractInlineTableRows(rawText: string, kind: string, filename?: string | null) {
  let text = String(rawText || "")
    .replace(/\u00a0/g, " ")
    .replace(/\r/g, "\n")
    .replace(/[ \f]+/g, " ")
    .replace(/\n+/g, "；")
    .trim();

  text = text
    .replace(/；/g, ";")
    .replace(/学院\/部\s*项目\s*授课语言\s*学制\s*授予学位类型/g, ";")
    .replace(/学院\s*项目\s*授课语言\s*授予学位类型\s*学制/g, ";")
    .replace(/学院\s*项目\s*授课语言\s*学制\s*授予学位类型/g, ";");

  const rows: GenericProgramCatalogRow[] = [];

  const facultyNames = [
    "医学部",
    "国际教育学院",
    "材料科学与工程学院",
    "电气工程学院",
    "机械工程学院",
    "能源与动力工程学院",
    "法学院",
    "公共政策与管理学院",
    "管理学院",
    "化学学院",
    "经济与金融学院",
    "人居环境与建筑工程学院",
    "人文社会科学学院",
    "生命科学与技术学院",
    "外国语学院",
    "新闻与新媒体学院",
    "化学工程与技术学院",
    "仪器科学与技术学院",
    "电信学部",
  ];

  const isFacultyOnly = (s: string) => {
    const t = norm(s).replace(/[;；:：]/g, "").trim();
    return facultyNames.includes(t);
  };

  const detectFacultyPrefix = (s: string) => {
    const t = norm(s);
    const found = facultyNames
      .filter((f) => t.startsWith(f) && t.length > f.length)
      .sort((a, b) => b.length - a.length)[0];
    return found || null;
  };

  const addRow = (
    facultyRaw: string,
    programRaw: string,
    langRaw: string,
    degreeRaw: string,
    durationRaw: string,
    rawLine: string,
  ) => {
    facultyRaw = norm(facultyRaw);
    programRaw = norm(programRaw);
    langRaw = norm(langRaw);
    degreeRaw = norm(degreeRaw);
    durationRaw = norm(durationRaw);

    if (facultyRaw && programRaw.startsWith(facultyRaw)) {
      programRaw = norm(programRaw.slice(facultyRaw.length));
    }

    programRaw = programRaw
      .replace(/^★+/, "")
      .replace(/\s*(中文|英文|Chinese|English)\s*$/i, "")
      .replace(/^项目\s*/i, "")
      .trim();

    if (!facultyRaw || !programRaw || !durationRaw) return;
    if (/授课语言|学制|授予学位|项目|专业|列表|目录/.test(facultyRaw + programRaw)) return;

    const fac = splitCnEn(facultyRaw);
    const prog = splitCnEn(programRaw);
    const lang = inferLanguage(langRaw);
    const duration = parseDuration(durationRaw);

    if (!duration || (!prog.cn && !prog.en)) return;
    if (!fac.cn && !fac.en) return;

    const row: GenericProgramCatalogRow = {
      idx: rows.length + 1,
      kind,
      faculty_cn: fac.cn,
      faculty_en: fac.en,
      major_code: null,
      program_name_cn: prog.cn,
      program_name_en: prog.en,
      degree_type: inferDegreeType(kind, text),
      degree_kind: degreeKindFromText(programRaw + " " + degreeRaw),
      degree_name_cn: degreeNameFromText(degreeRaw),
      language_text: lang.language_text,
      study_language: lang.study_language,
      duration_years: duration,
      remarks_text: degreeKindFromText(programRaw + " " + degreeRaw),
      raw_line: rawLine,
      raw_block: rawLine,
      tags: [inferDegreeType(kind, text) || kind, lang.language_text || "", "GENERIC目录"].filter(Boolean),
    };

    if (!isBadGenericCatalogRow(row)) rows.push(row);
  };

  const tokens = text
    .split(/[;\n]+/g)
    .map((x) => norm(x))
    .filter(Boolean);

  if (/西安交通大学|XJTU|本科国际学生/.test(text)) {
    console.log("[GENERIC_PROGRAM_TOKEN_DEBUG]", {
      tokenCount: tokens.length,
      sample: tokens.slice(0, 80),
    });
  }

  let currentFaculty: string | null = null;

  for (const token0 of tokens) {
    let token = norm(token0);
    if (!token) continue;

    if (isFacultyOnly(token)) {
      currentFaculty = token.replace(/[;；:：]/g, "").trim();
      continue;
    }

    const prefixFaculty = detectFacultyPrefix(token);
    if (prefixFaculty) {
      currentFaculty = prefixFaculty;
      token = norm(token.slice(prefixFaculty.length));
    }

    if (!currentFaculty) continue;

    // A: 临床医学MBBS 英文 6年 医学学士
    let m = token.match(/^(.+?)\s+(中文|英文|Chinese|English)\s+(\d+(?:\.\d+)?\s*年|\d+(?:\.\d+)?\s*Years?)\s+(.+?学士|.+?Bachelor.*?)$/i);
    if (m) {
      addRow(currentFaculty, m[1], m[2], m[4], m[3], `${currentFaculty} ${token}`);
      continue;
    }

    // B: 汉语言（商务汉语） 中文 文学学士 4年
    m = token.match(/^(.+?)\s+(中文|英文|Chinese|English)\s+(.+?学士|.+?Bachelor.*?)\s+(\d+(?:\.\d+)?\s*年|\d+(?:\.\d+)?\s*Years?)$/i);
    if (m) {
      addRow(currentFaculty, m[1], m[2], m[3], m[4], `${currentFaculty} ${token}`);
      continue;
    }

    // C: 汉语言（商务汉语） 中文 文学学士4年
    m = token.match(/^(.+?)\s+(中文|英文|Chinese|English)\s+(.+?学士)\s*(\d+(?:\.\d+)?\s*年)$/i);
    if (m) {
      addRow(currentFaculty, m[1], m[2], m[3], m[4], `${currentFaculty} ${token}`);
      continue;
    }
  }

  return cleanGenericCatalogRows(rows);
}


export function parseGenericProgramCatalog(rawText: string, opts?: {
  kind?: string;
  filename?: string | null;
  fallbackLanguage?: "zh" | "en" | null;
}) {
  const kind = String(opts?.kind || "").toLowerCase() || "ug";
  const text = norm(rawText);
  const lines = text
    .split(/\n+/g)
    .map((x) => norm(x))
    .filter(Boolean);

  const rows: GenericProgramCatalogRow[] = [];

  const inlineRows = extractInlineTableRows(text, kind, opts?.filename || null);
  rows.push(...inlineRows);

  // 如果通用表格行解析已经抓到较多结果，说明这是结构化表格。
  // 此时不要再走 lookback 模式，避免 PDF 串行文本把学院/专业拼坏。
  if (inlineRows.length >= 5) {
    const seenInline = new Map<string, GenericProgramCatalogRow>();
    for (const r of inlineRows) {
      const key = [
        r.kind || "",
        r.study_language || r.language_text || "",
        r.faculty_cn || "",
        r.faculty_en || "",
        r.program_name_cn || "",
        r.program_name_en || "",
        r.duration_years || "",
      ].join("@@");

      if (!key.replace(/@/g, "").trim()) continue;
      if (!seenInline.has(key)) seenInline.set(key, r);
    }

    const finalInlineRows = Array.from(seenInline.values())
      .filter((r) => {
        const faculty = String(r.faculty_cn || "");
        const program = String(r.program_name_cn || "");
        const raw = `${faculty} ${program}`;

        if (/部项目|授课语言|授予学位类型|学院项目/.test(raw)) return false;
        if (/^(医学学士|工学学士|文学学士|理学学士|管理学学士|经济学学士|法学学士|艺术学学士)$/.test(faculty)) return false;
        if (!String(r.program_name_cn || r.program_name_en || "").trim()) return false;
        if (!r.duration_years) return false;

        return true;
      })
      .map((r, i) => ({
        ...r,
        idx: i + 1,
      }));

    return {
      ok: cleanGenericCatalogRows(finalInlineRows).length > 0,
      rows: cleanGenericCatalogRows(finalInlineRows),
      meta: {
        parser: "generic_program_catalog_v1",
        doc_type: "generic_program_catalog",
        rows: finalInlineRows.length,
        kind,
        filename: opts?.filename || null,
        mode: "inline_table",
        raw_preview: text.slice(0, 500),
      },
    };
  }

  let currentFacultyCn: string | null = null;
  let currentFacultyEn: string | null = null;
  let currentLanguage = inferLanguage(`${opts?.filename || ""} ${text.slice(0, 800)}`, opts?.fallbackLanguage || null);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (isHeaderOrJunk(line)) continue;

    const lineLang = inferLanguage(line);
    if (lineLang.study_language) currentLanguage = lineLang;

    if (looksLikeFaculty(line)) {
      const joined =
        i + 1 < lines.length && /^[A-Za-z]/.test(lines[i + 1]) && !parseDuration(lines[i + 1])
          ? `${line} ${lines[i + 1]}`
          : line;

      const fac = splitCnEn(joined);
      if (fac.cn || fac.en) {
        currentFacultyCn = fac.cn || currentFacultyCn;
        currentFacultyEn = fac.en || currentFacultyEn;
      }
      continue;
    }

    const duration = parseDuration(line);
    if (!duration) continue;

    const p = buildProgramFromLookback(lines, i);
    if (!p.raw || (!p.cn && !p.en)) continue;

    const rawBlock = `${currentFacultyCn || ""} / ${currentFacultyEn || ""} | ${p.raw} | ${line}`;
    const lang = inferLanguage(rawBlock, currentLanguage.study_language as any);

    rows.push({
      idx: rows.length + 1,
      kind,
      faculty_cn: currentFacultyCn,
      faculty_en: currentFacultyEn,
      major_code: null,
      program_name_cn: p.cn,
      program_name_en: p.en,
      degree_type: inferDegreeType(kind, text),
      degree_kind: p.degree_kind,
      degree_name_cn: p.degree_name_cn,
      language_text: lang.language_text,
      study_language: lang.study_language,
      duration_years: duration,
      remarks_text: p.degree_kind,
      raw_line: `${p.raw} | ${line}`,
      raw_block: rawBlock,
      tags: [inferDegreeType(kind, text) || kind, lang.language_text || "", "GENERIC目录"].filter(Boolean),
    });
  }

  const seen = new Map<string, GenericProgramCatalogRow>();
  for (const r of rows) {
    const key = [
      r.kind || "",
      r.study_language || r.language_text || "",
      r.faculty_cn || "",
      r.faculty_en || "",
      r.program_name_cn || "",
      r.program_name_en || "",
      r.duration_years || "",
    ].join("@@");

    if (!key.replace(/@/g, "").trim()) continue;
    if (!seen.has(key)) seen.set(key, r);
  }

  const finalRows = Array.from(seen.values())
    .filter((r) => {
      const faculty = String(r.faculty_cn || "");
      const program = String(r.program_name_cn || "");
      const raw = `${faculty} ${program}`;

      if (/部项目|授课语言|授予学位类型|学院项目/.test(raw)) return false;
      if (/^(医学学士|工学学士|文学学士|理学学士|管理学学士|经济学学士|法学学士|艺术学学士)$/.test(faculty)) return false;
      if (!String(r.program_name_cn || r.program_name_en || "").trim()) return false;
      if (!r.duration_years) return false;

      return true;
    })
    .map((r, i) => ({
      ...r,
      idx: i + 1,
    }));

  return {
    ok: cleanGenericCatalogRows(finalRows).length > 0,
    rows: cleanGenericCatalogRows(finalRows),
    meta: {
      parser: "generic_program_catalog_v1",
      doc_type: "generic_program_catalog",
      rows: finalRows.length,
      kind,
      filename: opts?.filename || null,
      raw_preview: text.slice(0, 500),
    },
  };
}
