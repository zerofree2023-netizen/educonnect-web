// app/api/admin/schools/[school_id]/latest/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";


async function fetchWithRetry(input: RequestInfo | URL, init?: RequestInit) {
  const retries = 3;
  let lastErr: any = null;

  for (let i = 0; i < retries; i++) {
    try {
      return await fetch(input, init);
    } catch (e: any) {
      lastErr = e;
      const msg = String(e?.message || e || "");
      const retryable =
        /fetch failed|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|socket disconnected|TLS connection/i.test(msg);

      if (!retryable || i === retries - 1) throw e;
      await new Promise((r) => setTimeout(r, 400 * (i + 1)));
    }
  }

  throw lastErr;
}

function supabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false }, global: { fetch: fetchWithRetry as typeof fetch } });
}

/**
 * ✅ 跟 overrides 表的 program_key 对齐
 */
function pickProgramKey(r: any) {
  const dept = String(r?.dept_code ?? "").trim();
  const major = String(r?.major_code ?? "").trim();
  const track = String(r?.track_code ?? "").trim();
  if (dept && major && track) return `${dept}:${major}:${track}`;

  const mc = String(r?.major_code ?? "").trim();
  if (mc) return mc;

  const cn = String(r?.program_name_cn ?? "").trim();
  if (cn) return cn;

  const en = String(r?.program_name_en ?? "").trim();
  return en || "";
}

type ProgramOverrideRow = {
  program_key: string;
  patch: Record<string, any> | null;
  locks: Record<string, boolean> | null;
  updated_at?: string | null;
};

function applyOverridesToCatalog(catalog: any[], overrides: ProgramOverrideRow[]) {
  const ovMap = new Map<string, ProgramOverrideRow>();
  for (const o of overrides || []) {
    const k = String(o?.program_key ?? "").trim();
    if (!k) continue;
    ovMap.set(k, o);
  }

  return (catalog || []).map((row) => {
    const key = pickProgramKey(row);
    const ov = key ? ovMap.get(key) : null;
    if (!ov) return row;

    const patch = ov.patch && typeof ov.patch === "object" ? ov.patch : {};
    const locks = ov.locks && typeof ov.locks === "object" ? ov.locks : {};

    return {
      ...row,
      ...patch,
      __override: {
        program_key: ov.program_key,
        locks,
        updated_at: ov.updated_at ?? null,
      },
    };
  });
}

// ✅ 关键：按 school_id 读学校中文名/英文名（你的字段是 school_name / school_name_en）
async function loadSchoolName(supabase: any, school_id: string) {
  const candidates = ["admin_schools_list_v2", "admin_schools_list"]; // 优先 v2

  for (const table of candidates) {
    const { data, error } = await supabase
      .from(table)
      .select("school_id,school_name,school_name_en")
      .eq("school_id", school_id)
      .maybeSingle();

    if (error) {
      // 表不存在 / 字段不存在 -> 继续尝试下一个
      continue;
    }

    if (data) {
      const cn = String((data as any).school_name || "").trim();
      const en = String((data as any).school_name_en || "").trim();
      return {
        school_name_cn: cn || null,
        school_name_en: en || null,
        _name_from: table, // 可选：方便你调试看到是从哪个表取到的
      };
    }
  }

  return { school_name_cn: null, school_name_en: null, _name_from: null };
}

