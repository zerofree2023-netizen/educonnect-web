export type GenericAdmissionGuidePatch = {
  apply_requirements_text?: string | null;
  application_time_text?: string | null;
  application_materials_text?: string | null;
  admission_process_text?: string | null;
  application_portal_text?: string | null;
  registration_period_text?: string | null;

  tuition_note?: string | null;
  application_fee_rmb?: number | null;
  application_fee_note?: string | null;
  insurance_fee_note?: string | null;
  accommodation_fee_note?: string | null;
  other_fee_note?: string | null;

  scholarship_note?: string | null;

  contact_raw?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;

  source_url?: string | null;
};

function norm(s: any) {
  return String(s || "")
    .replace(/\u00a0/g, " ")
    .replace(/\t/g, " ")
    .replace(/\r/g, "\n")
    .replace(/[ \f]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function compact(s: any) {
  return norm(s)
    .replace(/\n+/g, "；")
    .replace(/；{2,}/g, "；")
    .replace(/\s+/g, " ")
    .trim();
}

function clip(s: string | null | undefined, max = 1800) {
  const t = compact(s || "");
  if (!t) return null;
  return t.length > max ? t.slice(0, max) + "…" : t;
}

function escRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const HEADINGS = [
  "申请资格",
  "申请条件",
  "申请要求",
  "申请时间",
  "申请材料",
  "申请流程",
  "申请程序",
  "申请方式",
  "网上申请",
  "报名系统",
  "联系方式",
  "联系信息",
  "费用标准",
  "学费",
  "报名费",
  "申请费",
  "住宿费",
  "保险费",
  "医疗保险",
  "奖学金",
  "资助",
  "报到时间",
  "注册报到",
  "Registration Period",
  "Application",
  "Eligibility",
  "Requirements",
  "Application Period",
  "Application Materials",
  "Application Procedure",
  "Tuition",
  "Fees",
  "Scholarship",
  "Contact",
];

function sectionAfter(raw: string, headingPatterns: string[], stopHeadings = HEADINGS) {
  const text = norm(raw);
  const h = headingPatterns.map(escRe).join("|");
  const stops = stopHeadings
    .filter((x) => !headingPatterns.includes(x))
    .map(escRe)
    .join("|");

  const re = new RegExp(`(?:^|\\n)\\s*(?:${h})\\s*[:：]?\\s*\\n?([\\s\\S]*?)(?=\\n\\s*(?:${stops})\\s*[:：]?\\s*(?:\\n|$)|$)`, "i");
  const m = text.match(re);
  return m?.[1] ? clip(m[1]) : null;
}

function findEmails(raw: string) {
  const text = norm(raw);
  const emails = Array.from(new Set((text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []).map((x) => x.trim())));
  return emails.length ? emails.join("; ") : null;
}

function findPhones(raw: string) {
  const text = norm(raw);
  const phones = Array.from(new Set((text.match(/(?:\+?\d[\d\-()\s]{6,}\d)/g) || [])
    .map((x) => x.replace(/\s+/g, " ").trim())
    .filter((x) => /\d{6,}/.test(x.replace(/\D/g, "")))));
  return phones.slice(0, 6).join("; ") || null;
}

function findPortal(raw: string) {
  const text = norm(raw);
  const urls = Array.from(new Set(text.match(/https?:\/\/[^\s，。；;）)]+/gi) || []));
  const portal = urls.find((u) =>
    /apply|recruit|admission|isso|register|login|studyinchina|campuschina|chinese\.cn/i.test(u)
  );
  return portal ? `网申/申请相关链接：${portal}` : null;
}

function parseApplicationFee(raw: string): { fee: number | null; note: string | null } {
  const text = norm(raw);
  const m =
    text.match(/(?:报名费|申请费)[^\n。；;]{0,30}?(\d{2,5})\s*(?:元|RMB|人民币)/i) ||
    text.match(/(?:Application Fee|Registration Fee)[^\n。；;]{0,80}?(\d{2,5})\s*(?:RMB|元|人民币)/i);

  if (!m) return { fee: null, note: null };

  const fee = Number(m[1]);
  const note = clip(
    (text.match(/(?:报名费|申请费|Application Fee|Registration Fee)[\s\S]{0,220}/i) || [])[0] || "",
    320
  );

  return {
    fee: Number.isFinite(fee) ? fee : null,
    note: note || `申请/报名费：${fee} RMB。`,
  };
}

function parseInsurance(raw: string) {
  const text = norm(raw);
  const m = text.match(/(?:保险费|医疗保险|Medical Insurance)[\s\S]{0,260}/i);
  return clip(m?.[0] || null, 420);
}

function parseAccommodation(raw: string) {
  const text = norm(raw);
  const m = text.match(/(?:住宿费|住宿|Accommodation)[\s\S]{0,260}/i);
  return clip(m?.[0] || null, 420);
}

function parseTuition(raw: string) {
  const text = norm(raw);
  const m = text.match(/(?:学费|Tuition Fee|Tuition Fees)[\s\S]{0,700}/i);
  return clip(m?.[0] || null, 900);
}

function parseOtherFee(raw: string) {
  const text = norm(raw);
  const chunks: string[] = [];
  for (const key of ["体检", "Physical examination", "居留许可", "Residence Permit", "书本费", "Textbooks", "生活费", "Living expenses"]) {
    const m = text.match(new RegExp(`${escRe(key)}[\\s\\S]{0,120}`, "i"));
    if (m?.[0]) chunks.push(compact(m[0]));
  }
  return chunks.length ? clip(Array.from(new Set(chunks)).join("；"), 600) : null;
}

export function parseGenericAdmissionGuide(rawText: string, opts?: { sourceUrl?: string | null; filename?: string | null }) {
  const raw = norm(rawText);
  const appFee = parseApplicationFee(raw);

  const contactSection = sectionAfter(raw, ["联系方式", "联系信息", "Contact"]) || null;
  const scholarshipSection = sectionAfter(raw, ["奖学金", "Scholarship", "资助"]) || null;

  const out: GenericAdmissionGuidePatch = {
    apply_requirements_text:
      sectionAfter(raw, ["申请资格", "申请条件", "申请要求", "Eligibility", "Requirements"]),
    application_time_text:
      sectionAfter(raw, ["申请时间", "Application Period"]) ||
      clip((raw.match(/20\d{2}年\d{1,2}月\d{1,2}日\s*[-—至到]\s*20\d{2}年\d{1,2}月\d{1,2}日/) || [])[0] || null, 200),
    application_materials_text:
      sectionAfter(raw, ["申请材料", "Application Materials"]),
    admission_process_text:
      sectionAfter(raw, ["申请流程", "申请程序", "Application Procedure", "Application Process"]),
    application_portal_text:
      sectionAfter(raw, ["网上申请", "报名系统", "申请方式"]) || findPortal(raw),
    registration_period_text:
      sectionAfter(raw, ["报到时间", "注册报到", "Registration Period"]),

    tuition_note: parseTuition(raw),
    application_fee_rmb: appFee.fee,
    application_fee_note: appFee.note,
    insurance_fee_note: parseInsurance(raw),
    accommodation_fee_note: parseAccommodation(raw),
    other_fee_note: parseOtherFee(raw),

    scholarship_note: scholarshipSection,

    contact_raw: contactSection,
    contact_email: findEmails(raw),
    contact_phone: findPhones(raw),

    source_url: opts?.sourceUrl || null,
  };

  const filled = Object.values(out).filter((x) => x !== null && x !== undefined && String(x).trim() !== "").length;

  return {
    ok: filled > 0,
    patch: out,
    meta: {
      parser: "generic_admission_guide_v1",
      filled,
      filename: opts?.filename || null,
      source_url: opts?.sourceUrl || null,
    },
  };
}

export function applyGenericAdmissionGuidePatchToCatalog(args: {
  rows: any[];
  patch: GenericAdmissionGuidePatch;
  sourceName?: string | null;
}) {
  const rows = Array.isArray(args.rows) ? args.rows : [];
  const patch = args.patch || {};
  const sourceName = String(args.sourceName || "").trim();

  if (rows.length === 0) return rows;

  const next = rows.map((row: any) => {
    const r = { ...(row || {}) };

    const out: any = { ...r };

    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === undefined || String(v).trim() === "") continue;

      if (k === "application_fee_rmb") {
        out[k] = out[k] ?? v;
      } else {
        out[k] = String(out[k] || "").trim() || v;
      }
    }

    if (sourceName) {
      out.source_files = Array.from(
        new Set([
          ...((Array.isArray(out.source_files) ? out.source_files : []) as any[]),
          sourceName,
        ].filter(Boolean)),
      );
    }

    out.tags = Array.from(
      new Set([
        ...((Array.isArray(out.tags) ? out.tags : []) as any[]),
        patch.apply_requirements_text ? "申请信息已补" : null,
        patch.tuition_note ? "收费已填" : null,
        patch.scholarship_note ? "奖学金已补" : null,
      ].filter(Boolean)),
    );

    return out;
  });

  return next;
}
