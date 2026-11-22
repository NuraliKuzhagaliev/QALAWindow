# Requirement and evidence matrix

Reviewed against the full supplied four-page official brief and twenty-page research dossier. The master prompt is the implementation contract; research proposals are not evidence. The chosen case is the Astana Smart City walking assistant. CampusPulse is a separate case. Dates in evidence are UTC unless a zone is included.

Status meanings: **tested** means a finite observed check of the implemented scope, not universal correctness. External submission gates remain separate. Data version: `osm-2026-10-18-a3fc82c5`.

| ID | Scope | State and evidence |
|---|---|---|
| R01 | Audience, problem, business hypothesis, risks, roadmap | Implemented: `docs/PRODUCT.md`, `docs/PRIVACY_AND_LIMITATIONS.md`, presentation. Revenue, partnerships and adoption are hypotheses. |
| R02 | Interactive RAG and automatically collected POIs | Tested: `scripts/data/collect.mjs`, actual raw responses/audit, `tests/evidence/live-quality.json`, anonymous public smoke. Real model generation is constrained to approved explanation/activity choices. |
| R03 | Location, time, interests, context, movement, restrictions | Tested: manual landmarks/map/coordinates, consent GPS, explicit walking mode, Astana clock, advanced controls; D30-D38, L01-L04 and browser states. Landmark area aliases identify the displayed source anchor, not the tower itself. |
| R04 | 1–3 recommendations, reasons, durations, distance, action | Tested: solver suite and real public flow. Zero is valid with explanations/explicit relaxation. Full return route, dwell and buffer shown. |
| R05 | Time/distance/schedules/categories/restrictions | Tested: D01-D29 and holdout. Unknown does not satisfy strict requirements. Source schedule is not current availability. |
| R06 | Complete nullable POI schema | Tested: shared schemas, 120 records; hours/contact/rating/popularity/attributes retain nulls. No invented reviews or ratings. |
| R07 | Automatic, reproducible collection and audit | Tested fresh upstream collection: 631 source records, 120 selected, 3,801 network ways; timestamps, raw tags, hashes, dedup candidates, change report and archived source. `data/snapshots/DATA_AUDIT.json`, `CHANGE_REPORT.json`. |
| R08 | Plain-language RAG explanation and actual trace | Implemented and observed: `docs/RAG.md`, `tests/evidence/real-retrieval-trace.json`, judge trace. No private reasoning requested. |
| R09 | Field receipts, estimates versus ideas, uncertainty | Tested: evidence drawer, per-field source/date/state/transformation, source links and calculation JSON; browser screenshot and assertion suite. |
| R10 | Real and synthetic scenarios | Tested: `docs/TEST_SCENARIOS.md`, 48 development + 24 holdout + 4 alias regressions. Synthetic source/provider failures are labeled. |
| R11 | Privacy/ethics behavior and documentation | Tested in bounded scope: GPS denial, local group processing, local packs, no raw query/coordinates sent to model, secret scan. `docs/PRIVACY_AND_LIMITATIONS.md`. |
| R12 | 5–7 minute editable and PDF presentation | Prepared: nine-slide PPTX + PDF, 390-second notes, structural/layout/font validation and all-page visual review. Human delivery timing and native Office rendering remain unverified. |
| R13 | Prototype/source archive, instructions, demo/YouTube | Local artifacts prepared in release/submission; actual recording and metadata included. **External gate:** accessible YouTube upload still needs account access and explicit authorization. Local video is not an uploaded link. |
| R14 | Complete selected-case rubric map | Implemented below. No official weights or predicted scores. |
| U01 | Public web, shareable URL, desktop/mobile, anonymous | Tested: production URL in STATUS, fresh anonymous Chromium session, 1440/1280/390 screens, no 390 horizontal overflow. |
| U02 | Genuine Windows app, native IO, local assets, restart | Tested: unsigned x64 portable wrapper launches with local renderer; actual native save/open and offline restart of packaged app. `native-smoke.json`, `portable-launch.json`. |
| U03 | Visual quality and loading/error/empty/offline/unknown | Implemented and finite checks: screenshots, outage tests, zero axe A/AA findings on scanned result screen; no claim of full accessibility certification. |
| U04 | All eight defined additions | Implemented; evidence and practical boundaries below. |

| Addition | Implementation | Verification and boundary |
|---|---|---|
| F01 Return-by solver | Full outbound/interstop/return geometry, maximum dwell, one buffer, closing intervals, endpoint | D01-D12 and holdout real loops. Arrival is a modeled estimate, not a guarantee. |
| F02 Weather Plan B | Timestamped city forecast; explicit outdoor cap; full re-solve and added/removed/time/slack comparison | D29, H cases and demo. Missing forecast becomes labeled simulation. No inferred ice, cover or shelter. |
| F03 Evidence receipts | Source fields, upstream/retrieval dates, raw tags, hashes, derived calculations and proposed action | Real drawer and trace; preserves old/unknown/conflicting evidence. Hash is integrity, not factual truth. |
| F04 Small-group compromise | Individual profiles kept locally; every hard constraint; max-min then total match; displayed per-person scores | Development and holdout group cases. Scores are preference matches, not happiness probabilities. |
| F05 Access and walking comfort | Required/preferred step-free, maximum continuous walk, break preference, strict amenities | Tests of unknown access and opposing constraints. Current network access is unverified, so strict step-free correctly often returns zero. |
| F06 EN/RU/KZ | Localized primary UI, controlled model choices in three languages, original source names, local aliases | Six real language quality calls, alias regressions and Unicode/time consistency. Native Kazakh editorial review is pending; technical source traces retain source keys. |
| F07 Offline route packs | Versioned schema, export/import, geometry, evidence, obtained prose; IDB and native dialogs | Browser closed/reopened offline with SW shell + IDB pack; actual Windows save/open/restart. No tile bulk downloads or new AI claims offline. |
| F08 Judge challenge desk | Health, input controls, validation trace, isolated JSON/CSV import, closure simulation, reset | Deterministic malicious/malformed/oversize cases and real browser import/reset. Imported facts remain unverified, not promoted to source truth. |

The official Smart City rubric is mapped without invented numerical weights:

| Criterion | Evidence to inspect |
|---|---|
| Relevant and useful recommendations | Real collected POIs, fresh query, 1–3 concrete actions, finite holdout results |
| Context and adaptation | Full deadline, group/comfort constraints, Plan B, closure/import challenge |
| Short and accurate explanations | Controlled generated choices; sourced facts and calculations; six retained real outputs; generic-language limitation |
| Easy-to-test UX | Anonymous URL, visible inputs, map/cards, source drawer, test instructions and portable app |
| Creativity | Eight implemented additions and their independent checks |
| Privacy and ethics | Consent/manual location, local group profiles/packs, no model coordinates/raw query, uncertainty and strict unknown handling |
| Completeness | Source/build archives, public app, desktop artifact, presentation, video preparation and explicit outstanding upload/rules gates |

Before irreversible submission, the operator must confirm the exact cutoff/timezone, eligibility, pre-event coding/reuse and AI disclosure rules, and final form fields. No contest form or organizer message has been sent.
