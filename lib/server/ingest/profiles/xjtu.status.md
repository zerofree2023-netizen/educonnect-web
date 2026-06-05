# XJTU ingest status

## Scope

School: 西安交通大学 / Xi'an Jiaotong University

Current implementation location:

- app/api/admin/schools/[school_id]/upload/route.ts

Archived profile snapshot:

- lib/server/ingest/profiles/xjtu.generated.ts

## Completed levels

### UG

Status: complete

Rows: 45

Completed fields:

- program catalog
- faculty repair
- language
- duration
- degree
- tuition
- application fee
- accommodation fee
- application requirements
- application process
- application materials
- language requirements
- exam requirements
- scholarship
- scholarship coverage

Final marker:

- xjtu_ug_pdf_parse_status = complete

### Master

Status: complete

Rows: 99

Completed fields:

- program catalog
- faculty repair
- language
- duration
- degree
- tuition
- application fee
- accommodation fee
- scholarship
- scholarship coverage

Final marker:

- xjtu_grad_parse_status = complete
- xjtu_grad_kind = master
- xjtu_grad_rows = 99

### PhD

Status: complete

Rows: 88

Completed fields:

- program catalog
- faculty repair
- language
- duration
- degree
- advisor acceptance requirement
- tuition
- application fee
- accommodation fee
- scholarship
- scholarship coverage

Final marker:

- xjtu_grad_parse_status = complete
- xjtu_grad_kind = phd
- xjtu_grad_rows = 88

## Next refactor plan

Do not add more school-specific logic directly into upload route.

Refactor direction:

- keep generic pipeline in route
- move school-specific overrides into profile files
- use xjtu.generated.ts as source snapshot
- later extract executable helpers into xjtu.ts

## Refactor progress

### 2026-05-27

Completed safe profile scaffolding:

- created lib/server/ingest/profiles/xjtu.ts
- created lib/server/ingest/profiles/index.ts
- kept route.ts behavior unchanged
- profile registry is not wired into upload route yet

Next step:

- extract one small pure helper first
- prefer grad tuition/group helper before moving parser blocks

### Pure helper extraction

Added non-wired pure helpers to lib/server/ingest/profiles/xjtu.ts:

- getXjtuGradTuitionGroup
- getXjtuGradTuitionRmbPerYear
- getXjtuGradTuitionNote
- applyXjtuGradTuition

No route.ts behavior changed in this step.

### Route import smoke

Added route.ts import smoke for XJTU pure helpers.

Imported helpers:

- applyXjtuGradTuition
- getXjtuGradTuitionGroup
- getXjtuGradTuitionNote
- getXjtuGradTuitionRmbPerYear

No parser behavior changed in this step.

### Archive compile fix and grad helper wire-in

Moved raw generated archive to:

- lib/server/ingest/profiles/xjtu.generated.archive.txt

Replaced xjtu.generated.ts with a safe manifest so tsc no longer parses archived raw code.

Rewired route.ts XJTU grad tuition helper wrappers to delegate to profile pure helpers:

- xjtuGradGroupByRow -> getXjtuGradTuitionGroup
- xjtuGradTuition -> getXjtuGradTuitionRmbPerYear
- xjtuGradFeeNote -> getXjtuGradTuitionNote

### Master regression confirmed

Confirmed after route helper wire-in:

- xjtu_grad_parse_status = complete
- xjtu_grad_kind = master
- xjtu_grad_rows = 99
- xjtu_grad_expected_rows = 99
- xjtu_grad_with_tuition = 99
- xjtu_grad_bad_rows = 0
- fee distribution = 50000:53, 39000:22, 30000:13, 34000:11
