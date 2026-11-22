# Test scenarios and interpretation

The automatic suite contains 48 development cases D01-D48 and 24 frozen holdout cases H01-H24, plus one auxiliary evidence-writing test. The first executed suite passed 73 runner tests: 72 behavior cases and one evidence writer. Frozen file hash and raw TAP output are in tests/evidence. Real datasets and synthetic source/model/environment fixtures are labeled in each holdout record.

| Scenario | Input | Expected behavior |
|---|---|---|
| Expo loop | Source-backed Expo anchor, 12:00-12:45 Astana, coffee/discovery | 1-3 stops if established by the bounded routes, all return legs, dwell and buffer included; no invented facts |
| Nurzhol group | Keruen area, 3-5 individual interests | Max-min before total preference; all hard needs preserved; computation local |
| Strict access | Step-free required | Zero when entrance or route evidence is unavailable, with explicit reason; no green accessibility badge |
| Unknown sockets/quietness/free entry | Hard requirement in chips or recognized query | Unknown cannot qualify; user must explicitly relax it |
| Visit overlaps closing | Synthetic schedule ends during dwell | Exclude the visit, including overnight/date transitions |
| Weather Plan B | Shorter outdoor cap, forecast or labeled simulation | Recompute through the same solver, compare removed/added stops, walking and slack; zero is allowed if nothing fits |
| Independent judge import | Up to 30 valid JSON/CSV POIs, <=64 KB | Isolated unverified data, same planner path; malformed/extra/executable/outside-city input rejected |
| Model invalid output | Synthetic invented IDs, malformed JSON or extra factual attributes | Reject before display; keep source facts; no hidden provider switch |
| Source injection | Imported text containing instructions | Data remains data; it cannot override schemas or strict constraints |
| Airport query | Flight in two hours | Require an explicit usable landside budget/end point; no implied sightseeing excursion |
| Offline pack | Save, reload/restart, disconnect | Geometry, receipts, timestamps and obtained text survive; no new live-AI claim |

Automated numeric/source checks are distinct from semantic judgments. The live quality set is six actual Gemini calls, not 72 live tests. It used 1,680 input and 538 output tokens. All six preserved selected IDs, source fields, hours and times. The actual outputs are retained for review; controlled wording is concise but generic, and Kazakh native review remains pending. Connectivity check used one additional minimal model call. Browser integration calls are separately recorded in traces and may add to provider totals.

Initial browser result: real UI/API/retrieval/model flow, zero page exceptions, no 390px horizontal overflow, IndexedDB packs surviving reload. Initial 7 contrast nodes were fixed; the next scanned result screen had zero WCAG A/AA violations. This is a finite screen check, not full WCAG certification. A map container sizing bug was caught and corrected by actual browser inspection.

The initial browser facts-ready time was 15.6 seconds and the next was 14.6 seconds, dominated by unavailable hosted routing. This missed the performance target. A 30-minute hosted-routing cooldown and independent local-network path address repeat failures; final local and production timings must be reported separately. Gemini-only quality latency was 0.83-1.31 seconds in six requests. Cost is not measured from billing.

Native launch, exact packaged artifact, native dialogs, network loss, web service-worker cold restart, public signed-out access and video upload have separate release gates in STATUS.md. Do not infer those gates from the unit suite or screenshots.
