// scripts/lib/parse_program_catalog.ts

// ✅ 只解析“按序号(1~N)条目式目录”

// ✅ 如果不是这种版式，直接返回空 rows，避免把电话/学院/代码误拆成专业

export type ProgramCatalogRow = {

  idx: number;

  // 表格：学院/系

  faculty: string | null;

  // 表格：招生专业（第一列专业名/专业大类）

  program_name_cn: string | null;

  // 表格：教学环节专业（往往是细分方向/多个专业，用逗号顿号分隔）

  teaching_program_cn: string | null;

  // 兼容你之前字段：program_tracks = teaching_program_cn 拆分得到

  program_tracks: string[];

  // 表格：学费标准（人民币/学年）

  tuition_rmb_per_year: number | null;

  // 表格：CSCA测试科目（拆分）

  csca_subjects: string[];

  // 备注（比如第7条那种长说明）

  notes: string | null;

  // 原始块（调试用）

  raw_block: string;

};

export type ProgramCatalogMeta = {

  year: number | null;

  degree: string | null; // 本科 / 硕士 / 博士 ...

  language: string | null; // 中文授课 / 英文授课 ...

  title: string | null;

  // ✅ 新增：调试用

  parser?: string | null;

  rejected?: boolean;

  reject_reason?: string | null;

};

export type ProgramCatalogParseResult = {

  meta: ProgramCatalogMeta;

  rows: ProgramCatalogRow[];

};

// -------------------- helpers --------------------

function toInt(s: string | null | undefined) {

  if (!s) return null;

  const t = String(s).replace(/,/g, "");

  const m = t.match(/(\d{3,6})/);

  return m ? Number(m[1]) : null;

}

function normalizeLine(s: string) {

  return (s || "")

    .replace(/\u00a0/g, " ")

    .replace(/\s+/g, " ")

    .trim();

}

function splitList(s: string): string[] {

  return (s || "")

    .split(/[、，,；;\/]/g)

    .map((x) => x.trim())

    .filter(Boolean);

}

function isHeaderNoise(line: string) {

  return (

    /中国人民大学/.test(line) ||

    /招生专业目录/.test(line) ||

    /国际学生/.test(line) ||

    /中文授课/.test(line) ||

    (/序号/.test(line) && /学院/.test(line) && /学费/.test(line))

  );

}

function isFacultyOnlyLine(line: string) {

  return /^[\u4e00-\u9fff]{2,30}(学院|系|部|中心|研究院|学部|书院)$/.test(line);

}

function isTuitionOnlyLine(line: string) {

  return /^(\d{4,6})\s*(元|￥)$/.test(line);

}

function isCscaOnlyLine(line: string) {

  return /(文科|理科).*(中文|数学)/.test(line);

}

function pickDegree(head: string) {

  if (/本科/.test(head)) return "本科";

  if (/硕士/.test(head)) return "硕士";

  if (/博士/.test(head)) return "博士";

  return null;

}

function pickLanguage(head: string) {

  if (/中文授课/.test(head)) return "中文授课";

  if (/英文授课/.test(head)) return "英文授课";

  return null;

}

function escapeRegExp(s: string) {

  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

}

// ✅ 判断是不是“序号条目型目录”

