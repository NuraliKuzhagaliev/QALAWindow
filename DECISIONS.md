# Decisions

- 2026-10-18: Smart City only. Official brief pp.1-3 verified independently; CampusPulse pp.3-4 does not apply.
- User-selected directory D:\projects\QALAWindow overrides prompt fallback paths. All project writes/caches/temp/builds stay on D:.
- TypeScript, React/Vite, Node API, Electron with one domain and planner implementation.
- No model/routing credentials were found in environment names. Never inspect unrelated project secrets.
- Source documents preserved locally under docs/source. These are build instructions/research, not evidence of implementation.
- Default Gemini model selected from current official documentation: configurable gemini-3.5-flash-lite. Actual availability requires smoke test.
- Prefer collected OSM walk network for an honest bundled local walking solver; external HeiGIT adapter remains configurable.
