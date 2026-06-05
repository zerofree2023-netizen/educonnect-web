// lib/server/parsers/zjuIczuCatalogPdf.ts

export type Row = {
  idx: number;
  faculty_cn: string | null;
  faculty_url: string | null;
  program_name_cn: string | null;
  duration_years: number | null;
  tuition_rmb_per_year: number | null;
  csca_subjects_text: string | null;
  apply_requirements_text: string | null;
  remarks_text: string | null;
  raw_line: string | null;
  raw_block?: string | null;
};

function normLine(s: string) {
  return String(s || "")
    .replace(/\u00a0/g, " ")
    .replace(/\t/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeSpace(s: string) {
  return String(s || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function looksLikeHeaderLine(s: string) {
  const t = normLine(s);
  return (
    t.includes("院系") &&
    t.includes("专业") &&
    (t.includes("学制") || t.includes("学费") || t.includes("学年"))
  );
}

function parseHeaderCellsFromLine(_s: string): string[] {
  return [
    "院系",
    "专业名称",
    "学制",
    "学费",
    "CSCA考试科目",
    "申请要求",
    "备注",
  ];
}

function extractFirstUrl(s: string): string | null {
  const m = String(s || "").match(/https?:\/\/[^\s)）]+/i);
  return m ? m[0] : null;
}

function parseDurationYears(s: string): number | null {
  const t = normLine(s);
  const m = t.match(/(\d+(?:\.\d+)?)\s*年/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

function parseTuitionPerYear(s: string): number | null {
  const t = normLine(s).replace(/，/g, ",");
  const m = t.match(/人民币\s*([\d,]+)\s*[\/／]\s*(?:学年|年)/);
  if (!m) return null;
  const n = Number(String(m[1]).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function extractCscaSubjects(s: string): string | null {
  const t = normLine(s).replace(/\s+/g, "");
  const m = t.match(
    /(数学|物理|化学|生物)(?:[、,，\s]+(数学|物理|化学|生物))*/,
  );
  if (!m || !m[0]) return null;
  return String(m[0])
    .replace(/[,，\s]+/g, "、")
    .replace(/、{2,}/g, "、")
    .trim();
}

function splitCols(ln: string) {
  return normalizeSpace(ln)
    .split(/\s{2,}|\t+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function isFeeLine(ln: string) {
  return /人民币\s*\d[\d,]*\s*[\/／]\s*(?:学年|年)/.test(normalizeSpace(ln));
}

function isFacultyLike(s: string) {
  const t = normalizeSpace(s);
  if (!t) return false;
  if (looksLikeHeaderLine(t)) return false;
  if (isFeeLine(t)) return false;
  if (t.length > 60) return false;

  // “院（义乌）”不是院系
  if (t.includes("义乌") && t.includes("院") && !t.includes("学院"))
    return false;

  return /联合学院|学院|学部|研究院|研究所|中心|书院|医学院|法学院|药学院/.test(
    t,
  );
}

function cleanFaculty(s: string) {
  let x = normalizeSpace(s);
  x = x.replace(/https?:\/\/\S+/g, " ").trim();
  x = normalizeSpace(x);

  if (!x) return "";
  if (x.includes("义乌") && x.includes("院") && !x.includes("学院")) return "";
  if (x.length > 80) return "";
  return x;
}

// ✅ 最关键：截断到 “xxx学院/xxx联合学院/xxx医学院/xxx研究院/xxx学部/xxx中心/xxx研究所/xxx书院”
function normalizeFacultyCn(input: string) {
  const s = normalizeSpace(String(input || ""));
  if (!s) return "";

  const m = s.match(
    /^(.*?(?:联合学院|学院|医学院|国际医学院|研究院|研究所|学部|中心|书院))/,
  );
  if (m?.[1]) return normalizeSpace(m[1]);

  const m2 = s.match(
    /^(“?[^”]{2,50}?(?:联合学院|学院|医学院|国际医学院|研究院|研究所|学部|中心|书院))/,
  );
  if (m2?.[1]) return normalizeSpace(m2[1]);

  return s;
}

function isClearlyNotProgram(s: string) {
  const t = normalizeSpace(s);
  if (!t) return true;

  if (/https?:\/\/|www\./i.test(t)) return true;
  if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(t)) return true;
  if (/电话[:：]?\s*\+?\d/.test(t)) return true;

  if (
    /(必修课程|高中|成绩|不低于|申请材料|申请截止|截止日期|教学地点|联系|详见|关于|标准化考试|A-LEVEL|ALEVEL|A LEVEL|IB|SAT|ACT|AP)/.test(
      t,
    )
  )
    return true;

  if (t.includes("申请要求详见")) return true;

  return false;
}

function looksLikeGarbageProgram(x: string) {
  const t = normalizeSpace(x);
  if (!t) return true;
  if (/^\d+\s*年$/.test(t)) return true;
  if (/^人民币\s*\d/.test(t)) return true;
  if (/^[\d,]+$/.test(t)) return true;
  if (t.includes("申请要求详见")) return true;
  if (t.startsWith("电话") || t.startsWith("邮箱") || t.includes("@"))
    return true;
  if (t.startsWith("http")) return true;
  if (isClearlyNotProgram(t)) return true;
  return false;
}

function cleanProgramName(s: string) {
  let x = normalizeSpace(s);
  x = x.replace(/https?:\/\/\S+/g, " ").trim();
  x = normalizeSpace(x);

  x = x.replace(/^[★\*\-•·\s]+/, "").trim();

  // 砍掉明显不是名称的尾巴
  x = x
    .replace(
      /\s+(?:托福|雅思|多邻国|电话|邮箱|联系邮箱|申请截止|截止日期|教学地点)[:：]?.*$/g,
      "",
    )
    .trim();
  x = normalizeSpace(x);

  if (looksLikeGarbageProgram(x)) return "";
  return x;
}

// 断行拼接：授↵课） / 管↵理） / 双学位）
function stitchBrokenSuffix(name: string, nextLine: string) {
  let n = String(name || "").trim();
  const nx = String(nextLine || "").trim();
  if (!n || !nx) return n;

  // 授↵课）
  if (n.includes("（英语授") && nx.startsWith("课）")) n += "课）";
  if (n.includes("(英语授") && nx.startsWith("课)")) n += "课)";

  // 管↵理）
  if (n.endsWith("管") && nx.startsWith("理）")) n += "理）";
  if (n.endsWith("管") && nx.startsWith("理)")) n += "理)";

  // 双学位）拆行
  if (
    n.includes("（中外合作办学") &&
    !n.includes("双学位") &&
    nx.includes("双学位")
  ) {
    const suf = nx.match(/双学位[）)]/)?.[0] || "双学位）";
    if (!n.endsWith("）") && !n.endsWith(")")) n += suf;
    if (n.endsWith("双学位")) n += "）";
  }

  return n;
}

// 从一行里提取专业片段：优先抓关键专业（你这份 PDF 就这几个）
function extractProgramFragment(s: string) {
  const t = normalizeSpace(s);
  if (!t) return "";

  // 排除纯学制/费用行
  if (/^\s*(\d{1,2}\s*年|人民币|\d[\d,]*\s*[\/／]\s*学年)/.test(t)) return "";

  const m0 = t.match(
    /(临床医学|生物医学工程|传播学|生物信息学|生物医学)(?:（[^）]{1,60}）|\([^)]{1,60}\))?/,
  );
  if (m0?.[0]) return cleanProgramName(m0[0]);

  // 宽匹配兜底：最长中文串
  const hits =
    t.match(/[\u4e00-\u9fff]{2,}(?:（[^）]{1,30}）|\([^)]{1,30}\))?/g) || [];
  hits.sort((a, b) => b.length - a.length);
  return cleanProgramName(hits[0] || "");
}

function normKey(x: any) {
  return String(x ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/[（）]/g, (m) => (m === "（" ? "(" : ")"))
    .replace(/\s+/g, "")
    .trim()
    .toLowerCase();
}

/**
 * ZJU iczu UG PDF parser
 * raw_text comes from pdftotext -layout
 */
export function parseZjuIczuCatalogPdfUg(raw_text: string) {
  const lines = String(raw_text || "")
    .split(/\r?\n|\f/g)
    .map((x) =>
      String(x || "")
        .replace(/\u00a0/g, " ")
        .trim(),
    )
    .filter(Boolean);

  const feeIdxs = lines
    .map((ln, i) => (isFeeLine(ln) ? i : -1))
    .filter((i) => i >= 0);

  const rows: Row[] = [];

  for (const idx of feeIdxs) {
    const feeLine = lines[idx] || "";
    const tuition = parseTuitionPerYear(feeLine);
    const duration = parseDurationYears(feeLine);

    const prev1 = idx - 1 >= 0 ? lines[idx - 1] : "";
    const prev2 = idx - 2 >= 0 ? lines[idx - 2] : "";
    const prev3 = idx - 3 >= 0 ? lines[idx - 3] : "";
    const next1 = idx + 1 < lines.length ? lines[idx + 1] : "";
    const next2 = idx + 2 < lines.length ? lines[idx + 2] : "";

    // ===== faculty：列第一列优先，其次向上扫描 =====
    let faculty = "";
    {
      const c1 = splitCols(prev1);
      const c2 = splitCols(prev2);

      if (c1.length >= 1) faculty = cleanFaculty(c1[0]);
      if ((!faculty || !isFacultyLike(faculty)) && c2.length >= 1)
        faculty = cleanFaculty(c2[0]);

      if (!faculty || !isFacultyLike(faculty)) {
        for (let b = 1; b <= 14; b++) {
          const j = idx - b;
          if (j < 0) break;
          const ln = cleanFaculty(lines[j] || "");
          if (isFacultyLike(ln)) {
            faculty = ln;
            break;
          }
        }
      }

      faculty = normalizeFacultyCn(cleanFaculty(faculty));
    }

    // ===== ZJE 双学位特判：只要 fee=200000 且出现 zje/联合学院，就直接输出两条 =====
    {
      const windowStart = Math.max(0, idx - 22);
      const joined = normKey(lines.slice(windowStart, idx + 1).join(" "));

      const hasZjeBlock =
        joined.includes(normKey("浙江大学爱丁堡大学联合学院")) ||
        joined.includes("zje.intl.zju.edu.cn") ||
        joined.includes("zje.zju.edu.cn") ||
        joined.includes("zje.intl") ||
        joined.includes("zje");

      if (hasZjeBlock && tuition === 200000) {
        const zjeFaculty = "浙江大学爱丁堡大学联合学院";
        const progs = [
          "生物医学（中外合作办学双学位）",
          "生物信息学（中外合作办学双学位）",
        ];

        for (const nm of progs) {
          rows.push({
            idx: 0,
            faculty_cn: zjeFaculty,
            faculty_url: null,
            program_name_cn: nm,
            duration_years: duration,
            tuition_rmb_per_year: tuition,
            csca_subjects_text: null,
            apply_requirements_text: null,
            remarks_text: null,
            raw_line: feeLine,
            raw_block: feeLine,
          });
        }
        continue;
      }
    }

    // ===== programName：先从 feeLine 自带抓（临床医学），否则从 prev 行抓（工程/传播学）=====
    let programName = "";
    {
      const mName = normalizeSpace(feeLine).match(
        /^(.{2,80}?)(?:\s+\d+\s*年|\s+人民币)/,
      );
      if (mName?.[1]) programName = cleanProgramName(mName[1]);
    }

    if (!programName) {
      programName =
        extractProgramFragment(prev1) ||
        extractProgramFragment(prev2) ||
        extractProgramFragment(prev3) ||
        "";
    }

    if (programName) {
      programName = stitchBrokenSuffix(programName, next1);
      programName = stitchBrokenSuffix(programName, next2);
      programName = cleanProgramName(programName);
    }

    if (!programName) continue;
    if (looksLikeGarbageProgram(programName)) continue;

    // ===== 尝试补充 CSCA 科目：通常就在 feeLine 后面/同一行 =====
    const csca =
      extractCscaSubjects(feeLine) ||
      extractCscaSubjects(next1) ||
      extractCscaSubjects(prev1);

    // ===== 可选：faculty_url 从附近找 URL（你现在不强依赖）=====
    const faculty_url =
      extractFirstUrl(prev1) ||
      extractFirstUrl(prev2) ||
      extractFirstUrl(prev3);

    rows.push({
      idx: 0,
      faculty_cn: faculty || null,
      faculty_url: faculty_url || null,
      program_name_cn: programName || null,
      duration_years: duration,
      tuition_rmb_per_year: tuition,
      csca_subjects_text: csca || null,
      apply_requirements_text: null,
      remarks_text: null,
      raw_line: feeLine,
      raw_block: feeLine,
    });
  }

  // ===== 去重：同 faculty + program + tuition =====
  const uniq = new Map<string, Row>();
  for (const r of rows) {
    const k = `${normKey(r.faculty_cn)}@@${normKey(r.program_name_cn)}@@${
      r.tuition_rmb_per_year ?? ""
    }`;
    if (!k.startsWith("@@")) uniq.set(k, r);
  }

  const out = Array.from(uniq.values());
  out.forEach((r, i) => (r.idx = i + 1));

  return {
    ok: out.length > 0,
    rows: out,
    meta: {
      parser: "zju_iczu_ug_v12",
      rows: out.length,
      table_header: parseHeaderCellsFromLine(""),
    },
  };
}
