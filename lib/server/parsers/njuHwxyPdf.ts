// app/lib/server/parsers/njuHwxyPdf.ts

function clean(s: any) {
  return String(s ?? "").replace(/\u00a0/g, " ").trim();
}

function toNumMaybe(x: any): number | null {
  const s = clean(x);
  if (!s) return null;
  const m = s.match(/(\d+(\.\d+)?)/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

function isLikelyLang(s: string) {
  const x = clean(s);
  if (!x) return false;
  return /中文|英文|中英|英语|汉语|English|Chinese/i.test(x);
}

function normalizeLanguage(langText: string | null): "Chinese" | "English" | "Chinese/English" | null {
  const s = clean(langText);
  if (!s) return null;
  if (/中英|双语|Chinese\/English|Chinese\s*&\s*English/i.test(s)) return "Chinese/English";
  if (/英文|英语|English/i.test(s)) return "English";
  if (/中文|汉语|Chinese/i.test(s)) return "Chinese";
  return null;
}

function inferStudyModeFromRemarks(remarks: string | null): string | null {
  const s = clean(remarks);
  if (!s) return null;
  // 你 master 里出现了：专业学位（非全日制 MBA）
  if (/非全日制|在职/i.test(s)) return "非全日制";
  if (/全日制/i.test(s)) return "全日制";
  return null;
}

function inferDegreeType(kind: "master" | "phd" | "ug" | "other", remarks?: string | null) {
  if (kind === "phd") return "phd";
  if (kind === "master") return "master";
  if (kind === "ug") return "undergrad";

  const s = clean(remarks);
  if (/博士|Ph\.?D|Doctor/i.test(s)) return "phd";
  if (/硕士|Master|研究生/i.test(s)) return "master";
  if (/本科|Undergrad/i.test(s)) return "undergrad";
  return null;
}

/**
 * ✅ 从一行里“反向”拆字段：更稳
 * 典型顺序：学院 | 专业 | 语言 | 学制(年) | 备注...
 * - 从末尾先抓 学制(年)=数字
 * - 再抓 语言（包含 中文/英文 等关键词）
 * - 剩下的前两段尝试切成 学院/专业
 */
function parseRest(restRaw: string) {
  const rest = clean(restRaw);
  if (!rest) {
    return { faculty_cn: null, program_name_cn: null, language_text: null, duration_years: null, remarks: null };
  }

  // 先用 “2+空格” 切一次；不够列再退化到 “1+空格”
  let parts = rest.split(/\s{2,}/).map(clean).filter(Boolean);
  if (parts.length < 3) parts = rest.split(/\s+/).map(clean).filter(Boolean);

  // 反向抓 duration（从尾部找第一个数字）
  let duration_years: number | null = null;
  let durationIdx = -1;
  for (let i = parts.length - 1; i >= 0; i--) {
    const n = toNumMaybe(parts[i]);
    if (n != null && n > 0 && n <= 10) {
      duration_years = n;
      durationIdx = i;
      break;
    }
  }

  // 抓 language：在 duration 左边最近的“像语言”的 token
  let language_text: string | null = null;
  let langIdx = -1;

  if (durationIdx >= 0) {
    for (let i = durationIdx - 1; i >= 0; i--) {
      if (isLikelyLang(parts[i])) {
        language_text = parts[i];
        langIdx = i;
        break;
      }
    }
  } else {
    for (let i = parts.length - 1; i >= 0; i--) {
      if (isLikelyLang(parts[i])) {
        language_text = parts[i];
        langIdx = i;
        break;
      }
    }
  }

  // head：优先当作 学院 + 专业
  const headEnd = langIdx >= 0 ? langIdx : durationIdx >= 0 ? durationIdx : parts.length;
  const head = parts.slice(0, Math.max(0, headEnd)).filter(Boolean);

  const faculty_cn = head[0] ?? null;
  const program_name_cn = head.length >= 2 ? head.slice(1).join(" ") : null;

  // remarks：language/duration 之后的全部拼成备注
  const tailStart = durationIdx >= 0 ? durationIdx + 1 : langIdx >= 0 ? langIdx + 1 : headEnd;
  const tail = parts.slice(tailStart).filter(Boolean);
  const remarks = tail.length ? tail.join(" ") : null;

  return { faculty_cn, program_name_cn, language_text, duration_years, remarks };
}

type NjuKind = "master" | "phd" | "ug" | "other";

export function parseNjuHwxyPdfProgramCatalog(raw: string, opts?: { kind?: NjuKind }) {
  const kind = (opts?.kind || "other") as NjuKind;

  const text = clean(raw);
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\t/g, " ").trimEnd())
    .filter((l) => l.trim().length > 0);

  const hasHeader =
    lines.some((l) => l.includes("专业代码")) &&
    lines.some((l) => l.includes("学院")) &&
    lines.some((l) => l.includes("授课")) &&
    lines.some((l) => l.includes("学制"));

  if (!hasHeader) {
    return { ok: false as const, program_catalog: [], meta: { reason: "header_not_match" } };
  }

  const out: any[] = [];
  let cur: any | null = null;

  for (const line0 of lines) {
    const line = line0.trim();

    // 跳过明显表头
    if (line.startsWith("授课") && line.includes("学制")) continue;
    if (line.includes("专业代码") && line.includes("学院")) continue;

    // ✅ 专业代码开头（南京这份里不全是纯数字：例如 0101Z2 / 0303J9）
    // 规则：6位起始，允许末尾含字母（Z/J 等）
    const m = line.match(/^([0-9]{4,6}[A-Z0-9]{0,2})\s+(.*)$/i);
    if (m) {
      if (cur) out.push(cur);

      const major_code = clean(m[1]);
      const rest = m[2];

      const { faculty_cn, program_name_cn, language_text, duration_years, remarks } = parseRest(rest);

      const language = normalizeLanguage(language_text);
      const study_mode_cn = inferStudyModeFromRemarks(remarks) || null;
      const degree_type = inferDegreeType(kind, remarks) || null;

      cur = {
        idx: out.length + 1,
        dept_code: null,
        faculty_cn,
        faculty_en: null,

        major_code,
        program_name_cn,
        program_name_en: null,

        track_code: null,
        track_name_cn: null,
        track_name_en: null,

        // ✅ 统一字段（你要的）
        language, // "Chinese" | "English" | "Chinese/English"
        degree_type, // "master" | "phd" | "undergrad"
        study_mode_cn, // "全日制" | "非全日制" | null

        // 兼容保留
        language_text,

        duration_years,
        remarks,

        raw_line: line,
      };
      continue;
    }

    // 续行：追加到备注（比如 MBA 那种换行）
    if (cur) {
      const add = clean(line);
      if (add) {
        cur.remarks = clean([cur.remarks, add].filter(Boolean).join("\n"));

        // ✅ 续行后补推断（尤其 study_mode_cn / degree_type）
        const sm = inferStudyModeFromRemarks(cur.remarks);
        if (sm) cur.study_mode_cn = sm;

        if (!cur.degree_type) {
          const dt = inferDegreeType(kind, cur.remarks);
          if (dt) cur.degree_type = dt;
        }
      }
    }
  }

  if (cur) out.push(cur);
  out.forEach((r, i) => (r.idx = i + 1));

  return {
    ok: true as const,
    program_catalog: out,
    meta: { parser: "nju_hwxy_pdf_v3", rows: out.length, kind },
  };
}