function looksLikeNumberedCatalog(rawLines: string[]) {

  const lines = (rawLines || []).map(normalizeLine).filter(Boolean);

  if (lines.length === 0) {

    return { ok: false, reason: "empty_text" };

  }

  // 命中“明显的表格型目录”就直接拒绝旧 parser

  const headJoined = lines.slice(0, 120).join(" ");

  const tableSignals = [

    /院系名称/,

    /专业代码/,

    /专业名称/,

    /联系方式/,

    /研究方向/,

    /Research Fields/i,

    /Doctoral Programs/i,

    /Master Programs/i,

    /学制/,

    /学费/,

  ];

  const tableHitCount = tableSignals.filter((re) => re.test(headJoined)).length;

  if (tableHitCount >= 3) {

    return { ok: false, reason: "table_like_catalog_detected" };

  }

  // 统计“序号开头”的行

  const idxLines = lines.filter((line) => /^(\d{1,3})\s+/.test(line));

  const idxNums = idxLines

    .map((line) => {

      const m = line.match(/^(\d{1,3})\s+/);

      return m ? Number(m[1]) : null;

    })

    .filter((x): x is number => Number.isFinite(x));

  if (idxNums.length < 3) {

    return { ok: false, reason: "not_enough_numbered_items" };

  }

  // 看看是不是大致连续（允许跳一点）

  let sequentialHits = 0;

  for (let i = 1; i < idxNums.length; i++) {

    const diff = idxNums[i] - idxNums[i - 1];

    if (diff >= 0 && diff <= 2) sequentialHits++;

  }

  if (sequentialHits < Math.max(2, Math.floor(idxNums.length / 3))) {

    return { ok: false, reason: "numbered_items_not_sequential_enough" };

  }

  return { ok: true, reason: null };

}

// ✅ 过滤明显垃圾专业名

function looksBadMajorName(name: string | null | undefined) {

  const s = normalizeLine(String(name || ""));

  if (!s) return true;

  if (/^\d+$/.test(s)) return true;

  if (/^[A-Za-z]{1,12}$/.test(s)) return true; // School / Chemistry / Antai 这种

  if (/^\+?\d[\d\- ]{7,}$/.test(s)) return true; // 电话

  if (/^[A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)*$/.test(s) && !/program/i.test(s)) {

    return true;

  }

  const cnCount = (s.match(/[\u4e00-\u9fff]/g) || []).length;

  const enCount = (s.match(/[A-Za-z]/g) || []).length;

  // 纯英文且很短，通常不是这套 parser 想要的中文专业名

  if (cnCount === 0 && enCount > 0 && s.length <= 30) return true;

  return false;

}

// -------------------- main --------------------

/**

 * ✅ 解析“专业目录”文本（来自 PDF / txt / xlsx 转文本）

 * 只支持“按序号 1..N 分段”的目录

 * 不支持标准表格型 PDF（院系名称/专业代码/专业名称/联系方式/学制/学费）

 */

