export type DisciplineCategory =
  | "文科"
  | "商科"
  | "理科"
  | "工科"
  | "医学"
  | "艺术"
  | "法学"
  | "教育"
  | "体育"
  | "农学"
  | "交叉"
  | "其他";

export type DisciplineCategoryResult = {
  category: DisciplineCategory;
  confidence: number;
  matched_keywords: string[];
  source: "program" | "faculty" | "csca" | "mixed" | "fallback";
  needs_review: boolean;
};

function norm(s: any) {
  return String(s ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/[（）]/g, (m) => (m === "（" ? "(" : ")"))
    .replace(/\s+/g, " ")
    .trim();
}

function lower(s: any) {
  return norm(s).toLowerCase();
}

function uniq<T>(arr: T[]) {
  return Array.from(new Set(arr));
}

type Rule = {
  category: DisciplineCategory;
  weight: number;
  keywords: string[];
};

const PROGRAM_RULES: Rule[] = [
  {
    category: "医学",
    weight: 100,
    keywords: [
      "医学", "临床医学", "基础医学", "口腔医学", "预防医学", "公共卫生", "全球卫生",
      "护理", "护理学", "药学", "中药学", "药物", "药剂", "药理", "药事",
      "生物医学", "生物医学工程", "医学影像", "影像医学", "核医学", "放射",
      "康复", "检验医学", "麻醉", "儿科", "妇产", "肿瘤", "病理", "病原",
      "免疫", "流行病", "卫生统计", "营养", "医院管理",
      "clinical medicine", "basic medicine", "stomatology", "dentistry",
      "public health", "preventive medicine", "nursing", "pharmacy",
      "pharmaceutical", "biomedicine", "biomedical", "medical imaging",
      "radiology", "rehabilitation", "epidemiology", "immunology",
      "oncology", "pathology"
    ],
  },
  {
    category: "商科",
    weight: 95,
    keywords: [
      "经济", "经济学", "金融", "金融学", "金融工程", "保险", "保险学", "精算",
      "会计", "会计学", "财务", "财务管理", "工商管理", "企业管理", "管理科学",
      "管理科学与工程", "市场营销", "营销", "电子商务", "国际经济与贸易",
      "国际贸易", "贸易", "商务", "商业", "人力资源管理", "物流管理", "供应链",
      "审计", "税务", "旅游管理", "酒店管理", "应用经济", "数量经济",
      "产业经济", "国民经济", "mba", "emba", "finance", "banking",
      "accounting", "business", "business administration", "management",
      "marketing", "commerce", "economics", "international economics and trade",
      "international trade", "financial", "insurance", "actuarial",
      "human resource", "supply chain", "logistics", "audit", "taxation",
      "tourism management", "hotel management"
    ],
  },
  {
    category: "工科",
    weight: 90,
    keywords: [
      "工程", "工学", "机械", "自动化", "电气", "电子", "通信", "信息工程",
      "电子信息", "计算机", "软件工程", "网络空间安全", "人工智能", "智能科学",
      "数据科学", "大数据", "控制科学", "仪器", "材料", "材料科学", "土木",
      "建筑", "建筑学", "城乡规划", "交通", "船舶", "海洋工程", "航空", "航天",
      "能源", "动力工程", "环境工程", "化学工程", "化工", "工业工程", "微电子",
      "集成电路", "光电", "遥感", "测绘", "安全工程",
      "engineering", "mechanical", "automation", "electrical", "electronic",
      "telecommunication", "computer", "software engineering", "cybersecurity",
      "artificial intelligence", "data science", "control science", "instrument",
      "materials", "civil engineering", "architecture", "urban planning",
      "transportation", "ship", "marine engineering", "aerospace", "energy",
      "environmental engineering", "chemical engineering", "industrial engineering",
      "microelectronics", "integrated circuit", "remote sensing"
    ],
  },
  {
    category: "理科",
    weight: 85,
    keywords: [
      "数学", "应用数学", "基础数学", "概率论", "统计", "统计学", "应用统计",
      "物理", "物理学", "天文", "天文学", "化学", "应用化学", "生物",
      "生物学", "生命科学", "生态", "生态学", "地理", "地理科学", "地质",
      "地球科学", "地球物理", "大气", "大气科学", "海洋科学", "环境科学",
      "心理学", "应用心理学", "认知科学", "科学技术史", "自然科学",
      "mathematics", "math", "statistics", "physics", "astronomy", "chemistry",
      "biology", "life science", "ecology", "geography", "geology",
      "earth science", "geophysics", "atmospheric science", "marine science",
      "environmental science", "psychology", "cognitive science", "history of science"
    ],
  },
  {
    category: "文科",
    weight: 80,
    keywords: [
      "汉语言", "汉语言文学", "汉语国际教育", "中国语言文学", "语言学",
      "外国语言文学", "英语", "翻译", "日语", "韩语", "朝鲜语", "俄语",
      "法语", "德语", "西班牙语", "阿拉伯语", "新闻", "新闻学", "传播",
      "传播学", "广告学", "广播电视", "编辑出版", "图书馆学", "档案学",
      "信息资源管理", "历史", "历史学", "考古", "考古学", "哲学", "宗教学",
      "伦理学", "社会学", "社会工作", "民族学", "人类学", "政治学",
      "国际关系", "国际政治", "行政管理", "公共管理", "劳动与社会保障",
      "公共事业管理", "文化产业", "艺术史", "文学", "文艺学", "比较文学",
      "chinese language", "chinese literature", "teaching chinese", "linguistics",
      "foreign language", "english", "translation", "japanese", "korean",
      "russian", "french", "german", "spanish", "arabic", "journalism",
      "communication", "advertising", "radio", "television", "publishing",
      "library science", "archive", "history", "archaeology", "philosophy",
      "religion", "sociology", "social work", "anthropology", "political science",
      "international relations", "public administration", "public management",
      "humanities", "liberal arts"
    ],
  },
  {
    category: "法学",
    weight: 88,
    keywords: [
      "法学", "法律", "民商法", "刑法", "宪法", "行政法", "经济法", "国际法",
      "知识产权", "诉讼法", "law", "legal", "jurisprudence", "civil law",
      "criminal law", "constitutional law", "administrative law", "economic law",
      "international law", "intellectual property"
    ],
  },
  {
    category: "教育",
    weight: 86,
    keywords: [
      "教育", "教育学", "课程与教学", "学前教育", "特殊教育", "高等教育",
      "教育技术", "心理健康教育", "education", "pedagogy", "curriculum",
      "teaching", "preschool education", "special education", "higher education",
      "educational technology"
    ],
  },
  {
    category: "体育",
    weight: 86,
    keywords: ["体育", "运动", "运动训练", "体育教育", "社会体育", "sport", "sports", "physical education", "athletic", "exercise"],
  },
  {
    category: "艺术",
    weight: 86,
    keywords: [
      "艺术", "美术", "绘画", "设计", "视觉传达", "环境设计", "产品设计",
      "服装", "音乐", "舞蹈", "戏剧", "影视", "电影", "动画", "播音", "表演",
      "art", "fine arts", "painting", "design", "visual communication",
      "environmental design", "product design", "fashion", "music", "dance",
      "drama", "film", "animation", "performance"
    ],
  },
  {
    category: "农学",
    weight: 84,
    keywords: [
      "农学", "农业", "园艺", "植物保护", "植物科学", "动物科学", "动物医学",
      "林学", "水产", "草业", "食品科学", "agriculture", "agronomy",
      "horticulture", "plant protection", "plant science", "animal science",
      "veterinary", "forestry", "fishery", "food science"
    ],
  },
];

