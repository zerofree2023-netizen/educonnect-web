// app/lib/server/parsers/fudanIsoTuitionPdf.ts

function clean(s: any) {
  return String(s ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function normName(s: string) {
  // 用于匹配：去空格、统一括号
  return clean(s)
    .replace(/[（）]/g, (m) => (m === "（" ? "(" : ")"))
    .replace(/\s+/g, "")
    .toLowerCase();
}

function toYearMaybe(s: string) {
  const m = clean(s).match(/(\d+(?:\.\d+)?)\s*年/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

function toMoneyPerYearMaybe(s: string) {
  // 23000 元/年
  const m = clean(s).replace(/,/g, "").match(/(\d{3,7})\s*元\s*\/\s*年/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

function isFeeCategoryLine(s: string) {
  // 文科 / 理科 / 医科 这种
  return /^(文科|理科|医科)$/.test(clean(s));
}

function isSchoolOrDeptLine(s: string) {
  // 经验规则：包含“学院/系/学部/中心”等，且不是“招生专业/学制/学费标准”这些表头
  const x = clean(s);
  if (!x) return false;
  if (/招生专业|院系|学制|学费标准/.test(x)) return false;
  return /(学院|学系|系|中心|学部|研究院|书院|上海医学院)/.test(x);
}

function looksLikeProgramLine(s: string) {
  const x = clean(s);
  if (!x) return false;
  if (isFeeCategoryLine(x)) return false;
  if (isSchoolOrDeptLine(x)) return false;
  if (/招生专业|院系|学制|学费标准|注：/.test(x)) return false;
  // 至少有中文
  return /[\u4e00-\u9fff]/.test(x);
}

export function parseFudanIsoTuitionPdf(raw: string) {
  const text = String(raw ?? "");
  const lines = text
    .split(/\r?\n/)
    .map((l) => clean(l))
    .filter((l) => l.length > 0);

  // 这个 PDF 的 pdftotext 结果通常会出现表头“招生专业 院系 学制 学费标准”
  const hasHeader = lines.some((l) => l.includes("招生专业") && l.includes("院系") && l.includes("学制") && l.includes("学费标准"));
  if (!hasHeader) {
    return { ok: false as const, rows: [], meta: { reason: "header_not_match" } };
  }

  let curFaculty: string | null = null;
  let curDuration: number | null = null;
  let curFee: number | null = null;
  let curFeeCat: string | null = null;

  const out: any[] = [];

  for (const line of lines) {
    // 跳过表头/页码/注释
    if (/^\d+$/.test(line)) continue;
    if (/^注：/.test(line)) break;
    if (line.includes("招生专业") && line.includes("学费标准")) continue;

    // 学制（4年/5年）
    const y = toYearMaybe(line);
    if (y != null && y > 0 && y <= 10) {
      curDuration = y;
      continue;
    }

    // 学费（xxxx 元/年）
    const fee = toMoneyPerYearMaybe(line);
    if (fee != null) {
      curFee = fee;
      continue;
    }

    // 文科/理科/医科
    if (isFeeCategoryLine(line)) {
      curFeeCat = line;
      continue;
    }

    // 院系（学院/系/上医等）
    if (isSchoolOrDeptLine(line)) {
      curFaculty = line;
      continue;
    }

    // 专业名
    if (looksLikeProgramLine(line)) {
      out.push({
        program_name_cn: line,
        faculty_cn: curFaculty,
        duration_years: curDuration,
        tuition_rmb_per_year: curFee,
        tuition_note: curFeeCat ? `${curFeeCat} ${curFee ?? ""}元/年`.trim() : null,
      });
    }
  }

  // 去重（按专业名）
  const m = new Map<string, any>();
  for (const r of out) {
    const k = normName(r.program_name_cn || "");
    if (!k) continue;
    if (!m.has(k)) m.set(k, r);
    else {
      // merge：优先保留已有字段，缺的用新补
      const prev = m.get(k);
      m.set(k, {
        ...prev,
        ...r,
        faculty_cn: prev.faculty_cn || r.faculty_cn,
        duration_years: prev.duration_years ?? r.duration_years,
        tuition_rmb_per_year: prev.tuition_rmb_per_year ?? r.tuition_rmb_per_year,
        tuition_note: prev.tuition_note || r.tuition_note,
      });
    }
  }

  const rows = Array.from(m.values());

  return {
    ok: true as const,
    rows,
    meta: {
      parser: "fudan_iso_tuition_pdf_v1",
      rows: rows.length,
    },
  };
}