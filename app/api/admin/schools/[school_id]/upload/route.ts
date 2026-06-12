// app/api/admin/schools/[school_id]/upload/route.ts
import { NextResponse } from "next/server";
import { parseGenericProgramCatalog } from "@/lib/server/parsers/genericProgramCatalog";
import { parseGenericAdmissionGuide, applyGenericAdmissionGuidePatchToCatalog } from "@/lib/server/parsers/genericAdmissionGuide";
import { parseWhuUgChineseDocx, parseWhuUgEnglishDocx } from "@/lib/server/parsers/whuUgDocxCatalog";
import mammoth from "mammoth";
import { createClient } from "@supabase/supabase-js";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFile, unlink, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import * as XLSX from "xlsx";
import Papa from "papaparse";

import { parseNotes } from "@/scripts/lib/parse_notes";
import { parseProgramCatalogFromText } from "@/scripts/lib/parse_program_catalog";
import { parseFudanIsoTuitionPdf } from "@/lib/server/parsers/fudanIsoTuitionPdf";
import { parseZjuIczuCatalogPdfUg } from "@/lib/server/parsers/zjuIczuCatalogPdf";
import { parseUstcUgCatalogImagePdf } from "@/lib/server/parsers/ustcUgCatalogImagePdf";
import { parseUstcMasterEnglishImagePdf } from "@/lib/server/parsers/ustcMasterEnglishImagePdf";
import { parseUstcMasterChineseImagePdf } from "@/lib/server/parsers/ustcMasterChineseImagePdf";
import { parseUstcPhdChineseImagePdf } from "@/lib/server/parsers/ustcPhdChineseImagePdf";
import { parseUstcPhdEnglishImagePdf } from "@/lib/server/parsers/ustcPhdEnglishImagePdf";
import { parseSjtuUndergradTuitionPage } from "@/lib/server/parsers/tuitionPages/sjtuUndergradTuitionPage";
import { parseGenericTuitionPolicyPage } from "@/lib/server/parsers/tuitionPages/genericTuitionPolicyPage";
import { parseSjtuUndergradScholarshipPolicy } from "@/lib/server/parsers/scholarshipPages/sjtuUndergradScholarship";
import { parseFudanUndergradCatalogPdf } from "@/lib/server/parsers/fudanUndergradCatalogPdf";
import { parseFudanUndergradTuitionPdf } from "@/lib/server/parsers/fudanUndergradTuitionPdf";
import { parseFudanGradSciMedTuitionPdf } from "@/lib/server/parsers/fudanGradSciMedTuitionPdf";
import { parseFudanGradSciMedCatalogPdf } from "@/lib/server/parsers/fudan/fudanGradSciMedCatalogPdf";
import { classifyNonPdfHtmlStrategy } from "@/lib/server/parsers/htmlPolicies/nonPdfHtmlStrategy";
import { parseNjuMasterHtmlProgramDetail } from "@/lib/server/parsers/htmlProgramDetails/njuMasterHtmlProgramDetail";

import { classifyProgramDoc } from "@/lib/server/parsers/classifyProgramDoc";
import { parseSjtuDoctorCatalogPdf } from "@/lib/server/parsers/sjtuDoctorCatalogPdf";
import { parseSjtuMasterCatalogPdf } from "@/lib/server/parsers/sjtuMasterCatalogPdf";
import { parseSjtuUndergradCatalogPdf } from "@/lib/server/parsers/sjtuUndergradCatalogPdf";
import { parseSysuUndergradCatalogPdf } from "@/lib/server/parsers/sysuUndergradCatalogPdf";

import { parseGenericTablePdfByKind } from "@/lib/server/parsers/parseGenericTablePdfByKind";
import { classifyTuitionGroup } from "@/lib/server/parsers/classifyDisciplineCategory";
import { parseGenericBilingualCatalogPdf } from "@/lib/server/parsers/genericBilingualCatalogPdf";
import { parseGenericBilingualCodeCatalogPdf } from "@/lib/server/parsers/genericBilingualCodeCatalogPdf";
import { parseGenericCnResearchCatalogPdf } from "@/lib/server/parsers/genericCnResearchCatalogPdf";
import { parseGenericCnCodeCatalogPdf } from "@/lib/server/parsers/genericCnCodeCatalogPdf";
import { parseApplyGuidePdf } from "@/lib/server/parsers/applyGuidePdf";
import { generateProgramReviewIssues } from "@/lib/programReview";
import {
  applyXjtuGradTuition,
  getXjtuGradTuitionGroup,
  getXjtuGradTuitionNote,
  getXjtuGradTuitionRmbPerYear,
} from "@/lib/server/ingest/profiles/xjtu";
import { parseGenericAdmissionBrochureUndergradPdf } from "@/lib/server/parsers/genericAdmissionBrochureUndergradPdf";
import { parseBitGraduateAdmissionBrochurePdf } from "@/lib/server/parsers/bitGraduateAdmissionBrochurePdf";
import { parseBitLanguageProgramBrochurePdf } from "@/lib/server/parsers/bitLanguageProgramBrochurePdf";
import { parseBitExchangeProgramBrochurePdf } from "@/lib/server/parsers/bitExchangeProgramBrochurePdf";




export const runtime = "nodejs";
export const maxDuration = 300;


function parseSeuUndergradCatalogPdf(rawText: string, filename?: string | null) {
  const raw = String(rawText || "");
  const file = String(filename || "东南大学本科.pdf");

  const isSeuUg =
    /院系名称\s*专业名称\s*CSCA\s*考试科目\s*学制/.test(raw) &&
    /建筑学（英文授课）|建筑学\(英文授课\)/.test(raw) &&
    /智慧交通（英文授课）|智慧交通\(英文授课\)/.test(raw) &&
    /临床医学\(英文授课\)|临床医学\s*\(英文授课\)/.test(raw);

  if (!isSeuUg) return null;

  const rows: any[] = [
    ["建筑学院", "建筑学", "文科或理科中文+数学", 5],
    ["建筑学院", "建筑学（英文授课）", "数学", 5],
    ["建筑学院", "城乡规划", "文科或理科中文+数学", 4],
    ["建筑学院", "风景园林", "文科或理科中文+数学", 4],
    ["机械工程学院", "机械工程", "理科中文+数学+物理", 4],
    ["能源与环境学院", "能源与动力工程", "理科中文+数学+物理", 4],
    ["能源与环境学院", "核工程与核技术", "理科中文+数学+物理", 4],
    ["能源与环境学院", "环境工程", "理科中文+数学+物理", 4],
    ["材料科学与工程学院", "材料科学与工程", "理科中文+数学+物理", 4],
    ["土木工程学院", "土木工程", "理科中文+数学+物理", 4],
    ["土木工程学院", "土木工程（英文授课）", "数学+物理", 4],
    ["土木工程学院", "给排水科学与工程", "理科中文+数学+物理", 4],
    ["土木工程学院", "工程管理", "理科中文+数学+物理", 4],
    ["土木工程学院", "智能建造", "理科中文+数学+物理", 4],
    ["土木工程学院", "工程力学", "理科中文+数学+物理", 4],
    ["交通学院", "交通工程", "理科中文+数学+物理", 4],
    ["交通学院", "交通运输", "理科中文+数学+物理", 4],
    ["交通学院", "智慧交通（英文授课）", "数学+物理", 4],
    ["交通学院", "城市地下空间工程", "理科中文+数学+物理", 4],
    ["交通学院", "道路桥梁与渡河工程", "理科中文+数学+物理", 4],
    ["交通学院", "智慧交通", "理科中文+数学+物理", 4],
    ["自动化学院", "自动化", "理科中文+数学+物理", 4],
    ["自动化学院", "机器人工程", "理科中文+数学+物理", 4],
    ["电气工程学院", "电气工程及其自动化", "理科中文+数学+物理", 4],
    ["仪器科学与工程学院", "智能感知工程", "理科中文+数学+物理", 4],
    ["仪器科学与工程学院", "测控技术与仪器", "理科中文+数学+物理", 4],
    ["化学化工学院", "化学", "理科中文+数学+化学", 4],
    ["化学化工学院", "化学工程与工艺", "理科中文+数学+化学", 4],
    ["化学化工学院", "制药工程", "理科中文+数学+化学", 4],
    ["生命科学与技术学院", "生物科学", "理科中文+数学+物理", 4],
    ["信息科学与工程学院", "信息工程", "理科中文+数学+物理", 4],
    ["电子科学与工程学院", "电子科学与技术", "理科中文+数学+物理", 4],
    ["生物科学与医学工程学院", "生物医学工程", "理科中文+数学+物理", 4],
    ["生物科学与医学工程学院", "生物信息学", "理科中文+数学+物理", 4],
    ["生物科学与医学工程学院", "智能医学工程", "理科中文+数学+物理", 4],
    ["计算机科学与工程学院", "计算机科学与技术", "理科中文+数学+物理", 4],
    ["软件学院", "软件工程", "理科中文+数学+物理", 4],
    ["网络空间安全学院", "网络空间安全", "理科中文+数学+物理", 4],
    ["人工智能学院", "人工智能", "理科中文+数学+物理", 4],
    ["数学学院", "数学与应用数学", "理科中文+数学", 4],
    ["数学学院", "信息与计算科学", "理科中文+数学", 4],
    ["数学学院", "统计学", "理科中文+数学", 4],
    ["物理学院", "应用物理学", "理科中文+数学+物理", 4],
    ["物理学院", "物理学", "理科中文+数学+物理", 4],
    ["经济管理学院", "国际经济与贸易", "文科或理科中文+数学", 4],
    ["经济管理学院", "金融学", "文科或理科中文+数学", 4],
    ["经济管理学院", "经济学", "文科或理科中文+数学", 4],
    ["经济管理学院", "电子商务", "文科或理科中文+数学", 4],
    ["经济管理学院", "电子商务（英文授课）", "数学", 4],
    ["经济管理学院", "物流管理", "文科或理科中文+数学", 4],
    ["经济管理学院", "工商管理", "文科或理科中文+数学", 4],
    ["经济管理学院", "会计学", "文科或理科中文+数学", 4],
    ["公共卫生学院", "劳动与社会保障", "理科中文+数学+化学", 4],
    ["公共卫生学院", "预防医学", "理科中文+数学+化学", 5],
    ["人文学院", "政治学与行政学", "文科中文+数学", 4],
    ["人文学院", "社会学", "文科中文+数学", 4],
    ["人文学院", "汉语言文学", "文科中文+数学", 4],
    ["人文学院", "旅游管理", "文科中文+数学", 4],
    ["人文学院", "哲学", "文科中文+数学", 4],
    ["法学院", "法学", "文科中文+数学", 4],
    ["医学院", "临床医学", "理科中文+数学+化学", 5],
    ["医学院", "临床医学(英文授课)", "数学+化学", 6],
    ["医学院", "医学影像学", "理科中文+数学+化学", 5],
    ["外国语学院", "英语", "文科中文+数学", 4],
    ["外国语学院", "日语", "文科中文+数学", 4],
    ["艺术学院", "动画", "文科中文+数学", 4],
    ["艺术学院", "美术学", "文科中文+数学", 4],
    ["艺术学院", "产品设计", "文科中文+数学", 4],
    ["艺术学院", "艺术史论", "文科中文+数学", 4],
  ];

  const program_catalog = rows.map(([faculty_cn, program_name_cn, csca_subjects_text, duration_years], i) => {
    const isEnglish = String(program_name_cn).includes("英文授课");
    const tuitionMin = isEnglish ? 20000 : 16000;
    const tuitionMax = isEnglish ? 40000 : 20000;

    return {
      idx: i + 1,
      kind: "ug",
      degree_kind: "ug",
      degree_type: "本科",
      program_category: "undergraduate",
      faculty_cn,
      college_cn: faculty_cn,
      program_name_cn,
      major_name_cn: program_name_cn,
      csca_subjects_text,
      entrance_exam_subjects_text: csca_subjects_text,
      duration_years,
      duration_text: `${duration_years}年`,
      study_language: isEnglish ? "en" : "zh",
      language_text: isEnglish ? "英文" : "中文",
      study_mode_cn: "全日制",
      tuition_rmb_per_year: `${tuitionMin.toLocaleString("en-US")}-${tuitionMax.toLocaleString("en-US")}`,
      tuition_rmb_per_year_min: tuitionMin,
      tuition_rmb_per_year_max: tuitionMax,
      tuition_rmb_per_year_text: `${tuitionMin.toLocaleString("en-US")}-${tuitionMax.toLocaleString("en-US")}`,
      tuition_note: isEnglish
        ? "英文授课本科每年学费：20,000-40,000元人民币。"
        : "中文授课本科每年学费：16,000-20,000元人民币。",
      application_fee_rmb: 800,
      application_fee_note: "申请费：800元。",
      accommodation_fee_note: "住宿费：9000元人民币/年（双人间中的一个床位）。",
      source_files: [file],
      tags: ["本科", isEnglish ? "英文授课" : "中文授课", "东南大学", String(faculty_cn)],
    };
  });

  return {
    raw,
    checklist: {
      has_program_catalog: true,
      has_faculty: true,
      has_csca_subjects: true,
      has_duration: true,
      has_tuition: true,
      has_application_fee: true,
    },
    program_catalog,
    program_catalog_meta: {
      rows: program_catalog.length,
      parser: "seu_undergrad_catalog_pdf_v1",
      source: file,
      profile: "seu_undergraduate_program_catalog",
      doc_type: "undergraduate_program_catalog",
      filename: file,
      degree_kind: "ug",
      degree_type: "本科",
      program_category: "undergraduate",
      rejected: false,
      forced_parser: true,
    },
  };
}



function parseSeuUndergradEnglishCatalogPdf(rawText: string, filename?: string | null) {
  const raw = String(rawText || "");
  const file = String(filename || "东南大学本科英文.pdf");

  const compactRaw = raw.replace(/\s+/g, " ");

  const isSeuUgEnglish =
    /School\/College\/Dept\./i.test(raw) &&
    /Specialty/i.test(raw) &&
    /CSCA Test/i.test(raw) &&
    /Duration/i.test(raw) &&
    /years/i.test(raw) &&
    /School of Architecture/i.test(raw) &&
    /School of Economics/i.test(raw) &&
    /Medical School/i.test(raw) &&
    /Architecture/i.test(compactRaw) &&
    /E-Business/i.test(compactRaw) &&
    /Clinical Medicine/i.test(compactRaw);

  if (!isSeuUgEnglish) {
    console.log("[SEU_UG_ENGLISH_CATALOG_DETECT_SKIP]", {
      filename: file,
      hasSchoolDept: /School\/College\/Dept\./i.test(raw),
      hasSpecialty: /Specialty/i.test(raw),
      hasCsca: /CSCA Test/i.test(raw),
      hasDuration: /Duration/i.test(raw),
      hasArchitectureSchool: /School of Architecture/i.test(raw),
      hasEconomicsSchool: /School of Economics/i.test(raw),
      hasTransportationSchool: /School of Transportation/i.test(raw) || /School of\s+Transportation/i.test(raw),
      hasMedicalSchool: /Medical School/i.test(raw),
      rawPreview: raw.slice(0, 500),
    });
    return null;
  }

  const rows: any[] = [
    ["建筑学院", "School of Architecture", "建筑学", "Architecture", "Humanities/Science Chinese + Mathematics", 5],
    ["建筑学院", "School of Architecture", "建筑学（英文授课）", "Architecture (English-taught)", "Mathematics", 5],
    ["建筑学院", "School of Architecture", "城乡规划", "Urban Planning", "Humanities/Science Chinese + Mathematics", 4],
    ["建筑学院", "School of Architecture", "风景园林", "Landscape Architecture", "Humanities/Science Chinese + Mathematics", 4],

    ["机械工程学院", "School of Mechanical Engineering", "机械工程", "Mechanical Engineering", "Science Chinese + Mathematics + Physics", 4],

    ["能源与环境学院", "School of Energy & Environment", "能源与动力工程", "Energy and Power Engineering", "Science Chinese + Mathematics + Physics", 4],
    ["能源与环境学院", "School of Energy & Environment", "核工程与核技术", "Nuclear Engineering and Technology", "Science Chinese + Mathematics + Physics", 4],
    ["能源与环境学院", "School of Energy & Environment", "环境工程", "Environment Engineering", "Science Chinese + Mathematics + Physics", 4],
    ["能源与环境学院", "School of Energy & Environment", "新能源科学与工程", "New Energy Science and Engineering", "Science Chinese + Mathematics + Physics", 4],

    ["信息科学与工程学院", "School of Information Science & Engineering", "信息工程", "Information Engineering", "Science Chinese + Mathematics + Physics", 4],

    ["土木工程学院", "School of Civil Engineering", "土木工程", "Civil Engineering", "Science Chinese + Mathematics + Physics", 4],
    ["土木工程学院", "School of Civil Engineering", "土木工程（英文授课）", "Civil Engineering (English-taught)", "Mathematics + Physics", 4],
    ["土木工程学院", "School of Civil Engineering", "给排水科学与工程", "Water Supply and Sewerage Engineering", "Science Chinese + Mathematics + Physics", 4],
    ["土木工程学院", "School of Civil Engineering", "工程管理", "Project Management", "Science Chinese + Mathematics + Physics", 4],
    ["土木工程学院", "School of Civil Engineering", "智能建造", "Intelligent Building", "Science Chinese + Mathematics + Physics", 4],
    ["土木工程学院", "School of Civil Engineering", "工程力学", "Engineering Mechanics", "Science Chinese + Mathematics + Physics", 4],

    ["电子科学与工程学院", "School of Electronic Science & Engineering", "电子科学与技术", "Electronic Science and Technology", "Science Chinese + Mathematics + Physics", 4],

    ["数学学院", "School of Mathematics", "数学与应用数学", "Mathematics and Applied Mathematics", "Science Chinese + Mathematics", 4],
    ["数学学院", "School of Mathematics", "信息与计算科学", "Information and Computational Science", "Science Chinese + Mathematics", 4],
    ["数学学院", "School of Mathematics", "统计学", "Statistics", "Science Chinese + Mathematics", 4],

    ["自动化学院", "School of Automation", "自动化", "Automation", "Science Chinese + Mathematics + Physics", 4],
    ["自动化学院", "School of Automation", "机器人工程", "Robot Engineering", "Science Chinese + Mathematics + Physics", 4],

    ["计算机科学与工程学院", "School of Computer Science & Engineering", "计算机科学与技术", "Computer Science and Technology", "Science Chinese + Mathematics + Physics", 4],

    ["物理学院", "School of Physics", "物理学", "Physics", "Science Chinese + Mathematics + Physics", 4],
    ["物理学院", "School of Physics", "应用物理学", "Applied Physics", "Science Chinese + Mathematics + Physics", 4],

    ["生物科学与医学工程学院", "School of Biological Science and Medical Engineering", "生物医学工程", "Biomedical Engineering", "Science Chinese + Mathematics + Physics", 4],
    ["生物科学与医学工程学院", "School of Biological Science and Medical Engineering", "生物信息学", "Biological Information", "Science Chinese + Mathematics + Physics", 4],
    ["生物科学与医学工程学院", "School of Biological Science and Medical Engineering", "智能医学工程", "Intelligent Medical Engineering", "Science Chinese + Mathematics + Physics", 4],

    ["材料科学与工程学院", "School of Material Science and Engineering", "材料科学与工程", "Material Science & Engineering", "Science Chinese + Mathematics + Physics", 4],

    ["经济管理学院", "School of Economics & Management", "电子商务", "E-Business", "Humanities/Science Chinese + Mathematics", 4],
    ["经济管理学院", "School of Economics & Management", "电子商务（英文授课）", "E-Business（English-taught）", "Mathematics", 4],
    ["经济管理学院", "School of Economics & Management", "物流管理", "Logistics Management", "Humanities/Science Chinese + Mathematics", 4],
    ["经济管理学院", "School of Economics & Management", "工商管理", "Business Administration", "Humanities/Science Chinese + Mathematics", 4],
    ["经济管理学院", "School of Economics & Management", "会计学", "Accounting", "Humanities/Science Chinese + Mathematics", 4],
    ["经济管理学院", "School of Economics & Management", "国际经济与贸易", "International Economics and Trade", "Humanities/Science Chinese + Mathematics", 4],
    ["经济管理学院", "School of Economics & Management", "金融学", "Finance", "Humanities/Science Chinese + Mathematics", 4],
    ["经济管理学院", "School of Economics & Management", "经济学", "Economics", "Humanities/Science Chinese + Mathematics", 4],

    ["电气工程学院", "School of Electrical Engineering", "电气工程及其自动化", "Electronic Engineering and Automation", "Science Chinese + Mathematics + Physics", 4],

    ["外国语学院", "School of Foreign Languages", "英语", "English", "Humanities Chinese + Mathematics", 4],
    ["外国语学院", "School of Foreign Languages", "日语", "Japanese", "Humanities Chinese + Mathematics", 4],

    ["化学化工学院", "School of Chemistry & Chemical Engineering", "化学", "Chemistry", "Science Chinese + Mathematics + Chemistry", 4],
    ["化学化工学院", "School of Chemistry & Chemical Engineering", "化学工程与工艺", "Chemical Engineering and Technology", "Science Chinese + Mathematics + Chemistry", 4],
    ["化学化工学院", "School of Chemistry & Chemical Engineering", "制药工程", "Pharmaceutical Engineering", "Science Chinese + Mathematics + Chemistry", 4],

    ["交通学院", "School of Transportation", "智慧交通（英文授课）", "Intelligent Transportation（English-taught）", "Mathematics + Physics", 4],
    ["交通学院", "School of Transportation", "交通工程", "Traffic Engineering", "Science Chinese + Mathematics + Physics", 4],
    ["交通学院", "School of Transportation", "交通运输", "Transportation", "Science Chinese + Mathematics + Physics", 4],
    ["交通学院", "School of Transportation", "城市地下空间工程", "Urban underground space Engineering", "Science Chinese + Mathematics + Physics", 4],
    ["交通学院", "School of Transportation", "道路桥梁与渡河工程", "Engineering of Roads, Bridges/Ferries", "Science Chinese + Mathematics + Physics", 4],
    ["交通学院", "School of Transportation", "智慧交通", "Intelligent Transportation", "Science Chinese + Mathematics + Physics", 4],

    ["仪器科学与工程学院", "School of Instrument Science & Engineering", "智能感知工程", "Intelligent perception Engineering", "Science Chinese + Mathematics + Physics", 4],
    ["仪器科学与工程学院", "School of Instrument Science & Engineering", "测控技术与仪器", "Measuring/Control Technology and Instrumentation", "Science Chinese + Mathematics + Physics", 4],

    ["法学院", "Law School", "法学", "Law", "Humanities Chinese + Mathematics", 4],

    ["公共卫生学院", "School of Public Health", "预防医学", "Preventive Medicine", "Science Chinese + Mathematics + Chemistry", 5],
    ["公共卫生学院", "School of Public Health", "劳动与社会保障", "Labor and Social Security", "Science Chinese + Mathematics + Chemistry", 4],

    ["医学院", "Medical School", "临床医学(英文授课)", "Clinical Medicine (English-taught)", "Mathematics + Chemistry", 6],
    ["医学院", "Medical School", "临床医学", "Clinical Medicine", "Science Chinese + Mathematics + Chemistry", 5],
    ["医学院", "Medical School", "医学影像学", "Medical Imaging", "Science Chinese + Mathematics + Chemistry", 5],

    ["人文学院", "School of Humanities", "政治学与行政学", "Politics and Administration", "Humanities Chinese + Mathematics", 4],
    ["人文学院", "School of Humanities", "社会学", "Sociology", "Humanities Chinese + Mathematics", 4],
    ["人文学院", "School of Humanities", "汉语言文学", "Chinese Literature", "Humanities Chinese + Mathematics", 4],
    ["人文学院", "School of Humanities", "旅游管理", "Tourism Management", "Humanities Chinese + Mathematics", 4],
    ["人文学院", "School of Humanities", "哲学", "Philosophy", "Humanities Chinese + Mathematics", 4],

    ["艺术学院", "School of Arts", "动画", "Animation", "Humanities Chinese + Mathematics", 4],
    ["艺术学院", "School of Arts", "美术学", "Fine Arts", "Humanities Chinese + Mathematics", 4],
    ["艺术学院", "School of Arts", "产品设计", "Product Design", "Humanities Chinese + Mathematics", 4],
    ["艺术学院", "School of Arts", "艺术史论", "Theory of Art History", "Humanities Chinese + Mathematics", 4],

    ["生命科学与技术学院", "School of Life science and Technology", "生物科学", "Bioscience", "Science Chinese + Mathematics + Physics", 4],
    ["软件学院", "School of Software Engineering", "软件工程", "Software Engineering", "Science Chinese + Mathematics + Physics", 4],
    ["人工智能学院", "School of Artificial Intelligence", "人工智能", "Artificial Intelligence", "Science Chinese + Mathematics + Physics", 4],
    ["网络空间安全学院", "School of Cyber Science and Engineering", "网络空间安全", "Cyberspace Security", "Science Chinese + Mathematics + Physics", 4],
  ];

  const program_catalog = rows.map(([faculty_cn, faculty_en, program_name_cn, program_name_en, csca_subjects_en, duration_years], i) => {
    const isEnglish = String(program_name_en).includes("English-taught") || String(program_name_cn).includes("英文授课");

    return {
      idx: i + 1,
      kind: "ug",
      degree_kind: "ug",
      degree_type: "本科",
      program_category: "undergraduate",
      faculty_cn,
      faculty_en,
      college_cn: faculty_cn,
      program_name_cn,
      major_name_cn: program_name_cn,
      program_name_en,
      major_name_en: program_name_en,
      csca_subjects_en,
      duration_years,
      duration_text: `${duration_years}年`,
      study_language: isEnglish ? "en" : "zh",
      language_text: isEnglish ? "英文" : "中文",
      source_files: [file],
      tags: ["本科", isEnglish ? "英文授课" : "中文授课", "东南大学", String(faculty_cn), String(faculty_en)].filter(Boolean),
    };
  });

  return {
    raw,
    checklist: {
      has_program_catalog: true,
      has_faculty: true,
      has_duration: true,
      has_csca_subjects: true,
      has_english_names: true,
    },
    program_catalog,
    program_catalog_meta: {
      rows: program_catalog.length,
      parser: "seu_undergrad_english_catalog_pdf_v1",
      source: file,
      filename: file,
      degree_kind: "ug",
      degree_type: "本科",
      program_category: "undergraduate",
      profile: "seu_undergrad_english_catalog",
      rejected: false,
      forced_parser: true,
    },
  };
}


type FileKind = "ug" | "master" | "phd" | "apply_guide" | "other";
type LinkPurpose = "catalog" | "tuition" | "scholarship" | "apply_guide";
// ================================
// ✅ Program Catalog Overrides (LOCKS)
// ================================
type ProgramOverrideRow = {
  program_key: string;
  patch?: Record<string, any> | null;
  locks?: Record<string, boolean> | null;
  updated_at?: string | null;
};

function pickProgramKey(row: any) {
  const dept = String(row?.dept_code ?? row?.zsyxsdm ?? "").trim();
  const major = String(row?.major_code ?? row?.zszydm ?? "").trim();
  const track = String(row?.track_code ?? row?.yjfxdm ?? "").trim();

  if (dept && major && track) return `${dept}:${major}:${track}`;
  if (dept && major) return `${dept}:${major}`;
  if (major && track) return `${major}:${track}`;

  const mc = String(row?.major_code ?? "").trim();
  if (mc) return mc;

  const cn = String(row?.program_name_cn ?? "").trim();
  if (cn) return cn;

  const en = String(row?.program_name_en ?? "").trim();
  return en || "";
}


// ================================
// 通用：从费用说明/招生简章文本中按“学科门类/类别”回填学费
// 不区分本科/硕士/博士；只依赖 row 的 discipline/category 字段
// ================================

function isLikelyTuitionPolicyOnlyPage(input: {
  rawText?: string | null;
  sourceUrl?: string | null;
  linkPurpose?: string | null;
}) {
  const raw = String(input?.rawText || "");
  const url = String(input?.sourceUrl || "").toLowerCase();
  const purpose = String(input?.linkPurpose || "").toLowerCase();

  const hasFeeTable =
    /招生专业收费表|学费[:：]?详见表|报名费与学费|学位类别[\s\S]{0,120}文科类[\s\S]{0,120}医学类/.test(raw);

  const hasTuitionWords =
    /学费|收费|费用|元\/人\/学年|元\/学年|RMB\/Year|RMB\s*\/\s*Year/.test(raw);

  const looksGuide =
    /招生简章|申请时间|申请材料|奖学金项目|入学与报到|报名费/.test(raw);

  if (purpose === "tuition" && hasTuitionWords) return true;
  if (url.includes("iso.sysu.edu.cn") && url.includes("/zfxm/") && hasTuitionWords) return true;
  if (hasFeeTable && looksGuide) return true;

  return false;
}


function applySysuFeeTableTuitionByDiscipline(rows: any[]) {
  if (!Array.isArray(rows) || rows.length === 0) return rows || [];

  const allText = rows
    .map((r: any) =>
      [
        r?.tuition_note,
        r?.tuition_text,
        r?.raw_block,
        r?.raw_line,
      ]
        .filter(Boolean)
        .join("； ")
    )
    .join("； ");

  const isSysuFeeTable =
    /中山大学/.test(allText) &&
    /招生专业收费表/.test(allText) &&
    /文科类/.test(allText) &&
    /理科、?工科和农科类/.test(allText) &&
    /医学类/.test(allText);

  if (!isSysuFeeTable) return rows;

  const isMaster = /硕士/.test(allText);
  const isPhd = /博士/.test(allText);
  const isUg = /本科|学士/.test(allText);

  let liberal: number | null = null;
  let stem: number | null = null;
  let medical: number | null = null;

  if (isMaster) {
    liberal = 30000;
    stem = 39000;
    medical = 55000;
  } else if (isPhd) {
    liberal = 34000;
    stem = 44200;
    medical = 65000;
  } else if (isUg) {
    liberal = 26000;
    stem = 33800;
    medical = 48000;
  }

  if (!liberal || !stem || !medical) return rows;

  const bucketByMajorCode = (code: any) => {
    const c = String(code || "").trim();
    if (!c) return null;

    const two = c.slice(0, 2);
    const four = c.slice(0, 4);

    if (two === "10" || two === "11" || four === "1051" || four === "1052") return "medical";
    if (["01", "02", "03", "04", "05", "06", "12", "13"].includes(two)) return "liberal";
    if (["07", "08", "09"].includes(two)) return "stem";
    if (two === "14") return "stem";
    return null;
  };

  const bucketByDiscipline = (discipline: any) => {
    const d = String(discipline || "").trim();
    if (!d) return null;

    if (/医学|口腔医学|临床医学|护理|药学|公共卫生|中医学/.test(d)) return "medical";
    if (/理学|工学|农学|交叉学科/.test(d)) return "stem";
    if (/文学|经济学|法学|哲学|教育学|历史学|管理学|艺术学/.test(d)) return "liberal";

    return null;
  };

  return rows.map((r: any) => {
    const next: any = { ...(r || {}) };

    if (next.tuition_rmb_per_year != null && Number(next.tuition_rmb_per_year) > 0) {
      return next;
    }

    const bucket =
      bucketByDiscipline(
        next.discipline_category_text ||
        next.discipline_category ||
        next.subject_category ||
        next.discipline_text
      ) ||
      bucketByMajorCode(next.major_code);

    let fee: number | null = null;
    if (bucket === "liberal") fee = liberal;
    if (bucket === "stem") fee = stem;
    if (bucket === "medical") fee = medical;

    if (!fee) return next;

    next.tuition_rmb_per_year = fee;
    next.tuition_total_rmb = null;
    next.tuition_is_per_year = true;
    next.tuition_note = `${fee.toLocaleString("en-US")} RMB/Year`;
    next.tuition_source_url = next.tuition_source_url || "https://iso.sysu.edu.cn/cn/zfxm/1420565.htm";

    return next;
  });
}

function applyTuitionFromNoteByDiscipline(
  rows: any[],
  meta: any,
  rawText?: string,
): any[] {
  if (!Array.isArray(rows) || rows.length === 0) return rows || [];

  const rowLevelTuitionNotes = (rows || [])
    .slice(0, 800)
    .map((r: any) =>
      r?.tuition_note ||
      r?.tuition_policy_text ||
      r?.tuition_text ||
      r?.fee_text ||
      "",
    )
    .filter(Boolean)
    .join("\n");

  const text = String(
    [
      meta?.tuition_note,
      meta?.tuition_policy_text,
      meta?.tuition_text,
      meta?.fee_text,
      meta?.notes,
      meta?.remarks,
      rowLevelTuitionNotes,
      rawText,
    ]
      .filter(Boolean)
      .join("\n"),
  )
    .replace(/\u00a0/g, " ")
    .replace(/[，,]/g, "")
    .replace(/\s+/g, " ");

  if (!text.trim()) return rows;

  const hasFeeWords =
    /学费|收费|费用|元\/人\/学年|元\/学年|RMB\/Year|RMB\s*\/\s*Year|per\s*year/i.test(
      text,
    );

  if (!hasFeeWords) return rows;

  const amountHit = (amount: number) => {
    const a = String(amount);
    const c = amount.toLocaleString("en-US");
    return text.includes(a) || text.includes(c);
  };

  const hasArts =
    /文科类|人文社科|文史哲|文学|法学|管理学|哲学|历史学|教育学|经济学/.test(text);
  const hasStem =
    /理科|工科|农科|理工|理工农|理科工科农科|理科、工科和农科/.test(text);
  const hasMedical = /医学类|医学/.test(text);

  const feeByBucket: Record<string, number> = {};

  if (hasArts && amountHit(34000)) feeByBucket.arts = 34000;
  if (hasStem && amountHit(44200)) feeByBucket.stem = 44200;
  if (hasMedical && amountHit(65000)) feeByBucket.medical = 65000;

  if (hasArts && amountHit(26000)) feeByBucket.arts = feeByBucket.arts || 26000;
  if (hasStem && amountHit(33800)) feeByBucket.stem = feeByBucket.stem || 33800;
  if (hasMedical && amountHit(48000)) feeByBucket.medical = feeByBucket.medical || 48000;

  if (
    feeByBucket.arts == null &&
    feeByBucket.stem == null &&
    feeByBucket.medical == null
  ) {
    return rows;
  }

  const sourceUrl =
    String(meta?.tuition_source_url || meta?.source_url || "").trim() || null;

  function disciplineText(row: any) {
    return String(
      row?.discipline_category_text ||
        row?.discipline_category ||
        row?.subject_category ||
        row?.subject_category_text ||
        row?.category_text ||
        row?.category ||
        row?.discipline ||
        row?.field_category ||
        "",
    ).trim();
  }

  function bucketForDiscipline(d: string) {
    if (!d) return null;

    if (/医学|临床医学|口腔医学|公共卫生|护理|药学|中医学/.test(d)) {
      return "medical";
    }

    if (
      /理学|工学|农学|交叉学科|理科|工科|农科|工程|材料|计算机|电子|机械|土木|化学|物理|数学|生物|地理|海洋|大气|环境|能源|航空|智能|软件|网络空间/.test(
        d,
      )
    ) {
      return "stem";
    }

    if (
      /文学|法学|管理学|哲学|历史学|教育学|艺术学|经济学|社会学|新闻|外语|语言|政治|公共管理/.test(
        d,
      )
    ) {
      return "arts";
    }

    return null;
  }

  return rows.map((row) => {
    const out: any = { ...(row || {}) };

    if (out.tuition_rmb_per_year != null) return out;

    const bucket = bucketForDiscipline(disciplineText(out));
    const fee = bucket ? feeByBucket[bucket] : null;

    if (fee == null) return out;

    out.tuition_rmb_per_year = fee;
    out.tuition_total_rmb = null;
    out.tuition_is_per_year = true;
    out.tuition_note =
      out.tuition_note && String(out.tuition_note).trim()
        ? String(out.tuition_note)
        : `${fee.toLocaleString("en-US")} RMB/Year；根据费用说明按学科门类匹配`;
    out.tuition_source_url = out.tuition_source_url || sourceUrl;

    return out;
  });
}

function buildRowTags(row: any): string[] {
  const tags: string[] = [];

  const deg = String(
    row?.degree_type || row?.degreetype_text || row?.degree || "",
  ).trim();
  if (deg) tags.push(deg);

  const lang = String(
    row?.language_text || row?.language || row?.study_language || "",
  ).trim();
  if (lang) tags.push(lang);

  const mode = String(
    row?.study_mode_cn || row?.learningstyle_text || "",
  ).trim();
  if (mode) tags.push(mode);

  const hasTuition =
    row?.tuition_rmb_per_year != null ||
    row?.tuition_total_rmb != null ||
    (typeof row?.tuition_note === "string" && row.tuition_note.trim());
  if (hasTuition) tags.push("收费已填");

  const feeUrl = String(row?.tuition_source_url || "").trim();
  if (feeUrl) tags.push("有收费来源");

  if (row?.is_english_taught === true) tags.push("全英文授课");

  return Array.from(new Set(tags));
}



function cleanApplyRequirementsTextForRow(input: any) {
  let text = String(input || "")
    .replace(/\u00a0/g, " ")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!text) return null;

  // 只保留“申请条件/入学要求/申请资格”到下一个 section 之前
  const titleHit = text.search(/(^|\n)\s*(申请条件|入学要求|申请资格|申请要求|招生对象)\s*[:：]?\s*(\n|$)/i);
  if (titleHit >= 0) {
    text = text.slice(titleHit).trim();
  }

  const stopRe = /(^|\n)\s*(申请时间|报名时间|申请步骤|申请流程|申请材料|录取和报到|录取|报到|入学时间|学习期限|学杂费用|学费|申请费|保险费|联络方式|联系方式|在线报名|注意|南京大学|留学保险网|国家留学基金委|中国留学网|国际合作与交流处|研究生院|南京大学新闻网|南大小百合|海外教育学院公众号|Copyright)\s*[:：]?\s*(\n|$)/i;
  const m = text.match(stopRe);
  if (m && m.index != null && m.index > 0) {
    text = text.slice(0, m.index).trim();
  }

  text = text
    .replace(/(^|\n)\s*申请时间[\s\S]*$/i, "")
    .replace(/(^|\n)\s*报名时间[\s\S]*$/i, "")
    .replace(/(^|\n)\s*申请步骤[\s\S]*$/i, "")
    .replace(/(^|\n)\s*申请流程[\s\S]*$/i, "")
    .replace(/(^|\n)\s*申请材料[\s\S]*$/i, "")
    .replace(/(^|\n)\s*录取和报到[\s\S]*$/i, "")
    .replace(/(^|\n)\s*入学时间[\s\S]*$/i, "")
    .replace(/(^|\n)\s*学习期限[\s\S]*$/i, "")
    .replace(/(^|\n)\s*学杂费用[\s\S]*$/i, "")
    .replace(/(^|\n)\s*联络方式[\s\S]*$/i, "")
    .replace(/(^|\n)\s*联系方式[\s\S]*$/i, "")
    .replace(/(^|\n)\s*在线报名[\s\S]*$/i, "")
    .replace(/(^|\n)\s*Copyright[\s\S]*$/i, "")
    .trim();

  return text || null;
}

function normalizeCatalogRowForDisplay(
  row: any,
  kind: FileKind,
  applyGuidePolicy?: any,
) {
  const contactText = [
    row?.contact_raw,
    row?.contact_phone,
    row?.contact_email,
    row?.remarks_text,
    row?.raw_line,
    row?.raw_block,
  ]
    .filter(Boolean)
    .join(" ");

  const contacts = parseContactsFromText(contactText);

  const contact_phone =
    row?.contact_phone ||
    contacts.phones?.[0] ||
    null;

  const contact_email =
    row?.contact_email ||
    contacts.emails?.[0] ||
    null;

  const degree_type =
    row?.degree_type ||
    (kind === "ug"
      ? "本科"
      : kind === "master"
        ? "硕士"
        : kind === "phd"
          ? "博士"
          : null);

  const rawApplyRequirementsText =
    row?.apply_requirements_text ||
    applyGuidePolicy?.admission_requirements_text ||
    applyGuidePolicy?.admission_requirements ||
    applyGuidePolicy?.requirements_text ||
    null;

  const apply_requirements_text = cleanApplyRequirementsTextForRow(
    Array.isArray(rawApplyRequirementsText)
      ? rawApplyRequirementsText.join("\n")
      : String(rawApplyRequirementsText || "").trim() || null,
  );

  const next: any = {
    ...(row || {}),

    kind,

    faculty_cn: row?.faculty_cn ?? null,
    faculty_en: row?.faculty_en ?? null,

    major_code: row?.major_code ?? null,
    program_name_cn: row?.program_name_cn ?? null,
    program_name_en: row?.program_name_en ?? null,

    track_name_cn: row?.track_name_cn ?? null,
    track_name_en: row?.track_name_en ?? null,

    language_text: row?.language_text ?? null,
    study_language: row?.study_language ?? null,

    degree_type,
    degree_kind: row?.degree_kind ?? null,
    study_mode_cn: row?.study_mode_cn ?? null,

    duration_years: row?.duration_years ?? null,
    apply_requirements_text,

    tuition_rmb_per_year: row?.tuition_rmb_per_year ?? null,
    tuition_total_rmb: row?.tuition_total_rmb ?? null,
    tuition_is_per_year: row?.tuition_is_per_year ?? null,
    tuition_note: row?.tuition_note ?? null,
    tuition_source_url: row?.tuition_source_url ?? null,

    remarks_text: row?.remarks_text ?? row?.remarks ?? null,

    contact_phone,
    contact_email,
    contact_raw: row?.contact_raw ?? null,

    tags: Array.isArray(row?.tags) ? row.tags : buildRowTags(row),
  };

  next.tags = buildRowTags(next);

  return next;
}


function inferFudanGradTuitionRuleKey(rule: any) {
  const text = [
    rule?.key,
    rule?.tuition_rule_key,
    rule?.degree_kind,
    rule?.degreeKind,
    rule?.degree_type,
    rule?.discipline_group,
    rule?.group,
    rule?.name,
    rule?.title,
    rule?.note,
    rule?.raw,
    rule?.raw_line,
    rule?.raw_text,
  ]
    .filter(Boolean)
    .join(" ");

  const isProfessional =
    text.includes("专业学位") ||
    text.toLowerCase().includes("professional");

  if (isProfessional) return "professional_consult_school";

  const isAcademic =
    text.includes("学术学位") ||
    text.toLowerCase().includes("academic");

  const isMedical =
    text.includes("医科") ||
    text.includes("医学") ||
    text.includes("药学") ||
    text.includes("护理") ||
    text.includes("公共卫生") ||
    text.includes("预防医学") ||
    text.includes("临床");

  const isSciEng =
    text.includes("理工科") ||
    text.includes("理科") ||
    text.includes("工科") ||
    text.toLowerCase().includes("science") ||
    text.toLowerCase().includes("engineering");

  if (isAcademic && isMedical) return "academic_medical";
  if (isAcademic && isSciEng) return "academic_science_engineering";
  if (isMedical) return "academic_medical";
  if (isSciEng) return "academic_science_engineering";

  return "";
}

function pickFudanGradTuitionAmount(rule: any) {
  const vals = [
    rule?.tuition_rmb_per_year,
    rule?.tuition_per_year,
    rule?.amount,
    rule?.rmb,
    rule?.fee,
  ];

  for (const v of vals) {
    const n = Number(String(v ?? "").replace(/,/g, ""));
    if (Number.isFinite(n) && n >= 10000 && n <= 300000) return n;
  }

  const text = [
    rule?.note,
    rule?.raw,
    rule?.raw_line,
    rule?.raw_text,
    rule?.title,
  ]
    .filter(Boolean)
    .join(" ");

  const nums = Array.from(text.matchAll(/([1-9]\d{4,5}(?:,\d{3})?)/g))
    .map((m) => Number(String(m[1]).replace(/,/g, "")))
    .filter((n) => Number.isFinite(n) && n >= 10000 && n <= 300000);

  return nums[0] ?? null;
}

function applyLockedOverridesToCatalog(
  program_catalog: any[],
  overrides: ProgramOverrideRow[],
) {
  const ovMap = new Map<string, ProgramOverrideRow>();
  for (const o of overrides || []) {
    const k = String(o?.program_key || "").trim();
    if (!k) continue;
    ovMap.set(k, o);
  }

  return (program_catalog || []).map((row) => {
    const key = pickProgramKey(row);
    const ov = key ? ovMap.get(key) : null;
    if (!ov) return row;

    const patch = ov.patch && typeof ov.patch === "object" ? ov.patch : {};
    const locks = ov.locks && typeof ov.locks === "object" ? ov.locks : {};

    const out = { ...(row || {}) };
    for (const k of Object.keys(locks)) {
      if (locks[k] === true && patch[k] !== undefined) out[k] = patch[k];
    }

    (out as any).__override = {
      program_key: String(ov.program_key || "").trim(),
      locks,
      updated_at: ov.updated_at ?? null,
    };

    return out;
  });
}

// ================================
// ✅ Merge helpers（同 kind 多次补全）
// ================================
function normalizeProgramKeyForMerge(row: any) {
  const pk = String(pickProgramKey(row) || "").trim();
  const faculty = String(row?.faculty_cn ?? "").trim();
  if (faculty && pk) return `${faculty}::${pk}`;
  return pk;
}

function mergeProgramCatalog(oldList: any[], newList: any[]) {
  const m = new Map<string, any>();

  for (const r of oldList || []) {
    const k = normalizeProgramKeyForMerge(r);
    if (!k) continue;
    m.set(k, r);
  }

  for (const r of newList || []) {
    const k = normalizeProgramKeyForMerge(r);
    if (!k) continue;
    const prev = m.get(k);
    m.set(k, { ...(prev || {}), ...(r || {}) });
  }

  const merged = Array.from(m.values());
  merged.forEach((r, i) => (r.idx = i + 1));
  return merged;
}

// ================================
// basic helpers
// ================================
const execFileAsync = promisify(execFile);
const PDF_MAX_PAGES = Math.max(
  1,
  Math.min(Number(process.env.PDF_MAX_PAGES || 30), 200),
);
const PDFTOTEXT_TIMEOUT_MS = Math.max(
  10_000,
  Math.min(Number(process.env.PDFTOTEXT_TIMEOUT_MS || 120_000), 300_000),
);

function supabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

function isPdf(filename: string, mime: string) {
  const fn = (filename || "").toLowerCase();
  return mime === "application/pdf" || fn.endsWith(".pdf");
}

function isExcel(filename: string, mime: string) {
  const fn = (filename || "").toLowerCase();
  return (
    fn.endsWith(".xlsx") ||
    fn.endsWith(".xls") ||
    mime.includes("spreadsheet") ||
    mime.includes("excel")
  );
}

function isCsv(filename: string, mime: string) {
  const fn = (filename || "").toLowerCase();
  return fn.endsWith(".csv") || mime === "text/csv" || mime.includes("csv");
}

function normCell(v: any) {
  return String(v ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function normKey(v: any) {
  return normCell(v)
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[（）()]/g, "");
}

function normalizeSpace(s: any) {
  return String(s ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/[（）]/g, (m) => (m === "（" ? "(" : ")"))
    .replace(/\s+/g, " ")
    .trim();
}

function parseDurationYearsLoose(text: any): number | null {
  const s = String(text || "");

  const patterns = [
    /(\d+(?:\.\d+)?)\s*(?:years?|year)\b/i,
    /(\d+(?:\.\d+)?)\s*年/,
    /duration[^0-9]{0,20}(\d+(?:\.\d+)?)/i,
    /学制[^0-9]{0,20}(\d+(?:\.\d+)?)/,
  ];

  for (const re of patterns) {
    const m = s.match(re);
    if (!m) continue;
    const n = Number(m[1]);
    if (Number.isFinite(n) && n >= 1 && n <= 10) return n;
  }

  return null;
}

function pickColIndexSafe(headerRow: any[], keywords: string[]) {
  const cells = (headerRow || []).map((c) => normKey(c));
  const ks = keywords.map((k) => normKey(k));
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i] || "";
    if (ks.some((k) => k && cell.includes(k))) return i;
  }
  return -1;
}

function makeHeaderSignature(table_header: string[]) {
  return (table_header || [])
    .map((x) => normKey(x))
    .filter(Boolean)
    .join("|");
}

async function loadHeaderMapping(
  supabase: any,
  school_id: string,
  kind: string,
  header_signature: string,
) {
  if (!header_signature) return null;

  const kindTry = [kind, "master", "ug", "phd", "other"].filter(Boolean);
  const seen = new Set<string>();
  const kinds = kindTry.filter((k) =>
    seen.has(k) ? false : (seen.add(k), true),
  );

  for (const k of kinds) {
    const { data, error } = await supabase
      .from("school_header_mappings")
      .select("mapping_json")
      .eq("school_id", school_id)
      .eq("kind", k)
      .eq("header_signature", header_signature)
      .maybeSingle();

    if (error) continue;
    if (data?.mapping_json && typeof (data as any).mapping_json === "object") {
      return (data as any).mapping_json as Record<string, string>;
    }
  }

  return null;
}

function idxFromMapping(
  mapping: Record<string, string> | null,
  wantKey: string,
): number {
  if (!mapping) return -1;
  for (const [k, v] of Object.entries(mapping)) {
    if (String(v) === wantKey) {
      const n = Number(k);
      return Number.isFinite(n) ? n : -1;
    }
  }
  return -1;
}

function splitCnEn(cell: string) {
  const s = String(cell || "").replace(/\r/g, "\n");
  const parts = s
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);

  if (parts.length === 0) return { cn: "", en: "" };

  const cn = parts.find((x) => /[\u4e00-\u9fff]/.test(x)) || parts[0] || "";
  const en = parts.find((x) => /[A-Za-z]/.test(x)) || "";

  return { cn, en };
}

function parseContactsFromText(s: string) {
  const text = String(s || "");
  const emails = Array.from(
    new Set(text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []),
  );
  const phones = Array.from(
    new Set(
      (text.match(/(\+?\d[\d\- ]{7,}\d)/g) || [])
        .map((x) => x.replace(/\s+/g, " ").trim())
        .filter((x) => x.replace(/[^\d]/g, "").length >= 8),
    ),
  );
  return { emails, phones };
}


function extractApplyRequirementsOnly(raw: any) {
  const text = String(raw || "")
    .replace(/\r/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!text) return null;

  const startRe = /(?:^|\n)\s*(申请条件|申请资格|入学要求)\s*\n/;
  const m = text.match(startRe);
  if (!m || m.index == null) return null;

  const start = m.index + m[0].replace(/^\n/, "").length;
  const rest = text.slice(start).trim();

  const endRe = /\n\s*(申请时间|申请步骤|申请流程|申请材料|录取和报到|入学时间|学习期限|学杂费用|学费|奖学金|联络方式|联系方式|在线报名|注意[:：])\s*\n/;
  const end = rest.search(endRe);
  const body = (end >= 0 ? rest.slice(0, end) : rest).trim();

  if (!body) return null;
  return `${m[1]}\n${body}`;
}


function htmlToText(html: string) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<\/td>/gi, "\t")
    .replace(/<\/th>/gi, "\t")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}


async function pdfToTextByPdftotext(buf: Buffer): Promise<string> {
  const tmpPdf = path.join(
    tmpdir(),
    `educonnect_${Date.now()}_${Math.random().toString(16).slice(2)}.pdf`,
  );

  try {
    await writeFile(tmpPdf, buf);

    const { stdout, stderr } = await execFileAsync(
      "pdftotext",
      [
        "-layout",
        "-enc",
        "UTF-8",
        "-f",
        "1",
        "-l",
        String(PDF_MAX_PAGES),
        tmpPdf,
        "-",
      ],
      { timeout: PDFTOTEXT_TIMEOUT_MS },
    );

    const text = String(stdout || "").trim();
    if (!text) {
      throw new Error(
        `PDF_TEXT_EMPTY: 这个PDF可以识别为PDF，但无法抽取文字，可能是扫描版/图片型PDF/特殊字体编码。请改用网页URL、可复制文字版PDF，或先OCR后再上传。stderr=${String(stderr || "").slice(0, 400)}`,
      );
    }
    return text;
  } finally {
    await unlink(tmpPdf).catch(() => {});
  }
}

function normalizeUrl(u: string) {
  let s = String(u || "").trim();
  if (!s) return "";

  s = s.replace(/[)\]）】>,，。;；\s]+$/g, "");
  s = s.replace(/\.$/, "");

  return /^https?:\/\//i.test(s) ? s : `https://${s}`;
}

function guessFilenameFromUrl(u: string) {
  try {
    const url = new URL(u);
    const p = url.pathname.split("/").filter(Boolean).pop() || "download";
    return p.includes(".") ? p : `${p}.bin`;
  } catch {
    return "download.bin";
  }
}

function isLikelyPdfUrl(u: string) {
  const s = String(u || "").toLowerCase();
  return s.includes(".pdf");
}

async function downloadByCurl(
  url: string,
): Promise<{ buf: Buffer; finalUrl: string; contentType: string }> {
  const u = normalizeUrl(url);
  if (!u) throw new Error("empty url");

  const tmpFile = path.join(
    tmpdir(),
    `educonnect_dl_${Date.now()}_${Math.random().toString(16).slice(2)}.bin`,
  );

  try {
    const { stdout } = await execFileAsync(
      "curl",
      [
        "-L",
        "-sS",
        "--compressed",
        "-m",
        "40",
        "-A",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
        "-e",
        "https://iczu.zju.edu.cn/",
        "-H",
        "Accept: application/pdf,text/html;q=0.9,*/*;q=0.8",
        "-H",
        "Accept-Language: zh-CN,zh;q=0.9,en;q=0.8",
        "-o",
        tmpFile,
        "-w",
        "%{url_effective}\n%{content_type}\n%{http_code}\n",
        u,
      ],
      { timeout: 60_000 },
    );

    const out = String(stdout || "").split("\n");
    const finalUrl = (out[0] || u).trim();
    const contentType = (out[1] || "").trim().toLowerCase();
    const httpCode = Number((out[2] || "").trim() || "0");

    if (httpCode >= 400) {
      throw new Error(
        `curl failed http=${httpCode} contentType=${contentType} finalUrl=${finalUrl}`,
      );
    }

    const buf = await readFile(tmpFile);
    if (!buf || buf.length === 0) {
      throw new Error("curl downloaded empty file");
    }

    return { buf, finalUrl, contentType };
  } finally {
    await unlink(tmpFile).catch(() => {});
  }
}

// ================================
// ✅ Excel 解析（支持 mapping）
// ================================
function parseExcelProgramCatalog(
  buf: Buffer,
  mapping: Record<string, string> | null,
) {
  const wb = XLSX.read(buf, { type: "buffer" });
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  if (!ws) throw new Error("empty excel sheet");

  const aoa = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    raw: false,
    blankrows: false,
  }) as any[][];

  const rows2d = (aoa || []).map((r) => (r || []).map((c) => normCell(c)));

  function parseTuitionAny(s: string) {
    const t = String(s || "").replace(/,/g, "");
    const m = t.match(/(\d{3,9})/);
    return m ? Number(m[1]) : null;
  }

  function parseDurationAny(s: string) {
    const t = String(s || "");
    const m = t.match(/(\d+(\.\d+)?)/);
    return m ? Number(m[1]) : null;
  }

  function headerScore(row: string[]) {
    const cellsAll = (row || []).map(normCell);
    const cells = cellsAll.filter((x) => x && x !== "-" && x !== "—");
    if (cells.length < 3) return -999;

    const joined = cells.join(" ");
    const lower = joined.toLowerCase();
    const bonusWords = [
      "学院",
      "院系",
      "培养单位",
      "学科",
      "专业",
      "学费",
      "费用",
      "收费标准",
      "学制",
      "program",
      "major",
      "tuition",
      "duration",
    ];

    let bonus = 0;
    for (const w of bonusWords) {
      if (lower.includes(String(w).toLowerCase())) bonus += 2;
    }

    const hasText = cells.filter((c) => /[A-Za-z\u4e00-\u9fff]/.test(c)).length;
    const hasNumber = cells.filter((c) => /\d/.test(c)).length;

    const uniq = new Set(cells.map((x) => normKey(x))).size;
    const dupPenalty = Math.max(0, cells.length - uniq) * 1.5;

    return (
      cells.length * 2 +
      (hasText ? 10 : 0) -
      (hasNumber ? 1 : 0) +
      bonus -
      dupPenalty
    );
  }

  const scanN = Math.min(80, rows2d.length);
  let bestIdx = -1;
  let bestScore = -999;

  for (let i = 0; i < scanN; i++) {
    const s = headerScore(rows2d[i] || []);
    if (s > bestScore) {
      bestScore = s;
      bestIdx = i;
    }
  }

  const wholeSheetText = rows2d.map((r) => (r || []).join(" ")).join("\n");
  const sheetContacts = parseContactsFromText(wholeSheetText);

  if (bestIdx < 0 || bestScore < 6) {
    return {
      table_header: [],
      program_catalog: [],
      raw_text: wholeSheetText,
      meta: {
        kind: "excel",
        note: "header_not_detected",
        contacts: sheetContacts,
        sheetName,
        header_signature: "",
      },
    };
  }

  const headerRow = rows2d[bestIdx] || [];
  const table_header = headerRow.map((x) => normCell(x)).filter(Boolean);
  const header_signature = makeHeaderSignature(table_header);

  const colDept =
    idxFromMapping(mapping, "faculty_cn") >= 0
      ? idxFromMapping(mapping, "faculty_cn")
      : pickColIndexSafe(headerRow, [
          "院系",
          "学院",
          "系",
          "培养单位",
          "招生单位",
          "所在学院",
          "department",
          "school",
          "faculty",
        ]);

  const colProgramCn =
    idxFromMapping(mapping, "program_name_cn") >= 0
      ? idxFromMapping(mapping, "program_name_cn")
      : pickColIndexSafe(headerRow, [
          "专业名称",
          "学科/专业名称",
          "学科",
          "专业",
          "一级学科",
          "二级学科",
          "方向",
          "program",
          "major",
        ]);

  const colDuration =
    idxFromMapping(mapping, "duration_years") >= 0
      ? idxFromMapping(mapping, "duration_years")
      : pickColIndexSafe(headerRow, [
          "学制(年)",
          "学制",
          "修业年限",
          "学习年限",
          "duration",
          "year",
          "years",
        ]);

  const colTuition =
    idxFromMapping(mapping, "tuition_rmb_per_year") >= 0
      ? idxFromMapping(mapping, "tuition_rmb_per_year")
      : pickColIndexSafe(headerRow, [
          "学费",
          "收费",
          "费用",
          "收费标准",
          "tuition",
          "fee",
          "rmb",
          "元",
          "元/年",
          "每学年",
        ]);

  const colOther =
    idxFromMapping(mapping, "remarks") >= 0
      ? idxFromMapping(mapping, "remarks")
      : pickColIndexSafe(headerRow, [
          "其他要求和注意事项",
          "其他要求",
          "注意事项",
          "备注",
          "说明",
          "要求",
          "other",
          "remark",
          "notes",
        ]);

  const dataRows = rows2d.slice(bestIdx + 1);

  let lastDeptCN = "";
  let lastDeptEN = "";
  let lastProgramCN = "";
  let lastTuition = "";
  let lastDuration = "";
  let lastOther = "";

  const program_catalog: any[] = [];
  let idx = 0;

  for (const r of dataRows) {
    const deptCell = colDept >= 0 ? normCell(r[colDept]) : "";
    const programCnCell = colProgramCn >= 0 ? normCell(r[colProgramCn]) : "";
    const tuitionRaw = colTuition >= 0 ? normCell(r[colTuition]) : "";
    const durationRaw = colDuration >= 0 ? normCell(r[colDuration]) : "";
    const otherRaw = colOther >= 0 ? normCell(r[colOther]) : "";

    if (deptCell) {
      const s = splitCnEn(deptCell);
      lastDeptCN = s.cn || lastDeptCN;
      lastDeptEN = s.en || lastDeptEN;
    }

    if (programCnCell) {
      const s = splitCnEn(programCnCell);
      lastProgramCN = s.cn || lastProgramCN;
    }

    if (tuitionRaw) lastTuition = tuitionRaw;
    if (durationRaw) lastDuration = durationRaw;
    if (otherRaw) lastOther = otherRaw;

    const hasProgram = Boolean(lastProgramCN || programCnCell);
    if (!hasProgram) continue;

    idx++;
    program_catalog.push({
      idx,
      faculty_cn: lastDeptCN || null,
      faculty_en: lastDeptEN || null,
      program_name_cn: lastProgramCN || null,
      tuition_rmb_per_year: parseTuitionAny(lastTuition),
      duration_years: parseDurationAny(lastDuration),
      remarks: lastOther || null,
      raw_line: r.join("\t"),
    });
  }

  return {
    table_header,
    program_catalog,
    raw_text: wholeSheetText,
    meta: {
      kind: "excel",
      contacts: sheetContacts,
      sheetName,
      header_signature,
      mapping_hit: Boolean(mapping),
    },
  };
}

// ================================
// ✅ CSV 解析
// ================================
function parseCsvProgramCatalog(buf: Buffer) {
  let text = buf.toString("utf8");
  text = text.replace(/^\uFEFF/, "");
  const parsed = Papa.parse<string[]>(text, { skipEmptyLines: true });



  const rows = (parsed.data as any[])
    .map((r) => (Array.isArray(r) ? r.map((x) => normCell(x)) : []))
    .filter((r) => r.length > 0);

  const raw_text0 = rows.map((r) => r.join("\t")).join("\n");
  return {
    table_header: [],
    program_catalog: [],
    raw_text: raw_text0,
    meta: { kind: "csv", contacts: parseContactsFromText(raw_text0) },
  };
}

// ================================
// ✅ 读上传文件 -> raw_text
// ================================
// ================================
// ✅ 读上传文件 -> raw_text
// ================================
async function extractTextFromUploadedFile(file: File, filenameGuess: string) {
  const realName = String((file as any)?.name || "").trim();
  const guessName = String(filenameGuess || "").trim();

  // ✅ 文件上传时必须优先真实文件名，避免 manual.txt 把 PDF 判断成 txt
  const filename = realName || guessName || "upload.bin";

  const mime = String((file as any)?.type || "").toLowerCase();
  const buf = Buffer.from(await file.arrayBuffer());

  if (process.env.DEBUG_INGEST === "1") console.log("[UPLOAD_FILE_DEBUG]", {
    realName,
    filenameGuess,
    filename,
    mime,
    size: (file as any)?.size,
    isPdf: isPdf(filename, mime),
    isExcel: isExcel(filename, mime),
    isCsv: isCsv(filename, mime),
    magic5: buf.subarray(0, 5).toString("utf8"),
  });

  if (isPdf(filename, mime)) {
    const t = await pdfToTextByPdftotext(buf);

    if (process.env.DEBUG_INGEST === "1") console.log("[UPLOAD_PDF_TEXT_DEBUG]", {
      filename,
      textLen: t.length,
      preview: t.slice(0, 500),
    });

    if (!t) throw new Error("empty text after pdftotext");

    return {
      filename,
      raw_text: t,
      excelParsed: null as any,
      excelBuf: null as Buffer | null,
      content_type: "application/pdf",
      source_url: null as string | null,
    };
  }

  const isDocxFile =
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    filename.toLowerCase().endsWith(".docx");

  if (isDocxFile) {
    const result = await mammoth.extractRawText({ buffer: buf });
    const rawText = String(result?.value || "").trim();

    console.log("[DOCX_EXTRACT_OK]", {
      filename,
      mime,
      rawLen: rawText.length,
      rawPreview: rawText.slice(0, 300),
    });

    if (!rawText) throw new Error("DOCX_TEXT_EMPTY");

    return {
      filename,
      raw_text: rawText,
      excelParsed: null as any,
      excelBuf: null as Buffer | null,
      content_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      source_url: null as string | null,
    };
  }

  if (isCsv(filename, mime)) {
    const csvParsed = parseCsvProgramCatalog(buf);
    if (!csvParsed.raw_text) throw new Error("empty text after csv parse");

    return {
      filename,
      raw_text: csvParsed.raw_text,
      excelParsed: csvParsed,
      excelBuf: null as Buffer | null,
      content_type: mime || "text/csv",
      source_url: null as string | null,
    };
  }

  if (isExcel(filename, mime)) {
    const excelParsed = parseExcelProgramCatalog(buf, null);
    if (!excelParsed.raw_text) throw new Error("empty text after excel parse");

    return {
      filename,
      raw_text: excelParsed.raw_text,
      excelParsed,
      excelBuf: buf,
      content_type:
        mime ||
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      source_url: null as string | null,
    };
  }

  const tText = buf.toString("utf8").trim();
  if (!tText) throw new Error("empty text after parsing text file");

  return {
    filename,
    raw_text: tText,
    excelParsed: null as any,
    excelBuf: null as Buffer | null,
    content_type: mime || "text/plain",
    source_url: null as string | null,
  };
}

// ================================
// ✅ source_url -> raw_text
// ================================
async function extractTextFromSourceUrl(source_url_raw: string) {
  const source_url = normalizeUrl(source_url_raw);
  if (!source_url) throw new Error("empty source_url");

  const { buf, finalUrl, contentType } = await downloadByCurl(source_url);
  const filename = guessFilenameFromUrl(finalUrl);
  const ct = String(contentType || "").toLowerCase();

  const magic = buf.subarray(0, 5).toString("utf8");
  const looksPdf =
    magic === "%PDF-" ||
    ct.includes("application/pdf") ||
    isLikelyPdfUrl(finalUrl) ||
    filename.toLowerCase().endsWith(".pdf");

  if (looksPdf) {
    const raw_text = await pdfToTextByPdftotext(buf);


    if (!raw_text) throw new Error("empty text after pdftotext from url");
    return {
      filename,
      raw_text,
      excelParsed: null as any,
      excelBuf: null as Buffer | null,
      content_type: "application/pdf",
      source_url: finalUrl,
    };
  }

  let raw_text = buf.toString("utf8");

  if (
    ct.includes("text/html") ||
    ct.includes("application/xhtml") ||
    finalUrl.toLowerCase().includes(".aspx") ||
    finalUrl.toLowerCase().includes(".htm")
  ) {
    raw_text = htmlToText(raw_text);
  }

  raw_text = String(raw_text || "").trim();
  if (!raw_text) {
    throw new Error(`empty text after html/text parse. contentType=${ct} finalUrl=${finalUrl}`);
  }

  return {
    filename,
    raw_text,
    excelParsed: null as any,
    excelBuf: null as Buffer | null,
    content_type: ct || "text/plain",
    source_url: finalUrl,
  };
}

// ================================
// ✅ PDF “挤成一坨”自动拆分（通用）
// ================================
function explodeMergedProgramsFromCell(input: {
  faculty_cn?: string | null;
  text: string;
  defaultTuitionUrl?: string | null;
}) {
  const faculty_cn = input.faculty_cn || null;
  const text = normalizeSpace(input.text);
  if (!text) return [];

  const cleanName = (s: string) =>
    normalizeSpace(s)
      .replace(/（\s*学术学位\s*\/\s*专业学位\s*）/g, "")
      .replace(/\(\s*学术学位\s*\/\s*专业学位\s*\)/g, "")
      .replace(/^[★\*\-•·\s]+/, "")
      .trim();

  const buildRows = (re: RegExp) => {
    const out: any[] = [];
    let m: RegExpExecArray | null;

    while ((m = re.exec(text))) {
      const name0 = String(m[1] || "").trim();
      const name = cleanName(name0);

      const durRaw = String(m[2] || "").trim();
      const feeRaw = String(m[3] || "")
        .replace(/,/g, "")
        .trim();

      const dur = Number(durRaw);
      const fee = Number(feeRaw);

      if (!name) continue;

      out.push({
        faculty_cn,
        program_name_cn: name,
        duration_years: Number.isFinite(dur) ? dur : null,
        tuition_rmb_per_year: Number.isFinite(fee) ? fee : null,
        tuition_source_url: input.defaultTuitionUrl || null,
        raw_line: text,
      });
    }

    return out;
  };

  const reStrict =
    /([\u4e00-\u9fffA-Za-z0-9·\-\(\)\s\*★]+?)\s+(\d+(?:\.\d+)?)(?:\s*年)?(?:\s*\/\s*\d+(?:\.\d+)?(?:\s*年)?)?\s*(?:人民币\s*)?(\d[\d,]*)\s*(?:元)?\s*\/\s*(?:学年|年)/g;

  let rows = buildRows(reStrict);

  if (rows.length === 0) {
    const reLoose =
      /([\u4e00-\u9fffA-Za-z0-9·\-\(\)\s\*★]+?)\s*(\d+(?:\.\d+)?)(?:\s*年)?(?:\s*\/\s*\d+(?:\.\d+)?(?:\s*年)?)?\s*(?:人民币\s*)?(\d[\d,]*)\s*(?:元)?\s*\/\s*(?:学年|年)/g;
    rows = buildRows(reLoose);
  }

  return rows;
}

function looksLikeMergedProgramCell(s: any) {
  const text = String(s || "").trim();
  if (!text) return false;

  const hit1 = (text.match(/\/\s*学年/g) || []).length;
  const hit2 = (text.match(/\/\s*年/g) || []).length;
  const hit = hit1 + hit2;

  if (hit >= 2) return true;
  if (text.length > 80 && text.includes("人民币") && hit >= 1) return true;

  return false;
}

// ================================
// ✅ UG 清洗
// ================================
function sanitizeUgCatalog(program_catalog: any[]) {
  const out: any[] = [];

  const badWords = [
    "学校只为",
    "预交",
    "不予退还",
    "放弃",
    "入学报到",
    "监护人",
    "保证书",
    "申请材料",
    "出入境记录",
    "联系方式",
    "邮政编码",
    "微信公众号",
    "Copyright",
    "技术支持",
    "管理入口",
    "历史访问量",
    "友情链接",
    "奖学金",
    "医疗保险",
    "住宿",
    "注：",
    "说明：",
    "注意事项",
  ];

  const looksLikeHeaderGlue = (s: string) => {
    const t = normalizeSpace(s);
    if (!t) return true;
    return (
      t.includes("院系") &&
      t.includes("专业名称") &&
      t.includes("学制") &&
      t.includes("学费")
    );
  };

  const stripNoise = (s: string) => {
    let x = normalizeSpace(s || "");
    x = x.replace(/https?:\/\/\S+/gi, " ").replace(/www\.\S+/gi, " ");
    x = x.replace(/“?一带一路”?国际医学院网站[:：]?/g, " ");
    x = x.replace(/托福不低于\d+分/g, " ");
    x = x.replace(/雅思不低于[\d.]+分/g, " ");
    x = x.replace(/多邻国不低于\d+分/g, " ");
    x = x.replace(/电话[:：]?\S+/g, " ");
    x = x.replace(/邮箱[:：]?\S+/g, " ");
    x = x.replace(/^[★\*\-•·\s]+/, "");
    return normalizeSpace(x);
  };

  const looksLikeGarbageTitle = (name: string) => {
    const n = stripNoise(name);
    if (!n) return true;
    if (/^(?:\d+|年)$/.test(n)) return true;
    if (/^[\d\W_]+$/.test(n)) return true;
    if (/^[\.\。•·]/.test(n)) return true;
    if (/^(?:人民币|\d+(?:\.\d+)?\s*年|\d[\d,]*\s*\/\s*学年)/.test(n)) return true;
    if (/(TOEFL|IELTS|Duolingo|英语水平|成绩证明)/i.test(n)) return true;

    const cnCount = (n.match(/[\u4e00-\u9fff]/g) || []).length;
    if (cnCount < 2) return true;

    return false;
  };

  const extractNameFromRawLine = (raw: string) => {
    const s0 = stripNoise(raw);
    if (!s0) return "";

    const s = s0
      .replace(/^院系\s+专业名称\s+学制\s+学费.*?注意事项\s*/g, "")
      .replace(/^院系\s+专业名称\s+学制\s+学费\s*/g, "")
      .trim();

    const m0 = s.match(
      /^(.{2,50}?)(?:\s+\d+(?:\.\d+)?\s*年|\s+人民币|\s+\d[\d,]*\s*\/\s*学年)/,
    );
    if (m0?.[1]) {
      return stripNoise(m0[1]);
    }

    const m1 = s.match(/★?\s*([^\d]{2,50}?)\s+\d+(?:\.\d+)?\s*年\s+人民币/i);
    if (m1?.[1]) return stripNoise(m1[1]);

    return "";
  };

  for (const row of program_catalog || []) {
    const rawLine = String(row?.raw_line || row?.raw_block || "").trim();
    const judge = stripNoise(
      rawLine || row?.program_name_cn || row?.program_name || "",
    );
    if (!judge) continue;

    if (looksLikeHeaderGlue(judge)) continue;
    if (badWords.some((w) => judge.includes(w))) continue;

    let name = stripNoise(
      row?.program_name_cn ||
        row?.program_name ||
        row?.program ||
        row?.major ||
        row?.name_cn ||
        "",
    );

    const name2 = rawLine ? extractNameFromRawLine(rawLine) : "";
    if (name2 && !looksLikeGarbageTitle(name2)) name = name2;

    if (name.length > 30) {
      const cut = name.match(
        /^(.{2,30}?)(?:要求|HSK|文科|理科|数学|物理|化学|生物|托福|雅思|IELTS|TOEFL|人民币|\d+\s*年)/,
      );
      if (cut?.[1]) name = stripNoise(cut[1]);
    }

    if (looksLikeGarbageTitle(name)) continue;

    let faculty = stripNoise(
      row?.faculty_cn || row?.faculty || row?.school || "",
    );
    if (faculty && faculty.length > 30) faculty = "";

    if (!faculty && rawLine) {
      const mFac = stripNoise(rawLine).match(
        /^([\u4e00-\u9fff]{2,30}(?:学院|系|中心|研究院|研究所|学部|书院|法学院|医学院|药学院))/,
      );
      if (mFac?.[1]) {
        faculty = stripNoise(mFac[1]);
      }
    }

    const next: any = { ...(row || {}) };
    next.program_name_cn = name;
    if (faculty) next.faculty_cn = faculty;
    if (rawLine) next.raw_line = next.raw_line ?? rawLine;

    out.push(next);
  }

  out.forEach((r, i) => (r.idx = i + 1));
  return out;
}

function isGoodFacultyName(s: any) {
  const t = String(s || "").trim();
  if (!t) return false;
  if (t === "-" || t === "—" || t === "院") return false;
  if (t.length < 2) return false;

  return /(?:学院|系|中心|研究院|研究所|学部|书院|法学院|医学院|药学院)$/.test(t);
}

function repairSjtuFacultyNames(program_catalog: any[]) {
  if (!Array.isArray(program_catalog) || program_catalog.length === 0) {
    return program_catalog || [];
  }

  const bestByFacultyCode = new Map<string, string>();
  const bestGlobal: string[] = [];

  for (const row of program_catalog) {
    const code = String(row?.faculty_code || "").trim();
    const name = String(row?.faculty_cn || "").trim();

    if (isGoodFacultyName(name)) {
      if (code) {
        const prev = bestByFacultyCode.get(code);
        if (!prev || name.length > prev.length) {
          bestByFacultyCode.set(code, name);
        }
      }
      bestGlobal.push(name);
    }
  }

  let fallbackBest = "";
  for (const name of bestGlobal) {
    if (!fallbackBest || name.length > fallbackBest.length) {
      fallbackBest = name;
    }
  }

  return program_catalog.map((row) => {
    const outRow: any = { ...(row || {}) };

    const current = String(outRow?.faculty_cn || "").trim();
    if (isGoodFacultyName(current)) return outRow;

    const code = String(outRow?.faculty_code || "").trim();
    const byCode = code ? bestByFacultyCode.get(code) : "";

    if (byCode) {
      outRow.faculty_cn = byCode;
      return outRow;
    }

    if (fallbackBest && !current) {
      outRow.faculty_cn = fallbackBest;
      return outRow;
    }

    if (current === "院") {
      outRow.faculty_cn = byCode || fallbackBest || null;
    }

    return outRow;
  });
}

function isBadFacultyName(s: any) {
  const t = String(s || "").trim();
  if (!t) return true;
  if (t === "-" || t === "—" || t === "院") return true;
  if (/^\d+$/.test(t)) return true;
  return false;
}

function isBadEnglishName(s: any) {
  const t = String(s || "").trim();
  if (!t) return true;
  if (/^\d+$/.test(t)) return true;
  if (/^[\-\—]+$/.test(t)) return true;
  return false;
}


function normalizeFudanGradSciMedTuitionPolicy(policy: any) {
  if (!policy || !Array.isArray(policy.rules)) return policy;

  const rules = policy.rules.map((rule: any) => {
    const fee = Number(
      rule?.tuition_rmb_per_year ??
      rule?.amount ??
      rule?.fee ??
      rule?.tuition ??
      0
    );

    const text = String(
      [
        rule?.rule_key,
        rule?.kind,
        rule?.degree_kind,
        rule?.discipline_group,
        rule?.label,
        rule?.name,
        rule?.text,
        rule?.raw_line,
        rule?.note,
      ]
        .filter(Boolean)
        .join(" ")
    );

    let kind = String(rule?.kind || "").trim();
    let degree_kind = String(rule?.degree_kind || "").trim();
    let discipline_group = String(rule?.discipline_group || "").trim();
    let rule_key = String(rule?.rule_key || "").trim();

    if (!degree_kind && (text.includes("学术") || fee === 30000 || fee === 48000 || fee === 37000 || fee === 54000)) {
      degree_kind = "学术学位";
    }

    if (!kind) {
      if (text.includes("硕士") || fee === 30000 || fee === 48000) kind = "master";
      if (text.includes("博士") || fee === 37000 || fee === 54000) kind = "phd";
    }

    if (!discipline_group) {
      if (text.includes("医科") || fee === 48000 || fee === 54000) discipline_group = "医科";
      if (text.includes("理工") || text.includes("理科") || fee === 30000 || fee === 37000) discipline_group = "理工科";
    }

    if (!rule_key && kind && degree_kind === "学术学位" && discipline_group) {
      const k0 = kind === "master" ? "master" : "phd";
      const g0 = discipline_group === "医科" ? "medical" : "science_engineering";
      rule_key = `${k0}_academic_${g0}`;
    }

    return {
      ...(rule || {}),
      kind,
      degree_kind,
      discipline_group,
      rule_key,
      tuition_rmb_per_year: Number.isFinite(fee) && fee >= 10000 ? fee : rule?.tuition_rmb_per_year ?? null,
      tuition_note:
        rule?.tuition_note ||
        (
          kind === "master" && discipline_group === "理工科" ? "中文授课项目；硕士理工科 30,000 RMB/Year；学术学位学费标准" :
          kind === "master" && discipline_group === "医科" ? "中文授课项目；硕士医科 48,000 RMB/Year；学术学位学费标准" :
          kind === "phd" && discipline_group === "理工科" ? "中文授课项目；博士理工科 37,000 RMB/Year；学术学位学费标准" :
          kind === "phd" && discipline_group === "医科" ? "中文授课项目；博士医科 54,000 RMB/Year；学术学位学费标准" :
          null
        ),
    };
  });

  return {
    ...policy,
    rules,
  };
}


function dedupeFudanGradSciMedCatalogRows(rows: any[]) {
  if (!Array.isArray(rows) || rows.length === 0) return rows || [];

  const seen = new Set<string>();
  const out: any[] = [];

  const norm = (v: any) =>
    String(v ?? "")
      .replace(/\u00a0/g, " ")
      .replace(/[（）]/g, (m) => (m === "（" ? "(" : ")"))
      .replace(/\s+/g, "")
      .trim();

  for (const row of rows) {
    const idx = norm(row?.idx);
    const faculty = norm(row?.faculty_cn);
    const program = norm(row?.program_name_cn);
    const track = norm(row?.track_name_cn);
    const duration = norm(row?.duration_years);

    // 优先按 PDF 原序号去重；同一个序号下如果导师姓名拆出多行，会被合并掉
    let key = "";
    if (idx && idx !== "0") {
      key = [idx, faculty, program, track || norm(row?.raw_line), duration].join("|");
    } else {
      key = [faculty, program, track, duration, norm(row?.raw_line)].join("|");
    }

    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }

  out.forEach((r, i) => {
    r.idx = i + 1;
  });

  return out;
}


function cleanupSjtuCatalogRows(program_catalog: any[], kind: FileKind) {
  if (!Array.isArray(program_catalog) || program_catalog.length === 0) {
    return program_catalog || [];
  }

  return program_catalog.map((row: any, i: number) => {
    const out: any = { ...(row || {}) };

    if (!String(out.kind || "").trim()) {
      out.kind = kind;
    }

    if (isBadFacultyName(out.faculty_cn)) {
      out.faculty_cn = null;
    }

    if (isBadEnglishName(out.program_name_en)) {
      out.program_name_en = null;
    }

    if (!String(out.degree_type || "").trim()) {
      if (kind === "ug") out.degree_type = "本科";
      else if (kind === "master") out.degree_type = "硕士";
      else if (kind === "phd") out.degree_type = "博士";
    }

    out.idx = i + 1;
    return out;
  });
}


function extractFudanGradSciMedTuitionRulesFromText(rawText: string) {
  const text = String(rawText || "")
    .replace(/\u00a0/g, " ")
    .replace(/[，,]/g, "")
    .replace(/\s+/g, " ");

  const pick = (degree: "硕士" | "博士", group: "理工科" | "医科") => {
    const re = new RegExp(
      degree + "[^\\d]{0,80}" + group + "\\s*([1-9]\\d{4,5})\\s*元",
    );
    const m = text.match(re);
    const n = m?.[1] ? Number(m[1]) : null;
    return Number.isFinite(n) ? n : null;
  };

  const rules = [
    {
      rule_key: "master_academic_science",
      degree_type: "硕士",
      degree_kind: "学术学位",
      discipline_group: "理工科",
      tuition_rmb_per_year: pick("硕士", "理工科"),
    },
    {
      rule_key: "master_academic_medical",
      degree_type: "硕士",
      degree_kind: "学术学位",
      discipline_group: "医科",
      tuition_rmb_per_year: pick("硕士", "医科"),
    },
    {
      rule_key: "phd_academic_science",
      degree_type: "博士",
      degree_kind: "学术学位",
      discipline_group: "理工科",
      tuition_rmb_per_year: pick("博士", "理工科"),
    },
    {
      rule_key: "phd_academic_medical",
      degree_type: "博士",
      degree_kind: "学术学位",
      discipline_group: "医科",
      tuition_rmb_per_year: pick("博士", "医科"),
    },
  ].filter((r) => r.tuition_rmb_per_year != null);

  return rules;
}

function applyFudanGradSciMedTuitionToCatalog(input: {
  rows: any[];
  rawText: string;
  kind: FileKind;
  tuitionSourceUrl?: string | null;
}) {
  const rows = Array.isArray(input.rows) ? input.rows : [];
  if (rows.length === 0) return rows;

  const rules = extractFudanGradSciMedTuitionRulesFromText(input.rawText);
  if (rules.length === 0) return rows;

  const byKey = new Map<string, any>();
  for (const r of rules) {
    byKey.set(String(r.rule_key || ""), r);
  }

  const degreeType = input.kind === "phd" ? "博士" : "硕士";

  const nextRows = rows.map((row: any) => {
    const out: any = { ...(row || {}) };

    const rowDegreeType = String(out.degree_type || degreeType || "").trim();
    const degreeKind = String(out.degree_kind || "").trim();
    const disciplineGroup = String(out.discipline_group || "").trim();

    if (degreeKind === "专业学位") {
      out.tuition_rule_key = "professional_consult_school";
      out.tuition_note =
        out.tuition_note || "专业学位学费标准请向院系咨询";
      return out;
    }

    if (degreeKind && degreeKind !== "学术学位") {
      return out;
    }

    if (!disciplineGroup) return out;

    let key = "";

    if (rowDegreeType === "硕士" && disciplineGroup === "理工科") {
      key = "master_academic_science";
    } else if (rowDegreeType === "硕士" && disciplineGroup === "医科") {
      key = "master_academic_medical";
    } else if (rowDegreeType === "博士" && disciplineGroup === "理工科") {
      key = "phd_academic_science";
    } else if (rowDegreeType === "博士" && disciplineGroup === "医科") {
      key = "phd_academic_medical";
    }

    const rule = key ? byKey.get(key) : null;
    const fee = Number(rule?.tuition_rmb_per_year);

    if (rule && Number.isFinite(fee) && fee >= 10000 && fee <= 300000) {
      out.tuition_rule_key = key;
      out.tuition_rmb_per_year = fee;
      out.tuition_is_per_year = true;
      out.tuition_source_url =
        input.tuitionSourceUrl || out.tuition_source_url || null;
      out.tuition_note =
        out.tuition_note ||
        `中文授课项目；${rowDegreeType}${disciplineGroup} ${fee.toLocaleString("en-US")} RMB/Year；学术学位学费标准`;
    }

    return out;
  });

  console.log("[FUDAN_GRAD_SCIMED_TUITION_DIRECT_APPLIED]", {
    kind: input.kind,
    rules,
    rows: nextRows.length,
    withTuition: nextRows.filter((r: any) => r?.tuition_rmb_per_year != null).length,
    professionalConsult: nextRows.filter(
      (r: any) => String(r?.tuition_rule_key || "") === "professional_consult_school",
    ).length,
    firstWithTuition:
      nextRows.find((r: any) => r?.tuition_rmb_per_year != null) || null,
  });

  return nextRows;
}


function extractFudanGradSciMedFeeNumbersLoose(rawText: string) {
  const text = String(rawText || "")
    .replace(/\u00a0/g, " ")
    .replace(/[，,]/g, "")
    .replace(/\s+/g, " ");

  const grab = (degree: "硕士" | "博士", group: "理工科" | "医科") => {
    const m = text.match(
      new RegExp(degree + "[^。；;\\n]{0,120}" + group + "\\s*([1-9]\\d{4,5})\\s*元"),
    );
    const n = m?.[1] ? Number(m[1]) : null;
    return Number.isFinite(n) ? n : null;
  };

  return {
    masterScience: grab("硕士", "理工科"),
    masterMedical: grab("硕士", "医科"),
    phdScience: grab("博士", "理工科"),
    phdMedical: grab("博士", "医科"),
  };
}

function applyFudanGradSciMedFeeNumbersLoose(input: {
  rows: any[];
  rawText: string;
  kind: FileKind;
  tuitionSourceUrl?: string | null;
}) {
  const rows = Array.isArray(input.rows) ? input.rows : [];
  if (rows.length === 0) return rows;

  const fees = extractFudanGradSciMedFeeNumbersLoose(input.rawText);

  const next = rows.map((row: any) => {
    const out: any = { ...(row || {}) };

    const degreeKind = String(out.degree_kind || "").trim();
    const degreeType = String(
      out.degree_type || (input.kind === "phd" ? "博士" : "硕士"),
    ).trim();
    const group = String(out.discipline_group || "").trim();

    if (degreeKind === "专业学位") {
      out.tuition_rule_key = "professional_consult_school";
      out.tuition_note =
        out.tuition_note || "专业学位学费标准请向院系咨询";
      return out;
    }

    // 只给学术学位补，不碰专业学位
    if (degreeKind && degreeKind !== "学术学位") return out;
    if (!group) return out;

    let fee: number | null = null;
    let key = "";

    if (degreeType === "硕士" && group === "理工科") {
      fee = fees.masterScience;
      key = "master_academic_science";
    } else if (degreeType === "硕士" && group === "医科") {
      fee = fees.masterMedical;
      key = "master_academic_medical";
    } else if (degreeType === "博士" && group === "理工科") {
      fee = fees.phdScience;
      key = "phd_academic_science";
    } else if (degreeType === "博士" && group === "医科") {
      fee = fees.phdMedical;
      key = "phd_academic_medical";
    }

    if (fee != null && Number.isFinite(fee) && fee >= 10000 && fee <= 300000) {
      out.tuition_rule_key = key;
      out.tuition_rmb_per_year = fee;
      out.tuition_is_per_year = true;
      out.tuition_source_url =
        input.tuitionSourceUrl || out.tuition_source_url || null;
      out.tuition_note =
        out.tuition_note ||
        `中文授课项目；${degreeType}${group} ${fee.toLocaleString("en-US")} RMB/Year；学术学位学费标准`;
    }

    return out;
  });

  console.log("[FUDAN_GRAD_SCIMED_FEE_LOOSE_APPLIED]", {
    kind: input.kind,
    fees,
    rows: next.length,
    withTuition: next.filter((r: any) => r?.tuition_rmb_per_year != null).length,
    professionalConsult: next.filter(
      (r: any) => String(r?.tuition_rule_key || "") === "professional_consult_school",
    ).length,
    firstWithTuition:
      next.find((r: any) => r?.tuition_rmb_per_year != null) || null,
  });

  return next;
}

// ================================
// ✅ Handler
// ================================
export async function POST(
  req: Request,
  ctx: { params: Promise<{ school_id?: string }> },
) {
  if (process.env.NODE_ENV !== "production") {
    try {
      console.log(
        "[ZJU_IMPORT_RESOLVE]",
        require.resolve("@/lib/server/parsers/zjuIczuCatalogPdf"),
      );
    } catch {}
  }

  try {
    const { school_id } = await ctx.params;
    if (!school_id) {
      return NextResponse.json(
        { ok: false, error: "missing school_id" },
        { status: 400 },
      );
    }

    const supabase = supabaseAdmin();

    const ct = (req.headers.get("content-type") || "").toLowerCase();
    let form: FormData | null = null;
    let jsonBody: any = null;

    try {
      if (
        ct.includes("multipart/form-data") ||
        ct.includes("application/x-www-form-urlencoded")
      ) {
        form = await req.formData();
      } else if (ct.includes("application/json")) {
        jsonBody = await req.json();
      } else {
        try {
          form = await req.formData();
        } catch {
          const t = await req.text();
          jsonBody = t ? { raw_text: t } : {};
        }
      }
    } catch (e) {
      console.error("[upload] parse body failed:", e, "content-type=", ct);
      return NextResponse.json(
        { ok: false, error: "Failed to parse request body", content_type: ct },
        { status: 400 },
      );
    }

    const getField = (k: string) => {
      if (form) return form.get(k);
      return jsonBody?.[k];
    };

    const kind = String(getField("kind") || "other").trim() as FileKind;
    const linkPurpose =
      (String(
        getField("link_purpose") ||
        getField("linkPurpose") ||
        "catalog",
      ).trim() as LinkPurpose) || "catalog";

    const studyLanguageRaw = String(getField("study_language") || "").trim();

    const studyLanguage =
      studyLanguageRaw === "zh" ||
      studyLanguageRaw === "中文" ||
      studyLanguageRaw === "Chinese"
        ? "中文"
        : studyLanguageRaw === "en" ||
            studyLanguageRaw === "英文" ||
            studyLanguageRaw === "English"
          ? "英文"
          : "";

    let filenameForm = String(getField("filename") || "manual.txt");
    const rawTextFromForm = String(getField("raw_text") || "").trim();
    const source_url_raw = String(getField("source_url") || "").trim();
    const file = form ? (form.get("file") as File | null) : null;

    let out: {
      filename: string;
      raw_text: string;
      excelParsed: any;
      excelBuf: Buffer | null;
      content_type: string;
      source_url: string | null;
    } | null = null;

    if (file && (file as any).size > 0) {
      if (!filenameForm && file?.name) filenameForm = file.name;
      if (!filenameForm) filenameForm = "uploaded_file";

      try {
        out = await extractTextFromUploadedFile(file, filenameForm);
      } catch (fileExtractErr: any) {
        const fileExtractMsg = String(
          fileExtractErr?.message || fileExtractErr || "",
        );
        const nameForImageFallback = String(
          file?.name || filenameForm || "",
        ).trim();

        if (
          String(kind || "").toLowerCase() === "chinese_language" &&
          /PDF_TEXT_EMPTY|pdftotext empty output/i.test(fileExtractMsg) &&
          /北理工|北京理工大学|BIT|语言|汉语|Chinese/i.test(nameForImageFallback)
        ) {
          const bitLang = parseBitLanguageProgramBrochurePdf("", {
            filename: nameForImageFallback || "北京理工大学语言生项目.pdf",
            sourceUrl: null,
            imageFallback: true,
          } as any);

          if (!bitLang?.ok || !Array.isArray(bitLang.rows) || bitLang.rows.length === 0) {
            throw fileExtractErr;
          }

          console.log("[BIT_LANGUAGE_IMAGE_PDF_FALLBACK]", {
            filename: nameForImageFallback,
            rows: bitLang.rows.length,
            first: bitLang.rows[0] || null,
          });

          out = {
            filename: nameForImageFallback || "北京理工大学语言生项目.pdf",
            raw_text: JSON.stringify({
              __image_pdf_fallback_parser: "bit_language_program_brochure_pdf_v1",
              program_catalog: bitLang.rows,
              program_catalog_meta: bitLang.meta,
            }),
            excelParsed: null,
            excelBuf: null,
            content_type: "application/json",
            source_url: null,
          };
        } else if (
          String(kind || "").toLowerCase() === "exchange" &&
          /PDF_TEXT_EMPTY|pdftotext empty output/i.test(fileExtractMsg) &&
          /北理工|北京理工|BIT|Beijing Institute of Technology|交换生|exchange/i.test(nameForImageFallback)
        ) {
          const bitExchange = parseBitExchangeProgramBrochurePdf("", {
            filename: nameForImageFallback || "北理工交换生.pdf",
            sourceUrl: "",
          });

          console.log("[BIT_EXCHANGE_IMAGE_PDF_FALLBACK]", {
            filename: nameForImageFallback,
            rows: bitExchange.rows.length,
            first: bitExchange.rows[0] || null,
          });

          out = {
            filename: nameForImageFallback || "北理工交换生.pdf",
            raw_text: JSON.stringify({
              __image_pdf_fallback_parser: "bit_exchange_program_brochure_pdf_v1",
              program_catalog: bitExchange.rows,
              program_catalog_meta: bitExchange.meta,
            }),
            excelParsed: null,
            excelBuf: null,
            content_type: "application/json",
            source_url: null,
          };
        } else if (
          String(kind || "").toLowerCase() === "ug" &&
          /PDF_TEXT_EMPTY|pdftotext empty output/i.test(fileExtractMsg) &&
          /中科大|中国科学技术大学|ustc/i.test(nameForImageFallback) &&
          /本科|undergraduate/i.test(nameForImageFallback)
        ) {
          const ustc = parseUstcUgCatalogImagePdf();

          console.log("[USTC_UG_IMAGE_PDF_FALLBACK]", {
            filename: nameForImageFallback,
            rows: ustc.rows.length,
            first: ustc.rows[0] || null,
          });

          out = {
            filename: nameForImageFallback || "中科大本科招生专业目录.pdf",
            raw_text: JSON.stringify({
              __image_pdf_fallback_parser: "ustc_ug_image_pdf_v1",
              program_catalog: ustc.rows,
              program_catalog_meta: ustc.meta,
            }),
            excelParsed: null,
            excelBuf: null,
            content_type: "application/json",
            source_url: null,
          };
        } else if (
          String(kind || "").toLowerCase() === "phd" &&
          /PDF_TEXT_EMPTY|pdftotext empty output/i.test(fileExtractMsg) &&
          /英语授课|英文授课|English|English-Taught/i.test(nameForImageFallback)
        ) {
          const ustc = parseUstcPhdEnglishImagePdf();

          console.log("[USTC_PHD_EN_IMAGE_PDF_FALLBACK]", {
            filename: nameForImageFallback,
            rows: ustc.rows.length,
            first: ustc.rows[0] || null,
          });

          out = {
            filename: nameForImageFallback || "博士研究生项目（英语授课）列表.pdf",
            raw_text: JSON.stringify({
              __image_pdf_fallback_parser: "ustc_phd_en_image_pdf_v1",
              program_catalog: ustc.rows,
              program_catalog_meta: ustc.meta,
            }),
            excelParsed: null,
            excelBuf: null,
            content_type: "application/json",
            source_url: null,
          };
        } else if (
          String(kind || "").toLowerCase() === "phd" &&
          /PDF_TEXT_EMPTY|pdftotext empty output/i.test(fileExtractMsg) &&
          /汉语授课|中文授课|Chinese|Chinese-Taught|博士研究生项目/i.test(nameForImageFallback)
        ) {
          const ustc = parseUstcPhdChineseImagePdf();

          console.log("[USTC_PHD_ZH_IMAGE_PDF_FALLBACK]", {
            filename: nameForImageFallback,
            rows: ustc.rows.length,
            first: ustc.rows[0] || null,
          });

          out = {
            filename: nameForImageFallback || "博士研究生项目（汉语授课）列表.pdf",
            raw_text: JSON.stringify({
              __image_pdf_fallback_parser: "ustc_phd_zh_image_pdf_v1",
              program_catalog: ustc.rows,
              program_catalog_meta: ustc.meta,
            }),
            excelParsed: null,
            excelBuf: null,
            content_type: "application/json",
            source_url: null,
          };
        } else if (
          String(kind || "").toLowerCase() === "master" &&
          /PDF_TEXT_EMPTY|pdftotext empty output/i.test(fileExtractMsg) &&
          /汉语授课|中文授课|Chinese|Chinese-Taught/i.test(nameForImageFallback)
        ) {
          const ustc = parseUstcMasterChineseImagePdf();

          console.log("[USTC_MASTER_ZH_IMAGE_PDF_FALLBACK]", {
            filename: nameForImageFallback,
            rows: ustc.rows.length,
            first: ustc.rows[0] || null,
          });

          out = {
            filename: nameForImageFallback || "硕士研究生项目（汉语授课）列表.pdf",
            raw_text: JSON.stringify({
              __image_pdf_fallback_parser: "ustc_master_zh_image_pdf_v1",
              program_catalog: ustc.rows,
              program_catalog_meta: ustc.meta,
            }),
            excelParsed: null,
            excelBuf: null,
            content_type: "application/json",
            source_url: null,
          };
        } else if (
          String(kind || "").toLowerCase() === "master" &&
          /PDF_TEXT_EMPTY|pdftotext empty output/i.test(fileExtractMsg) &&
          (
            /英语授课|english|English-Taught/i.test(nameForImageFallback)
          )
        ) {
          const ustc = parseUstcMasterEnglishImagePdf();

          console.log("[USTC_MASTER_EN_IMAGE_PDF_FALLBACK]", {
            filename: nameForImageFallback,
            rows: ustc.rows.length,
            first: ustc.rows[0] || null,
          });

          out = {
            filename: nameForImageFallback || "硕士研究生项目（英语授课）列表.pdf",
            raw_text: JSON.stringify({
              __image_pdf_fallback_parser: "ustc_master_en_image_pdf_v1",
              program_catalog: ustc.rows,
              program_catalog_meta: ustc.meta,
            }),
            excelParsed: null,
            excelBuf: null,
            content_type: "application/json",
            source_url: null,
          };
        } else {
          throw fileExtractErr;
        }
      }
    } else if (source_url_raw) {
      const got = await extractTextFromSourceUrl(source_url_raw);
      out = {
        filename: got.filename,
        raw_text: got.raw_text,
        excelParsed: got.excelParsed,
        excelBuf: got.excelBuf,
        content_type: got.content_type,
        source_url: got.source_url || null,
      };
    } else {
      if (!rawTextFromForm) {
        return NextResponse.json(
          { ok: false, error: "no file, no source_url, and empty raw_text" },
          { status: 400 },
        );
      }
      out = {
        filename: filenameForm,
        raw_text: rawTextFromForm,
        excelParsed: null,
        excelBuf: null,
        content_type: "text/plain",
        source_url: null,
      };
    }

    const raw_text = String(out?.raw_text ?? "");
    const htmlStrategy = classifyNonPdfHtmlStrategy({
  kind,
  linkPurpose,
  contentType: out?.content_type || "",
  sourceUrl: out?.source_url || source_url_raw || null,
  rawText: raw_text,
});

console.log("[NON_PDF_HTML_STRATEGY]", htmlStrategy);

    // ✅ 复旦研究生中文目录上传防呆：避免硕士 PDF 误传到 phd，或博士 PDF 误传到 master
    if (
      String(out?.content_type || "") === "application/pdf" &&
      String(out?.raw_text || "").includes("复旦大学外国留学生研究生理工医科菁英项目") &&
      String(out?.raw_text || "").includes("中文授课") &&
      String(out?.raw_text || "").includes("招生专业目录")
    ) {
      const rawTitle = String(raw_text || "").slice(0, 300);
      const pdfSaysMaster = rawTitle.includes("硕士招生专业目录");
      const pdfSaysPhd = rawTitle.includes("博士招生专业目录");

      if (kind === "phd" && pdfSaysMaster) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "上传类型选错：这个 PDF 是【复旦中文授课硕士招生专业目录】，请把 kind 选为 master，不要选 phd。",
          },
          { status: 400 },
        );
      }

      if ((/复旦大学外国留学生研究生理工医科菁英项目|fudan university stem elite program/i.test(String(raw_text || ""))) && kind === "master" && pdfSaysPhd) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "上传类型选错：这个 PDF 是【复旦中文授课博士招生专业目录】，请把 kind 选为 phd，不要选 master。",
          },
          { status: 400 },
        );
      }
    }

    let excelParsed = out?.excelParsed;
    const excelBuf = out?.excelBuf || null;
    const content_type = out?.content_type || "";
    const source_url = out?.source_url || null;

    const docClass = classifyProgramDoc({
      raw_text,
      source_url,
      filename: out?.filename || null,
      kind,
    });

  let forcedCatalogByDocClass: any[] | null = null;
let forcedMetaByDocClass: any | null = null;

try {
  const isFudanUndergradCatalog =
    (kind === "ug" || kind === "master" || kind === "phd" || String(kind) === "foundation_bachelor") &&
  content_type === "application/pdf" &&
  (
    String(source_url || "").includes("iso.fudan.edu.cn") ||
    String(raw_text || "").includes("复旦大学外国留学生本科生中文授课专业目录")
  );

const isFudanGradSciMedCatalog =
  (kind === "master" || kind === "phd") &&
  content_type === "application/pdf" &&
  (
    String(source_url || "").includes("iso.fudan.edu.cn") ||
    String(raw_text || "").includes("复旦大学外国留学生研究生理工医科菁英项目") ||
    String(raw_text || "").includes("理工医科菁英项目")
  ) &&
  (
    String(raw_text || "").includes("招生专业目录") ||
    String(raw_text || "").includes("专业目录")
  );

const isSjtuUndergradCatalog =
  kind === "ug" &&
  content_type === "application/pdf" &&
  (
    String(source_url || "").includes("isc.sjtu.edu.cn") ||
    String(raw_text || "").includes("上海交通大学国际本科生中文项目招生专业目录")
  );

const isGenericBilingualCatalog =
  content_type === "application/pdf" &&
  (
    String(raw_text || "").includes("School/Departments") ||
    String(raw_text || "").includes("Schools/Departments") ||
    String(raw_text || "").includes("Length of Schooling") ||
    String(raw_text || "").includes("CSCA Test Subjects")
  ) &&
  (
    String(raw_text || "").includes("Major") ||
    String(raw_text || "").includes("专业")
  );

if (isFudanGradSciMedCatalog) {
  const gradKind = kind === "phd" ? "phd" : "master";
  const r = parseFudanGradSciMedCatalogPdf(
    raw_text,
    kind === "phd" ? "phd" : "master",
  );
  console.log("[FUDAN_GRAD_SCIMED_CATALOG_PARSE_RESULT]", {
    ok: r?.ok,
    rowsLen: Array.isArray(r?.rows) ? r.rows.length : -1,
    meta: r?.meta || null,
    firstRow:
      Array.isArray(r?.rows) && r.rows.length > 0 ? r.rows[0] : null,
  });

  if (Array.isArray(r?.rows) && r.rows.length > 0) {
    forcedCatalogByDocClass = r.rows.map((row: any, i: number) => ({
      ...(row || {}),
      idx: i + 1,
      kind,
      degree_type: kind === "master" ? "硕士" : "博士",
    }));

  forcedMetaByDocClass = {
  ...(r?.meta || {}),
  parser: "fudan_grad_scimed_catalog_pdf_v1",
  doc_type: "fudan_grad_scimed_catalog",
  rows: r.rows.length,
};
  }
} else if (isGenericBilingualCatalog) {
  const r = parseGenericBilingualCatalogPdf(
    raw_text,
    kind === "ug" || kind === "master" || kind === "phd" ? kind : "other",
  );

  console.log("[GENERIC_BILINGUAL_CATALOG_PARSE_RESULT]", {
    ok: r?.ok,
    rowsLen: Array.isArray(r?.rows) ? r.rows.length : -1,
    meta: r?.meta || null,
    reviewSummary: r?.meta?.review_summary || null,
    firstRow:
      Array.isArray(r?.rows) && r.rows.length > 0 ? r.rows[0] : null,
    firstNeedsReview:
      Array.isArray(r?.rows) ? r.rows.find((x: any) => x?.needs_review) || null : null,
  });

  if (Array.isArray(r?.rows) && r.rows.length > 0) {
    forcedCatalogByDocClass = r.rows.map((row: any, i: number) => ({
      ...(row || {}),
      idx: i + 1,
      kind,
    }));

    forcedMetaByDocClass = {
      ...(r?.meta || {}),
      parser: "generic_bilingual_catalog_pdf_v1",
      doc_type: "generic_bilingual_catalog",
      rows: Array.isArray(forcedCatalogByDocClass) ? forcedCatalogByDocClass.length : 0,
    };
  }
} else if (isFudanUndergradCatalog) {
  const r = parseFudanUndergradCatalogPdf(raw_text);

  console.log("[FUDAN_UNDERGRAD_PARSE_RESULT]", {
    ok: r?.ok,
    rowsLen: Array.isArray(r?.rows) ? r.rows.length : -1,
    meta: r?.meta || null,
    firstRow:
      Array.isArray(r?.rows) && r.rows.length > 0 ? r.rows[0] : null,
  });

  if (Array.isArray(r?.rows) && r.rows.length > 0) {
    forcedCatalogByDocClass = r.rows.map((row: any, i: number) => ({
      ...(row || {}),
      idx: i + 1,
    }));

    forcedMetaByDocClass = {
      ...(r?.meta || {}),
      parser: "fudan_undergrad_catalog_pdf_v1",
      doc_type: "fudan_undergrad_catalog",
      rows: Array.isArray(forcedCatalogByDocClass) ? forcedCatalogByDocClass.length : 0,
    };
  }
} else if (isSjtuUndergradCatalog) {
  const r = parseSjtuUndergradCatalogPdf(raw_text);

  console.log("[SJTU_UNDERGRAD_PARSE_RESULT]", {
    ok: r?.ok,
    rowsLen: Array.isArray(r?.rows) ? r.rows.length : -1,
    meta: r?.meta || null,
    firstRow:
      Array.isArray(r?.rows) && r.rows.length > 0 ? r.rows[0] : null,
  });

  if (Array.isArray(r?.rows) && r.rows.length > 0) {
    forcedCatalogByDocClass = r.rows.map((row: any, i: number) => ({
      ...(row || {}),
      idx: i + 1,
    }));

    forcedMetaByDocClass = {
      ...(r?.meta || {}),
      parser: "sjtu_undergrad_catalog_special_v1",
      doc_type: "sjtu_undergrad_catalog",
      rows: Array.isArray(forcedCatalogByDocClass) ? forcedCatalogByDocClass.length : 0,
    };
  }
} else if (docClass.doc_type === "sjtu_doctor_catalog") {


    const r = parseSjtuDoctorCatalogPdf(raw_text);

        console.log("[SJTU_DOCTOR_PARSE_RESULT]", {
          ok: r?.ok,
          rowsLen: Array.isArray(r?.rows) ? r.rows.length : -1,
          meta: r?.meta || null,
          firstRow:
            Array.isArray(r?.rows) && r.rows.length > 0 ? r.rows[0] : null,
        });

        if (Array.isArray(r?.rows) && r.rows.length > 0) {
          forcedCatalogByDocClass = r.rows.map((row: any, i: number) => ({
            ...(row || {}),
            idx: i + 1,
          }));

          forcedMetaByDocClass = {
            ...(r?.meta || {}),
            parser: "sjtu_doctor_catalog",
            doc_type: docClass.doc_type,
            rows: Array.isArray(forcedCatalogByDocClass) ? forcedCatalogByDocClass.length : 0,
          };
        }
      } else if (docClass.doc_type === "sjtu_master_catalog") {
        const r = parseSjtuMasterCatalogPdf(raw_text);

        console.log("[SJTU_MASTER_PARSE_RESULT]", {
          ok: r?.ok,
          rowsLen: Array.isArray(r?.rows) ? r.rows.length : -1,
          meta: r?.meta || null,
          firstRow:
            Array.isArray(r?.rows) && r.rows.length > 0 ? r.rows[0] : null,
        });

        if (Array.isArray(r?.rows) && r.rows.length > 0) {
          forcedCatalogByDocClass = r.rows.map((row: any, i: number) => ({
            ...(row || {}),
            idx: i + 1,
          }));

          forcedMetaByDocClass = {
            ...(r?.meta || {}),
            parser: "sjtu_master_catalog",
            doc_type: docClass.doc_type,
            rows: Array.isArray(forcedCatalogByDocClass) ? forcedCatalogByDocClass.length : 0,
          };
        }
      }
    } catch (e) {
      console.error("docClass forced parser failed:", e);
    }


    // ✅ HTML 单专业详情页：作为 1 条专业目录处理，不保留旧 141 条目录


const ordinaryDegreeKindForParsers: "ug" | "master" | "phd" | undefined =
  kind === "ug" || kind === "master" || kind === "phd" ? kind : undefined;

    if (
      htmlStrategy?.shouldParseProgramDetail &&
      kind === "master" &&
      String(source_url || source_url_raw || "").includes("hwxy.nju.edu.cn")
    ) {
      try {
        const detail = parseNjuMasterHtmlProgramDetail({
          rawText: raw_text,
          sourceUrl: source_url || source_url_raw || null,
        });

        console.log("[NJU_MASTER_HTML_PROGRAM_DETAIL_PARSE]", {
          ok: detail?.ok,
          rowsLen: Array.isArray(detail?.rows) ? detail.rows.length : -1,
          meta: detail?.meta || null,
          firstRow:
            Array.isArray(detail?.rows) && detail.rows.length > 0
              ? detail.rows[0]
              : null,
        });
        const titleDetailRow = parseNjuMasterHtmlDetailByTitle({
          rawText: raw_text,
          sourceUrl: source_url || source_url_raw || null,
        });

        if (titleDetailRow) {
          (detail as any).ok = true;
          (detail as any).rows = [
            {
              ...(((detail as any)?.rows || [])[0] || {}),
              ...titleDetailRow,
              kind: "master",
            },
          ];
          (detail as any).meta = {
            ...(((detail as any)?.meta) || {}),
            parser: "nju_master_html_title_detail_v1",
            doc_type: "nju_master_html_program_detail",
            rows: 1,
            source_url: source_url || source_url_raw || null,
            title_based: true,
          };

          console.log("[NJU_MASTER_HTML_TITLE_DETAIL_FORCE_ROW]", {
            row: (detail as any).rows[0],
            meta: (detail as any).meta,
          });
        }


        if (detail?.ok && Array.isArray(detail?.rows) && detail.rows.length > 0) {
          forcedCatalogByDocClass = detail.rows.map((row: any, i: number) => ({
            ...(row || {}),
            idx: i + 1,
            kind: "master",
            degree_type: "硕士",
          }));

          forcedMetaByDocClass = {
            ...(detail?.meta || {}),
            parser: "nju_master_html_program_detail_v1",
            doc_type: "nju_master_html_program_detail",
            rows: Array.isArray(forcedCatalogByDocClass) ? forcedCatalogByDocClass.length : 0,
          };
        }
      } catch (e) {
        console.error("NJU master html program detail parser failed:", e);
      }
    }


    // ✅ SYSU UG PDF：强制用专用 parser 覆盖，避免 generic PDF 误拆列
    if (
      !forcedCatalogByDocClass?.length &&
      content_type === "application/pdf" &&
      kind === "ug" &&
      (
        String(raw_text || "").includes("中山大学2026年国际学生（本科）招生专业目录") ||
        /SYSU Majors Catalog for Undergraduate International Students in 2026/i.test(String(raw_text || ""))
      )
    ) {
      try {
        const sysu = parseSysuUndergradCatalogPdf(raw_text);

        console.log("[SYSU_UNDERGRAD_PARSE_RESULT]", {
          ok: sysu?.ok,
          rowsLen: Array.isArray(sysu?.rows) ? sysu.rows.length : -1,
          meta: sysu?.meta || null,
          firstRow:
            Array.isArray(sysu?.rows) && sysu.rows.length > 0
              ? sysu.rows[0]
              : null,
        });

        if (Array.isArray(sysu?.rows) && sysu.rows.length > 0) {
          forcedCatalogByDocClass = sysu.rows.map((row: any, i: number) => ({
            ...(row || {}),
            idx: i + 1,
            kind: "ug",
            degree_type: "本科",
          }));

          forcedMetaByDocClass = {
            ...(sysu?.meta || {}),
            parser: "sysu_undergrad_catalog_pdf_special_v1",
            doc_type: "sysu_undergrad_catalog",
            rows: forcedCatalogByDocClass.length,
          };
        }
      } catch (e) {
        console.error("SYSU undergrad catalog parser failed:", e);
      }
    }

    let zjuForced = false;
    let zjuGateHit = false;
    let zjuParseOk: any = null;
    let zjuParseRows = -1;
    let zjuParseParser: any = null;
    let zjuParseErr: any = null;
    let zjuForcedCatalog: any[] | null = null;
    let zjuForcedMeta: any | null = null;

    try {
      const src = String(source_url || "").toLowerCase();
      const isPdfFile =
        String(content_type || "").toLowerCase() === "application/pdf";
      const rawHasIczu = String(raw_text || "")
        .toLowerCase()
        .includes("iczu.zju.edu.cn");

      if (isPdfFile && (src.includes("iczu.zju.edu.cn") || rawHasIczu)) {
        zjuGateHit = true;

        const zju = parseZjuIczuCatalogPdfUg(raw_text);
        const zjuRows: any[] = Array.isArray((zju as any)?.rows)
          ? (zju as any).rows
          : Array.isArray((zju as any)?.program_catalog)
            ? (zju as any).program_catalog
            : [];

        const zjuMeta: any = (zju as any)?.meta || {};

        zjuParseOk = (zju as any)?.ok ?? null;
        zjuParseRows = Array.isArray(zjuRows) ? zjuRows.length : -1;
        zjuParseParser = (zjuMeta as any)?.parser ?? null;

        const zjuHeader: any[] =
          (Array.isArray(zjuMeta?.table_header) ? zjuMeta.table_header : null) ||
          (Array.isArray((zju as any)?.table_header)
            ? (zju as any).table_header
            : []) ||
          [];

        if (zjuRows.length > 0) {
          zjuForced = true;

          const forcedCatalog = zjuRows.map((r: any, i: number) => ({
            ...(r || {}),
            idx: i + 1,
            faculty_cn: r?.faculty_cn ?? r?.faculty ?? null,
            faculty_url: r?.faculty_url ?? null,
            program_name_cn: r?.program_name_cn ?? r?.program_name ?? null,
            duration_years: r?.duration_years ?? null,
            tuition_rmb_per_year: r?.tuition_rmb_per_year ?? null,
            csca_subjects_text: r?.csca_subjects_text ?? null,
            apply_requirements_text: r?.apply_requirements_text ?? null,
            remarks_text: r?.remarks_text ?? null,
            raw_line: r?.raw_line ?? r?.raw_block ?? null,
            raw_block: r?.raw_block ?? r?.raw_line ?? null,
          }));

          zjuForcedCatalog = forcedCatalog;
          zjuForcedMeta = {
            ...zjuMeta,
            kind: "ug",
            parser: String(zjuMeta?.parser || "zju_iczu_ug"),
            rows: forcedCatalog.length,
            table_header: Array.isArray(zjuHeader) ? zjuHeader : [],
          };

          excelParsed = excelParsed || {};
          (excelParsed as any).__zju_forced_catalog = forcedCatalog;
          (excelParsed as any).program_catalog = forcedCatalog;

          (excelParsed as any).meta = {
            ...((excelParsed as any).meta || {}),
            ...zjuMeta,
            kind: "ug",
            parser: String(zjuMeta?.parser || "zju_iczu_ug"),
            rows: forcedCatalog.length,
            table_header: Array.isArray(zjuHeader) ? zjuHeader : [],
          };
        }
      }
    } catch (e: any) {
      zjuParseErr = String(e?.message || e);
      console.error("[ZJU_DEBUG] parseZjuIczuCatalogPdfUg failed:", e);
    }


    const isFudanGradSciMedTuitionGuide =
  (kind === "master" || kind === "phd") &&
  content_type === "application/pdf" &&
  (
    String(source_url || "").includes("iso.fudan.edu.cn") ||
    String(raw_text || "").includes("理工医科菁英项目招生简章") ||
    String(raw_text || "").includes("理工医科菁英项目")
  ) &&
  (
    String(raw_text || "").includes("学费") ||
    String(raw_text || "").includes("收费标准") ||
    String(raw_text || "").includes("申请费")
  ) &&
  !String(raw_text || "").includes("招生专业目录");

const isFudanGradSciMedContext =
  /复旦大学外国留学生研究生理工医科菁英项目|fudan university stem elite program/i.test(String(raw_text || "")) ||
  /fudan/i.test(String(source_url || ""));



if (
  !forcedCatalogByDocClass?.length &&
  !zjuForced &&
  content_type === "application/pdf" &&
  !isFudanGradSciMedTuitionGuide &&
  (kind === "master" || kind === "phd")
) {
  try {
    const rawForGenericCodeCatalog = String(raw_text || "");
    const looksLikeBilingualCodeCatalog =
      /专业代码|Major Code/i.test(rawForGenericCodeCatalog) &&
      /专业名称|Major Name/i.test(rawForGenericCodeCatalog) &&
      /院系名称|院系|学院|Schools\/Departments|School|Department/i.test(rawForGenericCodeCatalog) &&
      /联系方式|Contact/i.test(rawForGenericCodeCatalog) &&
      /学制|Duration/i.test(rawForGenericCodeCatalog) &&
      /学费|Tuition|RMB\/Year|RMB/i.test(rawForGenericCodeCatalog);

    if (looksLikeBilingualCodeCatalog) {
      const genericCode = parseGenericBilingualCodeCatalogPdf(raw_text, {
        kind,
        defaultDurationYears: kind === "phd" ? 4 : null,
      });

      console.log("[GENERIC_BILINGUAL_CODE_CATALOG_PARSE_RESULT]", {
        ok: genericCode?.ok,
        rowsLen: Array.isArray(genericCode?.rows) ? genericCode.rows.length : -1,
        meta: genericCode?.meta || null,
        firstRow:
          Array.isArray(genericCode?.rows) && genericCode.rows.length > 0
            ? genericCode.rows[0]
            : null,
        kind,
      });

      if (Array.isArray(genericCode?.rows) && genericCode.rows.length > 0) {
        forcedCatalogByDocClass = genericCode.rows.map((row: any, i: number) => ({
          ...(row || {}),
          idx: i + 1,
          kind,
          degree_type:
            kind === "phd" ? "博士" :
            kind === "master" ? "硕士" :
            row?.degree_type || null,
        }));

        forcedMetaByDocClass = {
          ...(genericCode?.meta || {}),
          parser: String(genericCode?.meta?.parser || "generic_bilingual_code_catalog_pdf_v1"),
          doc_type: "generic_bilingual_code_catalog",
          rows: Array.isArray(forcedCatalogByDocClass) ? forcedCatalogByDocClass.length : 0,
        };
      }
    }
  } catch (e) {
    console.error("generic bilingual code catalog parser failed:", e);
  }
}


if (
  !forcedCatalogByDocClass?.length &&
  !zjuForced &&
  content_type === "application/pdf" &&
  !isFudanGradSciMedTuitionGuide &&
  (kind === "master" || kind === "phd")
) {
  try {
    const research = parseGenericCnResearchCatalogPdf(
      raw_text,
      kind === "master" || kind === "phd" ? kind : "other",
    );

    console.log("[GENERIC_CN_RESEARCH_CATALOG_PARSE_RESULT]", {
      ok: research?.ok,
      rowsLen: Array.isArray(research?.rows) ? research.rows.length : -1,
      meta: research?.meta || null,
      firstRow:
        Array.isArray(research?.rows) && research.rows.length > 0
          ? research.rows[0]
          : null,
      kind,
    });

    if (Array.isArray(research?.rows) && research.rows.length > 0) {
      forcedCatalogByDocClass = research.rows.map((row: any, i: number) => ({
        ...(row || {}),
        idx: i + 1,
        kind,
        degree_type:
          kind === "master" ? "硕士" :
          kind === "phd" ? "博士" :
          row?.degree_type || null,
      }));

      forcedMetaByDocClass = {
        ...(research?.meta || {}),
        parser: String(research?.meta?.parser || "generic_cn_research_catalog_pdf_v1"),
        doc_type: "generic_cn_research_catalog",
        rows: Array.isArray(forcedCatalogByDocClass) ? forcedCatalogByDocClass.length : 0,
      };
    }
  } catch (e) {
    console.error("generic cn research catalog parser failed:", e);
  }
}

if (
  !forcedCatalogByDocClass?.length &&
  !zjuForced &&
  content_type === "application/pdf" &&
  !isFudanGradSciMedTuitionGuide &&
  (kind === "ug" || kind === "master" || kind === "phd" || String(kind) === "foundation_bachelor")
) {
  try {

const cnCode = ordinaryDegreeKindForParsers ? parseGenericCnCodeCatalogPdf(raw_text, ordinaryDegreeKindForParsers) : ({ rows: [], meta: {} as any, ok: false } as any);

    console.log("[GENERIC_CN_CODE_CATALOG_PARSE_RESULT]", {
      ok: cnCode?.ok,
      rowsLen: Array.isArray(cnCode?.rows) ? cnCode.rows.length : -1,
      meta: cnCode?.meta || null,
      firstRow:
        Array.isArray(cnCode?.rows) && cnCode.rows.length > 0
          ? cnCode.rows[0]
          : null,
      firstNeedsReview:
        Array.isArray(cnCode?.rows)
          ? cnCode.rows.find((r: any) => r?.needs_review === true) || null
          : null,
      kind,
    });

    if (Array.isArray(cnCode?.rows) && cnCode.rows.length > 0) {
      forcedCatalogByDocClass = cnCode.rows.map((row: any, i: number) => ({
        ...(row || {}),
        idx: i + 1,
        kind,
      }));

      forcedMetaByDocClass = {
        ...(cnCode?.meta || {}),
        parser: String(cnCode?.meta?.parser || "generic_cn_code_catalog_pdf_v1"),
        doc_type: "generic_cn_code_catalog",
        rows: Array.isArray(forcedCatalogByDocClass) ? forcedCatalogByDocClass.length : 0,
      };
    }
  } catch (e) {
    console.error("generic cn code catalog parser failed:", e);
  }
}

if (
  !forcedCatalogByDocClass?.length &&
  !zjuForced &&
  content_type === "application/pdf" &&
  !isFudanGradSciMedTuitionGuide &&
  (kind === "ug" || kind === "master" || kind === "phd" || String(kind) === "foundation_bachelor")
) {
  try {
    const bilingual = ordinaryDegreeKindForParsers ? parseGenericBilingualCatalogPdf(raw_text, ordinaryDegreeKindForParsers) : ({ rows: [], meta: {} as any, ok: false } as any);

    console.log("[GENERIC_BILINGUAL_CATALOG_PARSE_RESULT]", {
      ok: bilingual?.ok,
      rowsLen: Array.isArray(bilingual?.rows) ? bilingual.rows.length : -1,
      meta: bilingual?.meta || null,
      reviewSummary: bilingual?.meta?.review_summary || null,
      firstRow:
        Array.isArray(bilingual?.rows) && bilingual.rows.length > 0
          ? bilingual.rows[0]
          : null,
      firstNeedsReview:
        Array.isArray(bilingual?.rows)
          ? bilingual.rows.find((r: any) => r?.needs_review === true) || null
          : null,
      kind,
    });

    if (Array.isArray(bilingual?.rows) && bilingual.rows.length > 0) {
      forcedCatalogByDocClass = bilingual.rows.map((row: any, i: number) => ({
        ...(row || {}),
        idx: i + 1,
        kind,
        degree_type:
          kind === "ug" ? "本科" :
          kind === "master" ? "硕士" :
          kind === "phd" ? "博士" :
          row?.degree_type || null,
      }));

      forcedMetaByDocClass = {
        ...(bilingual?.meta || {}),
        parser: String(bilingual?.meta?.parser || "generic_bilingual_catalog_pdf_v1"),
        doc_type: "generic_bilingual_catalog",
        rows: Array.isArray(forcedCatalogByDocClass) ? forcedCatalogByDocClass.length : 0,
      };
    }
  } catch (e) {
    console.error("generic bilingual catalog parser failed:", e);
  }
}

if (
  !forcedCatalogByDocClass?.length &&
  !zjuForced &&
  content_type === "application/pdf" &&
  !isFudanGradSciMedTuitionGuide
) {
  try {
    const generic = parseGenericTablePdfByKind(raw_text, kind);
        console.log("[GENERIC_TABLE_PDF_PARSE_RESULT]", {
          ok: generic?.ok,
          rowsLen: Array.isArray(generic?.rows) ? generic.rows.length : -1,
          meta: generic?.meta || null,
          firstRow:
            Array.isArray(generic?.rows) && generic.rows.length > 0
              ? generic.rows[0]
              : null,
          kind,
        });

        if (Array.isArray(generic?.rows) && generic.rows.length > 0) {
          forcedCatalogByDocClass = generic.rows.map((row: any, i: number) => ({
            ...(row || {}),
            idx: i + 1,
          }));

          forcedMetaByDocClass = {
            ...(generic?.meta || {}),
            parser: String(generic?.meta?.parser || "generic_table_pdf_v1"),
            doc_type: "generic_table_pdf",
            rows: Array.isArray(forcedCatalogByDocClass) ? forcedCatalogByDocClass.length : 0,
          };
        }
      } catch (e) {
        console.error("generic table pdf parser failed:", e);
      }
    }

    if (excelBuf && excelParsed?.meta?.kind === "excel") {
      try {
        const table_header0 = Array.isArray(excelParsed?.table_header)
          ? excelParsed.table_header
          : [];
        const sig = makeHeaderSignature(table_header0);

        if (sig) {
          const mapping = await loadHeaderMapping(
            supabase,
            school_id,
            kind,
            sig,
          );

          if (mapping && Object.keys(mapping).length > 0) {
            excelParsed = parseExcelProgramCatalog(excelBuf, mapping);
          } else {
            excelParsed = {
              ...(excelParsed || {}),
              meta: {
                ...(excelParsed?.meta || {}),
                header_signature: sig,
                mapping_hit: false,
              },
            };
          }
        }
      } catch (e) {
        console.error("apply header mapping for excel failed:", e);
      }
    }

    let parsedNotes: any = {
      extracted: {},
      checklist: {},
      title: null,
      year: null,
      degree: null,
      language: null,
    };

    try {
      parsedNotes = parseNotes(raw_text);
    } catch (e) {
      console.error("parseNotes failed (fallback):", e);
    }

    let catalogFromText: any = { rows: [], meta: {} };
    try {
      catalogFromText = parseProgramCatalogFromText(raw_text);
    } catch (e) {
      console.error("parseProgramCatalogFromText failed (fallback):", e);
    }

    let program_catalog: any[] =
      forcedCatalogByDocClass && forcedCatalogByDocClass.length
        ? forcedCatalogByDocClass
        : zjuForcedCatalog && zjuForcedCatalog.length
          ? zjuForcedCatalog
          : (excelParsed as any)?.__zju_forced_catalog?.length
            ? (excelParsed as any).__zju_forced_catalog
            : excelParsed?.program_catalog?.length
              ? excelParsed.program_catalog
              : catalogFromText?.rows || [];

    if (
      htmlStrategy?.shouldParseProgramDetail &&
      kind === "master" &&
      String(source_url || "").includes("hwxy.nju.edu.cn") &&
      String(source_url || "").includes("/ssxm/")
    ) {
      try {
        const detail = parseNjuMasterHtmlProgramDetail({
          rawText: raw_text,
          sourceUrl: source_url,
        });

        console.log("[NJU_MASTER_HTML_PROGRAM_DETAIL_PARSE]", {
          ok: detail?.ok,
          rowsLen: Array.isArray(detail?.rows) ? detail.rows.length : -1,
          meta: detail?.meta || null,
          firstRow:
            Array.isArray(detail?.rows) && detail.rows.length > 0
              ? detail.rows[0]
              : null,
        });
        const titleDetailRow = parseNjuMasterHtmlDetailByTitle({
          rawText: raw_text,
          sourceUrl: source_url || source_url_raw || null,
        });

        if (titleDetailRow) {
          (detail as any).ok = true;
          (detail as any).rows = [
            {
              ...(((detail as any)?.rows || [])[0] || {}),
              ...titleDetailRow,
              kind: "master",
            },
          ];
          (detail as any).meta = {
            ...(((detail as any)?.meta) || {}),
            parser: "nju_master_html_title_detail_v1",
            doc_type: "nju_master_html_program_detail",
            rows: 1,
            source_url: source_url || source_url_raw || null,
            title_based: true,
          };

          console.log("[NJU_MASTER_HTML_TITLE_DETAIL_FORCE_ROW]", {
            row: (detail as any).rows[0],
            meta: (detail as any).meta,
          });
        }


        if (detail?.ok && Array.isArray(detail.rows) && detail.rows.length > 0) {
          program_catalog = detail.rows.map((row: any, i: number) => ({
            ...(row || {}),
            idx: i + 1,
            kind: "master",
          }));

          forcedCatalogByDocClass = program_catalog;

          forcedMetaByDocClass = {
            ...(detail?.meta || {}),
            parser: "nju_master_html_program_detail_v1",
            doc_type: "nju_master_html_program_detail",
            rows: program_catalog.length,
          };
        }
      } catch (e) {
        console.error("parse nju master html program detail failed:", e);
      }
    }


let thisTuitionUrl: string | null = null;
let tuitionPatchMap: Map<string, any> | null = null;
let sjtuUgTuitionGlobal: any = null;
let tuitionPolicy: any = null;
let genericTuitionPolicy: any = null;

const rawLooksLikeTuitionDoc =
  String(raw_text || "").includes("学费") ||
  String(raw_text || "").includes("收费标准") ||
  String(raw_text || "").includes("费用标准") ||
  String(raw_text || "").includes("tuition") ||
  String(raw_text || "").includes("Tuition");

if (
  (
    linkPurpose === "tuition" ||
    (
      rawLooksLikeTuitionDoc &&
      content_type === "application/pdf"
    ) ||
    htmlStrategy.shouldParseGenericTuition
  ) &&
  (
    content_type === "application/pdf" ||
    content_type.includes("text/html") ||
    content_type.includes("text/plain")
  )
) {
  
  try {
    thisTuitionUrl = String(source_url || "").trim() || null;

    const isSjtuUgTuitionPage =
      kind === "ug" &&
      (
        String(source_url || "").includes("isc.sjtu.edu.cn") ||
        String(raw_text || "").includes("2026 年上海交通大学国际本科生中文项目") ||
        String(raw_text || "").includes("2026年上海交通大学国际本科生中文项目")
      ) &&
      (
        String(raw_text || "").includes("费用标准") ||
        String(raw_text || "").includes("收费标准") ||
        String(raw_text || "").includes("费用")
      ) &&
      String(raw_text || "").includes("学费");

    if (isSjtuUgTuitionPage) {
      const tuitionPage = parseSjtuUndergradTuitionPage(raw_text);

      console.log("[SJTU_UG_TUITION_PAGE_PARSE]", {
        ok: tuitionPage.ok,
        tuition: tuitionPage.tuition_rmb_per_year,
        pending_faculties: tuitionPage.pending_faculties,
        source_url,
      });

      if (tuitionPage.ok) {
        sjtuUgTuitionGlobal = {
          ...tuitionPage,
          tuition_source_url: thisTuitionUrl,
        };
      }
    }


    // 通用费用页：文科/理科/商科/医学 xxx 元/年，本科/硕士/博士通用
    if (kind === "ug" || kind === "master" || kind === "phd" || String(kind) === "foundation_bachelor") {
      const genericPolicy = parseGenericTuitionPolicyPage(raw_text);

      console.log("[GENERIC_TUITION_POLICY_PARSE]", {
        ok: genericPolicy?.ok,
        rulesLen: Array.isArray(genericPolicy?.rules) ? genericPolicy.rules.length : -1,
        rules: genericPolicy?.rules || [],
        application_fee_rmb: genericPolicy?.application_fee_rmb ?? null,
        insurance_fee_rmb_per_semester: genericPolicy?.insurance_fee_rmb_per_semester ?? null,
        rawFeePreview: String(genericPolicy?.raw_fee_text || "").slice(0, 500),
        source_url,
      });

      if (genericPolicy?.ok) {
        genericTuitionPolicy = {
          ...genericPolicy,
          source_url: thisTuitionUrl || source_url || null,
        };
        tuitionPolicy = genericTuitionPolicy;
      }
    }

    let tuitionParsed: any = parseFudanIsoTuitionPdf(raw_text);

    // ✅ 复旦本科中文授课学费 PDF：按专业 rows 补学费
    if (
      kind === "ug" &&
      (
        String(source_url || "").includes("iso.fudan.edu.cn") ||
        String(raw_text || "").includes("复旦大学外国留学生本科生中文授课专业学费标准")
      )
    ) {
      const fudanUgTuition = parseFudanUndergradTuitionPdf(raw_text);

      console.log("[FUDAN_UG_TUITION_PARSE_RESULT]", {
        ok: fudanUgTuition?.ok,
        rowsLen: Array.isArray(fudanUgTuition?.rows)
          ? fudanUgTuition.rows.length
          : -1,
        meta: fudanUgTuition?.meta || null,
        firstRow:
          Array.isArray(fudanUgTuition?.rows) &&
          fudanUgTuition.rows.length > 0
            ? fudanUgTuition.rows[0]
            : null,
      });

      if (fudanUgTuition?.ok) {
        tuitionParsed = fudanUgTuition;
      }
    }

    // ✅ 复旦硕博理工医科菁英项目：项目级收费 policy，不是按专业 rows
    if (
      isFudanGradSciMedContext &&
      (kind === "master" || kind === "phd") &&
      (
        String(source_url || "").includes("iso.fudan.edu.cn") ||
        String(raw_text || "").includes("理工医科菁英项目")
      )
    ) {
      const p: any = parseFudanGradSciMedTuitionPdf(raw_text);
      const parsedPolicy = normalizeFudanGradSciMedTuitionPolicy(p?.policy || null);

      console.log("[FUDAN_GRAD_SCIMED_TUITION_POLICY_PARSE]", {
        ok: p?.ok,
        hasPolicy: Boolean(parsedPolicy),
        rulesLen: Array.isArray(parsedPolicy?.rules)
          ? parsedPolicy.rules.length
          : -1,
        source_url,
      });

      if (p?.ok && parsedPolicy) {
        const normalizedFudanRules = Array.isArray(parsedPolicy?.rules)
          ? parsedPolicy.rules.map((rule: any, i: number) => {
              const raw = [
                rule?.key,
                rule?.tuition_rule_key,
                rule?.degree_type,
                rule?.degree_kind,
                rule?.discipline_group,
                rule?.name,
                rule?.title,
                rule?.note,
                rule?.raw,
                rule?.raw_line,
                rule?.raw_text,
              ]
                .filter(Boolean)
                .join(" ");

              let key = String(rule?.key || rule?.tuition_rule_key || "").trim();

              if (!key) {
                const isProfessional = raw.includes("专业学位");
                const isMedical =
                  raw.includes("医科") ||
                  raw.includes("医学") ||
                  raw.includes("药学") ||
                  raw.includes("护理") ||
                  raw.includes("公共卫生") ||
                  raw.includes("临床");

                const isSci =
                  raw.includes("理工科") ||
                  raw.includes("理科") ||
                  raw.includes("工科");

                if (isProfessional) {
                  key = "professional_consult_school";
                } else if (isMedical) {
                  key = "academic_medical";
                } else if (isSci) {
                  key = "academic_science_engineering";
                } else {
                  // 复旦理工医科菁英项目招生简章通常解析出 4 条：
                  // 0 硕士学术理工科，1 硕士学术医科，2 博士学术理工科，3 博士学术医科
                  key =
                    i === 0
                      ? "academic_science_engineering"
                      : i === 1
                        ? "academic_medical"
                        : i === 2
                          ? "academic_science_engineering"
                          : i === 3
                            ? "academic_medical"
                            : "";
                }
              }

              const textForAmount = [
                rule?.tuition_rmb_per_year,
                rule?.tuition_per_year,
                rule?.amount,
                rule?.rmb,
                rule?.fee,
                rule?.note,
                rule?.raw,
                rule?.raw_line,
                rule?.raw_text,
              ]
                .filter(Boolean)
                .join(" ");

              const amountHit = String(textForAmount).match(
                /([1-9]\d{4,5}(?:,\d{3})?)/,
              );

              const amount = amountHit
                ? Number(String(amountHit[1]).replace(/,/g, ""))
                : rule?.tuition_rmb_per_year ?? null;

              return {
                ...(rule || {}),
                key: key || null,
                tuition_rule_key: key || null,
                tuition_rmb_per_year:
                  amount != null &&
                  Number.isFinite(Number(amount)) &&
                  Number(amount) >= 10000 &&
                  Number(amount) <= 300000
                    ? Number(amount)
                    : rule?.tuition_rmb_per_year ?? null,
              };
            })
          : [];

        tuitionPolicy = {
          ...parsedPolicy,
          rules: normalizedFudanRules,
          source_url: thisTuitionUrl || source_url || null,
        };

        console.log("[FUDAN_GRAD_SCIMED_TUITION_POLICY_NORMALIZED]", {
          rulesLen: normalizedFudanRules.length,
          ruleKeys: normalizedFudanRules.map((r: any) => r?.tuition_rule_key || r?.key || null),
          firstRule: normalizedFudanRules[0] || null,
        });
      }
    }

const tuitionRows = (tuitionParsed as any)?.ok
  ? (tuitionParsed as any).rows
  : [];

  console.log("[TUITION_ROWS_DEBUG]", {
  linkPurpose,
  rawLooksLikeTuitionDoc,
  kind,
  content_type,
  tuitionParsedOk: (tuitionParsed as any)?.ok,
  tuitionRowsLen: Array.isArray(tuitionRows) ? tuitionRows.length : -1,
  firstTuitionRow:
    Array.isArray(tuitionRows) && tuitionRows.length > 0
      ? tuitionRows[0]
      : null,
});
    const norm2 = (s: any) =>
      String(s ?? "")
        .replace(/\u00a0/g, " ")
        .trim()
        .replace(/[（）]/g, (m) => (m === "（" ? "(" : ")"))
        .replace(/\s+/g, "")
        .toLowerCase();

tuitionPatchMap = new Map<string, any>();

for (const r of tuitionRows || []) {
  const programKey = norm2(r?.program_name_cn);
  const facultyKey = norm2(r?.faculty_cn);

  // 1. 精确：专业 + 学院
  if (programKey && facultyKey) {
    tuitionPatchMap.set(`${programKey}@@${facultyKey}`, r);
  }

  // 2. 兜底：只按专业名匹配
  if (programKey) {
    tuitionPatchMap.set(programKey, r);
  }
}

    if (
      (!Array.isArray(program_catalog) || program_catalog.length === 0) &&
      Array.isArray(tuitionRows) &&
      tuitionRows.length > 0
    ) {
      program_catalog = tuitionRows.map((r: any, i: number) => ({
        idx: i + 1,
        faculty_cn: r.faculty_cn ?? null,
        program_name_cn: r.program_name_cn ?? null,
        duration_years: r.duration_years ?? null,
        tuition_rmb_per_year: r.tuition_rmb_per_year ?? null,
        tuition_note: r.tuition_note ?? null,
        degree_type: r.degree_type ?? null,
        study_language: r.study_language ?? null,
        language_text: r.language_text ?? null,
        tuition_source_url: thisTuitionUrl,
      }));
    }

    excelParsed = excelParsed || {};
    excelParsed.meta = {
      ...(excelParsed.meta || {}),
      tuition_source_url: thisTuitionUrl,
      tuition_policy: tuitionPolicy || undefined,
    };
  } catch (e) {
    console.error("parse tuition failed:", e);
  }
}

// 防止本科“文科/理科/商科”费用规则污染硕士/博士/申请条件/目录上传
if (!(linkPurpose === "tuition" && kind === "ug")) {
  genericTuitionPolicy = null;
  if (
    tuitionPolicy &&
    String((tuitionPolicy as any)?.parser || "").includes("generic_tuition_policy_page")
  ) {
    tuitionPolicy = null;
  }
}

const { data: ovs, error: progOvErr } = await supabase
      .from("school_program_catalog_overrides")
      .select("program_key, patch, locks, updated_at")
      .eq("school_id", school_id);

    if (progOvErr) {
      console.error("load program overrides error:", progOvErr);
    }

    if (Array.isArray(ovs) && ovs.length > 0) {
      program_catalog = applyLockedOverridesToCatalog(
        program_catalog,
        ovs as ProgramOverrideRow[],
      );
    }

    const contactsFallback = parseContactsFromText(raw_text);
    const baseMeta = (forcedMetaByDocClass ??
      zjuForcedMeta ??
      excelParsed?.meta ??
      catalogFromText?.meta ??
      {}) as any;

    const mergedContacts = {
      emails: Array.from(
        new Set([
          ...(baseMeta?.contacts?.emails || []),
          ...(contactsFallback.emails || []),
        ]),
      ),
      phones: Array.from(
        new Set([
          ...(baseMeta?.contacts?.phones || []),
          ...(contactsFallback.phones || []),
        ]),
      ),
    };

    const now = new Date().toISOString();
    const urlStr = String(source_url || "").trim();


    const baseHeader = Array.isArray((baseMeta as any)?.table_header)
  ? (baseMeta as any).table_header
  : [];

let scholarshipPolicy: any = null;
let applyGuidePolicy: any = null;
let applyGuideParsed: any = null;

try {
  const isScholarshipPage =
    linkPurpose === "scholarship" ||
    (
      kind === "ug" &&
      (
        String(source_url || "").includes("isc.sjtu.edu.cn") ||
        String(raw_text || "").includes("上海交通大学国际本科生")
      ) &&
      (
        String(raw_text || "").includes("奖学金") ||
        String(raw_text || "").includes("资助标准") ||
        String(raw_text || "").includes("申请渠道")
    )
  );

  if (isScholarshipPage) {
    const scholarship = parseSjtuUndergradScholarshipPolicy(raw_text);

    console.log("[SJTU_UG_SCHOLARSHIP_PARSE]", {
      ok: scholarship?.ok,
      levelsLen: Array.isArray(scholarship?.levels)
        ? scholarship.levels.length
        : -1,
      source_url,
    });

    if (scholarship?.ok) {
      scholarshipPolicy = {
        ...scholarship,
        source_url: source_url || null,
      };
    }
  }
} catch (e) {
  console.error("parse scholarship policy failed:", e);
}

try {
  const isApplyGuideDoc =
    linkPurpose === "apply_guide" ||
    kind === "apply_guide" ||
    (
      (
        content_type === "application/pdf" ||
        content_type.includes("text/html") ||
        content_type.includes("text/plain")
      ) &&
      (
        String(raw_text || "").includes("招生简章") ||
        String(raw_text || "").includes("申请资格") ||
        String(raw_text || "").includes("申请条件") ||
        String(raw_text || "").includes("入学要求") ||
        String(raw_text || "").includes("申请材料") ||
        String(raw_text || "").includes("申请时间") ||
        String(raw_text || "").includes("申请办法") ||
        String(raw_text || "").includes("报名")
      )
    );

  if (isApplyGuideDoc) {
    const guide = parseApplyGuidePdf(raw_text);
      const guideAny: any = guide;

    console.log("[APPLY_GUIDE_PARSE_DEBUG]", {
      ok: guide?.ok,
      title: guide?.title,
      year: guide?.year,
      degree_levels: guide?.degree_levels,
      study_languages: guide?.study_languages,
      applicationPeriodsLen: Array.isArray(guideAny?.application_periods)
        ? guideAny.application_periods.length
        : -1,
      admissionRequirementsLen: Array.isArray(guideAny?.admission_requirements)
        ? guideAny.admission_requirements.length
        : -1,
      applicationMaterialsLen: Array.isArray(guideAny?.application_materials)
        ? guideAny.application_materials.length
        : -1,
      hasTuitionText: Boolean(guide?.tuition_text),
      hasScholarshipText: Boolean(guide?.scholarship_text),
      hasContactText: Boolean(guide?.contact_text),
      sectionKeys: Object.keys(guideAny?.source_sections || {}),
    });

    if (guide?.ok) {
      applyGuideParsed = {
        ...guide,
        source_url: source_url || null,
        filename: out?.filename || null,
      };
    }
  }
} catch (e) {
  console.error("parse apply guide failed:", e);
}



try {
  const shouldParseApplyGuide =
    linkPurpose === "apply_guide" ||
    kind === "apply_guide" ||
    (
      (
        content_type === "application/pdf" ||
        content_type.includes("text/html") ||
        content_type.includes("text/plain")
      ) &&
      (
        String(raw_text || "").includes("招生简章") ||
        String(raw_text || "").includes("申请资格") ||
        String(raw_text || "").includes("申请材料") ||
        String(raw_text || "").includes("入学要求") ||
        String(raw_text || "").includes("申请条件") ||
        String(raw_text || "").includes("申请时间") ||
        String(raw_text || "").includes("申请办法") ||
        String(raw_text || "").includes("报名")
      )
    );

  if (shouldParseApplyGuide) {
    const applyGuide = parseApplyGuidePdf(raw_text);
      const applyGuideAny: any = applyGuide;

    console.log("[APPLY_GUIDE_PARSE_DEBUG]", {
      ok: applyGuide?.ok,
      title: applyGuide?.title || null,
      year: applyGuide?.year || null,
      degree_levels: applyGuide?.degree_levels || [],
      study_languages: applyGuide?.study_languages || [],
      applicationPeriodsLen: Array.isArray(applyGuideAny?.application_periods)
        ? applyGuideAny.application_periods.length
        : -1,
      admissionRequirementsLen: Array.isArray(applyGuideAny?.admission_requirements)
        ? applyGuideAny.admission_requirements.length
        : -1,
      applicationMaterialsLen: Array.isArray(applyGuideAny?.application_materials)
        ? applyGuideAny.application_materials.length
        : -1,
      hasTuitionText: Boolean(applyGuide?.tuition_text),
      hasScholarshipText: Boolean(applyGuide?.scholarship_text),
      hasContactText: Boolean(applyGuide?.contact_text),
      sectionKeys: applyGuide?.sections ? Object.keys(applyGuide.sections) : [],
    });

    if (applyGuide?.ok) {
      applyGuidePolicy = {
        ...applyGuide,
        source_url: source_url || null,
        filename: out?.filename || null,
      };
    }
  }
} catch (e) {
  console.error("parse apply guide failed:", e);
}



const program_catalog_meta = {
  ...baseMeta,
  fetched_at: now,
  source_url: urlStr || null,
  content_type,
  contacts: mergedContacts,
  table_header: baseHeader,
  study_language: studyLanguage || null,

  tuition_source_url:
    thisTuitionUrl ||
    (baseMeta as any)?.tuition_source_url ||
    null,

  tuition_policy:
    tuitionPolicy ||
    genericTuitionPolicy ||
    (baseMeta as any)?.tuition_policy ||
    null,

  apply_guide:
    applyGuidePolicy ||
    (baseMeta as any)?.apply_guide ||
    null,

  admission_requirements:
    applyGuidePolicy?.admission_requirements ||
    (baseMeta as any)?.admission_requirements ||
    null,

  application_materials:
    applyGuidePolicy?.application_materials ||
    (baseMeta as any)?.application_materials ||
    null,

  application_periods:
    applyGuidePolicy?.application_periods ||
    (baseMeta as any)?.application_periods ||
    null,

scholarship_policy:
  scholarshipPolicy ||
  (baseMeta as any)?.scholarship_policy ||
  null,

  apply_guide_policy:
    applyGuidePolicy ||
    (baseMeta as any)?.apply_guide_policy ||
    null,
};
    try {
      if (Array.isArray(program_catalog) && program_catalog.length > 0) {
        const tuitionUrl =
          String(program_catalog_meta?.tuition_source_url || "").trim() || null;

        const next: any[] = [];

        for (const row of program_catalog) {
          const s = String(
            row?.raw_line || row?.raw_block || row?.program_name_cn || "",
          ).trim();

          if (looksLikeMergedProgramCell(s)) {
            const exploded = explodeMergedProgramsFromCell({
              faculty_cn: row?.faculty_cn ?? null,
              text: s,
              defaultTuitionUrl: tuitionUrl,
            });

            if (exploded.length > 0) {
              exploded.forEach((x) => next.push({ ...(row || {}), ...x }));
              continue;
            }
          }

          next.push(row);
        }

        next.forEach((r, i) => (r.idx = i + 1));
        program_catalog = next;
      }
    } catch (e) {
      console.error("explodeMergedProgramsFromCell failed:", e);
    }

const isForcedStructuredParser =
  Boolean(forcedCatalogByDocClass && forcedCatalogByDocClass.length > 0) ||
  docClass?.doc_type === "sjtu_doctor_catalog" ||
  docClass?.doc_type === "sjtu_master_catalog" ||
  zjuForced === true;
    if (
      studyLanguage &&
      Array.isArray(program_catalog) &&
      program_catalog.length > 0 &&
      !isForcedStructuredParser
    ) {
      program_catalog = program_catalog.map((row) => {
        const outRow: any = { ...(row || {}) };

        const hasLang =
          typeof outRow.language_text === "string" &&
          outRow.language_text.trim();

        if (!hasLang) {
          outRow.language_text = studyLanguage;
        }

        if (studyLanguage === "英文" && outRow.is_english_taught == null) {
          outRow.is_english_taught = true;
        }
        if (studyLanguage === "中文" && outRow.is_english_taught == null) {
          outRow.is_english_taught = false;
        }

        return outRow;
      });
    }

    if (
      Array.isArray(program_catalog) &&
      program_catalog.length > 0 &&
      (
        docClass?.doc_type === "sjtu_doctor_catalog" ||
        docClass?.doc_type === "sjtu_master_catalog"
      )
    ) {
      program_catalog = cleanupSjtuCatalogRows(program_catalog, kind);
    }


    
    try {
      if (Array.isArray(program_catalog) && program_catalog.length > 0) {
        program_catalog = program_catalog.map((row) => ({
          ...(row || {}),
          tags: buildRowTags(row),
        }));
      }
    } catch (e) {
      console.error("buildRowTags failed:", e);
    }

    const parsed = {
      ...parsedNotes,
      raw: raw_text,
      program_catalog,
      program_catalog_meta,
      table_header: baseHeader,
    };

// ===== BIT_EXCHANGE_PROGRAM_FORCE_START =====
try {
  if (String(kind || "").toLowerCase() === "exchange") {
    const exchangeFilename = String(out?.filename || filenameForm || "");
    const exchangeSeedText =
      String(raw_text || "").trim().length > 20
        ? String(raw_text || "")
        : `北京理工大学 交换生 Exchange Program 2026 ${exchangeFilename}`;

    const bitExchangeParsed = parseBitExchangeProgramBrochurePdf(exchangeSeedText, {
      filename: exchangeFilename,
      sourceUrl: String(source_url || ""),
    });

    if (bitExchangeParsed?.ok && Array.isArray(bitExchangeParsed.rows) && bitExchangeParsed.rows.length > 0) {
      Object.assign(parsed as any, {
        program_catalog: bitExchangeParsed.rows,
        program_catalog_meta: {
          ...(bitExchangeParsed.meta || {}),
          parser: bitExchangeParsed.meta?.parser || "bit_exchange_program_brochure_pdf_v1",
          profile: bitExchangeParsed.meta?.profile || "bit_exchange_programs",
          force_structured_parser: true,
        },
      });

      console.log("[BIT_EXCHANGE_PROGRAM_FORCE]", {
        rows: bitExchangeParsed.rows.length,
        parser: bitExchangeParsed.meta?.parser,
        profile: bitExchangeParsed.meta?.profile,
        first: bitExchangeParsed.rows[0] || null,
      });
    } else {
      console.warn("[BIT_EXCHANGE_PROGRAM_FORCE_EMPTY]", {
        filename: exchangeFilename,
        rawLen: String(raw_text || "").length,
        rawPreview: String(raw_text || "").slice(0, 80),
      });
    }
  }
} catch (e) {
  console.error("[BIT_EXCHANGE_PROGRAM_FORCE_ERR]", e);
}
// ===== BIT_EXCHANGE_PROGRAM_FORCE_END =====


    const { data: prevRows, error: prevErr } = await supabase
      .from("school_files")
      .select("id, parsed_json")
      .eq("school_id", school_id)
      .eq("kind", kind)
      .order("created_at", { ascending: false })
      .limit(1);

    if (prevErr) {
      console.error("load previous school_files error:", prevErr);
    }

    const prev = Array.isArray(prevRows) ? prevRows[0] : null;
    const prevParsed = (prev?.parsed_json || {}) as any;

    const prevCatalog = Array.isArray(prevParsed?.program_catalog)
      ? prevParsed.program_catalog
      : [];
    let nextCatalog = Array.isArray(parsed?.program_catalog)
      ? parsed.program_catalog
      : [];
    


// ===== IMAGE_PDF_FALLBACK_FORCE_NEXT_CATALOG_START =====
try {
  const rawForImagePdfFallback = String(out?.raw_text || raw_text || "").trim();

  if (rawForImagePdfFallback.includes("__image_pdf_fallback_parser")) {
    const fb = JSON.parse(rawForImagePdfFallback);

    if (Array.isArray(fb?.program_catalog)) {
      if (Array.isArray(nextCatalog)) {
        nextCatalog.splice(0, nextCatalog.length, ...fb.program_catalog);
      }

      (parsed as any).program_catalog = fb.program_catalog;
      (parsed as any).program_catalog_meta = {
        ...((parsed as any).program_catalog_meta || {}),
        ...(fb.program_catalog_meta || {}),
        kind,
        filename:
          filenameForm ||
          file?.name ||
          out?.filename ||
          "uploaded_image_pdf",
        content_type: "application/pdf",
        source: "uploaded_image_pdf_fallback",
      };
      (parsed as any).raw = "";

      console.log("[IMAGE_PDF_FALLBACK_FORCE_NEXT_CATALOG]", {
        parser: fb?.__image_pdf_fallback_parser,
        rows: nextCatalog.length,
        first: nextCatalog[0] || null,
        meta: (parsed as any).program_catalog_meta,
      });
    }
  }
} catch (e) {
  console.error("[IMAGE_PDF_FALLBACK_FORCE_NEXT_CATALOG_ERR]", e);
}
// ===== IMAGE_PDF_FALLBACK_FORCE_NEXT_CATALOG_END =====


// ===== USTC_PHD_BILINGUAL_IMAGE_PDF_MERGE_START =====
try {
  const parserNow = String((parsed as any)?.program_catalog_meta?.parser || "");
  const isUstcPhdImagePdf =
    kind === "phd" &&
    (
      parserNow === "ustc_phd_zh_image_pdf_v1" ||
      parserNow === "ustc_phd_en_image_pdf_v1"
    );

  if (
    isUstcPhdImagePdf &&
    Array.isArray(prevCatalog) &&
    prevCatalog.length > 0 &&
    Array.isArray(nextCatalog) &&
    nextCatalog.length > 0
  ) {
    const prevUstcRows = prevCatalog.filter((r: any) => {
      const tags = Array.isArray(r?.tags) ? r.tags.join(" ") : "";
      return (
        String(r?.kind || "") === "phd" &&
        (
          tags.includes("USTC图片PDF目录") ||
          String(r?.program_name_en || "").trim() ||
          String(r?.track_name_en || "").trim()
        )
      );
    });

    const merged = [...prevUstcRows, ...nextCatalog];

    const keyOf = (r: any) => [
      String(r?.study_language || r?.language_text || "").trim().toLowerCase(),
      String(r?.program_name_cn || "").trim(),
      String(r?.program_name_en || "").trim(),
      String(r?.track_name_cn || "").trim(),
      String(r?.track_name_en || "").trim(),
    ].join("@@");

    const map = new Map<string, any>();
    for (const r of merged) {
      const k = keyOf(r);
      if (!k.replace(/@/g, "").trim()) continue;
      map.set(k, r);
    }

    const mergedRows = Array.from(map.values()).map((r: any, i: number) => ({
      ...r,
      idx: i + 1,
    }));

    nextCatalog.splice(0, nextCatalog.length, ...mergedRows);
    (parsed as any).program_catalog = mergedRows;
    (parsed as any).program_catalog_meta = {
      ...((parsed as any).program_catalog_meta || {}),
      parser: "ustc_phd_bilingual_image_pdf_merge_v1",
      doc_type: "ustc_phd_bilingual_catalog_image_pdf",
      rows: mergedRows.length,
      merged_from_latest_previous: true,
      latest_uploaded_parser: parserNow,
    };

    console.log("[USTC_PHD_BILINGUAL_IMAGE_PDF_MERGE]", {
      parserNow,
      prevRows: prevCatalog.length,
      prevUstcRows: prevUstcRows.length,
      uploadedRows: merged.length - prevUstcRows.length,
      mergedRows: mergedRows.length,
      first: mergedRows[0] || null,
    });
  }
} catch (e) {
  console.error("[USTC_PHD_BILINGUAL_IMAGE_PDF_MERGE_ERR]", e);
}
// ===== USTC_PHD_BILINGUAL_IMAGE_PDF_MERGE_END =====


// ===== USTC_MASTER_BILINGUAL_IMAGE_PDF_MERGE_START =====
try {
  const parserNow = String((parsed as any)?.program_catalog_meta?.parser || "");
  const isUstcMasterImagePdf =
    kind === "master" &&
    (
      parserNow === "ustc_master_zh_image_pdf_v1" ||
      parserNow === "ustc_master_en_image_pdf_v1"
    );

  if (
    isUstcMasterImagePdf &&
    Array.isArray(prevCatalog) &&
    prevCatalog.length > 0 &&
    Array.isArray(nextCatalog) &&
    nextCatalog.length > 0
  ) {
    const prevUstcRows = prevCatalog.filter((r: any) => {
      const tags = Array.isArray(r?.tags) ? r.tags.join(" ") : "";
      return (
        String(r?.kind || "") === "master" &&
        (
          tags.includes("USTC图片PDF目录") ||
          String(r?.program_name_en || "").trim() ||
          String(r?.track_name_en || "").trim()
        )
      );
    });

    const merged = [...prevUstcRows, ...nextCatalog];

    const keyOf = (r: any) => [
      String(r?.study_language || r?.language_text || "").trim().toLowerCase(),
      String(r?.program_name_cn || "").trim(),
      String(r?.program_name_en || "").trim(),
      String(r?.track_name_cn || "").trim(),
      String(r?.track_name_en || "").trim(),
    ].join("@@");

    const map = new Map<string, any>();
    for (const r of merged) {
      const k = keyOf(r);
      if (!k.replace(/@/g, "").trim()) continue;
      map.set(k, r);
    }

    const mergedRows = Array.from(map.values()).map((r: any, i: number) => ({
      ...r,
      idx: i + 1,
    }));

    nextCatalog.splice(0, nextCatalog.length, ...mergedRows);
    (parsed as any).program_catalog = mergedRows;
    (parsed as any).program_catalog_meta = {
      ...((parsed as any).program_catalog_meta || {}),
      parser: "ustc_master_bilingual_image_pdf_merge_v1",
      doc_type: "ustc_master_bilingual_catalog_image_pdf",
      rows: mergedRows.length,
      merged_from_latest_previous: true,
      latest_uploaded_parser: parserNow,
    };

    console.log("[USTC_MASTER_BILINGUAL_IMAGE_PDF_MERGE]", {
      parserNow,
      prevRows: prevCatalog.length,
      prevUstcRows: prevUstcRows.length,
      uploadedRows: merged.length - prevUstcRows.length,
      mergedRows: mergedRows.length,
      first: mergedRows[0] || null,
    });
  }
} catch (e) {
  console.error("[USTC_MASTER_BILINGUAL_IMAGE_PDF_MERGE_ERR]", e);
}
// ===== USTC_MASTER_BILINGUAL_IMAGE_PDF_MERGE_END =====


// ===== WHU_UG_DOCX_FORCE_NEXT_CATALOG_START =====
try {
  const whuDocxFilename = String(filenameForm || out?.filename || file?.name || "").trim();
  const whuDocxRaw = String(raw_text || out?.raw_text || "").trim();
  const whuDocxContentType = String(content_type || out?.content_type || "").toLowerCase();

  const isDocxLike =
    whuDocxFilename.toLowerCase().endsWith(".docx") ||
    whuDocxContentType.includes("wordprocessingml.document") ||
    whuDocxContentType.includes("application/vnd.openxmlformats");

  const hasWhuSignal =
    whuDocxFilename.includes("武汉大学") ||
    whuDocxRaw.includes("武汉大学") ||
    whuDocxRaw.includes("Wuhan University") ||
    whuDocxRaw.includes("Undergraduate Programs Available to International Applicants");

  console.log("[WHU_UG_DOCX_FORCE_CHECK]", {
    kind,
    whuDocxFilename,
    whuDocxContentType,
    isDocxLike,
    hasWhuSignal,
    rawLen: whuDocxRaw.length,
    rawPreview: whuDocxRaw.slice(0, 220),
  });

  if (kind === "ug" && isDocxLike && hasWhuSignal) {
    const isEnglishDocx =
      whuDocxFilename.includes("英文授课") ||
      whuDocxRaw.includes("English-taught") ||
      whuDocxRaw.includes("Bachelor of Management");

    const parsedWhu = isEnglishDocx
      ? parseWhuUgEnglishDocx(whuDocxRaw)
      : parseWhuUgChineseDocx(whuDocxRaw);

    if (parsedWhu.ok && Array.isArray(parsedWhu.rows) && parsedWhu.rows.length > 0) {
      nextCatalog.splice(0, nextCatalog.length, ...parsedWhu.rows);

      (parsed as any).program_catalog = parsedWhu.rows;
      (parsed as any).program_catalog_meta = {
        ...((parsed as any).program_catalog_meta || {}),
        ...parsedWhu.meta,
        kind: "ug",
        filename: whuDocxFilename || "武汉大学本科招生专业.docx",
        content_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        source: "uploaded_docx",
      };

      console.log("[WHU_UG_DOCX_FORCE_NEXT_CATALOG]", {
        filename: whuDocxFilename,
        parser: parsedWhu.meta.parser,
        rows: parsedWhu.rows.length,
        first: parsedWhu.rows[0] || null,
      });
    } else {
      console.log("[WHU_UG_DOCX_FORCE_EMPTY]", {
        filename: whuDocxFilename,
        isEnglishDocx,
        parsedOk: parsedWhu.ok,
        rows: Array.isArray(parsedWhu.rows) ? parsedWhu.rows.length : -1,
      });
    }
  }
} catch (e) {
  console.error("[WHU_UG_DOCX_FORCE_NEXT_CATALOG_ERR]", e);
}
// ===== WHU_UG_DOCX_FORCE_NEXT_CATALOG_END =====


// ===== WHU_UG_DOCX_BILINGUAL_MERGE_START =====
try {
  const parserNow = String((parsed as any)?.program_catalog_meta?.parser || "");
  const isWhuUgDocxCatalog =
    kind === "ug" &&
    (
      parserNow === "whu_ug_zh_docx_v1" ||
      parserNow === "whu_ug_en_docx_v1"
    );

  if (
    isWhuUgDocxCatalog &&
    Array.isArray(prevCatalog) &&
    Array.isArray(nextCatalog) &&
    nextCatalog.length > 0
  ) {
    const prevWhuRows = prevCatalog.filter((r: any) => {
      const tags = Array.isArray(r?.tags) ? r.tags.join(" ") : "";
      const raw = String(r?.raw_block || "") + " " + String(r?.raw_line || "");
      const lang = String(r?.study_language || r?.language_text || "").trim().toLowerCase();
      const hasProgram =
        String(r?.program_name_cn || "").trim() ||
        String(r?.program_name_en || "").trim();

      return (
        String(r?.kind || "") === "ug" &&
        Boolean(hasProgram) &&
        (
          tags.includes("WHU_DOCX目录") ||
          raw.includes("武汉大学") ||
          raw.includes("Wuhan University") ||
          lang === "zh" ||
          lang === "中文" ||
          lang === "chinese" ||
          lang === "en" ||
          lang === "英文" ||
          lang === "english"
        )
      );
    });

    const merged = [...prevWhuRows, ...nextCatalog];

    const keyOf = (r: any) => [
      String(r?.study_language || r?.language_text || "").trim().toLowerCase(),
      String(r?.faculty_cn || "").trim(),
      String(r?.faculty_en || "").trim(),
      String(r?.program_name_cn || "").trim(),
      String(r?.program_name_en || "").trim(),
    ].join("@@");

    const map = new Map<string, any>();
    for (const r of merged) {
      const k = keyOf(r);
      if (!k.replace(/@/g, "").trim()) continue;
      map.set(k, r);
    }

    const mergedRows = Array.from(map.values()).map((r: any, i: number) => ({
      ...r,
      idx: i + 1,
    }));

    nextCatalog.splice(0, nextCatalog.length, ...mergedRows);
    (parsed as any).program_catalog = mergedRows;
    (parsed as any).program_catalog_meta = {
      ...((parsed as any).program_catalog_meta || {}),
      parser: "whu_ug_bilingual_docx_merge_v1",
      doc_type: "whu_ug_bilingual_docx_catalog",
      rows: mergedRows.length,
      latest_uploaded_parser: parserNow,
      merged_from_latest_previous: true,
    };

    console.log("[WHU_UG_DOCX_BILINGUAL_MERGE]", {
      parserNow,
      prevRows: prevCatalog.length,
      prevWhuRows: prevWhuRows.length,
      uploadedRows: nextCatalog.length,
      mergedRows: mergedRows.length,
      first: mergedRows[0] || null,
    });
  }
} catch (e) {
  console.error("[WHU_UG_DOCX_BILINGUAL_MERGE_ERR]", e);
}
// ===== WHU_UG_DOCX_BILINGUAL_MERGE_END =====






// ===== BIT_GRADUATE_ADMISSION_BROCHURE_FORCE_START =====
try {
  const bitGrad = parseBitGraduateAdmissionBrochurePdf(String(raw_text || ""), {
    kind: String(kind || ""),
    filename: String(out?.filename || file?.name || filenameForm || ""),
    sourceUrl: String(source_url || source_url_raw || ""),
  });

  if (
    (String(kind) === "master" || String(kind) === "phd") &&
    bitGrad.ok &&
    Array.isArray(bitGrad.rows) &&
    bitGrad.rows.length > 0
  ) {
    nextCatalog.splice(0, nextCatalog.length, ...bitGrad.rows);

    (parsed as any).program_catalog = bitGrad.rows;
    (parsed as any).program_catalog_meta = {
      ...((parsed as any).program_catalog_meta || {}),
      ...bitGrad.meta,
      source: "bit_graduate_admission_brochure_pdf",
      force_structured_parser: true,
    };

    console.log("[BIT_GRADUATE_ADMISSION_BROCHURE_FORCE]", {
      kind,
      rows: bitGrad.rows.length,
      parser: bitGrad.meta?.parser,
      profile: bitGrad.meta?.profile,
      first: bitGrad.rows[0] || null,
    });
  }
} catch (e) {
  console.error("[BIT_GRADUATE_ADMISSION_BROCHURE_FORCE_ERR]", e);
}
// ===== BIT_GRADUATE_ADMISSION_BROCHURE_FORCE_END =====


// ===== BIT_LANGUAGE_PROGRAM_FORCE_START =====
try {
  const bitLanguageParsed = parseBitLanguageProgramBrochurePdf(raw_text || "", {
    filename: String((out as any)?.filename || (out as any)?.name || ""),
    sourceUrl: String(source_url || ""),
  });
  if (bitLanguageParsed?.ok && Array.isArray(bitLanguageParsed.rows) && bitLanguageParsed.rows.length > 0) {
    Object.assign(parsed as any, {
      program_catalog: bitLanguageParsed.rows,
      program_catalog_meta: bitLanguageParsed.meta,
    });
    if (process.env.DEBUG_INGEST === "1") {
      console.log("[BIT_LANGUAGE_PROGRAM_FORCE]", {
        rows: bitLanguageParsed.rows.length,
        parser: bitLanguageParsed.meta?.parser,
        profile: bitLanguageParsed.meta?.profile,
      });
    }
  }
} catch (e) {
  console.error("[BIT_LANGUAGE_PROGRAM_FORCE_ERR]", e);
}
// ===== BIT_LANGUAGE_PROGRAM_FORCE_END =====
// ===== GENERIC_ADMISSION_BROCHURE_UNDERGRAD_FORCE_START =====
try {
  const brochureRawText = String(raw_text || "");
  const brochureFilename = String(out?.filename || file?.name || filenameForm || "");
  const brochureSourceUrl = String(source_url || source_url_raw || "");

  const looksLikeUgBrochure =
    String(kind) === "ug" &&
    /本科生|undergraduate/i.test(brochureRawText) &&
    /招生简章|ADMISSION\s+BOOK|admission/i.test(brochureRawText) &&
    (
      /Program\s+List|CSCA\s+Required\s+subjects|English\s+taught\s+programs/i.test(brochureRawText) ||
      /中文授课学费|英文授课学费|Chinese taught program tuition|English taught program tuition/i.test(brochureRawText)
    );

  const parsedBrochure = parseGenericAdmissionBrochureUndergradPdf(brochureRawText, {
    kind: String(kind || ""),
    filename: brochureFilename,
    sourceUrl: brochureSourceUrl,
  });

  let brochureRows: any[] =
    parsedBrochure.ok && Array.isArray(parsedBrochure.rows)
      ? parsedBrochure.rows
      : [];

  let brochureMeta: any = parsedBrochure.meta || {};

  // Generic fallback:
  // 用于北理工这类“招生简章 PDF”，专业藏在 English taught programs / Program List 表里，
  // 普通 generic_program_catalog_v1 会把学校简介、奖学金误当专业。
  if (looksLikeUgBrochure && brochureRows.length === 0) {
    const normLine = (x: any) =>
      String(x || "")
        .replace(/\u00a0/g, " ")
        .replace(/\t/g, " ")
        .replace(/[ ]+/g, " ")
        .trim();

    const lines = brochureRawText
      .replace(/\f/g, "\n")
      .replace(/\r/g, "\n")
      .split("\n")
      .map(normLine)
      .filter(Boolean);

    const moneyOf = (re: RegExp) => {
      const m = brochureRawText.match(re);
      if (!m) return null;
      const n = Number(String(m[1] || "").replace(/,/g, ""));
      return Number.isFinite(n) && n >= 10000 && n <= 300000 ? n : null;
    };

    const zhTuition =
      moneyOf(/中文授课学费[:：]?\s*([0-9,]+)\s*元\s*\/?\s*年/i) ||
      moneyOf(/Chinese\s+taught\s+program\s+tuition[:：]?\s*CNY\s*([0-9,]+)\s*\/?\s*year/i);

    const enTuition =
      moneyOf(/英文授课学费[:：]?\s*([0-9,]+)\s*元\s*\/?\s*年/i) ||
      moneyOf(/English\s+taught\s+program\s+tuition[:：]?\s*CNY\s*([0-9,]+)\s*\/?\s*year/i);

    const durationMatch =
      brochureRawText.match(/学习期限[:：]?\s*([0-9.]+)\s*年/) ||
      brochureRawText.match(/Duration[:：]?\s*([0-9.]+)\s*years?/i);

    const durationYears = durationMatch ? Number(durationMatch[1]) : 4;

    const badProgram = (x: string) => {
      const s = normLine(x);
      if (!s) return true;
      if (s.length < 3 || s.length > 90) return true;
      if (/^(Program|Program List|CSCA|Required subjects|Mathematics|Physics|Mathematics\+Physics|Qualification|Duration|Fees|Scholarship|Accommodation|Application|Procedure)$/i.test(s)) return true;
      if (/campus|tuition|fee|year|month|deadline|contact|website|email|address|passport|diploma|transcript/i.test(s)) return true;
      if (/简介|奖学金|申请|材料|流程|费用|住宿|联系方式|报名|学校|排名|教育部|校区简介/.test(s)) return true;
      if (/^[0-9\s.,:：;；/()-]+$/.test(s)) return true;
      return false;
    };

    const cleanProgram = (x: string) =>
      normLine(x)
        .replace(/^[-•·]+/, "")
        .replace(/\s+(Mathematics|Physics|Mathematics\+Physics)$/i, "")
        .trim();

    const rows: any[] = [];
    const seen = new Set<string>();

    const pushProgram = (name: string, campusText: string | null, lang: "en" | "zh", tuition: number | null) => {
      const program = cleanProgram(name);
      if (badProgram(program)) return;

      const key = `${lang}@@${campusText || ""}@@${program}`.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);

      rows.push({
        idx: rows.length + 1,
        kind: "ug",
        degree_type: "本科",
        degree_kind: "学士",
        program_name_cn: null,
        program_name_en: /[A-Za-z]/.test(program) ? program : null,
        language_text: lang === "en" ? "英文" : "中文",
        study_language: lang,
        campus_text: campusText,
        duration_years: Number.isFinite(durationYears) && durationYears >= 1 && durationYears <= 8 ? durationYears : 4,
        tuition_rmb_per_year: tuition,
        tuition_is_per_year: tuition != null ? true : null,
        tuition_note: tuition != null ? `${tuition.toLocaleString("en-US")} RMB/Year` : null,
        raw_line: program,
        raw_block: program,
        source_files: [brochureFilename].filter(Boolean),
        source_url: brochureSourceUrl || null,
        tags: ["本科", lang === "en" ? "英文" : "中文", "招生简章专业表"],
      });
    };

    let inEnglishProgramSection = false;
    let campusText: string | null = null;

    for (const rawLine of lines) {
      const line = normLine(rawLine);

      if (/English\s+taught\s+programs/i.test(line)) {
        inEnglishProgramSection = true;
        campusText = null;
        continue;
      }

      if (inEnglishProgramSection && /^(Qualification|Application Materials|Application Procedure|Duration\s*&\s*Fees|Duration|Fees)$/i.test(line)) {
        inEnglishProgramSection = false;
        campusText = null;
        continue;
      }

      if (!inEnglishProgramSection) continue;

      if (/Beijing\s+campus/i.test(line)) {
        campusText = "北京校区";
        continue;
      }

      if (/Zhuhai\s+campus/i.test(line)) {
        campusText = "珠海校区";
        continue;
      }

      if (/Program\s+List|Program\s+CSCA|CSCA\s+Required/i.test(line)) continue;

      // 一行里可能是 “International Economics and Trade Mathematics”
      // 后半 Mathematics 是考试科目，不是专业名。
      pushProgram(line, campusText, "en", enTuition);
    }

    if (rows.length > 0) {
      brochureRows = rows.map((r, i) => ({ ...r, idx: i + 1 }));
      brochureMeta = {
        parser: "generic_admission_brochure_undergrad_pdf_fallback_v1",
        doc_type: "generic_admission_brochure_undergrad_pdf",
        profile: "program_list_section_fallback",
        rows: brochureRows.length,
        filename: brochureFilename,
        source_url: brochureSourceUrl || null,
        tuition_zh_rmb_per_year: zhTuition,
        tuition_en_rmb_per_year: enTuition,
      };
    }

    console.log("[GENERIC_ADMISSION_BROCHURE_UNDERGRAD_FALLBACK]", {
      looksLikeUgBrochure,
      rows: rows.length,
      zhTuition,
      enTuition,
      durationYears,
      first: rows[0] || null,
    });
  }

  const countBadBrochureRows = (rows: any[]) =>
    rows.filter((r: any) => {
      const name = String(r?.program_name_cn || r?.program_name_en || "");
      const dur = Number(r?.duration_years);
      return (
        /简介|奖学金|学生活动|首页|排名|联系方式|申请|材料|流程|费用|undergraduate\s*·/i.test(name) ||
        (Number.isFinite(dur) && dur > 8)
      );
    }).length;

  const shouldReplaceBadBrochureRows =
    looksLikeUgBrochure &&
    Array.isArray(brochureRows) &&
    brochureRows.length > 0 &&
    countBadBrochureRows(brochureRows) >= Math.max(2, Math.ceil(brochureRows.length * 0.4));

  if (shouldReplaceBadBrochureRows) {
    const normLine = (x: any) =>
      String(x || "")
        .replace(/\u00a0/g, " ")
        .replace(/\t/g, " ")
        .replace(/[ ]+/g, " ")
        .trim();

    const lines = brochureRawText
      .replace(/\f/g, "\n")
      .replace(/\r/g, "\n")
      .split("\n")
      .map(normLine)
      .filter(Boolean);

    const moneyOf = (re: RegExp) => {
      const m = brochureRawText.match(re);
      if (!m) return null;
      const n = Number(String(m[1] || "").replace(/,/g, ""));
      return Number.isFinite(n) && n >= 10000 && n <= 300000 ? n : null;
    };

    const zhTuition =
      moneyOf(/中文授课学费[:：]?\s*([0-9,]+)\s*元\s*\/?\s*年/i) ||
      moneyOf(/Chinese\s+taught\s+program\s+tuition[:：]?\s*CNY\s*([0-9,]+)\s*\/?\s*year/i);

    const enTuition =
      moneyOf(/英文授课学费[:：]?\s*([0-9,]+)\s*元\s*\/?\s*年/i) ||
      moneyOf(/English\s+taught\s+program\s+tuition[:：]?\s*CNY\s*([0-9,]+)\s*\/?\s*year/i);

    const durationMatch =
      brochureRawText.match(/学习期限[:：]?\s*([0-9.]+)\s*年/) ||
      brochureRawText.match(/Duration[:：]?\s*([0-9.]+)\s*years?/i);

    const durationYears = durationMatch ? Number(durationMatch[1]) : 4;

    const normalizeProgramName = (x: string) =>
      normLine(x)
        .replace(/^[-•·]+/, "")
        .replace(/[\u2022·]+/g, "")
        .replace(/\s+(Mathematics\s*\+\s*Physics|Mathematics|Physics|Chemistry|Biology)$/i, "")
        .replace(/\s+/g, " ")
        .trim();

    const isBadProgram = (x: string) => {
      const v = normalizeProgramName(x);
      if (!v) return true;
      if (v.length < 3 || v.length > 90) return true;
      if (/^(Program|Program List|CSCA|Required subjects|Qualification|Duration|Fees|Scholarship|Accommodation|Application|Procedure)$/i.test(v)) return true;
      if (/campus|tuition|fee|year|month|deadline|contact|website|email|address|passport|diploma|transcript/i.test(v)) return true;
      if (/简介|奖学金|申请|材料|流程|费用|住宿|联系方式|报名|学校|排名|教育部|校区简介/.test(v)) return true;
      if (/^[0-9\s.,:：;；/()+-]+$/.test(v)) return true;
      return false;
    };

    const programWhitelist = [
      "Aeronautical and Astronautical Engineering",
      "Automation",
      "Computer Science and Technology",
      "Mechatronics Engineering",
      "Electronics Science and Technology",
      "Mechanical Engineering",
      "International Economics and Trade",
      "Artificial Intelligence",
      "Artiﬁcial Intelligence",
      "Artifical Intelligence",
      "Artificial Intelligence",
    ];

    const rows: any[] = [];
    const seen = new Set<string>();

    const pushProgram = (name: string, campusText: string | null, tuition: number | null) => {
      let program = normalizeProgramName(name)
        .replace(/Artiﬁcial/g, "Artificial")
        .replace(/Artifical/g, "Artificial");

      if (program === "International Economics and Trade Mathematics") {
        program = "International Economics and Trade";
      }

      if (isBadProgram(program)) return;

      const key = `${campusText || ""}@@${program}`.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);

      rows.push({
        idx: rows.length + 1,
        kind: "ug",
        degree_type: "本科",
        degree_kind: "学士",
        program_name_cn: null,
        program_name_en: program,
        language_text: "英文",
        study_language: "en",
        campus_text: campusText,
        duration_years: Number.isFinite(durationYears) && durationYears >= 1 && durationYears <= 8 ? durationYears : 4,
        tuition_rmb_per_year: tuition,
        tuition_is_per_year: tuition != null ? true : null,
        tuition_note: tuition != null ? `${tuition.toLocaleString("en-US")} RMB/Year` : null,
        raw_line: program,
        raw_block: program,
        source_files: [brochureFilename].filter(Boolean),
        source_url: brochureSourceUrl || null,
        tags: ["本科", "英文", "招生简章专业表", "坏行替换"],
      });
    };

    let campusText: string | null = null;
    const joined = lines.join("\n");

    // 优先白名单命中：适合 PDF 抽行错乱、专业和考试科目粘连的情况。
    for (const name of programWhitelist) {
      const canonical = name.replace(/Artiﬁcial/g, "Artificial");
      const re = new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace("ﬁ", "[ﬁfi]+"), "i");
      if (!re.test(joined)) continue;

      const pos = joined.search(re);
      const before = joined.slice(Math.max(0, pos - 500), pos);
      const campus =
        /Zhuhai\s+campus/i.test(before) && !/Beijing\s+campus/i.test(before.slice(before.lastIndexOf("Zhuhai campus") + 1))
          ? "珠海校区"
          : /Zhuhai\s+campus/i.test(before) && before.lastIndexOf("Zhuhai campus") > before.lastIndexOf("Beijing campus")
            ? "珠海校区"
            : "北京校区";

      pushProgram(canonical, campus, enTuition);
    }

    // 再走通用 section 扫描，兼容其他学校类似 Program List。
    let inProgramSection = false;

    for (const rawLine of lines) {
      const line = normLine(rawLine);

      if (/English\s+taught\s+programs|Program\s+List|CSCA\s+Required\s+subjects/i.test(line)) {
        inProgramSection = true;
        continue;
      }

      if (inProgramSection && /^(Qualification|Application Materials|Application Procedure|Duration\s*&\s*Fees|Duration|Fees)$/i.test(line)) {
        inProgramSection = false;
        campusText = null;
        continue;
      }

      if (!inProgramSection) continue;

      if (/Beijing\s+campus/i.test(line)) {
        campusText = "北京校区";
        continue;
      }

      if (/Zhuhai\s+campus/i.test(line)) {
        campusText = "珠海校区";
        continue;
      }

      if (/Program\s+List|Program\s+CSCA|CSCA\s+Required/i.test(line)) continue;

      pushProgram(line, campusText, enTuition);
    }

    if (rows.length > 0) {
      brochureRows = rows.map((r, i) => ({ ...r, idx: i + 1 }));
      brochureMeta = {
        parser: "generic_admission_brochure_undergrad_pdf_fallback_v2",
        doc_type: "generic_admission_brochure_undergrad_pdf",
        profile: "program_list_section_bad_rows_replaced",
        rows: brochureRows.length,
        filename: brochureFilename,
        source_url: brochureSourceUrl || null,
        tuition_zh_rmb_per_year: zhTuition,
        tuition_en_rmb_per_year: enTuition,
        replaced_bad_rows: true,
      };
    }

    console.log("[GENERIC_ADMISSION_BROCHURE_UNDERGRAD_BAD_ROWS_REPLACED]", {
      beforeRows: Array.isArray(brochureRows) ? brochureRows.length : -1,
      badRows: countBadBrochureRows(brochureRows),
      newRows: rows.length,
      zhTuition,
      enTuition,
      durationYears,
      first: rows[0] || null,
    });
  }

  if (
    String(kind) === "ug" &&
    looksLikeUgBrochure &&
    Array.isArray(brochureRows) &&
    brochureRows.length > 0
  ) {
    nextCatalog.splice(0, nextCatalog.length, ...brochureRows);

    (parsed as any).program_catalog = brochureRows;
    (parsed as any).program_catalog_meta = {
      ...((parsed as any).program_catalog_meta || {}),
      ...brochureMeta,
      source: "generic_admission_brochure_undergrad_pdf",
    };

    console.log("[GENERIC_ADMISSION_BROCHURE_UNDERGRAD_FORCE]", {
      kind,
      rows: brochureRows.length,
      parser: brochureMeta?.parser,
      profile: brochureMeta?.profile,
      first: brochureRows[0] || null,
    });
  } else {
    console.log("[GENERIC_ADMISSION_BROCHURE_UNDERGRAD_FORCE_SKIP]", {
      kind,
      looksLikeUgBrochure,
      parsedOk: parsedBrochure.ok,
      parsedRows: Array.isArray(parsedBrochure.rows) ? parsedBrochure.rows.length : -1,
      fallbackRows: brochureRows.length,
      filename: brochureFilename,
    });
  }
} catch (e) {
  console.error("[GENERIC_ADMISSION_BROCHURE_UNDERGRAD_FORCE_ERR]", e);
}
// ===== GENERIC_ADMISSION_BROCHURE_UNDERGRAD_FORCE_END =====


// ===== GENERIC_PROGRAM_CATALOG_FORCE_START =====
try {
  const genericCatalogSignal = [
    String(filenameForm || ""),
    String(out?.filename || ""),
    String(file?.name || ""),
    String(content_type || ""),
    String(out?.content_type || ""),
    String(raw_text || ""),
  ].join("\n");




// ===== GENERIC_ENGLISH_PROGRAM_DETAIL_URL_START =====
try {
  const detailSourceUrl = String(source_url || source_url_raw || "").trim();
  const detailRaw = String(raw_text || "");
  const detailText = detailRaw
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n");

  const isUrlHtmlDetail =
    Boolean(detailSourceUrl) &&
    /\.(html?|aspx)(\?|#|$)/i.test(detailSourceUrl);

  const hasProgramDetailLabels =
    /Application\s+Period/i.test(detailText) &&
    /Duration/i.test(detailText) &&
    /(Tuition\s+Fee|Application\s+Fee|Fees?\s*&\s*Expenses)/i.test(detailText) &&
    /(Eligibility|Qualification|Language|TOEFL|IELTS)/i.test(detailText);

  const hasCatalogTableSignal =
    /School\/College\/Dept\.\s+Specialty|Specialty\s+CSCA|招生专业目录|专业目录/i.test(detailText);

  const shouldUseGenericEnglishProgramDetail =
    isUrlHtmlDetail &&
    hasProgramDetailLabels &&
    !hasCatalogTableSignal &&
    Array.isArray(nextCatalog) &&
    nextCatalog.length === 0;

  const pick = (patterns: RegExp[]) => {
    for (const re of patterns) {
      const m = detailText.match(re);
      if (m?.[1]) return String(m[1]).replace(/\s+/g, " ").trim();
    }
    return null;
  };

  const pickMoney = (patterns: RegExp[]) => {
    const v = pick(patterns);
    if (!v) return null;
    const m = String(v).replace(/,/g, "").match(/(\d{3,8})/);
    return m ? Number(m[1]) : null;
  };

  const titleLine =
    pick([
      /^\s*(English[-\s]*taught[^\n]{0,160}Program[^\n]*)/im,
      /^\s*([^\n]{0,120}Program\s+of\s+[^\n]{2,120})/im,
      /^\s*([^\n]{0,120}Programme\s+of\s+[^\n]{2,120})/im,
    ]) || null;

  let programNameEn =
    pick([
      /Program\s+Name\s*[:：]\s*([^\n]+)/i,
      /Programme\s+Name\s*[:：]\s*([^\n]+)/i,
      /Master[’']?s\s+Program\s+of\s+([^\n]+)/i,
      /Master\s+Program\s+of\s+([^\n]+)/i,
      /Program\s+of\s+([^\n]+)/i,
      /Programme\s+of\s+([^\n]+)/i,
    ]) || titleLine;

  if (programNameEn) {
    programNameEn = programNameEn
      .replace(/^English[-\s]*taught\s+/i, "")
      .replace(/^Master[’']?s\s+Program\s+of\s+/i, "")
      .replace(/^Master\s+Program\s+of\s+/i, "")
      .replace(/^Program\s+of\s+/i, "")
      .replace(/\s*[-–—]\s*Southeast\s+University.*$/i, "")
      .trim();
  }

  const facultyEn =
    pick([
      /(School\s+of\s+[A-Z][A-Za-z &,\-]{2,80})/i,
      /(College\s+of\s+[A-Z][A-Za-z &,\-]{2,80})/i,
      /(Department\s+of\s+[A-Z][A-Za-z &,\-]{2,80})/i,
    ]) ||
    (/school\s+of\s+public\s+health/i.test(detailText) ? "School of Public Health" : null);

  const durationYears = (() => {
    const v = pick([
      /Duration\s*[:：]?\s*(\d+(?:\.\d+)?)\s*(?:years?|yrs?)/i,
      /Program\s+Duration\s*[:：]?\s*(\d+(?:\.\d+)?)\s*(?:years?|yrs?)/i,
    ]);
    return v ? Number(v) : null;
  })();

  const applicationPeriodText = pick([
    /Application\s+Period\s*[:：]?\s*([A-Za-z]+\s+\d{1,2}(?:st|nd|rd|th)?\s*[-–—]\s*[A-Za-z]+\s+\d{1,2}(?:st|nd|rd|th)?)/i,
    /Application\s+Period\s*[:：]?\s*([^\n;]{4,80})/i,
  ]);

  const englishRequirementText = pick([
    /((?:TOEFL\s*:?\s*\d+)\s*\/\s*(?:IELTS\s*:?\s*\d+(?:\.\d+)?))/i,
    /((?:TOEFL|IELTS)[^\n]{0,120})/i,
  ]);

  const eligibilityEn = pick([
    /Eligibility\s*[:：]?\s*([^\n]{10,260})/i,
    /Qualification\s*[:：]?\s*([^\n]{10,260})/i,
    /Applicants?\s+must\s+([^\n]{10,260})/i,
  ]);

  const applicationFeeRmb = pickMoney([
    /Application\s+Fee\s*[:：]?\s*(?:CNY|RMB|¥)?\s*([0-9,]+)/i,
  ]);

  const tuitionRmb = pickMoney([
    /Tuition\s+Fee\s*[:：]?\s*(?:CNY|RMB|¥)?\s*([0-9,]+)/i,
    /Tuition\s*[:：]?\s*(?:CNY|RMB|¥)?\s*([0-9,]+)/i,
  ]);

  const accommodationText = pick([
    /Accommodation\s+Fee\s*[:：]?\s*([^\n]{3,120})/i,
    /Accommodation\s*[:：]?\s*([^\n]{3,120})/i,
  ]);

  const accommodationNums = String(accommodationText || "")
    .replace(/,/g, "")
    .match(/\d{3,8}/g)
    ?.map((x) => Number(x)) || [];

  const insuranceFeeRmb = pickMoney([
    /Insurance\s+Fee\s*[:：]?\s*(?:CNY|RMB|¥)?\s*([0-9,]+)/i,
    /Insurance\s*[:：]?\s*(?:CNY|RMB|¥)?\s*([0-9,]+)/i,
  ]);

  const applicationUrl =
    pick([
      /(https?:\/\/fs\.seu\.edu\.cn[^\s]*)/i,
      /(http:\/\/fs\.seu\.edu\.cn[^\s]*)/i,
    ]) ||
    (/fs\.seu\.edu\.cn/i.test(detailText) ? "http://fs.seu.edu.cn" : null);

  const degreeKind =
    String(kind) === "doctor" || /doctoral|ph\.?d/i.test(detailText)
      ? "doctor"
      : String(kind) === "ug" || /undergraduate|bachelor/i.test(detailText)
        ? "ug"
        : "master";

  const degreeType =
    degreeKind === "doctor" ? "博士" : degreeKind === "ug" ? "本科" : "硕士";

  const programNameCn =
    /public\s+health/i.test(String(programNameEn || "")) || /public\s+health/i.test(detailText)
      ? "公共卫生（英文授课）"
      : null;

  if (shouldUseGenericEnglishProgramDetail && (programNameEn || facultyEn || durationYears)) {
    const row: any = {
      idx: 1,
      kind,
      tags: [degreeType, "英文", "链接详情"],
      faculty_cn: programNameCn ? "公共卫生学院" : null,
      college_cn: programNameCn ? "公共卫生学院" : null,
      faculty_en: facultyEn,
      program_name_cn: programNameCn,
      major_name_cn: programNameCn,
      program_name_en: programNameEn,
      major_name_en: programNameEn,
      degree_type: degreeType,
      degree_kind: degreeKind,
      program_category: degreeKind,
      study_language: "en",
      language_text: "英文",
      duration_years: durationYears,
      duration_text: durationYears ? `${durationYears} years` : null,
      eligibility_en: eligibilityEn,
      english_requirement_text: englishRequirementText,
      application_period_text: applicationPeriodText,
      application_fee_rmb: applicationFeeRmb,
      application_fee_note: applicationFeeRmb ? `CNY ${applicationFeeRmb}` : null,
      tuition_rmb: tuitionRmb,
      tuition_rmb_text: tuitionRmb ? `CNY ${tuitionRmb.toLocaleString("en-US")}` : null,
      tuition_rmb_per_year: tuitionRmb,
      tuition_rmb_per_year_text: tuitionRmb ? `CNY ${tuitionRmb.toLocaleString("en-US")}` : null,
      tuition_is_per_year: null,
      accommodation_fee_rmb_per_year_min: accommodationNums.length ? Math.min(...accommodationNums) : null,
      accommodation_fee_rmb_per_year_max: accommodationNums.length ? Math.max(...accommodationNums) : null,
      accommodation_fee_text: accommodationText,
      insurance_fee_rmb_per_year: insuranceFeeRmb,
      insurance_fee_note: insuranceFeeRmb ? `CNY ${insuranceFeeRmb}` : null,
      application_url: applicationUrl,
      source_url: detailSourceUrl || null,
      source_files: [out?.filename || "page.htm", detailSourceUrl].filter(Boolean),
      raw_title_line: titleLine,
    };

    Object.keys(row).forEach((k) => {
      if (row[k] === undefined) row[k] = null;
    });

    nextCatalog.splice(0, nextCatalog.length, row);

    (parsed as any).program_catalog = [row];
    (parsed as any).program_catalog_meta = {
      ...((parsed as any).program_catalog_meta || {}),
      parser: "generic_english_program_detail_url_v1",
      profile: "english_program_detail_url",
      source: "generic_english_program_detail_url_rule",
      source_url: detailSourceUrl || null,
      rows: 1,
    };

    console.log("[GENERIC_ENGLISH_PROGRAM_DETAIL_URL]", {
      kind,
      source_url: detailSourceUrl,
      programNameEn,
      facultyEn,
      durationYears,
      applicationFeeRmb,
      tuitionRmb,
      insuranceFeeRmb,
    });
  }
} catch (e) {
  console.error("[GENERIC_ENGLISH_PROGRAM_DETAIL_URL_ERR]", e);
}
// ===== GENERIC_ENGLISH_PROGRAM_DETAIL_URL_END =====


// ===== GENERIC_TUITION_ACCOUNT_POLICY_URL_START =====
try {
  const feePolicyUrl = String(source_url || source_url_raw || "").trim();
  const feePolicyText = String(raw_text || "");

  const isTuitionAccountPolicyPage =
    Boolean(feePolicyUrl) &&
    (
      /\/14319\/list\.htm/i.test(feePolicyUrl) ||
      (
        /学费与账户|Tuition\s+and\s+Account|Fees?\s+and\s+Account/i.test(feePolicyText) &&
        /每年学费清单|学费清单|Tuition\s+Fee|Tuition/i.test(feePolicyText) &&
        /保险费|Insurance/i.test(feePolicyText) &&
        /住宿费|Accommodation/i.test(feePolicyText)
      )
    );

  if (isTuitionAccountPolicyPage) {
    if (Array.isArray(nextCatalog)) {
      nextCatalog.splice(0, nextCatalog.length);
    }

    const tuitionPolicy = {
      parser: "generic_tuition_account_policy_url_v1",
      profile: "tuition_account_policy",
      source_url: feePolicyUrl || null,

      application_fee_rmb: 800,
      application_fee_note: "800元人民币，无论是否录取，申请费不予退还。",

      insurance_fee_rmb_per_year: 800,
      insurance_fee_note: "800元人民币/年。",

      accommodation_fee_rmb_per_year: 9000,
      accommodation_fee_note: "9000元人民币/年，双人间中的一个床位。",

      tuition_matrix: {
        zh: {
          ug: {
            liberal_arts: 16000,
            science_engineering: 19000,
            medicine: 20000,
          },
          master: {
            liberal_arts: 18000,
            science_engineering: 23000,
            medicine: 30000,
          },
          doctor: {
            liberal_arts: 28000,
            science_engineering: 33000,
            medicine: 50000,
          },
        },
        en: {
          ug: {
            medicine: 32000,
          },
          master: {
            liberal_arts: 30000,
            science_engineering: 33000,
            public_health: 33000,
            medicine: 35000,
          },
          doctor: {
            liberal_arts: 33000,
            science_engineering: 38000,
            medicine: 55000,
          },
        },
        non_degree: {
          language_student: 16000,
          general_scholar: 16000,
          senior_scholar: 20000,
        },
      },

      payment_methods: {
        domestic_bank_account: true,
        overseas_bank_account: true,
        online_payment: true,
      },
    };

    (parsed as any).program_catalog = [];
    (parsed as any).program_catalog_meta = {
      ...((parsed as any).program_catalog_meta || {}),
      parser: "generic_tuition_account_policy_url_v1",
      profile: "tuition_account_policy",
      source: "generic_tuition_account_policy_url_rule",
      source_url: feePolicyUrl || null,
      rows: 0,
      tuition_policy: tuitionPolicy,
    };

    console.log("[GENERIC_TUITION_ACCOUNT_POLICY_URL]", {
      source_url: feePolicyUrl,
      rows: 0,
      application_fee_rmb: 800,
      insurance_fee_rmb_per_year: 800,
      accommodation_fee_rmb_per_year: 9000,
    });
  }
} catch (e) {
  console.error("[GENERIC_TUITION_ACCOUNT_POLICY_URL_ERR]", e);
}
// ===== GENERIC_TUITION_ACCOUNT_POLICY_URL_END =====

  const parserNowBeforeGeneric = String((parsed as any)?.program_catalog_meta?.parser || "");

  const looksLikeProgramCatalog =
    (
      genericCatalogSignal.includes("招生专业") ||
      genericCatalogSignal.includes("专业目录") ||
      genericCatalogSignal.includes("专业列表") ||
      genericCatalogSignal.includes("Programs Available") ||
      genericCatalogSignal.includes("Programs") ||
      genericCatalogSignal.includes("Duration") ||
      genericCatalogSignal.includes("学制")
    ) &&
    (
      genericCatalogSignal.includes("学院") ||
      genericCatalogSignal.includes("School") ||
      genericCatalogSignal.includes("项目") ||
      genericCatalogSignal.includes("专业")
    );


  const looksLikeUndergradAdmissionBrochureBeforeGeneric =
    String(kind) === "ug" &&
    /本科生|undergraduate/i.test(String(raw_text || "")) &&
    /招生简章|ADMISSION\s+BOOK|admission/i.test(String(raw_text || "")) &&
    (
      /Program\s+List|CSCA\s+Required\s+subjects|English\s+taught\s+programs/i.test(String(raw_text || "")) ||
      /中文授课学费|英文授课学费|Chinese taught program tuition|English taught program tuition/i.test(String(raw_text || ""))
    );

  const shouldUseGenericCatalog =
    Array.isArray(nextCatalog) &&
    nextCatalog.length === 0 &&
    looksLikeProgramCatalog &&
    !looksLikeUndergradAdmissionBrochureBeforeGeneric &&
    parserNowBeforeGeneric !== "generic_tuition_account_policy_url_v1" &&
    !parserNowBeforeGeneric.includes("whu_") &&
    !parserNowBeforeGeneric.includes("ustc_") &&
    !parserNowBeforeGeneric.includes("nju_") &&
    !parserNowBeforeGeneric.includes("xjtu_");

  if (process.env.DEBUG_INGEST === "1") console.log("[GENERIC_PROGRAM_CATALOG_FORCE_CHECK]", {
    kind,
    rowsBefore: Array.isArray(nextCatalog) ? nextCatalog.length : -1,
    looksLikeProgramCatalog,
    shouldUseGenericCatalog,
    parserNowBeforeGeneric,
    filename: out?.filename || file?.name || filenameForm || null,
    rawPreview: String(raw_text || "").slice(0, 220),
  });

  if (shouldUseGenericCatalog) {
    const genericCatalog = parseGenericProgramCatalog(String(raw_text || ""), {
      kind,
      filename: out?.filename || file?.name || filenameForm || null,
      fallbackLanguage:
        String(out?.filename || file?.name || filenameForm || "").includes("英文授课")
          ? "en"
          : String(out?.filename || file?.name || filenameForm || "").includes("中文授课")
            ? "zh"
            : null,
    });

    if (genericCatalog.ok && Array.isArray(genericCatalog.rows) && genericCatalog.rows.length > 0) {
      nextCatalog.splice(0, nextCatalog.length, ...genericCatalog.rows);

      (parsed as any).program_catalog = genericCatalog.rows;
      (parsed as any).program_catalog_meta = {
        ...((parsed as any).program_catalog_meta || {}),
        ...genericCatalog.meta,
        source: "generic_file_parser",
      };

      if (process.env.DEBUG_INGEST === "1") console.log("[GENERIC_PROGRAM_CATALOG_FORCE]", {
        rows: genericCatalog.rows.length,
        meta: genericCatalog.meta,
        first: genericCatalog.rows[0] || null,
      });
    } else {
      console.log("[GENERIC_PROGRAM_CATALOG_FORCE_EMPTY]", {
        filename: out?.filename || file?.name || filenameForm || null,
        rows: Array.isArray(genericCatalog.rows) ? genericCatalog.rows.length : -1,
      });
    }
  }
} catch (e) {
  console.error("[GENERIC_PROGRAM_CATALOG_FORCE_ERR]", e);
}
// ===== GENERIC_PROGRAM_CATALOG_FORCE_END =====


// ===== GENERIC_CATALOG_BAD_ROW_FILTER_START =====
try {
  const parserNowForBadFilter = String((parsed as any)?.program_catalog_meta?.parser || "");
  const isGenericCatalogNow = parserNowForBadFilter === "generic_program_catalog_v1";

  if (isGenericCatalogNow && Array.isArray(nextCatalog) && nextCatalog.length > 0) {
    const before = nextCatalog.length;

    const cleaned = nextCatalog.filter((r: any) => {
      const faculty = String(r?.faculty_cn || "");
      const program = String(r?.program_name_cn || "");
      const raw = `${faculty} ${program}`;

      if (/部项目|授课语言|授予学位类型|学院项目|项目授课语言|学制授予学位/.test(raw)) return false;
      if (/^(医学学士|工学学士|文学学士|理学学士|管理学学士|经济学学士|法学学士|艺术学学士|哲学学士)$/.test(faculty)) return false;
      if (!String(r?.program_name_cn || r?.program_name_en || "").trim()) return false;
      if (!r?.duration_years) return false;

      return true;
    }).map((r: any, i: number) => ({ ...(r || {}), idx: i + 1 }));

    nextCatalog.splice(0, nextCatalog.length, ...cleaned);
    (parsed as any).program_catalog = cleaned;

    console.log("[GENERIC_CATALOG_BAD_ROW_FILTER]", {
      before,
      after: cleaned.length,
      removed: before - cleaned.length,
      first: cleaned[0] || null,
    });
  }
} catch (e) {
  console.error("[GENERIC_CATALOG_BAD_ROW_FILTER_ERR]", e);
}
// ===== GENERIC_CATALOG_BAD_ROW_FILTER_END =====


// ===== DEBUG_DUMP_XJTU_GRAD_RAW_TEXT_START =====
try {
  const debugName = String(out?.filename || file?.name || filenameForm || "");
  const debugRaw = String(raw_text || "");
  if (
    debugName.includes("硕博") ||
    debugName.includes("研究生") ||
    debugRaw.includes("博士") ||
    debugRaw.includes("硕士") ||
    debugRaw.includes("研究生")
  ) {
    const fs = await import("fs/promises");
    await fs.writeFile("/tmp/xjtu_grad_raw.txt", debugRaw, "utf8");
    if (process.env.DEBUG_INGEST === "1") console.log("[DEBUG_DUMP_XJTU_GRAD_RAW_TEXT]", {
      filename: debugName,
      kind,
      rawLen: debugRaw.length,
      path: "/tmp/xjtu_grad_raw.txt",
      preview: debugRaw.slice(0, 500),
    });
  }
} catch (e) {
  console.error("[DEBUG_DUMP_XJTU_GRAD_RAW_TEXT_ERR]", e);
}
// ===== DEBUG_DUMP_XJTU_GRAD_RAW_TEXT_END =====

// ===== SYSU_FOUNDATION_HTML_FORCE_START =====
try {
  const sysuFoundationRaw = String(raw_text || "");
  const sysuFoundationUrl = String(source_url || source_url_raw || "");
  const isSysuFoundationHtml =
    String(kind) === "foundation_bachelor" &&
    (
      sysuFoundationUrl.includes("/cn/fxlxm/1421639") ||
      sysuFoundationUrl.includes("1421639.htm") ||
      (
        sysuFoundationRaw.includes("中山大学2026年国际学生预科项目招生简章") &&
        sysuFoundationRaw.includes("30,400元/学年") &&
        sysuFoundationRaw.includes("15,200元/学期")
      )
    );

  if (isSysuFoundationHtml) {
    const cleanText = (v: any) =>
      String(v || "")
        .replace(/\u00a0/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    const sourceUrl = sysuFoundationUrl || "https://iso.sysu.edu.cn/cn/fxlxm/1421639.htm";

    const row: any = {
      idx: 1,
      kind: "foundation_bachelor",
      program_category: "foundation_bachelor",
      education_level: "foundation_bachelor",

      faculty_code: null,
      faculty_cn: "国际翻译学院",
      faculty_en: null,

      major_code: null,
      program_name_cn: "中山大学国际学生预科项目",
      program_name_en: "SYSU International Foundation Program",

      track_code: null,
      track_name_cn: null,
      track_name_en: null,

      degree_type: "非学历",
      degree_kind: "非学历",
      degree_name_cn: "预科项目",
      degree_name_en: "Foundation Program",

      study_language: "zh",
      language_text: "中文",

      campus_text: "珠海校区",
      duration_years: 1,
      study_mode: "全日制",

      tuition_rmb_per_year: 30400,
      tuition_rmb_per_semester: 15200,
      tuition_total_rmb: null,
      tuition_is_per_year: true,
      tuition_note: "学费：30,400元/学年；15,200元/学期。学费+住宿费：35,000元/学年；17,500元/学期。",

      accommodation_fee_rmb_per_year: 4600,
      accommodation_fee_note: "学费+住宿费为35,000元/学年，含双人间1位学生住宿费；住宿统一安排入住中山大学珠海校区荔园6号国际学生公寓。",

      application_time_text: "2026年申请，具体以官网页面为准",
      application_portal_text: "http://apply.sysu.edu.cn",

      apply_requirements_text: "非中国籍公民，持有效外国护照；具备高中毕业及以上学历证明，或同等学历证明；身心健康，品行端正。2026年9月1日前不满18周岁者需提交监护人保证书及公证件。",
      application_materials_text: "有效普通护照及个人照片；高中毕业及以上学历证明或同等学历证明；高中及以上学历或同等学历阶段完整课程成绩单；语言水平证明；学习计划；无犯罪记录证明；辅助证明材料。",
      language_requirements_text: "申请一学期制需提供HSK4级证书；预科项目包含HSK考试辅导、CSCA测试辅导等。",
      application_process_text: "在线申请；上传签名材料；资格审查；预录取；录取与报到。",
      admission_process_text: "入学时间为2026年9月，具体以录取通知书为准。",

      contact_phone: "+86 756 3668351; +86 756 3668001",
      contact_email: "sysuyk@mail.sysu.edu.cn",
      contact_raw: "电话：+86 756 3668351；+86 756 3668001；邮箱：sysuyk@mail.sysu.edu.cn；地址：广东省珠海市香洲区唐家湾大学路2号中山大学珠海校区海琴6号国际翻译学院。",

      source_url: sourceUrl,
      source_files: ["1421639.htm"],
      tags: ["预科", "非学历", "中文", "中山大学", "收费已填"],

      raw_line: "中山大学2026年国际学生预科项目招生简章",
      raw_block: cleanText(sysuFoundationRaw).slice(0, 6000),

      needs_review: false,
      review_flags: [],
    };

    nextCatalog.splice(0, nextCatalog.length, row);

    (parsed as any).program_catalog = [row];
    (parsed as any).program_catalog_meta = {
      ...((parsed as any).program_catalog_meta || {}),
      parser: "sysu_foundation_html_v1",
      doc_type: "sysu_foundation_html",
      kind: "foundation_bachelor",
      education_level: "foundation_bachelor",
      rows: 1,
      source_url: sourceUrl,
      sysu_foundation_parse_status: "complete",
      sysu_foundation_with_tuition: 1,
    };

    console.log("[SYSU_FOUNDATION_HTML_FORCE]", {
      kind,
      sourceUrl,
      rows: nextCatalog.length,
      first: nextCatalog[0] || null,
    });
  }
} catch (e) {
  console.error("[SYSU_FOUNDATION_HTML_FORCE_ERR]", e);
}
// ===== SYSU_FOUNDATION_HTML_FORCE_END =====





try {
  if (
    isLikelyTuitionPolicyOnlyPage({ rawText: raw_text, sourceUrl: source_url || source_url_raw || null, linkPurpose }) &&
    Array.isArray(nextCatalog) &&
    nextCatalog.length > 0
  ) {
    console.log("[TUITION_POLICY_ONLY_FORCE_EMPTY_NEXT_CATALOG_LATE]", {
      kind,
      linkPurpose,
      source_url: source_url || source_url_raw || null,
      before: nextCatalog.length,
      first: nextCatalog[0] || null,
    });

    nextCatalog.length = 0;
    (parsed as any).program_catalog = [];
  }
} catch (e) {
  console.error("[TUITION_POLICY_ONLY_FORCE_EMPTY_NEXT_CATALOG_LATE] failed:", e);
}




if (process.env.DEBUG_INGEST === "1") console.log("[UPLOAD_NEXT_CATALOG_DEBUG]", {
  kind,
  linkPurpose,
  content_type,
  doc_type: docClass?.doc_type,
  parser: program_catalog_meta?.parser,
  parsedCatalogLen: Array.isArray(parsed?.program_catalog)
    ? parsed.program_catalog.length
    : -1,
  nextCatalogLen: nextCatalog.length,
  prevCatalogLen: prevCatalog.length,
  firstNext: nextCatalog[0] || null,
});

// ===== NJU_MASTER_OFFICIAL_PDF_REPAIR_START =====
function repairNjuMasterRowsByOfficialPdf(rows: any[]) {
  const officialMap: Record<string, any[]> = {
    "030207": [
      {
        faculty_cn: "国际关系学院",
        program_name_cn: "国际政治",
        language_text: "中文",
        study_language: "zh",
        duration_years: 3,
      },
      {
        faculty_cn: "国际关系学院",
        program_name_cn: "国际关系",
        language_text: "中文",
        study_language: "zh",
        duration_years: 3,
      },
      {
        faculty_cn: "国际关系学院",
        program_name_cn: "国际关系（中国与全球事务）",
        language_text: "英文",
        study_language: "en",
        duration_years: 2,
      },
      {
        faculty_cn: "国际关系研究院",
        program_name_cn: "国际关系",
        language_text: "中文",
        study_language: "zh",
        duration_years: 3,
      },
    ],

    "030301": [
      {
        faculty_cn: "社会学院",
        program_name_cn: "社会学",
        language_text: "中文",
        study_language: "zh",
        duration_years: 3,
      },
      {
        faculty_cn: "社会学院",
        program_name_cn: "社会学（变迁中的中国社会）",
        language_text: "英文",
        study_language: "en",
        duration_years: 2,
      },
    ],

    "050301": [
      {
        faculty_cn: "新闻传播学院",
        program_name_cn: "新闻学",
        language_text: "中文",
        study_language: "zh",
        duration_years: 3,
      },
    ],

    "050302": [
      {
        faculty_cn: "新闻传播学院",
        program_name_cn: "传播学",
        language_text: "中文",
        study_language: "zh",
        duration_years: 3,
      },
    ],

    "055200": [
      {
        faculty_cn: "新闻传播学院",
        program_name_cn: "新闻与传播（中外学生同班）",
        language_text: "中文",
        study_language: "zh",
        duration_years: 3,
        tuition_rmb_per_year: 25000,
        tuition_is_per_year: true,
        training_mode_cn: "中外学生同班上课",
        teaching_mode_cn: "中外学生同班上课",
        remarks_text: "专业学位，中外学生同班上课。设有4个方向：新闻传播实务、国际传播、计算传播、数字营销传播。",
        tuition_note: "专业学位，中外学生同班上课，学费25000元/学年。设有4个方向：新闻传播实务、国际传播、计算传播、数字营销传播。",
      },
      {
        faculty_cn: "新闻传播学院",
        program_name_cn: "新闻与传播（国际学生班）",
        language_text: "中文",
        study_language: "zh",
        duration_years: 2,
        tuition_rmb_per_year: 30000,
        tuition_is_per_year: true,
        training_mode_cn: "国际学生单独授课",
        teaching_mode_cn: "国际学生单独授课",
        remarks_text: "专业学位，国际学生单独授课。",
        tuition_note: "专业学位，国际学生单独授课，学费30000元/学年。",
      },
    ],

    "1205Z1": [
      {
        faculty_cn: "信息管理学院",
        program_name_cn: "信息资源管理（信息管理与电子人文）",
        language_text: "英文",
        study_language: "en",
        duration_years: 2,
      },
      {
        faculty_cn: "信息管理学院",
        program_name_cn: "信息资源管理（信息管理与数据分析）",
        language_text: "英文",
        study_language: "en",
        duration_years: 2,
      },
    ],

    "080300": [
      {
        faculty_cn: "现代工程与应用科学学院",
        program_name_cn: "光学工程",
        language_text: "中文",
        study_language: "zh",
        duration_years: 3,
      },
    ],

    "080500": [
      {
        faculty_cn: "现代工程与应用科学学院",
        program_name_cn: "材料科学与工程",
        language_text: "中文",
        study_language: "zh",
        duration_years: 3,
      },
    ],

    "0805J1": [
      {
        faculty_cn: "现代工程与应用科学学院",
        program_name_cn: "健康工程",
        language_text: "中文",
        study_language: "zh",
        duration_years: 3,
      },
    ],

    "085400": [
      {
        faculty_cn: "现代工程与应用科学学院",
        program_name_cn: "电子信息",
        language_text: "中文",
        study_language: "zh",
        duration_years: 3,
      },
    ],

    "085600": [
      {
        faculty_cn: "现代工程与应用科学学院",
        program_name_cn: "材料与化工",
        language_text: "中文",
        study_language: "zh",
        duration_years: 3,
      },
    ],
  };

  function norm(s: any) {
    return String(s || "").replace(/\s+/g, "").trim();
  }

  function pickOfficial(row: any) {
    const code = String(row?.major_code || "").trim();
    const candidates = officialMap[code] || [];
    if (candidates.length === 0) return null;

    const name = norm(row?.program_name_cn);
    const lang = String(row?.study_language || row?.language_text || "").toLowerCase();
    const duration = Number(row?.duration_years);

    // 先按明显关键词匹配
    for (const c of candidates) {
      const cn = norm(c.program_name_cn);

      if (name && cn && (name.includes(cn) || cn.includes(name))) return c;

      if (name.includes("国际学生班") && cn.includes("国际学生班")) return c;
      if (name.includes("中外学生同班") && cn.includes("中外学生同班")) return c;
      if (name.includes("中国与全球") && cn.includes("中国与全球")) return c;
      if (name.includes("变迁中的中国") && cn.includes("变迁中的中国")) return c;
      if (name.includes("电子人文") && cn.includes("电子人文")) return c;
      if (name.includes("数据分析") && cn.includes("数据分析")) return c;
    }

    // 再按语言 + 学制匹配
    for (const c of candidates) {
      const cLang = String(c.study_language || c.language_text || "").toLowerCase();
      const cDuration = Number(c.duration_years);

      if (
        Number.isFinite(duration) &&
        duration === cDuration &&
        (
          !lang ||
          !cLang ||
          lang.includes(cLang) ||
          cLang.includes(lang) ||
          (lang.includes("英文") && cLang === "en") ||
          (lang.includes("英语") && cLang === "en") ||
          (lang.includes("中文") && cLang === "zh") ||
          (lang.includes("汉语") && cLang === "zh")
        )
      ) {
        return c;
      }
    }

    // 最后兜底：只有一个候选就直接修
    if (candidates.length === 1) return candidates[0];

    return null;
  }

  let repaired = 0;

  const next = (rows || []).map((row: any) => {
    const r = { ...(row || {}) };
    const official = pickOfficial(r);
    if (!official) return r;

    const beforeFaculty = String(r.faculty_cn || "").trim();
    const beforeName = String(r.program_name_cn || "").trim();

    // 只有疑似错位时才强修；055200 两条用官方学费也强修
    const suspicious =
      !beforeFaculty ||
      beforeName.includes(official.faculty_cn) ||
      beforeName === official.faculty_cn ||
      beforeName.includes("现代工程与应用科学学") ||
      beforeName.includes("中国与全球事") ||
      beforeName.includes("中国社社会学院会") ||
      beforeName.includes("信息管理学院");

    if (!suspicious && String(r.major_code || "") !== "055200") return r;

    Object.assign(r, official);

    r.needs_review = false;
    r.review_flags = Array.isArray(r.review_flags)
      ? r.review_flags.filter((x: any) => {
          const v = String(x || "");
          return !v.includes("missing_faculty") && !v.includes("loose_row_missing_faculty");
        })
      : [];

    r.tags = Array.isArray(r.tags) ? r.tags : [];
    if (!r.tags.includes("官方PDF纠错")) r.tags.push("官方PDF纠错");

    repaired++;
    return r;
  });

  console.log("[NJU_MASTER_OFFICIAL_PDF_REPAIR]", {
    rows: next.length,
    repaired,
    sample: next.filter((r: any) =>
      Array.isArray(r?.tags) && r.tags.includes("官方PDF纠错")
    ).slice(0, 8).map((r: any) => ({
      major_code: r.major_code,
      faculty_cn: r.faculty_cn,
      program_name_cn: r.program_name_cn,
      duration_years: r.duration_years,
      tuition_rmb_per_year: r.tuition_rmb_per_year,
    })),
  });

  return next;
}
// ===== NJU_MASTER_OFFICIAL_PDF_REPAIR_END =====


// ===== NJU_MASTER_HTML_TITLE_DETAIL_PARSE_START =====
function parseNjuMasterHtmlDetailByTitle(args: {
  rawText: any;
  sourceUrl?: string | null;
}) {
  const raw = String(args?.rawText || "");
  const sourceUrl = String(args?.sourceUrl || "").trim();

  function clean(s: any) {
    return String(s ?? "")
      .replace(/\u00a0/g, " ")
      .replace(/[ \t]+/g, " ")
      .trim();
  }

  function firstMatch(patterns: RegExp[]) {
    for (const re of patterns) {
      const m = raw.match(re);
      if (m) return m;
    }
    return null;
  }

  // 按页面 title / 主标题取：
  // 010100 哲学：国学研究
  const titleMatch = firstMatch([
    /(?:^|\n)\s*(\d{6})\s+([^\n：:]{1,40})[：:]\s*([^\n]{1,80})\s*(?:\n|$)/,
    /当前位置[\s\S]{0,500}?\n\s*(\d{6})\s+([^\n：:]{1,40})[：:]\s*([^\n]{1,80})\s*(?:\n|$)/,
  ]);

  if (!titleMatch) return null;

  const majorCode = clean(titleMatch[1]);
  const baseName = clean(titleMatch[2]);
  const trackName = clean(titleMatch[3]);

  if (!majorCode || !baseName || !trackName) return null;

  const programNameCn = `${baseName}（${trackName}）`;

  const facultyMap: Record<string, string> = {
    哲学: "哲学学院",
    国际关系: "国际关系学院",
    社会学: "社会学院",
    新闻与传播: "新闻传播学院",
    新闻学: "新闻传播学院",
    传播学: "新闻传播学院",
    信息资源管理: "信息管理学院",
  };

  let facultyCn =
    facultyMap[baseName] ||
    "";

  const facultyMatch = firstMatch([
    /南京大学([\u4e00-\u9fff]{2,30}学院)/,
    /([\u4e00-\u9fff]{2,30}学院)[\s\S]{0,40}(?:联系人|电话|邮箱|网址)/,
  ]);

  if (!facultyCn && facultyMatch) {
    facultyCn = clean(facultyMatch[1]);
  }

  // 授课语言
  let studyLanguage: "zh" | "en" | null = null;
  let languageText: string | null = null;

  if (/授课语言[：:\s]*中文|汉语授课|授课语言为中文/.test(raw)) {
    studyLanguage = "zh";
    languageText = "中文";
  } else if (/授课语言[：:\s]*英文|英语授课|授课语言为英文/.test(raw)) {
    studyLanguage = "en";
    languageText = "英文";
  }

  // 学制
  let durationYears: number | null = null;
  const durationMatch = firstMatch([
    /基本学制\s*([0-9一二三四五六七八九十]+)\s*年/,
    /学制[：:\s]*([0-9一二三四五六七八九十]+)\s*年/,
  ]);

  if (durationMatch) {
    const v = clean(durationMatch[1]);
    const cnNum: Record<string, number> = {
      一: 1,
      二: 2,
      三: 3,
      四: 4,
      五: 5,
      六: 6,
      七: 7,
      八: 8,
      九: 9,
      十: 10,
    };
    durationYears = Number(v);
    if (!Number.isFinite(durationYears)) durationYears = cnNum[v] || null;
  }

  // 学习方式
  let studyModeCn: string | null = null;
  if (/学习方式[：:\s]*全日制|学习方式为全日制/.test(raw)) {
    studyModeCn = "全日制";
  } else if (/非全日制/.test(raw)) {
    studyModeCn = "非全日制";
  }

  // 学费：25,000元人民币/学年
  let tuitionRmbPerYear: number | null = null;
  const tuitionMatch = firstMatch([
    /学费[\s\S]{0,80}?([0-9][0-9,]{3,})\s*元(?:人民币)?\s*\/\s*(?:学年|年)/,
    /([0-9][0-9,]{3,})\s*元(?:人民币)?\s*\/\s*(?:学年|年)/,
    /([0-9][0-9,]{3,})\s*RMB\s*\/\s*Year/i,
  ]);

  if (tuitionMatch) {
    tuitionRmbPerYear = Number(clean(tuitionMatch[1]).replace(/,/g, ""));
    if (!Number.isFinite(tuitionRmbPerYear)) tuitionRmbPerYear = null;
  }

  const emails = Array.from(
    new Set(raw.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []),
  );

  const phones = Array.from(
    new Set(
      (raw.match(/(?:\+?86[-\s]?)?0?\d{2,4}[-\s]?\d{6,8}/g) || [])
        .map((x) => clean(x))
        .filter(Boolean),
    ),
  );

  const contactPersonMatch = firstMatch([
    /联系人[：:\s]*([^\n；;，, ]{2,10})/,
    /咨询[：:\s]*([^\n；;，, ]{2,10})/,
  ]);

  const websiteMatch = firstMatch([
    /网址[：:\s]*(https?:\/\/[^\s，,；;]+)/i,
  ]);

  const contactParts = [
    facultyCn ? `南京大学${facultyCn}` : "",
    contactPersonMatch ? `联系人：${clean(contactPersonMatch[1])}` : "",
    phones.length ? `电话：${phones.join(" / ")}` : "",
    emails.length ? `电子邮箱：${emails.join(" / ")}` : "",
    websiteMatch ? `网址：${clean(websiteMatch[1])}` : "",
  ].filter(Boolean);

  const row: any = {
    idx: 1,
    kind: "master",
    major_code: majorCode,
    faculty_cn: facultyCn || null,
    program_name_cn: programNameCn,
    program_name_en: null,
    track_name_cn: trackName,
    track_name_en: null,
    degree_type: "硕士",
    study_language: studyLanguage,
    language_text: languageText,
    study_mode_cn: studyModeCn,
    duration_years: durationYears,
    tuition_rmb_per_year: tuitionRmbPerYear,
    tuition_total_rmb: null,
    tuition_is_per_year: tuitionRmbPerYear != null ? true : null,
    tuition_note:
      tuitionRmbPerYear != null
        ? `${programNameCn}项目学费：${tuitionRmbPerYear.toLocaleString("en-US")}元人民币/学年。`
        : null,
    tuition_source_url: sourceUrl || null,
    source_url: sourceUrl || null,
    contact_raw: contactParts.join("；") || null,
    remarks_text: /国际学生单独授课/.test(raw) ? "国际学生单独授课" : null,
    raw_line: `${majorCode} ${facultyCn || ""} ${programNameCn}`.trim(),
    raw_block: raw.slice(0, 3000),
    needs_review: false,
    review_flags: [],
    tags: ["硕士", languageText || "详情页", "NJU详情页title提取"].filter(Boolean),
  };

  console.log("[NJU_MASTER_HTML_TITLE_DETAIL_PARSE]", {
    sourceUrl,
    majorCode,
    baseName,
    trackName,
    programNameCn,
    facultyCn,
    durationYears,
    tuitionRmbPerYear,
    contact: row.contact_raw,
  });

  return row;
}
// ===== NJU_MASTER_HTML_TITLE_DETAIL_PARSE_END =====


// ===== NJU_MASTER_HTML_TITLE_DETAIL_FALLBACK_START =====
// For NJU master single-program HTML detail pages like:
// https://hwxy.nju.edu.cn/lxnd/zsxx/ssxm/gxyj/index.html
// run title-based parser even when htmlStrategy.shouldParseProgramDetail did not fire.
if (process.env.DEBUG_INGEST === "1") console.log("[NJU_MASTER_HTML_TITLE_DETAIL_FALLBACK_CHECK]", {
  kind,
  content_type,
  source_url,
  source_url_raw,
  urlText: String(source_url || source_url_raw || ""),
  rawPreview: String(raw_text || "").slice(0, 300),
  hasTitlePattern: /(?:^|\n)\s*(\d{6})\s+([^\n：:]{1,40})[：:]\s*([^\n]{1,80})\s*(?:\n|$)/.test(String(raw_text || "")),
});

if (
  kind === "master" &&
  String(source_url || source_url_raw || "").includes("hwxy.nju.edu.cn") &&
  String(source_url || source_url_raw || "").includes("/ssxm/")
) {
  try {
    const titleDetailRow = parseNjuMasterHtmlDetailByTitle({
      rawText: raw_text,
      sourceUrl: source_url || source_url_raw || null,
    });

    if (titleDetailRow) {
      forcedCatalogByDocClass = [
        {
          ...titleDetailRow,
          idx: 1,
          kind: "master",
        },
      ];

      forcedMetaByDocClass = {
        parser: "nju_master_html_title_detail_v1",
        doc_type: "nju_master_html_program_detail",
        rows: 1,
        source_url: source_url || source_url_raw || null,
        title_based: true,
      };

      console.log("[NJU_MASTER_HTML_TITLE_DETAIL_FALLBACK_FORCE]", {
        row: forcedCatalogByDocClass[0],
        meta: forcedMetaByDocClass,
      });
    }
  } catch (e) {
    console.error("[NJU_MASTER_HTML_TITLE_DETAIL_FALLBACK_ERR]", e);
  }
}
// ===== NJU_MASTER_HTML_TITLE_DETAIL_FALLBACK_END =====


// ===== NJU_MASTER_HTML_DETAIL_MERGE_INTO_CATALOG_START =====
function mergeNjuMasterHtmlDetailIntoCatalog(rows: any[], detailRows: any[]) {
  const detail = Array.isArray(detailRows) && detailRows.length > 0
    ? detailRows[0]
    : null;

  if (!detail) return rows;

  const majorCode = String(detail?.major_code || "").trim();
  const detailName = String(detail?.program_name_cn || "").trim();

  if (!majorCode && !detailName) return rows;

  let matched = false;

  const next = (rows || []).map((row: any) => {
    const r = { ...(row || {}) };

    const sameCode =
      majorCode &&
      String(r?.major_code || "").trim() === majorCode;

    const sameName =
      detailName &&
      String(r?.program_name_cn || "").trim() === detailName;

    const sameTrack =
      String(detail?.track_name_cn || "").trim() &&
      String(r?.program_name_cn || "").includes(
        String(detail?.track_name_cn || "").trim(),
      );

    if (!sameCode && !sameName && !sameTrack) return r;

    matched = true;

    return {
      ...r,
      ...detail,

      // 保留原目录序号和原始目录文本
      idx: r?.idx ?? detail?.idx,
      raw_line: r?.raw_line || detail?.raw_line || null,
      raw_block: r?.raw_block || detail?.raw_block || null,

      // 详情页是覆盖来源
      source_url: detail?.source_url || r?.source_url || null,
      tuition_source_url:
        detail?.tuition_source_url || detail?.source_url || r?.tuition_source_url || null,

      tags: Array.from(
        new Set([
          ...((Array.isArray(r?.tags) ? r.tags : []) as any[]),
          ...((Array.isArray(detail?.tags) ? detail.tags : []) as any[]),
          "详情页覆盖",
        ].filter(Boolean)),
      ),

      needs_review: false,
      review_flags: Array.isArray(r?.review_flags)
        ? r.review_flags.filter((x: any) => {
            const v = String(x || "");
            return !v.includes("tuition") && !v.includes("missing");
          })
        : [],
    };
  });

  const finalRows = matched
    ? next
    : [
        ...next,
        {
          ...detail,
          idx: next.length + 1,
          tags: Array.from(
            new Set([
              ...((Array.isArray(detail?.tags) ? detail.tags : []) as any[]),
              "详情页新增",
            ].filter(Boolean)),
          ),
        },
      ];

  console.log("[NJU_MASTER_HTML_DETAIL_MERGE_INTO_CATALOG]", {
    matched,
    rowsBefore: Array.isArray(rows) ? rows.length : -1,
    rowsAfter: finalRows.length,
    detail: {
      major_code: detail?.major_code,
      faculty_cn: detail?.faculty_cn,
      program_name_cn: detail?.program_name_cn,
      track_name_cn: detail?.track_name_cn,
      duration_years: detail?.duration_years,
      tuition_rmb_per_year: detail?.tuition_rmb_per_year,
      source_url: detail?.source_url,
    },
    mergedRow: finalRows.find((r: any) =>
      String(r?.major_code || "").trim() === majorCode &&
      (
        !detailName ||
        String(r?.program_name_cn || "").trim() === detailName
      )
    ) || null,
  });

  return finalRows;
}
// ===== NJU_MASTER_HTML_DETAIL_MERGE_INTO_CATALOG_END =====


// ===== NJU_PHD_APPLY_GUIDE_PATCH_START =====
function applyNjuPhdApplyGuideToCatalog(args: {
  rows: any[];
  rawText: any;
  sourceUrl?: string | null;
}) {
  const rows = Array.isArray(args.rows) ? args.rows : [];
  const raw = String(args.rawText || "");
  const sourceUrl = String(args.sourceUrl || "").trim();

  const isNjuPhdApplyGuide =
    sourceUrl.includes("hwxy.nju.edu.cn") &&
    sourceUrl.includes("/bsxm/sbzn/");

  if (!isNjuPhdApplyGuide || rows.length === 0) return rows;

  const applyRequirementsText =
    "非中国籍公民，身体健康，年龄一般不超过40岁；具有与中国大学硕士学位相当的学位；语言要求：理科 HSK 4级180分以上，文科 HSK 5级180分以上。毕业要求：理科 HSK 5级180分以上，文科 HSK 6级180分以上。";

  const applicationTimeText = "3月1日至5月20日";

  const applicationMaterialsText =
    "外国人体格检查表；硕士毕业证书或学位证书，应届毕业生可提供预毕业证明；硕士全部课程成绩单；两封副教授以上职称教师推荐信；HSK证书；个人陈述；硕士毕业论文摘要；护照首页；华裔申请者身份证明材料；申请建筑与城市规划学院者需提交作品集；非中文或英文文件需附公证或发证单位的中文或英文翻译件。";

  const admissionProcessText =
    "提交申请后，3个工作日内收到初审反馈；4至5月通过初审的材料分批转至相关专业院系复审，部分专业可能安排远程笔试、面试；通常5至6月分批通知录取结果。";

  const contactRaw =
    "南京大学海外教育学院；通讯地址：中国江苏省南京市鼓楼区金银街18号曾宪梓楼514办公室；邮政编码：210008；电话：+86-25-83594535；传真：+86-25-83316747；联系人：钟老师；电子邮箱：zqr@nju.edu.cn；网址：http://hwxy.nju.edu.cn/";

  const next = rows.map((row: any) => {
    const r = { ...(row || {}) };

    return {
      ...r,
      kind: r.kind || "phd",
      degree_type: r.degree_type || "博士",
      duration_years: r.duration_years || 4,

      apply_requirements_text: applyRequirementsText,
      application_time_text: applicationTimeText,
      application_materials_text: applicationMaterialsText,
      admission_process_text: admissionProcessText,

      apply_guide_source_url: sourceUrl || r.apply_guide_source_url || null,
      source_url: r.source_url || sourceUrl || null,

      contact_raw: r.contact_raw || contactRaw,

      tags: Array.from(
        new Set([
          ...((Array.isArray(r.tags) ? r.tags : []) as any[]),
          "博士",
          "申请指南已补",
        ].filter(Boolean)),
      ),
    };
  });

  console.log("[NJU_PHD_APPLY_GUIDE_PATCH]", {
    rows: next.length,
    sourceUrl,
    first: next[0] || null,
    hasRaw: raw.length > 0,
  });

  return next;
}
// ===== NJU_PHD_APPLY_GUIDE_PATCH_END =====


// ===== NJU_GENERAL_TUITION_HTML_PATCH_START =====
function applyNjuGeneralTuitionHtmlToCatalog(args: {
  rows: any[];
  kind: any;
  sourceUrl?: string | null;
}) {
  const rows = Array.isArray(args.rows) ? args.rows : [];
  const kind = String(args.kind || "").trim();
  const sourceUrl = String(args.sourceUrl || "").trim();

  const isNjuGeneralTuition =
    sourceUrl.includes("cms.nju.edu.cn/hwxy/lxnd/xygl/xxfy/xf/") ||
    sourceUrl.includes("hwxy.nju.edu.cn/lxnd/xygl/xxfy/xf/");

  if (!isNjuGeneralTuition || rows.length === 0) return rows;

  const rulesByKind: Record<string, Record<string, number>> = {
    ug: {
      "文科": 21000,
      "理科": 24000,
      "商科": 24000,
      "理商科": 24000,
      "医学": 42000,
      "医科": 42000,
    },
    master: {
      "文科": 25000,
      "理科": 28000,
      "商科": 28000,
      "理商科": 28000,
      "医学": 48000,
      "医科": 48000,
    },
    phd: {
      "文科": 30000,
      "理科": 35000,
      "商科": 35000,
      "理商科": 35000,
      "医学": 54000,
      "医科": 54000,
    },
  };

  function inferGroup(row: any) {
    const explicit = String(row?.tuition_group || "").trim();
    if (explicit) return explicit;

    const text = [
      row?.faculty_cn,
      row?.program_name_cn,
      row?.remarks_text,
      row?.raw_line,
      row?.raw_block,
    ].map((x) => String(x || "")).join(" ");

    if (/医学院|医学|临床|口腔|护理|药学|公共卫生|卫生/.test(text)) return "医学";
    if (/商学院|工商管理|会计|金融|经济|管理/.test(text)) return "商科";
    if (/数学|物理|化学|工程|计算机|软件|电子|人工智能|环境|地球|地理|大气|生命|材料|建筑|城乡规划|信息|数据/.test(text)) return "理科";

    return "文科";
  }

  const rules = rulesByKind[kind] || {};
  let filled = 0;
  let kept = 0;

  const next = rows.map((row: any) => {
    const r = { ...(row || {}) };

    // 已经由详情页/项目页/人工 override 填过的学费，不覆盖
    if (r.tuition_rmb_per_year != null || r.tuition_total_rmb != null) {
      kept++;
      return r;
    }

    const group = inferGroup(r);
    const fee = rules[group] || rules[group === "医学" ? "医科" : group];

    if (!fee) {
      kept++;
      return r;
    }

    filled++;

    const degreeLabel =
      kind === "ug" ? "本科" :
      kind === "master" ? "硕士" :
      kind === "phd" ? "博士" :
      "长期生";

    return {
      ...r,
      tuition_group: group,
      tuition_rmb_per_year: fee,
      tuition_total_rmb: null,
      tuition_is_per_year: true,
      tuition_note: `南京大学${degreeLabel}${group}长期生学费：${fee.toLocaleString("en-US")} RMB/academic year。英文授课项目、中文特色项目以具体项目招生简章为准。`,
      tuition_source_url: sourceUrl || r.tuition_source_url || null,
      tags: Array.from(
        new Set([
          ...((Array.isArray(r.tags) ? r.tags : []) as any[]),
          "通用学费已填",
          "有收费来源",
        ].filter(Boolean)),
      ),
    };
  });

  console.log("[NJU_GENERAL_TUITION_HTML_PATCH]", {
    kind,
    rows: next.length,
    filled,
    kept,
    sourceUrl,
    firstWithTuition: next.find((r: any) => r?.tuition_rmb_per_year != null) || null,
  });

  return next;
}
// ===== NJU_GENERAL_TUITION_HTML_PATCH_END =====


// ===== NJU_PHD_ROW_REPAIR_START =====
function repairNjuPhdRows(rows: any[]) {
  let repaired050211 = 0;
  let repairedLanguage = 0;

  const next = (Array.isArray(rows) ? rows : []).map((row: any) => {
    const r = { ...(row || {}) };

    const code = String(r.major_code || "").trim().padStart(6, "0");
    const raw = String(r.raw_line || r.raw_block || r.remarks || "").trim();
    const name = String(r.program_name_cn || "").trim();

    if (code === "050211" && name === "外国语学院") {
      r.major_code = "050211";
      r.faculty_cn = "外国语学院";
      r.program_name_cn = "外国语言学及应用语言学";
      r.degree_type = r.degree_type || "博士";
      r.language_text = "中文";
      r.study_language = "zh";
      r.duration_years = r.duration_years || 4;
      r.study_mode_cn = r.study_mode_cn || "全日制";
      r.tuition_group = r.tuition_group || "文科";
      r.tuition_rmb_per_year = r.tuition_rmb_per_year ?? 30000;
      r.tuition_is_per_year = true;
      r.needs_review = false;
      r.review_flags = Array.isArray(r.review_flags)
        ? r.review_flags.filter((x: any) => {
            const v = String(x || "");
            return !v.includes("missing_faculty") && !v.includes("loose_row");
          })
        : [];
      r.tags = Array.from(
        new Set([
          ...((Array.isArray(r.tags) ? r.tags : []) as any[]),
          "博士",
          "NJU博士行修复",
        ].filter(Boolean)),
      );
      repaired050211++;
    }

    if ((!r.language_text || !r.study_language) && /汉语/.test(raw)) {
      r.language_text = "中文";
      r.study_language = "zh";
      repairedLanguage++;
    }

    if (!r.duration_years) {
      const m = raw.match(/(?:汉语|英语|英文|中文)\s*([2345])(?:\s|$)/);
      if (m) r.duration_years = Number(m[1]);
    }

    return r;
  });

  console.log("[NJU_PHD_ROW_REPAIR]", {
    rows: next.length,
    repaired050211,
    repairedLanguage,
    sample050211: next.find((r: any) => String(r?.major_code || "").padStart(6, "0") === "050211") || null,
  });

  return next;
}
// ===== NJU_PHD_ROW_REPAIR_END =====


// ===== NJU_APPLICATION_FEE_HTML_PATCH_START =====
function applyNjuApplicationFeeHtmlToCatalog(args: {
  rows: any[];
  sourceUrl?: string | null;
}) {
  const rows = Array.isArray(args.rows) ? args.rows : [];
  const sourceUrl = String(args.sourceUrl || "").trim();

  const isNjuApplicationFee =
    sourceUrl.includes("hwxy.nju.edu.cn/lxnd/xygl/xxfy/sqf/") ||
    sourceUrl.includes("cms.nju.edu.cn/hwxy/lxnd/xygl/xxfy/sqf/");

  if (!isNjuApplicationFee || rows.length === 0) return rows;

  const applicationFeeRmb = 600;
  const applicationFeeNote = "申请费：600元人民币，不退。";
  const insuranceFeeRmbPerSemester = 400;
  const insuranceFeeNote = "保险费：400元人民币/学期。";

  const next = rows.map((row: any) => {
    const r = { ...(row || {}) };

    return {
      ...r,
      application_fee_rmb: r.application_fee_rmb ?? applicationFeeRmb,
      application_fee_note: r.application_fee_note || applicationFeeNote,
      application_fee_source_url:
        r.application_fee_source_url || sourceUrl || null,
      tags: Array.from(
        new Set([
          ...((Array.isArray(r.tags) ? r.tags : []) as any[]),
          "申请费已填",
        ].filter(Boolean)),
      ),
    };
  });

  console.log("[NJU_APPLICATION_FEE_HTML_PATCH]", {
    rows: next.length,
    sourceUrl,
    applicationFeeRmb,
    insuranceFeeRmbPerSemester,
    first: next[0] || null,
  });

  return next;
}
// ===== NJU_APPLICATION_FEE_HTML_PATCH_END =====


// ===== USTC_UG_APPLY_GUIDE_PATCH_START =====
function applyUstcUgApplyGuideToCatalog(args: {
  rows: any[];
  sourceUrl?: string | null;
}) {
  const rows = Array.isArray(args.rows) ? args.rows : [];
  const sourceUrl = String(args.sourceUrl || "").trim();

  if (rows.length === 0) return rows;

  const applyRequirementsText =
    "非中国公民，持有效护照，身心健康，取得高中毕业证书；须通过新HSK 5级或以上级别考试，母语为中文或能证明高中教学语言为中文者可申请HSK免试；本科项目申请者须具有高中毕业证书，应届生可提交预毕业证明。";

  const applicationTimeText =
    "在线申请时间：2025年11月14日至2026年3月31日；学校考核：4月或5月；录取：6月或7月。";

  const cscaSubjectsText =
    "必考：理科中文、数学；选考：物理、化学任选一门。";

  const applicationMaterialsText =
    "本科申请表；护照复印件；经公证的高中毕业证书和成绩单或预毕业证明；新HSK 5级证书和成绩单或中文授课证明；外国人体格检查表；高中推荐信；未满18周岁申请者提交监护人声明；原中国大陆、香港、澳门、台湾居民移民海外者提交移民证明、退出中国国籍证书、2022年4月30日至2026年4月30日期间出入境护照页复印件和国外居住证明；申请者若出生在外国且父母双方或一方为中国公民，需提交相应身份证明材料；SAT、IB、GCE A-Level、ACT、AST等国际考试成绩可作为学校考核参考。";

  const admissionProcessText =
    "申请者需参加CSCA测试并在在线申请时提交成绩；在线申请材料审核通过后，学校将根据CSCA成绩和申请材料综合确定是否需加试及面试；学校综合评估学业表现、面试成绩、资质证书及其他相关材料后给出录取结果。";

  const tuitionFee = 26000;
  const tuitionNote =
    "中国科学技术大学本科国际学生学费：26000元人民币/学年。";

  const insuranceFee = 800;
  const insuranceNote =
    "保险费：800元人民币/学年。";

  const housingFeeNote =
    "校内住宿费：根据房间类型和大小，500-1000元人民币/月。";

  const scholarshipNote =
    "优秀申请者可以申请中国科学技术大学奖学金，包括学费、保险费、每月助学金2500元人民币和住宿补贴；也可通过当地中国大使馆或领事馆申请中国政府奖学金。";

  const next = rows.map((row: any) => {
    const r = { ...(row || {}) };

    return {
      ...r,
      kind: r.kind || "ug",
      degree_type: r.degree_type || "本科",
      duration_years: r.duration_years || 4,

      apply_requirements_text: applyRequirementsText,
      application_time_text: applicationTimeText,
      application_materials_text: applicationMaterialsText,
      admission_process_text: admissionProcessText,
      csca_subjects_text:
        r.csca_subjects_text || cscaSubjectsText,

      tuition_rmb_per_year:
        r.tuition_rmb_per_year ?? tuitionFee,
      tuition_is_per_year:
        r.tuition_is_per_year ?? true,
      tuition_note:
        r.tuition_note || tuitionNote,
      tuition_source_url:
        r.tuition_source_url || sourceUrl || null,

      insurance_fee_rmb_per_year:
        r.insurance_fee_rmb_per_year ?? insuranceFee,
      insurance_fee_note:
        r.insurance_fee_note || insuranceNote,
      insurance_fee_source_url:
        r.insurance_fee_source_url || sourceUrl || null,

      housing_fee_note:
        r.housing_fee_note || housingFeeNote,
      scholarship_note:
        r.scholarship_note || scholarshipNote,

      apply_guide_source_url:
        r.apply_guide_source_url || sourceUrl || null,

      tags: Array.from(
        new Set([
          ...((Array.isArray(r.tags) ? r.tags : []) as any[]),
          "本科",
          "申请指南已补",
          "USTC",
        ].filter(Boolean)),
      ),
    };
  });

  console.log("[USTC_UG_APPLY_GUIDE_PATCH]", {
    rows: next.length,
    sourceUrl,
    first: next[0] || null,
  });

  return next;
}
// ===== USTC_UG_APPLY_GUIDE_PATCH_END =====


// ===== USTC_GRAD_APPLY_SCHOLARSHIP_PATCH_START =====
function applyUstcGradApplyScholarshipToCatalog(args: {
  rows: any[];
  kind: string;
  sourceUrl?: string | null;
}) {
  const rows = Array.isArray(args.rows) ? args.rows : [];
  const kind = String(args.kind || "").toLowerCase();
  const sourceUrl = String(args.sourceUrl || "").trim();

  if (rows.length === 0) return rows;
  if (kind !== "master" && kind !== "phd") return rows;

  const degreeType = kind === "phd" ? "博士" : "硕士";

  const applyRequirementsText =
    kind === "phd"
      ? "申请者必须是持有效护照的非中国公民，身心健康；博士项目申请者须具有与中国硕士学位相当的学位；应届生可提交预毕业证明，以确认在2026年7月之前完成学习并获得学位；在2026年9月1日前博士项目申请者应未满45岁；中文授课项目应通过新HSK 4级或以上级别考试，符合条件者可申请HSK免试；英文授课项目需提供英语水平证明。"
      : "申请者必须是持有效护照的非中国公民，身心健康；硕士项目申请者须具有与中国学士学位相当的学位；应届生可提交预毕业证明，以确认在2026年7月之前完成学习并获得学位；在2026年9月1日前硕士项目申请者应未满40岁；中文授课项目应通过新HSK 4级或以上级别考试，符合条件者可申请HSK免试；英文授课项目需提供英语水平证明。";

  const applicationTimeText =
    "在线申请时间：2025年10月16日至2026年1月31日；在线考核：2月或3月；录取：6月或7月。";

  const applicationMaterialsText =
    "护照复印件；研究计划书（不少于1000字）；简历；教授或副教授出具的两封推荐信；外国人体格检查表；中文授课项目需提供HSK 4级或以上证书或其他中文水平证明，英文授课项目需提供有效雅思、托福成绩或其他英语水平证明；经认证的学位证书和成绩单；应届生、未获学位证书者或在职人员需提交相应证明。非中文或英文材料须提供经公证的中文或英文译文。";

  const admissionProcessText =
    "申请环节无需联系导师。国际学院将申请材料发送给相关院系，院系组织面试考核；教授根据申请材料及面试表现选择意向学生。所有学院均有线上面试，部分学院除线上面试外还有线上笔试；相关通知将通过邮件发送给申请人。";

  const applicationPortalText =
    "申请者须在网申系统中创建账户，填写所有信息并按要求上传文件；建议尽早完成申请，以便学校审核并及时提醒更正或补充材料。";

  const tuitionFee = kind === "phd" ? 35000 : 30000;
  const tuitionNote =
    kind === "phd"
      ? "中国科学技术大学博士项目学费：35,000 RMB/academic year。"
      : "中国科学技术大学硕士项目学费：30,000 RMB/academic year；管理学院MBA项目学费为150,000 RMB/student。";

  const insuranceFee = 800;
  const insuranceNote = "保险费：800 RMB/academic year。";

  const housingFeeNote =
    "校内住宿费根据房间类型和大小不同，每月500-1000 RMB。";

  const scholarshipNote =
    kind === "phd"
      ? "优秀申请者可申请USTC Fellowship，覆盖学费、保险费、月助学金（博士最高7,000 RMB/月）和住宿补贴；申请者也可通过网申系统申请，或通过当地中国大使馆/领事馆申请中国政府奖学金。"
      : "优秀申请者可申请USTC Fellowship，覆盖学费、保险费、月助学金（硕士最高3,000 RMB/月）和住宿补贴；申请者也可通过网申系统申请，或通过当地中国大使馆/领事馆申请中国政府奖学金。";

  const scholarshipUrl =
    kind === "phd"
      ? "https://ic.ustc.edu.cn/en/v7info.php?Nav_x=15"
      : "https://ic.ustc.edu.cn/en/v7info.php?Nav_x=16";

  const next = rows.map((row: any) => {
    const r = { ...(row || {}) };
    const mbaSignal = [
      r.program_name_cn,
      r.program_name_en,
      r.track_name_cn,
      r.track_name_en,
      r.faculty_cn,
      r.faculty_en,
      r.raw_line,
      r.raw_block,
    ].map((x: any) => String(x || "")).join(" ");

    const isMba =
      kind === "master" &&
      (
        /MBA/i.test(mbaSignal) ||
        /business administration/i.test(mbaSignal) ||
        /工商管理/.test(mbaSignal) ||
        /管理学院/.test(mbaSignal)
      );

    return {
      ...r,
      kind: r.kind || kind,
      degree_type: r.degree_type || degreeType,

      apply_requirements_text: applyRequirementsText,
      application_time_text: applicationTimeText,
      application_materials_text: applicationMaterialsText,
      admission_process_text: admissionProcessText,
      application_portal_text: applicationPortalText,

      tuition_rmb_per_year:
        r.tuition_rmb_per_year ?? (isMba ? null : tuitionFee),
      tuition_total_rmb:
        r.tuition_total_rmb ?? (isMba ? 150000 : null),
      tuition_is_per_year:
        r.tuition_is_per_year ?? (isMba ? false : true),
      tuition_note:
        r.tuition_note || (isMba ? "中国科学技术大学管理学院MBA项目学费：150,000 RMB/student。" : tuitionNote),
      tuition_source_url:
        r.tuition_source_url || sourceUrl || null,

      insurance_fee_rmb_per_year:
        r.insurance_fee_rmb_per_year ?? insuranceFee,
      insurance_fee_note:
        r.insurance_fee_note || insuranceNote,
      insurance_fee_source_url:
        r.insurance_fee_source_url || sourceUrl || null,

      housing_fee_note:
        r.housing_fee_note || housingFeeNote,

      scholarship_note:
        r.scholarship_note || scholarshipNote,
      scholarship_source_url:
        r.scholarship_source_url || sourceUrl || scholarshipUrl,

      apply_guide_source_url:
        r.apply_guide_source_url || sourceUrl || null,

      tags: Array.from(
        new Set([
          ...((Array.isArray(r.tags) ? r.tags : []) as any[]),
          degreeType,
          "申请指南已补",
          "奖学金已补",
          "USTC",
        ].filter(Boolean)),
      ),
    };
  });

  console.log("[USTC_GRAD_APPLY_SCHOLARSHIP_PATCH]", {
    kind,
    rows: next.length,
    sourceUrl,
    first: next[0] || null,
  });

  return next;
}
// ===== USTC_GRAD_APPLY_SCHOLARSHIP_PATCH_END =====


// ===== USTC_NON_DEGREE_RESEARCH_INTERNSHIP_PATCH_START =====
function buildUstcResearchInternshipCatalog(args: {
  sourceUrl?: string | null;
}) {
  const sourceUrl = String(args.sourceUrl || "").trim() || "https://ic.ustc.edu.cn/v7info.php?Nav_x=51";

  const row = {
    idx: 1,
    kind: "other",
    degree_type: "非学位",
    degree_kind: "非学位项目",

    faculty_cn: "国际学院",
    faculty_en: "International College",

    major_code: null,
    program_name_cn: "科研实习",
    program_name_en: "Research Internship",
    track_name_cn: null,
    track_name_en: null,

    language_text: "英文",
    study_language: "en",
    study_mode_cn: "线下科研实习",

    target_students_text:
      "本科高年级、硕士、博士国际学生。",
    duration_text:
      "至少3个月，最长1年。",
    intake_time_text:
      "春季学期、秋季学期均可；具体到校时间根据实习安排确定。",

    apply_requirements_text:
      "持有效外国护照的非中国籍公民；年龄18至40岁；身心健康；本科三年级、四年级在读生或硕士、博士在读生；具备良好的英语水平。",

    application_time_text:
      "申请中科大A级奖学金者：秋季学期1月1日至3月31日，春季学期7月1日至9月30日；申请B级、C级奖学金或自费者，应在计划来校实习日期前至少3个月完成在线申请。",

    admission_process_text:
      "申请者在线提交材料后，由学校和相关院系审核；通过审核后按科研实习安排办理录取及来校手续。",

    application_portal_text:
      "在网申系统注册账号，选择“非学位项目 -> 科研实习”，填写申请表并上传材料，带星号字段为必填项。",

    tuition_rmb_per_year: null,
    tuition_total_rmb: null,
    tuition_is_per_year: null,
    tuition_note:
      "本科/硕士层次：2160元/月，13000元/半年，26000元/年；博士层次：2660元/月，16000元/半年，32000元/年。",

    insurance_fee_rmb_per_month: 160,
    insurance_fee_note:
      "保险费：160元/月。",

    housing_fee_note:
      "国际学生宿舍：500-1000元/月，具体取决于房间类型和大小。",

    scholarship_note:
      "中国科学技术大学奖学金：A级免学费、免综合医疗保险费、免学生宿舍费，并提供补贴：本科在读生2500元/月、硕士在读生3000元/月、博士在读生3500元/月；B级免学费、免综合医疗保险费、免学生宿舍费；C级免学费。",

    contact_raw:
      "中国安徽省合肥市金寨路96号，中国科学技术大学东校区国际学院，冉懿老师；电话：+86-551-63602848；邮箱：visiting@ustc.edu.cn。",

    source_url: sourceUrl,
    apply_guide_source_url: sourceUrl,
    scholarship_source_url: sourceUrl,
    tuition_source_url: sourceUrl,
    insurance_fee_source_url: sourceUrl,

    remarks_text:
      "非学位项目，不应合并到本科、硕士或博士学位项目目录。",

    raw_line:
      "Research Internship / 科研实习 / Non-degree Program",
    raw_block:
      "Research Internship / 科研实习 / Non-degree Program",

    tags: [
      "非学位",
      "科研实习",
      "USTC",
      "申请指南已补",
      "奖学金已补",
      "收费已填",
    ],
  };

  console.log("[USTC_NON_DEGREE_RESEARCH_INTERNSHIP_PATCH]", {
    sourceUrl,
    row,
  });

  return {
    rows: [row],
    meta: {
      parser: "ustc_research_internship_html_v1",
      doc_type: "ustc_non_degree_research_internship",
      rows: 1,
      kind: "other",
      source_url: sourceUrl,
      title: "中国科学技术大学科研实习项目",
      note: "Generated from USTC Nav_x=51 Research Internship page.",
    },
  };
}
// ===== USTC_NON_DEGREE_RESEARCH_INTERNSHIP_PATCH_END =====


// ===== USTC_UG_SCHOLARSHIP_PATCH_START =====
function applyUstcUgScholarshipToCatalog(args: {
  rows: any[];
  sourceUrl?: string | null;
}) {
  const rows = Array.isArray(args.rows) ? args.rows : [];
  const sourceUrl =
    String(args.sourceUrl || "").trim() ||
    "https://ic.ustc.edu.cn/v7info.php?Nav_x=17";

  if (rows.length === 0) return rows;

  const scholarshipNote =
    "中国科学技术大学本科留学项目奖学金分为两个等级：一等奖学金包含学费、综合医疗保险、每月2500元人民币助学金和住宿补贴；二等奖学金包含学费。申请者可在中国科大申请系统中选择申请奖学金等级，学校根据综合水平决定授予等级，每位申请者最终只能获得一项奖学金。";

  const scholarshipApplyRequirementsText =
    "本科奖学金申请者须为持有效护照的非中国公民，身心健康；应通过新HSK 5级或以上，母语为中文或能证明高中教学语言为中文者可申请HSK免试；应在2026年7月前取得与中国高中文凭相当的高中文凭；2026年9月1日前未满30岁；已获得2026-2027学年其他中国奖学金资助者不能申请该奖学金。来自中国大陆、香港、澳门和台湾地区移民海外者，或出生在外国且父母双方或一方为中国公民者，须符合教育部相关身份及居住要求。";

  const scholarshipApplicationTimeText =
    "本科奖学金申请时间：2025年11月14日至2026年3月31日。";

  const scholarshipApplicationGuideText =
    "申请者须在中国科大网申系统中创建账户，填写所有信息并按要求上传文件；申请时选择拟申请的奖学金等级。请注意查看注册邮箱，以便及时获知补交材料、在线面试等通知。";

  const next = rows.map((row: any) => {
    const r = { ...(row || {}) };

    return {
      ...r,
      scholarship_note: scholarshipNote,
      scholarship_source_url: sourceUrl,
      scholarship_apply_requirements_text: scholarshipApplyRequirementsText,
      scholarship_application_time_text: scholarshipApplicationTimeText,
      scholarship_application_guide_text: scholarshipApplicationGuideText,
      scholarship_stipend_rmb_per_month: 2500,
      scholarship_coverage_text:
        "一等奖学金：学费、综合医疗保险、每月2500元人民币助学金、住宿补贴；二等奖学金：学费。",

      tags: Array.from(
        new Set([
          ...((Array.isArray(r.tags) ? r.tags : []) as any[]),
          "本科",
          "奖学金已补",
          "USTC",
        ].filter(Boolean)),
      ),
    };
  });

  console.log("[USTC_UG_SCHOLARSHIP_PATCH]", {
    rows: next.length,
    sourceUrl,
    first: next[0] || null,
  });

  return next;
}
// ===== USTC_UG_SCHOLARSHIP_PATCH_END =====


// ===== USTC_DEGREE_SPECIFIC_SCHOLARSHIP_PATCH_START =====
function applyUstcDegreeSpecificScholarshipToCatalog(args: {
  rows: any[];
  kind: string;
  sourceUrl?: string | null;
}) {
  const rows = Array.isArray(args.rows) ? args.rows : [];
  const kind = String(args.kind || "").toLowerCase();
  const sourceUrl = String(args.sourceUrl || "").trim();

  if (rows.length === 0) return rows;

  let scholarshipNote = "";
  let scholarshipApplyRequirementsText = "";
  let scholarshipApplicationTimeText = "";
  let scholarshipApplicationGuideText = "";
  let scholarshipCoverageText = "";
  let stipendMaster: number | null = null;
  let stipendPhdFirst: number | null = null;
  let stipendPhdSecond: number | null = null;

  if (kind === "master") {
    scholarshipNote =
      "中国科学技术大学硕士留学项目奖学金分为两个等级：一等奖学金由中国教育部、中国科学院或中国科学技术大学提供，包含学费、综合医疗保险、每月3000元人民币助学金和住宿补贴；二等奖学金由中国科学技术大学提供，包含学费，入学后可申请助教/助研补贴。每位申请者最终只能获得一项奖学金。";
    scholarshipApplyRequirementsText =
      "硕士奖学金申请者须为持有效护照的非中国公民，身心健康；须具有与中国学士学位相当的学位；应届生可提交预毕业证明；2026年9月1日前应未满35岁；中文授课硕士项目应通过新HSK 4级或以上，符合条件者可申请HSK免试；英文授课硕士项目需提供英语水平证明；申请者应符合中国科学技术大学国际学生录取标准；获得奖学金资助期间不得在其他机构学习或工作。";
    scholarshipApplicationTimeText =
      "硕士奖学金申请时间：2025年10月16日至2026年1月31日。";
    scholarshipApplicationGuideText =
      "申请者须在中国科大网申系统创建账户，填写信息并上传材料；请注意查看注册邮箱，以便及时获知补交材料、在线考核等通知。申请环节无需联系导师，国际学院会将申请材料发送给负责在线考核的院系。";
    scholarshipCoverageText =
      "一等奖学金：学费、综合医疗保险、每月3000元人民币助学金、住宿补贴；二等奖学金：学费，入学后可申请助教/助研补贴。";
    stipendMaster = 3000;
  }

  if (kind === "phd") {
    scholarshipNote =
      "中国科学技术大学博士留学项目奖学金分为三个等级：一等奖学金由中国科学院CAS-ANSO奖学金提供，包含学费、综合医疗保险和每月最高7000元人民币助学金；二等奖学金由中国教育部或中国科学技术大学提供，包含学费、综合医疗保险、每月3500元人民币助学金和住宿补贴；三等奖学金由中国科学技术大学提供，包含学费，入学后可申请助教/助研补贴。每位申请者最终只能获得一项奖学金。";
    scholarshipApplyRequirementsText =
      "博士奖学金申请者须为持有效护照的非中国公民，身心健康；须具有与中国硕士学位相当的学位；应届生可提交预毕业证明；2026年9月1日前，博士一等奖学金申请者应未满35岁，博士二等、三等奖学金申请者应未满40岁；中文授课项目应通过新HSK 4级或以上，符合条件者可申请HSK免试；英文授课项目需提供英语水平证明；申请者应符合中国科学技术大学国际学生录取标准；获得奖学金资助期间不得在其他机构学习或工作。";
    scholarshipApplicationTimeText =
      "博士奖学金申请时间：2025年10月16日至2026年1月31日。";
    scholarshipApplicationGuideText =
      "申请者须在中国科大网申系统创建账户，填写信息并上传材料；请注意查看注册邮箱，以便及时获知补交材料、在线考核等通知。申请环节无需联系导师，国际学院会将申请材料发送给负责在线面试的院系。";
    scholarshipCoverageText =
      "一等奖学金：学费、综合医疗保险、每月最高7000元人民币助学金；二等奖学金：学费、综合医疗保险、每月3500元人民币助学金、住宿补贴；三等奖学金：学费，入学后可申请助教/助研补贴。";
    stipendPhdFirst = 7000;
    stipendPhdSecond = 3500;
  }

  if (!scholarshipNote) return rows;

  const next = rows.map((row: any) => {
    const r = { ...(row || {}) };
    return {
      ...r,
      scholarship_note: scholarshipNote,
      scholarship_source_url: sourceUrl,
      scholarship_apply_requirements_text: scholarshipApplyRequirementsText,
      scholarship_application_time_text: scholarshipApplicationTimeText,
      scholarship_application_guide_text: scholarshipApplicationGuideText,
      scholarship_coverage_text: scholarshipCoverageText,

      scholarship_stipend_master_rmb_per_month:
        stipendMaster ?? r.scholarship_stipend_master_rmb_per_month ?? null,
      scholarship_stipend_phd_first_rmb_per_month:
        stipendPhdFirst ?? r.scholarship_stipend_phd_first_rmb_per_month ?? null,
      scholarship_stipend_phd_second_rmb_per_month:
        stipendPhdSecond ?? r.scholarship_stipend_phd_second_rmb_per_month ?? null,

      tags: Array.from(
        new Set([
          ...((Array.isArray(r.tags) ? r.tags : []) as any[]),
          "奖学金已补",
          "USTC",
        ].filter(Boolean)),
      ),
    };
  });

  console.log("[USTC_DEGREE_SPECIFIC_SCHOLARSHIP_PATCH]", {
    kind,
    rows: next.length,
    sourceUrl,
    first: next[0] || null,
  });

  return next;
}
// ===== USTC_DEGREE_SPECIFIC_SCHOLARSHIP_PATCH_END =====


// ===== USTC_RESEARCH_INTERNSHIP_SCHOLARSHIP_PATCH_START =====
function applyUstcResearchInternshipScholarshipToCatalog(args: {
  rows: any[];
  sourceUrl?: string | null;
}) {
  const rows = Array.isArray(args.rows) ? args.rows : [];
  const sourceUrl =
    String(args.sourceUrl || "").trim() ||
    "https://ic.ustc.edu.cn/v7info.php?Nav_x=72";

  if (rows.length === 0) return rows;

  const scholarshipNote =
    "中国科学技术大学科研实习项目奖学金分为三个等级：A级免学费、免综合医疗保险费、免学生宿舍费，并提供补贴：本科在读生2500元/月、硕士在读生3000元/月、博士在读生3500元/月；B级免学费、免综合医疗保险费、免学生宿舍费；C级免学费。";

  const scholarshipCoverageText =
    "A级：免学费、免综合医疗保险费、免学生宿舍费，并提供本科2500元/月、硕士3000元/月、博士3500元/月补贴；B级：免学费、免综合医疗保险费、免学生宿舍费；C级：免学费。";

  const next = rows.map((row: any) => {
    const r = { ...(row || {}) };
    return {
      ...r,
      scholarship_note: scholarshipNote,
      scholarship_coverage_text: scholarshipCoverageText,
      scholarship_source_url: sourceUrl,
      scholarship_stipend_ug_rmb_per_month: 2500,
      scholarship_stipend_master_rmb_per_month: 3000,
      scholarship_stipend_phd_rmb_per_month: 3500,
      tags: Array.from(
        new Set([
          ...((Array.isArray(r.tags) ? r.tags : []) as any[]),
          "奖学金已补",
          "科研实习奖学金",
          "USTC",
        ].filter(Boolean)),
      ),
    };
  });

  console.log("[USTC_RESEARCH_INTERNSHIP_SCHOLARSHIP_PATCH]", {
    rows: next.length,
    sourceUrl,
    first: next[0] || null,
  });

  return next;
}
// ===== USTC_RESEARCH_INTERNSHIP_SCHOLARSHIP_PATCH_END =====


// ===== WHU_UG_SCHOLARSHIP_AND_FEE_PATCH_START =====
function applyWhuUgScholarshipDocToCatalog(args: {
  rows: any[];
  sourceName?: string | null;
}) {
  const rows = Array.isArray(args.rows) ? args.rows : [];
  if (rows.length === 0) return rows;

  const sourceName = String(args.sourceName || "附件三：奖学金申请信息.docx").trim();

  const scholarshipNote =
    "武汉大学来华留学生奖学金包括：中国政府奖学金-国别双边项目、国际中文教师奖学金、欧盟之窗奖学金、沙特阿拉伯国王奖学金、留学武大—学历/进修生新生奖学金。申请者应根据奖学金类型分别通过国家留学基金委、中文联盟/中文教师奖学金系统、campuschina.org、武汉大学申请网站或相关派遣机构申请。";

  const scholarshipApplicationTimeText =
    "中国政府奖学金-国别双边项目：2025年12月初至2026年5月；国际中文教师奖学金：2026年3月初至2026年5月初；欧盟之窗奖学金：2025年12月至2026年2月；沙特阿拉伯国王奖学金：2025年11月1日至2026年5月30日；留学武大—学历/进修生新生奖学金：提交其他申请材料时同步申请。";

  const scholarshipApplicationGuideText =
    "中国政府奖学金-国别双边项目请联系本国留学生派遣部门，通常为中国驻当地使领馆；国际中文教师奖学金需登录 chinese.cn，同时还需登录武汉大学申请网站 admission.whu.edu.cn；欧盟之窗奖学金需登录 campuschina.org 和武汉大学申请网站；沙特阿拉伯国王奖学金可通过武汉大学网站申请，也可咨询沙特阿拉伯驻北京文化处；留学武大新生奖学金通过武汉大学申请网站申请。";

  const registrationPeriodText =
    "来华留学生新生注册报到时间通常为每年8月至9月，具体时间以录取通知书为准。报到时须携带普通护照原件、录取通知书、签证申请表复印件（JW202/JW201）及学生签证；不符合入学条件者取消入学资格。";

  const next = rows.map((row: any) => {
    const r = { ...(row || {}) };
    return {
      ...r,
      scholarship_note: scholarshipNote,
      scholarship_application_time_text: scholarshipApplicationTimeText,
      scholarship_application_guide_text: scholarshipApplicationGuideText,
      scholarship_source_url: r.scholarship_source_url || "附件三：奖学金申请信息.docx",
      registration_period_text:
        String(r.registration_period_text || "").trim() || registrationPeriodText,
      source_files: Array.from(
        new Set([
          ...((Array.isArray(r.source_files) ? r.source_files : []) as any[]),
          sourceName,
        ].filter(Boolean)),
      ),
      tags: Array.from(
        new Set([
          ...((Array.isArray(r.tags) ? r.tags : []) as any[]),
          "奖学金已补",
          "WHU",
        ].filter(Boolean)),
      ),
    };
  });

  console.log("[WHU_UG_SCHOLARSHIP_DOC_PATCH]", {
    rows: next.length,
    sourceName,
    first: next[0] || null,
  });

  return next;
}

function whuUgTuitionByRow(row: any) {
  const lang = String(row?.study_language || row?.language_text || "").toLowerCase();
  const text = [
    row?.faculty_cn,
    row?.faculty_en,
    row?.program_name_cn,
    row?.program_name_en,
    row?.raw_line,
    row?.raw_block,
  ].map((x: any) => String(x || "")).join(" ");

  const isEnglish =
    lang === "en" ||
    lang.includes("英文") ||
    lang.includes("english");

  const isMedicine =
    /医学|临床|口腔|药学|护理|公共卫生|预防医学|Medicine|Medical|Clinical|Stomatology|Pharmacy|Nursing|Public Health|MBBS/i.test(text);

  const isScienceEngineering =
    /理工|数学|统计|物理|化学|生命|资源|环境|机械|电气|自动化|土木|水利|城市设计|电子|计算机|网络安全|遥感|测绘|地球|机器人|集成电路|Software|Engineering|Science|Technology|Computer|Cyber|Remote Sensing|Geography|Environmental|Physics|Chemistry|Mathematics/i.test(text);

  if (isEnglish) {
    if (isMedicine) return { amount: 40000, group: "医学类", note: "英文授课医学类本科：40,000 RMB/学年。" };
    if (isScienceEngineering) return { amount: 28000, group: "理工科", note: "英文授课理工科本科：28,000 RMB/学年。" };
    return { amount: 23000, group: "文科", note: "英文授课文科本科：23,000 RMB/学年。" };
  }

  if (isMedicine) return { amount: 30000, group: "医学类", note: "中文授课医学类本科：30,000 RMB/学年。" };
  if (isScienceEngineering) return { amount: 24000, group: "理工科", note: "中文授课理工科本科：24,000 RMB/学年。" };
  return { amount: 20000, group: "文科", note: "中文授课文科本科：20,000 RMB/学年。" };
}

function applyWhuUgFeeDocToCatalog(args: {
  rows: any[];
  sourceName?: string | null;
}) {
  const rows = Array.isArray(args.rows) ? args.rows : [];
  if (rows.length === 0) return rows;

  const sourceName = String(args.sourceName || "附件四：武汉大学来华留学生费用标准.doc").trim();

  const next = rows.map((row: any) => {
    const r = { ...(row || {}) };
    const tuition = whuUgTuitionByRow(r);

    return {
      ...r,
      tuition_rmb_per_year:
        String(r.tuition_note || "").includes("南京大学") ||
        String(r.tuition_note || "").includes("Nanjing University") ||
        r.tuition_rmb_per_year == null
          ? tuition.amount
          : r.tuition_rmb_per_year,
      tuition_is_per_year: true,
      tuition_group:
        String(r.tuition_note || "").includes("南京大学") ||
        String(r.tuition_note || "").includes("Nanjing University") ||
        !r.tuition_group
          ? tuition.group
          : r.tuition_group,
      tuition_note:
        String(r.tuition_note || "").includes("南京大学") ||
        String(r.tuition_note || "").includes("Nanjing University") ||
        !r.tuition_note
          ? tuition.note
          : r.tuition_note,
      tuition_source_url: "附件四：武汉大学来华留学生费用标准.docx",

      application_fee_rmb: r.application_fee_rmb ?? 800,
      application_fee_note:
        r.application_fee_note || "本科报名费：800 RMB / 约111 USD，网上支付。",
      application_fee_source_url:
        r.application_fee_source_url || "附件四：武汉大学来华留学生费用标准.doc",

      insurance_fee_note:
        r.insurance_fee_note || "医疗保险费：800-1500 RMB/年，所有来华留学生均须在武汉大学购买保险。",
      insurance_fee_source_url:
        r.insurance_fee_source_url || "附件四：武汉大学来华留学生费用标准.doc",

      accommodation_fee_note:
        r.accommodation_fee_note || "住宿费：9,600-28,000 RMB/年，具体以武汉大学招生网站费用查询为准。",
      other_fee_note:
        r.other_fee_note || "体检费约500 RMB；居留许可费400 RMB/年；书本费每年500 RMB以上；生活费每月1500 RMB以上。",

      scholarship_note:
        String(r.scholarship_note || "").trim() ||
        "武汉大学来华留学生奖学金包括：中国政府奖学金-国别双边项目、国际中文教师奖学金、欧盟之窗奖学金、沙特阿拉伯国王奖学金、留学武大—学历/进修生新生奖学金。申请者应根据奖学金类型分别通过国家留学基金委、中文联盟/中文教师奖学金系统、campuschina.org、武汉大学申请网站或相关派遣机构申请。",
      scholarship_application_time_text:
        String(r.scholarship_application_time_text || "").trim() ||
        "中国政府奖学金-国别双边项目：2025年12月初至2026年5月；国际中文教师奖学金：2026年3月初至2026年5月初；欧盟之窗奖学金：2025年12月至2026年2月；沙特阿拉伯国王奖学金：2025年11月1日至2026年5月30日；留学武大—学历/进修生新生奖学金：提交其他申请材料时同步申请。",
      scholarship_application_guide_text:
        String(r.scholarship_application_guide_text || "").trim() ||
        "中国政府奖学金-国别双边项目请联系本国留学生派遣部门，通常为中国驻当地使领馆；国际中文教师奖学金需登录 chinese.cn，同时还需登录武汉大学申请网站 admission.whu.edu.cn；欧盟之窗奖学金需登录 campuschina.org 和武汉大学申请网站；沙特阿拉伯国王奖学金可通过武汉大学网站申请，也可咨询沙特阿拉伯驻北京文化处；留学武大新生奖学金通过武汉大学申请网站申请。",
      scholarship_source_url:
        r.scholarship_source_url || "附件三：奖学金申请信息.docx",

      source_files: Array.from(
        new Set([
          ...((Array.isArray(r.source_files) ? r.source_files : []) as any[]),
          sourceName,
        ].filter(Boolean)),
      ),

      tags: Array.from(
        new Set([
          ...((Array.isArray(r.tags) ? r.tags : []) as any[]),
          "收费已填",
          "申请费已填",
          "WHU",
        ].filter(Boolean)),
      ),
    };
  });

  console.log("[WHU_UG_FEE_DOC_PATCH]", {
    rows: next.length,
    sourceName,
    first: next[0] || null,
  });

  return next;
}
// ===== WHU_UG_SCHOLARSHIP_AND_FEE_PATCH_END =====



// ===== WHU_GRAD_FEE_POLICY_EXTRACT_START =====
function parseMoneyNumberFromText(s: string) {
  const m = String(s || "").match(/(\d{1,3}(?:,\d{3})+|\d{4,6})/);
  if (!m) return null;
  const n = Number(m[1].replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function extractWhuGradFeePolicyFromText(raw: string) {
  const text = String(raw || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const policy: any = {
    master: {
      zh: { arts: null, science: null, medicine: null },
      en: { arts: null, science: null, medicine: null },
    },
    phd: {
      zh: { arts: null, science: null, medicine: null },
      en: { arts: null, science: null, medicine: null },
    },
  };

  const money = Array.from(text.matchAll(/(?:RMB\s*)?(\d{1,3}(?:,\d{3})+|\d{4,6})/gi))
    .map((m) => Number(String(m[1] || "").replace(/,/g, "")))
    .filter((n) => Number.isFinite(n));

  // 研究生学费只接受 20000-60000，排除 5000、800、1500 等杂费。
  const tuitionMoney = money.filter((n) => n >= 20000 && n <= 60000);

  const required = [23000, 28000, 38000, 33000, 50000, 30000, 40000, 45000, 36000, 46000, 55000];
  const hasAllCore =
    [23000, 28000, 38000, 33000, 50000, 30000, 40000, 45000, 36000, 46000, 55000]
      .every((n) => tuitionMoney.includes(n));

  // 附件五标准表通常包含这组金额。只要文件里出现，就按表结构填。
  if (hasAllCore || required.filter((n) => tuitionMoney.includes(n)).length >= 8) {
    policy.master.zh.arts = 23000;
    policy.master.zh.science = 28000;
    policy.master.zh.medicine = 38000;

    policy.master.en.arts = 33000;
    policy.master.en.science = 38000;
    policy.master.en.medicine = 50000;

    policy.phd.zh.arts = 30000;
    policy.phd.zh.science = 40000;
    policy.phd.zh.medicine = 45000;

    policy.phd.en.arts = 36000;
    policy.phd.en.science = 46000;
    policy.phd.en.medicine = 55000;
  } else {
    // 更保守的 fallback：逐项要求该金额本身出现在表里。
    if (tuitionMoney.includes(23000)) policy.master.zh.arts = 23000;
    if (tuitionMoney.includes(28000)) policy.master.zh.science = 28000;
    if (tuitionMoney.includes(38000)) policy.master.zh.medicine = 38000;

    if (tuitionMoney.includes(33000)) policy.master.en.arts = 33000;
    if (tuitionMoney.includes(38000)) policy.master.en.science = 38000;
    if (tuitionMoney.includes(50000)) policy.master.en.medicine = 50000;

    if (tuitionMoney.includes(30000)) policy.phd.zh.arts = 30000;
    if (tuitionMoney.includes(40000)) policy.phd.zh.science = 40000;
    if (tuitionMoney.includes(45000)) policy.phd.zh.medicine = 45000;

    if (tuitionMoney.includes(36000)) policy.phd.en.arts = 36000;
    if (tuitionMoney.includes(46000)) policy.phd.en.science = 46000;
    if (tuitionMoney.includes(55000)) policy.phd.en.medicine = 55000;
  }

  console.log("[WHU_GRAD_FEE_POLICY_EXTRACT]", {
    tuitionMoney: Array.from(new Set(tuitionMoney)).sort((a, b) => a - b),
    policy,
    filled: JSON.stringify(policy).match(/\d{4,6}/g)?.length || 0,
  });

  return policy;
}


function pickWhuGradFeeFromPolicy(policy: any, row: any, kind: string) {
  const degree = String(kind || row?.kind || "").toLowerCase() === "phd" ? "phd" : "master";
  const langRaw = String(row?.study_language || row?.language_text || "").toLowerCase();
  const lang = langRaw === "en" || langRaw.includes("英文") || langRaw.includes("english") ? "en" : "zh";
  const group = whuFeeGroupByRow(row);
  const groupKey = group === "医学类" ? "medicine" : group === "理工科" ? "science" : "arts";

  const amount = policy?.[degree]?.[lang]?.[groupKey];

  if (amount) {
    const degreeCn = degree === "phd" ? "博士" : "硕士";
    const langCn = lang === "en" ? "英文授课" : "中文授课";
    return {
      amount,
      group,
      note: `${degreeCn}${langCn}${group}：${Number(amount).toLocaleString("en-US")} RMB/学年。`,
    };
  }

  return whuGradTuitionByRow(row, kind);
}
// ===== WHU_GRAD_FEE_POLICY_EXTRACT_END =====

// ===== WHU_GRAD_FEE_DOC_PATCH_START =====
function whuFeeGroupByRow(row: any) {
  const text = [
    row?.faculty_cn,
    row?.faculty_en,
    row?.program_name_cn,
    row?.program_name_en,
    row?.degree_name_cn,
    row?.raw_line,
    row?.raw_block,
  ].map((x: any) => String(x || "")).join(" ");

  const isMedicine =
    /医学|临床|口腔|药学|护理|公共卫生|预防医学|Medicine|Medical|Clinical|Stomatology|Pharmacy|Nursing|Public Health|Hospital/i.test(text);

  const isLiberalArts =
    /哲学|文学|语言|翻译|新闻|传播|历史|经济|管理|法学|政治|公共管理|马克思|信息管理|教育|文化|旅游|艺术|社会|Sinology|Philosophy|Literature|Language|Translation|Journalism|Communication|History|Economics|Management|Law|Politics|Public Administration|Marxism|Information|Education|Culture|Tourism|Art|Sociology|Finance|Accounting|Business/i.test(text);

  if (isMedicine) return "医学类";
  if (isLiberalArts) return "文科";
  return "理工科";
}

function whuGradTuitionByRow(row: any, kind: string) {
  const degreeKind = String(kind || row?.kind || "").toLowerCase();
  const lang = String(row?.study_language || row?.language_text || "").toLowerCase();
  const group = whuFeeGroupByRow(row);
  const isEnglish = lang === "en" || lang.includes("英文") || lang.includes("english");

  if (degreeKind === "phd") {
    if (isEnglish) {
      if (group === "医学类") return { amount: 55000, group, note: "博士英文授课医学类：55,000 RMB/学年。" };
      if (group === "理工科") return { amount: 46000, group, note: "博士英文授课理工科：46,000 RMB/学年。" };
      return { amount: 36000, group, note: "博士英文授课文科：36,000 RMB/学年。" };
    }

    if (group === "医学类") return { amount: 45000, group, note: "博士中文授课医学类：45,000 RMB/学年。" };
    if (group === "理工科") return { amount: 40000, group, note: "博士中文授课理工科：40,000 RMB/学年。" };
    return { amount: 30000, group, note: "博士中文授课文科：30,000 RMB/学年。" };
  }

  // master
  if (isEnglish) {
    if (group === "医学类") return { amount: 50000, group, note: "硕士英文授课医学类：50,000 RMB/学年。" };
    if (group === "理工科") return { amount: 38000, group, note: "硕士英文授课理工科：38,000 RMB/学年。" };
    return { amount: 33000, group, note: "硕士英文授课文科：33,000 RMB/学年。" };
  }

  if (group === "医学类") return { amount: 38000, group, note: "硕士中文授课医学类：38,000 RMB/学年。" };
  if (group === "理工科") return { amount: 28000, group, note: "硕士中文授课理工科：28,000 RMB/学年。" };
  return { amount: 23000, group, note: "硕士中文授课文科：23,000 RMB/学年。" };
}

function applyWhuGradFeeDocToCatalog(args: {
  rows: any[];
  kind: string;
  sourceName?: string | null;
  rawPolicyText?: string | null;
}) {
  const rows = Array.isArray(args.rows) ? args.rows : [];
  const kind = String(args.kind || "").toLowerCase();
  const sourceName = String(args.sourceName || "附件五：武汉大学国际学生费用标准.docx").trim();
  const extractedPolicy = extractWhuGradFeePolicyFromText(String(args.rawPolicyText || ""));

  if (rows.length === 0) return rows;

  const next = rows.map((row: any) => {
    const r = { ...(row || {}) };
    const tuition = pickWhuGradFeeFromPolicy(extractedPolicy, r, kind);

    return {
      ...r,
      tuition_rmb_per_year: tuition.amount,
      tuition_total_rmb: null,
      tuition_is_per_year: true,
      tuition_group: tuition.group,
      tuition_note: tuition.note,
      tuition_source_url: "附件五：武汉大学国际学生费用标准.docx",

      application_fee_rmb: 800,
      application_fee_note: "申请费：800 RMB / 约111 USD，网上支付。",
      application_fee_source_url: "附件五：武汉大学国际学生费用标准.docx",

      insurance_fee_note:
        "医疗保险费：800-1500 RMB/年，所有来华留学生均须在武汉大学购买保险。",
      insurance_fee_source_url: "附件五：武汉大学国际学生费用标准.docx",

      accommodation_fee_note:
        "住宿费：9,600-28,000 RMB/年，具体以武汉大学招生网站费用查询为准。",
      other_fee_note:
        "体检费约500 RMB；居留许可费400 RMB/年；书本费每年500 RMB以上；生活费每月1500 RMB以上。",

      source_files: Array.from(
        new Set([
          ...((Array.isArray(r.source_files) ? r.source_files : []) as any[]),
          sourceName,
        ].filter(Boolean)),
      ),

      tags: Array.from(
        new Set([
          ...((Array.isArray(r.tags) ? r.tags : []) as any[]).filter(
            (x: any) => !String(x).includes("收费待补"),
          ),
          "收费已填",
          "申请费已填",
          "WHU",
        ].filter(Boolean)),
      ),
    };
  });

  console.log("[WHU_GRAD_FEE_DOC_PATCH]", {
    kind,
    rows: next.length,
    sourceName,
    first: next[0] || null,
  });

  return next;
}
// ===== WHU_GRAD_FEE_DOC_PATCH_END =====

let mergedCatalog: any[] = [];

// NJU master single-program HTML detail parser must override nextCatalog before
// uploadHasCatalogRows / isCatalogUpload are computed.
if (
  htmlStrategy?.shouldParseProgramDetail &&
  kind === "master" &&
  Array.isArray(forcedCatalogByDocClass) &&
  forcedCatalogByDocClass.length > 0
) {
  nextCatalog = forcedCatalogByDocClass;
  parsed.program_catalog = forcedCatalogByDocClass;
  parsed.program_catalog_meta = {
    ...(parsed.program_catalog_meta || {}),
    ...(forcedMetaByDocClass || {}),
    parser: "nju_master_html_program_detail_v1",
    doc_type: "nju_master_html_program_detail",
    rows: Array.isArray(forcedCatalogByDocClass) ? forcedCatalogByDocClass.length : 0,
  };

  console.log("[NJU_MASTER_HTML_PROGRAM_DETAIL_FORCE_ROWS]", {
    rows: Array.isArray(forcedCatalogByDocClass) ? forcedCatalogByDocClass.length : 0,
    first: forcedCatalogByDocClass[0] || null,
  });
}

const tuitionPolicyOnlyPage =
  isLikelyTuitionPolicyOnlyPage({
    rawText: raw_text,
    sourceUrl: source_url || source_url_raw || null,
    linkPurpose,
  }) ||
  (
    /招生专业收费表|报名费与学费|学费[:：]?详见表/.test(String(raw_text || "")) &&
    /文科类/.test(String(raw_text || "")) &&
    /医学类/.test(String(raw_text || ""))
  ) ||
  (
    String(source_url || source_url_raw || "").toLowerCase().includes("iso.sysu.edu.cn") &&
    String(source_url || source_url_raw || "").toLowerCase().includes("/zfxm/")
  );

if (
  tuitionPolicyOnlyPage &&
  Array.isArray(nextCatalog) &&
  nextCatalog.length > 0
) {
  console.log("[TUITION_POLICY_ONLY_CLEAR_NEXT_CATALOG_BEFORE_UPLOAD_CLASSIFY]", {
    kind,
    linkPurpose,
    filename: out?.filename || null,
    source_url: source_url || source_url_raw || null,
    nextCatalogBeforeClear: nextCatalog.length,
    prevCatalogLen: Array.isArray(prevCatalog) ? prevCatalog.length : -1,
    firstNext: nextCatalog[0] || null,
  });

  nextCatalog.length = 0;
  (parsed as any).program_catalog = [];
}

const uploadHasCatalogRows =
  !tuitionPolicyOnlyPage &&
  Array.isArray(nextCatalog) &&
  nextCatalog.length > 0;

// 如果本次已经解析出了专业目录 rows，就必须按 catalog 处理。
// 有些目录 PDF 的备注里包含“学费”，会被 classifyProgramDoc 误判成 tuition_doc，不能因此丢掉 nextCatalog。
// 但纯费用页/招生简章页即使被 generic parser 误解析出 rows，也必须按 tuition supplement 处理。
const isTuitionUpload =
  tuitionPolicyOnlyPage ||
  (
    !uploadHasCatalogRows &&
    (
      linkPurpose === "tuition" ||
      isFudanGradSciMedTuitionGuide ||
      docClass?.doc_type === "tuition_doc"
    )
  );

const isScholarshipUpload = linkPurpose === "scholarship";

const isApplyGuideUpload =
  !htmlStrategy?.shouldParseProgramDetail &&
  (
    linkPurpose === "apply_guide" ||
    kind === "apply_guide" ||
    Boolean(applyGuideParsed) ||
    Boolean(applyGuidePolicy)
  );

const isCatalogUpload =
  !isTuitionUpload &&
  !isScholarshipUpload &&
  !isApplyGuideUpload;

const isSupplementUpload =
  isTuitionUpload ||
  isScholarshipUpload ||
  isApplyGuideUpload;

// ✅ 补充资料：学费/奖学金/申请要求，只能补 meta 和行字段，绝不清空专业目录
if (isSupplementUpload) {
  mergedCatalog = Array.isArray(prevCatalog) ? prevCatalog : [];

  if (mergedCatalog.length === 0 && nextCatalog.length === 0) {
    console.warn("[SUPPLEMENT_UPLOAD_NO_PREV_CATALOG]", {
      kind,
      linkPurpose,
      school_id,
      source_url,
      message: "supplement upload has no previous catalog; program_catalog will stay empty until catalog is re-uploaded",
    });
  }
} else if (isForcedStructuredParser) {
  mergedCatalog = Array.isArray(nextCatalog) ? nextCatalog : [];
} else if (isCatalogUpload && (kind === "ug" || kind === "master" || kind === "phd" || String(kind) === "foundation_bachelor")) {
// 本/硕/博“专业目录”上传：新目录优先覆盖旧目录
  // 否则旧目录里的空英文、旧字段会把页面表现搞乱
  mergedCatalog =
    nextCatalog.length === 0
      ? prevCatalog
      : mergeProgramCatalog([], nextCatalog);
} else {
  // 学费 / 奖学金 / 补充资料：保留旧目录，再补字段
  mergedCatalog =
    nextCatalog.length === 0
      ? prevCatalog
      : mergeProgramCatalog(prevCatalog, nextCatalog);
}
    const prevMeta2 = (prevParsed?.program_catalog_meta || {}) as any;
    const nextMeta2 = (parsed?.program_catalog_meta || {}) as any;

const mergedTuitionUrl =
  linkPurpose === "apply_guide"
    ? (
        prevMeta2?.tuition_source_url ||
        null
      )
    : (
        isCatalogUpload && uploadHasCatalogRows
          ? (nextMeta2?.tuition_source_url || null)
          : (
              sjtuUgTuitionGlobal?.tuition_source_url ||
              nextMeta2?.tuition_source_url ||
              prevMeta2?.tuition_source_url ||
              tuitionPolicy?.source_url ||
              null
            )
      );

    let mergedCatalogFinal = mergedCatalog;

    if (
      isFudanGradSciMedContext &&
      (kind === "master" || kind === "phd") &&
      content_type === "application/pdf" &&
      (
        String(raw_text || "").includes("理工科") ||
        String(raw_text || "").includes("医科")
      ) &&
      (
        String(raw_text || "").includes("学费") ||
        String(raw_text || "").includes("收费")
      ) &&
      Array.isArray(mergedCatalogFinal) &&
      mergedCatalogFinal.length > 0
    ) {
      mergedCatalogFinal = applyFudanGradSciMedFeeNumbersLoose({
        rows: mergedCatalogFinal,
        rawText: raw_text,
        kind,
        tuitionSourceUrl: mergedTuitionUrl,
      });
    }

    if (
      isFudanGradSciMedContext &&
      (kind === "master" || kind === "phd") &&
      content_type === "application/pdf" &&
      (
        String(raw_text || "").includes("理工医科菁英项目") ||
        String(raw_text || "").includes("硕士：理工科") ||
        String(raw_text || "").includes("博士：理工科")
      ) &&
      Array.isArray(mergedCatalogFinal) &&
      mergedCatalogFinal.length > 0
    ) {
      mergedCatalogFinal = applyFudanGradSciMedTuitionToCatalog({
        rows: mergedCatalogFinal,
        rawText: raw_text,
        kind,
        tuitionSourceUrl: mergedTuitionUrl,
      });
    }

    if (
  sjtuUgTuitionGlobal?.ok &&
  kind === "ug" &&
  Array.isArray(mergedCatalogFinal) &&
  mergedCatalogFinal.length > 0
) {
  const pending = new Set(
    (sjtuUgTuitionGlobal.pending_faculties || []).map((x: any) =>
      String(x || "").trim(),
    ),
  );

  mergedCatalogFinal = mergedCatalogFinal.map((row: any) => {
    const outRow: any = { ...(row || {}) };
    const faculty = String(outRow.faculty_cn || "").trim();

    if (pending.has(faculty)) {
      outRow.tuition_rmb_per_year = null;
      outRow.tuition_is_per_year = null;
      outRow.tuition_note = "学费待定，具体费用标准以后续公布为准";
      outRow.tuition_source_url =
        sjtuUgTuitionGlobal.tuition_source_url || outRow.tuition_source_url || null;
      return outRow;
    }

    if (outRow.tuition_rmb_per_year == null) {
      outRow.tuition_rmb_per_year = sjtuUgTuitionGlobal.tuition_rmb_per_year;
      outRow.tuition_is_per_year = true;
      outRow.tuition_note = sjtuUgTuitionGlobal.tuition_note;
    }

    outRow.tuition_source_url =
      sjtuUgTuitionGlobal.tuition_source_url || outRow.tuition_source_url || null;

    return outRow;
  });
}

    if (
      tuitionPatchMap &&
      tuitionPatchMap.size > 0 &&
      Array.isArray(mergedCatalogFinal) &&
      mergedCatalogFinal.length > 0
    ) {
      const norm2 = (s: any) =>
        String(s ?? "")
          .replace(/\u00a0/g, " ")
          .trim()
          .replace(/[（）]/g, (m) => (m === "（" ? "(" : ")"))
          .replace(/\s+/g, "")
          .toLowerCase();

      mergedCatalogFinal = mergedCatalogFinal.map((row) => {


const programKey = norm2(row?.program_name_cn);
const facultyKey = norm2(row?.faculty_cn);

const patch =
  tuitionPatchMap!.get(`${programKey}@@${facultyKey}`) ||
  tuitionPatchMap!.get(programKey);

if (!patch) return row;
        const outRow: any = { ...(row || {}) };

        if (
          outRow.tuition_rmb_per_year == null &&
          patch.tuition_rmb_per_year != null
        ) {
          outRow.tuition_rmb_per_year = patch.tuition_rmb_per_year;
        }

        if (outRow.duration_years == null && patch.duration_years != null) {
          outRow.duration_years = patch.duration_years;
        }

        if (
          !String(outRow.tuition_note || "").trim() &&
          String(patch.tuition_note || "").trim()
        ) {
          outRow.tuition_note = patch.tuition_note;
        }

        if (
          !String(outRow.degree_type || "").trim() &&
          String(patch.degree_type || "").trim()
        ) {
          outRow.degree_type = patch.degree_type;
        }

        outRow.tuition_source_url =
          mergedTuitionUrl || outRow.tuition_source_url || null;

        outRow.tags = Array.isArray(outRow.tags)
          ? outRow.tags
          : buildRowTags(outRow);

        return outRow;
      });
    }

    if (
      mergedTuitionUrl &&
      Array.isArray(mergedCatalogFinal) &&
      mergedCatalogFinal.length > 0
    ) {
      mergedCatalogFinal = mergedCatalogFinal.map((row) => {
        const outRow: any = { ...(row || {}) };
        if (!String(outRow.tuition_source_url || "").trim()) {
          outRow.tuition_source_url = mergedTuitionUrl;
        }
        outRow.tags = Array.isArray(outRow.tags)
          ? outRow.tags
          : buildRowTags(outRow);
        return outRow;
      });
    }


if (
  tuitionPolicy &&
  linkPurpose === "tuition" &&
  kind === "ug" &&
  Array.isArray(mergedCatalogFinal) &&
  mergedCatalogFinal.length > 0
) {
  const rules = Array.isArray((tuitionPolicy as any)?.rules)
    ? (tuitionPolicy as any).rules
    : [];

  const inferFudanGradRuleKey = (rule: any) => {
    const text = [
      rule?.key,
      rule?.tuition_rule_key,
      rule?.degree_kind,
      rule?.degreeKind,
      rule?.degree_type,
      rule?.discipline_group,
      rule?.group,
      rule?.name,
      rule?.title,
      rule?.note,
      rule?.raw,
      rule?.raw_line,
      rule?.raw_text,
    ]
      .filter(Boolean)
      .join(" ");

    const isProfessional =
      text.includes("专业学位") ||
      text.toLowerCase().includes("professional");

    if (isProfessional) return "professional_consult_school";

    const isAcademic =
      text.includes("学术学位") ||
      text.toLowerCase().includes("academic");

    const isMedical =
      text.includes("医科") ||
      text.includes("医学") ||
      text.includes("药学") ||
      text.includes("护理") ||
      text.includes("公共卫生");

    const isSciEng =
      text.includes("理工科") ||
      text.includes("理科") ||
      text.includes("工科") ||
      text.toLowerCase().includes("science") ||
      text.toLowerCase().includes("engineering");

    if (isAcademic && isMedical) return "academic_medical";
    if (isAcademic && isSciEng) return "academic_science_engineering";
    if (isMedical) return "academic_medical";
    if (isSciEng) return "academic_science_engineering";

    return "";
  };

  const ruleMap = new Map<string, any>();

  for (const rule of rules) {
    const key = String(
      rule?.key ||
        rule?.tuition_rule_key ||
        inferFudanGradRuleKey(rule) ||
        "",
    ).trim();

    if (key) {
      ruleMap.set(key, {
        ...(rule || {}),
        key,
        tuition_rule_key: key,
      });
    }
  }

  mergedCatalogFinal = mergedCatalogFinal.map((row: any) => {
    const outRow: any = { ...(row || {}) };
    const key = String(outRow.tuition_rule_key || "").trim();
    const rule = key ? ruleMap.get(key) : null;

    if (!rule) return outRow;

    if (key === "professional_consult_school") {
      outRow.tuition_note =
        outRow.tuition_note ||
        rule.note ||
        "专业学位学费请咨询院系";

      outRow.tuition_source_url =
        (tuitionPolicy as any)?.source_url ||
        outRow.tuition_source_url ||
        null;

      outRow.tags = buildRowTags(outRow);
      return outRow;
    }

    if (
      outRow.tuition_rmb_per_year == null &&
      rule.tuition_rmb_per_year != null
    ) {
      outRow.tuition_rmb_per_year = rule.tuition_rmb_per_year;
      outRow.tuition_is_per_year = true;
    }

    if (!String(outRow.tuition_note || "").trim() && rule.note) {
      outRow.tuition_note = rule.note;
    }

    outRow.tuition_source_url =
      (tuitionPolicy as any)?.source_url ||
      outRow.tuition_source_url ||
      null;

    outRow.tags = buildRowTags(outRow);
    return outRow;
  });

  
if (
  tuitionPolicy &&
  Array.isArray((tuitionPolicy as any).rules) &&
  Array.isArray(mergedCatalogFinal) &&
  mergedCatalogFinal.length > 0
) {
  const fixedRules = ((tuitionPolicy as any).rules || []).map((rule: any) => {
    const key = String(
      rule?.key ||
        rule?.tuition_rule_key ||
        inferFudanGradTuitionRuleKey(rule) ||
        "",
    ).trim();

    const tuition = pickFudanGradTuitionAmount(rule);

    return {
      ...(rule || {}),
      key: key || null,
      tuition_rule_key: key || null,
      tuition_rmb_per_year:
        rule?.tuition_rmb_per_year != null
          ? rule.tuition_rmb_per_year
          : tuition,
    };
  });

  const ruleMap = new Map<string, any>();
  for (const rule of fixedRules) {
    const key = String(rule?.tuition_rule_key || rule?.key || "").trim();
    if (key) ruleMap.set(key, rule);
  }

  mergedCatalogFinal = mergedCatalogFinal.map((row: any) => {
    const outRow: any = { ...(row || {}) };
    const rowKey = String(outRow?.tuition_rule_key || "").trim();
    const rule = rowKey ? ruleMap.get(rowKey) : null;

    if (!rule) return outRow;

    if (rowKey === "professional_consult_school") {
      outRow.tuition_note =
        outRow.tuition_note ||
        rule?.tuition_note ||
        rule?.note ||
        "专业学位学费以院系公布为准";
      outRow.tuition_rmb_per_year = null;
      outRow.tuition_is_per_year = null;
      outRow.tuition_source_url =
        mergedTuitionUrl || outRow.tuition_source_url || null;
      outRow.tags = buildRowTags(outRow);
      return outRow;
    }

    const n = pickFudanGradTuitionAmount(rule);
    if (n != null) {
      outRow.tuition_rmb_per_year = n;
      outRow.tuition_is_per_year = true;
      outRow.tuition_note =
        outRow.tuition_note ||
        rule?.tuition_note ||
        rule?.note ||
        `${Number(n).toLocaleString("en-US")} RMB/Year`;
      outRow.tuition_source_url =
        mergedTuitionUrl || outRow.tuition_source_url || null;
    }

    outRow.tags = buildRowTags(outRow);
    return outRow;
  });

  (tuitionPolicy as any).rules = fixedRules;
}

console.log("[FUDAN_GRAD_SCIMED_TUITION_APPLIED]", {
    rulesLen: rules.length,
    ruleKeys: ((tuitionPolicy as any)?.rules || rules).map((r: any) => r?.key || r?.tuition_rule_key || null),
    rows: mergedCatalogFinal.length,
    withTuition: mergedCatalogFinal.filter(
      (r: any) => r?.tuition_rmb_per_year != null,
    ).length,
    professionalConsult: mergedCatalogFinal.filter(
      (r: any) => r?.tuition_rule_key === "professional_consult_school",
    ).length,
    firstWithTuition:
      mergedCatalogFinal.find((r: any) => r?.tuition_rmb_per_year != null) ||
      null,
  });
}

  
// ✅ 复旦硕博理工医科菁英项目：把“学费政策 PDF”应用到既有专业目录
// 规则：专业学位不自动填金额；学术学位按 硕士/博士 + 理工科/医科 填对应学费
if (
  isFudanGradSciMedContext &&
  tuitionPolicy &&
  (kind === "master" || kind === "phd") &&
  Array.isArray(mergedCatalogFinal) &&
  mergedCatalogFinal.length > 0
) {
  const amountByKey: Record<string, number> = {
    master_academic_science_engineering: 30000,
    master_academic_medical: 48000,
    phd_academic_science_engineering: 37000,
    phd_academic_medical: 54000,
  };

  const noteByKey: Record<string, string> = {
    master_academic_science_engineering:
      "中文授课项目；硕士理工科 30,000 RMB/Year；学术学位学费标准",
    master_academic_medical:
      "中文授课项目；硕士医科 48,000 RMB/Year；学术学位学费标准",
    phd_academic_science_engineering:
      "中文授课项目；博士理工科 37,000 RMB/Year；学术学位学费标准",
    phd_academic_medical:
      "中文授课项目；博士医科 54,000 RMB/Year；学术学位学费标准",
  };

  mergedCatalogFinal = mergedCatalogFinal.map((row: any) => {
    const outRow: any = { ...(row || {}) };

    const degreeKind = String(outRow.degree_kind || "").trim();
    const disciplineGroup = String(outRow.discipline_group || "").trim();

    // 专业学位：简章写的是“请向院系咨询”，不要套理科/医科学费
    if (degreeKind === "专业学位") {
      outRow.tuition_rmb_per_year = null;
      outRow.tuition_is_per_year = null;
      outRow.tuition_rule_key = "professional_consult_school";
      outRow.tuition_note =
        outRow.tuition_note || "专业学位学费标准请向院系咨询";
      outRow.tuition_source_url =
        mergedTuitionUrl || outRow.tuition_source_url || null;
      outRow.tags = buildRowTags(outRow);
      return outRow;
    }

    // 只给学术学位填
    if (degreeKind === "专业学位") {
      return outRow;
    }

    const groupKey =
      disciplineGroup === "医科" ? "medical" : "science_engineering";

    const ruleKey =
      kind === "master"
        ? `master_academic_${groupKey}`
        : `phd_academic_${groupKey}`;

    const amount = amountByKey[ruleKey];

    if (amount) {
      outRow.tuition_rmb_per_year = amount;
      outRow.tuition_is_per_year = true;
      outRow.tuition_rule_key = ruleKey;
      outRow.tuition_note = noteByKey[ruleKey];
      outRow.tuition_source_url =
        mergedTuitionUrl || outRow.tuition_source_url || null;
    }

    outRow.tags = buildRowTags(outRow);
    return outRow;
  });

  console.log("[FUDAN_GRAD_SCIMED_TUITION_FORCE_APPLIED]", {
    kind,
    rows: mergedCatalogFinal.length,
    withTuition: mergedCatalogFinal.filter(
      (r: any) => r?.tuition_rmb_per_year != null,
    ).length,
    professionalConsult: mergedCatalogFinal.filter(
      (r: any) => r?.tuition_rule_key === "professional_consult_school",
    ).length,
    firstWithTuition:
      mergedCatalogFinal.find((r: any) => r?.tuition_rmb_per_year != null) ||
      null,
  });
}



// ===== FUDAN_GRAD_SCIMED_FORCE_TUITION_START =====
// 复旦研究生理工医科菁英项目：最终兜底强制写学费
// 硕士理工科 30000，硕士医科 48000；博士理工科 37000，博士医科 54000
if (
  isFudanGradSciMedContext &&
  (kind === "master" || kind === "phd") &&
  Array.isArray(mergedCatalogFinal) &&
  mergedCatalogFinal.length > 0
) {
  const commonMedicalFaculties = [
    "基础医学院",
    "公共卫生学院",
    "药学院",
    "护理学院",
    "放射医学研究所",
    "上海市生物医药技术研究院",
    "上海市影像医学研究所",
    "脑科学研究院",
  ];

  const masterOnlyMedicalFaculties = [
    "实验动物中心",
    "人类表型组研究院",
  ];

  const phdOnlyMedicalFaculties = [
    "生物医学研究院",
    "脑科学转化研究院",
  ];

  const medicalKeywords = [
    "医学",
    "医科",
    "医药",
    "药学",
    "护理",
    "公共卫生",
    "预防医学",
    "流行病",
    "卫生统计",
    "卫生毒理",
    "营养与食品卫生",
    "妇幼保健",
    "放射医学",
    "影像医学",
    "核医学",
    "神经",
    "脑科学",
    "生物医学",
    "病原",
    "分子医学",
    "医学信息学",
    "医学系统生物学",
    "中西医结合",
    "实验动物",
    "人类表型组",
    "临床",
    "肿瘤",
    "免疫",
    "感染",
    "疫苗",
    "健康",
    "卫生",
    "PET",
    "CT",
    "超声",
    "诊断",
    "医院",
  ];

  const isFudanGradSciMedRows = mergedCatalogFinal.some((r: any) => {
    const hay = [
      r?.faculty_cn,
      r?.program_name_cn,
      r?.track_name_cn,
      r?.raw_line,
      r?.raw_block,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      hay.includes("数学科学学院") ||
      hay.includes("理工医科") ||
      hay.includes("基础医学院") ||
      hay.includes("护理学院") ||
      hay.includes("公共卫生学院") ||
      hay.includes("药学院") ||
      hay.includes("放射医学研究所") ||
      hay.includes("上海市生物医药技术研究院") ||
      hay.includes("上海市影像医学研究所") ||
      hay.includes("脑科学研究院") ||
      hay.includes("实验动物中心") ||
      hay.includes("人类表型组研究院") ||
      hay.includes("生物医学研究院") ||
      hay.includes("脑科学转化研究院")
    );
  });

  if (isFudanGradSciMedRows) {
    mergedCatalogFinal = mergedCatalogFinal.map((row: any) => {
      const outRow: any = { ...(row || {}) };

      const hay = [
        outRow.faculty_cn,
        outRow.program_name_cn,
        outRow.track_name_cn,
        outRow.raw_line,
        outRow.raw_block,
      ]
        .filter(Boolean)
        .join(" ");

      const isMaster =
        kind === "master" || String(outRow.degree_type || "").includes("硕士");

      const isPhd =
        kind === "phd" || String(outRow.degree_type || "").includes("博士");

      const faculty = String(outRow.faculty_cn || "").trim();

      const medicalFacultyHit =
        commonMedicalFaculties.some((x) => faculty.includes(x)) ||
        (isMaster && masterOnlyMedicalFaculties.some((x) => faculty.includes(x))) ||
        (isPhd && phdOnlyMedicalFaculties.some((x) => faculty.includes(x)));

      const medicalKeywordHit = medicalKeywords.some((x) => hay.includes(x));

      const isMedical =
        String(outRow.discipline_group || "") === "医科" ||
        medicalFacultyHit ||
        medicalKeywordHit;

      let fee: number | null = null;
      let ruleKey = "";
      let group = isMedical ? "医科" : "理工科";

      if (isMaster && isMedical) {
        fee = 48000;
        ruleKey = "master_medical";
      } else if (isMaster) {
        fee = 30000;
        ruleKey = "master_science_engineering";
      } else if (isPhd && isMedical) {
        fee = 54000;
        ruleKey = "phd_medical";
      } else if (isPhd) {
        fee = 37000;
        ruleKey = "phd_science_engineering";
      }

      if (fee != null) {
        outRow.discipline_group = group;
        outRow.tuition_rmb_per_year = fee;
        outRow.tuition_is_per_year = true;
        outRow.tuition_rule_key = ruleKey;
        outRow.tuition_note = `中文授课项目；${isMaster ? "硕士" : "博士"}${group} ${fee.toLocaleString("en-US")} RMB/Year`;
        outRow.tags = buildRowTags(outRow);
      }

      return outRow;
    });

    console.log("[FUDAN_GRAD_SCIMED_FORCE_TUITION_APPLIED_V2]", {
      kind,
      rows: mergedCatalogFinal.length,
      withTuition: mergedCatalogFinal.filter((r: any) => r?.tuition_rmb_per_year != null).length,
      science: mergedCatalogFinal.filter((r: any) => String(r?.discipline_group || "") === "理工科").length,
      medical: mergedCatalogFinal.filter((r: any) => String(r?.discipline_group || "") === "医科").length,
      first: mergedCatalogFinal[0] || null,
      firstMedical:
        mergedCatalogFinal.find((r: any) => String(r?.discipline_group || "") === "医科") || null,
    });
  }
}
// ===== FUDAN_GRAD_SCIMED_FORCE_TUITION_END =====



// 复旦研究生理工医科菁英项目：最终兜底强制写学费
// 硕士理工科 30000，硕士医科 48000；博士理工科 37000，博士医科 54000
if (
  isFudanGradSciMedContext &&
  (kind === "master" || kind === "phd")
) {
  const isFudanGradScimedRows =
    Array.isArray(mergedCatalogFinal) &&
    mergedCatalogFinal.some((r: any) =>
      String(r?.raw_line || "").includes("学术学位") ||
      String(r?.raw_line || "").includes("专业学位") ||
      String(r?.faculty_cn || "").includes("数学科学学院") ||
      String(r?.faculty_cn || "").includes("基础医学院") ||
      String(r?.faculty_cn || "").includes("护理学院") ||
      String(r?.faculty_cn || "").includes("公共卫生学院")
    );

  if (isFudanGradScimedRows) {
    const medicalRe =
      /(医学|医科|药学|护理|公共卫生|预防医学|流行病|卫生统计|放射医学|影像医学|核医学|神经|生理|病原|生物医学|临床|疾病|肿瘤|免疫|中西医结合|医院|基础医学院|护理学院|公共卫生学院|生物医学工程|影像医学与核医学|健康|卫生|PET|CT|超声|诊断|感染|疫苗)/;

    mergedCatalogFinal = mergedCatalogFinal.map((row: any) => {
      const outRow: any = { ...(row || {}) };

      const hay = [
        outRow.faculty_cn,
        outRow.program_name_cn,
        outRow.track_name_cn,
        outRow.raw_line,
        outRow.raw_block,
      ]
        .filter(Boolean)
        .join(" ");

      const isMedical = String(outRow.discipline_group || "") === "医科" || medicalRe.test(hay);
      const isMaster = kind === "master" || String(outRow.degree_type || "").includes("硕士");
      const isPhd = kind === "phd" || String(outRow.degree_type || "").includes("博士");

      let fee: number | null = null;
      let ruleKey = "";

      if (isMaster && isMedical) {
        fee = 48000;
        ruleKey = "master_medical";
      } else if (isMaster) {
        fee = 30000;
        ruleKey = "master_science_engineering";
      } else if (isPhd && isMedical) {
        fee = 54000;
        ruleKey = "phd_medical";
      } else if (isPhd) {
        fee = 37000;
        ruleKey = "phd_science_engineering";
      }

      if (fee != null) {
        outRow.discipline_group = isMedical ? "医科" : "理工科";
        outRow.tuition_rmb_per_year = fee;
        outRow.tuition_is_per_year = true;
        outRow.tuition_rule_key = ruleKey;
        outRow.tuition_note = `中文授课项目；${isMaster ? "硕士" : "博士"}${isMedical ? "医科" : "理工科"} ${fee.toLocaleString("en-US")} RMB/Year`;
        outRow.tags = buildRowTags(outRow);
      }

      return outRow;
    });

    console.log("[FUDAN_GRAD_SCIMED_FORCE_ALL_TUITION_FINAL]", {
      kind,
      rows: mergedCatalogFinal.length,
      withTuition: mergedCatalogFinal.filter((r: any) => r?.tuition_rmb_per_year != null).length,
      first: mergedCatalogFinal[0] || null,
      firstMedical: mergedCatalogFinal.find((r: any) => r?.discipline_group === "医科") || null,
    });
  }
}


// 通用费用政策应用：按 文科/理科/商科/医学 分类写入学费，本科/硕士/博士通用
const activeGenericTuitionPolicy =
  genericTuitionPolicy ||
  nextMeta2?.tuition_policy ||
  prevMeta2?.tuition_policy ||
  null;

if (
  kind === "ug" &&
  linkPurpose === "tuition" &&
  activeGenericTuitionPolicy &&
  String(activeGenericTuitionPolicy?.parser || "").includes("generic_tuition_policy_page") &&
  Array.isArray(activeGenericTuitionPolicy?.rules) &&
  Array.isArray(mergedCatalogFinal) &&
  mergedCatalogFinal.length > 0
) {
  const ruleMap = new Map<string, any>();
  for (const rule of activeGenericTuitionPolicy.rules || []) {
    const g = String(rule?.group || "").trim();
    if (g) ruleMap.set(g, rule);
  }

  mergedCatalogFinal = mergedCatalogFinal.map((row: any) => {
    const outRow: any = { ...(row || {}) };

    const classified = classifyTuitionGroup({
      faculty_cn: outRow.faculty_cn,
      faculty_en: outRow.faculty_en,
      program_name_cn: outRow.program_name_cn,
      program_name_en: outRow.program_name_en,
      track_name_cn: outRow.track_name_cn,
      track_name_en: outRow.track_name_en,
      csca_subjects_text: outRow.csca_subjects_text,
      raw_text: outRow.raw_line || outRow.raw_block,
    });

    const rule = ruleMap.get(classified.tuition_group);
    if (!rule) {
      outRow.tuition_group = classified.tuition_group;
      outRow.discipline_category = classified.category;
      outRow.tuition_classify_needs_review = true;
      outRow.tags = buildRowTags(outRow);
      return outRow;
    }

    const amount = Number(rule?.tuition_rmb_per_year);
    if (Number.isFinite(amount) && amount >= 10000 && amount <= 300000) {
      outRow.tuition_rmb_per_year = amount;
      outRow.tuition_total_rmb = null;
      outRow.tuition_is_per_year = true;
      outRow.tuition_note =
        rule?.tuition_note ||
        `${classified.tuition_group} ${amount.toLocaleString("en-US")} RMB/Year`;
      outRow.tuition_source_url =
        activeGenericTuitionPolicy?.source_url ||
        mergedTuitionUrl ||
        outRow.tuition_source_url ||
        null;
    }

    outRow.tuition_group = classified.tuition_group;
    outRow.discipline_category = classified.category;
    outRow.discipline_category_confidence = classified.confidence;
    outRow.discipline_category_keywords = classified.matched_keywords;
    outRow.tuition_classify_needs_review = classified.needs_review;
    outRow.tags = buildRowTags(outRow);

    return outRow;
  });

  console.log("[GENERIC_TUITION_POLICY_APPLIED]", {
    kind,
    rows: mergedCatalogFinal.length,
    rules: activeGenericTuitionPolicy.rules,
    withTuition: mergedCatalogFinal.filter((r: any) => r?.tuition_rmb_per_year != null).length,
    reviewNeeded: mergedCatalogFinal.filter((r: any) => r?.tuition_classify_needs_review === true).length,
    firstWithTuition: mergedCatalogFinal.find((r: any) => r?.tuition_rmb_per_year != null) || null,
  });
}


console.log("[AFTER_TUITION_PATCH_DEBUG]", {
  kind,
  linkPurpose,
  tuitionPatchMapSize: tuitionPatchMap?.size || 0,
  rows: Array.isArray(mergedCatalogFinal) ? mergedCatalogFinal.length : -1,
  withTuition: Array.isArray(mergedCatalogFinal)
    ? mergedCatalogFinal.filter((r: any) => r?.tuition_rmb_per_year != null).length
    : -1,
  firstWithTuition: Array.isArray(mergedCatalogFinal)
    ? mergedCatalogFinal.find((r: any) => r?.tuition_rmb_per_year != null) || null
    : null,
});

    if (
  kind === "ug" &&
  mergedTuitionUrl &&
  String(mergedTuitionUrl).includes("isc.sjtu.edu.cn/CN/content.aspx") &&
  Array.isArray(mergedCatalogFinal) &&
  mergedCatalogFinal.length > 0
) {
  mergedCatalogFinal = mergedCatalogFinal.map((row: any) => {
    const outRow: any = { ...(row || {}) };

    // 2026 上海交通大学国际本科生中文项目：24,800 元/学年
    // SJTU 2026 国际本科生中文项目收费页：学费为 24,800 元/学年
// 仅当 URL 命中 isc.sjtu.edu.cn/CN/content.aspx 且 kind === "ug" 时兜底补齐
    if (outRow.tuition_rmb_per_year == null) {
      outRow.tuition_rmb_per_year = 24800;
      outRow.tuition_is_per_year = true;
      outRow.tuition_note = "24,800 RMB/Year";
    }

    outRow.tuition_source_url =
      mergedTuitionUrl || outRow.tuition_source_url || null;

    outRow.tags = buildRowTags(outRow);

    return outRow;
  });

  console.log("[SJTU_UG_TUITION_FIXED_24800]", {
    rows: mergedCatalogFinal.length,
    hasTuition: mergedCatalogFinal.filter(
      (r: any) => r?.tuition_rmb_per_year != null,
    ).length,
    mergedTuitionUrl,
  });
}


    // ✅ 复旦研究生理工医科菁英项目：最终去重，避免博士 PDF 导师行把目录拆爆
    if (
      isFudanGradSciMedContext &&
      (kind === "master" || kind === "phd") &&
      Array.isArray(mergedCatalogFinal) &&
      mergedCatalogFinal.length > 0 &&
      mergedCatalogFinal.some((r: any) =>
        String(r?.raw_line || "").includes("全日制") ||
        String(r?.faculty_cn || "").includes("数学科学学院") ||
        String(r?.faculty_cn || "").includes("基础医学院") ||
        String(r?.faculty_cn || "").includes("护理学院") ||
        String(r?.faculty_cn || "").includes("公共卫生学院")
      )
    ) {
      const beforeDedupe = mergedCatalogFinal.length;
      mergedCatalogFinal = dedupeFudanGradSciMedCatalogRows(mergedCatalogFinal);
      console.log("[FUDAN_GRAD_SCIMED_DEDUPE_FINAL]", {
        kind,
        before: beforeDedupe,
        after: mergedCatalogFinal.length,
        removed: beforeDedupe - mergedCatalogFinal.length,
        first: mergedCatalogFinal[0] || null,
      });
    }

    if (Array.isArray(mergedCatalogFinal) && mergedCatalogFinal.length > 0) {
      const activeApplyGuideForRows =
        applyGuidePolicy ||
        applyGuideParsed ||
        nextMeta2?.apply_guide_policy ||
        prevMeta2?.apply_guide_policy ||
        nextMeta2?.apply_guide ||
        prevMeta2?.apply_guide ||
        null;

      mergedCatalogFinal = mergedCatalogFinal.map((row: any, i: number) => ({
        ...normalizeCatalogRowForDisplay(row, kind, activeApplyGuideForRows),
        idx: i + 1,
      }));
    }

    if (
      Array.isArray(mergedCatalogFinal) &&
      mergedCatalogFinal.length > 0 &&
      (
        docClass?.doc_type === "sjtu_doctor_catalog" ||
        docClass?.doc_type === "sjtu_master_catalog"
      )
    ) {
      mergedCatalogFinal = repairSjtuFacultyNames(mergedCatalogFinal);
      mergedCatalogFinal = cleanupSjtuCatalogRows(mergedCatalogFinal, kind);
    }

    const applyRequirementsOnly =
      linkPurpose === "apply_guide" || kind === "apply_guide"
        ? extractApplyRequirementsOnly(raw_text)
        : null;

    if (
      Array.isArray(mergedCatalogFinal) &&
      mergedCatalogFinal.length > 0
    ) {
      mergedCatalogFinal = mergedCatalogFinal.map((row: any) => {
        const outRow: any = { ...(row || {}) };

        if (applyRequirementsOnly) {
          outRow.apply_requirements_text = applyRequirementsOnly;
        } else if (isCatalogUpload && uploadHasCatalogRows) {
          // 目录重新上传时清掉之前申请条件页污染到行上的内容
          outRow.apply_requirements_text = null;
        } else if (typeof outRow.apply_requirements_text === "string") {
          const cleaned = extractApplyRequirementsOnly(outRow.apply_requirements_text);
          outRow.apply_requirements_text = cleaned || null;
        }

        // 非收费上传只清理没有金额的行；已有学费的行不能被申请条件页清空
        if (linkPurpose !== "tuition" && outRow.tuition_rmb_per_year == null) {
          outRow.tuition_source_url = null;
          outRow.tuition_note = null;
          outRow.tuition_is_per_year = null;
        }

        outRow.tags = buildRowTags(outRow);
        return outRow;
      });
    }

    const normalizedStudyLang =
      studyLanguageRaw === "en" || studyLanguage === "英文"
        ? "en"
        : studyLanguageRaw === "zh" || studyLanguage === "中文"
          ? "zh"
          : "";

    const normalizedLanguageText =
      normalizedStudyLang === "en"
        ? "英文"
        : normalizedStudyLang === "zh"
          ? "中文"
          : "";

    const normalizedDegreeType =
      kind === "ug"
        ? "本科"
        : kind === "master"
          ? "硕士"
          : kind === "phd"
            ? "博士"
            : "";

    if (Array.isArray(mergedCatalogFinal)) {
      mergedCatalogFinal = mergedCatalogFinal
        .map((row: any) => {
          const next = {
            ...(row || {}),
            kind: row?.kind || kind || "",
            degree_type: row?.degree_type || normalizedDegreeType || "",
            study_language: row?.study_language || normalizedStudyLang || "",
            language_text: row?.language_text || normalizedLanguageText || "",
          };

          const tuitionNoteText = String(next?.tuition_note || "").trim();

          if (tuitionNoteText) {
            const m = tuitionNoteText.match(
              /([1-9]\d{3,5}(?:,\d{3})?)\s*(?:RMB|人民币|元)?\s*(?:\/\s*Year|\/\s*年|per\s*year|\/年|学年|每学年)?/i,
            );

            const n = m ? Number(String(m[1]).replace(/,/g, "")) : null;

            if (n != null && Number.isFinite(n) && n >= 10000 && n <= 300000) {
              next.tuition_rmb_per_year = n;
              next.tuition_is_per_year = true;
            }
          }

          if (next.tuition_rmb_per_year != null) {
            const tn = Number(next.tuition_rmb_per_year);
            if (!Number.isFinite(tn) || tn < 10000 || tn > 300000) {
              next.tuition_rmb_per_year = null;
              next.tuition_is_per_year = null;
            }
          }

          if (
            !tuitionNoteText &&
            next.tuition_rmb_per_year != null &&
            Number.isFinite(Number(next.tuition_rmb_per_year))
          ) {
            next.tuition_note = `${Number(next.tuition_rmb_per_year).toLocaleString("en-US")} RMB/Year`;
          }

          if (next.duration_years == null) {
            const durationHit =
              parseDurationYearsLoose(next.raw_block) ??
              parseDurationYearsLoose(next.raw_line) ??
              parseDurationYearsLoose(next.raw) ??
              parseDurationYearsLoose(
                [
                  next.program_name_cn,
                  next.program_name_en,
                  next.remarks,
                  next.contact_raw,
                  next.tuition_note,
                ]
                  .filter(Boolean)
                  .join(" "),
              );

            if (durationHit != null) {
              next.duration_years = durationHit;
            }
          }

          return next;
        })
        .filter((row: any) => {
          const majorCode = String(row?.major_code || "").trim();
          const faculty = String(row?.faculty_cn || "").trim();
          const cn = String(row?.program_name_cn || "").trim();
          const en = String(row?.program_name_en || "").trim();
          const tuition = row?.tuition_rmb_per_year;

          const cnInvalid =
            !cn ||
            cn === majorCode ||
            /^\d+$/.test(cn) ||
            cn === faculty;

          const enInvalid =
            !en ||
            /^\d+$/.test(en) ||
            /(?:email|tel|phone|contact|campus)/i.test(en);

          const tuitionInvalid =
            tuition != null &&
            (
              !Number.isFinite(Number(tuition)) ||
              Number(tuition) < 10000 ||
              Number(tuition) > 300000
            );

          if (tuitionInvalid) return false;
          if (cnInvalid && enInvalid) return false;

          return true;
        })
        .map((row: any, i: number) => ({
          ...(row || {}),
          idx: i + 1,
        }));
    }

    let ugSanitizeDebug: any = null;

    const finalParserName = String(
      nextMeta2?.parser || prevMeta2?.parser || "",
    ).trim();

    if (
      !zjuForced &&
      kind === "ug" &&
      Array.isArray(mergedCatalogFinal) &&
      finalParserName !== "zju_iczu_ug" &&
      finalParserName !== "generic_table_pdf_v1" &&
      finalParserName !== "generic_bilingual_catalog_pdf_v1" &&
      finalParserName !== "generic_bilingual_catalog_fixed_column_v3" &&
      finalParserName !== "generic_bilingual_catalog_gap_state_v4" &&
      finalParserName !== "generic_bilingual_catalog_gap_state_v5_repair" &&
      finalParserName !== "generic_bilingual_catalog_state_machine_v2" &&
      finalParserName !== "sjtu_undergrad_catalog_special_v1"
    ) {
      const beforeN = mergedCatalogFinal.length;

      const sanitized = sanitizeUgCatalog(mergedCatalogFinal);
      const finalList =
        Array.isArray(sanitized) && sanitized.length > 0
          ? sanitized
          : mergedCatalogFinal;

      const afterN = finalList.length;
      ugSanitizeDebug = {
        stage: "post_merge",
        beforeN,
        afterN,
        removed: beforeN - afterN,
        sanitizeReturnedN: Array.isArray(sanitized) ? sanitized.length : -1,
        fallbackKeptBefore:
          Array.isArray(sanitized) && sanitized.length === 0 && beforeN > 0,
      };

      mergedCatalogFinal = finalList;
      console.log("[ug_sanitize_debug post_merge]", ugSanitizeDebug);
    }
   
    
    const finalTableHeader =
      Array.isArray(nextMeta2?.table_header) &&
      nextMeta2.table_header.length > 0
        ? nextMeta2.table_header
        : Array.isArray(prevMeta2?.table_header)
          ? prevMeta2.table_header
          : [];

          if (
  isSupplementUpload &&
  Array.isArray(prevCatalog) &&
  prevCatalog.length > 0 &&
  (!Array.isArray(mergedCatalogFinal) || mergedCatalogFinal.length === 0)
) {
  console.warn("[SUPPLEMENT_UPLOAD_RESTORE_PREV_CATALOG]", {
    kind,
    linkPurpose,
    prevCatalogLen: prevCatalog.length,
    finalBeforeRestore: Array.isArray(mergedCatalogFinal) ? mergedCatalogFinal.length : -1,
  });
  mergedCatalogFinal = prevCatalog;
}

if (Array.isArray(mergedCatalogFinal) && mergedCatalogFinal.length > 0) {
  mergedCatalogFinal = mergedCatalogFinal.map((row: any, i: number) => ({
    ...(row || {}),
    apply_requirements_text: cleanApplyRequirementsTextForRow(row?.apply_requirements_text),
    tuition_source_url:
      linkPurpose === "apply_guide"
        ? (prevMeta2?.tuition_source_url || row?.tuition_source_url || null)
        : (row?.tuition_source_url || null),
    idx: i + 1,
  }));
}


// ===== FINAL_NON_TUITION_CLEANUP_START =====
// 非收费上传不能把 source_url 当收费 PDF 扩散。
// 但已有学费的行必须保留学费和收费来源，避免申请条件页把学费清空。
if (
  linkPurpose !== "tuition" &&
  Array.isArray(mergedCatalogFinal) &&
  mergedCatalogFinal.length > 0
) {
  mergedCatalogFinal = mergedCatalogFinal.map((row: any) => {
    const outRow: any = { ...(row || {}) };

    if (outRow.tuition_rmb_per_year == null) {
      outRow.tuition_note = null;
      outRow.tuition_is_per_year = null;
      outRow.tuition_source_url = null;
    }

    outRow.tags = buildRowTags(outRow);
    return outRow;
  });

  console.log("[FINAL_NON_TUITION_CLEANUP]", {
    kind,
    linkPurpose,
    rows: mergedCatalogFinal.length,
    withTuition: mergedCatalogFinal.filter((r: any) => r?.tuition_rmb_per_year != null).length,
    withTuitionUrl: mergedCatalogFinal.filter((r: any) => String(r?.tuition_source_url || "").trim()).length,
    first: mergedCatalogFinal[0] || null,
    firstWithTuition: mergedCatalogFinal.find((r: any) => r?.tuition_rmb_per_year != null) || null,
  });
}
// ===== FINAL_NON_TUITION_CLEANUP_END =====


// ===== NJU_MASTER_APPLY_REQUIREMENTS_FIX_START =====
// 南京大学硕士申请条件：不要把整页申请指南塞进每个专业。
// 只写入页面需要的“入学要求”字段，并按授课语言/学科大类拆分。
if (
  kind === "master" &&
  Array.isArray(mergedCatalogFinal) &&
  mergedCatalogFinal.length > 0 &&
  (
    String(source_url || "").includes("hwxy.nju.edu.cn") ||
    String(raw_text || "").includes("南京大学") ||
    mergedCatalogFinal.some((r: any) =>
      String(r?.raw_line || r?.raw_block || "").includes("南京大学")
    )
  )
) {
  const njuIsEnglishRow = (row: any) => {
    const t = [
      row?.study_language,
      row?.language_text,
      row?.raw_line,
      row?.raw_block,
    ].filter(Boolean).join(" ");
    return /\ben\b/i.test(t) || t.includes("英文") || t.includes("英语");
  };

  const njuIsScienceLikeRow = (row: any) => {
    const hay = [
      row?.faculty_cn,
      row?.program_name_cn,
      row?.track_name_cn,
      row?.remarks_text,
      row?.raw_line,
      row?.raw_block,
    ].filter(Boolean).join(" ");

    return /数学|物理|化学|天文|地理|地质|大气|海洋|生物|生态|环境|计算机|软件|人工智能|电子|信息|工程|材料|能源|建筑|城乡规划|医学|药学|护理|公共卫生|临床|口腔|基础医学院|医学院|药学院|护理学院|公共卫生/.test(hay);
  };

  const njuBuildReq = (row: any) => {
    const base = "非中国籍；身体健康；年龄一般不超过40岁；具有学士学位或同等学力";

    if (njuIsEnglishRow(row)) {
      return base + "；英文授课入学要求：IELTS 6.0及以上，TOEFL 85分或TOEFL Essentials 9分及以上，Duolingo 100分及以上。";
    }

    if (njuIsScienceLikeRow(row)) {
      return base + "；中文授课理科入学要求：HSK 4级180分以上。";
    }

    return base + "；中文授课文科入学要求：HSK 5级180分以上。";
  };

  mergedCatalogFinal = mergedCatalogFinal.map((row: any) => {
    const outRow: any = { ...(row || {}) };
    outRow.apply_requirements_text = njuBuildReq(outRow);
    return outRow;
  });

  console.log("[NJU_MASTER_APPLY_REQUIREMENTS_FIX]", {
    kind,
    rows: mergedCatalogFinal.length,
    first: mergedCatalogFinal[0] || null,
    firstEnglish:
      mergedCatalogFinal.find((r: any) =>
        String(r?.language_text || r?.study_language || "").includes("英文") ||
        String(r?.study_language || "").toLowerCase() === "en"
      ) || null,
    firstScience:
      mergedCatalogFinal.find((r: any) =>
        /数学|物理|化学|计算机|软件|工程|医学|药学|护理|公共卫生/.test(
          [r?.faculty_cn, r?.program_name_cn, r?.raw_line, r?.raw_block].filter(Boolean).join(" ")
        )
      ) || null,
  });
}
// ===== NJU_MASTER_APPLY_REQUIREMENTS_FIX_END =====


// ===== NJU_MASTER_TUITION_FILL_START =====
// 南京大学硕士专业目录：目录 PDF 里大部分行没有显式学费，
// 但页面需要按学科大类展示学费。这里给 master 专用兜底，避免只剩“备注里自带学费”的 1 行。
// 后续如官方费用页金额不同，只改下面 NJU_MASTER_TUITION_BY_GROUP 即可。
if (
  kind === "master" &&
  linkPurpose === "catalog" &&
  Array.isArray(mergedCatalogFinal) &&
  mergedCatalogFinal.length > 0 &&
  (
    String(source_url || "").includes("hwxy.nju.edu.cn") ||
    String(raw_text || "").includes("南京大学") ||
    mergedCatalogFinal.some((r: any) =>
      String(r?.faculty_cn || "").includes("哲学学院") ||
      String(r?.faculty_cn || "").includes("新闻传播学院")
    )
  )
) {
  const NJU_MASTER_TUITION_BY_GROUP: Record<string, number> = {
    文科: 21000,
    理科: 24000,
    商科: 24000,
    医科: 24000,
  };

  const classifyNjuMasterTuitionGroup = (row: any) => {
    const hay = [
      row?.faculty_cn,
      row?.program_name_cn,
      row?.track_name_cn,
      row?.remarks_text,
      row?.raw_line,
      row?.raw_block,
    ]
      .filter(Boolean)
      .join(" ");

    if (
      /(医|医学|药学|护理|公共卫生|卫生|临床|口腔|基础医学|生物医学|病理|免疫|流行病|影像|放射|麻醉|肿瘤)/.test(hay)
    ) {
      return "医科";
    }

    if (/(商学院|管理学院|工程管理|工商管理|会计|金融|经济|国际商务|审计|图书情报|旅游管理|公共管理)/.test(hay)) {
      return "商科";
    }

    if (
      /(数学|物理|化学|天文|地球|地理|大气|海洋|环境|生命|生物|计算机|软件|电子|信息|人工智能|工程|材料|能源|建筑|城乡规划|统计|数据|遥感|测绘|网络|控制|光学|声学)/.test(hay)
    ) {
      return "理科";
    }

    return "文科";
  };

  let filled = 0;
  let kept = 0;

  mergedCatalogFinal = mergedCatalogFinal.map((row: any) => {
    const outRow: any = { ...(row || {}) };

    const group = String(outRow.tuition_group || "").trim() || classifyNjuMasterTuitionGroup(outRow);
    const fee = NJU_MASTER_TUITION_BY_GROUP[group];

    if (outRow.tuition_rmb_per_year != null) {
      kept++;
      outRow.tuition_group = outRow.tuition_group || group;
      outRow.tuition_is_per_year = outRow.tuition_is_per_year ?? true;
      outRow.tuition_note =
        outRow.tuition_note ||
        `${Number(outRow.tuition_rmb_per_year).toLocaleString("en-US")} RMB/Year`;
      outRow.tags = buildRowTags(outRow);
      return outRow;
    }

    if (fee != null) {
      outRow.tuition_group = group;
      outRow.tuition_rmb_per_year = fee;
      outRow.tuition_total_rmb = null;
      outRow.tuition_is_per_year = true;
      outRow.tuition_note = `南京大学硕士${group} ${fee.toLocaleString("en-US")} RMB/Year`;
      outRow.tuition_source_url =
        String(outRow.tuition_source_url || "").trim() ||
        String(program_catalog_meta?.tuition_source_url || "").trim() ||
        String(source_url || "").trim() ||
        null;
      outRow.tags = buildRowTags(outRow);
      filled++;
    }

    return outRow;
  });

  console.log("[NJU_MASTER_TUITION_FILL]", {
    kind,
    rows: mergedCatalogFinal.length,
    filled,
    kept,
    withTuition: mergedCatalogFinal.filter((r: any) => r?.tuition_rmb_per_year != null).length,
    first: mergedCatalogFinal[0] || null,
    firstWithTuition:
      mergedCatalogFinal.find((r: any) => r?.tuition_rmb_per_year != null) || null,
  });
}
// ===== NJU_MASTER_TUITION_FILL_END =====


if (
  kind === "master" &&
  Array.isArray(mergedCatalogFinal) &&
  mergedCatalogFinal.length > 0 &&
  (
    String(source_url || "").includes("nju.edu.cn") ||
    String(source_url_raw || "").includes("nju.edu.cn") ||
    String(mergedCatalogFinal?.[0]?.tuition_source_url || "").includes("nju.edu.cn")
  )
) {
  mergedCatalogFinal = repairNjuMasterRowsByOfficialPdf(mergedCatalogFinal);
}


if (
  kind === "master" &&
  Array.isArray(mergedCatalogFinal) &&
  mergedCatalogFinal.length > 0 &&
  Array.isArray(forcedCatalogByDocClass) &&
  forcedCatalogByDocClass.length === 1 &&
  String((forcedMetaByDocClass as any)?.parser || "") === "nju_master_html_title_detail_v1"
) {
  mergedCatalogFinal = mergeNjuMasterHtmlDetailIntoCatalog(
    mergedCatalogFinal,
    forcedCatalogByDocClass,
  );
}


if (
  kind === "phd" &&
  Array.isArray(mergedCatalogFinal) &&
  mergedCatalogFinal.length > 0 &&
  String(source_url || source_url_raw || "").includes("hwxy.nju.edu.cn") &&
  String(source_url || source_url_raw || "").includes("/bsxm/sbzn/")
) {
  mergedCatalogFinal = applyNjuPhdApplyGuideToCatalog({
    rows: mergedCatalogFinal,
    rawText: raw_text,
    sourceUrl: source_url || source_url_raw || null,
  });
}


if (
  (kind === "ug" || kind === "master" || kind === "phd" || String(kind) === "foundation_bachelor") &&
  Array.isArray(mergedCatalogFinal) &&
  mergedCatalogFinal.length > 0 &&
  (
    String(source_url || source_url_raw || "").includes("cms.nju.edu.cn/hwxy/lxnd/xygl/xxfy/xf/") ||
    String(source_url || source_url_raw || "").includes("hwxy.nju.edu.cn/lxnd/xygl/xxfy/xf/")
  )
) {
  mergedCatalogFinal = applyNjuGeneralTuitionHtmlToCatalog({
    rows: mergedCatalogFinal,
    kind,
    sourceUrl: source_url || source_url_raw || null,
  });
}


if (
  kind === "phd" &&
  Array.isArray(mergedCatalogFinal) &&
  mergedCatalogFinal.length > 0 &&
  (
    String(source_url || source_url_raw || "").includes("nju.edu.cn") ||
    String(mergedCatalogFinal?.[0]?.tuition_source_url || "").includes("nju.edu.cn")
  )
) {
  mergedCatalogFinal = repairNjuPhdRows(mergedCatalogFinal);
}


if (
  (kind === "ug" || kind === "master" || kind === "phd" || String(kind) === "foundation_bachelor") &&
  Array.isArray(mergedCatalogFinal) &&
  mergedCatalogFinal.length > 0 &&
  (
    String(source_url || source_url_raw || "").includes("hwxy.nju.edu.cn/lxnd/xygl/xxfy/sqf/") ||
    String(source_url || source_url_raw || "").includes("cms.nju.edu.cn/hwxy/lxnd/xygl/xxfy/sqf/")
  )
) {
  mergedCatalogFinal = applyNjuApplicationFeeHtmlToCatalog({
    rows: mergedCatalogFinal,
    sourceUrl: source_url || source_url_raw || null,
  });
}






// ===== USTC_UG_APPLY_GUIDE_PATCH_CALL_START =====
{
  const ustcApplyGuideSignal = [
    String(source_url || ""),
    String(source_url_raw || ""),
    String(program_catalog_meta?.source_url || ""),
    String(raw_text || ""),
    JSON.stringify(program_catalog_meta || {}),
  ].join("\n");

  const hasUstc =
    ustcApplyGuideSignal.toLowerCase().includes("ic.ustc.edu.cn") ||
    ustcApplyGuideSignal.includes("中国科学技术大学");

  const hasFeeKeyword =
    ustcApplyGuideSignal.includes("学费") ||
    ustcApplyGuideSignal.includes("保险费") ||
    ustcApplyGuideSignal.includes("费用和奖学金") ||
    ustcApplyGuideSignal.includes("26000") ||
    ustcApplyGuideSignal.includes("800") ||
    ustcApplyGuideSignal.includes("Nav_x=5") ||
    ustcApplyGuideSignal.includes("nav_x=5");

  console.log("[USTC_UG_APPLY_GUIDE_PATCH_CHECK]", {
    kind,
    rows: Array.isArray(mergedCatalogFinal) ? mergedCatalogFinal.length : -1,
    hasUstc,
    hasFeeKeyword,
    source_url,
    source_url_raw,
    finalMetaSource: program_catalog_meta?.source_url || null,
    rawPreview: String(raw_text || "").slice(0, 200),
  });

  if (
    kind === "ug" &&
    Array.isArray(mergedCatalogFinal) &&
    mergedCatalogFinal.length > 0 &&
    hasUstc &&
    hasFeeKeyword
  ) {
    mergedCatalogFinal = applyUstcUgApplyGuideToCatalog({
      rows: mergedCatalogFinal,
      sourceUrl:
        source_url ||
        source_url_raw ||
        program_catalog_meta?.source_url ||
        "https://ic.ustc.edu.cn/v7info.php?Nav_x=5",
    });
  }
}
// ===== USTC_UG_APPLY_GUIDE_PATCH_CALL_END =====


// ===== USTC_GRAD_APPLY_SCHOLARSHIP_PATCH_CALL_START =====
{
  const ustcGradSignal = [
    String(source_url || ""),
    String(source_url_raw || ""),
    String(program_catalog_meta?.source_url || ""),
    String(raw_text || ""),
    JSON.stringify(program_catalog_meta || {}),
  ].join("\n");

  const hasUstc =
    ustcGradSignal.toLowerCase().includes("ic.ustc.edu.cn") ||
    ustcGradSignal.includes("中国科学技术大学");

  const hasGradApplyOrScholarship =
    ustcGradSignal.includes("Nav_x=9") ||
    ustcGradSignal.includes("nav_x=9") ||
    ustcGradSignal.includes("奖学金") ||
    ustcGradSignal.toLowerCase().includes("scholarship") ||
    ustcGradSignal.includes("35000") ||
    ustcGradSignal.includes("30000") ||
    ustcGradSignal.includes("800") ||
    ustcGradSignal.includes("7000") ||
    ustcGradSignal.includes("3000");

  console.log("[USTC_GRAD_APPLY_SCHOLARSHIP_PATCH_CHECK]", {
    kind,
    rows: Array.isArray(mergedCatalogFinal) ? mergedCatalogFinal.length : -1,
    hasUstc,
    hasGradApplyOrScholarship,
    source_url,
    source_url_raw,
    metaSource: program_catalog_meta?.source_url || null,
    rawPreview: String(raw_text || "").slice(0, 220),
  });

  if (
    (kind === "master" || kind === "phd") &&
    Array.isArray(mergedCatalogFinal) &&
    mergedCatalogFinal.length > 0 &&
    hasUstc &&
    hasGradApplyOrScholarship
  ) {
    mergedCatalogFinal = applyUstcGradApplyScholarshipToCatalog({
      rows: mergedCatalogFinal,
      kind,
      sourceUrl:
        source_url ||
        source_url_raw ||
        program_catalog_meta?.source_url ||
        "https://ic.ustc.edu.cn/v7info.php?Nav_x=9",
    });
  }
}
// ===== USTC_GRAD_APPLY_SCHOLARSHIP_PATCH_CALL_END =====


// ===== USTC_PHD_FORCE_MERGED_FINAL_START =====
try {
  const phdParserForFinal = String((parsed as any)?.program_catalog_meta?.parser || "");
  const phdRowsForFinal = Array.isArray((parsed as any)?.program_catalog)
    ? (parsed as any).program_catalog
    : [];

  if (
    kind === "phd" &&
    phdRowsForFinal.length > 50 &&
    (
      phdParserForFinal === "ustc_phd_bilingual_image_pdf_merge_v1" ||
      phdParserForFinal === "ustc_phd_zh_image_pdf_v1" ||
      phdParserForFinal === "ustc_phd_en_image_pdf_v1"
    )
  ) {
    mergedCatalogFinal = phdRowsForFinal.map((r: any, i: number) => ({
      ...r,
      idx: i + 1,
    }));

    console.log("[USTC_PHD_FORCE_MERGED_FINAL]", {
      parser: phdParserForFinal,
      rows: mergedCatalogFinal.length,
      first: mergedCatalogFinal[0] || null,
    });
  }
} catch (e) {
  console.error("[USTC_PHD_FORCE_MERGED_FINAL_ERR]", e);
}
// ===== USTC_PHD_FORCE_MERGED_FINAL_END =====


// ===== USTC_NON_DEGREE_RESEARCH_INTERNSHIP_PATCH_CALL_START =====
try {
  const ustcResearchInternshipSignal = [
    String(source_url || ""),
    String(source_url_raw || ""),
    String(program_catalog_meta?.source_url || ""),
    String(raw_text || ""),
  ].join("\n");

  const isUstcResearchInternship =
    (
      kind === "other" ||
      kind === "apply_guide"
    ) &&
    (
      ustcResearchInternshipSignal.includes("Nav_x=51") ||
      ustcResearchInternshipSignal.includes("nav_x=51") ||
      (
        ustcResearchInternshipSignal.includes("科研实习") &&
        ustcResearchInternshipSignal.includes("非学位")
      )
    ) &&
    (
      ustcResearchInternshipSignal.toLowerCase().includes("ic.ustc.edu.cn") ||
      ustcResearchInternshipSignal.includes("中国科学技术大学") ||
      ustcResearchInternshipSignal.includes("中科大")
    );

  console.log("[USTC_NON_DEGREE_RESEARCH_INTERNSHIP_PATCH_CHECK]", {
    kind,
    rowsBefore: Array.isArray(mergedCatalogFinal) ? mergedCatalogFinal.length : -1,
    isUstcResearchInternship,
    source_url,
    source_url_raw,
    rawPreview: String(raw_text || "").slice(0, 220),
  });

  if (isUstcResearchInternship) {
    const built = buildUstcResearchInternshipCatalog({
      sourceUrl:
        source_url ||
        source_url_raw ||
        program_catalog_meta?.source_url ||
        "https://ic.ustc.edu.cn/v7info.php?Nav_x=51",
    });

    mergedCatalogFinal = built.rows;
    (parsed as any).program_catalog = built.rows;
    (parsed as any).program_catalog_meta = {
      ...((parsed as any).program_catalog_meta || {}),
      ...built.meta,
    };
  }
} catch (e) {
  console.error("[USTC_NON_DEGREE_RESEARCH_INTERNSHIP_PATCH_ERR]", e);
}
// ===== USTC_NON_DEGREE_RESEARCH_INTERNSHIP_PATCH_CALL_END =====


// ===== USTC_UG_SCHOLARSHIP_PATCH_CALL_START =====
try {
  const ustcUgScholarshipSignal = [
    String(source_url || ""),
    String(source_url_raw || ""),
    String(program_catalog_meta?.source_url || ""),
    String(raw_text || ""),
  ].join("\n");

  const isUstcUgScholarship =
    kind === "ug" &&
    Array.isArray(mergedCatalogFinal) &&
    mergedCatalogFinal.length > 0 &&
    (
      ustcUgScholarshipSignal.includes("Nav_x=17") ||
      ustcUgScholarshipSignal.includes("nav_x=17") ||
      (
        ustcUgScholarshipSignal.includes("本科留学项目奖学金") &&
        ustcUgScholarshipSignal.includes("2500")
      )
    ) &&
    (
      ustcUgScholarshipSignal.toLowerCase().includes("ic.ustc.edu.cn") ||
      ustcUgScholarshipSignal.includes("中国科学技术大学") ||
      ustcUgScholarshipSignal.includes("中科大")
    );

  console.log("[USTC_UG_SCHOLARSHIP_PATCH_CHECK]", {
    kind,
    rowsBefore: Array.isArray(mergedCatalogFinal) ? mergedCatalogFinal.length : -1,
    isUstcUgScholarship,
    source_url,
    source_url_raw,
    rawPreview: String(raw_text || "").slice(0, 220),
  });

  if (isUstcUgScholarship) {
    mergedCatalogFinal = applyUstcUgScholarshipToCatalog({
      rows: mergedCatalogFinal,
      sourceUrl:
        source_url ||
        source_url_raw ||
        program_catalog_meta?.source_url ||
        "https://ic.ustc.edu.cn/v7info.php?Nav_x=17",
    });

    (parsed as any).program_catalog = mergedCatalogFinal;
    (parsed as any).program_catalog_meta = {
      ...((parsed as any).program_catalog_meta || {}),
      scholarship_source_url:
        source_url ||
        source_url_raw ||
        program_catalog_meta?.source_url ||
        "https://ic.ustc.edu.cn/v7info.php?Nav_x=17",
      scholarship_parser: "ustc_ug_scholarship_html_v1",
    };
  }
} catch (e) {
  console.error("[USTC_UG_SCHOLARSHIP_PATCH_ERR]", e);
}
// ===== USTC_UG_SCHOLARSHIP_PATCH_CALL_END =====


// ===== USTC_DEGREE_SPECIFIC_SCHOLARSHIP_PATCH_CALL_START =====
try {
  const ustcDegreeScholarshipSignal = [
    String(source_url || ""),
    String(source_url_raw || ""),
    String(program_catalog_meta?.source_url || ""),
    String(raw_text || ""),
  ].join("\n");

  const isUstcMasterScholarship =
    kind === "master" &&
    Array.isArray(mergedCatalogFinal) &&
    mergedCatalogFinal.length > 0 &&
    (
      ustcDegreeScholarshipSignal.includes("Nav_x=16") ||
      ustcDegreeScholarshipSignal.includes("nav_x=16") ||
      ustcDegreeScholarshipSignal.includes("硕士留学项目奖学金")
    );

  const isUstcPhdScholarship =
    kind === "phd" &&
    Array.isArray(mergedCatalogFinal) &&
    mergedCatalogFinal.length > 0 &&
    (
      ustcDegreeScholarshipSignal.includes("Nav_x=15") ||
      ustcDegreeScholarshipSignal.includes("nav_x=15") ||
      ustcDegreeScholarshipSignal.includes("博士留学项目奖学金")
    );

  console.log("[USTC_DEGREE_SPECIFIC_SCHOLARSHIP_PATCH_CHECK]", {
    kind,
    rowsBefore: Array.isArray(mergedCatalogFinal) ? mergedCatalogFinal.length : -1,
    isUstcMasterScholarship,
    isUstcPhdScholarship,
    source_url,
    source_url_raw,
    rawPreview: String(raw_text || "").slice(0, 220),
  });

  if (isUstcMasterScholarship || isUstcPhdScholarship) {
    mergedCatalogFinal = applyUstcDegreeSpecificScholarshipToCatalog({
      rows: mergedCatalogFinal,
      kind,
      sourceUrl:
        source_url ||
        source_url_raw ||
        program_catalog_meta?.source_url ||
        (kind === "phd"
          ? "https://ic.ustc.edu.cn/v7info.php?Nav_x=15"
          : "https://ic.ustc.edu.cn/v7info.php?Nav_x=16"),
    });

    (parsed as any).program_catalog = mergedCatalogFinal;
    (parsed as any).program_catalog_meta = {
      ...((parsed as any).program_catalog_meta || {}),
      scholarship_source_url:
        source_url ||
        source_url_raw ||
        program_catalog_meta?.source_url ||
        (kind === "phd"
          ? "https://ic.ustc.edu.cn/v7info.php?Nav_x=15"
          : "https://ic.ustc.edu.cn/v7info.php?Nav_x=16"),
      scholarship_parser: "ustc_degree_specific_scholarship_html_v1",
    };
  }
} catch (e) {
  console.error("[USTC_DEGREE_SPECIFIC_SCHOLARSHIP_PATCH_ERR]", e);
}
// ===== USTC_DEGREE_SPECIFIC_SCHOLARSHIP_PATCH_CALL_END =====


// ===== USTC_RESEARCH_INTERNSHIP_SCHOLARSHIP_PATCH_CALL_START =====
try {
  const internshipScholarshipSignal = [
    String(source_url || ""),
    String(source_url_raw || ""),
    String(program_catalog_meta?.source_url || ""),
    String(raw_text || ""),
  ].join("\n");

  const isUstcResearchInternshipScholarship =
    kind === "other" &&
    Array.isArray(mergedCatalogFinal) &&
    mergedCatalogFinal.length > 0 &&
    (
      internshipScholarshipSignal.includes("Nav_x=72") ||
      internshipScholarshipSignal.includes("nav_x=72") ||
      (
        internshipScholarshipSignal.includes("科研实习") &&
        internshipScholarshipSignal.includes("奖学金")
      )
    ) &&
    (
      internshipScholarshipSignal.toLowerCase().includes("ic.ustc.edu.cn") ||
      internshipScholarshipSignal.includes("中国科学技术大学") ||
      internshipScholarshipSignal.includes("中科大")
    );

  console.log("[USTC_RESEARCH_INTERNSHIP_SCHOLARSHIP_PATCH_CHECK]", {
    kind,
    rowsBefore: Array.isArray(mergedCatalogFinal) ? mergedCatalogFinal.length : -1,
    isUstcResearchInternshipScholarship,
    source_url,
    source_url_raw,
    rawPreview: String(raw_text || "").slice(0, 220),
  });

  if (isUstcResearchInternshipScholarship) {
    let baseRowsForInternshipScholarship = Array.isArray(mergedCatalogFinal)
      ? mergedCatalogFinal
      : [];

    if (baseRowsForInternshipScholarship.length === 0) {
      const builtInternship = buildUstcResearchInternshipCatalog({
        sourceUrl: "https://ic.ustc.edu.cn/v7info.php?Nav_x=51",
      });
      baseRowsForInternshipScholarship = builtInternship.rows;
    }

    mergedCatalogFinal = applyUstcResearchInternshipScholarshipToCatalog({
      rows: baseRowsForInternshipScholarship,
      sourceUrl:
        source_url ||
        source_url_raw ||
        program_catalog_meta?.source_url ||
        "https://ic.ustc.edu.cn/v7info.php?Nav_x=72",
    });

    (parsed as any).program_catalog = mergedCatalogFinal;
    (parsed as any).program_catalog_meta = {
      ...((parsed as any).program_catalog_meta || {}),
      scholarship_source_url:
        source_url ||
        source_url_raw ||
        program_catalog_meta?.source_url ||
        "https://ic.ustc.edu.cn/v7info.php?Nav_x=72",
      scholarship_parser: "ustc_research_internship_scholarship_html_v1",
    };
  }
} catch (e) {
  console.error("[USTC_RESEARCH_INTERNSHIP_SCHOLARSHIP_PATCH_ERR]", e);
}
// ===== USTC_RESEARCH_INTERNSHIP_SCHOLARSHIP_PATCH_CALL_END =====


// ===== WHU_UG_SCHOLARSHIP_AND_FEE_PATCH_CALL_START =====
try {
  const whuExtraDocSignal = [
    String(filenameForm || ""),
    String(out?.filename || ""),
    String(file?.name || ""),
    String(source_url || ""),
    String(source_url_raw || ""),
    String(raw_text || ""),
  ].join("\n");

  const isWhuUg =
    kind === "ug" &&
    Array.isArray(mergedCatalogFinal) &&
    mergedCatalogFinal.length > 0 &&
    (
      whuExtraDocSignal.includes("武汉大学") ||
      whuExtraDocSignal.includes("Wuhan University") ||
      whuExtraDocSignal.includes("WHU")
    );

  const isWhuScholarshipDoc =
    isWhuUg &&
    (
      whuExtraDocSignal.includes("奖学金申请信息") ||
      whuExtraDocSignal.includes("Scholarships Application Information") ||
      whuExtraDocSignal.includes("中国政府奖学金") ||
      whuExtraDocSignal.includes("International Chinese Language Teachers Scholarship")
    );

  const isWhuFeeDoc =
    isWhuUg &&
    (
      whuExtraDocSignal.includes("费用标准") ||
      whuExtraDocSignal.includes("Tuition Fees and Other Expenses") ||
      whuExtraDocSignal.includes("Tuition Fee(per academic year)") ||
      whuExtraDocSignal.includes("Medical Insurance Fee")
    );

  console.log("[WHU_UG_EXTRA_DOC_PATCH_CHECK]", {
    kind,
    rowsBefore: Array.isArray(mergedCatalogFinal) ? mergedCatalogFinal.length : -1,
    isWhuScholarshipDoc,
    isWhuFeeDoc,
    filenameForm,
    outFilename: out?.filename || null,
    rawPreview: String(raw_text || "").slice(0, 220),
  });

  if (isWhuScholarshipDoc) {
    mergedCatalogFinal = applyWhuUgScholarshipDocToCatalog({
      rows: mergedCatalogFinal,
      sourceName: out?.filename || file?.name || filenameForm || "附件三：奖学金申请信息.docx",
    });
    (parsed as any).program_catalog = mergedCatalogFinal;
  }

  if (isWhuFeeDoc) {
    mergedCatalogFinal = applyWhuUgFeeDocToCatalog({
      rows: mergedCatalogFinal,
      sourceName: out?.filename || file?.name || filenameForm || "附件四：武汉大学来华留学生费用标准.doc",
    });
    (parsed as any).program_catalog = mergedCatalogFinal;
  }

  if (isWhuScholarshipDoc || isWhuFeeDoc) {
    (parsed as any).program_catalog_meta = {
      ...((parsed as any).program_catalog_meta || {}),
      whu_extra_doc_patch: true,
      whu_extra_doc_filename: out?.filename || file?.name || filenameForm || null,
    };
  }
} catch (e) {
  console.error("[WHU_UG_EXTRA_DOC_PATCH_ERR]", e);
}
// ===== WHU_UG_SCHOLARSHIP_AND_FEE_PATCH_CALL_END =====



// ===== GENERIC_PROGRAM_CATALOG_SYNC_TO_FINAL_START =====
try {
  const genericParserNow = String((parsed as any)?.program_catalog_meta?.parser || "");
  const parsedRowsForGenericSync = Array.isArray((parsed as any)?.program_catalog)
    ? (parsed as any).program_catalog
    : [];

  if (
    genericParserNow === "generic_program_catalog_v1" &&
    Array.isArray(mergedCatalogFinal) &&
    mergedCatalogFinal.length === 0 &&
    parsedRowsForGenericSync.length > 0
  ) {
    mergedCatalogFinal = parsedRowsForGenericSync.map((r: any, i: number) => ({
      ...(r || {}),
      idx: i + 1,
    }));

    console.log("[GENERIC_PROGRAM_CATALOG_SYNC_TO_FINAL]", {
      rows: mergedCatalogFinal.length,
      first: mergedCatalogFinal[0] || null,
    });
  }

  if (
    !isLikelyTuitionPolicyOnlyPage({ rawText: raw_text, sourceUrl: source_url || source_url_raw || null, linkPurpose }) &&
    Array.isArray(mergedCatalogFinal) &&
    mergedCatalogFinal.length === 0 &&
    Array.isArray(nextCatalog) &&
    nextCatalog.length > 0
  ) {
    mergedCatalogFinal = nextCatalog.map((r: any, i: number) => ({
      ...(r || {}),
      idx: i + 1,
    }));

    (parsed as any).program_catalog = mergedCatalogFinal;

    console.log("[GENERIC_NEXT_CATALOG_SYNC_TO_FINAL]", {
      rows: mergedCatalogFinal.length,
      first: mergedCatalogFinal[0] || null,
    });
  }
} catch (e) {
  console.error("[GENERIC_PROGRAM_CATALOG_SYNC_TO_FINAL_ERR]", e);
}
// ===== GENERIC_PROGRAM_CATALOG_SYNC_TO_FINAL_END =====


// ===== FORCE_NEXT_CATALOG_TO_FINAL_BEFORE_GUIDE_START =====
try {
  const parserNow = String((parsed as any)?.program_catalog_meta?.parser || "");
  const isGenericCatalog = parserNow === "generic_program_catalog_v1";

  if (
    isGenericCatalog &&
    !isLikelyTuitionPolicyOnlyPage({ rawText: raw_text, sourceUrl: source_url || source_url_raw || null, linkPurpose }) &&
    Array.isArray(nextCatalog) &&
    nextCatalog.length > 0 &&
    Array.isArray(mergedCatalogFinal) &&
    mergedCatalogFinal.length < nextCatalog.length
  ) {
    const before = mergedCatalogFinal.length;

    mergedCatalogFinal = nextCatalog.map((r: any, i: number) => ({
      ...(r || {}),
      idx: i + 1,
    }));

    (parsed as any).program_catalog = mergedCatalogFinal;

    console.log("[FORCE_NEXT_CATALOG_TO_FINAL_BEFORE_GUIDE]", {
      before,
      after: mergedCatalogFinal.length,
      parserNow,
      first: mergedCatalogFinal[0] || null,
    });
  }
} catch (e) {
  console.error("[FORCE_NEXT_CATALOG_TO_FINAL_BEFORE_GUIDE_ERR]", e);
}
// ===== FORCE_NEXT_CATALOG_TO_FINAL_BEFORE_GUIDE_END =====


// ===== XJTU_GRAD_PHD_CATALOG_PARSE_START =====
function xjtuNormText(s: any) {
  return String(s || "")
    .replace(/\u00a0/g, " ")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function xjtuGradGroupByRow(row: any) {
  return getXjtuGradTuitionGroup({
    kind: String(row?.kind || "master") === "phd" ? "phd" : "master",
    faculty_cn: row?.faculty_cn,
    program_name_cn: row?.program_name_cn,
    degree_name_cn: row?.degree_name_cn,
    language_text: row?.language_text,
  });
}

function xjtuGradTuition(kindNow: string, langText: string, group: string) {
  return getXjtuGradTuitionRmbPerYear(
    kindNow === "phd" ? "phd" : "master",
    langText,
    group as any,
  );
}

function xjtuGradFeeNote(kindNow: string, langText: string, group: string, amount: number) {
  return getXjtuGradTuitionNote(
    kindNow === "phd" ? "phd" : "master",
    langText,
    group as any,
    amount,
  );
}

function parseXjtuPhdCatalogFromRaw(raw: string) {
  const t = xjtuNormText(raw);
  const start = t.indexOf("西安交通大学2026年国际学生招生目录（博士）");
  if (start < 0) return [];

  let end = t.indexOf("西安交通大学2026年国际学生招生目录（硕士）", start + 10);
  if (end < 0) end = t.indexOf("联系方式", start + 10);
  if (end < 0) end = t.length;

  const section = t.slice(start, end);
  const lines = section
    .split(/\n/g)
    .map((x) => x.trim())
    .filter(Boolean)
    .filter((x) => !/^(学院名称|专业名称|授课|语言|学制|授予学位|是否需要|导师拟接收函|类型|年）|\d+)$/.test(x));

  const facultyNames = [
    "材料科学与工程学院",
    "电气工程学院",
    "电子与信息学部-计算机科学与技术学院",
    "电子与信息学部-电子科学与工程学院",
    "电子与信息学部-微电子学院",
    "电子与信息学部-信息与通信工程学院",
    "电子与信息学部-自动化科学与工程学院",
    "电子与信息学部-网络空间安全学院",
    "电子与信息学部-软件学院",
    "法学院",
    "管理学院",
    "公共政策与管理学院",
    "航天航空学院",
    "化学工程与技术学院",
    "化学学院",
    "机械工程学院",
    "经济与金融学院",
    "能源与动力工程学院",
    "前沿科学技术研究院",
    "人文社会科学学院",
    "生命科学与技术学院",
    "数学与统计学院",
    "外国语学院",
    "医学部",
    "仪器科学与技术学院",
    "新闻与新媒体学院",
  ].sort((a, b) => b.length - a.length);

  const rows: any[] = [];
  let currentFaculty: string | null = null;
  let pendingLangDurationDegree: any | null = null;

  function addRow(faculty: string, program: string, lang: string, duration: number, degreeName: string, advisor: string | null, rawLine: string) {
    program = String(program || "").trim();
    if (!faculty || !program || !lang || !duration || !degreeName) return;
    if (/学院名称|专业名称|授课|语言|学制|授予学位|导师/.test(program)) return;

    const group = xjtuGradGroupByRow({ faculty_cn: faculty, program_name_cn: program, degree_name_cn: degreeName });
    const tuition = xjtuGradTuition("phd", lang, group);

    rows.push({
      idx: rows.length + 1,
      kind: "phd",
      faculty_cn: faculty,
      faculty_en: null,
      major_code: null,
      program_name_cn: program,
      program_name_en: null,
      degree_type: "博士",
      degree_kind: null,
      degree_name_cn: degreeName,
      language_text: lang,
      study_language: /英文/.test(lang) ? "en" : "zh",
      duration_years: duration,
      advisor_acceptance_required: advisor === "是" ? true : advisor === "否" ? false : null,
      tuition_group: group,
      tuition_rmb_per_year: tuition,
      tuition_is_per_year: true,
      tuition_total_rmb: null,
      tuition_note: xjtuGradFeeNote("phd", lang, group, tuition),
      tuition_source_url: "西安交大硕博.pdf",
      application_fee_rmb: 500,
      application_fee_note: "报名费：申请自费项目500 RMB；申请奖学金项目800 RMB；无论录取与否，报名费不予退还。",
      accommodation_fee_note: "住宿费：8000-19000 RMB/学年。",
      scholarship_note: "中国政府奖学金：免交学费、提供住宿、生活费和外国留学生在华综合医疗保险；西安交通大学硕博研究生国际学生新生奖学金：申请人在西安交通大学国际学生申请系统中提交申请，奖学金为学历阶段第一年；西安市政府“一带一路”外国留学生奖学金：申请人在西安交通大学国际学生申请系统中提交申请，奖学金为学历阶段第一年。",
      scholarship_coverage_text: "中国政府奖学金覆盖学费、住宿、生活费和综合医疗保险；西安交通大学硕博研究生国际学生新生奖学金和西安市政府“一带一路”外国留学生奖学金以学校通知为准。",
      raw_line: rawLine,
      raw_block: rawLine,
      tags: ["博士", /英文/.test(lang) ? "英文" : "中文", "XJTU硕博目录", "收费已填", "奖学金已填"],
    });
  }

  for (const line0 of lines) {
    let line = line0.replace(/\s+/g, " ").trim();
    if (!line) continue;

    let m = line.match(/^(中文|英文)\s+(\d+)\s+([\u4e00-\u9fff]+博士)\s+(是|否)$/);
    if (m) {
      pendingLangDurationDegree = {
        lang: m[1],
        duration: Number(m[2]),
        degree: m[3],
        advisor: m[4],
        raw: line,
      };
      continue;
    }

    let faculty = facultyNames.find((f) => line.startsWith(f));
    if (faculty) {
      currentFaculty = faculty;
      line = line.slice(faculty.length).trim();
    }

    m = line.match(/^(.+?)\s+(中文|英文)\s+(\d+)\s+([\u4e00-\u9fff]+博士)\s+(是|否)$/);
    if (m && currentFaculty) {
      addRow(currentFaculty, m[1].trim(), m[2], Number(m[3]), m[4], m[5], `${currentFaculty} ${line}`);
      pendingLangDurationDegree = null;
      continue;
    }

    if (pendingLangDurationDegree && currentFaculty && line && !/招生目录|项目信息|学院名称|专业名称/.test(line)) {
      addRow(
        currentFaculty,
        line.trim(),
        pendingLangDurationDegree.lang,
        pendingLangDurationDegree.duration,
        pendingLangDurationDegree.degree,
        pendingLangDurationDegree.advisor,
        `${currentFaculty} ${line} ${pendingLangDurationDegree.raw}`,
      );
      pendingLangDurationDegree = null;
      continue;
    }
  }

  return rows.map((r, i) => ({ ...r, idx: i + 1 }));
}

try {
  const isXjtuGradPhd =
    kind === "phd" &&
    /西安交通大学|西安交大|XJTU/i.test(String(raw_text || "")) &&
    /招生目录（博士）/.test(String(raw_text || ""));

  if (isXjtuGradPhd) {
    const phdRows = parseXjtuPhdCatalogFromRaw(String(raw_text || ""));

    if (phdRows.length > 0) {
      mergedCatalogFinal = phdRows;
      (parsed as any).program_catalog = phdRows;
      (parsed as any).program_catalog_meta = {
        ...((parsed as any).program_catalog_meta || {}),
        parser: "xjtu_grad_phd_catalog_v1",
        doc_type: "xjtu_grad_catalog_pdf",
        xjtu_grad_phd_rows: phdRows.length,
      };

      console.log("[XJTU_GRAD_PHD_CATALOG_PARSE]", {
        rows: phdRows.length,
        first: phdRows[0] || null,
      });
    }
  }
} catch (e) {
  console.error("[XJTU_GRAD_PHD_CATALOG_PARSE_ERR]", e);
}
// ===== XJTU_GRAD_PHD_CATALOG_PARSE_END =====


// ===== XJTU_GRAD_MASTER_CATALOG_PARSE_START =====
function parseXjtuMasterCatalogFromRaw(raw: string) {
  const t = xjtuNormText(raw);
  let start = t.indexOf("西安交通大学2026年国际学生招生目录（硕士）");
  if (start < 0) start = t.indexOf("招生目录（硕士）");
  if (start < 0) start = t.indexOf("硕士研究生国际学生招生目录");
  if (start < 0) {
    const i = t.indexOf("硕士");
    const j = t.indexOf("学院名称", Math.max(0, i));
    start = i >= 0 && j >= 0 ? Math.min(i, j) : -1;
  }
  if (start < 0) return [];

  let end = t.indexOf("联系方式", start + 10);
  if (end < 0) end = t.length;

  const section = t.slice(start, end);
  const lines = section
    .split(/\n/g)
    .map((x) => x.trim())
    .filter(Boolean)
    .filter((x) => !/^(学院名称|专业名称|授课|语言|学制|授予学位|是否需要|导师拟接收函|类型|年）|\d+)$/.test(x));

  const facultyNames = [
    "材料科学与工程学院",
    "电气工程学院",
    "电子与信息学部-计算机科学与技术学院",
    "电子与信息学部-电子科学与工程学院",
    "电子与信息学部-微电子学院",
    "电子与信息学部-信息与通信工程学院",
    "电子与信息学部-自动化科学与工程学院",
    "电子与信息学部-网络空间安全学院",
    "电子与信息学部-软件学院",
    "法学院",
    "管理学院",
    "公共政策与管理学院",
    "航天航空学院",
    "化学工程与技术学院",
    "化学学院",
    "机械工程学院",
    "经济与金融学院",
    "能源与动力工程学院",
    "前沿科学技术研究院",
    "人居环境与建筑工程学院",
    "人文社会科学学院",
    "生命科学与技术学院",
    "数学与统计学院",
    "外国语学院",
    "医学部",
    "仪器科学与技术学院",
    "新闻与新媒体学院",
    "药学院",
    "口腔医学院",
  ].sort((a, b) => b.length - a.length);

  const rows: any[] = [];
  let currentFaculty: string | null = null;
  let pendingLangDurationDegree: any | null = null;

  function addRow(faculty: string, program: string, lang: string, duration: number, degreeName: string, rawLine: string) {
    program = String(program || "").trim();
    if (!faculty || !program || !lang || !duration || !degreeName) return;
    if (/学院名称|专业名称|授课|语言|学制|授予学位|导师/.test(program)) return;

    const group = xjtuGradGroupByRow({ faculty_cn: faculty, program_name_cn: program, degree_name_cn: degreeName });
    const tuition = xjtuGradTuition("master", lang, group);

    rows.push({
      idx: rows.length + 1,
      kind: "master",
      faculty_cn: faculty,
      faculty_en: null,
      major_code: null,
      program_name_cn: program,
      program_name_en: null,
      degree_type: "硕士",
      degree_kind: null,
      degree_name_cn: degreeName,
      language_text: lang,
      study_language: /英文/.test(lang) ? "en" : "zh",
      duration_years: duration,
      tuition_group: group,
      tuition_rmb_per_year: tuition,
      tuition_is_per_year: true,
      tuition_total_rmb: null,
      tuition_note: xjtuGradFeeNote("master", lang, group, tuition),
      tuition_source_url: "西安交大硕博.pdf",
      application_fee_rmb: 500,
      application_fee_note: "报名费：申请自费项目500 RMB；申请奖学金项目800 RMB；无论录取与否，报名费不予退还。",
      accommodation_fee_note: "住宿费：8000-19000 RMB/学年。",
      scholarship_note: "中国政府奖学金：免交学费、提供住宿、生活费和外国留学生在华综合医疗保险；西安交通大学硕博研究生国际学生新生奖学金：申请人在西安交通大学国际学生申请系统中提交申请，奖学金为学历阶段第一年；西安市政府“一带一路”外国留学生奖学金：申请人在西安交通大学国际学生申请系统中提交申请，奖学金为学历阶段第一年。",
      scholarship_coverage_text: "中国政府奖学金覆盖学费、住宿、生活费和综合医疗保险；西安交通大学硕博研究生国际学生新生奖学金和西安市政府“一带一路”外国留学生奖学金以学校通知为准。",
      raw_line: rawLine,
      raw_block: rawLine,
      tags: ["硕士", /英文/.test(lang) ? "英文" : "中文", "XJTU硕博目录", "收费已填", "奖学金已填"],
    });
  }

  for (const line0 of lines) {
    let line = line0.replace(/\s+/g, " ").trim();
    if (!line) continue;

    // case: 中文 3 工学硕士 是
    let m = line.match(/^(中文|英文)\s+(\d+)\s+([\u4e00-\u9fff]+硕士)\s+(是|否)$/);
    if (m) {
      pendingLangDurationDegree = {
        lang: m[1],
        duration: Number(m[2]),
        degree: m[3],
        advisor: m[4],
        raw: line,
      };
      continue;
    }

    let faculty = facultyNames.find((f) => line.startsWith(f));
    if (faculty) {
      currentFaculty = faculty;
      line = line.slice(faculty.length).trim();
    }

    // case: faculty + program + lang duration degree advisor
    m = line.match(/^(.+?)\s+(中文|英文)\s+(\d+)\s+([\u4e00-\u9fff]+硕士)\s+(是|否)$/);
    if (m && currentFaculty) {
      addRow(currentFaculty, m[1].trim(), m[2], Number(m[3]), m[4], `${currentFaculty} ${line}`);
      pendingLangDurationDegree = null;
      continue;
    }

    // case: program line after pending language line
    if (pendingLangDurationDegree && currentFaculty && line && !/招生目录|项目信息|学院名称|专业名称/.test(line)) {
      addRow(
        currentFaculty,
        line.trim(),
        pendingLangDurationDegree.lang,
        pendingLangDurationDegree.duration,
        pendingLangDurationDegree.degree,
        `${currentFaculty} ${line} ${pendingLangDurationDegree.raw}`,
      );
      pendingLangDurationDegree = null;
      continue;
    }
  }

  return rows.map((r, i) => ({ ...r, idx: i + 1 }));
}

try {
  const isXjtuGradMaster =
    kind === "master" &&
    /西安交通大学|西安交大|XJTU/i.test(String(raw_text || "")) &&
    (/招生目录（硕士）/.test(String(raw_text || "")) ||
      /硕士研究生/.test(String(raw_text || "")) ||
      /硕士招生目录/.test(String(raw_text || "")));

  console.log("[XJTU_GRAD_MASTER_CATALOG_CHECK]", {
    kind,
    isXjtuGradMaster,
    hasXjtu: /西安交通大学|西安交大|XJTU/i.test(String(raw_text || "")),
    hasMasterTitle: /招生目录（硕士）/.test(String(raw_text || "")),
    hasMasterKeyword: /硕士研究生/.test(String(raw_text || "")),
    rawLen: String(raw_text || "").length,
    masterTitleIndex: String(raw_text || "").indexOf("招生目录（硕士）"),
  });

  if (isXjtuGradMaster) {
    const masterRows = parseXjtuMasterCatalogFromRaw(String(raw_text || ""));

    console.log("[XJTU_GRAD_MASTER_CATALOG_ROWS_CHECK]", {
      rows: masterRows.length,
      first: masterRows[0] || null,
    });

    if (masterRows.length > 0) {
      mergedCatalogFinal = masterRows;
      (parsed as any).program_catalog = masterRows;
      (parsed as any).program_catalog_meta = {
        ...((parsed as any).program_catalog_meta || {}),
        parser: "xjtu_grad_master_catalog_v1",
        doc_type: "xjtu_grad_catalog_pdf",
        xjtu_grad_master_rows: masterRows.length,
      };

      console.log("[XJTU_GRAD_MASTER_CATALOG_PARSE]", {
        rows: masterRows.length,
        first: masterRows[0] || null,
      });
    }
  }
} catch (e) {
  console.error("[XJTU_GRAD_MASTER_CATALOG_PARSE_ERR]", e);
}
// ===== XJTU_GRAD_MASTER_CATALOG_PARSE_END =====

// ===== GENERIC_ADMISSION_GUIDE_PATCH_START =====
try {
  const genericGuideSignal = [
    String(filenameForm || ""),
    String(out?.filename || ""),
    String(file?.name || ""),
    String(source_url || ""),
    String(source_url_raw || ""),
    String(raw_text || ""),
  ].join("\n");

  const looksLikeAdmissionGuide =
    (
      genericGuideSignal.includes("招生简章") ||
      genericGuideSignal.includes("申请资格") ||
      genericGuideSignal.includes("申请材料") ||
      genericGuideSignal.includes("申请流程") ||
      genericGuideSignal.includes("Application Materials") ||
      genericGuideSignal.includes("Application Procedure") ||
      genericGuideSignal.includes("Scholarship") ||
      genericGuideSignal.includes("Tuition Fee")
    ) &&
    !String((parsed as any)?.program_catalog_meta?.parser || "").includes("generic_admission_guide_v1");

  const shouldApplyGenericGuide =
    Array.isArray(mergedCatalogFinal) &&
    mergedCatalogFinal.length > 0 &&
    looksLikeAdmissionGuide;

  console.log("[GENERIC_ADMISSION_GUIDE_PATCH_CHECK]", {
    kind,
    rowsBefore: Array.isArray(mergedCatalogFinal) ? mergedCatalogFinal.length : -1,
    looksLikeAdmissionGuide,
    shouldApplyGenericGuide,
    filename: out?.filename || file?.name || filenameForm || null,
    rawPreview: String(raw_text || "").slice(0, 220),
  });

  if (shouldApplyGenericGuide) {
    const genericGuide = parseGenericAdmissionGuide(String(raw_text || ""), {
      filename: out?.filename || file?.name || filenameForm || null,
      sourceUrl: source_url || source_url_raw || null,
    });

    if (genericGuide.ok) {
      mergedCatalogFinal = applyGenericAdmissionGuidePatchToCatalog({
        rows: mergedCatalogFinal,
        patch: genericGuide.patch,
        sourceName: out?.filename || file?.name || filenameForm || null,
      });

      (parsed as any).program_catalog = mergedCatalogFinal;
      (parsed as any).program_catalog_meta = {
        ...((parsed as any).program_catalog_meta || {}),
        generic_admission_guide_patch: genericGuide.meta,
      };

      console.log("[GENERIC_ADMISSION_GUIDE_PATCH]", {
        rows: mergedCatalogFinal.length,
        meta: genericGuide.meta,
        patchKeys: Object.entries(genericGuide.patch)
          .filter(([_, v]) => v !== null && v !== undefined && String(v).trim() !== "")
          .map(([k]) => k),
        first: mergedCatalogFinal[0] || null,
      });
    }
  }
} catch (e) {
  console.error("[GENERIC_ADMISSION_GUIDE_PATCH_ERR]", e);
}
// ===== GENERIC_ADMISSION_GUIDE_PATCH_END =====




// ===== FINAL_REMOVE_NJU_TUITION_FROM_WHU_START =====
try {
  const finalWhuCleanSignal = [
    String(filenameForm || ""),
    String(out?.filename || ""),
    String(file?.name || ""),
    String(source_url || ""),
    String(source_url_raw || ""),
    String(raw_text || ""),
    JSON.stringify((parsed as any)?.program_catalog_meta || {}),
    JSON.stringify((Array.isArray(mergedCatalogFinal) ? mergedCatalogFinal.slice(0, 3) : [])),
  ].join("\n");

  const isWhuFinalContext =
    finalWhuCleanSignal.includes("武汉大学") ||
    finalWhuCleanSignal.includes("Wuhan University") ||
    finalWhuCleanSignal.includes("WHU") ||
    (
      Array.isArray(mergedCatalogFinal) &&
      mergedCatalogFinal.some((r: any) => {
        const tags = Array.isArray(r?.tags) ? r.tags.join(" ") : "";
        const raw = [
          r?.source_url,
          r?.raw_block,
          r?.raw_line,
          r?.faculty_cn,
          r?.faculty_en,
        ].map((x: any) => String(x || "")).join(" ");
        return tags.includes("WHU") || tags.includes("WHU_DOCX目录") || raw.includes("武汉大学") || raw.includes("Wuhan University");
      })
    );

  if (
    isWhuFinalContext &&
    (kind === "ug" || kind === "master" || kind === "phd" || String(kind) === "foundation_bachelor") &&
    Array.isArray(mergedCatalogFinal) &&
    mergedCatalogFinal.length > 0
  ) {
    let changed = 0;

    mergedCatalogFinal = mergedCatalogFinal.map((row: any) => {
      const r = { ...(row || {}) };
      const t = [
        r.tuition_note,
        r.tuition_source_url,
        r.fee_source_url,
        r.raw_fee_line,
      ].map((x: any) => String(x || "")).join("\n");

      if (
        t.includes("南京大学") ||
        t.includes("Nanjing University") ||
        t.includes("NJU")
      ) {
        changed += 1;

        r.tuition_rmb_per_year = null;
        r.tuition_total_rmb = null;
        r.tuition_is_per_year = null;
        r.tuition_group = null;
        r.tuition_note = null;
        r.tuition_source_url = null;
        r.fee_source_url = null;
        r.raw_fee_line = null;

        r.tags = Array.from(
          new Set([
            ...((Array.isArray(r.tags) ? r.tags : []) as any[]).filter((x: any) => {
              const s = String(x || "");
              return !s.includes("收费已填") && !s.includes("南京大学") && !s.includes("NJU");
            }),
            "收费待补",
          ]),
        );
      }

      return r;
    });

    if (changed > 0) {
      (parsed as any).program_catalog = mergedCatalogFinal;
      console.log("[FINAL_REMOVE_NJU_TUITION_FROM_WHU]", {
        kind,
        changed,
        rows: mergedCatalogFinal.length,
        first: mergedCatalogFinal[0] || null,
      });
    }
  }
} catch (e) {
  console.error("[FINAL_REMOVE_NJU_TUITION_FROM_WHU_ERR]", e);
}
// ===== FINAL_REMOVE_NJU_TUITION_FROM_WHU_END =====


// ===== WHU_GRAD_FEE_DOC_PATCH_CALL_START =====
try {
  const whuGradFeeSignal = [
    String(filenameForm || ""),
    String(out?.filename || ""),
    String(file?.name || ""),
    String(raw_text || ""),
  ].join("\n");

  const isWhuGradFeeDoc =
    (kind === "master" || kind === "phd") &&
    Array.isArray(mergedCatalogFinal) &&
    mergedCatalogFinal.length > 0 &&
    (
      whuGradFeeSignal.includes("附件五") ||
      whuGradFeeSignal.includes("国际学生费用标准") ||
      whuGradFeeSignal.includes("Tuition Fee and Costs for International Students") ||
      (
        whuGradFeeSignal.includes("Master") &&
        whuGradFeeSignal.includes("Doctoral") &&
        whuGradFeeSignal.includes("Tuition Fees")
      )
    ) &&
    (
      whuGradFeeSignal.includes("武汉大学") ||
      whuGradFeeSignal.includes("Wuhan University")
    );

  if (process.env.DEBUG_INGEST === "1") console.log("[WHU_GRAD_FEE_DOC_PATCH_CHECK]", {
    kind,
    rowsBefore: Array.isArray(mergedCatalogFinal) ? mergedCatalogFinal.length : -1,
    isWhuGradFeeDoc,
    filenameForm,
    outFilename: out?.filename || null,
    rawPreview: String(raw_text || "").slice(0, 220),
  });

  if (isWhuGradFeeDoc) {
    mergedCatalogFinal = applyWhuGradFeeDocToCatalog({
      rows: mergedCatalogFinal,
      kind,
      sourceName: out?.filename || file?.name || filenameForm || "附件五：武汉大学国际学生费用标准.docx",
      rawPolicyText: String(raw_text || ""),
    });

    (parsed as any).program_catalog = mergedCatalogFinal;
    (parsed as any).program_catalog_meta = {
      ...((parsed as any).program_catalog_meta || {}),
      whu_grad_fee_doc_patch: true,
      whu_grad_fee_doc_filename: out?.filename || file?.name || filenameForm || null,
    };
  }
} catch (e) {
  console.error("[WHU_GRAD_FEE_DOC_PATCH_ERR]", e);
}
// ===== WHU_GRAD_FEE_DOC_PATCH_CALL_END =====



// ===== FINAL_GENERIC_PROGRAM_CLEAN_START =====
try {
  const parserNowForProgramClean = String((parsed as any)?.program_catalog_meta?.parser || "");
  const isGenericProgramClean =
    parserNowForProgramClean === "generic_program_catalog_v1" ||
    Boolean((parsed as any)?.program_catalog_meta?.generic_admission_guide_patch);

  if (isGenericProgramClean && Array.isArray(mergedCatalogFinal) && mergedCatalogFinal.length > 0) {
    let changed = 0;

    mergedCatalogFinal = mergedCatalogFinal.map((row: any) => {
      const r = { ...(row || {}) };
      let program = String(r.program_name_cn || "").trim();
      const faculty = String(r.faculty_cn || "").trim();

      if (faculty && program.startsWith(faculty)) {
        program = program.slice(faculty.length).trim();
        changed += 1;
      }

      const nextProgram = program
        .replace(/\s*(中文|英文|Chinese|English)\s*$/i, "")
        .replace(/^项目\s*/i, "")
        .trim();

      if (nextProgram && nextProgram !== r.program_name_cn) {
        r.program_name_cn = nextProgram;
        changed += 1;
      }

      return r;
    });

    (parsed as any).program_catalog = mergedCatalogFinal;

    if (changed > 0) {
      console.log("[FINAL_GENERIC_PROGRAM_CLEAN]", {
        changed,
        rows: mergedCatalogFinal.length,
        first: mergedCatalogFinal[0] || null,
      });
    }
  }
} catch (e) {
  console.error("[FINAL_GENERIC_PROGRAM_CLEAN_ERR]", e);
}
// ===== FINAL_GENERIC_PROGRAM_CLEAN_END =====

// ===== FINAL_GENERIC_BAD_ROW_FILTER_START =====
try {
  const parserNowForFinalBadFilter = String((parsed as any)?.program_catalog_meta?.parser || "");
  const isGenericFinal =
    parserNowForFinalBadFilter === "generic_program_catalog_v1" ||
    Boolean((parsed as any)?.program_catalog_meta?.generic_admission_guide_patch);

  if (isGenericFinal && Array.isArray(mergedCatalogFinal) && mergedCatalogFinal.length > 0) {
    const before = mergedCatalogFinal.length;

    const cleanedFinal = mergedCatalogFinal.filter((r: any) => {
      const faculty = String(r?.faculty_cn || "");
      const program = String(r?.program_name_cn || "");
      const raw = `${faculty} ${program}`;

      if (/部项目|授课语言|授予学位类型|学院项目|项目授课语言|学制授予学位/.test(raw)) return false;
      if (/^(医学学士|工学学士|文学学士|理学学士|管理学学士|经济学学士|法学学士|艺术学学士|哲学学士)$/.test(faculty)) return false;
      if (!String(r?.program_name_cn || r?.program_name_en || "").trim()) return false;
      if (!r?.duration_years) return false;

      return true;
    }).map((r: any, i: number) => ({ ...(r || {}), idx: i + 1 }));

    if (cleanedFinal.length !== before) {
      mergedCatalogFinal = cleanedFinal;
      (parsed as any).program_catalog = cleanedFinal;

      console.log("[FINAL_GENERIC_BAD_ROW_FILTER]", {
        before,
        after: cleanedFinal.length,
        removed: before - cleanedFinal.length,
        first: cleanedFinal[0] || null,
      });
    }
  }
} catch (e) {
  console.error("[FINAL_GENERIC_BAD_ROW_FILTER_ERR]", e);
}
// ===== FINAL_GENERIC_BAD_ROW_FILTER_END =====


// ===== GENERIC_GUIDE_SECTION_SPLIT_START =====
function cleanGuideTextForSplit(s: any) {
  return String(s || "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n+/g, "；")
    .replace(/；{2,}/g, "；")
    .trim();
}

function cutGuideSection(text: string, startPatterns: RegExp[], endPatterns: RegExp[]) {
  const t = cleanGuideTextForSplit(text);
  if (!t) return null;

  let start = -1;
  for (const p of startPatterns) {
    const m = t.match(p);
    if (m && m.index != null) {
      start = m.index;
      break;
    }
  }
  if (start < 0) return null;

  let end = t.length;
  const rest = t.slice(start + 1);
  for (const p of endPatterns) {
    const m = rest.match(p);
    if (m && m.index != null) {
      end = Math.min(end, start + 1 + m.index);
    }
  }

  return t.slice(start, end).replace(/^；+|；+$/g, "").trim() || null;
}

function splitGenericGuideFieldsFromRaw(raw: string) {
  const t = cleanGuideTextForSplit(raw);

  const applicationTime = cutGuideSection(
    t,
    [/申请时间/, /Application\s+Time/i, /Application\s+Period/i],
    [/申请材料/, /申请流程/, /费用标准/, /奖学金/, /联系方式/, /项目信息/],
  );

  const materials = cutGuideSection(
    t,
    [/申请材料/, /Application\s+Materials/i],
    [/费用标准/, /奖学金/, /联系方式/, /项目信息/, /项目列表/, /招生专业/],
  );

  const fee = cutGuideSection(
    t,
    [/费用标准/, /收费标准/, /学费/, /Tuition/i],
    [/奖学金/, /联系方式/, /项目信息/, /项目列表/, /招生专业/],
  );

  const scholarship = cutGuideSection(
    t,
    [/奖学金/, /Scholarship/i],
    [/联系方式/, /项目信息/, /项目列表/, /招生专业/],
  );

  const contact = cutGuideSection(
    t,
    [/联系方式/, /Contact/i, /邮\s*箱/, /Email/i],
    [/项目信息/, /项目列表/, /招生专业/],
  );

  const programInfoIndex = (() => {
    const keys = ["项目信息", "英文授课目录列表", "中文授课项目列表", "招生专业", "项目列表"];
    let pos = -1;
    for (const k of keys) {
      const i = t.indexOf(k);
      if (i >= 0 && (pos < 0 || i < pos)) pos = i;
    }
    return pos;
  })();

  const beforeProgramInfo = programInfoIndex >= 0 ? t.slice(0, programInfoIndex) : t;

  const requirements = cutGuideSection(
    beforeProgramInfo,
    [/申请资格/, /入学要求/, /Eligibility/i, /Requirements/i],
    [/申请流程/, /申请时间/, /申请材料/, /费用标准/, /奖学金/, /联系方式/],
  );

  const process = cutGuideSection(
    beforeProgramInfo,
    [/申请流程/, /Application\s+Procedure/i, /Application\s+Process/i],
    [/申请时间/, /申请材料/, /费用标准/, /奖学金/, /联系方式/],
  );

  const languageReq = cutGuideSection(
    beforeProgramInfo,
    [/语言水平/, /中文授课项目/, /英文授课项目/, /HSK/, /雅思|托福|多邻国/i],
    [/申请时间/, /申请材料/, /费用标准/, /奖学金/, /联系方式/],
  );

  const examReq = cutGuideSection(
    beforeProgramInfo,
    [/CSCA/, /来华留学本科入学学业水平测试/, /入学学业水平测试/],
    [/网上提交申请/, /支付报名费/, /录取/, /报到/, /申请时间/, /申请材料/],
  );

  const portal = (() => {
    const m =
      t.match(/https?:\/\/isso\.xjtu\.edu\.cn\/recruit\/login/i) ||
      t.match(/报名系统[:：]?\s*(https?:\/\/[^\s；]+)/i) ||
      t.match(/网申系统[:：]?\s*(https?:\/\/[^\s；]+)/i);
    return m ? m[0].replace(/^报名系统[:：]?\s*/i, "").replace(/^网申系统[:：]?\s*/i, "") : null;
  })();

  return {
    requirements,
    process,
    applicationTime,
    materials,
    fee,
    scholarship,
    contact,
    languageReq,
    examReq,
    portal,
  };
}

try {
  const parserNowForGuideSplit = String((parsed as any)?.program_catalog_meta?.parser || "");
  const isGenericGuideSplit =
    parserNowForGuideSplit === "generic_program_catalog_v1" ||
    Boolean((parsed as any)?.program_catalog_meta?.generic_admission_guide_patch);

  if (isGenericGuideSplit && Array.isArray(mergedCatalogFinal) && mergedCatalogFinal.length > 0) {
    const rawForSplit = String(raw_text || "");
    const sections = splitGenericGuideFieldsFromRaw(rawForSplit);

    let changed = 0;

    mergedCatalogFinal = mergedCatalogFinal.map((row: any) => {
      const r = { ...(row || {}) };

      if (sections.requirements) {
        r.apply_requirements_text = sections.requirements;
        changed++;
      }

      if (sections.process) {
        r.application_process_text = sections.process;
        r.admission_process_text = sections.process;
        changed++;
      }

      if (sections.applicationTime) {
        r.application_time_text = sections.applicationTime;
        changed++;
      }

      if (sections.materials) {
        r.application_materials_text = sections.materials;
        changed++;
      }

      if (sections.portal) {
        r.application_portal_text = sections.portal;
        changed++;
      }

      if (sections.languageReq) {
        r.language_requirements_text = sections.languageReq;
        changed++;
      }

      if (sections.examReq) {
        r.exam_requirements_text = sections.examReq;
        changed++;
      }

      if (sections.fee && !r.tuition_rmb_per_year && !r.tuition_note) {
        r.tuition_note = sections.fee;
        changed++;
      }

      if (sections.scholarship) {
        r.scholarship_note = sections.scholarship;
        changed++;
      }

      if (sections.contact) {
        r.contact_raw = sections.contact;
        changed++;
      }

      r.tags = Array.from(
        new Set([
          ...((Array.isArray(r.tags) ? r.tags : []) as any[]),
          "申请信息已拆分",
        ]),
      );

      return r;
    });

    (parsed as any).program_catalog = mergedCatalogFinal;
    (parsed as any).program_catalog_meta = {
      ...((parsed as any).program_catalog_meta || {}),
      generic_guide_section_split: true,
      generic_guide_section_split_changed: changed,
      generic_guide_section_split_keys: Object.entries(sections)
        .filter(([, v]) => Boolean(v))
        .map(([k]) => k),
    };

    if (process.env.DEBUG_INGEST === "1") console.log("[GENERIC_GUIDE_SECTION_SPLIT]", {
      rows: mergedCatalogFinal.length,
      changed,
      keys: Object.entries(sections).filter(([, v]) => Boolean(v)).map(([k]) => k),
      first: mergedCatalogFinal[0] || null,
    });
  }
} catch (e) {
  console.error("[GENERIC_GUIDE_SECTION_SPLIT_ERR]", e);
}
// ===== GENERIC_GUIDE_SECTION_SPLIT_END =====


// ===== GENERIC_GUIDE_FIELD_CLEAN_START =====
function pickSentencesByPatterns(text: any, patterns: RegExp[]) {
  const parts = String(text || "")
    .replace(/\u00a0/g, " ")
    .split(/[；;\n]/g)
    .map((x) => x.trim())
    .filter(Boolean);

  const picked = parts.filter((s) => patterns.some((p) => p.test(s)));
  return Array.from(new Set(picked)).join("；") || null;
}

function pickDateRangeText(text: any) {
  const t = String(text || "").replace(/\u00a0/g, " ");
  const m =
    t.match(/\d{4}年\d{1,2}月\d{1,2}日\s*[-至—–]\s*\d{4}年\d{1,2}月\d{1,2}日/) ||
    t.match(/\d{4}[./-]\d{1,2}[./-]\d{1,2}\s*[-至—–]\s*\d{4}[./-]\d{1,2}[./-]\d{1,2}/);
  return m ? m[0] : null;
}

function pickPortalUrl(text: any) {
  const t = String(text || "");
  const m =
    t.match(/https?:\/\/isso\.xjtu\.edu\.cn\/recruit\/login/i) ||
    t.match(/https?:\/\/[^\s；;]+/i);
  return m ? m[0] : null;
}

try {
  const isGenericGuideClean =
    Boolean((parsed as any)?.program_catalog_meta?.generic_guide_section_split) ||
    Boolean((parsed as any)?.program_catalog_meta?.generic_admission_guide_patch);

  if (isGenericGuideClean && Array.isArray(mergedCatalogFinal) && mergedCatalogFinal.length > 0) {
    let changed = 0;

    mergedCatalogFinal = mergedCatalogFinal.map((row: any) => {
      const r = { ...(row || {}) };

      const allGuideText = [
        r.apply_requirements_text,
        r.application_process_text,
        r.admission_process_text,
        r.application_time_text,
        r.application_materials_text,
        r.language_requirements_text,
        r.exam_requirements_text,
        raw_text,
      ].map((x: any) => String(x || "")).join("；");

      const req = pickSentencesByPatterns(allGuideText, [
        /不超过|未满|年龄/,
        /护照/,
        /高中毕业|学历|毕业证书|预毕业/,
        /教育部教外函|相关规定/,
      ]);

      const lang = pickSentencesByPatterns(allGuideText, [
        /HSK|汉语水平|中文水平/,
        /雅思|托福|多邻国|英语水平|英文授课/,
        /母语为汉语|母语为英语|免交/,
      ]);

      const exam = pickSentencesByPatterns(allGuideText, [
        /CSCA|来华留学本科入学学业水平测试|入学学业水平测试/,
        /csca\.cn/,
        /测试科目/,
      ]);

      const process = pickSentencesByPatterns(allGuideText, [
        /网上提交申请|在线申请|完成在线申请/,
        /支付报名费|报名费支付/,
        /材料评审|面试|择优录取|录取/,
        /报到|注册手续|资格复查/,
      ]);

      const time = pickDateRangeText(allGuideText);
      const portal = pickPortalUrl(allGuideText);

      if (req) {
        r.apply_requirements_text = req;
        changed++;
      }

      if (process) {
        r.application_process_text = process;
        r.admission_process_text = process;
        changed++;
      }

      if (time) {
        r.application_time_text = time;
        changed++;
      }

      if (portal) {
        r.application_portal_text = portal;
        changed++;
      }

      if (lang) {
        r.language_requirements_text = lang;
        changed++;
      }

      if (exam) {
        r.exam_requirements_text = exam;
        changed++;
      }

      r.tags = Array.from(
        new Set([
          ...((Array.isArray(r.tags) ? r.tags : []) as any[]),
          "申请信息已清洗",
        ]),
      );

      return r;
    });

    (parsed as any).program_catalog = mergedCatalogFinal;
    (parsed as any).program_catalog_meta = {
      ...((parsed as any).program_catalog_meta || {}),
      generic_guide_field_clean: true,
      generic_guide_field_clean_changed: changed,
    };

    if (process.env.DEBUG_INGEST === "1") console.log("[GENERIC_GUIDE_FIELD_CLEAN]", {
      rows: mergedCatalogFinal.length,
      changed,
      first: mergedCatalogFinal[0] || null,
    });
  }
} catch (e) {
  console.error("[GENERIC_GUIDE_FIELD_CLEAN_ERR]", e);
}
// ===== GENERIC_GUIDE_FIELD_CLEAN_END =====


// ===== GENERIC_UG_TUITION_POLICY_EXTRACT_START =====
function genericUgTuitionGroupByRow(row: any) {
  const txt = [
    row?.faculty_cn,
    row?.faculty_en,
    row?.program_name_cn,
    row?.program_name_en,
    row?.degree_name_cn,
    row?.raw_line,
    row?.raw_block,
  ].map((x: any) => String(x || "")).join(" ");

  if (/临床医学|医学|MBBS|Clinical Medicine/i.test(txt)) return "医学类";
  if (/环境设计|书法|艺术|设计|Art|Design/i.test(txt)) return "艺术类";
  if (/经济|金融|财政|贸易|电子商务|管理|行政|法学|哲学|社会学|汉语言|汉语言文学|英语|日语|法语|新闻|网络与新媒体|文学|人文|经管|Business|Economics|Finance|Law|Management|Language|Media/i.test(txt)) return "人文经管类";
  return "理工类";
}

function extractGenericUgTuitionPolicy(raw: string) {
  const t = String(raw || "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n+/g, "；")
    .replace(/；{2,}/g, "；")
    .trim();

  const hasXjtuFee =
    /费用标准|学费|住宿费|报名费/.test(t) &&
    /本科项目/.test(t) &&
    /(西安交通大学|西安交大|XJTU)/i.test(t);

  if (!hasXjtuFee) return null;

  const nums = Array.from(t.matchAll(/(\d{1,3}(?:,\d{3})+|\d{4,6})/g))
    .map((m) => Number(String(m[1] || "").replace(/,/g, "")))
    .filter((n) => Number.isFinite(n));

  const has = (n: number) => nums.includes(n);

  const policy: any = {
    ugZhScience: has(22000) ? 22000 : null,
    ugZhHuman: has(20000) ? 20000 : null,
    ugZhArt: has(40000) ? 40000 : null,
    ugEnEngineering: has(180000) ? 180000 : null,
    ugEnMedicine: has(40000) ? 40000 : null,
    accommodation: /8000\s*[-至—–]\s*19000|8,000\s*[-至—–]\s*19,000/.test(t)
      ? "住宿费：8000-19000 RMB/学年。"
      : null,
    applicationSelfFunded: has(500) ? 500 : null,
    applicationScholarship: has(800) ? 800 : null,
    source: "西安交大本科.pdf",
  };

  const filled = Object.values(policy).filter(Boolean).length;

  console.log("[GENERIC_UG_TUITION_POLICY_EXTRACT]", {
    hasXjtuFee,
    nums: Array.from(new Set(nums)).sort((a, b) => a - b),
    policy,
    filled,
  });

  return filled >= 4 ? policy : null;
}

function applyGenericUgTuitionPolicyToRows(rows: any[], raw: string) {
  const policy = extractGenericUgTuitionPolicy(raw);
  if (!policy) return rows;

  return (Array.isArray(rows) ? rows : []).map((row: any) => {
    const r = { ...(row || {}) };
    const lang = String(r.study_language || r.language_text || "").toLowerCase();
    const program = String(r.program_name_cn || r.program_name_en || "");
    const group = genericUgTuitionGroupByRow(r);
    const isEnglish = lang === "en" || lang.includes("英文") || lang.includes("english");

    let amount: number | null = null;
    let note = "";

    if (isEnglish) {
      if (/临床医学|MBBS|Clinical Medicine/i.test(program)) {
        amount = policy.ugEnMedicine;
        note = "英文授课本科临床医学：40,000 RMB/学年。";
      } else {
        amount = policy.ugEnEngineering;
        note = "英文授课本科工程类项目：180,000 RMB/学年。";
      }
    } else {
      if (group === "艺术类") {
        amount = policy.ugZhArt;
        note = "中文授课本科艺术类：40,000 RMB/学年。";
      } else if (group === "人文经管类") {
        amount = policy.ugZhHuman;
        note = "中文授课本科人文经管类：20,000 RMB/学年。";
      } else {
        amount = policy.ugZhScience;
        note = "中文授课本科理工类：22,000 RMB/学年。";
      }
    }

    if (amount) {
      r.tuition_rmb_per_year = amount;
      r.tuition_total_rmb = null;
      r.tuition_is_per_year = true;
      r.tuition_group = isEnglish ? (/临床医学|MBBS|Clinical Medicine/i.test(program) ? "临床医学" : "英文工程类") : group;
      r.tuition_note = note;
      r.tuition_source_url = policy.source;
    }

    r.application_fee_rmb = policy.applicationSelfFunded || 500;
    r.application_fee_note = "报名费：申请自费项目500 RMB；申请奖学金项目800 RMB；无论录取与否，报名费不予退还。";
    r.application_fee_source_url = policy.source;

    if (policy.accommodation) {
      r.accommodation_fee_note = policy.accommodation;
      r.accommodation_fee_source_url = policy.source;
    }

    r.tags = Array.from(
      new Set([
        ...((Array.isArray(r.tags) ? r.tags : []) as any[]),
        "收费已填",
        "报名费已填",
      ]),
    );

    return r;
  });
}

try {
  const isGenericUgTuition =
    kind === "ug" &&
    Array.isArray(mergedCatalogFinal) &&
    mergedCatalogFinal.length > 0 &&
    /西安交通大学|西安交大|XJTU/i.test(String(raw_text || "")) &&
    /费用标准|学费|住宿费|报名费/.test(String(raw_text || ""));

  if (isGenericUgTuition) {
    const beforeWithTuition = mergedCatalogFinal.filter((r: any) => r?.tuition_rmb_per_year != null).length;

    mergedCatalogFinal = applyGenericUgTuitionPolicyToRows(mergedCatalogFinal, String(raw_text || ""));
    (parsed as any).program_catalog = mergedCatalogFinal;
    (parsed as any).program_catalog_meta = {
      ...((parsed as any).program_catalog_meta || {}),
      generic_ug_tuition_policy_extract: true,
      generic_ug_tuition_source: "西安交大本科.pdf",
    };

    console.log("[GENERIC_UG_TUITION_POLICY_PATCH]", {
      rows: mergedCatalogFinal.length,
      beforeWithTuition,
      afterWithTuition: mergedCatalogFinal.filter((r: any) => r?.tuition_rmb_per_year != null).length,
      first: mergedCatalogFinal[0] || null,
    });
  }
} catch (e) {
  console.error("[GENERIC_UG_TUITION_POLICY_PATCH_ERR]", e);
}
// ===== GENERIC_UG_TUITION_POLICY_EXTRACT_END =====


// ===== XJTU_UG_GUIDE_FINE_CLEAN_START =====
function xjtuNormalizeGuideLine(s: any) {
  return String(s || "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n+/g, "；")
    .replace(/；{2,}/g, "；")
    .trim();
}

function xjtuCleanApplyRequirementsFromRaw(raw: string) {
  const t = xjtuNormalizeGuideLine(raw);

  const items: string[] = [];

  if (/不超过25岁|25岁/.test(t)) {
    items.push("申请者年龄不超过25岁；不满18岁者须由法定监护人提供委托书。");
  }

  if (/外国普通有效护照|有效护照/.test(t)) {
    items.push("申请者须持有外国普通有效护照。");
  }

  if (/高中毕业|高中毕业证书|预毕业证明/.test(t)) {
    items.push("申请者须具有高中毕业及以上学历；申请时尚未毕业者须提供预毕业证明，并最迟在入学前取得高中毕业证书。");
  }

  if (/语言水平要求|HSK|雅思|托福|多邻国/.test(t)) {
    items.push("申请者须满足相应语言水平要求。");
  }

  if (/教育部教外函\[?2020\]?12号|教外函/.test(t)) {
    items.push("申请者须符合教育部教外函〔2020〕12号文件及学校相关规定。");
  }

  return items.join("；") || null;
}

function xjtuCleanLanguageRequirementsFromRaw(raw: string) {
  const t = xjtuNormalizeGuideLine(raw);
  const items: string[] = [];

  if (/中文授课项目|HSK|汉语水平考试/.test(t)) {
    items.push("中文授课项目：须提交中文水平证明，中文水平应相当于HSK四级及以上。");
  }

  if (/汉语水平不达标|预科学习/.test(t)) {
    items.push("汉语水平不达标者可选择预科学习，预科结束后达到《国际汉语能力标准》四级水平者方可进入本科学习。");
  }

  if (/英文授课项目|雅思|托福|多邻国/.test(t)) {
    items.push("英文授课项目：须提交英语水平证明，雅思6.0、托福80、多邻国110或学校认可的同等英语水平证明。");
  }

  if (/母语为汉语|母语为英语|免交/.test(t)) {
    items.push("母语为汉语或英语者经学校认定可免交相应语言水平证明。");
  }

  return items.join("；") || null;
}

function xjtuCleanExamRequirementsFromRaw(raw: string) {
  const t = xjtuNormalizeGuideLine(raw);
  const items: string[] = [];

  if (/来华留学本科入学学业水平测试|CSCA/.test(t)) {
    items.push("所有申请来华攻读本科学位的学生须参加“来华留学本科入学学业水平测试”（CSCA），并提交有效成绩单。");
  }

  if (/www\.csca\.cn|csca\.cn/.test(t)) {
    items.push("申请者可访问CSCA官网 www.csca.cn 查看具体介绍及报名方式。");
  }

  if (/测试科目详见|zsxm\/xlxm\/bk/.test(t)) {
    items.push("各专业测试科目以学校网站公布要求为准。");
  }

  return items.join("；") || null;
}

function xjtuCleanApplicationProcessFromRaw(raw: string) {
  const t = xjtuNormalizeGuideLine(raw);
  const items: string[] = [];

  if (/来华留学本科入学学业水平测试|CSCA/.test(t)) {
    items.push("1. 参加“来华留学本科入学学业水平测试”（CSCA）并提交有效成绩单。");
  }

  if (/网上提交申请|在线申请|上传材料|无需邮寄/.test(t)) {
    items.push("2. 登录西安交通大学国际教育学院网上报名系统，按系统提示完成在线申请并上传材料，无需邮寄纸质材料。");
  }

  if (/支付报名费|报名费支付/.test(t)) {
    items.push("3. 初审通过后，系统开放报名费支付，申请者须按时足额完成支付。");
  }

  if (/材料评审|面试|择优录取/.test(t)) {
    items.push("4. 学校通过材料评审、CSCA、面试等方式进行考核并择优录取。");
  }

  if (/报到注册|资格复查|报到/.test(t)) {
    items.push("5. 录取学生须按录取通知要求办理报到注册手续，报到时学校将进行录取资格复查。");
  }

  return items.join("；") || null;
}

function xjtuCleanApplicationMaterialsFromRaw(raw: string) {
  const t = xjtuNormalizeGuideLine(raw);
  const items: string[] = [];

  const map: Array<[RegExp, string]> = [
    [/外国留学生入学申请表/, "《西安交通大学外国留学生入学申请表》（在网申系统中填写完成）。"],
    [/高中学历证明|预毕业证明/, "高中学历证明公证件；应届毕业生须提供预毕业证明，入学报到时补交正式文件。"],
    [/学习成绩单|成绩评价体系/, "高中阶段全部课程成绩单及学校成绩评价体系说明的公证件。"],
    [/语言水平能力证明|雅思|托福|多邻国|HSK/, "语言水平能力证明，如雅思、托福、多邻国或HSK证书；母语为汉语/英语者经认定可免交。"],
    [/CSCA|China Scholastic Competency Assessment/, "“来华留学本科入学学业水平测试”（CSCA）成绩单。"],
    [/推荐信/, "推荐信一封，由高中校长或老师出具，并注明推荐人电子邮箱和联系电话。"],
    [/学习计划/, "学习计划，用中文或英文书写，不少于600字。"],
    [/外国普通有效护照/, "外国普通有效护照，护照有效期须超出入学当日至少六个月。"],
    [/外国人体格检查记录|体格检查/, "《外国人体格检查记录》原件及公证件。"],
    [/无犯罪记录证明/, "有效期限内的无犯罪记录证明。"],
    [/其他支撑材料/, "其他支撑材料（如有）。"],
    [/环境设计|作品集/, "申请环境设计专业者须具有较强美术绘画基础，面试时需提供个人独立完成的作品集。"],
  ];

  for (const [re, val] of map) {
    if (re.test(t)) items.push(val);
  }

  return Array.from(new Set(items)).join("；") || null;
}

function xjtuExtractScholarshipFromRaw(raw: string, row: any) {
  const t = xjtuNormalizeGuideLine(raw);
  const program = String(row?.program_name_cn || row?.program_name_en || "");
  const isMedical = /临床医学|MBBS|医学/.test(program);

  const general = [
    "中国政府奖学金：申请人须通过本国留学生派遣部门申请，填写申请表时第一志愿填写西安交通大学。",
    "国际中文教师奖学金：申请人须在国际中文教师奖学金项目管理平台中申请。",
    "西安市“一带一路”外国留学生奖学金：申请人在西安交通大学国际学生申请系统中提交申请。",
    "陕西省三秦奖学金、西安交通大学国际学生表彰奖励：面向全日制在校自费外国学历留学生，具体按学校通知申请。",
  ];

  const xjtuFreshman =
    "西安交通大学本科国际学生新生奖学金：面向申请攻读本科学位并获得录取资格的非医学本科国际学生，申请人在西安交通大学国际学生申请系统中提交申请。";

  const coverage =
    "奖学金覆盖：特等奖学金免除100%学费；一等奖学金免除75%学费；二等奖学金免除50%学费；三等奖学金免除25%学费；优秀奖学金免除10%学费。奖学金通常为本科阶段第一学年，后续学年根据在校学业表现等综合评定。";

  if (!/奖学金|Scholarship|中国政府奖学金|新生奖学金/.test(t)) return null;

  return {
    note: isMedical
      ? general.join("；")
      : [xjtuFreshman, ...general].join("；"),
    coverage: isMedical
      ? "临床医学/医学类项目不适用西安交通大学本科国际学生新生奖学金；可关注中国政府奖学金、国际中文教师奖学金、西安市“一带一路”外国留学生奖学金及其他在校奖励。"
      : coverage,
    source: "西安交大本科.pdf",
    applicationTime:
      "中国政府奖学金按派遣部门通知申请；西安交通大学本科国际学生新生奖学金、西安市“一带一路”外国留学生奖学金等按学校申请系统或后续通知申请。",
    stipend: null,
  };
}

try {
  const isXjtuUgFineClean =
    kind === "ug" &&
    Array.isArray(mergedCatalogFinal) &&
    mergedCatalogFinal.length > 0 &&
    /西安交通大学|西安交大|XJTU/i.test(String(raw_text || ""));

  if (isXjtuUgFineClean) {
    let changed = 0;

    const req = xjtuCleanApplyRequirementsFromRaw(String(raw_text || ""));
    const lang = xjtuCleanLanguageRequirementsFromRaw(String(raw_text || ""));
    const exam = xjtuCleanExamRequirementsFromRaw(String(raw_text || ""));
    const process = xjtuCleanApplicationProcessFromRaw(String(raw_text || ""));
    const materials = xjtuCleanApplicationMaterialsFromRaw(String(raw_text || ""));

    mergedCatalogFinal = mergedCatalogFinal.map((row: any) => {
      const r = { ...(row || {}) };

      if (req) {
        r.apply_requirements_text = req;
        changed++;
      }

      if (lang) {
        r.language_requirements_text = lang;
        changed++;
      }

      if (exam) {
        r.exam_requirements_text = exam;
        changed++;
      }

      if (process) {
        r.application_process_text = process;
        r.admission_process_text = process;
        changed++;
      }

      if (materials) {
        r.application_materials_text = materials;
        changed++;
      }

      const scholarship = xjtuExtractScholarshipFromRaw(String(raw_text || ""), r);
      if (scholarship) {
        r.scholarship_note = scholarship.note;
        r.scholarship_coverage_text = scholarship.coverage;
        r.scholarship_source_url = scholarship.source;
        r.scholarship_application_time_text = scholarship.applicationTime;
        r.scholarship_stipend_rmb_per_month = scholarship.stipend;
        changed++;
      }

      r.tags = Array.from(
        new Set([
          ...((Array.isArray(r.tags) ? r.tags : []) as any[]),
          "申请信息精修",
          "奖学金已精修",
        ]),
      );

      return r;
    });

    (parsed as any).program_catalog = mergedCatalogFinal;
    (parsed as any).program_catalog_meta = {
      ...((parsed as any).program_catalog_meta || {}),
      xjtu_ug_guide_fine_clean: true,
      xjtu_ug_guide_fine_clean_changed: changed,
    };

    console.log("[XJTU_UG_GUIDE_FINE_CLEAN]", {
      rows: mergedCatalogFinal.length,
      changed,
      first: mergedCatalogFinal[0] || null,
    });
  }
} catch (e) {
  console.error("[XJTU_UG_GUIDE_FINE_CLEAN_ERR]", e);
}
// ===== XJTU_UG_GUIDE_FINE_CLEAN_END =====


// ===== XJTU_UG_FACULTY_REPAIR_START =====
function repairXjtuUgFacultyByProgram(row: any) {
  const r = { ...(row || {}) };
  const program = String(r.program_name_cn || "").trim();

  const map: Record<string, string> = {
    "电气工程及其自动化": "电气工程学院",
    "能源互联网工程": "电气工程学院",
    "电子科学与技术": "电气工程学院",

    "计算机科学与技术": "电信学部",
    "软件工程": "电信学部",

    "化学": "化学学院",
    "应用化学": "化学学院",

    "国际经济与贸易（国际班）": "经济与金融学院",
    "贸易经济": "经济与金融学院",
    "电子商务": "经济与金融学院",
    "经济学": "经济与金融学院",
    "金融学": "经济与金融学院",
    "财政学": "经济与金融学院",

    "新能源科学与工程": "能源与动力工程学院",
    "能源与动力工程": "能源与动力工程学院",
    "环境工程": "能源与动力工程学院",
    "核工程与核技术": "能源与动力工程学院",
    "储能科学与工程": "能源与动力工程学院",

    "人居环境科学与技术专业（大数据与智慧城市方向）": "人居环境与建筑工程学院",
    "人居环境科学与技术专业（结构与岩土工程方向）": "人居环境与建筑工程学院",
    "人居环境科学与技术专业（建筑环境与节能方向）": "人居环境与建筑工程学院",
    "人居环境科学与技术专业（地球环境科学方向）": "人居环境与建筑工程学院",

    "哲学": "人文社会科学学院",
    "社会学": "人文社会科学学院",
    "汉语言文学": "人文社会科学学院",
    "环境设计": "人文社会科学学院",
    "书法学": "人文社会科学学院",

    "生物医学工程": "生命科学与技术学院",
    "生物技术": "生命科学与技术学院",

    "英语": "外国语学院",
    "日语": "外国语学院",
    "法语": "外国语学院",

    "网络与新媒体": "新闻与新媒体学院",

    "化学工程与工艺": "化学工程与技术学院",
    "过程装备与控制工程": "化学工程与技术学院",

    "测控技术与仪器": "仪器科学与技术学院",
    "测控技术与仪器（智能感知工程方向）": "仪器科学与技术学院",
  };

  const nextFaculty = map[program];
  if (nextFaculty && r.faculty_cn !== nextFaculty) {
    r.faculty_cn_original = r.faculty_cn || null;
    r.faculty_cn = nextFaculty;
    r.tags = Array.from(
      new Set([
        ...((Array.isArray(r.tags) ? r.tags : []) as any[]),
        "学院归属已修正",
      ]),
    );
    r._faculty_repaired = true;
  }

  return r;
}

try {
  const isXjtuUgFacultyRepair =
    kind === "ug" &&
    Array.isArray(mergedCatalogFinal) &&
    mergedCatalogFinal.length > 0 &&
    /西安交通大学|西安交大|XJTU/i.test(String(raw_text || ""));

  if (isXjtuUgFacultyRepair) {
    let repaired = 0;

    mergedCatalogFinal = mergedCatalogFinal.map((row: any) => {
      const before = String(row?.faculty_cn || "");
      const r = repairXjtuUgFacultyByProgram(row);
      if (r._faculty_repaired || String(r?.faculty_cn || "") !== before) repaired += 1;
      delete r._faculty_repaired;
      return r;
    });

    (parsed as any).program_catalog = mergedCatalogFinal;
    (parsed as any).program_catalog_meta = {
      ...((parsed as any).program_catalog_meta || {}),
      xjtu_ug_faculty_repair: true,
      xjtu_ug_faculty_repair_count: repaired,
    };

    console.log("[XJTU_UG_FACULTY_REPAIR]", {
      rows: mergedCatalogFinal.length,
      repaired,
      samples: mergedCatalogFinal
        .filter((r: any) => r?.faculty_cn_original)
        .slice(0, 10)
        .map((r: any) => ({
          program_name_cn: r.program_name_cn,
          faculty_cn_original: r.faculty_cn_original,
          faculty_cn: r.faculty_cn,
        })),
    });
  }
} catch (e) {
  console.error("[XJTU_UG_FACULTY_REPAIR_ERR]", e);
}
// ===== XJTU_UG_FACULTY_REPAIR_END =====


// ===== XJTU_UG_TUITION_RECALC_AFTER_FACULTY_REPAIR_START =====
try {
  const isXjtuUgTuitionRecalc =
    kind === "ug" &&
    Array.isArray(mergedCatalogFinal) &&
    mergedCatalogFinal.length > 0 &&
    /西安交通大学|西安交大|XJTU/i.test(String(raw_text || ""));

  if (isXjtuUgTuitionRecalc) {
    let changed = 0;

    const artPrograms = new Set(["环境设计", "书法学"]);
    const humanPrograms = new Set([
      "汉语言（商务汉语）",
      "法学",
      "行政管理",
      "大数据管理与应用",
      "工商管理",
      "国际经济与贸易（国际班）",
      "贸易经济",
      "电子商务",
      "经济学",
      "金融学",
      "财政学",
      "哲学",
      "社会学",
      "汉语言文学",
      "英语",
      "日语",
      "法语",
      "网络与新媒体",
    ]);

    mergedCatalogFinal = mergedCatalogFinal.map((row: any) => {
      const r = { ...(row || {}) };
      const program = String(r.program_name_cn || "").trim();
      const lang = String(r.study_language || r.language_text || "").toLowerCase();
      const isEnglish = lang === "en" || lang.includes("英文") || lang.includes("english");

      let amount: number | null = null;
      let group = "";
      let note = "";

      if (isEnglish) {
        if (/临床医学|MBBS|Clinical Medicine/i.test(program)) {
          amount = 40000;
          group = "临床医学";
          note = "英文授课本科临床医学：40,000 RMB/学年。";
        } else {
          amount = 180000;
          group = "英文工程类";
          note = "英文授课本科工程类项目：180,000 RMB/学年。";
        }
      } else if (artPrograms.has(program)) {
        amount = 40000;
        group = "艺术类";
        note = "中文授课本科艺术类：40,000 RMB/学年。";
      } else if (humanPrograms.has(program)) {
        amount = 20000;
        group = "人文经管类";
        note = "中文授课本科人文经管类：20,000 RMB/学年。";
      } else {
        amount = 22000;
        group = "理工类";
        note = "中文授课本科理工类：22,000 RMB/学年。";
      }

      if (amount && r.tuition_rmb_per_year !== amount) {
        r.tuition_rmb_per_year = amount;
        r.tuition_group = group;
        r.tuition_note = note;
        r.tuition_is_per_year = true;
        r.tuition_total_rmb = null;
        r.tuition_source_url = r.tuition_source_url || "西安交大本科.pdf";
        changed += 1;
      }

      return r;
    });

    (parsed as any).program_catalog = mergedCatalogFinal;
    (parsed as any).program_catalog_meta = {
      ...((parsed as any).program_catalog_meta || {}),
      xjtu_ug_tuition_recalc_after_faculty_repair: true,
      xjtu_ug_tuition_recalc_after_faculty_repair_changed: changed,
    };

    console.log("[XJTU_UG_TUITION_RECALC_AFTER_FACULTY_REPAIR]", {
      rows: mergedCatalogFinal.length,
      changed,
      samples: mergedCatalogFinal
        .filter((r: any) => ["新能源科学与工程", "能源与动力工程", "环境设计", "书法学"].includes(String(r.program_name_cn || "")))
        .map((r: any) => ({
          program_name_cn: r.program_name_cn,
          faculty_cn: r.faculty_cn,
          tuition_group: r.tuition_group,
          tuition_rmb_per_year: r.tuition_rmb_per_year,
        })),
    });
  }
} catch (e) {
  console.error("[XJTU_UG_TUITION_RECALC_AFTER_FACULTY_REPAIR_ERR]", e);
}
// ===== XJTU_UG_TUITION_RECALC_AFTER_FACULTY_REPAIR_END =====


// ===== XJTU_UG_PDF_PARSE_COMPLETE_MARK_START =====
try {
  const isXjtuUgPdfCompleteMark =
    kind === "ug" &&
    Array.isArray(mergedCatalogFinal) &&
    mergedCatalogFinal.length > 0 &&
    /西安交通大学|西安交大|XJTU/i.test(String(raw_text || ""));

  if (isXjtuUgPdfCompleteMark) {
    const totalRows = mergedCatalogFinal.length;

    const withTuition = mergedCatalogFinal.filter((r: any) => r?.tuition_rmb_per_year != null).length;
    const withApplicationFee = mergedCatalogFinal.filter((r: any) => r?.application_fee_rmb != null).length;
    const withAccommodation = mergedCatalogFinal.filter((r: any) => Boolean(r?.accommodation_fee_note)).length;

    const withApplyReq = mergedCatalogFinal.filter((r: any) => Boolean(r?.apply_requirements_text)).length;
    const withProcess = mergedCatalogFinal.filter((r: any) =>
      Boolean(r?.application_process_text || r?.admission_process_text)
    ).length;
    const withMaterials = mergedCatalogFinal.filter((r: any) => Boolean(r?.application_materials_text)).length;
    const withLanguageReq = mergedCatalogFinal.filter((r: any) => Boolean(r?.language_requirements_text)).length;
    const withExamReq = mergedCatalogFinal.filter((r: any) => Boolean(r?.exam_requirements_text)).length;

    const withScholarship = mergedCatalogFinal.filter((r: any) => Boolean(r?.scholarship_note)).length;
    const withScholarshipCoverage = mergedCatalogFinal.filter((r: any) => Boolean(r?.scholarship_coverage_text)).length;

    const badFacultyRows = mergedCatalogFinal.filter((r: any) => {
      const raw = [
        r?.faculty_cn,
        r?.program_name_cn,
        r?.program_name_en,
      ].map((x: any) => String(x || "")).join(" ");

      return /部项目|授课语言|授予学位类型|学院项目/.test(raw);
    });

    const medicalWrongScholarship = mergedCatalogFinal.filter((r: any) => {
      const program = String(r?.program_name_cn || "");
      const scholarship = String(r?.scholarship_note || "");
      return /临床医学|MBBS/.test(program) && /本科国际学生新生奖学金|新生奖学金/.test(scholarship);
    });

    const isComplete =
      totalRows === 45 &&
      withTuition === totalRows &&
      withApplicationFee === totalRows &&
      withAccommodation === totalRows &&
      withApplyReq === totalRows &&
      withProcess === totalRows &&
      withMaterials === totalRows &&
      withLanguageReq === totalRows &&
      withExamReq === totalRows &&
      withScholarship === totalRows &&
      withScholarshipCoverage === totalRows &&
      badFacultyRows.length === 0 &&
      medicalWrongScholarship.length === 0;

    (parsed as any).program_catalog_meta = {
      ...((parsed as any).program_catalog_meta || {}),

      xjtu_ug_pdf_parse_status: isComplete ? "complete" : "needs_review",
      xjtu_ug_pdf_parse_note: isComplete
        ? "西安交通大学本科 PDF 解析完成：目录、申请信息、费用、奖学金、学院归属均已处理。"
        : "西安交通大学本科 PDF 解析仍需复核。",

      xjtu_ug_pdf_parse_rows: totalRows,
      xjtu_ug_pdf_parse_with_tuition: withTuition,
      xjtu_ug_pdf_parse_with_application_fee: withApplicationFee,
      xjtu_ug_pdf_parse_with_accommodation: withAccommodation,

      xjtu_ug_pdf_parse_with_apply_requirements: withApplyReq,
      xjtu_ug_pdf_parse_with_process: withProcess,
      xjtu_ug_pdf_parse_with_materials: withMaterials,
      xjtu_ug_pdf_parse_with_language_requirements: withLanguageReq,
      xjtu_ug_pdf_parse_with_exam_requirements: withExamReq,

      xjtu_ug_pdf_parse_with_scholarship: withScholarship,
      xjtu_ug_pdf_parse_with_scholarship_coverage: withScholarshipCoverage,

      xjtu_ug_pdf_parse_bad_faculty_rows: badFacultyRows.length,
      xjtu_ug_pdf_parse_medical_wrong_scholarship: medicalWrongScholarship.length,
      xjtu_ug_pdf_parse_marked_at: new Date().toISOString(),
    };

    console.log("[XJTU_UG_PDF_PARSE_COMPLETE_MARK]", {
      status: isComplete ? "complete" : "needs_review",
      totalRows,
      withTuition,
      withApplicationFee,
      withAccommodation,
      withApplyReq,
      withProcess,
      withMaterials,
      withLanguageReq,
      withExamReq,
      withScholarship,
      withScholarshipCoverage,
      badFacultyRows: badFacultyRows.length,
      medicalWrongScholarship: medicalWrongScholarship.length,
    });
  }
} catch (e) {
  console.error("[XJTU_UG_PDF_PARSE_COMPLETE_MARK_ERR]", e);
}
// ===== XJTU_UG_PDF_PARSE_COMPLETE_MARK_END =====




// ===== XJTU_GRAD_PHD_FACULTY_REPAIR_START =====
try {
  const isXjtuGradPhdRepair =
    kind === "phd" &&
    Array.isArray(mergedCatalogFinal) &&
    mergedCatalogFinal.length > 0 &&
    /西安交通大学|西安交大|XJTU/i.test(String(raw_text || ""));

  if (isXjtuGradPhdRepair) {
    let repaired = 0;

    const repairMap: Record<string, string> = {
      "力学": "航天航空学院",
      "航空宇航科学与技术": "航天航空学院",

      "化学工程与技术": "化学工程与技术学院",
      "动力工程及工程热物理": "能源与动力工程学院",
      "核科学与技术": "能源与动力工程学院",
      "环境科学与工程": "能源与动力工程学院",

      "地球与人居环境科学及工程": "人居环境与建筑工程学院",
      "土木工程": "人居环境与建筑工程学院",

      "哲学": "人文社会科学学院",
      "社会学": "人文社会科学学院",

      "生物医学工程": "生命科学与技术学院",
      "生物学": "生命科学与技术学院",

      "数学": "数学与统计学院",
      "统计学": "数学与统计学院",

      "英语语言文学": "外国语学院",
      "外国语言文学": "外国语学院",
      "国际中文教育": "外国语学院",

      "新闻传播学": "新闻与新媒体学院",
    };

    mergedCatalogFinal = mergedCatalogFinal.map((row: any) => {
      const r = { ...(row || {}) };
      let program = String(r.program_name_cn || "").trim();

      // 修 program 里夹学院名
      const embeddedFacultyMatch = program.match(/^(人居环境与建筑工程学院|化学工程与技术学院|能源与动力工程学院|人文社会科学学院|生命科学与技术学院|数学与统计学院|外国语学院|新闻与新媒体学院)\s+(.+)$/);
      if (embeddedFacultyMatch) {
        r.faculty_cn_original = r.faculty_cn || null;
        r.faculty_cn = embeddedFacultyMatch[1];
        program = embeddedFacultyMatch[2].trim();
        r.program_name_cn = program;
        repaired += 1;
      }

      const expected = repairMap[program];
      if (expected && r.faculty_cn !== expected) {
        r.faculty_cn_original = r.faculty_cn || null;
        r.faculty_cn = expected;
        repaired += 1;
      }

      // 重新按修正后的学院/专业判断费用组
      const group = xjtuGradGroupByRow(r);
      const tuition = xjtuGradTuition("phd", String(r.language_text || ""), group);
      r.tuition_group = group;
      r.tuition_rmb_per_year = tuition;
      r.tuition_note = xjtuGradFeeNote("phd", String(r.language_text || ""), group, tuition);
      r.tuition_is_per_year = true;
      r.tuition_total_rmb = null;

      r.tags = Array.from(new Set([
        ...((Array.isArray(r.tags) ? r.tags : []) as any[]),
        "博士学院归属已复核",
      ]));

      return r;
    });

    (parsed as any).program_catalog = mergedCatalogFinal;
    (parsed as any).program_catalog_meta = {
      ...((parsed as any).program_catalog_meta || {}),
      parser: "xjtu_grad_phd_catalog_v1",
      doc_type: "xjtu_grad_catalog_pdf",
      xjtu_grad_phd_faculty_repair: true,
      xjtu_grad_phd_faculty_repair_count: repaired,
      xjtu_grad_phd_rows: mergedCatalogFinal.length,
    };

    console.log("[XJTU_GRAD_PHD_FACULTY_REPAIR]", {
      rows: mergedCatalogFinal.length,
      repaired,
      samples: mergedCatalogFinal
        .filter((r: any) => r?.faculty_cn_original)
        .slice(0, 20)
        .map((r: any) => ({
          program_name_cn: r.program_name_cn,
          faculty_cn_original: r.faculty_cn_original,
          faculty_cn: r.faculty_cn,
          tuition_group: r.tuition_group,
          tuition_rmb_per_year: r.tuition_rmb_per_year,
        })),
    });
  }
} catch (e) {
  console.error("[XJTU_GRAD_PHD_FACULTY_REPAIR_ERR]", e);
}
// ===== XJTU_GRAD_PHD_FACULTY_REPAIR_END =====


// ===== XJTU_GRAD_MASTER_FACULTY_REPAIR_START =====
try {
  const isXjtuGradMasterRepair =
    kind === "master" &&
    Array.isArray(mergedCatalogFinal) &&
    mergedCatalogFinal.length > 0 &&
    /西安交通大学|西安交大|XJTU/i.test(String(raw_text || ""));

  if (isXjtuGradMasterRepair) {
    let repaired = 0;

    const embeddedFacultyNames = [
      "马克思主义学院",
      "物理学院",
      "人文社会科学学院",
      "生命科学与技术学院",
      "数学与统计学院",
      "外国语学院",
      "新闻与新媒体学院",
      "仪器科学与技术学院",
      "医学部-基础医学院",
      "医学部-公共卫生学院",
      "医学部-药学院",
      "医学部-法医学院",
      "医学部-护理学系",
      "医学部-第一临床医学院",
      "医学部-第二临床医学院",
      "医学部-口腔医学院",
    ].sort((a, b) => b.length - a.length);

    const exactProgramFaculty: Record<string, string> = {
      "法学": "法学院",
      "法学（中国法与国际商法）": "法学院",

      "力学": "航天航空学院",
      "航空宇航科学与技术": "航天航空学院",

      "化学工程与技术": "化学工程与技术学院",
      "动力工程及工程热物理": "能源与动力工程学院",
      "核科学与技术": "能源与动力工程学院",
      "环境科学与工程": "能源与动力工程学院",

      "建筑学": "人居环境与建筑工程学院",
      "土木工程": "人居环境与建筑工程学院",

      "新闻传播学 （中国文化研究）": "人文社会科学学院",
      "哲学": "人文社会科学学院",
      "社会学": "人文社会科学学院",
      "新闻传播学": "人文社会科学学院",
      "设计学": "人文社会科学学院",

      "马克思主义理论": "马克思主义学院",

      "物理学": "物理学院",
      "材料科学与工程": "材料科学与工程学院",

      "生物医学工程": "生命科学与技术学院",
      "生物学": "生命科学与技术学院",

      "数学": "数学与统计学院",
      "统计学": "数学与统计学院",

      "英语语言文学": "外国语学院",
      "外国语言文学": "外国语学院",
      "国际中文教育": "外国语学院",

      "仪器科学与技术": "仪器科学与技术学院",
    };

    const shouldNotForceGlobal = new Set([
      // 同名跨学院，不做全局强制；只处理夹学院名或明显错位
      "材料科学与工程",
      "化学",
      "环境科学与工程",
      "生物医学工程",
      "化学工程与技术",
    ]);

    mergedCatalogFinal = mergedCatalogFinal.map((row: any) => {
      const r = { ...(row || {}) };
      let program = String(r.program_name_cn || "").trim();

      // 1) program 里夹了学院名：马克思主义学院 马克思主义理论
      const embedded = embeddedFacultyNames.find((f) => program.startsWith(f + " "));
      if (embedded) {
        r.faculty_cn_original = r.faculty_cn || null;
        r.faculty_cn = embedded;
        r.program_name_cn = program.slice(embedded.length).trim();
        program = String(r.program_name_cn || "").trim();
        repaired += 1;
      }

      // 2) 明显错位修正
      const expected = exactProgramFaculty[program];

      if (
        expected &&
        !shouldNotForceGlobal.has(program) &&
        r.faculty_cn !== expected
      ) {
        r.faculty_cn_original = r.faculty_cn || null;
        r.faculty_cn = expected;
        repaired += 1;
      }

      // 3) 对少数跨学院专业，只修明显错误来源
      if (program === "化学工程与技术" && /航天航空学院/.test(String(r.faculty_cn || ""))) {
        r.faculty_cn_original = r.faculty_cn || null;
        r.faculty_cn = "化学工程与技术学院";
        repaired += 1;
      }

      if (program === "动力工程及工程热物理" && /经济与金融学院|化学工程与技术学院/.test(String(r.faculty_cn_original || r.faculty_cn || ""))) {
        r.faculty_cn_original = r.faculty_cn || null;
        r.faculty_cn = "能源与动力工程学院";
        repaired += 1;
      }

      if (program === "新闻传播学 （中国文化研究)" || program === "新闻传播学 （中国文化研究）") {
        if (r.faculty_cn !== "人文社会科学学院") {
          r.faculty_cn_original = r.faculty_cn || null;
          r.faculty_cn = "人文社会科学学院";
          repaired += 1;
        }
      }

      if (program === "物理学" && r.faculty_cn !== "物理学院") {
        r.faculty_cn_original = r.faculty_cn || null;
        r.faculty_cn = "物理学院";
        repaired += 1;
      }

      // 物理学院下的材料科学与工程不能强制回材料学院
      if (
        program === "材料科学与工程" &&
        /外国语学院/.test(String(r.faculty_cn || ""))
      ) {
        r.faculty_cn_original = r.faculty_cn || null;
        r.faculty_cn = "物理学院";
        repaired += 1;
      }

      // 4) 重新算费用
      const group = xjtuGradGroupByRow(r);
      const tuition = xjtuGradTuition("master", String(r.language_text || ""), group);
      r.tuition_group = group;
      r.tuition_rmb_per_year = tuition;
      r.tuition_note = xjtuGradFeeNote("master", String(r.language_text || ""), group, tuition);
      r.tuition_is_per_year = true;
      r.tuition_total_rmb = null;

      r.tags = Array.from(new Set([
        ...((Array.isArray(r.tags) ? r.tags : []) as any[]),
        "硕士学院归属已复核",
      ]));

      return r;
    });

    (parsed as any).program_catalog = mergedCatalogFinal;
    (parsed as any).program_catalog_meta = {
      ...((parsed as any).program_catalog_meta || {}),
      parser: "xjtu_grad_master_catalog_v1",
      doc_type: "xjtu_grad_catalog_pdf",
      xjtu_grad_master_faculty_repair: true,
      xjtu_grad_master_faculty_repair_count: repaired,
      xjtu_grad_master_rows: mergedCatalogFinal.length,
      xjtu_grad_master_with_tuition: mergedCatalogFinal.filter((r: any) => r?.tuition_rmb_per_year != null).length,
    };

    console.log("[XJTU_GRAD_MASTER_FACULTY_REPAIR]", {
      rows: mergedCatalogFinal.length,
      repaired,
      samples: mergedCatalogFinal
        .filter((r: any) => r?.faculty_cn_original)
        .slice(0, 30)
        .map((r: any) => ({
          idx: r.idx,
          program_name_cn: r.program_name_cn,
          faculty_cn_original: r.faculty_cn_original,
          faculty_cn: r.faculty_cn,
          tuition_group: r.tuition_group,
          tuition_rmb_per_year: r.tuition_rmb_per_year,
        })),
    });
  }
} catch (e) {
  console.error("[XJTU_GRAD_MASTER_FACULTY_REPAIR_ERR]", e);
}
// ===== XJTU_GRAD_MASTER_FACULTY_REPAIR_END =====



if (process.env.DEBUG_INGEST === "1") console.log("[UPLOAD_FINAL_CATALOG_DEBUG]", {
  kind,
  linkPurpose,
  isForcedStructuredParser,
  mergedCatalogLen: Array.isArray(mergedCatalogFinal)
    ? mergedCatalogFinal.length
    : -1,
  firstFinal: Array.isArray(mergedCatalogFinal)
    ? mergedCatalogFinal[0] || null
    : null,
  withProgramEn: Array.isArray(mergedCatalogFinal)
    ? mergedCatalogFinal.filter((r: any) =>
        String(r?.program_name_en || "").trim(),
      ).length
    : -1,
  withTrack: Array.isArray(mergedCatalogFinal)
    ? mergedCatalogFinal.filter((r: any) =>
        String(r?.track_name_cn || r?.track_name_en || "").trim(),
      ).length
    : -1,
});



// ===== XJTU_GRAD_PARSE_COMPLETE_MARK_START =====
try {
  const isXjtuGradCompleteMark =
    (kind === "master" || kind === "phd") &&
    Array.isArray(mergedCatalogFinal) &&
    mergedCatalogFinal.length > 0 &&
    /西安交通大学|西安交大|XJTU/i.test(String(raw_text || "")) &&
    /硕博研究生国际学生|招生目录（硕士）|招生目录（博士）/.test(String(raw_text || ""));

  if (isXjtuGradCompleteMark) {
    const totalRows = mergedCatalogFinal.length;
    const expectedRows = kind === "phd" ? 88 : kind === "master" ? 99 : totalRows;

    const withFaculty = mergedCatalogFinal.filter((r: any) => Boolean(r?.faculty_cn || r?.faculty_en)).length;
    const withProgram = mergedCatalogFinal.filter((r: any) => Boolean(r?.program_name_cn || r?.program_name_en)).length;
    const withDuration = mergedCatalogFinal.filter((r: any) => r?.duration_years != null).length;
    const withDegree = mergedCatalogFinal.filter((r: any) => Boolean(r?.degree_name_cn || r?.degree_name_en)).length;
    const withLanguage = mergedCatalogFinal.filter((r: any) => Boolean(r?.language_text || r?.study_language)).length;

    const withTuition = mergedCatalogFinal.filter((r: any) => r?.tuition_rmb_per_year != null).length;
    const withApplicationFee = mergedCatalogFinal.filter((r: any) => r?.application_fee_rmb != null).length;
    const withAccommodation = mergedCatalogFinal.filter((r: any) => Boolean(r?.accommodation_fee_note)).length;
    const withScholarship = mergedCatalogFinal.filter((r: any) => Boolean(r?.scholarship_note)).length;
    const withScholarshipCoverage = mergedCatalogFinal.filter((r: any) => Boolean(r?.scholarship_coverage_text)).length;

    const badRows = mergedCatalogFinal.filter((r: any) => {
      const raw = [
        r?.faculty_cn,
        r?.program_name_cn,
        r?.degree_name_cn,
        r?.language_text,
      ].map((x: any) => String(x || "")).join(" ");

      return (
        /学院名称|专业名称|授课语言|授予学位|导师拟接收函/.test(raw) ||
        !String(r?.program_name_cn || "").trim() ||
        !String(r?.faculty_cn || "").trim()
      );
    });

    const isComplete =
      totalRows === expectedRows &&
      withFaculty === totalRows &&
      withProgram === totalRows &&
      withDuration === totalRows &&
      withDegree === totalRows &&
      withLanguage === totalRows &&
      withTuition === totalRows &&
      withApplicationFee === totalRows &&
      withAccommodation === totalRows &&
      withScholarship === totalRows &&
      withScholarshipCoverage === totalRows &&
      badRows.length === 0;

    const parserName =
      kind === "phd"
        ? "xjtu_grad_phd_catalog_v1"
        : "xjtu_grad_master_catalog_v1";

    const completeMeta = {
      parser: parserName,
      doc_type: "xjtu_grad_catalog_pdf",

      xjtu_grad_parse_status: isComplete ? "complete" : "needs_review",
      xjtu_grad_parse_note: isComplete
        ? `西安交通大学${kind === "phd" ? "博士" : "硕士"} PDF 解析完成：目录、学院归属、费用、奖学金均已处理。`
        : `西安交通大学${kind === "phd" ? "博士" : "硕士"} PDF 解析仍需复核。`,

      xjtu_grad_kind: kind,
      xjtu_grad_rows: totalRows,
      xjtu_grad_expected_rows: expectedRows,

      xjtu_grad_with_faculty: withFaculty,
      xjtu_grad_with_program: withProgram,
      xjtu_grad_with_duration: withDuration,
      xjtu_grad_with_degree: withDegree,
      xjtu_grad_with_language: withLanguage,

      xjtu_grad_with_tuition: withTuition,
      xjtu_grad_with_application_fee: withApplicationFee,
      xjtu_grad_with_accommodation: withAccommodation,
      xjtu_grad_with_scholarship: withScholarship,
      xjtu_grad_with_scholarship_coverage: withScholarshipCoverage,

      xjtu_grad_bad_rows: badRows.length,
      xjtu_grad_pdf_source: "西安交大硕博.pdf",
      xjtu_grad_parse_marked_at: new Date().toISOString(),

      ...(kind === "phd"
        ? {
            xjtu_grad_phd_rows: totalRows,
            xjtu_grad_phd_parse_status: isComplete ? "complete" : "needs_review",
            xjtu_grad_phd_with_tuition: withTuition,
          }
        : {
            xjtu_grad_master_rows: totalRows,
            xjtu_grad_master_parse_status: isComplete ? "complete" : "needs_review",
            xjtu_grad_master_with_tuition: withTuition,
          }),
    };

    Object.assign(nextMeta2 as any, completeMeta);

    (parsed as any).program_catalog_meta = {
      ...((parsed as any).program_catalog_meta || {}),
      ...completeMeta,
    };

    mergedCatalogFinal = mergedCatalogFinal.map((r: any) => ({
      ...(r || {}),
      parse_status: completeMeta.xjtu_grad_parse_status,
      parse_status_note: completeMeta.xjtu_grad_parse_note,
    }));

    (parsed as any).program_catalog = mergedCatalogFinal;

    console.log("[XJTU_GRAD_PARSE_COMPLETE_MARK]", {
      kind,
      status: completeMeta.xjtu_grad_parse_status,
      totalRows,
      expectedRows,
      withFaculty,
      withProgram,
      withDuration,
      withDegree,
      withLanguage,
      withTuition,
      withApplicationFee,
      withAccommodation,
      withScholarship,
      withScholarshipCoverage,
      badRows: badRows.length,
    });
  }
} catch (e) {
  console.error("[XJTU_GRAD_PARSE_COMPLETE_MARK_ERR]", e);
}
// ===== XJTU_GRAD_PARSE_COMPLETE_MARK_END =====

// ===== XJTU_GRAD_META_FORCE_SYNC_START =====
try {
  const isXjtuGradMetaForceSync =
    (kind === "phd" || kind === "master") &&
    Array.isArray(mergedCatalogFinal) &&
    mergedCatalogFinal.length > 0 &&
    /西安交通大学|西安交大|XJTU/i.test(String(raw_text || ""));

  if (isXjtuGradMetaForceSync) {
    const parserName =
      kind === "phd"
        ? "xjtu_grad_phd_catalog_v1"
        : "xjtu_grad_master_catalog_v1";

    const forcedMeta = {
      ...((parsed as any)?.program_catalog_meta || {}),
      parser: parserName,
      doc_type: "xjtu_grad_catalog_pdf",
      xjtu_grad_rows: mergedCatalogFinal.length,
      xjtu_grad_kind: kind,
      xjtu_grad_pdf_source: "西安交大硕博.pdf",

      ...(kind === "phd"
        ? {
            xjtu_grad_phd_rows: mergedCatalogFinal.length,
            xjtu_grad_phd_faculty_repair: true,
            xjtu_grad_phd_with_tuition: mergedCatalogFinal.filter((r: any) => r?.tuition_rmb_per_year != null).length,
          }
        : {
            xjtu_grad_master_rows: mergedCatalogFinal.length,
            xjtu_grad_master_with_tuition: mergedCatalogFinal.filter((r: any) => r?.tuition_rmb_per_year != null).length,
          }),
    };

    Object.assign(nextMeta2 as any, forcedMeta);
    (parsed as any).program_catalog_meta = {
      ...((parsed as any).program_catalog_meta || {}),
      ...forcedMeta,
    };
    (parsed as any).program_catalog = mergedCatalogFinal;

    console.log("[XJTU_GRAD_META_FORCE_SYNC]", {
      kind,
      parser: parserName,
      rows: mergedCatalogFinal.length,
      withTuition: mergedCatalogFinal.filter((r: any) => r?.tuition_rmb_per_year != null).length,
      nextMetaParser: (nextMeta2 as any)?.parser,
    });
  }
} catch (e) {
  console.error("[XJTU_GRAD_META_FORCE_SYNC_ERR]", e);
}
// ===== XJTU_GRAD_META_FORCE_SYNC_END =====

    


// ===== BUAA_UG_HTML_CATALOG_PARSE_START =====
try {
  const buaaRaw = String(raw_text || "");
  const buaaHit =
    kind === "ug" &&
    /北京航空航天大学|北航|Beihang|BUAA/i.test(buaaRaw) &&
    /本科生/.test(buaaRaw) &&
    /专业目录/.test(buaaRaw);

  if (buaaHit) {
    const lines = buaaRaw
      .replace(/\r/g, "\n")
      .split(/\n+/g)
      .map((x) => String(x || "").replace(/\s+/g, " ").trim())
      .filter(Boolean);

    const start = lines.findIndex((x) => /六、?\s*专业目录|专业目录/.test(x));
    const src = start >= 0 ? lines.slice(start) : lines;

    const rows: any[] = [];
    let languageText: "中文" | "英文" = "中文";
    let tuitionGroup = "理工类";
    let facultyCn = "";
    let facultyEn = "";
    let enBuf: string[] = [];

    const hasCn = (s: string) => /[\u4e00-\u9fff]/.test(s);
    const hasEn = (s: string) => /[A-Za-z]/.test(s);
    const mostlyEn = (s: string) => hasEn(s) && !hasCn(s);
    const clean = (s: string) => String(s || "").replace(/\s+/g, " ").trim();

    const isNoise = (s: string) =>
      /^(Discipline|School|Major|学科门类|学院|专业|Nature Science and Engineering|Management|Literature and Law|Arts)$/i.test(clean(s)) ||
      /^2\s*0\s*26/.test(clean(s)) ||
      /^六、?\s*专业目录/.test(clean(s));

    const isGroupCn = (s: string) => /^(理工类|经管类|文法类|艺术类)$/.test(clean(s));

    const isFacultyCn = (s: string) =>
      hasCn(s) &&
      /学院|学部|书院|中心|中法工程师|国际通用工程|中法航空/.test(s) &&
      !/专业|申请|奖学金|费用|报名|目录|授课/.test(s);

    const looksLikeMajorCn = (s: string) =>
      hasCn(s) &&
      !isFacultyCn(s) &&
      !isGroupCn(s) &&
      !isNoise(s) &&
      !/申请|奖学金|费用|报名|目录|录取|审核|保险|住宿|系统|点击|下载/.test(s) &&
      s.length >= 2 &&
      s.length <= 90;

    const addRow = (programCn: string, programEn: string) => {
      if (!facultyCn || !programCn) return;

      const isEnglish = languageText === "英文";
      const group =
        isEnglish
          ? "英文项目"
          : /生物与医学工程学院|新媒体艺术与设计学院|艺术类|视觉传达设计|绘画/.test(`${tuitionGroup} ${facultyCn} ${programCn}`)
            ? "生物医学/艺术类"
            : tuitionGroup;

      const tuition =
        isEnglish
          ? 30000
          : /生物与医学工程学院|新媒体艺术与设计学院|艺术类|视觉传达设计|绘画/.test(`${group} ${facultyCn} ${programCn}`)
            ? 30000
            : 25000;

      rows.push({
        idx: rows.length + 1,
        kind: "ug",
        faculty_cn: facultyCn,
        faculty_en: facultyEn || null,
        program_name_cn: clean(programCn),
        program_name_en: clean(programEn) || null,
        degree_type: "本科",
        language_text: languageText,
        study_language: isEnglish ? "en" : "zh",
        duration_years: 4,
        tuition_group: group,
        tuition_rmb_per_year: tuition,
        tuition_is_per_year: true,
        tuition_total_rmb: null,
        tuition_note: isEnglish
          ? "英文授课项目所有专业：30,000 RMB/年。"
          : `中文授课${group}专业：${tuition.toLocaleString("en-US")} RMB/年。`,
        application_fee_rmb: 400,
        application_fee_note: "报名费：400元人民币，网上支付；无论申请成功与否，报名费不予退还。",
        accommodation_fee_note: "北京校区双人间30元/床位/天；杭州国际校园双人间2000-2500元/学年。住宿需提前预定，住宿费以实际入住宿舍为准，且不含水电费。",
        application_time_text: "申请开始日期：2025年11月1日；申请截止日期：2026年6月30日；正式录取日期：2026年7月；入学日期：2026年9月。",
        application_portal_text: "http://admission.buaa.edu.cn/",
        apply_requirements_text: "申请人须为持外国有效护照的非中国籍公民，并符合相关国籍规定；身心健康，品行端正，对华友好；年龄原则上18至22周岁；高中毕业以上学历。",
        language_requirements_text: "中文授课申请人须提供两年内HSK成绩，达到HSK5级以上且不低于180分；英文授课申请人须提供两年内英语能力证明，如IELTS 6.0及以上、TOEFL 90及以上，或高中期间全部课程使用英文授课证明等。",
        exam_requirements_text: "申请者须参加来华留学本科入学学业水平测试（CSCA测试）并获得测试成绩，最晚须在5月30日前提交CSCA成绩单至北航申请系统。",
        application_process_text: "1. 参加来华留学本科入学学业水平测试（CSCA测试）。；2. 登录北航国际学生在线申请系统注册账户。；3. 在线提交申请材料。；4. 缴纳报名费并正式提交申请。；5. 关注申请系统状态和个人邮箱。",
        application_materials_text: "普通护照信息页；高中毕业证书或预计毕业证明；高中阶段全部课程成绩单；CSCA测试成绩单；语言能力证明；外国人体格检查表及血液检查报告；经济担保人担保函及经济能力证明；出生证明；申请人出生时父母双方国籍证明文件；无犯罪记录证明；诚信承诺书；未满18周岁申请者须提交监护人保证书公证书；其他补充材料。",
        scholarship_note: "奖学金包括：中国政府奖学金-国别双边项目（A类）、北京航空航天大学国际学生本科生新生“优才计划”奖学金、北京航空航天大学自费外国留学生专项合作奖学金、北京来华留学生政府奖学金、北京航空航天大学自费外国留学生奖学金（新生）。",
        scholarship_coverage_text: "奖学金覆盖包括全额或部分学费减免；部分奖学金还可覆盖生活费、住宿费或保险费，具体以奖学金类别和当年评审结果为准。",
        scholarship_application_time_text: "部分北航/北京市奖学金申请截止日期：2026年5月30日；中国政府奖学金按本国留学生派遣部门通知申请。",
        contact_phone: "+86-10-82339158; +86-10-82339331; +86-10-82316488",
        contact_email: "undergraduate@buaa.edu.cn",
        source_url: String(source_url || source_url_raw || ""),
        source_files: [String(out?.filename || file?.name || "buaa_ug_html")],
        raw_line: `${facultyCn} ${programCn} ${languageText} 4年`,
        raw_block: `${tuitionGroup} ${facultyEn} ${facultyCn} ${programEn} ${programCn}`,
        tags: ["本科", languageText, "BUAA目录", "HTML官网"],
      });
    };

    for (const rawLine of src) {
      const line = clean(rawLine);
      if (!line) continue;

      if (/英文授课|国际本科生英文|English-Taught/i.test(line)) {
        languageText = "英文";
        tuitionGroup = "英文项目";
        facultyCn = "";
        facultyEn = "";
        enBuf = [];
        continue;
      }

      if (/中文授课|国际本科生中文|Chinese-Taught/i.test(line)) {
        languageText = "中文";
        tuitionGroup = "理工类";
        facultyCn = "";
        facultyEn = "";
        enBuf = [];
        continue;
      }

      if (isNoise(line)) continue;

      if (isGroupCn(line)) {
        tuitionGroup = line;
        enBuf = [];
        continue;
      }

      if (mostlyEn(line)) {
        enBuf.push(line);
        continue;
      }

      if (isFacultyCn(line)) {
        facultyCn = line;
        facultyEn = enBuf.join(" ");
        enBuf = [];
        continue;
      }

      if (looksLikeMajorCn(line) && facultyCn) {
        addRow(line, enBuf.join(" "));
        enBuf = [];
      }
    }

    const cleanRows = rows
      .filter((r: any) =>
        r?.faculty_cn &&
        r?.program_name_cn &&
        r.duration_years === 4 &&
        !/申请|奖学金|报名|费用|目录|时间安排|录取审核|系统|点击|下载/.test(String(r.program_name_cn || ""))
      )
      .map((r: any, i: number) => ({ ...r, idx: i + 1 }));

    if (cleanRows.length >= 20) {
      mergedCatalogFinal = cleanRows;
      (parsed as any).program_catalog = mergedCatalogFinal;

      Object.assign(nextMeta2 as any, {
        parser: "buaa_ug_html_catalog_v1",
        doc_type: "buaa_ug_catalog_html",
        rows: cleanRows.length,
        buaa_ug_rows: cleanRows.length,
        buaa_ug_parse_status: "complete",
        buaa_ug_with_tuition: cleanRows.filter((r: any) => r.tuition_rmb_per_year != null).length,
        buaa_ug_with_apply_requirements: cleanRows.filter((r: any) => Boolean(r.apply_requirements_text)).length,
        buaa_ug_with_scholarship: cleanRows.filter((r: any) => Boolean(r.scholarship_note)).length,
      });

      (parsed as any).program_catalog_meta = {
        ...((parsed as any).program_catalog_meta || {}),
        ...nextMeta2,
      };

      console.log("[BUAA_UG_HTML_CATALOG_PARSE]", {
        rows: cleanRows.length,
        first: cleanRows[0] || null,
        last: cleanRows[cleanRows.length - 1] || null,
      });
    } else {
      console.log("[BUAA_UG_HTML_CATALOG_PARSE_SKIP]", {
        reason: "too_few_rows",
        rows: cleanRows.length,
        sample: rows.slice(0, 8),
      });
    }
  }
} catch (e) {
  console.error("[BUAA_UG_HTML_CATALOG_PARSE_ERR]", e);
}
// ===== BUAA_UG_HTML_CATALOG_PARSE_END =====



// ===== BUAA_RCSSTEAP_MASTA_DOCSTA_PARSE_START =====
try {
  const rcsRaw = String(raw_text || "");
  const isBuaaRcssteap =
    /RCSSTEAP|Regional Centre for Space Science and Technology Education|联合国附属空间科技教育亚太区域中心/i.test(rcsRaw) &&
    /MASTA/i.test(rcsRaw) &&
    /DOCSTA/i.test(rcsRaw);

  if ((kind === "master" || kind === "phd") && isBuaaRcssteap) {
    const isPhd = kind === "phd";

    const commonRows = [
      {
        program_name_en: "Remote Sensing and Geographic Information System (RS&GIS)",
        program_name_cn: "遥感与地理信息系统",
        track_name_en: "RS&GIS",
        track_name_cn: "遥感与地理信息系统",
      },
      {
        program_name_en: "Global Navigation Satellite Systems (GNSS)",
        program_name_cn: "全球导航卫星系统",
        track_name_en: "GNSS",
        track_name_cn: "全球导航卫星系统",
      },
      {
        program_name_en: "Micro-satellite Technology",
        program_name_cn: "微小卫星技术",
        track_name_en: "Micro-satellite Technology",
        track_name_cn: "微小卫星技术",
      },
    ];

    const mastaOnlyRows = [
      {
        program_name_en: "Space Project Management (SPM)",
        program_name_cn: "空间项目管理",
        track_name_en: "Space Project Management",
        track_name_cn: "空间项目管理",
      },
    ];

    const basePrograms = isPhd ? commonRows : [...commonRows, ...mastaOnlyRows];

    const degreeEn = isPhd
      ? "Doctoral Program on Space Technology Applications (DOCSTA)"
      : "Master Program on Space Technology Applications (MASTA)";
    const degreeCn = isPhd ? "博士" : "硕士";
    const tuition = isPhd ? 42000 : 35000;
    const durationYears = isPhd ? 4 : 3;
    const durationText = isPhd ? "4 years" : "2~3 years";
    const parserName = isPhd ? "buaa_rcssteap_docsta_pdf_v1" : "buaa_rcssteap_masta_pdf_v1";
    const docType = isPhd ? "buaa_rcssteap_docsta" : "buaa_rcssteap_masta";

    const rows = basePrograms.map((x: any, i: number) => ({
      idx: i + 1,
      kind,
      faculty_cn: "国际学院 / 联合国附属空间科技教育亚太区域中心（中国）",
      faculty_en: "International School / RCSSTEAP (China), Beihang University",
      program_name_cn: x.program_name_cn,
      program_name_en: x.program_name_en,
      track_name_cn: x.track_name_cn,
      track_name_en: x.track_name_en,
      degree_type: degreeCn,
      degree_name_cn: degreeCn,
      degree_name_en: degreeEn,
      language_text: "英文",
      study_language: "en",
      duration_years: durationYears,
      duration_text: durationText,
      tuition_group: "RCSSTEAP special program",
      tuition_rmb_per_year: tuition,
      tuition_is_per_year: true,
      tuition_total_rmb: null,
      tuition_note: `${degreeEn} tuition: CNY ${tuition.toLocaleString("en-US")} per year.`,
      application_fee_rmb: 400,
      application_fee_note: "Application fee: CNY 400. The application fee is non-refundable.",
      application_time_text: "2026 intake. Application deadline: June 30, 2026.",
      application_portal_text: "https://rcssteap.buaa.edu.cn/",
      apply_requirements_text: isPhd
        ? "DOCSTA applicants are expected to have a master's degree and the ability to conduct independent scientific research in the relevant field."
        : "MASTA applicants are expected to meet the admission requirements of the RCSSTEAP/Beihang Master Program on Space Technology Applications.",
      language_requirements_text: "The program is taught in English.",
      application_process_text: "Apply according to the RCSSTEAP (China), Beihang University 2026 MASTA&DOCSTA Admission Announcement.",
      application_materials_text: "Refer to the official RCSSTEAP 2026 MASTA&DOCSTA Admission Announcement for required application documents.",
      scholarship_note: "Scholarship information should follow the official RCSSTEAP/Beihang University 2026 MASTA&DOCSTA Admission Announcement.",
      scholarship_coverage_text: "Coverage varies by scholarship category and final admission/scholarship decision.",
      source_url: String(source_url || source_url_raw || ""),
      source_files: [String(out?.filename || file?.name || "buaa_rcssteap_masta_docsta")],
      raw_line: `${degreeEn} - ${x.program_name_en}`,
      raw_block: "RCSSTEAP 2026 MASTA&DOCSTA Admission Announcement",
      tags: ["RCSSTEAP", isPhd ? "DOCSTA" : "MASTA", "BUAA", "special program", "English"],
      parse_status: "complete",
    }));

    mergedCatalogFinal = rows;
    (parsed as any).program_catalog = mergedCatalogFinal;

    Object.assign(nextMeta2 as any, {
      parser: parserName,
      doc_type: docType,
      rows: rows.length,
      buaa_rcssteap_parse_status: "complete",
      buaa_rcssteap_kind: isPhd ? "docsta" : "masta",
      buaa_rcssteap_rows: rows.length,
      buaa_rcssteap_with_tuition: rows.filter((r: any) => r.tuition_rmb_per_year != null).length,
      buaa_rcssteap_with_language: rows.filter((r: any) => Boolean(r.language_text)).length,
      buaa_rcssteap_source: "2026 MASTA&DOCSTA Admission Announcement",
    });

    (parsed as any).program_catalog_meta = {
      ...((parsed as any).program_catalog_meta || {}),
      ...nextMeta2,
      buaa_rcssteap_special_hit: true,
    };
    (parsed as any).buaa_rcssteap_special_hit = true;

    console.log("[BUAA_RCSSTEAP_MASTA_DOCSTA_PARSE]", {
      kind,
      parser: parserName,
      rows: rows.length,
      first: rows[0] || null,
      last: rows[rows.length - 1] || null,
    });
  }
} catch (e) {
  console.error("[BUAA_RCSSTEAP_MASTA_DOCSTA_PARSE_ERR]", e);
}
// ===== BUAA_RCSSTEAP_MASTA_DOCSTA_PARSE_END =====

// ===== BUAA_MASTER_HTML_CATALOG_PARSE_START =====
try {
  const buaaMasterRaw = String(raw_text || "");
  const isBuaaMasterHtml =
    !/RCSSTEAP|MASTA|DOCSTA|Regional Centre for Space Science and Technology Education|联合国附属空间科技教育亚太区域中心/i.test(String(raw_text || "")) &&
    !Boolean((parsed as any)?.buaa_rcssteap_special_hit) &&
    !Boolean((parsed as any)?.program_catalog_meta?.buaa_rcssteap_special_hit) &&
    kind === "master" &&
    /北京航空航天大学|北航|Beihang|BUAA/i.test(buaaMasterRaw) &&
    /Master Program|硕士研究生/i.test(buaaMasterRaw) &&
    /Major List/i.test(buaaMasterRaw);

  if (isBuaaMasterHtml) {
    const lines = buaaMasterRaw
      .replace(/\r/g, "\n")
      .split(/\n+/g)
      .map((x) => String(x || "").replace(/\s+/g, " ").trim())
      .filter(Boolean);

    const start = lines.findIndex((x) => /Major List/i.test(x));
    let end = lines.findIndex((x, i) => i > start && /Supervisor List and Course Catalogue|Fees/i.test(x));
    if (end < 0) end = lines.length;
    const src = start >= 0 ? lines.slice(start, end) : lines;

    const rows: any[] = [];
    let group = "理工类";
    let facultyEn = "";
    let facultyCn = "";
    let pendingEn = "";
    let pendingCn = "";

    const clean = (s: string) => String(s || "").replace(/\s+/g, " ").trim();
    const hasCn = (s: string) => /[\u4e00-\u9fff]/.test(s);
    const hasEn = (s: string) => /[A-Za-z]/.test(s);
    const mostlyEn = (s: string) => hasEn(s) && !hasCn(s);
    const hasMark = (s: string) => /[●▲◆☐△]/.test(s);
    const stripMarks = (s: string) => clean(String(s || "").replace(/[●▲◆☐△]/g, ""));

    const langFromMark = (m: string) => {
      if (m === "●") return { text: "中文", code: "zh" };
      if (m === "▲") return { text: "英文", code: "en" };
      if (m === "◆") return { text: "法文", code: "fr" };
      if (m === "☐") return { text: "德语", code: "de" };
      if (m === "△") return { text: "俄语", code: "ru" };
      return { text: "未知", code: null };
    };

    const updateGroup = (s: string) => {
      if (/Nature Science and Engineering|理工类/i.test(s)) return "理工类";
      if (/Economics and Management|经管类/i.test(s)) return "经管类";
      if (/Humanities|Literature and Law|文法类/i.test(s)) return "文法类";
      if (/Art|艺术类/i.test(s)) return "艺术类";
      return null;
    };

    const isNoise = (s: string) =>
      /^https?:\/\//i.test(s) ||
      /^Click here/i.test(s) ||
      /^(Major List|School 学院|Major 专业|School|Major|专业|Note:|Supervisor List|Course Catalogue)$/i.test(s) ||
      /Taught in Chinese|Taught in English|Taught in French|Taught in German|Taught in Russian/i.test(s);

    const isFacultyCn = (s: string) =>
      hasCn(s) &&
      /学院|研究院|中心|校园|实验室|平台|工程师学院|巴西中心|科创中心/.test(s) &&
      !hasMark(s) &&
      !/专业|目录|费用|奖学金|申请|授课/.test(s);

    const addRows = (programCnRaw: string, programEnRaw: string, markSource: string) => {
      const programCn = stripMarks(programCnRaw);
      const programEn = stripMarks(programEnRaw);
      const marks = Array.from(new Set((markSource.match(/[●▲◆☐△]/g) || [])));

      if (!facultyCn || !programCn || marks.length === 0) return;

      for (const mark of marks) {
        const lang = langFromMark(mark);
        rows.push({
          idx: rows.length + 1,
          kind: "master",
          faculty_cn: facultyCn,
          faculty_en: facultyEn || null,
          program_name_cn: programCn,
          program_name_en: programEn || null,
          degree_type: "硕士",
          language_text: lang.text,
          study_language: lang.code,
          duration_years: 3,
          duration_text: "2~3 years",
          tuition_group: group,
          tuition_rmb_per_year: 35000,
          tuition_is_per_year: true,
          tuition_total_rmb: null,
          tuition_note: "硕士研究生学费：CNY 35,000 per year。",
          application_fee_rmb: 400,
          application_fee_note: "Application fee: CNY 400. The application fee will not be refunded whether the application is successful or not.",
          application_time_text: "Online Application Start Date: November 1, 2025; Application Deadline: June 30, 2026; Registration Date: September 2026.",
          application_portal_text: "http://admission.buaa.edu.cn",
          apply_requirements_text: "Applicants must be non-Chinese citizens in good physical and mental health, hold a bachelor's degree, and be under the age of 35.",
          language_requirements_text: "Chinese-taught programs require HSK Level 5 or above with a minimum score of 180 within 2 years. English-taught programs require IELTS 6.0 Academic, TOEFL 90, Duolingo 105 within 2 years; GRE is recommended if available.",
          application_process_text: "Apply online at Beihang international student application system, prepare and submit required documents online. Document review starts after application fee receipt is submitted.",
          application_materials_text: "Application form; passport home page; notarized highest diploma or expected graduation proof; academic transcripts; language qualification certificates; acceptance letter from supervisor; study plan; two recommendation letters; Foreigner Physical Examination Form; non-criminal record report; financial guarantor certificate and bank statement for self-support applicants; resume; integrity commitment letter; application fee payment proof; list of application documents; other documents required by Beihang University.",
          scholarship_note: "Scholarships include Chinese Government Scholarship, Beijing Government Scholarship, and Beihang University Foreign Students Scholarship.",
          scholarship_coverage_text: "Scholarship coverage varies by scholarship category and annual evaluation.",
          source_url: String(source_url || source_url_raw || ""),
          source_files: [String(out?.filename || file?.name || "buaa_master_html")],
          raw_line: `${facultyCn} ${programCn} ${lang.text} 2~3 years`,
          raw_block: `${group} ${facultyEn} ${facultyCn} ${programEn} ${programCn} ${mark}`,
          tags: ["硕士", lang.text, "BUAA目录", "HTML官网"],
        });
      }
    };

    for (const rawLine of src) {
      const line = clean(rawLine);
      if (!line || isNoise(line)) continue;

      const g = updateGroup(line);
      if (g) {
        group = g;
        pendingEn = "";
        pendingCn = "";
        continue;
      }

      if (hasMark(line)) {
        if (mostlyEn(line)) {
          pendingEn = line;
          pendingCn = "";
          continue;
        }
        if (hasCn(line)) {
          // Some rows appear as: English major line first, then Chinese major with language marks.
          if (pendingEn) {
            addRows(line, pendingEn, line);
            pendingEn = "";
            pendingCn = "";
            continue;
          }
          pendingCn = line;
          continue;
        }
      }

      if (pendingEn && hasCn(line) && !hasMark(line) && !isFacultyCn(line)) {
        addRows(line, pendingEn, pendingEn);
        pendingEn = "";
        pendingCn = "";
        continue;
      }

      if (pendingCn && mostlyEn(line) && !hasMark(line)) {
        addRows(pendingCn, line, pendingCn);
        pendingEn = "";
        pendingCn = "";
        continue;
      }

      if (mostlyEn(line) && !hasMark(line)) {
        pendingEn = line;
        continue;
      }

      if (isFacultyCn(line)) {
        facultyCn = line;
        facultyEn = pendingEn || "";
        pendingEn = "";
        pendingCn = "";
        continue;
      }
    }

    const cleanRows = rows
      .filter((r: any) =>
        r?.faculty_cn &&
        r?.program_name_cn &&
        r?.language_text &&
        r?.tuition_rmb_per_year === 35000 &&
        !/学院|研究院|中心|校园|平台|实验室/.test(String(r.program_name_cn || ""))
      )
      .map((r: any, i: number) => ({ ...r, idx: i + 1 }));

    if (cleanRows.length >= 30) {
      mergedCatalogFinal = cleanRows;
      (parsed as any).program_catalog = mergedCatalogFinal;

      Object.assign(nextMeta2 as any, {
        parser: "buaa_master_html_catalog_v1",
        doc_type: "buaa_master_catalog_html",
        rows: cleanRows.length,
        buaa_master_rows: cleanRows.length,
        buaa_master_parse_status: "complete",
        buaa_master_with_tuition: cleanRows.filter((r: any) => r.tuition_rmb_per_year != null).length,
        buaa_master_with_language: cleanRows.filter((r: any) => Boolean(r.language_text)).length,
      });

      (parsed as any).program_catalog_meta = {
        ...((parsed as any).program_catalog_meta || {}),
        ...nextMeta2,
      };

      console.log("[BUAA_MASTER_HTML_CATALOG_PARSE]", {
        rows: cleanRows.length,
        first: cleanRows[0] || null,
        last: cleanRows[cleanRows.length - 1] || null,
      });
    } else {
      console.log("[BUAA_MASTER_HTML_CATALOG_PARSE_SKIP]", {
        reason: "too_few_rows",
        rows: cleanRows.length,
        sample: rows.slice(0, 10),
      });
    }
  }
} catch (e) {
  console.error("[BUAA_MASTER_HTML_CATALOG_PARSE_ERR]", e);
}
// ===== BUAA_MASTER_HTML_CATALOG_PARSE_END =====


// ===== BUAA_PHD_HTML_CATALOG_PARSE_START =====
try {
  const buaaPhdRaw = String(raw_text || "");
  const isBuaaPhdHtml =
    !/RCSSTEAP|MASTA|DOCSTA|Regional Centre for Space Science and Technology Education|联合国附属空间科技教育亚太区域中心/i.test(String(raw_text || "")) &&
    !Boolean((parsed as any)?.buaa_rcssteap_special_hit) &&
    !Boolean((parsed as any)?.program_catalog_meta?.buaa_rcssteap_special_hit) &&
    kind === "phd" &&
    /北京航空航天大学|北航|Beihang|BUAA/i.test(buaaPhdRaw) &&
    /Doctoral Program|博士研究生/i.test(buaaPhdRaw) &&
    /Major List/i.test(buaaPhdRaw);

  if (isBuaaPhdHtml) {
    const buaaPhdNormalized = buaaPhdRaw
      .replace(/\r/g, "\n")
      .replace(/https?:\/\/\S+/gi, "\n")
      // English school + Chinese school may be collapsed into one line.
      .replace(/([A-Za-z][^\n]*?)(?=[\u4e00-\u9fff][^\n]*(学院|研究院|中心|校园|实验室|平台|工程师学院|巴西中心|科创中心|区域中心))/g, "$1\n")
      // English major with marks may be followed by Chinese major on the same line.
      .replace(/([●▲◆☐△]+)\s*(?=[\u4e00-\u9fff])/g, "$1\n");

    const lines = buaaPhdNormalized
      .split(/\n+/g)
      .map((x) => String(x || "").replace(/\s+/g, " ").trim())
      .filter(Boolean);

    const start = lines.findIndex((x) => /Major List/i.test(x));
    let end = lines.findIndex((x, i) => i > start && /Supervisor List and Course Catalogue|Fees/i.test(x));
    if (end < 0) end = lines.length;
    const src = start >= 0 ? lines.slice(start, end) : lines;

    const rows: any[] = [];
    let group = "理工类";
    let facultyEn = "";
    let facultyCn = "";
    let pendingEn = "";
    let pendingCn = "";

    const clean = (s: string) => String(s || "").replace(/\s+/g, " ").trim();
    const hasCn = (s: string) => /[\u4e00-\u9fff]/.test(s);
    const hasEn = (s: string) => /[A-Za-z]/.test(s);
    const mostlyEn = (s: string) => hasEn(s) && !hasCn(s);
    const hasMark = (s: string) => /[●▲◆☐△]/.test(s);
    const stripMarks = (s: string) => clean(String(s || "").replace(/[●▲◆☐△]/g, ""));

    const langFromMark = (m: string) => {
      if (m === "●") return { text: "中文", code: "zh" };
      if (m === "▲") return { text: "英文", code: "en" };
      if (m === "◆") return { text: "法文", code: "fr" };
      if (m === "☐") return { text: "德语", code: "de" };
      if (m === "△") return { text: "俄语", code: "ru" };
      return { text: "未知", code: null };
    };

    const updateGroup = (s: string) => {
      if (/Nature Science and Engineering|理工类/i.test(s)) return "理工类";
      if (/Economics and Management|经管类/i.test(s)) return "经管类";
      if (/Humanities|Literature and Law|文法类/i.test(s)) return "文法类";
      if (/Art|艺术类/i.test(s)) return "艺术类";
      return null;
    };

    const isNoise = (s: string) =>
      /^https?:\/\//i.test(s) ||
      /^Click here/i.test(s) ||
      /^(Major List|School 学院|Major 专业|School|Major|专业|Note:|Supervisor List|Course Catalogue|Platform|平台)$/i.test(s) ||
      /Taught in Chinese|Taught in English|Taught in French|Taught in German|Taught in Russian/i.test(s);

    const isFacultyCn = (s: string) =>
      hasCn(s) &&
      /学院|研究院|中心|校园|实验室|平台|工程师学院|巴西中心|科创中心|区域中心/.test(s) &&
      !hasMark(s) &&
      !/专业|目录|费用|奖学金|申请|授课/.test(s);

    const addRows = (programCnRaw: string, programEnRaw: string, markSource: string) => {
      const programCn = stripMarks(programCnRaw);
      const programEn = stripMarks(programEnRaw);
      const marks = Array.from(new Set((markSource.match(/[●▲◆☐△]/g) || [])));

      if (!facultyCn || !programCn || marks.length === 0) return;

      for (const mark of marks) {
        const lang = langFromMark(mark);
        rows.push({
          idx: rows.length + 1,
          kind: "phd",
          faculty_cn: facultyCn,
          faculty_en: facultyEn || null,
          program_name_cn: programCn,
          program_name_en: programEn || null,
          degree_type: "博士",
          language_text: lang.text,
          study_language: lang.code,
          duration_years: 4,
          duration_text: "4 years",
          tuition_group: group,
          tuition_rmb_per_year: 42000,
          tuition_is_per_year: true,
          tuition_total_rmb: null,
          tuition_note: "博士研究生学费：CNY 42,000 per year。",
          application_fee_rmb: 400,
          application_fee_note: "Application fee: CNY 400. The application fee will not be refunded whether the application is successful or not.",
          accommodation_fee_note: "Beijing campuses: CNY 30 per day per bed; Hangzhou International Campus: CNY 2,000 per year per bed. Accommodation should be applied for in advance and excludes utilities.",
          application_time_text: "Online Application Start Date: November 1, 2025; Application Deadline: June 30, 2026; Registration Date: September 2026.",
          application_portal_text: "http://admission.buaa.edu.cn",
          apply_requirements_text: "Applicants must be non-Chinese citizens in good physical and mental health, hold a master's degree, and be under the age of 40.",
          language_requirements_text: "Chinese-taught programs require HSK Level 5 or above with a minimum score of 180 within 2 years. English-taught programs require IELTS 6.0 Academic, TOEFL 90, Duolingo 105 within 2 years; GRE is recommended if available.",
          application_process_text: "Apply online at Beihang international student application system, prepare and submit required documents online. Document review starts after application fee receipt is submitted.",
          application_materials_text: "Application form; passport home page; notarized highest diploma or expected graduation proof; academic transcripts; language qualification certificates; acceptance letter from supervisor; study plan of more than 1,000 characters or words; two recommendation letters; Foreigner Physical Examination Form; non-criminal record report; financial guarantor certificate and bank statement for self-support applicants; resume; integrity commitment letter; application fee payment proof; list of application documents; other documents required by Beihang University.",
          scholarship_note: "Scholarships include Chinese Government Scholarship, Beijing Government Scholarship, and Beihang University Foreign Students Scholarship.",
          scholarship_coverage_text: "Scholarship coverage varies by scholarship category and annual evaluation.",
          source_url: String(source_url || source_url_raw || ""),
          source_files: [String(out?.filename || file?.name || "buaa_phd_html")],
          raw_line: `${facultyCn} ${programCn} ${lang.text} 4 years`,
          raw_block: `${group} ${facultyEn} ${facultyCn} ${programEn} ${programCn} ${mark}`,
          tags: ["博士", lang.text, "BUAA目录", "HTML官网"],
        });
      }
    };

    for (const rawLine of src) {
      const line = clean(rawLine);
      if (!line || isNoise(line)) continue;

      const g = updateGroup(line);
      if (g) {
        group = g;
        pendingEn = "";
        pendingCn = "";
        continue;
      }

      if (hasMark(line)) {
        if (mostlyEn(line)) {
          pendingEn = line;
          pendingCn = "";
          continue;
        }
        if (hasCn(line)) {
          pendingCn = line;
          pendingEn = "";
          continue;
        }
      }

      if (pendingEn && hasCn(line) && !hasMark(line) && !isFacultyCn(line)) {
        addRows(line, pendingEn, pendingEn);
        pendingEn = "";
        pendingCn = "";
        continue;
      }

      if (pendingCn && mostlyEn(line) && !hasMark(line)) {
        addRows(pendingCn, line, pendingCn);
        pendingEn = "";
        pendingCn = "";
        continue;
      }

      if (mostlyEn(line) && !hasMark(line)) {
        pendingEn = line;
        continue;
      }

      if (isFacultyCn(line)) {
        facultyCn = line;
        facultyEn = pendingEn || "";
        pendingEn = "";
        pendingCn = "";
        continue;
      }
    }

    const cleanRows = rows
      .filter((r: any) =>
        r?.faculty_cn &&
        r?.program_name_cn &&
        r?.language_text &&
        r?.tuition_rmb_per_year === 42000 &&
        !/学院|研究院|中心|校园|平台|实验室/.test(String(r.program_name_cn || ""))
      )
      .map((r: any, i: number) => ({ ...r, idx: i + 1 }));

    if (cleanRows.length >= 30) {
      mergedCatalogFinal = cleanRows;
      (parsed as any).program_catalog = mergedCatalogFinal;

      Object.assign(nextMeta2 as any, {
        parser: "buaa_phd_html_catalog_v1",
        doc_type: "buaa_phd_catalog_html",
        rows: cleanRows.length,
        buaa_phd_rows: cleanRows.length,
        buaa_phd_parse_status: "complete",
        buaa_phd_with_tuition: cleanRows.filter((r: any) => r.tuition_rmb_per_year != null).length,
        buaa_phd_with_language: cleanRows.filter((r: any) => Boolean(r.language_text)).length,
      });

      (parsed as any).program_catalog_meta = {
        ...((parsed as any).program_catalog_meta || {}),
        ...nextMeta2,
      };

      console.log("[BUAA_PHD_HTML_CATALOG_PARSE]", {
        rows: cleanRows.length,
        first: cleanRows[0] || null,
        last: cleanRows[cleanRows.length - 1] || null,
      });
    } else {
      console.log("[BUAA_PHD_HTML_CATALOG_PARSE_SKIP]", {
        reason: "too_few_rows",
        rows: cleanRows.length,
        sample: rows.slice(0, 10),
      });
    }
  }
} catch (e) {
  console.error("[BUAA_PHD_HTML_CATALOG_PARSE_ERR]", e);
}
// ===== BUAA_PHD_HTML_CATALOG_PARSE_END =====





// ===== BUAA_CHINESE_LANGUAGE_HTML_PARSE_START =====
try {
  const src = String(source_url || source_url_raw || program_catalog_meta?.source_url || "");
  const rawForBuaaChinese = String(raw_text || "");

  if (
    String(kind) === "chinese_language" &&
    /is\.buaa\.edu\.cn\/lxsq\/hyjxs\.htm/i.test(src) &&
    /汉语进修生|普通汉语课程|北航国际合作部汉语进修生2026年秋季招生简章/.test(rawForBuaaChinese)
  ) {
    const rows = [
      {
        idx: 1,
        kind: "chinese_language",
        program_category: "chinese_language",
        faculty_cn: "国际合作部 / 国际中文教育办公室",
        faculty_en: "International Chinese Education Office",
        program_name_cn: "普通汉语课程",
        program_name_en: "General Chinese Language Program",
        degree_type: "非学历",
        degree_name_cn: "汉语进修生",
        degree_name_en: "Chinese Language Student",
        language_text: "中文",
        study_language: "zh",
        duration_text: "一学期或一学年",
        duration_years: null,
        tuition_rmb_per_semester: 9000,
        tuition_rmb_per_year: 17200,
        tuition_is_per_year: false,
        tuition_note: "普通汉语课程：9000元/学期，17200元/学年。",
        application_fee_rmb: 400,
        application_fee_note: "报名费400元。",
        accommodation_fee_note: "住宿费：30元/天（晚报名者自行解决住宿）。",
        application_deadline: "2026-07-15",
        application_time_text: "秋季学期：2026年9月1日-2027年1月6日；一学年：2026年9月1日-2027年7月6日；申请截止日期：2026年7月15日。",
        application_portal_text: "https://admission.buaa.edu.cn/",
        apply_requirements_text: "凡年龄在18-55周岁且对中国及汉语感兴趣的各界人士均可报名。",
        application_process_text: "通过北航国际学生在线申请系统申请；汇款支付报名费400元；学校为报名成功的学生办理来华学习签证申请表；学生办理签证，入校学习。",
        application_materials_text: "请按北航国际学生在线申请系统要求提交申请材料。",
        source_url: src || "https://is.buaa.edu.cn/lxsq/hyjxs.htm",
        source_files: [String(source_url || source_url_raw || "hyjxs.htm")].filter(Boolean),
        raw_block: "北航国际合作部汉语进修生2026年秋季招生简章",
        tags: ["汉语进修", "非学历", "中文课程"],
      },
    ];

    (parsed as any).program_catalog = rows;
    (parsed as any).program_catalog_meta = {
      ...((parsed as any).program_catalog_meta || {}),
      parser: "buaa_chinese_language_html_v1",
      doc_type: "buaa_chinese_language_html",
      kind: "chinese_language",
      education_level: "chinese_language",
      source_url: src || "https://is.buaa.edu.cn/lxsq/hyjxs.htm",
      buaa_chinese_language_parse_status: "complete",
      buaa_chinese_language_rows: rows.length,
      buaa_chinese_language_with_tuition: rows.filter((r: any) => r.tuition_rmb_per_year != null || r.tuition_rmb_per_semester != null).length,
      buaa_chinese_language_kind: "chinese_language",
    };

    console.log("[BUAA_CHINESE_LANGUAGE_HTML_PARSE]", {
      rows: rows.length,
      parser: "buaa_chinese_language_html_v1",
      source_url: src || "https://is.buaa.edu.cn/lxsq/hyjxs.htm",
    });
  }
} catch (e) {
  console.error("[BUAA_CHINESE_LANGUAGE_HTML_PARSE_ERR]", e);
}
// ===== BUAA_CHINESE_LANGUAGE_HTML_PARSE_END =====

// ===== BUAA_FOUNDATION_BACHELOR_HTML_PARSE_START =====
try {
  const foundationRaw = String(raw_text || "");
  const isBuaaFoundationBachelor =
    String(kind) === "foundation_bachelor" &&
    /北京航空航天大学|北航|Beihang|BUAA/i.test(foundationRaw) &&
    /Foundation\+Bachelor|Foundation\s*\+\s*Bachelor|预本连读/i.test(foundationRaw) &&
    /Major of Bachelor Degree/i.test(foundationRaw);

  if (isBuaaFoundationBachelor) {
    const sourceUrlNow = String(source_url || source_url_raw || "");
    const programs = [
      {
        program_name_cn: "计算机科学与技术（人工智能与大数据）",
        program_name_en: "Computer Science and Technology (AI and Big Data)",
        track_name_cn: "人工智能与大数据",
        track_name_en: "AI and Big Data",
      },
      {
        program_name_cn: "国际经济与贸易（数字贸易）",
        program_name_en: "International Economics and Trade (Digital Trade)",
        track_name_cn: "数字贸易",
        track_name_en: "Digital Trade",
      },
      {
        program_name_cn: "生物医学工程",
        program_name_en: "Biomedical Engineering",
        track_name_cn: "生物医学工程",
        track_name_en: "Biomedical Engineering",
      },
    ];

    const rows = programs.map((x: any, i: number) => ({
      idx: i + 1,
      kind: "foundation_bachelor",
      program_category: "foundation_bachelor",
      faculty_cn: "杭州国际创新研究院 / 国际教育中心",
      faculty_en: "International Education Center, Hangzhou International Innovation Institute of Beihang University",
      program_name_cn: x.program_name_cn,
      program_name_en: x.program_name_en,
      track_name_cn: x.track_name_cn,
      track_name_en: x.track_name_en,
      degree_type: "预本连读",
      degree_name_cn: "预本连读 / 本科衔接项目",
      degree_name_en: "Foundation+Bachelor Program",
      language_text: "英文",
      study_language: "en",
      foundation_duration_text: "April to July, 2026",
      foundation_duration_months: 4,
      bachelor_duration_years: 4,
      duration_years: 4,
      duration_text: "Foundation Course: April to July 2026; Bachelor Degree: 4 years, starting from August/September 2026.",
      application_deadline: "2026-03-10",
      registration_date: "2026-04-15",
      application_fee_rmb: 400,
      application_fee_note: "Application Fee: 400 Yuan. The application fee will not be refunded whether the application is successful or not.",
      foundation_tuition_rmb: 8000,
      foundation_tuition_note: "Foundation Course Tuition Fees: 8000 CNY, accommodation included.",
      bachelor_tuition_rmb_per_year: 30000,
      tuition_rmb_per_year: 30000,
      tuition_is_per_year: true,
      tuition_group: "foundation_bachelor",
      tuition_note: "Bachelor Degree Tuition Fees: 30000 CNY yearly.",
      accommodation_fee_note: "Foundation course accommodation included in tuition. Bachelor degree accommodation fee for double room: 2000–2500 CNY.",
      insurance_fee_note: "Foundation insurance fee: 400 CNY. Bachelor degree insurance fee: 800 CNY yearly.",
      medical_fee_note: "Foundation medical fee: 400–500 CNY. Bachelor degree medical fee: 400–500 CNY, first year only.",
      visa_extension_fee_note: "Foundation visa extension fee: 400 CNY. Bachelor degree visa extension fee: 400–800 CNY yearly.",
      apply_requirements_text: "Applicants must be non-Chinese citizens with valid passports, in good physical and mental health, aged 18 to 22, and have attained a senior high school diploma.",
      language_requirements_text: "Applicants whose native language is not English should submit an English proficiency certificate within two years, such as TOEFL 90 or above, IELTS 6 or above, proof of all courses taught in English issued by high school, or other English proficiency certificate.",
      application_process_text: "Register on Beihang International Student Online Application System, upload required application documents online, pay the application fee, and officially submit the application.",
      application_materials_text: "Passport information page; high school graduation certificate or expected graduation certificate; high school transcripts; language proficiency proof; Foreigner Physical Examination Form and blood examination report; financial guarantor letter and proof; birth certificate; parents' nationality documents at the time of birth; non-criminal record certificate; Integrity Commitment Letter; guardian guarantee letter if under 18 as of April 15, 2026; other supplementary materials.",
      continuation_condition_text: "Students must obey Beihang and China rules, take CSCA and obtain scores, pass all foundation course exams, maintain at least 95% attendance, and pass the interview and exam arranged by Beihang and Chinese Government.",
      scholarship_note: "Scholarship information follows the official Beihang Foundation+Bachelor Program 2026 page.",
      source_url: sourceUrlNow,
      source_files: [String(out?.filename || file?.name || "ybld.htm")],
      raw_line: `Foundation+Bachelor Program 2026 - ${x.program_name_en}`,
      raw_block: "Beihang University Foundation+Bachelor Program 2026",
      tags: ["BUAA", "Foundation+Bachelor", "预本连读", "pathway", "English"],
      parse_status: "complete",
    }));

    mergedCatalogFinal = rows;
    (parsed as any).program_catalog = mergedCatalogFinal;

    Object.assign(nextMeta2 as any, {
      parser: "buaa_foundation_bachelor_html_v1",
      doc_type: "buaa_foundation_bachelor_html",
      rows: rows.length,
      buaa_foundation_bachelor_parse_status: "complete",
      buaa_foundation_bachelor_rows: rows.length,
      buaa_foundation_bachelor_with_tuition: rows.filter((r: any) => r.tuition_rmb_per_year != null).length,
      buaa_foundation_bachelor_with_language: rows.filter((r: any) => Boolean(r.language_text)).length,
      buaa_foundation_bachelor_kind: "foundation_bachelor",
    });

    (parsed as any).program_catalog_meta = {
      ...((parsed as any).program_catalog_meta || {}),
      ...nextMeta2,
    };

    console.log("[BUAA_FOUNDATION_BACHELOR_HTML_PARSE]", {
      kind,
      rows: rows.length,
      first: rows[0] || null,
      last: rows[rows.length - 1] || null,
    });
  }
} catch (e) {
  console.error("[BUAA_FOUNDATION_BACHELOR_HTML_PARSE_ERR]", e);
}
// ===== BUAA_FOUNDATION_BACHELOR_HTML_PARSE_END =====


// ===== BUAA_CHINESE_LANGUAGE_FINAL_FORCE_START =====
try {
  const srcForBuaaChineseFinal = String(source_url || source_url_raw || (parsed as any)?.program_catalog_meta?.source_url || "");
  const rawForBuaaChineseFinal = String(raw_text || (parsed as any)?.raw || "");

  if (
    String(kind) === "chinese_language" &&
    /is\.buaa\.edu\.cn\/lxsq\/hyjxs\.htm/i.test(srcForBuaaChineseFinal) &&
    /汉语进修生|普通汉语课程|北航国际合作部汉语进修生2026年秋季招生简章/.test(rawForBuaaChineseFinal)
  ) {
    const rows = [
      {
        idx: 1,
        kind: "chinese_language",
        program_category: "chinese_language",
        faculty_cn: "国际合作部 / 国际中文教育办公室",
        faculty_en: "International Chinese Education Office",
        program_name_cn: "普通汉语课程",
        program_name_en: "General Chinese Language Program",
        degree_type: "非学历",
        degree_name_cn: "汉语进修生",
        degree_name_en: "Chinese Language Student",
        language_text: "中文",
        study_language: "zh",
        duration_text: "一学期或一学年",
        duration_years: null,
        tuition_rmb_per_semester: 9000,
        tuition_rmb_per_year: 17200,
        tuition_is_per_year: false,
        tuition_note: "普通汉语课程：9000元/学期，17200元/学年。",
        application_fee_rmb: 400,
        application_fee_note: "报名费400元。",
        accommodation_fee_note: "住宿费：30元/天。晚报名者自行解决住宿。",
        application_deadline: "2026-07-15",
        application_time_text: "秋季学期：2026年9月1日-2027年1月6日；一学年：2026年9月1日-2027年7月6日；申请截止日期：2026年7月15日。",
        application_portal_text: "https://admission.buaa.edu.cn/",
        apply_requirements_text: "年龄18-55周岁且对中国及汉语感兴趣者可报名。",
        application_process_text: "通过北航国际学生在线申请系统申请，汇款支付报名费，学校办理来华学习签证申请表，学生办理签证后入校学习。",
        application_materials_text: "请按北航国际学生在线申请系统要求提交申请材料。",
        source_url: srcForBuaaChineseFinal || "https://is.buaa.edu.cn/lxsq/hyjxs.htm",
        source_files: [srcForBuaaChineseFinal || "hyjxs.htm"],
        raw_block: "北航国际合作部汉语进修生2026年秋季招生简章",
        tags: ["汉语进修", "非学历", "中文课程"],
      },
    ];

    (parsed as any).program_catalog = rows;
    (parsed as any).program_catalog_meta = {
      ...((parsed as any).program_catalog_meta || {}),
      parser: "buaa_chinese_language_html_v1",
      doc_type: "buaa_chinese_language_html",
      kind: "chinese_language",
      education_level: "chinese_language",
      source_url: srcForBuaaChineseFinal || "https://is.buaa.edu.cn/lxsq/hyjxs.htm",
      buaa_chinese_language_parse_status: "complete",
      buaa_chinese_language_rows: rows.length,
      buaa_chinese_language_with_tuition: rows.filter((r: any) => r.tuition_rmb_per_year != null || r.tuition_rmb_per_semester != null).length,
      buaa_chinese_language_kind: "chinese_language",
    };

    console.log("[BUAA_CHINESE_LANGUAGE_FINAL_FORCE]", {
      rows: rows.length,
      parser: "buaa_chinese_language_html_v1",
      source_url: srcForBuaaChineseFinal || "https://is.buaa.edu.cn/lxsq/hyjxs.htm",
    });
  }
} catch (e) {
  console.error("[BUAA_CHINESE_LANGUAGE_FINAL_FORCE_ERR]", e);
}
// ===== BUAA_CHINESE_LANGUAGE_FINAL_FORCE_END =====


// ===== HIT_UG_XLS_CATALOG_PARSE_START =====
try {
  const hitFilename = String(out?.filename || source_url || source_url_raw || "").toLowerCase();
  const rawHitText = String(raw_text || (parsed as any)?.raw || "");

  if (
    kind === "ug" &&
    /hit_ug|哈工大本科|哈尔滨工业大学.*本科|hit.*ug/i.test(hitFilename + " " + rawHitText) &&
    /哈尔滨工业大学|Harbin Institute of Technology|CSCA|本科招生专业目录/.test(rawHitText)
  ) {
    const rows: any[] = [];
    const lines = rawHitText
      .split(/\r?\n/)
      .map((x) => String(x || "").replace(/\s+/g, " ").trim())
      .filter(Boolean);

    let currentFacultyCn = "";
    let currentFacultyEn = "";
    let currentSubjects = "";

    const knownFacultyEn: Record<string, string> = {
      "航天学院": "School of Astronautics",
      "电子与信息工程学院": "School of Electronics and Information Engineering",
      "电气工程及自动化学院": "School of Electrical Engineering and Automation",
      "数学学院": "School of Mathematics",
      "计算学部": "Faculty of Computing",
      "机电工程学院": "School of Mechatronics Engineering",
      "材料科学与工程学院": "School of Materials Science and Engineering",
      "能源科学与工程学院": "School of Energy Science and Engineering",
      "土木工程学院": "School of Civil Engineering",
      "交通科学与工程学院": "School of Transportation Science and Engineering",
      "化工与化学学院": "School of Chemistry and Chemical Engineering",
      "生命科学与技术学院": "School of Life Science and Technology",
      "建筑与设计学院": "School of Architecture and Design",
      "经济与管理学院": "School of Economics and Management",
      "人文社科与法学学院": "School of Humanities, Social Sciences and Law",
      "外国语学院": "School of Foreign Languages",
      "国际教育学院": "School of International Education",
      "环境学院": "School of Environment",
    };

    function cleanHit(x: any) {
      return String(x ?? "").replace(/\s+/g, " ").trim();
    }

    function splitHitCnEn(x: string): [string, string] {
      const s = cleanHit(x);
      if (!s) return ["", ""];
      const m = s.match(/^([\u4e00-\u9fff（）()、·\-&\s]+)\s+([A-Za-z].*)$/);
      if (m) return [cleanHit(m[1]), cleanHit(m[2])];
      return [s, ""];
    }

    function hitLang(s: string) {
      if (/英文|English/i.test(s)) return "英文";
      if (/中文|Chinese/i.test(s)) return "中文";
      return "";
    }

    // Fallback for tab/text extraction. Excel parser may already be better; this handles extracted raw text.
    for (const line of lines) {
      if (/^\d+\s+[\u4e00-\u9fff].*School of/i.test(line)) {
        const m = line.match(/^\d+\s+(.+?)\s+(School of .+?)(?:\s{1,}|$)/i);
        if (m) {
          currentFacultyCn = cleanHit(m[1]);
          currentFacultyEn = cleanHit(m[2]);
        }
      }

      for (const fac of Object.keys(knownFacultyEn)) {
        if (line.includes(fac)) {
          currentFacultyCn = fac;
          currentFacultyEn = knownFacultyEn[fac];
        }
      }

      if (/Chinese for STEM|Chinese for Humanities|Mathematics|Physics|Chemistry|CSCA/i.test(line) && /中文|Chinese|Mathematics|Physics|Chemistry/i.test(line)) {
        currentSubjects = line;
      }

      const lang = hitLang(line);
      if (!lang) continue;
      if (/序号|学院|专业|授课语言|Study Duration|CSCA|Major Lists|Harbin Institute/.test(line)) continue;

      const durationMatch = line.match(/\b(4(?:\.0)?)\b/);
      if (!durationMatch) continue;

      const beforeLang = line.split(/中文\s*Chinese|英文\s*English/i)[0].trim();
      const [programCn, programEn] = splitHitCnEn(beforeLang);
      if (!programCn || !programEn) continue;
      if (programCn.length > 80 || /学院|School of|序号|本科/.test(programCn)) continue;

      rows.push({
        idx: rows.length + 1,
        kind: "ug",
        degree_type: "本科",
        degree_name_cn: "本科",
        degree_name_en: "Bachelor",
        faculty_cn: currentFacultyCn || null,
        faculty_en: currentFacultyEn || null,
        program_name_cn: programCn,
        program_name_en: programEn,
        language_text: lang,
        study_language: lang === "英文" ? "en" : "zh",
        duration_years: 4,
        duration_text: "4 years",
        csca_subjects_text: currentSubjects || null,
        tuition_rmb_per_year: lang === "英文" ? 26000 : 20000,
        tuition_is_per_year: true,
        tuition_note: "HIT undergraduate tuition: Chinese-taught CNY 20,000/year; English-taught CNY 26,000/year.",
        language_requirements_text:
          lang === "英文"
            ? "English-taught undergraduate programs require TOEFL 78 or above, or IELTS 6.0 or above."
            : "Chinese-taught undergraduate programs require HSK Level 4 with a score of 210 or above.",
        source_file: out?.filename || "hit_ug.xls",
        raw_line: line,
        tags: ["HIT", "本科", "CSCA"],
      });
    }

    if (rows.length >= 50) {
      (parsed as any).program_catalog = rows;
      (parsed as any).program_catalog_meta = {
        ...((parsed as any).program_catalog_meta || {}),
        parser: "hit_ug_xls_catalog_v1",
        doc_type: "hit_ug_catalog_xls",
        kind: "ug",
        education_level: "ug",
        source_file: out?.filename || "hit_ug.xls",
        hit_ug_parse_status: "complete",
        hit_ug_rows: rows.length,
        hit_ug_with_tuition: rows.filter((r: any) => r.tuition_rmb_per_year != null).length,
        hit_ug_with_language: rows.filter((r: any) => Boolean(r.language_text)).length,
        hit_ug_language_requirements: {
          chinese_taught: "HSK Level 4 >= 210",
          english_taught: "TOEFL >= 78 or IELTS >= 6.0",
        },
      };

      console.log("[HIT_UG_XLS_CATALOG_PARSE]", {
        rows: rows.length,
        parser: "hit_ug_xls_catalog_v1",
        first: rows[0] || null,
      });
    } else {
      console.log("[HIT_UG_XLS_CATALOG_PARSE_SKIP]", {
        reason: "too_few_rows",
        rows: rows.length,
        filename: hitFilename,
      });
    }
  }
} catch (e) {
  console.error("[HIT_UG_XLS_CATALOG_PARSE_ERR]", e);
}
// ===== HIT_UG_XLS_CATALOG_PARSE_END =====

const mergedParsed =
  kind === "ug"
    ? {
        ...parsed,
        program_catalog: mergedCatalogFinal,
        program_catalog_meta: {
          ...nextMeta2,
          ...((parsed as any)?.program_catalog_meta || {}),
          tuition_source_url: mergedTuitionUrl,
          tuition_policy:
            isCatalogUpload && uploadHasCatalogRows
              ? (nextMeta2?.tuition_policy || null)
              : (
                  nextMeta2?.tuition_policy ||
                  prevMeta2?.tuition_policy ||
                  tuitionPolicy ||
                  genericTuitionPolicy ||
                  null
                ),
          apply_guide:
            nextMeta2?.apply_guide ||
            prevMeta2?.apply_guide ||
            applyGuidePolicy ||
            null,
          admission_requirements:
            nextMeta2?.admission_requirements ||
            prevMeta2?.admission_requirements ||
            applyGuidePolicy?.admission_requirements ||
            null,
          application_materials:
            nextMeta2?.application_materials ||
            prevMeta2?.application_materials ||
            applyGuidePolicy?.application_materials ||
            null,
          application_periods:
            nextMeta2?.application_periods ||
            prevMeta2?.application_periods ||
            applyGuidePolicy?.application_periods ||
            null,
          ug_sanitize_debug: ugSanitizeDebug,
          table_header: finalTableHeader,
          scholarship_policy:
            nextMeta2?.scholarship_policy ||
            prevMeta2?.scholarship_policy ||
            scholarshipPolicy ||
            null,
          apply_guide_policy:
            nextMeta2?.apply_guide_policy ||
            prevMeta2?.apply_guide_policy ||
            applyGuidePolicy ||
            null,
        },
      }
    : {
        ...prevParsed,
        ...parsed,
        program_catalog: mergedCatalogFinal,
        program_catalog_meta: {
          ...prevMeta2,
          ...nextMeta2,
          tuition_source_url: mergedTuitionUrl,
          tuition_policy:
            isCatalogUpload && uploadHasCatalogRows
              ? (nextMeta2?.tuition_policy || null)
              : (
                  nextMeta2?.tuition_policy ||
                  prevMeta2?.tuition_policy ||
                  tuitionPolicy ||
                  genericTuitionPolicy ||
                  null
                ),
          ug_sanitize_debug: ugSanitizeDebug,
          table_header: finalTableHeader,
          scholarship_policy:
            nextMeta2?.scholarship_policy ||
            prevMeta2?.scholarship_policy ||
            scholarshipPolicy ||
            null,
          apply_guide_policy:
            nextMeta2?.apply_guide_policy ||
            prevMeta2?.apply_guide_policy ||
            applyGuidePolicy ||
            null,
          apply_guide:
            nextMeta2?.apply_guide ||
            prevMeta2?.apply_guide ||
            applyGuideParsed ||
            null,
        },
      };


    // ===== BUAA_CHINESE_LANGUAGE_BEFORE_UPSERT_FORCE_START =====
    try {
      const srcForBuaaChineseUpsert = String(source_url || source_url_raw || mergedParsed?.program_catalog_meta?.source_url || "");
      const rawForBuaaChineseUpsert = String(raw_text || mergedParsed?.raw || "");

      if (
        String(kind) === "chinese_language" &&
        /hyjxs\.htm/i.test(srcForBuaaChineseUpsert) &&
        /汉语进修生|普通汉语课程|北航国际合作部汉语进修生2026年秋季招生简章/.test(rawForBuaaChineseUpsert)
      ) {
        const rows = [
          {
            idx: 1,
            kind: "chinese_language",
            program_category: "chinese_language",
            faculty_cn: "国际合作部 / 国际中文教育办公室",
            faculty_en: "International Chinese Education Office",
            program_name_cn: "普通汉语课程",
            program_name_en: "General Chinese Language Program",
            degree_type: "非学历",
            degree_name_cn: "汉语进修生",
            degree_name_en: "Chinese Language Student",
            language_text: "中文",
            study_language: "zh",
            duration_text: "一学期或一学年",
            duration_years: null,
            tuition_rmb_per_semester: 9000,
            tuition_rmb_per_year: 17200,
            tuition_is_per_year: false,
            tuition_note: "普通汉语课程：9000元/学期，17200元/学年。",
            application_fee_rmb: 400,
            application_deadline: "2026-07-15",
            application_time_text: "秋季学期：2026年9月1日-2027年1月6日；一学年：2026年9月1日-2027年7月6日；申请截止日期：2026年7月15日。",
            application_portal_text: "https://admission.buaa.edu.cn/",
            apply_requirements_text: "年龄18-55周岁且对中国及汉语感兴趣者可报名。",
            source_url: srcForBuaaChineseUpsert || "https://is.buaa.edu.cn/lxsq/hyjxs.htm",
            source_files: [srcForBuaaChineseUpsert || "hyjxs.htm"],
            raw_block: "北航国际合作部汉语进修生2026年秋季招生简章",
            tags: ["汉语进修", "非学历", "中文课程"],
          },
        ];

        mergedParsed.program_catalog = rows;
        mergedParsed.program_catalog_meta = {
          ...(mergedParsed.program_catalog_meta || {}),
          parser: "buaa_chinese_language_html_v1",
          doc_type: "buaa_chinese_language_html",
          kind: "chinese_language",
          education_level: "chinese_language",
          source_url: srcForBuaaChineseUpsert || "https://is.buaa.edu.cn/lxsq/hyjxs.htm",
          buaa_chinese_language_parse_status: "complete",
          buaa_chinese_language_rows: rows.length,
          buaa_chinese_language_with_tuition: rows.length,
          buaa_chinese_language_kind: "chinese_language",
        };

        (parsed as any).program_catalog = rows;
        (parsed as any).program_catalog_meta = mergedParsed.program_catalog_meta;

        console.log("[BUAA_CHINESE_LANGUAGE_BEFORE_UPSERT_FORCE]", {
          rows: rows.length,
          parser: "buaa_chinese_language_html_v1",
          source_url: srcForBuaaChineseUpsert || "https://is.buaa.edu.cn/lxsq/hyjxs.htm",
        });
      }
    } catch (e) {
      console.error("[BUAA_CHINESE_LANGUAGE_BEFORE_UPSERT_FORCE_ERR]", e);
    }
    // ===== BUAA_CHINESE_LANGUAGE_BEFORE_UPSERT_FORCE_END =====


    // ===== HIT_UG_BEFORE_UPSERT_FORCE_START =====
    try {
      const hitSchoolId = "4028868472e9601a0173ebe95e1e0221";
      const hitFilenameForForce = String(out?.filename || source_url || source_url_raw || "").toLowerCase();

      if (
        String(school_id) === hitSchoolId &&
        kind === "ug" &&
        /hit_ug|哈工大本科|哈尔滨工业大学.*本科/i.test(hitFilenameForForce)
      ) {
        const fs = await import("node:fs/promises");
        const path = await import("node:path");
        const hitJsonPath = path.join(process.cwd(), "tmp_ingest", "hit_ug_catalog.json");
        const hitJsonRaw = await fs.readFile(hitJsonPath, "utf8");
        const hitJson = JSON.parse(hitJsonRaw);

        const rows = Array.isArray(hitJson?.program_catalog) ? hitJson.program_catalog : [];
        const meta = hitJson?.program_catalog_meta || {};

        if (rows.length >= 90) {
          mergedParsed.program_catalog = rows;
          mergedParsed.program_catalog_meta = {
            ...(mergedParsed.program_catalog_meta || {}),
            ...meta,
            parser: "hit_ug_xls_catalog_v1",
            doc_type: "hit_ug_catalog_xls",
            kind: "ug",
            education_level: "ug",
            source_file: out?.filename || "hit_ug.xls",
            hit_ug_parse_status: "complete",
            hit_ug_rows: rows.length,
            hit_ug_with_tuition: rows.filter((r: any) => r?.tuition_rmb_per_year != null).length,
            hit_ug_with_language: rows.filter((r: any) => Boolean(r?.language_text)).length,
          };

          (parsed as any).program_catalog = rows;
          (parsed as any).program_catalog_meta = mergedParsed.program_catalog_meta;

          console.log("[HIT_UG_BEFORE_UPSERT_FORCE]", {
            rows: rows.length,
            parser: mergedParsed.program_catalog_meta.parser,
            first: rows[0] || null,
          });
        } else {
          console.log("[HIT_UG_BEFORE_UPSERT_FORCE_SKIP]", {
            reason: "too_few_rows",
            rows: rows.length,
            path: hitJsonPath,
          });
        }
      }
    } catch (e) {
      console.error("[HIT_UG_BEFORE_UPSERT_FORCE_ERR]", e);
    }
    // ===== HIT_UG_BEFORE_UPSERT_FORCE_END =====


    // ===== CATALOG_ROWS_PRESERVE_BEFORE_UPSERT_START =====
    try {
      const purposeForCatalogPreserve = String(linkPurpose || "").trim().toLowerCase();
      const isMainCatalogPurpose =
        purposeForCatalogPreserve === "catalog" ||
        purposeForCatalogPreserve === "detail" ||
        purposeForCatalogPreserve === "catalog_detail" ||
        purposeForCatalogPreserve === "program_catalog";

      const prevRowsForCatalogPreserve = Array.isArray(prevParsed?.program_catalog)
        ? prevParsed.program_catalog
        : [];

      const nextRowsForCatalogPreserve = Array.isArray(mergedParsed?.program_catalog)
        ? mergedParsed.program_catalog
        : [];

      if (
        prevRowsForCatalogPreserve.length > 0 &&
        !isMainCatalogPurpose &&
        (nextRowsForCatalogPreserve.length === 0 || nextRowsForCatalogPreserve.length < prevRowsForCatalogPreserve.length)
      ) {
        mergedParsed.program_catalog = prevRowsForCatalogPreserve;
        mergedParsed.program_catalog_meta = {
          ...(prevParsed?.program_catalog_meta || {}),
          ...(mergedParsed?.program_catalog_meta || {}),
          preserved_program_catalog_from_previous: true,
          preserved_program_catalog_reason: "non_catalog_upload_should_not_replace_rows",
          preserved_program_catalog_rows: prevRowsForCatalogPreserve.length,
          current_upload_rows_before_preserve: nextRowsForCatalogPreserve.length,
          current_link_purpose: purposeForCatalogPreserve || null,
        };

        console.log("[CATALOG_ROWS_PRESERVE_BEFORE_UPSERT]", {
          kind,
          linkPurpose: purposeForCatalogPreserve,
          preservedRows: prevRowsForCatalogPreserve.length,
          incomingRows: nextRowsForCatalogPreserve.length,
          parser: mergedParsed?.program_catalog_meta?.parser || null,
        });
      }
    } catch (e) {
      console.error("[CATALOG_ROWS_PRESERVE_BEFORE_UPSERT_ERR]", e);
    }
    // ===== CATALOG_ROWS_PRESERVE_BEFORE_UPSERT_END =====


    // ===== HIT_UG_GUIDE_META_BEFORE_UPSERT_START =====
    try {
      const hitSchoolIdForGuide = "4028868472e9601a0173ebe95e1e0221";
      const srcForHitUgGuide = String(source_url || source_url_raw || mergedParsed?.program_catalog_meta?.source_url || "");
      const rawForHitUgGuide = String(raw_text || mergedParsed?.raw || "");

      if (
        String(school_id) === hitSchoolIdForGuide &&
        kind === "ug" &&
        /18244\/list\.htm/i.test(srcForHitUgGuide) &&
        /本科生项目|哈尔滨工业大学|申请费|收费标准|外国人体格检查记录|StudyatHIT@hit\.edu\.cn/i.test(rawForHitUgGuide)
      ) {
        const prevRowsForHitGuide = Array.isArray(prevParsed?.program_catalog)
          ? prevParsed.program_catalog
          : [];

        const currentRowsForHitGuide = Array.isArray(mergedParsed?.program_catalog)
          ? mergedParsed.program_catalog
          : [];

        const keepRowsForHitGuide =
          prevRowsForHitGuide.length >= currentRowsForHitGuide.length
            ? prevRowsForHitGuide
            : currentRowsForHitGuide;

        if (keepRowsForHitGuide.length > 0) {
          mergedParsed.program_catalog = keepRowsForHitGuide;
        }

        mergedParsed.program_catalog_meta = {
          ...(prevParsed?.program_catalog_meta || {}),
          ...(mergedParsed?.program_catalog_meta || {}),

          parser:
            String((prevParsed?.program_catalog_meta || {})?.parser || "") ||
            String((mergedParsed?.program_catalog_meta || {})?.parser || "") ||
            "hit_ug_xls_catalog_v1",
          doc_type:
            String((prevParsed?.program_catalog_meta || {})?.doc_type || "") ||
            String((mergedParsed?.program_catalog_meta || {})?.doc_type || "") ||
            "hit_ug_catalog_xls",

          kind: "ug",
          education_level: "ug",
          source_url: srcForHitUgGuide || "https://cie.hit.edu.cn/18244/list.htm",

          hit_ug_guide_source_url: srcForHitUgGuide || "https://cie.hit.edu.cn/18244/list.htm",
          hit_ug_guide_parse_status: "complete",

          application_fee_rmb: 400,
          scholarship_application_fee_rmb: 600,
          insurance_fee_rmb_per_year: 800,
          accommodation_fee_note: "住宿费：800-1,000 元/月/床，不包含电费、水费、网费。",
          medical_exam_required: true,
          medical_exam_note: "申请材料包含《外国人体格检查记录》，有效期为6个月；体检表是申请材料，不是体检费。",
          financial_guarantee_note: "存款证明：至少20,000元人民币或等值外币的财务担保证明。",
          application_deadline: "2026-07-15",
          application_time_text: "自费生：全年开放申请，2026年9月入学申请截止时间为2026年7月15日；哈尔滨工业大学国际学生奖学金：2025年10月1日-2026年7月15日。",
          tuition_policy: {
            currency: "CNY",
            ug_chinese_taught_rmb_per_year: 20000,
            ug_english_taught_rmb_per_year: 26000,
            note: "本科生项目学费：汉语授课20,000元/学年，英语授课26,000元/学年。",
          },
          language_requirements_text: "汉语授课专业要求新HSK四级210分及以上且有效期两年内；英语授课专业要求雅思学术考试6.0以上且各项不低于5.5，或托福80分以上，或学校认可的同等英语水平证明。",
          application_materials_text: "申请材料包括护照、高中毕业证书或预计毕业证明、高中成绩单、CSCA成绩单、语言能力证书、《外国人体格检查记录》、无犯罪记录证明、未成年人监护公证（如适用）、个人简历、报名费汇款凭证、存款证明以及其他补充材料。",
          apply_requirements_text: "申请人须身心健康、非中国籍、具有高中及以上学历，年龄不超过30周岁；申请哈尔滨工业大学国际学生奖学金者年龄不超过25周岁。",
          contact_phone: "+86-451-86418461",
          contact_email: "StudyatHIT@hit.edu.cn",

          preserved_program_catalog_from_previous: keepRowsForHitGuide.length > 0,
          preserved_program_catalog_reason: "hit_ug_guide_meta_only_should_not_replace_catalog_rows",
          preserved_program_catalog_rows: keepRowsForHitGuide.length,
        };

        (parsed as any).program_catalog = mergedParsed.program_catalog;
        (parsed as any).program_catalog_meta = mergedParsed.program_catalog_meta;

        console.log("[HIT_UG_GUIDE_META_BEFORE_UPSERT]", {
          rows: Array.isArray(mergedParsed.program_catalog) ? mergedParsed.program_catalog.length : -1,
          parser: mergedParsed.program_catalog_meta?.parser || null,
          application_fee_rmb: mergedParsed.program_catalog_meta?.application_fee_rmb || null,
          insurance_fee_rmb_per_year: mergedParsed.program_catalog_meta?.insurance_fee_rmb_per_year || null,
          source_url: srcForHitUgGuide || null,
        });
      }
    } catch (e) {
      console.error("[HIT_UG_GUIDE_META_BEFORE_UPSERT_ERR]", e);
    }
    // ===== HIT_UG_GUIDE_META_BEFORE_UPSERT_END =====


    // ===== HIT_PHD_GUIDE_META_BEFORE_UPSERT_START =====
    try {
      const hitSchoolIdForPhdGuide = "4028868472e9601a0173ebe95e1e0221";
      const srcForHitPhdGuide = String(source_url || source_url_raw || mergedParsed?.program_catalog_meta?.source_url || "");
      const rawForHitPhdGuide = String(raw_text || mergedParsed?.raw || "");

      if (
        String(school_id) === hitSchoolIdForPhdGuide &&
        kind === "phd" &&
        /18283\/list\.htm/i.test(srcForHitPhdGuide) &&
        /博士研究生项目|学费|保险费|CSC 奖学金申请费|StudyatHIT@hit\.edu\.cn/i.test(rawForHitPhdGuide)
      ) {
        const prevRowsForHitPhdGuide = Array.isArray(prevParsed?.program_catalog)
          ? prevParsed.program_catalog
          : [];

        const currentRowsForHitPhdGuide = Array.isArray(mergedParsed?.program_catalog)
          ? mergedParsed.program_catalog
          : [];

        const keepRowsForHitPhdGuide =
          prevRowsForHitPhdGuide.length >= currentRowsForHitPhdGuide.length
            ? prevRowsForHitPhdGuide
            : currentRowsForHitPhdGuide;

        if (keepRowsForHitPhdGuide.length > 0) {
          mergedParsed.program_catalog = keepRowsForHitPhdGuide;
        }

        mergedParsed.program_catalog_meta = {
          ...(prevParsed?.program_catalog_meta || {}),
          ...(mergedParsed?.program_catalog_meta || {}),

          kind: "phd",
          education_level: "phd",
          source_url: srcForHitPhdGuide || "https://cie.hit.edu.cn/18283/list.htm",

          hit_phd_guide_source_url: srcForHitPhdGuide || "https://cie.hit.edu.cn/18283/list.htm",
          hit_phd_guide_parse_status: "complete",

          duration_years: 4,
          duration_text: "4 years",

          application_fee_rmb: 400,
          csc_application_fee_rmb: 400,
          scholarship_application_fee_rmb: 600,
          insurance_fee_rmb_per_year: 800,
          accommodation_fee_note: "住宿费：800-1000 元/月/床，不包含电费、水费、网费。",
          medical_exam_required: true,
          medical_exam_note: "申请材料包含《外国人体格检查记录》，有效期为6个月；体检表是申请材料，不是体检费。",
          financial_guarantee_note: "存款证明：至少30,000元人民币或等值外币的财务担保证明。",
          application_deadline: "2026-05-31",
          application_time_text: "全年开放申请，2026年9月入学截止申请时间为2026年5月31日。",
          tuition_policy: {
            currency: "CNY",
            phd_chinese_taught_rmb_per_year: 36000,
            phd_english_taught_rmb_per_year: 42000,
            note: "博士研究生项目学费：汉语授课36,000元/学年，英语授课42,000元/学年。",
          },
          language_requirements_text: "汉语授课专业要求新HSK四级210分及以上且有效期两年内；英语授课专业要求雅思学术考试6.0以上且各项不低于5.5，或托福80分以上，或学校认可的同等英语水平证明。",
          application_materials_text: "申请材料包括护照、硕士毕业证书或预计毕业证明、自本科阶段起全部课程及成绩单、语言能力证书、学习计划不少于1500字、两封副教授或相应职称以上专家推荐信、《外国人体格检查记录》、无犯罪记录证明、自费生报名费汇款凭证、存款证明、导师同意接收函（非必须）以及其他补充材料。",
          apply_requirements_text: "申请人须身心健康、非中国籍、具有硕士及以上学历，年龄不超过40周岁；申请HIT奖学金者年龄不超过35周岁。",
          scholarship_note: "博士奖学金包括中国政府奖学金A类/B类及HIT奖学金；HIT奖学金特等奖免全额学费，一等奖减免50%学费，二等奖减免30%学费，三等奖减免20%学费。",
          contact_phone: "+86-451-86418461",
          contact_email: "StudyatHIT@hit.edu.cn",

          preserved_program_catalog_from_previous: keepRowsForHitPhdGuide.length > 0,
          preserved_program_catalog_reason: "hit_phd_guide_meta_only_should_not_replace_catalog_rows",
          preserved_program_catalog_rows: keepRowsForHitPhdGuide.length,
        };

        // 如果已经有博士专业行，同时给行级补费用；没有 rows 也只补 meta
        if (Array.isArray(mergedParsed.program_catalog) && mergedParsed.program_catalog.length > 0) {
          mergedParsed.program_catalog = mergedParsed.program_catalog.map((r: any) => {
            const lang = String(r?.language_text || "").trim();
            const tuition =
              lang === "英文" ? 42000 :
              lang === "中文" ? 36000 :
              r?.tuition_rmb_per_year ?? null;

            return {
              ...r,
              kind: r?.kind || "phd",
              degree_type: r?.degree_type || "博士",
              degree_name_cn: r?.degree_name_cn || "博士",
              degree_name_en: r?.degree_name_en || "Doctoral",
              duration_years: r?.duration_years ?? 4,
              duration_text: r?.duration_text || "4 years",
              tuition_rmb_per_year: tuition,
              tuition_is_per_year: true,
              application_fee_rmb: r?.application_fee_rmb ?? 400,
              insurance_fee_rmb_per_year: r?.insurance_fee_rmb_per_year ?? 800,
            };
          });
        }

        (parsed as any).program_catalog = mergedParsed.program_catalog;
        (parsed as any).program_catalog_meta = mergedParsed.program_catalog_meta;

        console.log("[HIT_PHD_GUIDE_META_BEFORE_UPSERT]", {
          rows: Array.isArray(mergedParsed.program_catalog) ? mergedParsed.program_catalog.length : -1,
          application_fee_rmb: mergedParsed.program_catalog_meta?.application_fee_rmb || null,
          csc_application_fee_rmb: mergedParsed.program_catalog_meta?.csc_application_fee_rmb || null,
          scholarship_application_fee_rmb: mergedParsed.program_catalog_meta?.scholarship_application_fee_rmb || null,
          tuition_policy: mergedParsed.program_catalog_meta?.tuition_policy || null,
          source_url: srcForHitPhdGuide || null,
        });
      }
    } catch (e) {
      console.error("[HIT_PHD_GUIDE_META_BEFORE_UPSERT_ERR]", e);
    }
    // ===== HIT_PHD_GUIDE_META_BEFORE_UPSERT_END =====


    // ===== HIT_PHD_LANGUAGE_EXPAND_BEFORE_UPSERT_START =====
    try {
      const hitSchoolIdForPhdExpand = "4028868472e9601a0173ebe95e1e0221";
      const metaForPhdExpand = mergedParsed?.program_catalog_meta || {};
      const rowsForPhdExpand = Array.isArray(mergedParsed?.program_catalog)
        ? mergedParsed.program_catalog
        : [];

      const isHitPhdGuideOrCatalog =
        String(school_id) === hitSchoolIdForPhdExpand &&
        kind === "phd" &&
        (
          metaForPhdExpand?.hit_phd_guide_parse_status === "complete" ||
          /18283\/list\.htm/i.test(String(source_url || source_url_raw || metaForPhdExpand?.source_url || ""))
        );

      const missingLangCount = rowsForPhdExpand.filter((r: any) => !String(r?.language_text || "").trim()).length;

      if (isHitPhdGuideOrCatalog && rowsForPhdExpand.length > 0 && missingLangCount > 0) {
        const expandedRows: any[] = [];

        for (const row of rowsForPhdExpand) {
          const base = {
            ...row,
            kind: row?.kind || "phd",
            degree_type: row?.degree_type || "博士",
            degree_name_cn: row?.degree_name_cn || "博士",
            degree_name_en: row?.degree_name_en || "Doctoral",
            duration_years: row?.duration_years ?? 4,
            duration_text: row?.duration_text || "4 years",
            tuition_is_per_year: true,
            application_fee_rmb: row?.application_fee_rmb ?? 400,
            insurance_fee_rmb_per_year: row?.insurance_fee_rmb_per_year ?? 800,
          };

          const existingLang = String(row?.language_text || "").trim();

          if (existingLang === "中文") {
            expandedRows.push({
              ...base,
              language_text: "中文",
              study_language: "zh",
              tuition_rmb_per_year: 36000,
              tuition_note: "博士研究生项目学费：汉语授课36,000元/学年。",
            });
          } else if (existingLang === "英文") {
            expandedRows.push({
              ...base,
              language_text: "英文",
              study_language: "en",
              tuition_rmb_per_year: 42000,
              tuition_note: "博士研究生项目学费：英语授课42,000元/学年。",
            });
          } else {
            expandedRows.push({
              ...base,
              language_text: "中文",
              study_language: "zh",
              tuition_rmb_per_year: 36000,
              tuition_note: "博士研究生项目学费：汉语授课36,000元/学年。",
              raw_language_note: "官方博士页面说明博士研究生招生专业均可汉语或英语授课。",
            });
            expandedRows.push({
              ...base,
              language_text: "英文",
              study_language: "en",
              tuition_rmb_per_year: 42000,
              tuition_note: "博士研究生项目学费：英语授课42,000元/学年。",
              raw_language_note: "官方博士页面说明博士研究生招生专业均可汉语或英语授课。",
            });
          }
        }

        mergedParsed.program_catalog = expandedRows.map((r: any, i: number) => ({
          ...r,
          idx: i + 1,
        }));

        mergedParsed.program_catalog_meta = {
          ...(mergedParsed.program_catalog_meta || {}),
          hit_phd_language_expand_status: "complete",
          hit_phd_language_expand_source: "official guide says all doctoral majors can be taught in Chinese or English",
          hit_phd_language_expand_before_rows: rowsForPhdExpand.length,
          hit_phd_language_expand_after_rows: mergedParsed.program_catalog.length,
          hit_phd_with_tuition: mergedParsed.program_catalog.filter((r: any) => r?.tuition_rmb_per_year != null).length,
          hit_phd_with_language: mergedParsed.program_catalog.filter((r: any) => Boolean(r?.language_text)).length,
        };

        (parsed as any).program_catalog = mergedParsed.program_catalog;
        (parsed as any).program_catalog_meta = mergedParsed.program_catalog_meta;

        console.log("[HIT_PHD_LANGUAGE_EXPAND_BEFORE_UPSERT]", {
          beforeRows: rowsForPhdExpand.length,
          afterRows: mergedParsed.program_catalog.length,
          withTuition: mergedParsed.program_catalog_meta?.hit_phd_with_tuition,
          withLanguage: mergedParsed.program_catalog_meta?.hit_phd_with_language,
        });
      }
    } catch (e) {
      console.error("[HIT_PHD_LANGUAGE_EXPAND_BEFORE_UPSERT_ERR]", e);
    }
    // ===== HIT_PHD_LANGUAGE_EXPAND_BEFORE_UPSERT_END =====


    // ===== HIT_FINAL_ROW_FEES_BEFORE_UPSERT_START =====
    try {
      const hitSchoolIdForFinalFees = "4028868472e9601a0173ebe95e1e0221";
      const rowsForHitFinalFees = Array.isArray(mergedParsed?.program_catalog)
        ? mergedParsed.program_catalog
        : [];
      const metaForHitFinalFees = mergedParsed?.program_catalog_meta || {};

      if (
        String(school_id) === hitSchoolIdForFinalFees &&
        (kind === "phd" || kind === "master" || kind === "ug") &&
        rowsForHitFinalFees.length > 0
      ) {
        const level = String(kind || "").trim();

        const phdCnFee = Number(metaForHitFinalFees?.tuition_policy?.phd_chinese_taught_rmb_per_year || 36000);
        const phdEnFee = Number(metaForHitFinalFees?.tuition_policy?.phd_english_taught_rmb_per_year || 42000);

        const masterCnFee = Number(metaForHitFinalFees?.tuition_policy?.master_chinese_taught_rmb_per_year || 28000);
        const masterEnFee = Number(metaForHitFinalFees?.tuition_policy?.master_english_taught_rmb_per_year || 34000);

        const ugCnFee = Number(metaForHitFinalFees?.tuition_policy?.ug_chinese_taught_rmb_per_year || 20000);
        const ugEnFee = Number(metaForHitFinalFees?.tuition_policy?.ug_english_taught_rmb_per_year || 26000);

        const scholarshipNote =
          String(metaForHitFinalFees?.scholarship_note || "").trim() ||
          (
            level === "phd"
              ? "奖学金包括中国政府奖学金A类/B类及HIT奖学金；HIT奖学金特等奖免全额学费，一等奖减免50%学费，二等奖减免30%学费，三等奖减免20%学费。"
              : level === "master"
                ? "奖学金包括中国政府奖学金A类/B类及HIT奖学金；HIT奖学金具体等级和减免比例以官方当年简章为准。"
                : "奖学金包括哈尔滨工业大学国际学生奖学金等，具体以官方当年简章为准。"
          );

        mergedParsed.program_catalog = rowsForHitFinalFees.map((row: any) => {
          const lang = String(row?.language_text || "").trim();
          let fee = row?.tuition_rmb_per_year;

          if (level === "phd") {
            if (lang === "中文") fee = phdCnFee;
            if (lang === "英文") fee = phdEnFee;
          } else if (level === "master") {
            if (lang === "中文") fee = masterCnFee;
            if (lang === "英文") fee = masterEnFee;
          } else if (level === "ug") {
            if (lang === "中文") fee = ugCnFee;
            if (lang === "英文") fee = ugEnFee;
          }

          const years = Number(row?.duration_years || metaForHitFinalFees?.duration_years || (level === "phd" ? 4 : 0));
          const numericFee = fee != null && Number.isFinite(Number(fee)) ? Number(fee) : null;

          return {
            ...row,
            tuition_rmb_per_year: numericFee,
            tuition_is_per_year: numericFee != null ? true : row?.tuition_is_per_year ?? null,
            tuition_total_rmb:
              numericFee != null && years > 0
                ? numericFee * years
                : row?.tuition_total_rmb ?? null,
            tuition_note:
              String(row?.tuition_note || "").trim() ||
              (
                level === "phd"
                  ? "博士研究生项目学费：汉语授课36,000元/学年，英语授课42,000元/学年。"
                  : String(metaForHitFinalFees?.tuition_policy?.note || "").trim()
              ),
            application_fee_rmb: row?.application_fee_rmb ?? metaForHitFinalFees?.application_fee_rmb ?? 400,
            insurance_fee_rmb_per_year: row?.insurance_fee_rmb_per_year ?? metaForHitFinalFees?.insurance_fee_rmb_per_year ?? 800,
            scholarship_note: String(row?.scholarship_note || "").trim() || scholarshipNote,
            scholarship_coverage_text:
              String(row?.scholarship_coverage_text || "").trim() ||
              (
                level === "phd"
                  ? "中国政府奖学金可覆盖学费、住宿费、生活费、保险费；HIT奖学金特等奖免全额学费，一等奖减免50%学费，二等奖减免30%学费，三等奖减免20%学费。"
                  : row?.scholarship_coverage_text || null
              ),
          };
        });

        mergedParsed.program_catalog_meta = {
          ...(mergedParsed.program_catalog_meta || {}),
          hit_final_row_fees_status: "complete",
          hit_final_row_fees_level: level,
          hit_final_row_fees_rows: mergedParsed.program_catalog.length,
          hit_final_row_fees_with_tuition: mergedParsed.program_catalog.filter((r: any) => r?.tuition_rmb_per_year != null).length,
          hit_final_row_fees_with_total_tuition: mergedParsed.program_catalog.filter((r: any) => r?.tuition_total_rmb != null).length,
          hit_final_row_fees_with_scholarship: mergedParsed.program_catalog.filter((r: any) => Boolean(r?.scholarship_note)).length,
        };

        (parsed as any).program_catalog = mergedParsed.program_catalog;
        (parsed as any).program_catalog_meta = mergedParsed.program_catalog_meta;

        console.log("[HIT_FINAL_ROW_FEES_BEFORE_UPSERT]", {
          level,
          rows: mergedParsed.program_catalog.length,
          withTuition: mergedParsed.program_catalog_meta?.hit_final_row_fees_with_tuition,
          withTotalTuition: mergedParsed.program_catalog_meta?.hit_final_row_fees_with_total_tuition,
          withScholarship: mergedParsed.program_catalog_meta?.hit_final_row_fees_with_scholarship,
        });
      }
    } catch (e) {
      console.error("[HIT_FINAL_ROW_FEES_BEFORE_UPSERT_ERR]", e);
    }
    // ===== HIT_FINAL_ROW_FEES_BEFORE_UPSERT_END =====



    // FINAL TUITION BACKFILL：入库前最后一次按费用说明/学科门类回填学费
    try {
      if (
        mergedParsed &&
        Array.isArray((mergedParsed as any).program_catalog) &&
        (mergedParsed as any).program_catalog.length > 0
      ) {
        const finalTuitionText = [
          raw_text,
          ...((mergedParsed as any).program_catalog || [])
            .slice(0, 800)
            .map((r: any) =>
              r?.tuition_note ||
              r?.tuition_policy_text ||
              r?.tuition_text ||
              r?.fee_text ||
              "",
            )
            .filter(Boolean),
        ].join("\n");

        (mergedParsed as any).program_catalog = applyTuitionFromNoteByDiscipline(
          (mergedParsed as any).program_catalog,
          {
            ...(((mergedParsed as any).program_catalog_meta) || {}),
            tuition_source_url:
              mergedTuitionUrl ||
              ((mergedParsed as any).program_catalog_meta || {})?.tuition_source_url ||
              null,
          },
          finalTuitionText,
        );

        (mergedParsed as any).program_catalog = applySysuFeeTableTuitionByDiscipline(
          (mergedParsed as any).program_catalog,
        );

        if (process.env.DEBUG_INGEST === "1") console.log("[FINAL_TUITION_BACKFILL]", {
          rows: Array.isArray((mergedParsed as any).program_catalog)
            ? (mergedParsed as any).program_catalog.length
            : -1,
          filled: Array.isArray((mergedParsed as any).program_catalog)
            ? (mergedParsed as any).program_catalog.filter(
                (r: any) => r?.tuition_rmb_per_year != null,
              ).length
            : -1,
          sample: Array.isArray((mergedParsed as any).program_catalog)
            ? (mergedParsed as any).program_catalog.slice(0, 3).map((r: any) => ({
                discipline_category_text: r?.discipline_category_text,
                tuition_rmb_per_year: r?.tuition_rmb_per_year,
                tuition_note: r?.tuition_note,
              }))
            : [],
        });
      }
    } catch (e) {
      console.error("[FINAL_TUITION_BACKFILL] failed:", e);
    }

    
// ===== GENERIC_ADMISSION_BROCHURE_FORCE_UPSERT_START =====
try {
  const brochureParserForUpsert = String(
    (parsed as any)?.program_catalog_meta?.parser ||
    (program_catalog_meta as any)?.parser ||
    ""
  );

  const shouldForceBrochureUpsert =
    String(kind) === "ug" &&
    brochureParserForUpsert.startsWith("generic_admission_brochure_undergrad_pdf") &&
    Array.isArray(nextCatalog) &&
    nextCatalog.length > 0;

  if (shouldForceBrochureUpsert) {
    const forcedRows = nextCatalog.map((r: any, i: number) => ({
      ...(r || {}),
      idx: i + 1,
    }));

    if (typeof mergedCatalog !== "undefined") {
      mergedCatalog = forcedRows;
    }

    if (typeof mergedCatalogFinal !== "undefined") {
      mergedCatalogFinal = forcedRows;
    }

    (parsed as any).program_catalog = forcedRows;
    (parsed as any).program_catalog_meta = {
      ...((parsed as any).program_catalog_meta || {}),
      parser: brochureParserForUpsert,
      doc_type: "generic_admission_brochure_undergrad_pdf",
      profile:
        (parsed as any)?.program_catalog_meta?.profile ||
        "program_list_section_fallback",
      source: "generic_admission_brochure_undergrad_pdf",
      forced_upsert_from_next_catalog: true,
      rows: forcedRows.length,
    };

    if (typeof mergedParsed !== "undefined" && mergedParsed) {
      (mergedParsed as any).program_catalog = forcedRows;
      (mergedParsed as any).program_catalog_meta = {
        ...((mergedParsed as any).program_catalog_meta || {}),
        ...(parsed as any).program_catalog_meta,
        forced_upsert_from_next_catalog: true,
        rows: forcedRows.length,
      };
    }

    console.log("[GENERIC_ADMISSION_BROCHURE_FORCE_UPSERT]", {
      kind,
      parser: brochureParserForUpsert,
      nextRows: nextCatalog.length,
      forcedRows: forcedRows.length,
      prevRows: Array.isArray(prevCatalog) ? prevCatalog.length : -1,
      first: forcedRows[0] || null,
    });
  }
} catch (e) {
  console.error("[GENERIC_ADMISSION_BROCHURE_FORCE_UPSERT_ERR]", e);
}
// ===== GENERIC_ADMISSION_BROCHURE_FORCE_UPSERT_END =====



  // ===== SEU_UG_CATALOG_FORCE_START =====
  try {
    const seuUgParsed = kind === "ug"
      ? parseSeuUndergradCatalogPdf(raw_text, out?.filename || "东南大学本科.pdf")
      : null;

    if (seuUgParsed && Array.isArray((seuUgParsed as any).program_catalog) && (seuUgParsed as any).program_catalog.length > 0) {
      Object.assign(mergedParsed as any, seuUgParsed as any);

      if (typeof parsed !== "undefined" && parsed) {
        (parsed as any).program_catalog = (seuUgParsed as any).program_catalog;
        (parsed as any).program_catalog_meta = (seuUgParsed as any).program_catalog_meta;
      }

      if (typeof mergedCatalogFinal !== "undefined") {
        mergedCatalogFinal = (seuUgParsed as any).program_catalog;
      }

      console.log("[SEU_UG_CATALOG_FORCE_APPLIED]", {
        rows: (seuUgParsed as any).program_catalog.length,
        first: (seuUgParsed as any).program_catalog[0],
        parser: (seuUgParsed as any).program_catalog_meta?.parser,
      });
    }
  } catch (e) {
    console.error("[SEU_UG_CATALOG_FORCE_ERR]", e);
  }
  // ===== SEU_UG_CATALOG_FORCE_END =====


  
  // ===== SEU_UG_ENGLISH_CATALOG_MERGE_START =====
  try {
    const uploadName = String(out?.filename || "").trim();
    const seuUgEnglishParsed = kind === "ug"
      ? parseSeuUndergradEnglishCatalogPdf(raw_text, uploadName || "东南大学本科英文.pdf")
      : null;

    if (
      seuUgEnglishParsed &&
      Array.isArray((seuUgEnglishParsed as any).program_catalog) &&
      (seuUgEnglishParsed as any).program_catalog.length > 0
    ) {
      const baseCatalog = Array.isArray((mergedParsed as any)?.program_catalog)
        ? [...((mergedParsed as any).program_catalog as any[])]
        : [];

      const englishRows = (seuUgEnglishParsed as any).program_catalog as any[];

      for (const er of englishRows) {
        const cnName = String(er?.program_name_cn || er?.major_name_cn || "").trim();
        const idx = baseCatalog.findIndex((r: any) =>
          String(r?.program_name_cn || r?.major_name_cn || "").trim() === cnName
        );

        if (idx >= 0) {
          baseCatalog[idx] = {
            ...baseCatalog[idx],
            faculty_en: er.faculty_en || baseCatalog[idx].faculty_en || null,
            program_name_en: er.program_name_en || baseCatalog[idx].program_name_en || null,
            major_name_en: er.major_name_en || baseCatalog[idx].major_name_en || null,
            csca_subjects_en: er.csca_subjects_en || baseCatalog[idx].csca_subjects_en || null,
            source_files: Array.from(new Set([
              ...((Array.isArray(baseCatalog[idx]?.source_files) ? baseCatalog[idx].source_files : []) as any[]),
              uploadName || "东南大学本科英文.pdf",
            ].filter(Boolean))),
          };
        } else {
          baseCatalog.push({
            ...er,
            idx: baseCatalog.length + 1,
            tuition_rmb_per_year_min: er.tuition_rmb_per_year_min ?? 20000,
            tuition_rmb_per_year_max: er.tuition_rmb_per_year_max ?? 40000,
            tuition_rmb_per_year_text: er.tuition_rmb_per_year_text ?? "20,000-40,000",
            tuition_is_per_year: true,
            application_fee_rmb: er.application_fee_rmb ?? 800,
            application_fee_note: er.application_fee_note ?? "申请费：800元。",
            accommodation_fee_note: er.accommodation_fee_note ?? "住宿费：9000元人民币/年（双人间中的一个床位）。",
            source_files: [uploadName || "东南大学本科英文.pdf"],
          });
        }
      }

      (mergedParsed as any).program_catalog = baseCatalog.map((r: any, i: number) => ({
        ...(r || {}),
        idx: i + 1,
      }));

      (mergedParsed as any).program_catalog_meta = {
        ...((mergedParsed as any).program_catalog_meta || {}),
        parser: "seu_undergrad_english_catalog_merge_v1",
        profile: "seu_undergrad_english_catalog_merge",
        rows: (mergedParsed as any).program_catalog.length,
        english_rows: englishRows.length,
        english_source: uploadName || "东南大学本科英文.pdf",
      };

      if (typeof parsed !== "undefined" && parsed) {
        (parsed as any).program_catalog = (mergedParsed as any).program_catalog;
        (parsed as any).program_catalog_meta = (mergedParsed as any).program_catalog_meta;
      }

      if (typeof mergedCatalogFinal !== "undefined") {
        mergedCatalogFinal = (mergedParsed as any).program_catalog;
      }

      console.log("[SEU_UG_ENGLISH_CATALOG_MERGE_APPLIED]", {
        rows: (mergedParsed as any).program_catalog.length,
        englishRows: englishRows.length,
        firstEnglish: englishRows[0],
      });
    }
  } catch (e) {
    console.error("[SEU_UG_ENGLISH_CATALOG_MERGE_ERR]", e);
  }
  // ===== SEU_UG_ENGLISH_CATALOG_MERGE_END =====

// ===== SEU_TOURISM_UG_DETAIL_MERGE_START =====
  try {
    const uploadName = String(out?.filename || "").trim();
    const isSeuTourismUgDetail =
      kind === "ug" &&
      /东南大学/.test(uploadName) &&
      /旅游管理本科/.test(uploadName);

    if (isSeuTourismUgDetail) {
      const existingCatalog = Array.isArray((mergedParsed as any)?.program_catalog)
        ? [...((mergedParsed as any).program_catalog as any[])]
        : [];

      const detailRow = {
        idx: existingCatalog.length + 1,
        kind: "ug",
        degree_kind: "ug",
        degree_type: "本科",
        program_category: "undergraduate",
        faculty_cn: "人文学院",
        college_cn: "人文学院",
        program_name_cn: "旅游管理",
        major_name_cn: "旅游管理",
        program_name_en: "Tourism Management",
        study_language: "zh",
        language_text: "中文为主，部分课程英文",
        study_mode_cn: "全日制",
        duration_years: 4,
        duration_text: "4年",
        tuition_rmb_per_year: "16,000-20,000",
        tuition_rmb_per_year_min: 16000,
        tuition_rmb_per_year_max: 20000,
        tuition_rmb_per_year_text: "16,000-20,000",
        tuition_note: "中文授课本科每年学费：16,000-20,000元人民币。",
        application_fee_rmb: 800,
        application_fee_note: "申请费：800元。",
        contact_phone: "0086-25-83793022",
        contact_email: "admission@seu.edu.cn",
        source_files: [uploadName],
        program_intro:
          "东南大学外国留学生旅游管理本科专业依托人文学院，采用“中文+专业+文化”三位一体课程框架，培养具有跨文化素养、旅游管理能力和国际视野的复合型人才。",
        tags: ["本科", "中文授课", "东南大学", "旅游管理", "人文学院"],
      };

      const idx = existingCatalog.findIndex((r: any) =>
        String(r?.program_name_cn || r?.major_name_cn || "").trim() === "旅游管理"
      );

      if (idx >= 0) {
        existingCatalog[idx] = {
          ...existingCatalog[idx],
          ...detailRow,
          idx: existingCatalog[idx]?.idx || idx + 1,
          source_files: Array.from(
            new Set([
              ...((Array.isArray(existingCatalog[idx]?.source_files) ? existingCatalog[idx].source_files : []) as any[]),
              uploadName,
            ].filter(Boolean))
          ),
        };
      } else {
        existingCatalog.push(detailRow);
      }

      Object.assign(mergedParsed as any, {
        program_catalog: existingCatalog,
        program_catalog_meta: {
          ...((mergedParsed as any)?.program_catalog_meta || {}),
          rows: existingCatalog.length,
          parser: "seu_tourism_ug_detail_merge_v1",
          updated_by_detail_file: uploadName,
          detail_merge: true,
          rejected: false,
        },
      });

      console.log("[SEU_TOURISM_UG_DETAIL_MERGE_APPLIED]", {
        rows: existingCatalog.length,
        updated: idx >= 0,
        filename: uploadName,
      });
    }
  } catch (e) {
    console.error("[SEU_TOURISM_UG_DETAIL_MERGE_ERR]", e);
  }
  // ===== SEU_TOURISM_UG_DETAIL_MERGE_END =====

const upsertResp = await supabase
      .from("school_files")
      .upsert(
        [
          {
            school_id,
            kind,
            filename: out.filename,
            raw_text: out.raw_text,
            parsed_json: mergedParsed,
            status: "parsed",
          },
        ],
        { onConflict: "school_id,kind" },
      )
      .select("*")
      .limit(1);

    if (upsertResp.error) {
      console.error("[UPLOAD_UPSERT_ERR]", upsertResp.error);
      return NextResponse.json(
        { ok: false, error: "upsert_failed" },
        { status: 500 },
      );
    }

    const saved = Array.isArray(upsertResp.data)
      ? upsertResp.data[0]
      : upsertResp.data;

    // ===== PROGRAM_REVIEW_ISSUES_START =====
    try {
      const finalRows = Array.isArray(mergedParsed?.program_catalog)
        ? mergedParsed.program_catalog
        : [];

      const finalMeta = mergedParsed?.program_catalog_meta || {};
      const sourceUrlForReview = String(
        program_catalog_meta?.source_url || source_url || source_url_raw || "",
      ).trim();

      const reviewIssues = generateProgramReviewIssues({
        schoolId: String(school_id),
        schoolNameCn: null,
        kind: String(kind || ""),
        rows: finalRows,
        meta: finalMeta,
        fileId: saved?.id ? String(saved.id) : null,
      });

      if (reviewIssues.length > 0) {
        if (sourceUrlForReview) {
          const { error: reviewDeleteErr } = await supabase
            .from("program_review_issues")
            .delete()
            .eq("school_id", String(school_id))
            .eq("kind", String(kind || ""))
            .eq("source_url", sourceUrlForReview)
            .eq("status", "open");

          if (reviewDeleteErr) {
            console.error("[PROGRAM_REVIEW_ISSUES_DELETE_ERR]", reviewDeleteErr);
          }
        }

        const { error: reviewErr } = await supabase
          .from("program_review_issues")
          .insert(
            reviewIssues.map((x) => ({
              ...x,
              current_value:
                x.current_value === undefined ? null : x.current_value,
              candidate_values:
                x.candidate_values === undefined ? null : x.candidate_values,
              evidence: x.evidence === undefined ? null : x.evidence,
            })),
          );

        if (reviewErr) {
          console.error("[PROGRAM_REVIEW_ISSUES_INSERT_ERR]", reviewErr);
        } else {
          console.log("[PROGRAM_REVIEW_ISSUES_INSERT_OK]", {
            count: reviewIssues.length,
          });
        }
      } else {
        console.log("[PROGRAM_REVIEW_ISSUES_INSERT_SKIP]", {
          reason: "no_issues",
        });
      }
    } catch (e) {
      console.error("[PROGRAM_REVIEW_ISSUES_GENERATE_ERR]", e);
    }
    // ===== PROGRAM_REVIEW_ISSUES_END =====

// ===== BUAA_CHINESE_LANGUAGE_RESPONSE_FORCE_START =====
try {
  const srcForBuaaChineseResponse = String(source_url || source_url_raw || (parsed as any)?.program_catalog_meta?.source_url || "");
  const rawForBuaaChineseResponse = String(raw_text || (parsed as any)?.raw || "");

  if (
    String(kind) === "chinese_language" &&
    /hyjxs\.htm/i.test(srcForBuaaChineseResponse) &&
    /汉语进修生|普通汉语课程|北航国际合作部汉语进修生2026年秋季招生简章/.test(rawForBuaaChineseResponse)
  ) {
    const rows = [
      {
        idx: 1,
        kind: "chinese_language",
        program_category: "chinese_language",
        faculty_cn: "国际合作部 / 国际中文教育办公室",
        faculty_en: "International Chinese Education Office",
        program_name_cn: "普通汉语课程",
        program_name_en: "General Chinese Language Program",
        degree_type: "非学历",
        degree_name_cn: "汉语进修生",
        degree_name_en: "Chinese Language Student",
        language_text: "中文",
        study_language: "zh",
        duration_text: "一学期或一学年",
        duration_years: null,
        tuition_rmb_per_semester: 9000,
        tuition_rmb_per_year: 17200,
        tuition_is_per_year: false,
        tuition_note: "普通汉语课程：9000元/学期，17200元/学年。",
        application_fee_rmb: 400,
        application_deadline: "2026-07-15",
        application_time_text: "秋季学期：2026年9月1日-2027年1月6日；一学年：2026年9月1日-2027年7月6日；申请截止日期：2026年7月15日。",
        application_portal_text: "https://admission.buaa.edu.cn/",
        apply_requirements_text: "年龄18-55周岁且对中国及汉语感兴趣者可报名。",
        source_url: srcForBuaaChineseResponse || "https://is.buaa.edu.cn/lxsq/hyjxs.htm",
        source_files: [srcForBuaaChineseResponse || "hyjxs.htm"],
        raw_block: "北航国际合作部汉语进修生2026年秋季招生简章",
        tags: ["汉语进修", "非学历", "中文课程"],
      },
    ];

    (parsed as any).program_catalog = rows;
    (parsed as any).program_catalog_meta = {
      ...((parsed as any).program_catalog_meta || {}),
      parser: "buaa_chinese_language_html_v1",
      doc_type: "buaa_chinese_language_html",
      kind: "chinese_language",
      education_level: "chinese_language",
      source_url: srcForBuaaChineseResponse || "https://is.buaa.edu.cn/lxsq/hyjxs.htm",
      buaa_chinese_language_parse_status: "complete",
      buaa_chinese_language_rows: rows.length,
      buaa_chinese_language_with_tuition: rows.length,
      buaa_chinese_language_kind: "chinese_language",
    };

    console.log("[BUAA_CHINESE_LANGUAGE_RESPONSE_FORCE]", {
      rows: rows.length,
      parser: "buaa_chinese_language_html_v1",
      source_url: srcForBuaaChineseResponse || "https://is.buaa.edu.cn/lxsq/hyjxs.htm",
    });
  }
} catch (e) {
  console.error("[BUAA_CHINESE_LANGUAGE_RESPONSE_FORCE_ERR]", e);
}
// ===== BUAA_CHINESE_LANGUAGE_RESPONSE_FORCE_END =====


    return NextResponse.json({
      ok: true,
      __debug_zju:
        process.env.NODE_ENV !== "production"
          ? {
              zjuForced,
              zjuForcedCatalogLen: Array.isArray(zjuForcedCatalog)
                ? zjuForcedCatalog.length
                : -1,
              zjuForcedMetaParser: zjuForcedMeta?.parser ?? null,
              zjuForcedMetaRows: zjuForcedMeta?.rows ?? null,
              content_type,
              source_url,
              zjuGateHit,
              zjuParseOk,
              zjuParseRows,
              zjuParseParser,
              zjuParseErr,
              forcedDocType: docClass?.doc_type ?? null,
              forcedDocParser: (forcedMetaByDocClass as any)?.parser ?? null,
              forcedDocRows: Array.isArray(forcedCatalogByDocClass)
                ? forcedCatalogByDocClass.length
                : -1,
            }
          : undefined,
      school_id,
      filename: out.filename,
      raw_text_len:
        out && typeof (out as any).raw_text === "string"
          ? (out as any).raw_text.length
          : 0,
      parsed: mergedParsed,
      saved,
    });
  } catch (e: any) {
    console.error("upload route err:", e);

    const payload: any = { ok: false, error: e?.message || String(e) };
    if (process.env.NODE_ENV !== "production") {
      payload.stack = e?.stack || null;
      payload.name = e?.name || null;
    }
    return NextResponse.json(payload, { status: 500 });
  }
}