export function parseProgramCatalogFromText(textRaw: string): ProgramCatalogParseResult {

  const text = (textRaw || "").replace(/\r/g, "");

  const rawLines = text.split("\n").map(normalizeLine).filter(Boolean);

  const head = rawLines.slice(0, 40).join(" ");

  const year = (() => {

    const m = head.match(/(20\d{2})年/);

    return m ? Number(m[1]) : null;

  })();

  const meta: ProgramCatalogMeta = {

    year,

    degree: pickDegree(head),

    language: pickLanguage(head),

    title: head.slice(0, 200) || null,

    parser: "numbered_catalog_v2",

    rejected: false,

    reject_reason: null,

  };

  // ✅ 先做“只限序号条目型目录”的闸门

  const gate = looksLikeNumberedCatalog(rawLines);

  if (!gate.ok) {

    return {

      meta: {

        ...meta,

        rejected: true,

        reject_reason: gate.reason,

      },

      rows: [],

    };

  }

  // ---- 1) 扫描：按序号切块，同时维护“上下文(学院/学费/CSCA)” ----

  type Block = {

    idx: number;

    lines: string[];

    ctxFaculty: string | null;

    ctxTuition: number | null;

    ctxCsca: string | null;

  };

  let ctxFaculty: string | null = null;

  let ctxTuition: number | null = null;

  let ctxCsca: string | null = null;

  const blocks: Block[] = [];

  let cur: Block | null = null;

  for (const line0 of rawLines) {

    const line = normalizeLine(line0);

    if (!line) continue;

    if (isHeaderNoise(line)) continue;

    if (isFacultyOnlyLine(line)) {

      ctxFaculty = line;

      continue;

    }

    if (isTuitionOnlyLine(line)) {

      const m = line.match(/^(\d{4,6})/);

      ctxTuition = m ? Number(m[1]) : ctxTuition;

      continue;

    }

    if (isCscaOnlyLine(line) && !/^\d+\s+/.test(line)) {

      ctxCsca = line;

      continue;

    }

    const mIdx = line.match(/^(\d{1,3})\s+(.+)$/);

    if (mIdx) {

      const idx = Number(mIdx[1]);

      const rest = normalizeLine(mIdx[2]);

      if (cur) blocks.push(cur);

      cur = {

        idx,

        lines: rest ? [rest] : [],

        ctxFaculty,

        ctxTuition,

        ctxCsca,

      };

      continue;

    }

    if (cur) {

      cur.lines.push(line);

    }

  }

  if (cur) blocks.push(cur);

  // ---- 2) 逐块抽字段（保证 idx 对齐） ----

  const rows: ProgramCatalogRow[] = [];

  for (const b of blocks) {

    const blob = b.lines

      .map((x) => normalizeLine(x))

      .filter(Boolean)

      .join(" ");

    const blobClean = blob.replace(/中国人民大学[^ ]*/g, "").trim();

    // ---- tuition ----

    let tuition: number | null = null;

    {

      const m = blobClean.match(/(\d{4,6})\s*(元|￥)/);

      tuition = m ? toInt(m[1]) : null;

      if (!tuition) tuition = b.ctxTuition ?? null;

    }

    // ---- csca ----

    let cscaText = "";

    {

      const m = blobClean.match(/(\d{4,6}\s*(?:元|￥))\s*(.+)$/);

      if (m) cscaText = normalizeLine(m[2] || "");

      if (!cscaText && b.ctxCsca) cscaText = b.ctxCsca;

      cscaText = cscaText.replace(/（.*?）/g, "").trim();

    }

    const csca_subjects = cscaText ? splitList(cscaText) : [];

    // ---- notes ----

    let notes: string | null = null;

    {

      const mm = blob.match(/（([^）]{10,2000})）/);

      if (mm) notes = normalizeLine(mm[1]);

    }

    // ---- faculty ----

    let faculty: string | null = null;

    {

      const m = blobClean.match(/([\u4e00-\u9fff]{2,30}(学院|系|部|中心|研究院|学部|书院))/);

      faculty = m ? normalizeLine(m[1]) : null;

      if (!faculty) faculty = b.ctxFaculty ?? null;

    }

    // ---- majors ----

    let admissionsMajor: string | null = null;

    let teachingMajor: string | null = null;

    {

      let pre = blobClean;

      const m = blobClean.match(/^(.*?)(\d{4,6}\s*(?:元|￥))/);

      if (m) pre = normalizeLine(m[1]);

      if (faculty) {

        pre = pre.replace(new RegExp("^" + escapeRegExp(faculty) + "\\s*"), "").trim();

      }

      pre = pre

        .replace(/[\u4e00-\u9fff]{2,30}(学院|系|部|中心|研究院|学部|书院)\s*/g, (m0) => {

          return pre.startsWith(m0.trim()) ? "" : m0;

        })

        .trim();

      const tokens = pre.split(" ").map((x) => x.trim()).filter(Boolean);

      if (tokens.length === 0) {

        admissionsMajor = null;

        teachingMajor = null;

      } else if (tokens.length === 1) {

        admissionsMajor = tokens[0];

        teachingMajor = tokens[0];

      } else {

        admissionsMajor = tokens[0];

        teachingMajor = tokens.slice(1).join(" ").trim();

      }

      if (teachingMajor && isCscaOnlyLine(teachingMajor)) {

        teachingMajor = admissionsMajor;

      }

    }

    // ✅ 过滤明显垃圾项

    if (looksBadMajorName(admissionsMajor)) {

      continue;

    }

    const program_tracks = teachingMajor ? splitList(teachingMajor) : [];

    rows.push({

      idx: b.idx,

      faculty,

      program_name_cn: admissionsMajor,

      teaching_program_cn: teachingMajor,

      program_tracks,

      tuition_rmb_per_year: tuition,

      csca_subjects,

      notes,

      raw_block: blob,

    });

  }

  rows.sort((a, b) => a.idx - b.idx);

  return { meta, rows };

}