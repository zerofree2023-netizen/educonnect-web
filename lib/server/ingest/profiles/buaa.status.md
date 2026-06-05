# BUAA ingest status

## Scope

School: 北京航空航天大学 / Beihang University

School ID:

- 402886847432fada01744854bf0e002f

Official UG source:

- https://is.buaa.edu.cn/lxsq/bks1.htm

## UG first diagnosis

Status: needs school-specific parser

First generic result:

- parser = generic_program_catalog_v1
- doc_type = generic_program_catalog
- total = 14
- with_faculty = 14
- with_program = 14
- with_language = 14
- with_duration = 14
- with_tuition = 0
- application_fee_rmb = 400

Problem:

- Generic parser captured guide text, tuition text, scholarship text as fake program rows.
- Only the final row touched actual catalog content.
- Need BUAA UG official HTML catalog parser scoped to section "六、专业目录".

Official policy to apply:

- duration = 4 years
- application fee = 400 RMB
- Chinese taught science/engineering/business/law = 25,000 RMB/year
- Chinese taught biomedical/art = 30,000 RMB/year
- English taught all programs = 30,000 RMB/year
- application period = 2025-11-01 to 2026-06-30

Official page evidence:

- application requirements are in section 一、申请资格
- application dates are in section 二、录取审核时间安排
- application process/materials are in section 三、申请步骤
- tuition/fees are in section 四、学制及费用
- scholarships are in section 五、奖学金
- catalog begins at section 六、专业目录

## UG parser result

Status: complete

Confirmed result:

- parser = buaa_ug_html_catalog_v1
- doc_type = buaa_ug_catalog_html
- buaa_ug_parse_status = complete
- rows = 79
- with_faculty = 79
- with_program = 79
- with_language = 79
- with_duration = 79
- with_tuition = 79
- with_apply_requirements = 79
- with_process = 79
- with_materials = 79
- with_scholarship = 79
- language distribution = 中文:63, 英文:16
- fee distribution = 25000:60, 30000:19

Tuition validation:

- Chinese science/engineering/business/law programs = 25,000 RMB/year
- Chinese biomedical/art programs = 30,000 RMB/year
- English taught programs = 30,000 RMB/year
- application fee = 400 RMB

Notes:

- Generic parser produced 14 noisy rows.
- BUAA UG HTML parser now overrides those rows from the official section 六、专业目录.
- Next step: move BUAA parser/helper logic out of route.ts into lib/server/ingest/profiles/buaa.ts after one more regression pass.

## UG parser result

Status: complete

Confirmed result:

- parser = buaa_ug_html_catalog_v1
- doc_type = buaa_ug_catalog_html
- buaa_ug_parse_status = complete
- rows = 79
- with_faculty = 79
- with_program = 79
- with_language = 79
- with_duration = 79
- with_tuition = 79
- with_apply_requirements = 79
- with_process = 79
- with_materials = 79
- with_scholarship = 79
- language distribution = 中文:63, 英文:16
- fee distribution = 25000:60, 30000:19

Tuition validation:

- Chinese science/engineering/business/law programs = 25,000 RMB/year
- Chinese biomedical/art programs = 30,000 RMB/year
- English taught programs = 30,000 RMB/year
- application fee = 400 RMB

Notes:

- Generic parser produced 14 noisy rows.
- BUAA UG HTML parser now overrides those rows from the official section 六、专业目录.
- Next step: move BUAA parser/helper logic out of route.ts into lib/server/ingest/profiles/buaa.ts after one more regression pass.

## Master parser result

Status: complete

Official source:

- https://is.buaa.edu.cn/lxsq/yjs/yjs_ssyjs.htm

Confirmed result:

- parser = buaa_master_html_catalog_v1
- doc_type = buaa_master_catalog_html
- buaa_master_parse_status = complete
- rows = 96
- with_faculty = 96
- with_program = 96
- with_language = 96
- with_duration = 96
- with_tuition = 96
- with_application_fee = 96
- language distribution = 中文:47, 英文:45, 法文:3, 俄语:1
- fee distribution = 35000:96

Official policy applied:

- study duration = 2~3 years
- application fee = CNY 400
- tuition fee = CNY 35,000 per year
- language marks:
  - ● = 中文
  - ▲ = 英文
  - ◆ = 法文
  - ☐ = 德语
  - △ = 俄语

Notes:

- Generic parser produced 3 noisy rows.
- BUAA Master HTML parser now overrides rows from official Major List.
- Multi-language programs are split into separate rows by teaching language.

## Master parser result

Status: complete

Official source:

- https://is.buaa.edu.cn/lxsq/yjs/yjs_ssyjs.htm

Confirmed result:

