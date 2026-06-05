// lib/server/parsers/fudanUndergradCatalogPdf.ts

function cleanLine(s: any) {
  return String(s ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isHeaderOrPageNoise(s: string) {
  const x = cleanLine(s);
  if (!x) return true;
  if (/^\d+$/.test(x)) return true;
  if (x.includes("招生专业") && x.includes("院系")) return true;
  if (x.includes("2026 年复旦大学外国留学生本科生中文授课专业目录")) return true;
  return false;
}

function looksLikeProgramName(s: string) {
  const x = cleanLine(s);
  if (!x) return false;
  if (isHeaderOrPageNoise(x)) return false;

  if (/[。；;：:]/.test(x)) return false;
  if (/^(备注|学制|院系|所属专业)/.test(x)) return false;
  if (/需高中|部分课程|不转专业|色盲|建议|高年级|基础扎实|申请|课程英文授课/.test(x)) return false;
  if (/^\(?[一二三四五六七八九十\d]+\)?/.test(x)) return false;

  // 太长的通常是备注，不是专业名；但“管理学类（含...）”可以放宽
  if (x.length > 45 && !x.includes("管理学类")) return false;

  return /[\u4e00-\u9fff]/.test(x);
}

function looksLikeFaculty(s: string) {
  const x = cleanLine(s);
  return /(?:学院|系|书院|中心)$/.test(x) || x.includes("国际关系与公共事务学院");
}

function looksLikeCategory(s: string) {
  const x = cleanLine(s);
  if (!x) return false;
  if (looksLikeFaculty(x)) return false;
  return /(?:类|试验班|汉语言（对外）|法学|英语|翻译|法语|德语|日语|西班牙语|俄语|朝鲜语)$/.test(x);
}

export function parseFudanUndergradCatalogPdf(rawText: string) {
  const lines = String(rawText || "")
    .replace(/\r/g, "\n")
    .split("\n")
    .map(cleanLine)
    .filter((x) => x && !isHeaderOrPageNoise(x));

  const rows: any[] = [];

  let currentCategory = "";
  let currentFaculty = "";
  let currentDuration: number | null = 4;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const dur = line.match(/(\d+(?:\.\d+)?)\s*年/);
    if (dur) {
      const n = Number(dur[1]);
      if (Number.isFinite(n) && n >= 1 && n <= 10) currentDuration = n;
    }

    if (looksLikeFaculty(line)) {
      currentFaculty = line;
      continue;
    }

    if (looksLikeCategory(line)) {
      currentCategory = line;
      continue;
    }

    if (!looksLikeProgramName(line)) continue;

    // 避免把“所属专业类/院系/备注”当专业
    if (line === currentCategory || line === currentFaculty) continue;

    rows.push({
      idx: rows.length + 1,
      kind: "ug",
      degree_type: "本科",
      study_language: "zh",
      language_text: "中文",
      program_name_cn: line,
      program_category_cn: currentCategory || null,
      faculty_cn: currentFaculty || null,
      duration_years: currentDuration || 4,
      raw_line: line,
    });
  }

  // 去重：同专业 + 院系
  const seen = new Set<string>();
  const deduped = rows.filter((r) => {
    const k = `${r.program_name_cn}@@${r.faculty_cn || ""}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  deduped.forEach((r, i) => (r.idx = i + 1));

  return {
    ok: deduped.length > 0,
    rows: deduped,
    meta: {
      parser: "fudan_undergrad_catalog_pdf_v1",
      doc_type: "fudan_undergrad_catalog",
      rows: deduped.length,
      table_header: ["招生专业", "所属专业（类）", "院系", "备注", "学制"],
    },
  };
}