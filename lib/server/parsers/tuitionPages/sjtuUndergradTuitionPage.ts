// lib/server/parsers/tuitionPages/sjtuUndergradTuitionPage.ts

export type SjtuUndergradTuitionPageResult = {
  ok: boolean;
  tuition_rmb_per_year: number | null;
  tuition_note: string | null;
  pending_faculties: string[];
  parser: string;
};

function cleanHtmlText(raw: string) {
  return String(raw || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<\/td>/gi, " ")
    .replace(/<\/th>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseSjtuUndergradTuitionPage(
  raw: string,
): SjtuUndergradTuitionPageResult {
  const text = cleanHtmlText(raw);

  const patterns = [
    /学费[^。；;]{0,200}?(?:人民币|RMB)?\s*([1-9]\d{1,3}(?:,\d{3})+|[1-9]\d{4,6})\s*(?:元|RMB)?\s*(?:\/|每)?\s*(?:学年|年|Year|year)/i,
    /(?:人民币|RMB)\s*([1-9]\d{1,3}(?:,\d{3})+|[1-9]\d{4,6})\s*(?:元|RMB)?\s*(?:\/|每)?\s*(?:学年|年|Year|year)/i,
    /([1-9]\d{1,3}(?:,\d{3})+|[1-9]\d{4,6})\s*(?:元|RMB)\s*(?:\/|每)?\s*(?:学年|年|Year|year)/i,
  ];

  let tuition: number | null = null;

  for (const re of patterns) {
    const m = text.match(re);
    if (!m?.[1]) continue;

    const n = Number(String(m[1]).replace(/,/g, ""));
    if (Number.isFinite(n) && n >= 10000 && n <= 300000) {
      tuition = n;
      break;
    }
  }

  // 兜底：你已确认 2026 SJTU 本科中文项目是 24,800 元/学年
  if (tuition == null && /学费|费用标准|收费标准/.test(text)) {
    if (/24,?800|24800/.test(text)) {
      tuition = 24800;
    }
  }

  const pending_faculties: string[] = [];
  if (/溥渊未来技术学院[^。；;]{0,100}学费待定/.test(text)) {
    pending_faculties.push("溥渊未来技术学院");
  }

  return {
    ok: tuition != null,
    tuition_rmb_per_year: tuition,
    tuition_note: tuition ? `${tuition.toLocaleString("en-US")} RMB/Year` : null,
    pending_faculties,
    parser: "sjtu_undergrad_tuition_page_v1",
  };
}