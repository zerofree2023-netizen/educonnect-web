// lib/server/parsers/scholarshipPages/sjtuUndergradScholarship.ts

export type ScholarshipLevel = {
  level: string;
  duration: string | null;
  benefits: string[];
  raw_text: string;
};

export type ScholarshipPolicyResult = {
  ok: boolean;
  parser: string;
  name: string | null;
  levels: ScholarshipLevel[];
  amounts: {
    insurance_rmb_per_year: number | null;
    accommodation_subsidy_rmb_per_month: number | null;
    living_allowance_rmb_per_month: number | null;
  };
  notes: string[];
};

function cleanText(raw: string) {
  return String(raw || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/td>/gi, " ")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function pickMoney(text: string, keywords: string[], unit: "year" | "month") {
  const unitRe = unit === "year" ? "(?:学年|年)" : "(?:月)";
  for (const kw of keywords) {
    const re = new RegExp(
      `${kw}[^0-9人民币]{0,30}(?:人民币)?\\s*([1-9]\\d{2,5})\\s*元\\s*\\/\\s*${unitRe}`,
      "i",
    );
    const m = text.match(re);
    if (m?.[1]) return Number(m[1]);
  }
  return null;
}

export function parseSjtuUndergradScholarshipPolicy(
  raw: string,
): ScholarshipPolicyResult {
  const text = cleanText(raw);

  const insurance = pickMoney(text, ["保险费"], "year");
  const accommodation = pickMoney(text, ["住宿津贴", "住宿补贴"], "month");
  const living = pickMoney(text, ["生活补贴", "生活津贴"], "month");

  const levelDefs = [
    { level: "一等", marker: /一等/ },
    { level: "二等", marker: /二等/ },
    { level: "三等", marker: /三等/ },
  ];

  const levels: ScholarshipLevel[] = [];

  for (const item of levelDefs) {
    const idx = text.search(item.marker);
    if (idx < 0) continue;

    const nextIndexes = levelDefs
      .filter((x) => x.level !== item.level)
      .map((x) => {
        const i = text.slice(idx + 1).search(x.marker);
        return i >= 0 ? idx + 1 + i : -1;
      })
      .filter((i) => i > idx);

    const end = nextIndexes.length ? Math.min(...nextIndexes) : Math.min(text.length, idx + 220);
    const block = text.slice(idx, end);

    const benefits: string[] = [];
    if (/免学费/.test(block)) benefits.push("免学费");
    if (/保险费/.test(block)) benefits.push("保险费");
    if (/住宿津贴|住宿补贴/.test(block)) benefits.push("住宿津贴");
    if (/生活补贴|生活津贴/.test(block)) benefits.push("生活补贴");

    levels.push({
      level: item.level,
      duration: /按学制/.test(block) ? "按学制" : null,
      benefits,
      raw_text: block.trim(),
    });
  }

  const notes: string[] = [];
  if (/不得同时享有其他奖学金/.test(text)) notes.push("申请人不得同时享有其他奖学金");
  if (/评定结果与录取结果同时公布/.test(text)) notes.push("评定结果与录取结果同时公布");
  if (/最终解释权/.test(text)) notes.push("上海交通大学拥有最终解释权");

  return {
    ok: levels.length > 0 || insurance != null || accommodation != null || living != null,
    parser: "sjtu_undergrad_scholarship_policy_v1",
    name: text.includes("奖学金") ? "上海交通大学国际本科生奖学金" : null,
    levels,
    amounts: {
      insurance_rmb_per_year: insurance,
      accommodation_subsidy_rmb_per_month: accommodation,
      living_allowance_rmb_per_month: living,
    },
    notes,
  };
}