const FACULTY_RULES: Rule[] = [
  {
    category: "医学",
    weight: 75,
    keywords: [
      "医学院", "医学部", "基础医学院", "临床医学院", "口腔医学院", "公共卫生学院",
      "护理学院", "药学院", "医院", "school of medicine", "medical school",
      "school of public health", "school of nursing", "school of pharmacy", "hospital"
    ],
  },
  {
    category: "商科",
    weight: 70,
    keywords: [
      "商学院", "经济学院", "管理学院", "经济管理学院", "工商管理学院", "金融学院",
      "会计学院", "business school", "school of business", "school of economics",
      "school of management", "school of finance", "school of accounting"
    ],
  },
  {
    category: "工科",
    weight: 65,
    keywords: [
      "工程学院", "工学院", "信息学院", "计算机学院", "软件学院", "电子学院",
      "电气学院", "机械学院", "材料学院", "建筑学院", "环境工程学院",
      "人工智能学院", "集成电路学院", "school of engineering", "college of engineering",
      "school of computer", "school of software", "school of electronic",
      "school of electrical", "school of mechanical", "school of materials",
      "school of architecture", "school of artificial intelligence"
    ],
  },
  {
    category: "理科",
    weight: 60,
    keywords: [
      "数学学院", "物理学院", "化学学院", "生命科学学院", "地球科学学院",
      "地理学院", "环境学院", "心理学院", "天文学院", "science school",
      "school of science", "school of mathematics", "school of physics",
      "school of chemistry", "school of life sciences", "school of geography",
      "school of environment", "school of psychology", "school of astronomy"
    ],
  },
  {
    category: "文科",
    weight: 55,
    keywords: [
      "文学院", "外国语学院", "新闻传播学院", "历史学院", "哲学学院", "社会学院",
      "政府管理学院", "国际关系学院", "信息管理学院", "海外教育学院",
      "school of liberal arts", "school of foreign studies", "school of journalism",
      "school of history", "school of philosophy", "school of social",
      "school of government", "school of international relations",
      "school of information management", "institute for international students"
    ],
  },
  { category: "法学", weight: 65, keywords: ["法学院", "law school", "school of law"] },
  { category: "教育", weight: 65, keywords: ["教育学院", "师范学院", "school of education", "normal college"] },
  { category: "体育", weight: 65, keywords: ["体育学院", "体育系", "school of physical education", "department of physical education"] },
  { category: "艺术", weight: 65, keywords: ["艺术学院", "美术学院", "音乐学院", "设计学院", "电影学院", "school of art", "school of design", "school of music", "film academy"] },
  { category: "农学", weight: 65, keywords: ["农学院", "农业学院", "林学院", "园艺学院", "动物科技学院", "school of agriculture", "college of agriculture", "school of forestry"] },
];

