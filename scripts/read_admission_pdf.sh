#!/usr/bin/env bash
set -euo pipefail

PDF="${1:-}"
OUT="${2:-/tmp/admission_pdf_read}"

if [ -z "$PDF" ]; then
  echo "用法: scripts/read_admission_pdf.sh /path/to/file.pdf /tmp/out_dir"
  exit 1
fi

if [ ! -f "$PDF" ]; then
  echo "文件不存在: $PDF"
  exit 1
fi

rm -rf "$OUT"
mkdir -p "$OUT/pages" "$OUT/ocr"

echo "=== PDF 信息 ==="
pdfinfo "$PDF" | tee "$OUT/pdfinfo.txt"

echo
echo "=== 1) 抽文本层 ==="
pdftotext -layout "$PDF" "$OUT/text_layer.txt" || true
wc -l "$OUT/text_layer.txt" || true

echo
echo "=== 2) 渲染每页图片 ==="
pdftoppm -png -r 260 "$PDF" "$OUT/pages/page"

ls -lh "$OUT/pages" | tee "$OUT/pages_ls.txt"

echo
echo "=== 3) 每页 OCR ==="
for img in "$OUT"/pages/page-*.png; do
  base="$(basename "$img" .png)"
  echo "OCR $base"
  tesseract "$img" "$OUT/ocr/$base" -l eng --psm 6 >/dev/null 2>&1 || true
done

cat "$OUT"/ocr/*.txt > "$OUT/ocr_all.txt" 2>/dev/null || true

echo
echo "=== 4) 合并全文 ==="
{
  echo "===== TEXT_LAYER ====="
  cat "$OUT/text_layer.txt" 2>/dev/null || true
  echo
  echo "===== OCR_ALL ====="
  cat "$OUT/ocr_all.txt" 2>/dev/null || true
} > "$OUT/all_text.txt"

echo
echo "=== 5) 关键词定位 ==="
grep -niE "BASIC INFORMATION|Program duration|Qualification|Application period|Application document|Application mode|Application fee|Tuition fee|Other fees|Registration time|Degree conferring|TOEFL|IELTS|passport|insurance|accommodation|RMB|CNY|MBBS|Clinical|Medicine|English-Taught" "$OUT/all_text.txt" \
  | tee "$OUT/keyword_hits.txt" || true

echo
echo "=== 6) 字段抽取 ==="
python3 - "$OUT/all_text.txt" "$OUT/fields.json" <<'PY'
import re, json, sys
from pathlib import Path

text_path = Path(sys.argv[1])
json_path = Path(sys.argv[2])
text = text_path.read_text(errors="ignore")

def clean(s):
    return re.sub(r"\s+", " ", str(s or "")).strip()

def first(patterns, flags=re.I|re.S):
    for pat in patterns:
        m = re.search(pat, text, flags)
        if m:
            return clean(m.group(1) if m.groups() else m.group(0))
    return None

def num(patterns):
    v = first(patterns)
    if not v:
        return None
    m = re.search(r"\d+", v.replace(",", ""))
    return int(m.group(0)) if m else None

fields = {}

fields["program_name_en"] = first([
    r"(English[- ]Taught Medical Undergraduate Program of Southeast University\s*\(MBBS\))",
    r"(An English[- ]Taught Medical Undergraduate Program of Southeast University\s*\(MBBS\))",
])
fields["program_alias_en"] = "MBBS" if re.search(r"\bMBBS\b", text, re.I) else None
fields["program_name_cn"] = "临床医学(英文授课)"
fields["degree_type"] = "本科"
fields["degree_kind"] = "ug"
fields["program_category"] = "undergraduate"
fields["study_language"] = "en"
fields["language_text"] = "英文"
fields["faculty_cn"] = "医学院"
fields["faculty_en"] = first([
    r"(School of Medicine,\s*SEU)",
    r"(School of Medicine of Southeast University)",
])
fields["school_name_en"] = "Southeast University"
fields["school_name_cn"] = "东南大学"

fields["duration_years"] = num([
    r"Program duration\s*[:：]?\s*(\d+)\s*years",
    r"duration\s*[:：]?\s*(\d+)\s*years",
])
fields["duration_text"] = f'{fields["duration_years"]} years' if fields.get("duration_years") else None

fields["qualification_en"] = first([
    r"Qualification\s*[:：]?\s*(Over\s+18.*?healthy\s+foreigners)",
    r"Qualification\s*[:：]?\s*(.*?healthy\s+foreigners)",
])

fields["application_period_text"] = first([
    r"Application period\s*[:：]?\s*([A-Za-z]{3,}\.?\s*\d+\s*to\s*[A-Za-z]{3,}\.?\s*\d+)",
    r"Application period\s*[:：]?\s*([^\n]+)",
])

docs_block = first([
    r"Application document\s*[:：]?\s*(.*?)(?:Application mode|Application fee|Tuition fee|Other fees|Registration time|Degree conferring)",
])
docs = []
if docs_block:
    parts = re.split(r"\s+(?=\d+\.\s*)", docs_block)
    for x in parts:
        x = clean(re.sub(r"^\d+\.\s*", "", x))
        if len(x) > 3:
            docs.append(x)

fields["application_documents"] = docs or None
fields["english_requirement_text"] = first([
    r"(TOEFL\s*80\s*/\s*IELTS\s*6\.0.*?(?:not English|English))",
])
fields["requires_high_school_diploma"] = bool(re.search(r"Senior high school diploma", text, re.I))
fields["requires_high_school_transcripts"] = bool(re.search(r"High school transcripts", text, re.I))
fields["requires_passport_copy"] = bool(re.search(r"Valid passport copy", text, re.I))
fields["requires_financial_support_statement"] = bool(re.search(r"Financial Support Guarantee Statement", text, re.I))

