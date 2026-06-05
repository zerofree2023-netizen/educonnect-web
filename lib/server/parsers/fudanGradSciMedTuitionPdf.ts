export function parseFudanGradSciMedTuitionPdf(rawText: string) {
  const text = String(rawText || "");

  const isFudanGradSciMedTuition =
    text.includes("复旦大学外国留学生研究生") &&
    text.includes("理工医科菁英项目") &&
    (
      text.includes("硕士：理工科") ||
      text.includes("硕士:理工科") ||
      text.includes("博士：理工科") ||
      text.includes("博士:理工科") ||
      text.includes("中文授课项目")
    );

  if (!isFudanGradSciMedTuition) {
    return {
      ok: false,
      policy: null,
      meta: {
        parser: "fudan_grad_scimed_tuition_policy_v2",
        reason: "not_fudan_grad_scimed_tuition",
      },
    };
  }

  const policy = {
    parser: "fudan_grad_scimed_tuition_policy_v2",
    doc_type: "fudan_grad_scimed_tuition_policy",
    currency: "RMB",
    tuition_is_per_year: true,
    note: "中文授课项目；以上为学术学位学费标准，专业学位学费标准请向院系咨询。",
    rules: [
      {
        rule_key: "master_academic_science_engineering",
        kind: "master",
        degree_kind: "学术学位",
        discipline_group: "理工科",
        tuition_rmb_per_year: 30000,
        tuition_note: "中文授课项目；硕士理工科 30,000 RMB/Year；学术学位学费标准",
      },
      {
        rule_key: "master_academic_medical",
        kind: "master",
        degree_kind: "学术学位",
        discipline_group: "医科",
        tuition_rmb_per_year: 48000,
        tuition_note: "中文授课项目；硕士医科 48,000 RMB/Year；学术学位学费标准",
      },
      {
        rule_key: "phd_academic_science_engineering",
        kind: "phd",
        degree_kind: "学术学位",
        discipline_group: "理工科",
        tuition_rmb_per_year: 37000,
        tuition_note: "中文授课项目；博士理工科 37,000 RMB/Year；学术学位学费标准",
      },
      {
        rule_key: "phd_academic_medical",
        kind: "phd",
        degree_kind: "学术学位",
        discipline_group: "医科",
        tuition_rmb_per_year: 54000,
        tuition_note: "中文授课项目；博士医科 54,000 RMB/Year；学术学位学费标准",
      },
    ],
  };

  return {
    ok: true,
    policy,
    meta: {
      parser: "fudan_grad_scimed_tuition_policy_v2",
      doc_type: "fudan_grad_scimed_tuition_policy",
      rules: policy.rules.length,
    },
  };
}

