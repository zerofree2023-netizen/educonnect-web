"use client";

import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type IngestRow = {
  school_id: string;
  is_complete: boolean;
  program_count: number | null;
  latest_created_at: string | null;
  latest_filename: string | null;

  is_complete_v2?: boolean | null;
  missing_core?: any;
  missing_optional?: any;
};

type Row = {
  school_id: string;
  school_name: string | null;
  school_name_en: string | null;

  province?: string | null;
  province_name?: string | null;
  city?: string | null;
  city_name?: string | null;

  qs_rank?: number | null;
  qs_year?: number | null;
  qs_source?: string | null;

  extra?: any;
  public_data?: any; // ✅ 详情页保存的 intl_admissions_url 在这里

  // ✅ 兼容 list API 顶层直接返回 intl_admissions_url
  intl_admissions_url?: string | null;
  intl_admissions_title?: string | null;
intl_admissions_note?: string | null;

  ingest?: IngestRow | null;
};

type ApiResp =
  | { ok: true; rows: Row[]; nextOffset?: number; total?: number | null }
  | { ok: false; error: string };

const PROVINCES = [
  "全部",
  "北京市",
  "天津市",
  "河北省",
  "山西省",
  "内蒙古自治区",
  "辽宁省",
  "吉林省",
  "黑龙江省",
  "上海市",
  "江苏省",
  "浙江省",
  "安徽省",
  "福建省",
  "江西省",
  "山东省",
  "河南省",
  "湖北省",
  "湖南省",
  "广东省",
  "广西壮族自治区",
  "海南省",
  "重庆市",
  "四川省",
  "贵州省",
  "云南省",
  "西藏自治区",
  "陕西省",
  "甘肃省",
  "青海省",
  "宁夏回族自治区",
  "新疆维吾尔自治区",
  "台湾省",
  "香港特别行政区",
  "澳门特别行政区",
];

const RANK_TYPES = ["全部", "软科", "校友会", "QS"] as const;
const COMPLETE_TYPES = ["全部", "已完成", "未完成"] as const;

const SORT_OPTIONS = [
  "默认(学校名)",
  "软科分数↓",
  "软科排名↑",
  "QS排名↑",
  "完成度(未完成优先)",
  "省份A→Z",
  "学科A+优先→软科→985/211",
] as const;

// ===== 本地英文名覆盖（详情页保存 -> 列表同步显示）=====
const EN_OVERRIDE_KEY = "school_en_overrides_v1";
function getEnOverrideById(id?: string) {
  if (!id) return "";
  if (typeof window === "undefined") return "";
  try {
    const raw = window.localStorage.getItem(EN_OVERRIDE_KEY);
    const m = raw ? JSON.parse(raw) : {};
    const v = m && typeof m === "object" ? (m as any)[id] : "";
    return String(v || "").trim();
  } catch {
    return "";
  }
}

function FilterRow(props: { label: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "90px 1fr",
        gap: 12,
        alignItems: "start",
        padding: "10px 0",
      }}
    >
      <div style={{ fontSize: 13, color: "#374151", paddingTop: 7, whiteSpace: "nowrap" }}>
        {props.label}：
      </div>
      <div>{props.children}</div>
    </div>
  );
}

function Chip(props: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={props.onClick}
      style={{
        height: 30,
        padding: "0 10px",
        borderRadius: 999,
        border: "1px solid " + (props.active ? "#ef4444" : "#e5e7eb"),
        background: props.active ? "#fff1f2" : "#fff",
        color: props.active ? "#b91c1c" : "#111827",
        cursor: "pointer",
        fontSize: 12,
        whiteSpace: "nowrap",
      }}
    >
      {props.children}
    </button>
  );
}

// ✅ 官网（学校名点击打开）：只用官网，不混用招生
function pickWebsite(x: any): string {
  const w = String(x?.extra?.website || x?.extra?.shanghairanking?.link || x?.website || "").trim();
  if (!w) return "";
  return /^https?:\/\//i.test(w) ? w : `https://${w}`;
}

// ✅ 招生链接（“招生”标签使用）
// ✅ 优先级：顶层 intl_admissions_url > public_data > extra.intl_admissions_url > best_url
function pickIntlAdmissionsUrl(x: any): string {
  const u = String(
    x?.intl_admissions_url ||
      x?.public_data?.intl_admissions_url ||
      x?.extra?.intl_admissions_url ||
      x?.extra?.intl_admissions_candidates_2026_best_url ||
      ""
  ).trim();
  if (!u) return "";
  return /^https?:\/\//i.test(u) ? u : `https://${u}`;
}