- parser = buaa_master_html_catalog_v1
- doc_type = buaa_master_catalog_html
- buaa_master_parse_status = complete
- rows = 96
- with_faculty = 96
- with_program = 96
- with_language = 96
- with_duration = 96
- with_tuition = 96
- with_application_fee = 96
- language distribution = 中文:47, 英文:45, 法文:3, 俄语:1
- fee distribution = 35000:96

Official policy applied:

- study duration = 2~3 years
- application fee = CNY 400
- tuition fee = CNY 35,000 per year
- language marks:
  - ● = 中文
  - ▲ = 英文
  - ◆ = 法文
  - ☐ = 德语
  - △ = 俄语

Notes:

- Generic parser produced 3 noisy rows.
- BUAA Master HTML parser now overrides rows from official Major List.
- Multi-language programs are split into separate rows by teaching language.

## PhD parser result

Status: complete

Official source:

- https://is.buaa.edu.cn/lxsq/yjs/yjs_bsyjs.htm

Confirmed result:

- parser = buaa_phd_html_catalog_v1
- doc_type = buaa_phd_catalog_html
- buaa_phd_parse_status = complete
- rows = 85
- with_faculty = 85
- with_program = 85
- with_language = 85
- with_duration = 85
- with_tuition = 85
- with_application_fee = 85
- language distribution = 中文:41, 英文:43, 俄语:1
- fee distribution = 42000:85

Official policy applied:

- study duration = 4 years
- application fee = CNY 400
- tuition fee = CNY 42,000 per year
- language marks:
  - ● = 中文
  - ▲ = 英文
  - ◆ = 法文
  - ☐ = 德语
  - △ = 俄语

Notes:

- Generic parser produced 3 noisy rows.
- BUAA PhD HTML parser now overrides rows from official Major List.
- Raw-shape compatibility was added for collapsed school/program lines and URL lines.
- Multi-language programs are split into separate rows by teaching language.

## PhD parser result

Status: complete

Official source:

- https://is.buaa.edu.cn/lxsq/yjs/yjs_bsyjs.htm

Confirmed result:

- parser = buaa_phd_html_catalog_v1
- doc_type = buaa_phd_catalog_html
- buaa_phd_parse_status = complete
- rows = 85
- with_faculty = 85
- with_program = 85
- with_language = 85
- with_duration = 85
- with_tuition = 85
- with_application_fee = 85
- language distribution = 中文:41, 英文:43, 俄语:1
- fee distribution = 42000:85

Official policy applied:

- study duration = 4 years
- application fee = CNY 400
- tuition fee = CNY 42,000 per year
- language marks:
  - ● = 中文
  - ▲ = 英文
  - ◆ = 法文
  - ☐ = 德语
  - △ = 俄语

Notes:

- Generic parser produced 3 noisy rows.
- BUAA PhD HTML parser now overrides rows from official Major List.
- Raw-shape compatibility was added for collapsed school/program lines and URL lines.
- Multi-language programs are split into separate rows by teaching language.

## Current BUAA completion summary

School: 北京航空航天大学 / Beihang University

School ID:

- 402886847432fada01744854bf0e002f

Official sources:

- UG: https://is.buaa.edu.cn/lxsq/bks1.htm
- Master: https://is.buaa.edu.cn/lxsq/yjs/yjs_ssyjs.htm
- PhD: https://is.buaa.edu.cn/lxsq/yjs/yjs_bsyjs.htm

Completed levels:

### UG

Status: complete

- parser = buaa_ug_html_catalog_v1
- doc_type = buaa_ug_catalog_html
- rows = 79
- with_faculty = 79
- with_program = 79
- with_language = 79
- with_duration = 79
- with_tuition = 79
- with_application_fee = 79
- language distribution = 中文:63, 英文:16
- fee distribution = 25000:60, 30000:19

### Master

Status: complete

- parser = buaa_master_html_catalog_v1
- doc_type = buaa_master_catalog_html
- rows = 96
- with_faculty = 96
- with_program = 96
- with_language = 96
- with_duration = 96
- with_tuition = 96
- with_application_fee = 96
- language distribution = 中文:47, 英文:45, 法文:3, 俄语:1
- fee distribution = 35000:96

### PhD

Status: complete

- parser = buaa_phd_html_catalog_v1
- doc_type = buaa_phd_catalog_html
- rows = 85
- with_faculty = 85
- with_program = 85
- with_language = 85
- with_duration = 85
- with_tuition = 85
- with_application_fee = 85
- language distribution = 中文:41, 英文:43, 俄语:1
- fee distribution = 42000:85

Route parser blocks currently active:

- BUAA_UG_HTML_CATALOG_PARSE
- BUAA_MASTER_HTML_CATALOG_PARSE
- BUAA_PHD_HTML_CATALOG_PARSE

Next refactor plan:

