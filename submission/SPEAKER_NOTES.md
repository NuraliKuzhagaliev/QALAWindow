# QALA Window · 6:30 speaker notes

## 1. An hour in Astana. A plan you can inspect. (35s)

0:00-0:35. You have an hour. A list of attractions is not yet a usable hour. QALA is for residents, students, visitors and small groups between commitments. It connects a short time window with nearby actions, a return calculation and visible evidence. This is the Smart City case, not CampusPulse. Source: official brief pages 1-3, locally preserved in docs/source/official-brief.pdf.

## 2. A real route, with visible limits (90s)

0:35-2:05. Switch to the actual running app. Enter a fresh Expo-area query, select 45 or 60 minutes, choose an explicit Astana start/deadline and run it. Show the facts-ready state followed by the actual model mode. Explain the ribbon, visit estimates and return leg. Do not call conditional access established. The screenshot is actual collected-network geometry, not an invented navigation illustration. Dataset: data/snapshots/pois.json and network.json. Actual source-backed timings differ by selected request.

## 3. A changed condition changes the plan (60s)

2:05-3:05. Open an evidence receipt. Point out retrieved_at versus source_updated_at, source facts versus calculations and generated activity. Simulate a closure in the judge desk, clearly leaving SIMULATION visible. Recompute. Then use Plan B to reduce outdoor minutes. Explain removed/added stops and slack. Zero is a useful answer when no alternative can establish the constraints. Weather is a forecast, never sidewalk or shelter evidence. Source: actual receipt fields, planner trace and docs/RAG.md.

## 4. Everyone’s hard needs still count (40s)

3:05-3:45. Select three people with mixed interests. Individual profiles are evaluated locally. Max-min preference match precedes total match; scores are not probabilities of happiness. Toggle one person's strict step-free requirement and show the honest no-result path when route accessibility is unknown. Switch EN/RU/KZ; IDs, numbers and uncertainty retain their meaning. Kazakh native-speaker review is pending. Controlled comparison H14 is synthetic and is labeled as such.

## 5. A walk worth keeping (35s)

3:45-4:20. Open the packaged Windows app. Save a .qala.json file with the native dialog, restart and reopen the saved route offline. The executable bundles the local renderer, fonts, POIs and network. Show last-synced/stale state. No new live-AI claim is made offline. Run this segment only after the exact release artifact's native test passes; otherwise state that verification is pending. Source: Windows artifact evidence and offline tests in tests/evidence.

## 6. Retrieval supplies facts. Code checks the window. (25s)

4:20-4:45. Automatic OSM collection preserves element IDs, tags and timestamps. Multilingual lexical retrieval finds a bounded candidate set. Code checks schedules, full route legs, constraints and one buffer. Gemini chooses concise approved explanations and activity ideas. ID/schema/claim validation blocks additions. Local fallback is labeled. There is no claim that a language model calculates safe arrival or that a vector database is necessary. Sources: scripts/data, packages/retrieval, packages/planner and apps/api.

## 7. Measured evidence, with denominators (25s)

4:45-5:10. 120 accepted POIs from 631 source records; 57 lack hours. 3,801 network ways. 48 development plus 24 frozen holdout behavior cases passed, with a separate auxiliary evidence-writing test. Six real Gemini quality calls passed source/ID/time invariants, using 1,680 input and 538 output tokens. Generation-only latency was 0.83-1.31 seconds. Initial browser facts-ready latency was 14.6-15.6 seconds because hosted routing timed out; show the final local/production measurements separately if available. Actual billing cost was not measured. Sources: DATA_AUDIT.json, deterministic.tap, holdout.json, live-quality.json and browser-smoke.json.

## 8. A focused pilot is the business hypothesis (40s)

5:10-5:50. The demo is free for residents. Hotel/university visitor desks and tourism teams are possible pilot buyers, not existing partners. Test five to eight real users and two buyer conversations before claiming demand. Location is manual first, group preferences stay local and saved plans are explicit. Risks: community data freshness, unverified entrances/routes, provider availability, generic controlled wording and unsigned Windows packaging. Sponsorship could never override constraints. No adoption, revenue or partnership is claimed. Sources: docs/PRODUCT.md and PRIVACY_AND_LIMITATIONS.md.

## 9. Your query is the next test. (40s)

5:50-6:30. Invite one independent judge query or constraint, using the same production planner path. Show the custom import route if helpful, with unverified/simulation labels. Roadmap: verify entrances and opening evidence, improve cultural coverage, review Kazakh, field-test routes, then a focused pilot. Submission links and remaining verification live in SUBMISSION_CHECKLIST.md. Do not claim an uploaded YouTube demo, confirmed cutoff or public URL before verification. Do not submit forms or publish video without the operator's authorization.