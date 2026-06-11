#!/usr/bin/env bash
set -euo pipefail

PDF="${1:-}"
OUT="${2:-/tmp/admission_pdf_ocr_strong}"

if [ -z "$PDF" ]; then
  echo "用法: scripts/read_admission_pdf_ocr_strong.sh /path/to/file.pdf /tmp/out_dir"
  exit 1
fi

rm -rf "$OUT"
mkdir -p "$OUT/pages" "$OUT/crops" "$OUT/ocr"

echo "=== PDF 信息 ==="
pdfinfo "$PDF" | tee "$OUT/pdfinfo.txt"

echo
echo "=== 1) 文本层 ==="
pdftotext -layout "$PDF" "$OUT/text_layer.txt" || true
wc -l "$OUT/text_layer.txt" || true

echo
echo "=== 2) 高分辨率渲染页面 ==="
pdftoppm -png -r 360 "$PDF" "$OUT/pages/page"

echo
echo "=== 3) 生成整页 + 分块裁剪图 ==="
python3 - "$OUT/pages" "$OUT/crops" <<'PY'
from pathlib import Path
from PIL import Image, ImageOps, ImageEnhance, ImageFilter

pages = Path(__import__("sys").argv[1])
crops = Path(__import__("sys").argv[2])
crops.mkdir(parents=True, exist_ok=True)

for p in sorted(pages.glob("page-*.png")):
    im = Image.open(p).convert("RGB")
    w,h = im.size

    # 预处理：灰度、增强对比、锐化、放大
    base = ImageOps.grayscale(im)
    base = ImageEnhance.Contrast(base).enhance(2.2)
    base = base.filter(ImageFilter.SHARPEN)
    base = base.resize((w*2, h*2))

    # 整页
    base.save(crops / f"{p.stem}_full.png")

    W,H = base.size

    # 折页常见区域：上/中/下，左右两栏，四象限
    boxes = {
        "top": (0, 0, W, int(H*0.38)),
        "mid": (0, int(H*0.25), W, int(H*0.75)),
        "bottom": (0, int(H*0.55), W, H),
        "left": (0, 0, int(W*0.55), H),
        "right": (int(W*0.45), 0, W, H),
        "tl": (0, 0, int(W*0.55), int(H*0.55)),
        "tr": (int(W*0.45), 0, W, int(H*0.55)),
        "bl": (0, int(H*0.45), int(W*0.55), H),
        "br": (int(W*0.45), int(H*0.45), W, H),
    }

    for name, box in boxes.items():
        base.crop(box).save(crops / f"{p.stem}_{name}.png")

print("crops generated:", len(list(crops.glob("*.png"))))
PY

echo
echo "=== 4) 多模式 OCR ==="
for img in "$OUT"/crops/*.png; do
  b="$(basename "$img" .png)"
  for psm in 6 11 12; do
    echo "OCR $b psm=$psm"
    tesseract "$img" "$OUT/ocr/${b}_psm${psm}" -l eng --psm "$psm" >/dev/null 2>&1 || true
  done
done

cat "$OUT"/ocr/*.txt > "$OUT/ocr_all.txt" 2>/dev/null || true

echo
echo "=== 5) 合并全文 ==="
{
  echo "===== TEXT_LAYER ====="
  cat "$OUT/text_layer.txt" 2>/dev/null || true
  echo
  echo "===== OCR_ALL ====="
  cat "$OUT/ocr_all.txt" 2>/dev/null || true
} > "$OUT/all_text.txt"

echo
echo "=== 6) 关键词 ==="
grep -niE "BASIC INFORMATION|Program duration|Qualification|Application period|Application document|Application mode|Application fee|Tuition fee|Other fees|Registration time|Degree conferring|TOEFL|IELTS|passport|insurance|accommodation|RMB|CNY|MBBS|Clinical|Medicine|English-Taught|nonrefundable|Financial Support" "$OUT/all_text.txt" \
  | tee "$OUT/keyword_hits.txt" || true

echo
echo "=== 7) 字段抽取 ==="
python3 - "$OUT/all_text.txt" "$OUT/fields.json" <<'PY'
import re, json, sys
from pathlib import Path

text = Path(sys.argv[1]).read_text(errors="ignore")
out = Path(sys.argv[2])

# OCR 常见纠错
norm = text
norm = norm.replace("RBM", "RMB").replace("R M B", "RMB")
norm = norm.replace("lELTS", "IELTS").replace("IELT S", "IELTS")
norm = re.sub(r"[ \t\r\f\v]+", " ", norm)
norm = re.sub(r"\n+", "\n", norm)

def clean(s):
    return re.sub(r"\s+", " ", str(s or "")).strip()

def first(patterns, flags=re.I|re.S):
    for pat in patterns:
        m = re.search(pat, norm, flags)
        if m:
            return clean(m.group(1) if m.groups() else m.group(0))
    return None

def n(patterns):
    v = first(patterns)
    if not v:
        return None
    m = re.search(r"\d+", v.replace(",", ""))
    return int(m.group(0)) if m else None

fields = {
  "program_name_cn": "临床医学(英文授课)",
  "program_name_en": first([
      r"(English[- ]Taught Medical Undergraduate Program of Southeast University\s*\(?MBBS\)?)",
      r"(English[- ]Taught Medical Undergraduate Program.*?MBBS)",
  ]),
  "program_alias_en": "MBBS" if re.search(r"\bMBBS\b", norm, re.I) else None,
  "degree_type": "本科",
  "degree_kind": "ug",
  "program_category": "undergraduate",
  "study_language": "en",
  "language_text": "英文",
  "faculty_cn": "医学院",
  "faculty_en": first([r"(School of Medicine,\s*SEU)", r"(School of Medicine of Southeast University)"]),
  "school_name_en": "Southeast University",
  "school_name_cn": "东南大学",
}

fields["duration_years"] = n([
    r"Program duration\s*[:：]?\s*(\d+)\s*years",
    r"duration\s*[:：]?\s*(\d+)\s*years",
    r"\b(\d+)\s*years\b",
])
fields["duration_text"] = f'{fields["duration_years"]} years' if fields.get("duration_years") else None

fields["qualification_en"] = first([
    r"Qualification\s*[:：]?\s*(Over\s+18.*?healthy\s+foreigners)",
    r"(Over\s+18\s*year'?s?\s*old.*?healthy\s+foreigners)",
])

fields["application_period_text"] = first([
    r"Application period\s*[:：]?\s*([A-Za-z]{3,}\.?\s*\d+\s*(?:to|-|—)\s*[A-Za-z]{3,}\.?\s*\d+)",
    r"(Nov\.?\s*15\s*(?:to|-|—)\s*Jun\.?\s*30)",
])

docs_block = first([
    r"Application document\s*[:：]?\s*(.*?)(?:Application mode|Application fee|Tuition fee|Other fees|Registration time|Degree conferring|If you)",
])
docs = []
if docs_block:
    for x in re.split(r"\s+(?=\d+\.\s*)", docs_block):
        x = clean(re.sub(r"^\d+\.\s*", "", x))
        if len(x) > 6:
            docs.append(x)
fields["application_documents"] = docs or None

fields["english_requirement_text"] = first([
    r"(TOEFL\s*80\s*/\s*IELTS\s*6\.0.*?(?:not English|English))",
    r"(TOEFL.*?IELTS.*?(?:not English|English))",
])

