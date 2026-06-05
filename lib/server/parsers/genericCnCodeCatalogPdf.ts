export type GenericCnCodeCatalogRow = {
  idx: number;
  kind: "ug" | "master" | "phd";
  faculty_code: string | null;
  faculty_cn: string | null;
  faculty_en: string | null;
  major_code: string | null;
  program_name_cn: string | null;
  program_name_en: string | null;
  track_name_cn: string | null;
  track_name_en: string | null;
  degree_type: string | null;
  degree_kind: string | null;
  study_language: string | null;
  language_text: string | null;
  study_mode_cn: string | null;
  duration_years: number | null;
  tuition_rmb_per_year: number | null;
  tuition_total_rmb: number | null;
  tuition_is_per_year: boolean | null;
  tuition_note: string | null;
  tuition_source_url: string | null;
  csca_subjects_text: string | null;
  apply_requirements_text: string | null;
  remarks_text: string | null;
  contact_raw: string | null;
  raw_line: string | null;
  raw_block: string | null;
  needs_review: boolean;
  review_flags: string[];
};

type ParsedCnCodeLine = {
  major_code: string;
  faculty_cn: string | null;
  program_name_cn: string;
  lang: string;
  duration_years: number;
  remarks_text: string | null;
};

export type GenericCnCodeCatalogResult = {
  ok: boolean;
  rows: GenericCnCodeCatalogRow[];
  meta: Record<string, any>;
};

function norm(s: any) {
  return String(s ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\r/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[ ]+/g, " ")
    .trim();
}

