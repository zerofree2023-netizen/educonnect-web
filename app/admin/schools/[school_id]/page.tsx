"use client";

import React, { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";


function getProgramKindLabel(row: any, fallback?: string) {
  const raw = String(
    row?.program_category ||
    row?.category ||
    row?.kind ||
    row?.degree_kind ||
    fallback ||
    ""
  ).trim();

  if (
    raw === "foundation_bachelor" ||
    /预本|预科|Foundation\+Bachelor|Foundation/i.test(String(row?.degree_name_cn || row?.degree_name_en || row?.program_category || ""))
  ) {
    return "预科";
  }

  if (raw === "chinese_language" || /汉语|中文进修|Chinese Language/i.test(String(row?.degree_name_cn || row?.program_category || ""))) {
    return "汉语进修";
  }

  if (raw === "ug" || raw === "undergraduate") return "本科";
  if (raw === "master") return "硕士";
  if (raw === "phd" | "exchange" || raw === "doctor" || raw === "doctoral") return "博士";
  if (raw === "guide") return "申请指南";
  if (raw === "other") return "其他";
  return raw || "其他";
}


// ===== 类型（必须在组件外）=====

type FileKind = "ug" | "master" | "phd" | "foundation_bachelor" | "chinese_language" | "apply_guide" | "other";
type LinkPurpose = "catalog" | "tuition" | "scholarship";
type StudyLang = "" | "zh" | "en";

type Parsed = {
  extracted?: Record<string, any>;
  checklist?: Record<string, boolean>;
  raw?: string;
  program_catalog?: any[];
  program_catalog_meta?: any;
  table_header?: string[];
};

type ApiLatestOk = {
  ok: true;
  school_name_cn?: string | null;
  school_name_en?: string | null;
  row: null | {
    id: string;
    created_at: string;
    filename: string;
    kind?: string | null;
    parsed: Parsed;
  };
};

type ApiErr = { ok: false; error: string };

// ===== helper functions（必须在组件外）=====

function kindLabel(k: FileKind) {
  if (k === "ug") return "本科";
  if (k === "master") return "硕士";
  if (k === "phd") return "博士";
  if (k === "foundation_bachelor") return "预科/预本连读";
  if (k === "chinese_language") return "汉语进修";
  if (k === "apply_guide") return "申请指南";
  return "其他";
}

function openMaybe(u: string) {
  const url = String(u || "").trim();
  if (!url) return "";
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

// ✅ program_key：统一用 dept:major:track（可用就用）
function buildProgramKey(row: any) {
  const cleanPart = (x: any) =>
    String(x ?? "")
      .replace(/\s+/g, " ")
      .trim();

  const dept = cleanPart(row?.dept_code);
  const major = cleanPart(row?.major_code);
  const track = cleanPart(row?.track_code);

  const cn = cleanPart(row?.program_name_cn);
  const en = cleanPart(row?.program_name_en);
  const duration = cleanPart(row?.duration_years);

  const lang = cleanPart(
    row?.study_language ||
      row?.language_text ||
      row?.teaching_language ||
      "",
  );

  // 培养/授课模式：用于区分同一专业代码下不同项目
  // 例如 NJU 055200：
  // 新闻与传播（中外学生同班） / 3年 / 25000
  // 新闻与传播（国际学生班） / 2年 / 30000
  const mode = cleanPart(
    row?.training_mode_cn ||
      row?.teaching_mode_cn ||
      row?.class_mode_cn ||
      row?.remarks_text ||
      row?.remarks ||
      row?.tuition_note ||
      "",
  );

  const name = cn || en;

  if (dept && major && track) return `${dept}:${major}:${track}`;

  // 核心：同一 major_code 允许多个项目实例
  if (major && name && duration && lang) {
    return `${major}:${name}:${duration}:${lang}`;
  }

  if (major && name && duration) {
    return `${major}:${name}:${duration}`;
  }

  if (major && name) {
    return `${major}:${name}`;
  }

  if (major && track) return `${major}:${track}`;
  if (dept && major) return `${dept}:${major}`;
  if (major) return major;

  return name || "";
}

function stripChinese(s: string) {
  return String(s || "")
    .replace(/[\u4e00-\u9fff]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toNum(x: any): number | null {
  const s = String(x ?? "").trim();
  if (!s) return null;

  const m = s.match(/(\d[\d,]*)/);
  if (!m) return null;

  const n = Number(m[1].replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function toBool(x: any): boolean | null {
  if (x === true) return true;
  if (x === false) return false;

  const s = String(x ?? "").trim().toLowerCase();
  if (!s) return null;

  if (["true", "yes", "y", "1", "是", "按年"].includes(s)) return true;
  if (["false", "no", "n", "0", "否", "按全项目"].includes(s)) return false;
  return null;
}

function extractEmails(text: any): string[] {
  const s = String(text || "");
  return Array.from(
    new Set(s.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []),
  );
}

function extractPhones(text: any): string[] {
  const s = String(text || "");
  return Array.from(
    new Set(
      (s.match(/(\+?\d[\d\- ]{7,}\d)/g) || [])
        .map((x) => x.replace(/\s+/g, " ").trim())
        .filter((x) => x.replace(/[^\d]/g, "").length >= 8),
    ),
  );
}

// -------------------------
// styles
// -------------------------

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  padding: 18,
  background: "#fff",
  color: "#111827",
  fontFamily:
    'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial',
};

const card: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 16,
  padding: 16,
  background: "#fff",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 38,
  borderRadius: 10,
  border: "1px solid #d1d5db",
  padding: "0 12px",
  outline: "none",
  background: "#fff",
  color: "#111827",
};

const btnStyle: React.CSSProperties = {
  height: 38,
  padding: "0 14px",
  borderRadius: 10,
  border: "1px solid #d1d5db",
  background: "#111827",
  color: "#fff",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const ghostBtn: React.CSSProperties = {
  height: 30,
  padding: "0 10px",
  borderRadius: 10,
  border: "1px solid #e5e7eb",
  background: "#fff",
  cursor: "pointer",
  fontSize: 12,
};

const taStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 180,
  borderRadius: 12,
  border: "1px solid #d1d5db",
  padding: 12,
  outline: "none",
  background: "#fff",
  color: "#111827",
  resize: "vertical",
  lineHeight: 1.4,
};

function SchoolUploadPageInner() {
const params = useParams();
  const sp = useSearchParams();

  const returnTo = sp.get("returnTo") || "/admin/schools/list";

  const schoolId = useMemo(() => {
    const v = (params as any)?.school_id;
    return v ? decodeURIComponent(String(v)) : "";
  }, [params]);

  // 当前类别
  const [fileKind, setFileKind] = useState<FileKind>("master");
  const [studyLang, setStudyLang] = useState<StudyLang>(""); // ""=自动识别
  const [schoolNameCn, setSchoolNameCn] = useState("");
  const [schoolNameEn, setSchoolNameEn] = useState("");

  // ✅ 招生入口信息（中英双版本）
  const [admissionsForm, setAdmissionsForm] = useState({
    intl_admissions_title: "",
    intl_admissions_note: "",

    // 中文总入口
    intl_admissions_url: "",

    // 英文总入口
    intl_admissions_url_en: "",

    // 中文：本硕博
    ug: "",
    master: "",
    phd: "",

    // 英文：本硕博
    ug_en: "",
    master_en: "",
    phd_en: "",

    // 专业目录（中英）
    intl_programs_url: "",
    intl_programs_url_en: "",

    // 学费 / 学费说明 / 申请
    intl_tuition_url: "",
    intl_tuition_note_url: "",
    intl_apply_url: "",
  });

  // 文件上传
  const [filename, setFilename] = useState("manual.txt");
  const [raw, setRaw] = useState("");
  const [file, setFile] = useState<File | null>(null);

  // 链接提交
  const [sourceUrl, setSourceUrl] = useState("");
  const [linkPurpose, setLinkPurpose] = useState<LinkPurpose>("catalog");
  const [urlLoading, setUrlLoading] = useState(false);

  // 数据
  const [msg, setMsg] = useState("");
  const [parsed, setParsed] = useState<Parsed | null>(null);

  // 单行编辑
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, any>>({});
  const [locks, setLocks] = useState<Record<string, boolean>>({});

  // 批量（逻辑保留）
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [bulkDraft, setBulkDraft] = useState<Record<string, any>>({});


  const [bulkLocks, setBulkLocks] = useState<Record<string, boolean>>({
  program_name_cn: true,
  program_name_en: true,
  track_name_cn: true,
  track_name_en: true,
  language_text: true,
  study_mode_cn: true,
  tuition_rmb_per_year: true,
  tuition_total_rmb: true,
  tuition_is_per_year: true,
  tuition_note: true,
  application_fee_rmb: true,
  application_fee_note: true,
  application_fee_source_url: true,
  duration_years: true,
  contact_raw: true,
});

  // ✅ loadLatest 必须在 useEffect 前声明
  const loadLatest = useCallback(
    async (kind?: FileKind) => {
      if (!schoolId) return;

      const k = (kind || fileKind) as FileKind;

      try {
        setMsg(`Loading latest… (${kindLabel(k)})`);

        const ts = Date.now();
        const url = `/api/admin/schools/${encodeURIComponent(
          schoolId,
        )}/latest?kind=${encodeURIComponent(k)}&ts=${ts}`;

        const r = await fetch(url, { cache: "no-store" });
        const j = (await r.json().catch(() => null)) as
          | ApiLatestOk
          | ApiErr
          | null;

        if (!r.ok || !j || (j as any).ok !== true) {
          setMsg("❌ 拉取最新入库失败：" + ((j as any)?.error || `HTTP ${r.status}`));
          return;
        }

        setSchoolNameCn(String((j as any)?.school_name_cn || "").trim());
        setSchoolNameEn(String((j as any)?.school_name_en || "").trim());

        const row = (j as ApiLatestOk).row;
        if (!row) {
          setParsed(null);
          setMsg(`✅ 已加载（${kindLabel(k)} 暂时没有入库记录）`);
          return;
        }

        setParsed(row.parsed ?? null);
        setMsg(`✅ 已加载最新入库（${kindLabel(k)} / school_files）`);
      } catch (e: any) {
        setMsg("❌ 拉取最新入库异常：" + (e?.message || String(e)));
      }
    },
    [schoolId, fileKind],
  );

  // ✅ 读取招生入口信息
  const loadAdmissionsProfile = useCallback(async () => {
    if (!schoolId) return;

    try {
      const r = await fetch(
        `/api/admin/schools/${encodeURIComponent(schoolId)}/profile`,
        { cache: "no-store" },
      );

      const j = await r.json().catch(() => null);

      if (!r.ok || !j?.ok) {
        setMsg("❌ 招生信息读取失败：" + (j?.error || `HTTP ${r.status}`));
        return;
      }

      const publicData = j?.row?.public_data || {};
      const pkg = publicData?.intl_admissions_degree_package_2026 || {};

      setAdmissionsForm({
        intl_admissions_title: String(publicData?.intl_admissions_title || ""),
        intl_admissions_note: String(publicData?.intl_admissions_note || ""),

        intl_admissions_url: String(publicData?.intl_admissions_url || ""),
        intl_admissions_url_en: String(publicData?.intl_admissions_url_en || ""),

        ug: String(pkg?.ug || ""),
        master: String(pkg?.master || ""),
        phd: String(pkg?.phd || ""),

        ug_en: String(pkg?.ug_en || ""),
        master_en: String(pkg?.master_en || ""),
        phd_en: String(pkg?.phd_en || ""),

        intl_programs_url: String(publicData?.intl_programs_url || ""),
        intl_programs_url_en: String(publicData?.intl_programs_url_en || ""),

        intl_tuition_url: String(publicData?.intl_tuition_url || ""),
        intl_tuition_note_url: String(publicData?.intl_tuition_note_url || ""),
        intl_apply_url: String(publicData?.intl_apply_url || ""),
      });
    } catch (e: any) {
      setMsg("❌ 招生信息读取异常：" + (e?.message || String(e)));
    }
  }, [schoolId]);

  // ✅ 保存招生入口信息
  const saveAdmissionsProfile = useCallback(async () => {
    if (!schoolId) return;

    try {
      const r = await fetch(
        `/api/admin/schools/${encodeURIComponent(schoolId)}/profile`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            public_data_patch: {
              intl_admissions_title: admissionsForm.intl_admissions_title.trim(),
              intl_admissions_note: admissionsForm.intl_admissions_note.trim(),

              intl_admissions_url: admissionsForm.intl_admissions_url.trim(),
              intl_admissions_url_en: String(
                admissionsForm.intl_admissions_url_en || "",
              ).trim(),

              intl_admissions_degree_package_2026: {
                ug: admissionsForm.ug.trim(),
                master: admissionsForm.master.trim(),
                phd: admissionsForm.phd.trim(),

                ug_en: String(admissionsForm.ug_en || "").trim(),
                master_en: String(admissionsForm.master_en || "").trim(),
                phd_en: String(admissionsForm.phd_en || "").trim(),
              },

              intl_programs_url: admissionsForm.intl_programs_url.trim(),
              intl_programs_url_en: String(
                admissionsForm.intl_programs_url_en || "",
              ).trim(),

              intl_tuition_url: admissionsForm.intl_tuition_url.trim(),
              intl_tuition_note_url: String(
                admissionsForm.intl_tuition_note_url || "",
              ).trim(),

              intl_apply_url: admissionsForm.intl_apply_url.trim(),
            },
          }),
        },
      );

      const j = await r.json().catch(() => null);

      if (!r.ok || !j?.ok) {
        setMsg("❌ 招生信息保存失败：" + (j?.error || `HTTP ${r.status}`));
        return;
      }

      setMsg("✅ 招生信息已保存");
      await loadAdmissionsProfile();
    } catch (e: any) {
      setMsg("❌ 招生信息保存异常：" + (e?.message || String(e)));
    }
  }, [schoolId, admissionsForm, loadAdmissionsProfile]);

  // ✅ 把 parse-by-url 提前定义（否则 useEffect 里会引用不到）
  const runParseByUrl = useCallback(
    async (opts?: { auto?: boolean }) => {
      if (!schoolId) return;

      const u = String(sourceUrl || "").trim();
      if (!u) {
        if (!opts?.auto) setMsg("❌ 请输入 URL");
        return;
      }

      try {
        setUrlLoading(true);

        if (!opts?.auto) {
          setMsg(
            `提交链接中…（${kindLabel(fileKind)} / ${
              linkPurpose === "tuition" ? "收费标准" : "目录/详情"
            }）`,
          );
          setParsed(null);
        }

        const form = new FormData();
        form.append("study_language", studyLang);
        form.append("kind", fileKind);
        form.append("source_url", u);
        form.append("link_purpose", linkPurpose);
        form.append("filename", filename || "from_url");

        const r = await fetch(
          `/api/admin/schools/${encodeURIComponent(schoolId)}/upload`,
          { method: "POST", body: form },
        );

        const j = await r.json().catch(() => null);

        if (!r.ok || !j?.ok) {
          setMsg("❌ 解析失败：" + (j?.error || `HTTP ${r.status}`));
          return;
        }

        setParsed(j.parsed ?? null);
        setMsg(opts?.auto ? "✅ 已自动解析（随分类切换）" : "✅ 链接已解析并入库");
        await loadLatest(fileKind);
      } catch (e: any) {
        setMsg("❌ 解析异常：" + (e?.message || String(e)));
      } finally {
        setUrlLoading(false);
      }
    },
    [schoolId, sourceUrl, studyLang, fileKind, linkPurpose, filename, loadLatest],
  );

  const handleFetchUrl = useCallback(
    () => runParseByUrl({ auto: false }),
    [runParseByUrl],
  );

  const [autoKey, setAutoKey] = useState<string>("");

  useEffect(() => {
    if (!schoolId) return;

    loadLatest(fileKind);

    const u = String(sourceUrl || "").trim();
    if (!u) return;

    const k = `${schoolId}::${fileKind}::${studyLang}::${linkPurpose}::${u}`;
    if (k === autoKey) return;

    setAutoKey(k);
    runParseByUrl({ auto: true });
  }, [schoolId, fileKind, studyLang, linkPurpose, sourceUrl, autoKey, runParseByUrl, loadLatest]);

  useEffect(() => {
    if (!schoolId) return;
    loadAdmissionsProfile();
  }, [schoolId, loadAdmissionsProfile]);

  const catalog = useMemo(() => (parsed?.program_catalog || []) as any[], [parsed]);
  const meta = (parsed as any)?.program_catalog_meta || {};
  const metaTuitionUrl = String(meta?.tuition_source_url || "").trim();

const visibleRows = useMemo(() => {
  let rows = [...catalog];

  if (studyLang) {
    rows = rows.filter((r) => {
      const sl = String(
        r?.study_language || r?.language_text || "",
      ).toLowerCase();

      if (studyLang === "en") {
        return sl.includes("english") || sl.includes("英文") || sl === "en";
      }
      if (studyLang === "zh") {
        return sl.includes("chinese") || sl.includes("中文") || sl === "zh";
      }
      return true;
    });
  }

  rows.sort((a, b) => {
    const av = a?.tuition_rmb_per_year != null ? 1 : 0;
    const bv = b?.tuition_rmb_per_year != null ? 1 : 0;
    return bv - av;
  });

  if (process.env.DEBUG_INGEST === "1") console.log("[PAGE_VISIBLE_ROWS_DEBUG]", {
    catalogLen: catalog.length,
    visibleLen: rows.length,
    last5: rows.slice(-5).map((r) => ({
      idx: r?.idx,
      major_code: r?.major_code,
      program_name_cn: r?.program_name_cn,
      program_name_en: r?.program_name_en,
      faculty_cn: r?.faculty_cn,
    })),
  });

return rows;
}, [catalog, studyLang]);

  const selectedCount = useMemo(
    () => Object.values(selected).filter(Boolean).length,
    [selected],
  );

  const handleSubmit = useCallback(async () => {
    try {
      if (!schoolId) {
        setMsg("❌ missing school_id");
        return;
      }

      setMsg(`Uploading… (${kindLabel(fileKind)})`);
      setParsed(null);

      const form = new FormData();
form.append("filename", file?.name || filename || "manual.txt");
      form.append("raw_text", raw || "");
      form.append("kind", fileKind);
      form.append("study_language", studyLang);

      if (file) form.append("file", file);

      const r = await fetch(
        `/api/admin/schools/${encodeURIComponent(schoolId)}/upload`,
        {
          method: "POST",
          body: form,
        },
      );

      const j = await r.json().catch(() => null);

      if (!r.ok || !j?.ok) {
        setMsg("❌ 上传失败：" + (j?.error || `HTTP ${r.status}`));
        return;
      }

      setParsed(j.parsed ?? null);
      setMsg("✅ 上传成功，已入库并解析");
      await loadLatest(fileKind);
    } catch (e: any) {
      setMsg("❌ 上传异常：" + (e?.message || String(e)));
    }
  }, [schoolId, fileKind, filename, file, raw, studyLang, loadLatest]);

  const saveBulkOverrides = useCallback(
    async (
      programKeys: string[],
      patch: Record<string, any>,
      locksObj: Record<string, boolean>,
    ) => {
      if (!schoolId) return;

      const keys = Array.from(
        new Set(programKeys.map((x) => String(x || "").trim()).filter(Boolean)),
      );

      if (keys.length === 0) {
        setMsg("❌ 批量保存：没有选中任何 program_key");
        return;
      }

      setMsg(`Saving bulk… (${keys.length})`);

      const items = keys.map((program_key) => ({
        program_key,
        patch,
        locks: locksObj,
      }));

      const r = await fetch(
        `/api/admin/schools/${encodeURIComponent(schoolId)}/program-catalog-override`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ items }),
        },
      );

      const j = await r.json().catch(() => null);

      if (!r.ok || !j?.ok) {
        setMsg("❌ 批量保存失败：" + (j?.error || `HTTP ${r.status}`));
        return;
      }

      setMsg(`✅ 批量保存成功：${j?.count ?? keys.length} 条`);
      await loadLatest(fileKind);
    },
    [schoolId, loadLatest, fileKind],
  );

  const saveOverride = useCallback(
    async (program_key: string) => {
      if (!schoolId) return;

      const patch: Record<string, any> = {};


    for (const k of [
  "program_name_cn",
  "program_name_en",
  "track_name_cn",
  "track_name_en",
  "language_text",
  "study_mode_cn",
  "tuition_rmb_per_year",
  "tuition_total_rmb",
  "tuition_is_per_year",
  "tuition_note",
  "application_fee_rmb",
  "application_fee_note",
  "application_fee_source_url",
  "duration_years",
  "contact_raw",
]) {
      const v = (draft as any)?.[k];

        if (v === undefined || v === null) continue;
        if (typeof v === "string" && !v.trim()) continue;

        if (
          k === "tuition_rmb_per_year" ||
          k === "tuition_total_rmb" ||
          k === "application_fee_rmb"
        ) {
          patch[k] = toNum(v);
        } else if (k === "tuition_is_per_year") {
          patch[k] = toBool(v);
        } else {
          patch[k] = v;
        }
      }

      const r = await fetch(
        `/api/admin/schools/${encodeURIComponent(schoolId)}/program-catalog-override`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ program_key, patch, locks }),
        },
      );

      const j = await r.json().catch(() => null);

      if (!r.ok || !j?.ok) {
        setMsg("❌ 保存失败：" + (j?.error || `HTTP ${r.status}`));
        return;
      }

      setMsg("✅ 已保存并锁定");
      await loadLatest(fileKind);
      setEditingKey(null);
      setDraft({});
      setLocks({});
    },
    [schoolId, draft, locks, loadLatest, fileKind],
  );

  const selectAllVisible = useCallback(() => {
    const m: Record<string, boolean> = {};

    visibleRows.forEach((r, i) => {
      const pk = buildProgramKey(r) || `row-${i}`;
      m[pk] = true;
    });

    setSelected(m);
  }, [visibleRows]);

  const clearAllSelected = useCallback(() => setSelected({}), []);

  const invertVisible = useCallback(() => {
    setSelected((prev) => {
      const next: Record<string, boolean> = { ...prev };

      visibleRows.forEach((r, i) => {
        const pk = buildProgramKey(r) || `row-${i}`;
        next[pk] = !(next[pk] === true);
      });

      return next;
    });
  }, [visibleRows]);

  const bulkSaveSelected = useCallback(async () => {
    const programKeys = Object.keys(selected || {}).filter((k) => selected[k]);

    if (programKeys.length === 0) {
      setMsg("❌ 批量保存：请先勾选至少 1 行");
      return;
    }

  const lockCommon: Record<string, boolean> = {
  program_name_cn: true,
  program_name_en: true,
  track_name_cn: true,
  track_name_en: true,
  language_text: true,
  study_mode_cn: true,
  tuition_rmb_per_year: true,
  tuition_total_rmb: true,
  tuition_is_per_year: true,
  tuition_note: true,
  application_fee_rmb: true,
  application_fee_note: true,
  application_fee_source_url: true,
  duration_years: true,
  contact_raw: true,
};

    await saveBulkOverrides(programKeys, {}, lockCommon);
  }, [selected, saveBulkOverrides]);

  const applyBulkDraftToSelected = useCallback(async () => {
    const programKeys = Object.keys(selected || {}).filter((k) => selected[k]);

    if (programKeys.length === 0) {
      setMsg("❌ 批量应用：请先勾选至少 1 行");
      return;
    }

    const patch: Record<string, any> = {};

    for (const k of Object.keys(bulkDraft || {})) {
      const v = (bulkDraft as any)[k];

      if (v === null || v === undefined) continue;
      if (typeof v === "string" && !v.trim()) continue;

      if (k === "tuition_rmb_per_year" || k === "tuition_total_rmb") {
        patch[k] = toNum(v);
      } else if (k === "tuition_is_per_year") {
        patch[k] = toBool(v);
      } else {
        patch[k] = v;
      }
    }

    const locksObj: Record<string, boolean> = {};
    for (const k of Object.keys(bulkLocks || {})) {
      if ((bulkLocks as any)[k] === true) locksObj[k] = true;
    }

    await saveBulkOverrides(programKeys, patch, locksObj);
  }, [selected, bulkDraft, bulkLocks, saveBulkOverrides]);

  const catalogColumns: { key: string; label: string }[] = useMemo(
  () => [
    { key: "__select", label: "选择" },
    { key: "__actions", label: "操作" },
    { key: "idx", label: "序号" },
    { key: "kind", label: "分类" },
    { key: "faculty_cn", label: "学院" },
    { key: "major_code", label: "专业代码" },
    { key: "program_name_cn", label: "专业中文" },
    { key: "program_name_en", label: "专业英文" },
    { key: "__research_fields", label: "研究方向" },
    { key: "language_text", label: "授课语言" },
    { key: "degree_type", label: "学位类型" },
    { key: "study_mode_cn", label: "学习方式" },
    { key: "duration_years", label: "学制(年)" },
    { key: "apply_requirements_text", label: "入学要求" },
    { key: "tuition_rmb_per_year", label: "学费/年(RMB)" },
    { key: "tuition_total_rmb", label: "学费总计(RMB)" },
    { key: "tuition_is_per_year", label: "按年？" },
    { key: "tuition_note", label: "学费说明" },
    { key: "scholarship_note", label: "奖学金" },
    { key: "scholarship_coverage_text", label: "奖学金覆盖" },
    { key: "__scholarship_url", label: "奖学金来源" },
    { key: "scholarship_application_time_text", label: "奖学金申请时间" },
    { key: "__scholarship_stipend", label: "奖学金补贴" },
    { key: "application_fee_rmb", label: "申请费(RMB)" },
    { key: "application_fee_note", label: "申请费说明" },
    { key: "application_fee_source_url", label: "申请费来源" },
    { key: "__tuition_pdf", label: "收费PDF" },
    { key: "remarks", label: "备注" },
    { key: "__contact_phone", label: "电话" },
    { key: "__contact_email", label: "邮箱" },
    { key: "tags", label: "标签" },
  ],
  [],
);

  const renderCell = useCallback(
    (v: any, key: string, rowObj?: any) => {
      if (key === "kind") {
        const k = String(
          rowObj?.program_category || rowObj?.category || rowObj?.kind || fileKind || ""
        ).trim().toLowerCase();

        if (k === "ug" || k === "undergraduate") return "本科";
        if (k === "master") return "硕士";
        if (k === "phd" || k === "doctor" || k === "doctoral") return "博士";
        if (k === "foundation_bachelor") return "预科";
        if (k === "chinese_language") return "汉语进修";
        if (k === "apply_guide" || k === "guide") return "申请指南";

        const degree = String(rowObj?.degree_name_cn || rowObj?.degree_name_en || "");
        if (/预本|预科|Foundation/i.test(degree)) return "预科";
        if (/汉语|中文进修|Chinese Language/i.test(degree)) return "汉语进修";

        return "其他";
      }

      if (key === "faculty_cn") {
        const s = String(v ?? "").trim();
        if (!s || s === "-" || s === "—" || s === "院" || /^\d+$/.test(s)) {
          return "-";
        }
        return s;
      }

      if (key === "program_name_en") {
        const s = String(v ?? "").trim();
        if (!s || /^\d+$/.test(s)) return "-";
        return stripChinese(s) || "-";
      }


      if (key === "application_fee_source_url") {
        const u = String(v ?? "").trim();
        if (!u) return "-";

        return (
          <a
            href={openMaybe(u)}
            target="_blank"
            rel="noreferrer"
            style={{
              color: "#2563eb",
              textDecoration: "underline",
              fontSize: 12,
              whiteSpace: "nowrap",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            申请费来源
          </a>
        );
      }


      if (key === "application_fee_source_url") {
        const u = String(v ?? "").trim();
        if (!u) return "-";

        return (
          <a
            href={openMaybe(u)}
            target="_blank"
            rel="noreferrer"
            style={{
              color: "#2563eb",
              textDecoration: "underline",
              fontSize: 12,
              whiteSpace: "nowrap",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            申请费来源
          </a>
        );
      }

      if (key === "__scholarship_url") {
        const u = String(rowObj?.scholarship_source_url || "").trim();
        if (!u) return "-";

        return (
          <a
            href={openMaybe(u)}
            target="_blank"
            rel="noreferrer"
            style={{
              color: "#2563eb",
              textDecoration: "underline",
              fontSize: 12,
              whiteSpace: "nowrap",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            奖学金页
          </a>
        );
      }

      if (key === "__scholarship_stipend") {
        const parts: string[] = [];

        const single = rowObj?.scholarship_stipend_rmb_per_month;
        const ug = rowObj?.scholarship_stipend_ug_rmb_per_month;
        const master = rowObj?.scholarship_stipend_master_rmb_per_month;
        const phd = rowObj?.scholarship_stipend_phd_rmb_per_month;
        const phdFirst = rowObj?.scholarship_stipend_phd_first_rmb_per_month;
        const phdSecond = rowObj?.scholarship_stipend_phd_second_rmb_per_month;

        if (single != null) parts.push(`${single} 元/月`);
        if (ug != null) parts.push(`本科 ${ug} 元/月`);
        if (master != null) parts.push(`硕士 ${master} 元/月`);
        if (phd != null) parts.push(`博士 ${phd} 元/月`);
        if (phdFirst != null) parts.push(`博士一等 ${phdFirst} 元/月`);
        if (phdSecond != null) parts.push(`博士二等 ${phdSecond} 元/月`);

        return parts.length ? (
          <div style={{ fontSize: 12, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
            {parts.join("\n")}
          </div>
        ) : "-";
      }

      if (key === "__tuition_pdf") {
        const rowSource =
          String(rowObj?.tuition_source_url || "").trim() ||
          String(rowObj?.fee_source_url || "").trim() ||
          String(rowObj?.application_fee_source_url || "").trim() ||
          String(rowObj?.insurance_fee_source_url || "").trim() ||
          (Array.isArray(rowObj?.source_files)
            ? rowObj.source_files.filter(Boolean).join("；")
            : "");

        if (!rowSource) return "-";

        const isUrl = /^https?:\/\//i.test(rowSource);

        if (isUrl) {
          return (
            <a
              href={openMaybe(rowSource)}
              target="_blank"
              rel="noreferrer"
              style={{
                color: "#2563eb",
                textDecoration: "underline",
                fontSize: 12,
                whiteSpace: "nowrap",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              收费PDF
            </a>
          );
        }

        return (
          <span
            title={rowSource}
            style={{
              color: "#4b5563",
              fontSize: 12,
              whiteSpace: "nowrap",
            }}
          >
            来源文件
          </span>
        );
      }

      if (key === "tags") {
        const arr = Array.isArray(v) ? v : [];
        if (arr.length === 0) return "-";

        return (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {arr.slice(0, 8).map((t: string, i: number) => (
              <span
                key={`${t}-${i}`}
                style={{
                  fontSize: 12,
                  padding: "2px 8px",
                  borderRadius: 999,
                  border: "1px solid #d1d5db",
                  background: "#fff",
                  whiteSpace: "nowrap",
                }}
              >
                {t}
              </span>
            ))}
            {arr.length > 8 ? (
              <span style={{ fontSize: 12, color: "#6b7280" }}>
                +{arr.length - 8}
              </span>
            ) : null}
          </div>
        );
      }

      const longKeys = new Set([
        "remarks",
        "contact_raw",
        "tuition_note",
        "scholarship_note",
        "scholarship_coverage_text",
        "scholarship_application_time_text",
        "scholarship_apply_requirements_text",
        "scholarship_application_guide_text",
        "raw_line",
      ]);

      if (longKeys.has(key)) {
        const s = String(v ?? "").trim();
        if (!s) return "-";

        const short = s.length > 160 ? s.slice(0, 160) + " …" : s;

        return (
          <details>
            <summary style={{ cursor: "pointer", color: "#2563eb", fontSize: 12 }}>
              {short}
            </summary>
            <pre
              style={{
                margin: 0,
                marginTop: 8,
                whiteSpace: "pre-wrap",
                fontSize: 12,
                color: "#111827",
              }}
            >
              {s}
            </pre>
          </details>
        );
      }

      if (v == null) return "-";

      if (Array.isArray(v)) {
        const arr = v.map((x) => String(x ?? "").trim()).filter(Boolean);
        if (key.endsWith("_en")) return stripChinese(arr.join(" / ")) || "-";
        return arr.join(" / ") || "-";
      }

      if (typeof v === "object") {
        return (
          <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
            {JSON.stringify(v, null, 2)}
          </pre>
        );
      }

      const s0 = String(v);
      if (!s0.trim()) return "-";

      if (key.endsWith("_en")) return stripChinese(s0) || "-";

      return s0;
    },
    [
      selected,
      editingKey,
      draft,
      locks,
      saveOverride,
      metaTuitionUrl,
      fileKind,
      studyLang,
    ],
  );

  return (
    <div style={pageStyle}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "center",
        }}
      >
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 900, margin: 0 }}>
            {schoolNameCn ? `${schoolNameCn}（School Upload）` : "School Upload"}
          </h1>
          {schoolNameEn ? (
            <div style={{ marginTop: 4, fontSize: 12, color: "#6b7280" }}>
              {schoolNameEn}
            </div>
          ) : null}
        </div>

        <a href={returnTo} style={{ color: "#2563eb" }}>
          ← Back
        </a>
      </div>

      <div style={{ marginTop: 6, color: "#6b7280", fontSize: 12 }}>
        school_id: <b>{schoolId || "(missing)"}</b>
        {schoolNameCn ? (
          <span style={{ marginLeft: 10, color: "#111827" }}>
            ｜学校：<b>{schoolNameCn}</b>
          </span>
        ) : null}
      </div>

      {/* ✅ 招生入口信息 */}
      <div style={{ marginTop: 12, ...card }}>
        <div style={{ fontWeight: 900, marginBottom: 10 }}>招生入口信息</div>

        <div style={{ display: "grid", gap: 10 }}>
          <input
            value={admissionsForm.intl_admissions_title}
            onChange={(e) =>
              setAdmissionsForm((s) => ({
                ...s,
                intl_admissions_title: e.target.value,
              }))
            }
            placeholder="招生标题，例如：国际教育学院 / 招生信息 / 留学生招生网"
            style={inputStyle}
          />

          <input
            value={admissionsForm.intl_admissions_note}
            onChange={(e) =>
              setAdmissionsForm((s) => ({
                ...s,
                intl_admissions_note: e.target.value,
              }))
            }
            placeholder="备注，例如：总入口页，含本科/硕士/博士/专业目录/学费/申请指南"
            style={inputStyle}
          />

          {/* 中文总入口 */}
          <input
            value={admissionsForm.intl_admissions_url}
            onChange={(e) =>
              setAdmissionsForm((s) => ({
                ...s,
                intl_admissions_url: e.target.value,
              }))
            }
            placeholder="中文招生总入口 URL"
            style={inputStyle}
          />

          {/* 英文总入口 */}
          <input
            value={admissionsForm.intl_admissions_url_en}
            onChange={(e) =>
              setAdmissionsForm((s) => ({
                ...s,
                intl_admissions_url_en: e.target.value,
              }))
            }
            placeholder="英文招生总入口 URL"
            style={inputStyle}
          />

          {/* 中文：本硕博 */}
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}
          >
            <input
              value={admissionsForm.ug}
              onChange={(e) =>
                setAdmissionsForm((s) => ({ ...s, ug: e.target.value }))
              }
              placeholder="中文本科 URL"
              style={inputStyle}
            />

            <input
              value={admissionsForm.master}
              onChange={(e) =>
                setAdmissionsForm((s) => ({ ...s, master: e.target.value }))
              }
              placeholder="中文硕士 URL"
              style={inputStyle}
            />

            <input
              value={admissionsForm.phd}
              onChange={(e) =>
                setAdmissionsForm((s) => ({ ...s, phd: e.target.value }))
              }
              placeholder="中文博士 URL"
              style={inputStyle}
            />
          </div>

          {/* 英文：本硕博 */}
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}
          >
            <input
              value={admissionsForm.ug_en}
              onChange={(e) =>
                setAdmissionsForm((s) => ({ ...s, ug_en: e.target.value }))
              }
              placeholder="英文本科 URL"
              style={inputStyle}
            />

            <input
              value={admissionsForm.master_en}
              onChange={(e) =>
                setAdmissionsForm((s) => ({ ...s, master_en: e.target.value }))
              }
              placeholder="英文硕士 URL"
              style={inputStyle}
            />

            <input
              value={admissionsForm.phd_en}
              onChange={(e) =>
                setAdmissionsForm((s) => ({ ...s, phd_en: e.target.value }))
              }
              placeholder="英文博士 URL"
              style={inputStyle}
            />
          </div>

          {/* 专业目录中英 */}
          <input
            value={admissionsForm.intl_programs_url}
            onChange={(e) =>
              setAdmissionsForm((s) => ({
                ...s,
                intl_programs_url: e.target.value,
              }))
            }
            placeholder="中文专业目录 URL"
            style={inputStyle}
          />

          <input
            value={admissionsForm.intl_programs_url_en}
            onChange={(e) =>
              setAdmissionsForm((s) => ({
                ...s,
                intl_programs_url_en: e.target.value,
              }))
            }
            placeholder="英文专业目录 URL"
            style={inputStyle}
          />

          {/* 学费 */}
          <input
            value={admissionsForm.intl_tuition_url}
            onChange={(e) =>
              setAdmissionsForm((s) => ({
                ...s,
                intl_tuition_url: e.target.value,
              }))
            }
            placeholder="学费 URL"
            style={inputStyle}
          />

          <input
            value={admissionsForm.intl_tuition_note_url}
            onChange={(e) =>
              setAdmissionsForm((s) => ({
                ...s,
                intl_tuition_note_url: e.target.value,
              }))
            }
            placeholder="学费说明 / 收费说明 URL"
            style={inputStyle}
          />

          {/* 申请 */}
          <input
            value={admissionsForm.intl_apply_url}
            onChange={(e) =>
              setAdmissionsForm((s) => ({
                ...s,
                intl_apply_url: e.target.value,
              }))
            }
            placeholder="申请指南 / 申请入口 URL"
            style={inputStyle}
          />

          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <button type="button" onClick={saveAdmissionsProfile} style={btnStyle}>
              保存招生信息
            </button>

            <button
              type="button"
              onClick={loadAdmissionsProfile}
              style={ghostBtn}
            >
              重新读取
            </button>

            {admissionsForm.intl_admissions_url ? (
              <a
                href={openMaybe(admissionsForm.intl_admissions_url)}
                target="_blank"
                rel="noreferrer"
                style={{
                  ...ghostBtn,
                  display: "inline-flex",
                  alignItems: "center",
                  textDecoration: "none",
                  color: "#2563eb",
                }}
              >
                打开中文招生页
              </a>
            ) : null}

            {admissionsForm.intl_admissions_url_en ? (
              <a
                href={openMaybe(admissionsForm.intl_admissions_url_en)}
                target="_blank"
                rel="noreferrer"
                style={{
                  ...ghostBtn,
                  display: "inline-flex",
                  alignItems: "center",
                  textDecoration: "none",
                  color: "#2563eb",
                }}
              >
                打开英文招生页
              </a>
            ) : null}

            {admissionsForm.ug ? (
              <a
                href={openMaybe(admissionsForm.ug)}
                target="_blank"
                rel="noreferrer"
                style={{
                  ...ghostBtn,
                  display: "inline-flex",
                  alignItems: "center",
                  textDecoration: "none",
                  color: "#2563eb",
                }}
              >
                打开中文本科页
              </a>
            ) : null}

            {admissionsForm.master ? (
              <a
                href={openMaybe(admissionsForm.master)}
                target="_blank"
                rel="noreferrer"
                style={{
                  ...ghostBtn,
                  display: "inline-flex",
                  alignItems: "center",
                  textDecoration: "none",
                  color: "#2563eb",
                }}
              >
                打开中文硕士页
              </a>
            ) : null}

            {admissionsForm.phd ? (
              <a
                href={openMaybe(admissionsForm.phd)}
                target="_blank"
                rel="noreferrer"
                style={{
                  ...ghostBtn,
                  display: "inline-flex",
                  alignItems: "center",
                  textDecoration: "none",
                  color: "#2563eb",
                }}
              >
                打开中文博士页
              </a>
            ) : null}

            {admissionsForm.ug_en ? (
              <a
                href={openMaybe(admissionsForm.ug_en)}
                target="_blank"
                rel="noreferrer"
                style={{
                  ...ghostBtn,
                  display: "inline-flex",
                  alignItems: "center",
                  textDecoration: "none",
                  color: "#2563eb",
                }}
              >
                打开英文本科页
              </a>
            ) : null}

            {admissionsForm.master_en ? (
              <a
                href={openMaybe(admissionsForm.master_en)}
                target="_blank"
                rel="noreferrer"
                style={{
                  ...ghostBtn,
                  display: "inline-flex",
                  alignItems: "center",
                  textDecoration: "none",
                  color: "#2563eb",
                }}
              >
                打开英文硕士页
              </a>
            ) : null}

            {admissionsForm.phd_en ? (
              <a
                href={openMaybe(admissionsForm.phd_en)}
                target="_blank"
                rel="noreferrer"
                style={{
                  ...ghostBtn,
                  display: "inline-flex",
                  alignItems: "center",
                  textDecoration: "none",
                  color: "#2563eb",
                }}
              >
                打开英文博士页
              </a>
            ) : null}

            {admissionsForm.intl_programs_url ? (
              <a
                href={openMaybe(admissionsForm.intl_programs_url)}
                target="_blank"
                rel="noreferrer"
                style={{
                  ...ghostBtn,
                  display: "inline-flex",
                  alignItems: "center",
                  textDecoration: "none",
                  color: "#2563eb",
                }}
              >
                打开中文专业目录
              </a>
            ) : null}

            {admissionsForm.intl_programs_url_en ? (
              <a
                href={openMaybe(admissionsForm.intl_programs_url_en)}
                target="_blank"
                rel="noreferrer"
                style={{
                  ...ghostBtn,
                  display: "inline-flex",
                  alignItems: "center",
                  textDecoration: "none",
                  color: "#2563eb",
                }}
              >
                打开英文专业目录
              </a>
            ) : null}

            {admissionsForm.intl_tuition_url ? (
              <a
                href={openMaybe(admissionsForm.intl_tuition_url)}
                target="_blank"
                rel="noreferrer"
                style={{
                  ...ghostBtn,
                  display: "inline-flex",
                  alignItems: "center",
                  textDecoration: "none",
                  color: "#2563eb",
                }}
              >
                打开学费页
              </a>
            ) : null}

            {admissionsForm.intl_tuition_note_url ? (
              <a
                href={openMaybe(admissionsForm.intl_tuition_note_url)}
                target="_blank"
                rel="noreferrer"
                style={{
                  ...ghostBtn,
                  display: "inline-flex",
                  alignItems: "center",
                  textDecoration: "none",
                  color: "#2563eb",
                }}
              >
                打开学费说明页
              </a>
            ) : null}

            {admissionsForm.intl_apply_url ? (
              <a
                href={openMaybe(admissionsForm.intl_apply_url)}
                target="_blank"
                rel="noreferrer"
                style={{
                  ...ghostBtn,
                  display: "inline-flex",
                  alignItems: "center",
                  textDecoration: "none",
                  color: "#2563eb",
                }}
              >
                打开申请指南
              </a>
            ) : null}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 12, ...card }}>
        <div style={{ fontWeight: 900, marginBottom: 10 }}>
          提交文件 / 提交链接（都会更新同 kind 的 Program Catalog）
        </div>

        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "center",
            flexWrap: "wrap",
            marginBottom: 10,
          }}
        >
          <div style={{ fontSize: 12, color: "#374151", fontWeight: 800 }}>
            分类：
          </div>

          <select
            value={fileKind}
            onChange={(e) => setFileKind(e.target.value as FileKind)}
            style={{
              height: 36,
              borderRadius: 10,
              border: "1px solid #d1d5db",
              padding: "0 10px",
            }}
          >
            <option value="ug">本科</option>
            <option value="master">硕士</option>
            <option value="phd">博士</option>
              <option value="exchange">交换生</option>
<option value="foundation_bachelor">预科/预本连读</option>
<option value="chinese_language">汉语进修</option>
            <option value="apply_guide">申请指南</option>
            <option value="other">其他</option>
          </select>

          <div style={{ fontSize: 12, color: "#374151", fontWeight: 800 }}>
            链接用途：
          </div>

          <select
            value={linkPurpose}
            onChange={(e) => setLinkPurpose(e.target.value as LinkPurpose)}
            style={{
              height: 36,
              borderRadius: 10,
              border: "1px solid #d1d5db",
              padding: "0 10px",
            }}
          >
            <option value="catalog">目录/详情（补全专业信息）</option>
            <option value="tuition">收费标准 PDF（补全学费并写入收费PDF列）</option>
            <option value="scholarship">奖学金 / 资助标准 / 申请渠道</option>
          </select>

          <div style={{ fontSize: 12, color: "#374151", fontWeight: 800 }}>
            授课语言：
          </div>

          <select
            value={studyLang}
            onChange={(e) => setStudyLang(e.target.value as StudyLang)}
            style={{
              height: 36,
              borderRadius: 10,
              border: "1px solid #d1d5db",
              padding: "0 10px",
            }}
          >
            <option value="">自动识别</option>
            <option value="zh">中文授课</option>
            <option value="en">英文授课</option>
          </select>

          <div style={{ fontSize: 12, color: "#6b7280" }}>
            当前查看：<b>{kindLabel(fileKind)}</b>
            {studyLang ? (
              <span>
                {" "}
                / <b>{studyLang === "zh" ? "中文授课" : "英文授课"}</b>
              </span>
            ) : null}
          </div>

          <div style={{ fontSize: 12, color: "#6b7280" }}>
            已选中：<b>{selectedCount}</b>
          </div>
        </div>
        
        <button type="button" style={ghostBtn} onClick={selectAllVisible}>
  全选当前
</button>

<button type="button" style={ghostBtn} onClick={invertVisible}>
  反选当前
</button>

<button type="button" style={ghostBtn} onClick={clearAllSelected}>
  清空选择
</button>

<button type="button" style={ghostBtn} onClick={bulkSaveSelected}>
  批量锁定选中
</button>

        <div
          style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}
        >
          <input
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="粘贴链接（PDF/网页）。切换分类会自动解析一次（有去重）。"
            style={{ ...inputStyle, maxWidth: 760 }}
          />

          <button
            type="button"
            onClick={handleFetchUrl}
            disabled={urlLoading}
            style={{
              ...btnStyle,
              opacity: urlLoading ? 0.6 : 1,
              cursor: urlLoading ? "not-allowed" : "pointer",
            }}
          >
            {urlLoading ? "提交中…" : "提交链接并解析"}
          </button>
        </div>

        <div
          style={{
            marginTop: 10,
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <label style={{ fontSize: 12, color: "#374151" }}>
            选择文件（可选）
            <input
              type="file"
              accept=".pdf,.doc,.docx,.txt,.csv,.xls,.xlsx,.htm,.html,application/pdf,application/msword,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/html,text/plain,text/csv"
              style={{ display: "block", marginTop: 6 }}
onChange={(e) => {
  const f = e.target.files?.[0] || null;
  setFile(f);
  if (f?.name) setFilename(f.name);
}}            />
          </label>

          <button type="button" onClick={handleSubmit} style={btnStyle}>
            上传并解析
          </button>

          <div
            style={{
              fontSize: 12,
              color: msg.startsWith("✅")
                ? "#059669"
                : msg.startsWith("❌")
                  ? "#dc2626"
                  : "#6b7280",
              whiteSpace: "pre-wrap",
            }}
          >
            {msg || "（提示）切换分类会自动刷新最新入库"}
          </div>
        </div>

        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 12, color: "#374151", marginBottom: 6 }}>
            filename（可改）
          </div>
          <input
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
            style={inputStyle}
          />
        </div>

        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 12, color: "#374151", marginBottom: 6 }}>
            raw_text（可选：不用文件也能解析）
          </div>
          <textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            style={taStyle}
          />
        </div>
      </div>

      <div style={{ marginTop: 12, ...card }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "center",
          }}
        >
          <div style={{ fontWeight: 900 }}>唯一表格（Program Catalog）</div>

          <button type="button" style={ghostBtn} onClick={() => loadLatest(fileKind)}>
            手动刷新
          </button>
        </div>

        <div
          style={{
            marginTop: 10,
            fontSize: 12,
            color: "#374151",
            display: "grid",
            gap: 6,
          }}
        >
          <div>
            分类=<b>{kindLabel((meta?.kind || fileKind) as FileKind)}</b>
            {"  "}｜{"  "}
            授课语言=
            <b>
              {studyLang === "zh"
                ? "中文"
                : studyLang === "en"
                  ? "英文"
                  : String(meta?.study_language || meta?.language || "自动识别")}
            </b>
            {"  "}｜{"  "}
            filename=<b>{String(meta?.filename || "") || "-"}</b>
            {"  "}｜{"  "}
            content_type=<b>{String(meta?.content_type || "") || "-"}</b>
            {"  "}｜{"  "}
            fetched_at=<b>{String(meta?.fetched_at || "") || "-"}</b>
          </div>

          {meta?.source_url ? (
            <div>
              source_url：
              <a
                href={openMaybe(String(meta.source_url))}
                target="_blank"
                rel="noreferrer"
                style={{ color: "#2563eb", marginLeft: 6 }}
              >
                {String(meta.source_url)}
              </a>
            </div>
          ) : null}

          {metaTuitionUrl ? (
            <div>
              当前收费标准 PDF（meta）：{" "}
              <a
                href={openMaybe(metaTuitionUrl)}
                target="_blank"
                rel="noreferrer"
                style={{ color: "#2563eb" }}
              >
                {metaTuitionUrl}
              </a>
            </div>
          ) : (
            <div style={{ color: "#9ca3af" }}>
              收费标准 PDF（meta）：未设置（用“链接用途=收费标准PDF”提交一次即可）
            </div>
          )}
        </div>

        {catalog.length > 0 ? (
  <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
    <div style={{ fontSize: 12, color: "#6b7280" }}>
      已解析行数：<b>{catalog.length}</b>（此处预览前 80 行；有学费的会排前面）
    </div>

    <div

     style={{
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  overflowX: "auto",
  overflowY: "auto",
  background: "#ffffff",
  maxHeight: 640,
}}>
      <table
        style={{
          width: "max-content",
          minWidth: "100%",
          borderCollapse: "collapse",
          fontSize: 12,
          tableLayout: "fixed",
        }}
      >
        <thead>
          <tr style={{ background: "#f9fafb" }}>
            {catalogColumns.map((c) => (
              <th
                key={c.key}
                style={{
                  position: "sticky",
                  top: 0,
                  zIndex: 20,
                  background: "#f9fafb",
                  textAlign: "left",
                  padding: "8px 10px",
                  borderBottom: "1px solid #e5e7eb",
                  whiteSpace: "nowrap",
                  boxShadow: "0 1px 0 #e5e7eb",
                }}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {visibleRows.map((r, i) => (
            <tr
              key={`${schoolId}:${String(r?.idx ?? i)}:${String(r?.major_code || "")}:${String(r?.program_name_cn || "")}:${String(r?.program_name_en || "")}`}
            >
              {catalogColumns.map((c) => (
                <td
                  key={c.key}
                  style={{
                    padding: "8px 10px",
                    borderBottom: "1px solid #f3f4f6",
                    verticalAlign: "top",
                    whiteSpace: "normal",
                    wordBreak: "break-word",
                    maxWidth: 220,
                  }}
                >
                  {renderCell((r as any)?.[c.key], c.key, r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    {parsed?.raw ? (
      <div style={{ marginTop: 10 }}>
        <details>
          <summary
            style={{ cursor: "pointer", color: "#2563eb", fontSize: 12 }}
          >
            展开查看 raw_text（前 2000 字）
          </summary>

          <pre
            style={{
              margin: 0,
              marginTop: 8,
              whiteSpace: "pre-wrap",
              maxHeight: 280,
              overflow: "auto",
              fontSize: 12,
            }}
          >
            {String(parsed.raw).slice(0, 2000)}
          </pre>
        </details>
      </div>
    ) : null}
  </div>
) : (

                  <div style={{ marginTop: 12, fontSize: 12, color: "#9ca3af" }}>
            当前 kind 没有 program_catalog 数据（提交目录 PDF/链接后再看）
          </div>
        )}
      </div>
    </div>
  );
}
export default function SchoolUploadPage() {
  return (
    <Suspense fallback={<div style={pageStyle}>Loading...</div>}>
      <SchoolUploadPageInner />
    </Suspense>
  );
}