const CSCA_RULES: Rule[] = [
  { category: "文科", weight: 40, keywords: ["文科中文", "humanities chinese"] },
  { category: "理科", weight: 35, keywords: ["理科中文", "stem chinese", "science chinese"] },
  { category: "理科", weight: 20, keywords: ["数学", "mathematics", "物理", "physics", "化学", "chemistry", "生物", "biology"] },
];

function hitKeywords(text: string, keywords: string[]) {
  const hits: string[] = [];
  const t = lower(text);

  for (const kw of keywords) {
    const k = lower(kw);
    if (!k) continue;
    if (t.includes(k)) hits.push(kw);
  }

  return hits;
}

function scoreRules(text: string, rules: Rule[], source: "program" | "faculty" | "csca") {
  const scores = new Map<DisciplineCategory, { score: number; hits: string[]; source: string }>();

  for (const rule of rules) {
    const hits = hitKeywords(text, rule.keywords);
    if (hits.length === 0) continue;

    const prev = scores.get(rule.category) || { score: 0, hits: [], source };
    prev.score += rule.weight + Math.min(hits.length - 1, 4) * 5;
    prev.hits.push(...hits);
    scores.set(rule.category, prev);
  }

  return scores;
}

function mergeScores(
  ...maps: Array<Map<DisciplineCategory, { score: number; hits: string[]; source: string }>>
) {
  const merged = new Map<DisciplineCategory, { score: number; hits: string[]; sources: Set<string> }>();

  for (const m of maps) {
    for (const [cat, v] of m.entries()) {
      const prev = merged.get(cat) || { score: 0, hits: [], sources: new Set<string>() };
      prev.score += v.score;
      prev.hits.push(...v.hits);
      prev.sources.add(v.source);
      merged.set(cat, prev);
    }
  }

  return merged;
}

export function classifyDisciplineCategory(input: {
  faculty_cn?: string | null;
  faculty_en?: string | null;
  program_name_cn?: string | null;
  program_name_en?: string | null;
  track_name_cn?: string | null;
  track_name_en?: string | null;
  csca_subjects_text?: string | null;
  raw_text?: string | null;
}): DisciplineCategoryResult {
  const programText = [
    input.program_name_cn,
    input.program_name_en,
    input.track_name_cn,
    input.track_name_en,
  ]
    .filter(Boolean)
    .join(" ");

  const facultyText = [input.faculty_cn, input.faculty_en].filter(Boolean).join(" ");
  const cscaText = String(input.csca_subjects_text || "");

  const programScores = scoreRules(programText, PROGRAM_RULES, "program");
  const facultyScores = scoreRules(facultyText, FACULTY_RULES, "faculty");
  const cscaScores = scoreRules(cscaText, CSCA_RULES, "csca");

  const merged = mergeScores(programScores, facultyScores, cscaScores);

  if (programScores.has("医学")) {
    const v = programScores.get("医学")!;
    return {
      category: "医学",
      confidence: Math.min(0.98, 0.75 + v.score / 300),
      matched_keywords: uniq(v.hits),
      source: "program",
      needs_review: false,
    };
  }

  const ranked = Array.from(merged.entries())
    .map(([category, v]) => ({
      category,
      score: v.score,
      hits: uniq(v.hits),
      sources: Array.from(v.sources),
    }))
    .sort((a, b) => b.score - a.score);

  if (ranked.length === 0) {
    return {
      category: "其他",
      confidence: 0,
      matched_keywords: [],
      source: "fallback",
      needs_review: true,
    };
  }

  const top = ranked[0];
  const second = ranked[1] || null;

  let confidence = Math.min(0.98, 0.45 + top.score / 220);
  if (second && top.score - second.score < 20) {
    confidence = Math.min(confidence, 0.62);
  }

  const source =
    top.sources.length > 1
      ? "mixed"
      : (top.sources[0] as "program" | "faculty" | "csca") || "fallback";

  return {
    category: top.category,
    confidence,
    matched_keywords: top.hits,
    source,
    needs_review:
      confidence < 0.7 ||
      Boolean(second && top.score - second.score < 15) ||
      top.category === "其他",
  };
}

export function mapDisciplineCategoryToTuitionGroup(
  category: DisciplineCategory,
): "文科" | "商科" | "理科" | "医学" | "其他" {
  if (category === "医学") return "医学";
  if (category === "商科") return "商科";
  if (category === "理科" || category === "工科" || category === "农学") return "理科";

  if (
    category === "文科" ||
    category === "法学" ||
    category === "教育" ||
    category === "体育" ||
    category === "艺术"
  ) {
    return "文科";
  }

  return "其他";
}

export function classifyTuitionGroup(
  input: Parameters<typeof classifyDisciplineCategory>[0],
) {
  const classified = classifyDisciplineCategory(input);
  return {
    ...classified,
    tuition_group: mapDisciplineCategoryToTuitionGroup(classified.category),
  };
}
