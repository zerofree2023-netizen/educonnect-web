// app/api/admin/schools/list/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 60;

// ✅ 用这个字段验证：你看到它，就说明当前 API 跑的是这份新代码
const DEBUG_VERSION = "list_route_v4_chunk_profile_20260303";

async function fetchWithRetry(input: RequestInfo | URL, init?: RequestInit) {
  const maxAttempts = 3;
  let lastErr: any = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await fetch(input, init);
    } catch (err: any) {
      lastErr = err;
      const msg = String(err?.message || err || "");
      const retryable =
        /fetch failed|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|socket|TLS/i.test(msg);

      if (!retryable || attempt === maxAttempts) break;

      await new Promise((r) => setTimeout(r, 300 * attempt));
    }
  }

  throw lastErr;
}

function supabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");

  return createClient(url, key, {
    auth: { persistSession: false },
    global: { fetch: fetchWithRetry as typeof fetch },
  });
}

function clampInt(v: string | null, def: number, min: number, max: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function chunk<T>(arr: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function GET(req: Request) {
  try {
    const supabase = supabaseAdmin();
    const url = new URL(req.url);

    // ⚠️ 前端传 limit=2000，但这里最大 500（没问题）
    const limit = clampInt(url.searchParams.get("limit"), 200, 1, 500);
    const offset = clampInt(url.searchParams.get("offset"), 0, 0, 200_000);

    const q = (url.searchParams.get("q") || "").trim();
    const province = (url.searchParams.get("province") || "").trim();
    const onlyQs = (url.searchParams.get("only_qs") || "").trim(); // "1"
    const complete = (url.searchParams.get("complete") || "").trim(); // 全部/已完成/未完成
    const onlyComplete = (url.searchParams.get("only_complete") || "").trim(); // "1"
    const onlyIncomplete = (url.searchParams.get("only_incomplete") || "").trim(); // "1"

    // 1) 主表：studyinchina_schools（⚠️不要选 public_data，这列不存在）
    let query = supabase
      .from("studyinchina_schools")
      .select(
        "school_id, school_name, school_name_en, province_name, province, city_name, city, qs_rank, qs_year, qs_source, extra",
        { count: "exact" }
      )
    .order("shanghairanking_rank", { ascending: true, nullsFirst: false })
    .order("school_name", { ascending: true });
    if (q) {
      const qq = q.replace(/"/g, '\\"');
      query = query.or(`school_name.ilike.%${qq}%,school_name_en.ilike.%${qq}%,school_id.ilike.%${qq}%`);
    }

    if (province && province !== "全部") {
      query = query.or(`province_name.eq.${province},province.eq.${province}`);
    }

    if (onlyQs === "1") {
      query = query.not("qs_rank", "is", null);
    }

    // 2) 完成度筛选：先查 ingest_status 表拿 id，再 in 回 schools
    if (complete === "已完成" || complete === "未完成" || onlyComplete === "1" || onlyIncomplete === "1") {
      const wantComplete =
        complete === "已完成" || onlyComplete === "1"
          ? true
          : complete === "未完成" || onlyIncomplete === "1"
          ? false
          : null;

      if (wantComplete !== null) {
        const { data: idsData, error: idsErr } = await supabase
          .from("studyinchina_school_ingest_status")
          .select("school_id")
          .eq("is_complete", wantComplete)
          .range(0, 20000);

        if (idsErr) throw idsErr;

        const ids = (idsData || []).map((x: any) => x.school_id).filter(Boolean);
        if (ids.length === 0) {
          return NextResponse.json({
            ok: true,
            rows: [],
            nextOffset: 0,
            total: 0,
            debug_version: DEBUG_VERSION,
            debug_profile_rows: 0,
            debug_profile_err: null,
          });
        }
        query = query.in("school_id", ids);
      }
    }

    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;
    if (error) throw error;

    const rows = (data || []) as any[];

    // 这页最多 500
    const ids = rows.map((x) => String(x.school_id || "").trim()).filter(Boolean);
    const idsLimited = ids.slice(0, 500);

    // 3) 批量补齐 ingest（同样分批，避免 in 太长）
    let ingestMap = new Map<string, any>();
    for (const part of chunk(idsLimited, 100)) {
      const { data: sdata, error: serror } = await supabase
        .from("studyinchina_school_ingest_status")
        .select(
          "school_id, is_complete, program_count, latest_created_at, latest_filename, is_complete_v2, missing_core, missing_optional"
        )
        .in("school_id", part);

      if (serror) {
        // ingest 不致命：跳过
        continue;
      }
      if (Array.isArray(sdata)) {
        for (const s of sdata) ingestMap.set(String(s.school_id), s);
      }
    }

    // 4) 批量补齐 profile_overrides.public_data（✅ 关键：分批）
    let profileMap = new Map<string, any>();
    let debugProfileRows = 0;
    let debugProfileErr: any = null;

    for (const part of chunk(idsLimited, 100)) {
      const { data: pdata, error: perr } = await supabase
        .from("school_profile_overrides")
        .select("school_id, public_data")
        .in("school_id", part);

      if (perr) {
        // ✅ 把错误带回去（你 Network 一眼就能看到）
        debugProfileErr = { message: perr.message, code: (perr as any).code ?? null };
        continue;
      }
      if (Array.isArray(pdata)) {
        debugProfileRows += pdata.length;
        for (const p of pdata) profileMap.set(String(p.school_id), p);
      }
    }

    // 5) 合并：强制每行都有 public_data（哪怕空对象）
const mergedRows = rows.map((x) => {
  const sid = String(x.school_id || "").trim();
  const prof = profileMap.get(sid);
  const public_data = prof?.public_data && typeof prof.public_data === "object" ? prof.public_data : {};
  const extra = x.extra && typeof x.extra === "object" ? x.extra : {};

  return {
    ...x,
    public_data,
    ingest: ingestMap.get(sid) || null,

    intl_admissions_title: String(extra.intl_admissions_title || public_data.intl_admissions_title || ""),
    intl_admissions_note: String(extra.intl_admissions_note || public_data.intl_admissions_note || ""),
    intl_admissions_url: String(
      extra.intl_admissions_url ||
      public_data.intl_admissions_url ||
      extra.intl_admissions_candidates_2026_best_url ||
      ""
    ),
  };
});

    return NextResponse.json({
      ok: true,
      rows: mergedRows,
      nextOffset: offset + mergedRows.length,
      total: count ?? null,
      debug_version: DEBUG_VERSION,
      debug_profile_rows: debugProfileRows,
      debug_profile_err: debugProfileErr,
    });
  } catch (err: any) {
    console.error("schools list route err:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || String(err), debug_version: DEBUG_VERSION },
      { status: 500 }
    );
  }
}