- Do not add more BUAA logic directly into route.ts.
- Move BUAA parser/helper logic into lib/server/ingest/profiles/buaa.ts.
- Keep route.ts as generic pipeline plus profile dispatcher.

## RCSSTEAP special program parser result

Status: complete

Official source:

- https://rcssteap.buaa.edu.cn/kjkjjyev/info/1042/2339.htm

Confirmed Master / MASTA result:

- parser = buaa_rcssteap_masta_pdf_v1
- doc_type = buaa_rcssteap_masta
- buaa_rcssteap_parse_status = complete
- buaa_rcssteap_kind = masta
- rows = 4
- with_language = 4
- with_duration = 4
- with_tuition = 4
- with_application_fee = 4
- language distribution = 英文:4
- fee distribution = 35000:4

MASTA tracks:

- Remote Sensing and Geographic Information System (RS&GIS)
- Global Navigation Satellite Systems (GNSS)
- Micro-satellite Technology
- Space Project Management (SPM)

Confirmed PhD / DOCSTA result:

- parser = buaa_rcssteap_docsta_pdf_v1
- doc_type = buaa_rcssteap_docsta
- buaa_rcssteap_parse_status = complete
- buaa_rcssteap_kind = docsta
- rows = 3
- with_language = 3
- with_duration = 3
- with_tuition = 3
- with_application_fee = 3
- language distribution = 英文:3
- fee distribution = 42000:3

DOCSTA tracks:

- Remote Sensing and Geographic Information System (RS&GIS)
- Global Navigation Satellite Systems (GNSS)
- Micro-satellite Technology

Notes:

- RCSSTEAP MASTA/DOCSTA is a special program and must not be parsed as ordinary BUAA master/phd catalog.
- MASTA includes Space Project Management.
- DOCSTA does not include Space Project Management.
- Forced curl upload with kind=master confirmed MASTA parsing, avoiding front-end kind selection confusion.

## RCSSTEAP special program parser result

Status: complete

Official source:

- https://rcssteap.buaa.edu.cn/kjkjjyev/info/1042/2339.htm

Confirmed Master / MASTA result:

- parser = buaa_rcssteap_masta_pdf_v1
- doc_type = buaa_rcssteap_masta
- buaa_rcssteap_parse_status = complete
- buaa_rcssteap_kind = masta
- rows = 4
- with_language = 4
- with_duration = 4
- with_tuition = 4
- with_application_fee = 4
- language distribution = 英文:4
- fee distribution = 35000:4

MASTA tracks:

- Remote Sensing and Geographic Information System (RS&GIS)
- Global Navigation Satellite Systems (GNSS)
- Micro-satellite Technology
- Space Project Management (SPM)

Confirmed PhD / DOCSTA result:

- parser = buaa_rcssteap_docsta_pdf_v1
- doc_type = buaa_rcssteap_docsta
- buaa_rcssteap_parse_status = complete
- buaa_rcssteap_kind = docsta
- rows = 3
- with_language = 3
- with_duration = 3
- with_tuition = 3
- with_application_fee = 3
- language distribution = 英文:3
- fee distribution = 42000:3

DOCSTA tracks:

- Remote Sensing and Geographic Information System (RS&GIS)
- Global Navigation Satellite Systems (GNSS)
- Micro-satellite Technology

Notes:

- RCSSTEAP MASTA/DOCSTA is a special program and must not be parsed as ordinary BUAA master/phd catalog.
- MASTA includes Space Project Management.
- DOCSTA does not include Space Project Management.
- Forced curl upload with kind=master confirmed MASTA parsing, avoiding front-end kind selection confusion.

## Foundation+Bachelor pathway parser result

Status: complete

Official source:

- https://is.buaa.edu.cn/lxsq/ybld.htm

Kind:

- foundation_bachelor

Confirmed result:

- parser = buaa_foundation_bachelor_html_v1
- doc_type = buaa_foundation_bachelor_html
- buaa_foundation_bachelor_parse_status = complete
- rows = 3
- with_language = 3
- with_duration = 3
- with_tuition = 3
- with_application_fee = 3
- language distribution = 英文:3
- foundation tuition distribution = 8000:3
- bachelor tuition distribution = 30000:3
- application fee = 400

Programs:

- Computer Science and Technology (AI and Big Data)
- International Economics and Trade (Digital Trade)
- Biomedical Engineering

Policy fields applied:

- application deadline = 2026-03-10
- registration date = 2026-04-15
- foundation duration = April to July, 2026
- bachelor duration = 4 years
- foundation tuition = 8000 CNY
- bachelor tuition = 30000 CNY/year
- application fee = 400 CNY

Notes:

- This is a pathway / foundation-to-bachelor program.
- It must not be parsed as ordinary UG.
- Long-term kind = foundation_bachelor.
- Other schools' pathway/foundation programs should follow this separate kind pattern.
