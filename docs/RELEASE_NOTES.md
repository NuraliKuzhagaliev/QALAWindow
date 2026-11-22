# QALA Window 0.1.0

Built from the three supplied documents for Astana's Smart City case. Public web and Windows share the same domain schemas, retrieval, route feasibility and ranking code. The eight additional features are implemented with bounded source evidence and visible fallback modes.

The snapshot contains 120 selected POIs from 631 automatically collected records and 3,801 walking-network ways. It was collected on 18 October 2026. There are 57 missing schedules and 115 unknown entrance-access records. Neither new collection nor a source hash establishes current venue operation. Keruen is the source-backed Nurzhol start; Bayterek is an area alias.

Gemini `gemini-3.5-flash-lite` was selected after one minimal connectivity call and six actual constrained quality requests in English, Russian and Kazakh. All six preserved selected IDs and deterministic facts. Wording is concise and generic; native Kazakh review is pending. Model ID/provider are configurable. At most 12 model requests/minute and two simultaneous calls are allowed per runtime, with a 15-minute public-bundle cache and no automatic fallback/retry. Provider/account limits can still be lower or shared across runtimes. Quota dashboards and billing are not measured by the app.

HeiGIT's current foot-walking adapter is implemented, but the authorized real connectivity request timed out. Public routing explicitly uses the collected OSM graph. Speed is modeled at 1.15 m/s; larger allowed endpoint snaps make results conditional. Route crossings, entrances, stairs, traffic and physical safety have not been field-audited. Strict access remains conservative.

Validation: 48 development + 24 frozen holdout + 4 alias behavior cases, plus one evidence writer; clean lockfile install/typecheck/build; anonymous public UI/API/model test; seven browser state checks including full offline restart; actual packaged native save/open/restart; exact portable launch; finite axe screen scan; exact-value secret scan. Evidence files retain dates and raw denominators. The holdout source was formatted after its initial freeze without changing expectations; both hashes are recorded, not represented as an unchanged byte file.

The x64 portable executable is unsigned. No code-signing certificate was available; Authenticode status is checked rather than inferred from builder log wording. The application stores its own profile/cache/temp/packs on D: beside the portable executable or at QALA_DATA_DIR. On other computers the executable should remain on a drive with writable storage.

Outstanding external gates: upload the prepared demo to YouTube with explicit authorization/account access; confirm contest rules/eligibility/cutoff and submit only when authorized. Physical route/venue verification, native Kazakh editorial review and successful hosted HeiGIT access remain unverified. No universal accuracy, safety, accessibility, novelty or jury-score claim is made.
