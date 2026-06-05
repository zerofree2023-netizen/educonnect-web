export function parseFudanUndergradTuitionPdf(rawText: string) {
  const text = String(rawText || "")
    .replace(/\u00a0/g, " ")
    .replace(/\r/g, "\n");

  const isTarget =
    text.includes("复旦大学外国留学生本科生中文授课专业学费标准") &&
    text.includes("招生专业") &&
    text.includes("学费标准");

  if (!isTarget) {
    return {
      ok: false,
      rows: [],
      meta: {
        parser: "fudan_undergrad_tuition_pdf_v1",
        reason: "not_target_pdf",
      },
    };
  }

  const liberalPrograms = [
    "汉语言（对外语言文化方向）",
    "汉语言（对外商务汉语方向）",
    "汉语言文学",
    "汉语言",
    "历史学",
    "文物与博物馆学",
    "哲学",
    "宗教学",
    "法学",
    "英语",
    "翻译",
    "法语",
    "德语",
    "日语",
    "西班牙语",
    "俄语",
    "朝鲜语",
    "新闻学",
    "广播电视学",
    "传播学",
    "广告学",
    "政治学与行政学",
    "国际政治",
    "行政管理",
    "社会学",
    "社会工作",
    "旅游管理",
    "经济学",
    "国际经济与贸易",
    "金融学",
    "保险学",
    "财政学",
    "管理学类（含会计学、市场营销、工商管理、管理科学、信息管理与信息系统、财务管理、统计学 7 个专业）",
  ];

  const sciencePrograms = [
    "数学与应用数学",
    "物理学",
    "化学",
    "能源化学",
    "生物科学",
    "生物技术",
    "大气科学",
    "环境科学",
    "高分子材料与工程",
    "心理学",
    "计算机科学与技术",
    "软件工程",
    "人工智能",
    "电子信息科学与技术",
    "光电信息科学与工程",
    "通信工程",
    "生物医学工程",
    "材料科学与工程",
    "新能源科学与工程",
    "飞行器设计与工程",
    "理论与应用力学",
    "智能科学与技术",
  ];

  const medicalPrograms = [
    "护理学",
    "药学",
    "口腔医学",
    "临床医学（五年制）",
    "基础医学",
    "预防医学",
    "公共事业管理",
  ];

  const facultyMap: Record<string, string> = {
    "汉语言（对外语言文化方向）": "国际文化交流学院",
    "汉语言（对外商务汉语方向）": "国际文化交流学院",
    汉语言文学: "中国语言文学系",
    汉语言: "中国语言文学系",
    历史学: "历史学系",
    文物与博物馆学: "文物与博物馆学系",
    哲学: "哲学学院",
    宗教学: "哲学学院",
    法学: "法学院",
    英语: "外国语言文学学院",
    翻译: "外国语言文学学院",
    法语: "外国语言文学学院",
    德语: "外国语言文学学院",
    日语: "外国语言文学学院",
    西班牙语: "外国语言文学学院",
    俄语: "外国语言文学学院",
    朝鲜语: "外国语言文学学院",
    新闻学: "新闻学院",
    广播电视学: "新闻学院",
    传播学: "新闻学院",
    广告学: "新闻学院",
    政治学与行政学: "国际关系与公共事务学院",
    国际政治: "国际关系与公共事务学院",
    行政管理: "国际关系与公共事务学院",
    社会学: "社会发展与公共政策学院",
    社会工作: "社会发展与公共政策学院",
    旅游管理: "旅游学系",
    经济学: "经济学院",
    国际经济与贸易: "经济学院",
    金融学: "经济学院",
    保险学: "经济学院",
    财政学: "经济学院",
    "管理学类（含会计学、市场营销、工商管理、管理科学、信息管理与信息系统、财务管理、统计学 7 个专业）": "管理学院",

    数学与应用数学: "数学科学学院",
    物理学: "物理学系",
    化学: "化学系",
    能源化学: "化学系",
    生物科学: "生命科学学院",
    生物技术: "生命科学学院",
    大气科学: "大气与海洋科学系",
    环境科学: "环境科学与工程系",
    高分子材料与工程: "高分子科学系",
    心理学: "社会发展与公共政策学院",
    计算机科学与技术: "计算与智能创新学院",
    软件工程: "计算与智能创新学院",
    人工智能: "计算与智能创新学院",
    电子信息科学与技术: "未来信息创新学院",
    光电信息科学与工程: "未来信息创新学院",
    通信工程: "未来信息创新学院",
    生物医学工程: "生物医学工程与技术创新学院",
    材料科学与工程: "智能材料与未来能源创新学院",
    新能源科学与工程: "智能材料与未来能源创新学院",
    飞行器设计与工程: "智能机器人与先进制造创新学院",
    理论与应用力学: "智能机器人与先进制造创新学院",
    智能科学与技术: "智能机器人与先进制造创新学院",

    护理学: "上海医学院护理学院",
    药学: "上海医学院药学院",
    口腔医学: "上海医学院口腔医学院",
    "临床医学（五年制）": "上海医学院临床医学院",
    基础医学: "上海医学院基础医学院",
    预防医学: "上海医学院公共卫生学院",
    公共事业管理: "上海医学院公共卫生学院",
  };

  const rows: any[] = [];

  const getDurationYears = (program: string, defaultDuration: number) => {
    if (
      program === "口腔医学" ||
      program === "临床医学（五年制）" ||
      program === "基础医学" ||
      program === "预防医学"
    ) {
      return 5;
    }

    return defaultDuration;
  };

  const pushRows = (
    programs: string[],
    tuition: number,
    category: string,
    duration: number,
  ) => {
    for (const program of programs) {
      if (!text.includes(program)) continue;

      rows.push({
        faculty_cn: facultyMap[program] || null,
        program_name_cn: program,
        duration_years: getDurationYears(program, duration),
        tuition_rmb_per_year: tuition,
        tuition_is_per_year: true,
        tuition_note: `${category} ${tuition.toLocaleString("en-US")} RMB/Year`,
        degree_type: "本科",
        study_language: "zh",
        language_text: "中文",
        raw_line: program,
      });
    }
  };

  pushRows(liberalPrograms, 23000, "文科", 4);
  pushRows(sciencePrograms, 26000, "理科", 4);
  pushRows(medicalPrograms, 42000, "医科", 4);

  rows.forEach((row, index) => {
    row.idx = index + 1;
  });

  return {
    ok: rows.length > 0,
    rows,
    meta: {
      parser: "fudan_undergrad_tuition_pdf_v1",
      doc_type: "fudan_undergrad_tuition",
      rows: rows.length,
      tuition_groups: [
        { category: "文科", tuition_rmb_per_year: 23000 },
        { category: "理科", tuition_rmb_per_year: 26000 },
        { category: "医科", tuition_rmb_per_year: 42000 },
      ],
    },
  };
}