fields["financial_support_statement_url"] = first([
    r"(https?://cis\.seu\.edu\.cn/[^\s\)]+)",
])

fields["application_mode_text"] = first([
    r"Application mode\s*[:：]?\s*(Apply on the SEU online application system)",
    r"Application mode\s*[:：]?\s*([^\n]+)",
])
fields["application_url"] = first([
    r"(https?://fs\.seu\.edu\.cn)",
    r"(http://fs\.seu\.edu\.cn)",
])

fields["application_fee_rmb"] = num([
    r"Application fee\s*[:：]?\s*(\d+)\s*RMB",
    r"application fee\s*CNY\s*(\d+)",
])
fields["application_fee_note"] = first([
    r"Application fee\s*[:：]?\s*(\d+\s*RMB\s*\(nonrefundable\))",
    r"(application fee\s*CNY\s*\d+)",
])

fields["tuition_rmb_per_year"] = num([
    r"Tuition fee\s*[:：]?\s*(\d+)\s*RMB\s*/\s*year",
])
fields["tuition_is_per_year"] = bool(fields.get("tuition_rmb_per_year"))
fields["tuition_rmb_per_year_text"] = (
    f'{fields["tuition_rmb_per_year"]} RMB/year'
    if fields.get("tuition_rmb_per_year") else None
)

fields["insurance_fee_rmb_per_year"] = num([
    r"Other fees\s*[:：]?.*?(\d+)\s*RMB\s*/\s*year\s*for\s*insurance",
    r"(\d+)\s*RMB\s*/\s*year\s*for\s*insurance",
])
fields["accommodation_fee_rmb_per_year"] = num([
    r"Other fees\s*[:：]?.*?(\d+)\s*RMB\s*/\s*year\s*for\s*one\s*occupancy",
    r"(\d+)\s*RMB\s*/\s*year\s*for\s*one\s*occupancy",
])
fields["other_fees_text"] = first([
    r"Other fees\s*[:：]?\s*(.*?)(?:Registration time|Degree conferring|If you're admitted)",
])

fields["registration_time_text"] = first([
    r"Registration time\s*[:：]?\s*([A-Za-z]+)",
])

fields["degree_conferring_text"] = first([
    r"Degree conferring\s*[:：]?\s*(.*?)(?:If you're admitted|Contact|$)",
])
fields["degree_awarded_en"] = "bachelor's degree of medical science" if re.search(r"bachelor.?s degree of medical science", text, re.I) else None

fields["admission_document_note_en"] = first([
    r"(If you'?re admitted.*?required\.)",
])

fields["program_intro_en"] = first([
    r"(According to.*?School of Medicine,\s*SEU\.)",
])
fields["school_intro_en"] = first([
    r"(School of Medicine of Southeast University.*?high-quality education\.)",
])
fields["clinical_practice_bases_en"] = first([
    r"(Zhongda Hospital.*?Nanjing First Hospital)",
])
fields["international_students_note_en"] = first([
    r"(Currently,\s*there are over 300 international students.*?18%.*?medical students\.)",
])

required = [
    "program_name_en",
    "duration_years",
    "qualification_en",
    "application_period_text",
    "application_fee_rmb",
    "tuition_rmb_per_year",
    "insurance_fee_rmb_per_year",
    "accommodation_fee_rmb_per_year",
]
fields["_validation"] = {
    "missing_required": [k for k in required if not fields.get(k)],
    "ok": all(fields.get(k) for k in required),
}

json_path.write_text(json.dumps(fields, ensure_ascii=False, indent=2))
print(json.dumps(fields, ensure_ascii=False, indent=2))
PY

echo
echo "=== 输出文件 ==="
echo "$OUT/all_text.txt"
echo "$OUT/keyword_hits.txt"
echo "$OUT/fields.json"

echo
echo "=== 完成 ==="