fields["requires_high_school_diploma"] = bool(re.search(r"Senior high school diploma", norm, re.I))
fields["requires_high_school_transcripts"] = bool(re.search(r"High school transcripts", norm, re.I))
fields["requires_passport_copy"] = bool(re.search(r"Valid passport copy|passport copy", norm, re.I))
fields["requires_financial_support_statement"] = bool(re.search(r"Financial Support Guarantee Statement", norm, re.I))

fields["application_mode_text"] = first([
    r"Application mode\s*[:：]?\s*(Apply on the SEU online application system)",
    r"(Apply on the SEU online application system)",
])
fields["application_url"] = first([r"(https?://fs\.seu\.edu\.cn)"])

fields["application_fee_rmb"] = n([
    r"Application fee\s*[:：]?\s*(\d+)\s*RMB",
    r"application fee\s*CNY\s*(\d+)",
    r"(\d+)\s*RMB\s*\(?nonrefundable\)?",
])
fields["application_fee_note"] = first([
    r"Application fee\s*[:：]?\s*(\d+\s*RMB\s*\(?nonrefundable\)?)",
    r"(\d+\s*RMB\s*\(?nonrefundable\)?)",
])

fields["tuition_rmb_per_year"] = n([
    r"Tuition fee\s*[:：]?\s*(\d+)\s*RMB\s*/\s*year",
    r"(\d+)\s*RMB\s*/\s*year",
])
fields["tuition_is_per_year"] = bool(fields.get("tuition_rmb_per_year"))
fields["tuition_rmb_per_year_text"] = f'{fields["tuition_rmb_per_year"]} RMB/year' if fields.get("tuition_rmb_per_year") else None

fields["insurance_fee_rmb_per_year"] = n([
    r"(\d+)\s*RMB\s*/\s*year\s*for\s*insurance",
    r"insurance\s*fee.*?(\d+)\s*RMB\s*/\s*year",
])
fields["accommodation_fee_rmb_per_year"] = n([
    r"(\d+)\s*RMB\s*/\s*year\s*for\s*one\s*occupancy",
    r"accommodation.*?(\d+)\s*RMB\s*/\s*year",
])
fields["other_fees_text"] = first([
    r"Other fees\s*[:：]?\s*(.*?)(?:Registration time|Degree conferring|If you)",
])

fields["registration_time_text"] = first([
    r"Registration time\s*[:：]?\s*([A-Za-z]+)",
    r"Registration\s*time.*?\b(September)\b",
])

fields["degree_conferring_text"] = first([
    r"Degree conferring\s*[:：]?\s*(.*?)(?:If you|Application|Contact|$)",
])
fields["admission_document_note_en"] = first([
    r"(If you'?re admitted.*?required\.)",
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
  "registration_time_text",
]
fields["_validation"] = {
  "missing_required": [k for k in required if not fields.get(k)],
  "ok": all(fields.get(k) for k in required),
}

out.write_text(json.dumps(fields, ensure_ascii=False, indent=2))
print(json.dumps(fields, ensure_ascii=False, indent=2))
PY

echo
echo "=== 输出 ==="
echo "$OUT/all_text.txt"
echo "$OUT/keyword_hits.txt"
echo "$OUT/fields.json"