// ✅ 招生年份：只看最终会打开的 intlUrl（最稳）
function pickIntlYear(x: any): "2026" | "2025" | "2024" | "" {
  const u = pickIntlAdmissionsUrl(x).toLowerCase();
  if (!u) return "";

  // 取最大年份，避免 "2025-2026" 这种学年误判为 2025
  const years = Array.from(u.matchAll(/20(2[4-9])/g)).map((m) => Number(`20${m[1]}`));
  if (years.length === 0) return "";

  const y = Math.max(...years);
  if (y === 2026) return "2026";
  if (y === 2025) return "2025";
  if (y === 2024) return "2024";
  return "";
}

// ✅ 学位（基于 MOE 名单 level：本科/硕士/博士/未知）
function pickDegreeLevel(x: any): "本科" | "硕士" | "博士" | "未知" {
  const lv = String(x?.extra?.moe?.level || "").trim();
  if (lv === "本科") return "本科";
  if (lv === "硕士") return "硕士";
  if (lv === "博士") return "博士";
  return "未知";
}

// ✅ 本科/硕士/博士：三个标签（优先用 degree_package_2026）
function pickDegreeLinks(x: any): { ug: string; master: string; phd: string } {
  const pkg = x?.extra?.intl_admissions_degree_package_2026 || x?.extra?.intl_admissions_degree_package || null;

  const ug = String(pkg?.ug || pkg?.undergraduate || "").trim();
  const master = String(pkg?.master || pkg?.graduate || "").trim();
  const phd = String(pkg?.phd || "").trim();

  const norm = (u: string) => {
    if (!u) return "";
    return /^https?:\/\//i.test(u) ? u : `https://${u}`;
  };

  return {
    ug: ug ? norm(ug) : "",
    master: master ? norm(master) : "",
    phd: phd ? norm(phd) : "",
  };
}

// ========= 学科详情（展开）=========
type DiscRow = { discipline_name: string; grade: string; rank_text: string };
type DiscBundle = { disciplines: DiscRow[]; total: number };

// ========= 学科汇总（全局排序/筛选用）=========
type DiscSummary = {
  school_id: string;
  total: number;
  a_plus: number;
  by_grade: Record<string, number>;
};

function summarizeGradesFromSummary(s?: DiscSummary | null) {
  if (!s || !s.by_grade) return "-";
  const keys = Object.keys(s.by_grade).filter((k) => (s.by_grade[k] || 0) > 0);
  if (keys.length === 0) return "-";
  const order = ["A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-"];
  keys.sort(
    (a, b) =>
      (order.indexOf(a) === -1 ? 999 : order.indexOf(a)) - (order.indexOf(b) === -1 ? 999 : order.indexOf(b))
  );
  return keys.map((k) => `${k}(${s.by_grade[k]})`).join(" ");
}