function splitLines(rawText: string) {
  return String(rawText || "")
    .replace(/\f/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((x) => norm(x))
    .filter(Boolean)
    .filter((x) => !/^\d+\s*\/\s*\d+$/.test(x))
    .filter((x) => !/^(专业代码|学院|专业|授课|语言|学制|备注|\(年\))$/.test(x));
}

function hasCn(s: any) {
  return /[\u4e00-\u9fff]/.test(String(s || ""));
}

function isMajorCode(s: any) {
  return /^[0-9A-Z]{5,8}$/.test(String(s || "").trim());
}

function parseDuration(s: any): number | null {
  const m = String(s || "").match(/(?:汉语|英语|中文|英文)?\s*(\d+(?:\.\d+)?)\s*(?:年)?(?:\s|$)/);
  const n = m ? Number(m[1]) : null;
  return n != null && Number.isFinite(n) && n >= 1 && n <= 10 ? n : null;
}

function parseTuition(text: string) {
  const m = String(text || "").match(/学费\s*([1-9]\d{4,6})\s*元\s*\/?\s*学年/);
  const n = m ? Number(m[1]) : null;

  if (n != null && Number.isFinite(n) && n >= 10000 && n <= 300000) {
    return {
      tuition_rmb_per_year: n,
      tuition_total_rmb: null,
      tuition_is_per_year: true,
      tuition_note: `${n.toLocaleString("en-US")} RMB/Year`,
    };
  }

  return {
    tuition_rmb_per_year: null,
    tuition_total_rmb: null,
    tuition_is_per_year: null,
    tuition_note: null,
  };
}

function cleanRemark(s: any) {
  const t = norm(s);
  if (!t) return null;
  return t || null;
}

function degreeTypeForKind(kind: "ug" | "master" | "phd") {
  if (kind === "ug") return "本科";
  if (kind === "master") return "硕士";
  return "博士";
}

function normalizeLang(s: string) {
  if (/英语|英文|English/i.test(s)) return { study_language: "en", language_text: "英文" };
  if (/汉语|中文|Chinese/i.test(s)) return { study_language: "zh", language_text: "中文" };
  return { study_language: "", language_text: "" };
}

function isHeaderLike(line: string) {
  return (
    line.includes("专业代码") ||
    line.includes("学院") && line.includes("专业") && line.includes("学制") ||
    line === "授课" ||
    line === "语言" ||
    line === "(年)"
  );
}

function isContinuationLine(line: string) {
  if (!line) return false;
  if (/^[0-9A-Z]{5,8}\s+/.test(line)) return false;
  if (isHeaderLike(line)) return false;
  return true;
}

function parseMainLine(line: string): ParsedCnCodeLine | null {
  // code faculty program language duration remark
  // faculty usually ends with 学院/研究院/中心/系/书院/学部
  const re =
    /^([0-9A-Z]{5,8})\s+(.+?(?:学院|研究院|研究所|中心|系|书院|学部|School|College|Institute|Department))\s+(.+?)\s+(汉语|英语|中文|英文)\s+(\d+(?:\.\d+)?)(?:\s+(.*))?$/i;

  const m = line.match(re);
  if (!m) return null;

  return {
    major_code: m[1],
    faculty_cn: norm(m[2]),
    program_name_cn: norm(m[3]),
    lang: norm(m[4]),
    duration_years: Number(m[5]),
    remarks_text: cleanRemark(m[6] || ""),
  };
}

function parseLooseLine(line: string): ParsedCnCodeLine | null {
  // For rows whose faculty column is blank in pdftotext, keep faculty null and review.
  // Example: 085400              电子信息           汉语 3   专业学位
  const re =
    /^([0-9A-Z]{5,8})\s+(.+?)\s+(汉语|英语|中文|英文)\s+(\d+(?:\.\d+)?)(?:\s+(.*))?$/i;

  const m = line.match(re);
  if (!m) return null;

  return {
    major_code: m[1],
    faculty_cn: null,
    program_name_cn: norm(m[2]),
    lang: norm(m[3]),
    duration_years: Number(m[4]),
    remarks_text: cleanRemark(m[5] || ""),
  };
}

function looksLikeProgramContinuation(line: string) {
  const s = norm(line);
  if (!s) return false;
  if (/学费|元\/学年|专业学位|非全日制|课程安排|同班上课|单独授课|方/.test(s)) return false;
  if (isHeaderLike(s)) return false;
  return hasCn(s);
}

function repairRows(rows: GenericCnCodeCatalogRow[]) {
  return rows.map((row, idx) => {
    const next: any = { ...(row || {}) };
    const flags = new Set<string>(next.review_flags || []);

    if (!next.faculty_cn) flags.add("missing_faculty_cn");
    if (!next.program_name_cn) flags.add("missing_program_name_cn");

    if (String(next.remarks_text || "").includes("专业学位")) {
      next.degree_kind = "专业学位";
    } else {
      next.degree_kind = next.degree_kind || "学术学位";
    }

    next.needs_review = flags.size > 0;
    next.review_flags = Array.from(flags);
    next.idx = idx + 1;
    return next;
  });
}

export function parseGenericCnCodeCatalogPdf(
  rawText: string,
  kind: "ug" | "master" | "phd",
): GenericCnCodeCatalogResult {
  const lines = splitLines(rawText);

  const head = lines.slice(0, 30).join(" ");
  const hasHeader =
    /专业代码/.test(head) &&
    /学院/.test(head) &&
    /专业/.test(head) &&
    /(授课|语言)/.test(head) &&
    /学制/.test(head);

  if (!hasHeader) {
    return {
      ok: false,
      rows: [],
      meta: {
        parser: "generic_cn_code_catalog_pdf_v1",
        rows: 0,
        error: "header_not_matched",
      },
    };
  }

  const rows: GenericCnCodeCatalogRow[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (isHeaderLike(line)) {
      i++;
      continue;
    }

    let parsed: ParsedCnCodeLine | null = parseMainLine(line);
    let usedLoose = false;

    if (!parsed && /^[0-9A-Z]{5,8}\s+/.test(line)) {
      parsed = parseLooseLine(line);
      usedLoose = Boolean(parsed);
    }

    if (!parsed) {
      i++;
      continue;
    }

    const block = [line];

    // 上一行可能是专业名上半截：如 “国际关系（中国与全球事”
    let prefixName = "";
    if (rows.length > 0 && i > 0) {
      const prev = lines[i - 1];
      if (looksLikeProgramContinuation(prev) && !/^[0-9A-Z]{5,8}\s+/.test(prev)) {
        // 只在当前行的专业很短或为空时拼接
        if (String(parsed.program_name_cn || "").length <= 4 || /[）)]$/.test(lines[i + 1] || "")) {
          prefixName = prev;
          block.unshift(prev);
        }
      }
    }

    // 后续备注/专业名下半截
    let j = i + 1;
    const tailParts: string[] = [];
    const remarkParts: string[] = [];

    while (j < lines.length && isContinuationLine(lines[j])) {
      const l = lines[j];

      // 下一行若像专业名右括号/续写，拼到专业名
      if (
        looksLikeProgramContinuation(l) &&
        (
          /[）)]$/.test(l) ||
          String(parsed.program_name_cn || "").includes("（") ||
          String(parsed.program_name_cn || "").includes("(")
        )
      ) {
        tailParts.push(l);
        block.push(l);
        j++;
        continue;
      }

      if (/学费|元\/学年|专业学位|非全日制|同班上课|单独授课|课程安排|设有/.test(l)) {
        remarkParts.push(l);
        block.push(l);
        j++;
        continue;
      }

      // 普通断行备注
      if (/^[^0-9A-Z]{1,40}$/.test(l) && !/^[0-9A-Z]{5,8}\s+/.test(l)) {
        remarkParts.push(l);
        block.push(l);
        j++;
        continue;
      }

      break;
    }

    let programName = norm([prefixName, parsed.program_name_cn, ...tailParts].filter(Boolean).join(""));
    programName = programName.replace(/\s+/g, "");

    const remarkText = norm([parsed.remarks_text, ...remarkParts].filter(Boolean).join(" "));
    const tuition = parseTuition(remarkText || block.join(" "));

    const lang = normalizeLang(parsed.lang);

    const review_flags: string[] = [];
    if (usedLoose) review_flags.push("loose_row_missing_faculty");

    rows.push({
      idx: rows.length + 1,
      kind,
      faculty_code: null,
      faculty_cn: parsed.faculty_cn,
      faculty_en: null,
      major_code: parsed.major_code,
      program_name_cn: programName || null,
      program_name_en: null,
      track_name_cn: null,
      track_name_en: null,
      degree_type: degreeTypeForKind(kind),
      degree_kind: remarkText.includes("专业学位") ? "专业学位" : "学术学位",
      study_language: lang.study_language,
      language_text: lang.language_text,
      study_mode_cn: remarkText.includes("非全日制") ? "非全日制" : "全日制",
      duration_years: parsed.duration_years,
      tuition_rmb_per_year: tuition.tuition_rmb_per_year,
      tuition_total_rmb: tuition.tuition_total_rmb,
      tuition_is_per_year: tuition.tuition_is_per_year,
      tuition_note: tuition.tuition_note,
      tuition_source_url: null,
      csca_subjects_text: null,
      apply_requirements_text: null,
      remarks_text: remarkText || null,
      contact_raw: null,
      raw_line: line,
      raw_block: block.join("\n"),
      needs_review: review_flags.length > 0,
      review_flags,
    });

    i = Math.max(j, i + 1);
  }

  const finalRows = repairRows(rows);

  console.log("[GENERIC_CN_CODE_CATALOG_PARSE_DEBUG]", {
    kind,
    inputLines: lines.length,
    rows: finalRows.length,
    first5: finalRows.slice(0, 5),
    needsReview: finalRows.filter((r) => r.needs_review).length,
  });

  return {
    ok: finalRows.length > 0,
    rows: finalRows,
    meta: {
      parser: "generic_cn_code_catalog_pdf_v1",
      doc_type: "generic_cn_code_catalog",
      rows: finalRows.length,
      review_summary: {
        needs_review: finalRows.filter((r) => r.needs_review).length,
        missing_faculty_cn: finalRows.filter((r) =>
          (r.review_flags || []).includes("missing_faculty_cn"),
        ).length,
      },
      table_header: [
        { zh: "专业代码", en: "Major Code", key: "major_code" },
        { zh: "学院", en: "School/Department", key: "faculty" },
        { zh: "专业", en: "Program/Major", key: "program_name" },
        { zh: "授课语言", en: "Teaching Language", key: "language" },
        { zh: "学制(年)", en: "Duration", key: "duration" },
        { zh: "备注", en: "Remarks", key: "remarks" },
      ],
    },
  };
}