export async function GET(req: Request, ctx: { params: Promise<{ school_id?: string }> }) {
  try {
    const { school_id } = await ctx.params;
    if (!school_id) return NextResponse.json({ ok: false, error: "missing school_id" }, { status: 400 });

    const supabase = supabaseAdmin();

    // ✅ 新增：读取 kind
    const u = new URL(req.url);
    const kind = String(u.searchParams.get("kind") || "").trim(); // ug/master/phd/apply_guide/other

    let q = supabase
      .from("school_files")
      .select("id, created_at, filename, parsed_json, kind")
      .eq("school_id", school_id);

    if (kind) q = q.eq("kind", kind);

    const { data, error } = await q.order("created_at", { ascending: false }).limit(1);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    const row = Array.isArray(data) ? data[0] : null;

    // ✅ 即使没入库，也把学校名返回，方便前端显示
    if (!row) {
      const name = await loadSchoolName(supabase, school_id);
      return NextResponse.json({ ok: true, ...name, row: null });
    }

    // overrides
    const { data: ovs, error: ovErr } = await supabase
      .from("school_program_catalog_overrides")
      .select("program_key, patch, locks, updated_at")
      .eq("school_id", school_id);

    if (ovErr) {
      return NextResponse.json({ ok: false, error: "load overrides failed: " + ovErr.message }, { status: 500 });
    }

    const parsed = (row.parsed_json || {}) as any;
    const catalog = Array.isArray(parsed?.program_catalog) ? parsed.program_catalog : [];
    const appliedCatalog = applyOverridesToCatalog(catalog, Array.isArray(ovs) ? (ovs as any) : []);

    const effective = {
      ...parsed,
      program_catalog: appliedCatalog,
      program_catalog_meta: {
        ...(parsed?.program_catalog_meta || {}),
        overrides_count: Array.isArray(ovs) ? ovs.length : 0,
      },
    };

    // ✅ 加学校名

    // =========================
// Header synonyms / normalize
// =========================
function normalizeHeader(raw: any) {
  const s = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[：:，,（）()【】[\]·•]/g, "")
    .replace(/（.*?）/g, ""); // 去掉括号备注
  return s;
}

// 标准字段 -> 近义词（把你遇到的学校写法不断加进来就行）
const HEADER_ALIASES: Record<string, string[]> = {
  // 学院/院系
  faculty_cn: ["学院", "院系", "培养单位", "开课学院", "所属学院", "所在学院", "院部"],
  // 专业代码
  major_code: ["专业代码", "学科代码", "专业编号", "代码"],
  // 专业中文
  program_name_cn: ["专业名称", "专业", "学科", "学科名称", "专业中文", "专业名称中文", "招生专业", "招生学科"],
  // 专业英文
  program_name_en: ["专业英文", "专业名称英文", "英文名称", "program", "programname"],
  // 方向
  track_name_cn: ["研究方向", "方向", "专业方向", "方向名称", "研究方向名称"],
  // 授课语言
  language_text: ["授课语言", "教学语言", "授课语种", "language", "授课方式语言"],
  // 学位类型
  degree_type: ["学位类型", "学位", "授予学位", "学位类别", "degree"],
  // 学习方式
  study_mode_cn: ["学习方式", "学习形式", "培养方式", "全日制", "非全日制", "study mode"],
  // 学制
  duration_years: ["学制", "学制年", "修业年限", "学制年限", "学习年限", "年限", "duration"],
  // 学费（年）
  tuition_rmb_per_year: ["学费", "学费年", "学费每年", "学费元年", "收费标准", "费用", "收费", "rmb", "tuition"],
  // 学费（总计）
  tuition_total_rmb: ["学费总计", "总学费", "学费合计", "总费用", "费用合计", "total tuition"],
  // 按年？
  tuition_is_per_year: ["按年", "按年收费", "是否按年", "按年?", "peryear"],
  // 学费说明
  tuition_note: ["学费说明", "收费说明", "费用说明", "备注学费", "收费备注"],
  // 联系方式
  contact_raw: ["联系方式", "联系人", "咨询方式", "联系邮箱", "电话", "contact"],
  // 备注
  remarks: ["备注", "说明", "备注说明", "备注信息"],
};

// 反向索引：normalized_header -> standard_key
const HEADER_LOOKUP = (() => {
  const m = new Map<string, string>();

  // 标准字段本身也加入（比如 header 就是 tuition_rmb_per_year）
  for (const k of Object.keys(HEADER_ALIASES)) m.set(normalizeHeader(k), k);

  for (const [stdKey, aliases] of Object.entries(HEADER_ALIASES)) {
    for (const a of aliases) {
      m.set(normalizeHeader(a), stdKey);
    }
  }
  return m;
})();

function resolveColKey(headerCell: any): string | null {
  const nh = normalizeHeader(headerCell);
  if (!nh) return null;

  // 1) 精确命中
  const hit = HEADER_LOOKUP.get(nh);
  if (hit) return hit;

  // 2) 模糊兜底：比如 “培养单位（学院）” 这种
  //    只要包含某些关键词，就判定
  const contains = (kw: string) => nh.includes(normalizeHeader(kw));
  if (contains("学院") || contains("院系") || contains("培养单位")) return "faculty_cn";
  if (contains("专业代码") || contains("学科代码") || contains("代码")) return "major_code";
  if (contains("学费") || contains("收费") || contains("费用")) return "tuition_rmb_per_year";
  if (contains("学制") || contains("年限") || contains("修业")) return "duration_years";
  if (contains("授课语言") || contains("教学语言") || contains("语种")) return "language_text";
  if (contains("方向")) return "track_name_cn";

  return null;
}
    const name = await loadSchoolName(supabase, school_id);

    return NextResponse.json({
      ok: true,
      ...name,
      row: {
        id: row.id,
        created_at: row.created_at,
        filename: row.filename,
        kind: row.kind ?? null,
        parsed: effective,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}