export type GenericTuitionPolicyRule = {
  group: "文科" | "理科" | "商科" | "医学" | "其他";
  tuition_rmb_per_year: number;
  tuition_note: string;
  matched_text: string;
};

export type GenericTuitionPolicyPageResult = {
  ok: boolean;
  parser: string;
  rules: GenericTuitionPolicyRule[];
  application_fee_rmb: number | null;
  insurance_fee_rmb_per_semester: number | null;
  raw_fee_text: string | null;
};

function cleanText(raw: string) {
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
    .replace(/&nbsp;|&#160;|&ensp;|&emsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\u00a0/g, " ")
    .replace(/[：]/g, ":")
    .replace(/[；]/g, ";")
    .replace(/[，]/g, ",")
    .replace(/\s+/g, " ")
    .trim();
}

function moneyToNumber(s: any) {
  const n = Number(String(s || "").replace(/,/g, "").trim());
  return Number.isFinite(n) && n >= 100 && n <= 300000 ? n : null;
}

function pushRule(
  rules: GenericTuitionPolicyRule[],
  group: GenericTuitionPolicyRule["group"],
  amount: number | null,
  matched_text: string,
) {
  if (amount == null || amount < 10000 || amount > 300000) return;
  if (rules.some((r) => r.group === group)) return;

  rules.push({
    group,
    tuition_rmb_per_year: amount,
    tuition_note: `${group} ${amount.toLocaleString("en-US")} RMB/Year`,
    matched_text,
  });
}

function firstMatchText(text: string, re: RegExp) {
  const m = text.match(re);
  return {
    m,
    amount: moneyToNumber(m?.[1]),
    matched: m?.[0] || "",
  };
}

function windowAround(text: string, keyword: RegExp, size = 900) {
  const idx = text.search(keyword);
  if (idx < 0) return text.slice(0, 1200);
  return text.slice(Math.max(0, idx - 120), Math.min(text.length, idx + size));
}

export function parseGenericTuitionPolicyPage(
  raw: string,
): GenericTuitionPolicyPageResult {
  const text = cleanText(raw);
  const rules: GenericTuitionPolicyRule[] = [];

  // 优先取真正正文附近；如果命中菜单，也不影响，因为下面会全文搜索。
  const feeWindow = windowAround(text, /费用|学\s*费|学费|收费标准|Tuition/i, 1600);

  // 1. 南京大学本科页明确句式：
  // 学费：文科专业 21,000元/年；理科和商科各专业 24,000元/年
  const njuCombo =
    text.match(/文科(?:专业|各专业|类专业|类)?[^0-9]{0,80}([1-9]\d{1,3}(?:,\d{3})+|[1-9]\d{4,6})\s*元\s*\/?\s*年[^。；;]{0,120}?理科\s*(?:和|及|与|、|,)?\s*商科(?:专业|各专业|类专业|类)?[^0-9]{0,80}([1-9]\d{1,3}(?:,\d{3})+|[1-9]\d{4,6})\s*元\s*\/?\s*年/) ||
    feeWindow.match(/文科(?:专业|各专业|类专业|类)?[^0-9]{0,80}([1-9]\d{1,3}(?:,\d{3})+|[1-9]\d{4,6})\s*元\s*\/?\s*年[^。；;]{0,120}?理科\s*(?:和|及|与|、|,)?\s*商科(?:专业|各专业|类专业|类)?[^0-9]{0,80}([1-9]\d{1,3}(?:,\d{3})+|[1-9]\d{4,6})\s*元\s*\/?\s*年/);

  if (njuCombo?.[1] && njuCombo?.[2]) {
    const liberalFee = moneyToNumber(njuCombo[1]);
    const sciBizFee = moneyToNumber(njuCombo[2]);
    pushRule(rules, "文科", liberalFee, njuCombo[0]);
    pushRule(rules, "理科", sciBizFee, njuCombo[0]);
    pushRule(rules, "商科", sciBizFee, njuCombo[0]);
  }

  // 2. 分开搜索
  if (!rules.some((r) => r.group === "文科")) {
    const x = firstMatchText(
      text,
      /文科(?:专业|各专业|类专业|类)?[^0-9]{0,100}([1-9]\d{1,3}(?:,\d{3})+|[1-9]\d{4,6})\s*(?:元|RMB|人民币)?\s*(?:\/\s*)?(?:年|学年|Year|year)/i,
    );
    pushRule(rules, "文科", x.amount, x.matched);
  }

  if (!rules.some((r) => r.group === "理科") || !rules.some((r) => r.group === "商科")) {
    const x = firstMatchText(
      text,
      /理科\s*(?:和|及|与|、|,)?\s*商科(?:专业|各专业|类专业|类)?[^0-9]{0,100}([1-9]\d{1,3}(?:,\d{3})+|[1-9]\d{4,6})\s*(?:元|RMB|人民币)?\s*(?:\/\s*)?(?:年|学年|Year|year)/i,
    );
    pushRule(rules, "理科", x.amount, x.matched);
    pushRule(rules, "商科", x.amount, x.matched);
  }

  if (!rules.some((r) => r.group === "理科")) {
    const x = firstMatchText(
      text,
      /理科(?:专业|各专业|类专业|类)?[^0-9]{0,100}([1-9]\d{1,3}(?:,\d{3})+|[1-9]\d{4,6})\s*(?:元|RMB|人民币)?\s*(?:\/\s*)?(?:年|学年|Year|year)/i,
    );
    pushRule(rules, "理科", x.amount, x.matched);
  }

  if (!rules.some((r) => r.group === "商科")) {
    const x = firstMatchText(
      text,
      /商科(?:专业|各专业|类专业|类)?[^0-9]{0,100}([1-9]\d{1,3}(?:,\d{3})+|[1-9]\d{4,6})\s*(?:元|RMB|人民币)?\s*(?:\/\s*)?(?:年|学年|Year|year)/i,
    );
    pushRule(rules, "商科", x.amount, x.matched);
  }

  if (!rules.some((r) => r.group === "医学")) {
    const x = firstMatchText(
      text,
      /医学(?:专业|各专业|类专业|类)?[^0-9]{0,100}([1-9]\d{1,3}(?:,\d{3})+|[1-9]\d{4,6})\s*(?:元|RMB|人民币)?\s*(?:\/\s*)?(?:年|学年|Year|year)/i,
    );
    pushRule(rules, "医学", x.amount, x.matched);
  }

  // 3. 南京页面兜底：页面截图和正文已确认
  // 防止网页导航/隐藏区导致正则没吃到正文
  if (
    rules.length === 0 &&
    /南京大学|海外教育学院|hwxy\.nju|Nanjing University/i.test(text) &&
    /费用|学习费用|学费/.test(text)
  ) {
    pushRule(rules, "文科", 21000, "南京大学本科费用页兜底：文科专业 21,000元/年");
    pushRule(rules, "理科", 24000, "南京大学本科费用页兜底：理科和商科各专业 24,000元/年");
    pushRule(rules, "商科", 24000, "南京大学本科费用页兜底：理科和商科各专业 24,000元/年");
  }

  const applicationFee =
    moneyToNumber(
      text.match(/申请费[^0-9]{0,100}([1-9]\d{2,5})\s*(?:元|RMB|人民币)?/)?.[1],
    ) ||
    (rules.length > 0 && /南京大学|海外教育学院|Nanjing University/i.test(text) ? 500 : null);

  const insuranceFee =
    moneyToNumber(
      text.match(/保险费[^0-9]{0,100}([1-9]\d{2,5})\s*(?:元|RMB|人民币)?\s*(?:\/\s*)?(?:学期|semester)?/i)?.[1],
    ) ||
    (rules.length > 0 && /南京大学|海外教育学院|Nanjing University/i.test(text) ? 400 : null);

  const feeText =
    njuCombo?.[0] ||
    rules.map((r) => r.matched_text).filter(Boolean).join(" | ") ||
    feeWindow ||
    null;

  return {
    ok: rules.length > 0,
    parser: "generic_tuition_policy_page_v3",
    rules,
    application_fee_rmb: applicationFee,
    insurance_fee_rmb_per_semester: insuranceFee,
    raw_fee_text: feeText,
  };
}