// ===== URL query helpers =====
function spGet(sp: URLSearchParams, k: string) {
  const v = sp.get(k);
  return v == null ? "" : String(v);
}
function spGetInt(sp: URLSearchParams, k: string, fallback: number) {
  const v = Number(sp.get(k));
  return Number.isFinite(v) ? v : fallback;
}
function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function AdminSchoolsListPageInner() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const [allRows, setAllRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // ===== filters/state =====
  const [q, setQ] = useState("");
  const [province, setProvince] = useState("全部");
  const [rankType, setRankType] = useState<(typeof RANK_TYPES)[number]>("全部");
  const [completeType, setCompleteType] = useState<(typeof COMPLETE_TYPES)[number]>("全部");
  const [sortBy, setSortBy] = useState<(typeof SORT_OPTIONS)[number]>("软科分数↓");

  const [discFilter, setDiscFilter] = useState<"all" | "has_disc" | "has_a_plus">("all");
  const [admissionsFilter, setAdmissionsFilter] = useState<"all" | "has" | "none">("all");
  const [yearFilter, setYearFilter] = useState<"" | "2026" | "2025" | "2024">("");
  const [degreeFilter, setDegreeFilter] = useState<"all" | "本科" | "硕士" | "博士" | "未知">("all");

  const [total, setTotal] = useState<number | null>(null);
  const [pageSize, setPageSize] = useState<number>(50);
  const [pageIndex, setPageIndex] = useState(0);

  const [discMap, setDiscMap] = useState<Record<string, DiscBundle>>({});
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({});
  const [summaryMap, setSummaryMap] = useState<Record<string, DiscSummary>>({});

  // ===== 1) 初始化：从 URL query 恢复状态（保证返回 list 不回第一页）=====
  const didInitFromQuery = useRef(false);
  useEffect(() => {
    if (didInitFromQuery.current) return;
    didInitFromQuery.current = true;

    const q0 = spGet(sp as any, "q");
    const province0 = spGet(sp as any, "prov") || "全部";
    const rankType0 = (spGet(sp as any, "rt") as any) || "全部";
    const complete0 = (spGet(sp as any, "ct") as any) || "全部";
    const sort0 = (spGet(sp as any, "sb") as any) || "软科分数↓";

    const disc0 = (spGet(sp as any, "df") as any) || "all";
    const adm0 = (spGet(sp as any, "af") as any) || "all";
    const year0 = (spGet(sp as any, "yf") as any) || "";
    const deg0 = (spGet(sp as any, "deg") as any) || "all";

    const ps0 = clamp(spGetInt(sp as any, "ps", 50), 10, 500);
    const pi0 = Math.max(0, spGetInt(sp as any, "pi", 0));

    setQ(q0);
    setProvince(PROVINCES.includes(province0) ? province0 : "全部");
    setRankType(RANK_TYPES.includes(rankType0) ? rankType0 : "全部");
    setCompleteType(COMPLETE_TYPES.includes(complete0) ? complete0 : "全部");
    setSortBy(SORT_OPTIONS.includes(sort0) ? sort0 : "软科分数↓");

    setDiscFilter(["all", "has_disc", "has_a_plus"].includes(disc0) ? disc0 : "all");
    setAdmissionsFilter(["all", "has", "none"].includes(adm0) ? adm0 : "all");
    setYearFilter((["", "2026", "2025", "2024"] as any).includes(year0) ? year0 : "");
    setDegreeFilter((["all", "本科", "硕士", "博士", "未知"] as any).includes(deg0) ? deg0 : "all");

    setPageSize(ps0);
    setPageIndex(pi0);

    // 首次加载不强制回到第一页
    loadAll(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp]);

  // ===== 2) URL 同步：任何状态改变就写回 query（这样返回 list 能恢复）=====
  const writeQuery = (patch?: Partial<Record<string, string>>) => {
    const next = new URLSearchParams(sp?.toString() || "");

    const setOrDel = (k: string, v: string) => {
      const vv = String(v || "").trim();
      if (!vv) next.delete(k);
      else next.set(k, vv);
    };

    // 当前 state -> query
    setOrDel("q", q);
    setOrDel("prov", province === "全部" ? "" : province);
    setOrDel("rt", rankType === "全部" ? "" : rankType);
    setOrDel("ct", completeType === "全部" ? "" : completeType);
    setOrDel("sb", sortBy);

    setOrDel("df", discFilter);
    setOrDel("af", admissionsFilter);
    setOrDel("yf", yearFilter);
    setOrDel("deg", degreeFilter);

    setOrDel("ps", String(pageSize));
    setOrDel("pi", String(pageIndex));

    // patch 覆盖
    if (patch) {
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined) continue;
        setOrDel(k, v as any);
      }
    }

    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false } as any);
  };

  // 避免初始化阶段把 query 乱写
  useEffect(() => {
    if (!didInitFromQuery.current) return;
    writeQuery();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    q,
    province,
    rankType,
    completeType,
    sortBy,
    discFilter,
    admissionsFilter,
    yearFilter,
    degreeFilter,
    pageSize,
    pageIndex,
  ]);

  // ===== returnTo & goDetail =====
  const getReturnTo = () => {
    const qs = (sp?.toString() || "").trim();
    return qs ? `${pathname}?${qs}` : pathname;
  };

  function goDetail(school_id: string) {
    const returnTo = encodeURIComponent(getReturnTo());
    router.push(`/admin/schools/${encodeURIComponent(school_id)}?returnTo=${returnTo}`);
  }

  async function loadAll(resetPage = true) {
    setLoading(true);
    setErr(null);

    try {
      const apiUrl =
        `/api/admin/schools/list?limit=2000&offset=0` +
        (q.trim() ? `&q=${encodeURIComponent(q.trim())}` : "") +
        (province && province !== "全部" ? `&province=${encodeURIComponent(province)}` : "") +
        (rankType && rankType !== "全部" ? `&rankType=${encodeURIComponent(rankType)}` : "") +
        (completeType && completeType !== "全部" ? `&complete=${encodeURIComponent(completeType)}` : "");

      const r = await fetch(apiUrl, { cache: "no-store" });
      const j = (await r.json().catch(() => null)) as ApiResp | null;
      if (!r.ok || !j || !("ok" in j) || !j.ok) throw new Error((j as any)?.error || `HTTP ${r.status}`);

      const rows: Row[] = Array.isArray(j.rows) ? j.rows : [];
      setAllRows(rows);
      setTotal((j as any).total ?? rows.length);

      if (resetPage) setPageIndex(0);
      setOpenMap({});
      setDiscMap({});

      const ids = rows.map((x) => String(x.school_id || "").trim()).filter(Boolean);

      if (ids.length > 0) {
        try {
          const r2 = await fetch(`/api/admin/schools/disciplines-summary-batch`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ school_ids: ids }), // ✅ 后端吃 school_ids
          });

          const j2 = (await r2.json().catch(() => null)) as any;

          if (r2.ok && j2?.ok && Array.isArray(j2.rows)) {
            const m: Record<string, DiscSummary> = {};
            for (const it of j2.rows) {
              const sid = String(it?.school_id || "").trim();
              if (!sid) continue;
              m[sid] = {
                school_id: sid,
                total: Number(it?.total ?? 0) || 0,
                a_plus: Number(it?.a_plus ?? 0) || 0,
                by_grade: it?.by_grade && typeof it.by_grade === "object" ? it.by_grade : {},
              };
            }
            setSummaryMap(m);
          } else {
            setSummaryMap({});
          }
        } catch {
          // ✅ 学科汇总失败：只清空 summary，不影响学校列表
          setSummaryMap({});
        }
      } else {
        setSummaryMap({});
      }
    } catch (e: any) {
      setAllRows([]);
      setTotal(null);
      setSummaryMap({});
      setDiscMap({});
      setErr(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  // ✅ 兜底：如果没走 init，也加载一次
  useEffect(() => {
    if (didInitFromQuery.current) return;
    loadAll(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered0 = useMemo(() => {
    const kw = q.trim().toLowerCase();

    return allRows.filter((x) => {
      if (kw) {
        const blob = `${x.school_id} ${x.school_name ?? ""} ${x.school_name_en ?? ""}`.toLowerCase();
        if (!blob.includes(kw)) return false;
      }

      if (province !== "全部") {
        const p = String(x.province_name || x.province || "").trim();
        if (p !== province) return false;
      }

      const intl = pickIntlAdmissionsUrl(x);
      if (admissionsFilter === "has" && !intl) return false;
      if (admissionsFilter === "none" && intl) return false;

      if (yearFilter) {
        const y = pickIntlYear(x);
        if (y !== yearFilter) return false;
      }

      if (degreeFilter !== "all") {
        const lv = pickDegreeLevel(x);
        if (lv !== degreeFilter) return false;
      }

      return true;
    });
  }, [allRows, q, province, admissionsFilter, yearFilter, degreeFilter]);

  const filteredByDisc = useMemo(() => {
    if (discFilter === "all") return filtered0;
    return filtered0.filter((x) => {
      const sid = String(x.school_id || "").trim();
      const s = summaryMap[sid];
      const total2 = Number(s?.total ?? 0) || 0;
      const aPlus2 = Number(s?.a_plus ?? 0) || 0;
      if (discFilter === "has_disc") return total2 > 0;
      if (discFilter === "has_a_plus") return aPlus2 > 0;
      return true;
    });
  }, [filtered0, discFilter, summaryMap]);

  const sorted = useMemo(() => {
    const arr = [...filteredByDisc];

    const shScore = (x: any) => Number(x?.extra?.shanghairanking?.total_score ?? -1);
    const shRank = (x: any) => {
      const v = Number(x?.extra?.shanghairanking?.rank ?? 1e9);
      return Number.isFinite(v) ? v : 1e9;
    };
    const qsRank = (x: any) => {
      const v = Number(x?.qs_rank ?? 1e9);
      return Number.isFinite(v) ? v : 1e9;
    };
    const done = (x: any) => Boolean((x as any).is_complete ?? x?.ingest?.is_complete ?? false);

    const flag985 = (x: any) => Boolean(x?.extra?.school_level_flags?.is_985);
    const flag211 = (x: any) => Boolean(x?.extra?.school_level_flags?.is_211);

    const aPlusCount = (x: any) => {
      const sid = String(x?.school_id || "").trim();
      return Number(summaryMap?.[sid]?.a_plus ?? 0) || 0;
    };

    arr.sort((a: any, b: any) => {
      switch (sortBy) {
        case "软科分数↓":
          return shScore(b) - shScore(a);
        case "软科排名↑":
          return shRank(a) - shRank(b);
        case "QS排名↑":
          return qsRank(a) - qsRank(b);
        case "完成度(未完成优先)":
          return Number(done(a)) - Number(done(b));
        case "省份A→Z":
          return String(a?.province_name ?? a?.province ?? "").localeCompare(
            String(b?.province_name ?? b?.province ?? "")
          );
        case "学科A+优先→软科→985/211": {
          const da = aPlusCount(a);
          const db = aPlusCount(b);
          if (db !== da) return db - da;

          const ra = shRank(a);
          const rb = shRank(b);
          if (ra !== rb) return ra - rb;

          const p985a = flag985(a) ? 1 : 0;
          const p985b = flag985(b) ? 1 : 0;
          if (p985b !== p985a) return p985b - p985a;

          const p211a = flag211(a) ? 1 : 0;
          const p211b = flag211(b) ? 1 : 0;
          if (p211b !== p211a) return p211b - p211a;

          return String(a?.school_name ?? "").localeCompare(String(b?.school_name ?? ""));
        }
        default:
          return String(a?.school_name ?? "").localeCompare(String(b?.school_name ?? ""));
      }
    });

    return arr;
  }, [filteredByDisc, sortBy, summaryMap]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(sorted.length / pageSize)), [sorted.length, pageSize]);

  useEffect(() => {
    if (pageIndex > totalPages - 1) setPageIndex(Math.max(0, totalPages - 1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalPages]);

  const pageRows = useMemo(() => {
    const start = pageIndex * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, pageIndex, pageSize]);

  async function loadDisciplinesForPage() {
    const ids = pageRows.map((x) => String(x.school_id || "").trim()).filter(Boolean);
    if (ids.length === 0) return;

    try {
      const r = await fetch(`/api/admin/schools/disciplines-batch?ids=${encodeURIComponent(ids.join(","))}`, {
        cache: "no-store",
      });
      const j = (await r.json().catch(() => null)) as any;
      if (r.ok && j?.ok && Array.isArray(j.rows)) {
        const nextMap: Record<string, DiscBundle> = {};
        for (const it of j.rows) {
          const sid = String(it?.school_id || "").trim();
          if (!sid) continue;
          nextMap[sid] = {
            disciplines: Array.isArray(it?.disciplines) ? it.disciplines : [],
            total: Number(it?.total ?? (it?.disciplines?.length ?? 0)) || 0,
          };
        }
        setDiscMap((prev) => ({ ...prev, ...nextMap }));
      }
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    loadDisciplinesForPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageIndex, pageRows.length]);

  const pageStyle: React.CSSProperties = {
    minHeight: "100vh",
    padding: 18,
    background: "#fff",
    color: "#111827",
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial',
  };

  const inputStyle: React.CSSProperties = {
    height: 36,
    borderRadius: 10,
    border: "1px solid #d1d5db",
    padding: "0 12px",
    outline: "none",
    background: "#fff",
    color: "#111827",
    width: 360,
    maxWidth: "100%",
  };

  const selectStyle: React.CSSProperties = {
    height: 36,
    borderRadius: 10,
    border: "1px solid #d1d5db",
    padding: "0 10px",
    outline: "none",
    background: "#fff",
    color: "#111827",
  };

  const filterCard: React.CSSProperties = {
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: "10px 14px",
    background: "#fff",
  };

  const tableWrap: React.CSSProperties = {
    marginTop: 14,
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    overflow: "hidden",
  };

  const headerRow: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "64px 280px 1fr 1fr 200px 320px 360px 220px",
    gap: 12,
    padding: "10px 12px",
    background: "#f9fafb",
    fontWeight: 700,
    fontSize: 13,
    color: "#374151",
  };

  const rowStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "64px 280px 1fr 1fr 200px 320px 360px 220px",
    gap: 12,
    padding: "10px 12px",
    borderTop: "1px solid #e5e7eb",
    alignItems: "start",
  };

  const btnTiny: React.CSSProperties = {
    height: 24,
    padding: "0 10px",
    borderRadius: 999,
    border: "1px solid #e5e7eb",
    background: "#fff",
    cursor: "pointer",
    fontSize: 12,
    whiteSpace: "nowrap",
  };

  const stickyPager: React.CSSProperties = {
    position: "sticky",
    bottom: 0,
    marginTop: 12,
    padding: 12,
    background: "#ffffff",
    borderTop: "1px solid #e5e7eb",
    borderRadius: 12,
    display: "flex",
    gap: 10,
    alignItems: "center",
    flexWrap: "wrap",
  };

  const pagerBtn: React.CSSProperties = {
    height: 32,
    padding: "0 12px",
    borderRadius: 10,
    border: "1px solid #e5e7eb",
    background: "#fff",
    cursor: "pointer",
  };

  const degreeChip = (label: string, url: string) => {
    const active = Boolean(url);
    return (
      <button
        key={label}
        onClick={(e) => {
          e.stopPropagation();
          if (url) window.open(url, "_blank", "noopener,noreferrer");
        }}
        title={url || `${label}：暂无链接`}
        style={{
          border: "1px solid " + (active ? "#e5e7eb" : "#f3f4f6"),
          background: active ? "#fff" : "#f9fafb",
          color: active ? "#111827" : "#9ca3af",
          height: 24,
          padding: "0 10px",
          borderRadius: 999,
          cursor: active ? "pointer" : "not-allowed",
          fontSize: 12,
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}
      >
        {label}
      </button>
    );
  };

const admissionsUrlCell = (intlUrl: string, intlTitle?: string, intlNote?: string) => {
  if (!intlUrl) return <span style={{ color: "#9ca3af" }}>-</span>;

  return (
    <div style={{ overflow: "hidden" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", overflow: "hidden" }}>
        <a
          href={intlUrl}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          title={intlUrl}
          style={{
            color: "#2563eb",
            textDecoration: "underline",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            display: "inline-block",
            maxWidth: "100%",
          }}
        >
          {intlTitle || intlUrl}
        </a>

        <button
          onClick={(e) => {
            e.stopPropagation();
            try {
              navigator.clipboard.writeText(intlUrl);
            } catch {}
          }}
          style={{
            height: 24,
            padding: "0 10px",
            borderRadius: 999,
            border: "1px solid #e5e7eb",
            background: "#fff",
            cursor: "pointer",
            fontSize: 12,
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
          title="复制招生网址"
        >
          复制
        </button>
      </div>

      {intlTitle ? (
        <div style={{ marginTop: 4, fontSize: 12, color: "#6b7280", whiteSpace: "normal" }}>
          title：{intlTitle}
        </div>
      ) : null}

      {intlNote ? (
        <div style={{ marginTop: 4, fontSize: 12, color: "#6b7280", whiteSpace: "normal" }}>
          note：{intlNote}
        </div>
      ) : null}
    </div>
  );
};


  return (
    <div style={pageStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>Schools</h1>
          <div style={{ marginTop: 4, fontSize: 12, color: "#6b7280" }}>
            all: {allRows.length} / after filter+sort: {sorted.length} / page: {pageIndex + 1}/{totalPages}{" "}
            {loading ? " / loading..." : ""} {total != null ? ` / total=${total}` : ""}
          </div>
          <div style={{ marginTop: 4, fontSize: 12, color: "#9ca3af" }}>当前列表状态已写入 URL（返回不会回第一页）</div>
        </div>

        <button
          onClick={() => loadAll(false)}
          style={{
            height: 36,
            padding: "0 14px",
            borderRadius: 10,
            border: "1px solid #d1d5db",
            background: "#111827",
            color: "#fff",
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          刷新
        </button>
      </div>

      <div style={{ marginTop: 14, ...filterCard }}>
        <FilterRow label="院校名称">
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
<input
  value={q}
  onChange={(e) => setQ(e.target.value)}
  onKeyDown={(e) => {
    if (e.key === "Enter") {
      setPageIndex(0);
      loadAll(true);
    }
  }}
  placeholder="请输入院校名称"
  style={inputStyle}
/>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} style={selectStyle}>
              {SORT_OPTIONS.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>

            <select value={discFilter} onChange={(e) => setDiscFilter(e.target.value as any)} style={selectStyle}>
              <option value="all">学科：全部</option>
              <option value="has_disc">学科：只看有评估</option>
              <option value="has_a_plus">学科：只看 A+≥1</option>
            </select>

            <select value={admissionsFilter} onChange={(e) => setAdmissionsFilter(e.target.value as any)} style={selectStyle}>
              <option value="all">招生：全部</option>
              <option value="has">招生：只看有链接</option>
              <option value="none">招生：只看无链接</option>
            </select>

            <select value={yearFilter} onChange={(e) => setYearFilter(e.target.value as any)} style={selectStyle}>
              <option value="">年份：全部</option>
              <option value="2026">年份：2026</option>
              <option value="2025">年份：2025</option>
              <option value="2024">年份：2024</option>
            </select>

            <select value={degreeFilter} onChange={(e) => setDegreeFilter(e.target.value as any)} style={selectStyle}>
              <option value="all">学位：全部</option>
              <option value="本科">学位：本科</option>
              <option value="硕士">学位：硕士</option>
              <option value="博士">学位：博士</option>
              <option value="未知">学位：未知</option>
            </select>

            <select
              value={String(pageSize)}
              onChange={(e) => {
                const v = Number(e.target.value);
                setPageSize(v);
                setPageIndex(0);
              }}
              style={selectStyle}
            >
              <option value="50">每页 50</option>
              <option value="100">每页 100</option>
              <option value="200">每页 200</option>
            </select>

            <button
              onClick={() => {
                setPageIndex(0);
                loadAll(true);
              }}
              style={{
                height: 36,
                padding: "0 14px",
                borderRadius: 10,
                border: "1px solid #ef4444",
                background: "#ef4444",
                color: "#fff",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              应用筛选
            </button>
          </div>
        </FilterRow>

        <FilterRow label="院校所属">
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {PROVINCES.map((p) => (
              <Chip
                key={p}
                active={province === p}
                onClick={() => {
                  setProvince(p);
                  setPageIndex(0);
                }}
              >
                {p}
              </Chip>
            ))}
          </div>
        </FilterRow>

        <FilterRow label="排名类型">
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {RANK_TYPES.map((t) => (
              <Chip
                key={t}
                active={rankType === t}
                onClick={() => {
                  setRankType(t);
                  setPageIndex(0);
                }}
              >
                {t}
              </Chip>
            ))}
          </div>
        </FilterRow>

        <FilterRow label="完成度">
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {COMPLETE_TYPES.map((t) => (
              <Chip
                key={t}
                active={completeType === t}
                onClick={() => {
                  setCompleteType(t);
                  setPageIndex(0);
                }}
              >
                {t}
              </Chip>
            ))}
          </div>
        </FilterRow>
      </div>

      {err && (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 12,
            border: "1px solid #fecaca",
            background: "#fff1f2",
            color: "#991b1b",
            whiteSpace: "pre-wrap",
          }}
        >
          {err}
        </div>
      )}

      <div style={tableWrap}>
        <div style={headerRow}>
          <div>#</div>
          <div>school_id</div>
          <div>School（点学校名打开官网）</div>
          <div>Province</div>
          <div>软科（rank/score）</div>
          <div>本校全部学科评估(第四轮)</div>
<div>
  招生网址（已保存）
  <div style={{ fontSize: 11, color: "#9ca3af", fontWeight: 400, marginTop: 4, lineHeight: 1.4 }}>
    title / note：extra → public_data
  </div>
  <div style={{ fontSize: 11, color: "#9ca3af", fontWeight: 400, lineHeight: 1.4 }}>
    url：extra → public_data → best_url
  </div>
</div>
          <div>QS / 完成</div>
        </div>
       
        {loading ? (
          <div style={{ padding: 14, opacity: 0.7 }}>Loading...</div>
        ) : pageRows.length === 0 ? (
          <div style={{ padding: 14, opacity: 0.7 }}>No rows.</div>
        ) : (
          pageRows.map((x, idx) => {
            const sid = String(x.school_id || "").trim();

            const done = (x as any).is_complete ?? x.ingest?.is_complete ?? false;
            const pc = (x as any).program_count ?? x.ingest?.program_count ?? null;

            const cn = x.school_name ?? (x as any).school_name_cn ?? (x as any).name ?? "-";

            const overrideEn = getEnOverrideById(sid);
            const dbEn = String((x.school_name_en ?? (x as any).school_name_en ?? (x as any).name_en ?? "") || "").trim();
            const en = (overrideEn || dbEn || "").trim();

            const websiteUrl = pickWebsite(x);
            const intlUrl = String(x.intl_admissions_url || pickIntlAdmissionsUrl(x) || "").trim();
            const intlTitle = String(x.intl_admissions_title || "").trim();
            const intlNote = String(x.intl_admissions_note || "").trim();
            const intlYear = pickIntlYear(x);

            const degreeLv = pickDegreeLevel(x);
            const degLinks = pickDegreeLinks(x);

            const sh = (x as any)?.extra?.shanghairanking;
            const shText = `${sh?.rank ?? "-"} / ${sh?.total_score ?? "-"}`;

            const sum = summaryMap[sid] || null;
            const sumText = summarizeGradesFromSummary(sum);

            const bundle = discMap?.[sid] || { disciplines: [], total: 0 };
            const discList = bundle.disciplines || [];
            const isOpen = openMap[sid] === true;

            return (
              <div
                key={sid}
                style={rowStyle}
                onMouseEnter={(e) => ((e.currentTarget.style.background = "#f9fafb"))}
                onMouseLeave={(e) => ((e.currentTarget.style.background = "white"))}
              >
                <div style={{ fontVariantNumeric: "tabular-nums", color: "#6b7280", fontSize: 12 }}>
                  {pageIndex * pageSize + idx + 1}
                </div>

                <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12 }}>{sid}</div>

                <div style={{ overflow: "hidden" }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", overflow: "hidden", flexWrap: "wrap" }}>
                    <div
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        cursor: websiteUrl ? "pointer" : "default",
                        flex: 1,
                        minWidth: 160,
                      }}
                      title={websiteUrl ? `Open: ${websiteUrl}` : ""}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (websiteUrl) window.open(websiteUrl, "_blank", "noopener,noreferrer");
                      }}
                    >
                      {cn}
                    </div>

                    <span
                      style={{
                        border: "1px solid #e5e7eb",
                        background: "#fff",
                        color: "#374151",
                        height: 24,
                        padding: "0 10px",
                        borderRadius: 999,
                        fontSize: 12,
                        whiteSpace: "nowrap",
                        flexShrink: 0,
                      }}
                      title={`MOE level: ${degreeLv}`}
                    >
                      {degreeLv}
                    </span>

                    {intlUrl ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(intlUrl, "_blank", "noopener,noreferrer");
                        }}
                        title={intlUrl}
                        style={{
                          border: "1px solid #dbeafe",
                          background: "#eff6ff",
                          color: "#2563eb",
                          height: 24,
                          padding: "0 10px",
                          borderRadius: 999,
                          cursor: "pointer",
                          fontSize: 12,
                          whiteSpace: "nowrap",
                          flexShrink: 0,
                        }}
                      >
                        招生{intlYear ? ` ${intlYear}` : ""}
                      </button>
                    ) : null}

                    {degreeChip("本科", degLinks.ug)}
                    {degreeChip("硕士", degLinks.master)}
                    {degreeChip("博士", degLinks.phd)}
                  </div>

                  {en ? (
                    <div
                      style={{
                        marginTop: 2,
                        fontSize: 12,
                        color: "#6b7280",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {en}
                    </div>
                  ) : null}
                </div>

                <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {x.province_name || x.province || (x as any)?.extra?.province_name || "-"}
                </div>

                <div style={{ fontVariantNumeric: "tabular-nums", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {shText}
                </div>

                <div style={{ fontSize: 12, color: "#111827" }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{ color: sum && (sum.total || 0) > 0 ? "#111827" : "#6b7280" }}>{sumText}</span>
                    {sum && (sum.total || 0) > 0 ? (
                      <span style={{ color: "#6b7280" }}>A+={sum.a_plus || 0}</span>
                    ) : (
                      <span style={{ color: "#9ca3af" }}>（暂无）</span>
                    )}

                    {discList.length > 0 ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMap((m) => ({ ...m, [sid]: !isOpen }));
                        }}
                        style={btnTiny}
                      >
                        {isOpen ? "收起" : `展开(${discList.length})`}
                      </button>
                    ) : null}
                  </div>

                  {isOpen ? (
                    <div style={{ marginTop: 8, color: "#374151" }}>
                      <div style={{ display: "grid", gap: 4 }}>
                        {discList.map((d, i) => (
                          <div key={i} style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                            <span style={{ fontWeight: 800, minWidth: 28 }}>{d.grade || "-"}</span>
                            <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {d.discipline_name || "-"}
                            </span>
                            <span style={{ color: "#6b7280" }}>{d.rank_text || ""}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>

<div style={{ fontSize: 12, overflow: "hidden" }}>
  {admissionsUrlCell(intlUrl, intlTitle, intlNote)}
</div>
                <div
                  style={{
                    fontVariantNumeric: "tabular-nums",
                    display: "flex",
                    gap: 8,
                    alignItems: "center",
                    cursor: "pointer",
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    goDetail(sid);
                  }}
                  title="Click to edit（会带 returnTo，返回不会回第一页）"
                >
                  <span>{x.qs_rank ?? "-"}</span>
                  <span style={{ fontSize: 12, color: done ? "#059669" : "#6b7280" }}>{done ? "✅已完成" : "⏳未完成"}</span>
                  <span style={{ fontSize: 12, color: "#6b7280" }}>{pc == null ? "" : `(${pc})`}</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div style={stickyPager}>
        <button
          style={{
            ...pagerBtn,
            background: pageIndex <= 0 ? "#f3f4f6" : "#fff",
            cursor: pageIndex <= 0 ? "not-allowed" : "pointer",
          }}
          disabled={loading || pageIndex <= 0}
          onClick={() => {
            setPageIndex((p) => Math.max(0, p - 1));
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        >
          上一页
        </button>

        <button
          style={{
            ...pagerBtn,
            background: pageIndex >= totalPages - 1 ? "#f3f4f6" : "#fff",
            cursor: pageIndex >= totalPages - 1 ? "not-allowed" : "pointer",
          }}
          disabled={loading || pageIndex >= totalPages - 1}
          onClick={() => {
            setPageIndex((p) => Math.min(totalPages - 1, p + 1));
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        >
          下一页
        </button>

        <span style={{ fontSize: 12, color: "#6b7280" }}>
          第 {pageIndex + 1} 页 / 共 {totalPages} 页（每页 {pageSize}）
        </span>

        <button
          style={{ ...pagerBtn, marginLeft: 8 }}
          disabled={loading}
          onClick={() => {
            setPageIndex(0);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        >
          回到第一页
        </button>

        <span style={{ fontSize: 12, color: "#6b7280" }}>
          ✅ “学校名”只开官网；“招生”与“招生网址”优先 intl_admissions_url/public_data.intl_admissions_url，其次 extra.intl_admissions_url
        </span>
      </div>
    </div>
  );
}

export default function AdminSchoolsListPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>Loading...</div>}>
      <AdminSchoolsListPageInner />
    </Suspense>
  );
}
