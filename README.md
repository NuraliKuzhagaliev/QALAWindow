# QALA Window

Astana, within the time you have. A shared TypeScript product for a responsive public web app and a genuine Windows application. Built for the Smart City track. No account required.

[Open QALA Window](https://nuralikuzhagaliev.github.io/QALAWindow/) · [Windows portable and SHA256](https://github.com/NuraliKuzhagaliev/QALAWindow/releases/latest)

## Run on Windows, with all writes on D:

```powershell
cd D:\projects\QALAWindow
. .\scripts\env.ps1
npm ci
npm run build
npm start
# http://127.0.0.1:8787
```

Use Node 22.23.5 or a newer supported Node release. For development, run `npm run api` and `npm run dev` in separate terminals after sourcing `scripts/env.ps1` in each. The lockfile pins npm dependencies.

`scripts/env.ps1` sets TEMP, TMP, TMPDIR, npm, pip, Electron, electron-builder, Playwright, XDG, Cargo and Rust caches to project directories on D:. `.npmrc` provides a second npm cache safeguard. Do not install before loading the environment. Preinstalled read-only runtimes on C: may be used; no project installation goes there.

Put secrets in `.env.local`, which is ignored. Never prefix a secret with `VITE_`. The server loads it privately. `MODEL_PROVIDER=gemini` and `MODEL_ID=gemini-3.5-flash-lite` are configurable. A supplied compatible provider can be configured server-side through the example environment names. No provider credential belongs in Electron or the browser.

## Main controls

Choose a source-backed landmark or manual position, set 30/45/60/90 minutes, interests and an optional query. Advanced controls expose the Astana start/deadline, return point, buffer, outdoor/continuous-walk limits, strict attributes and groups. Numbered cards and map pins correspond. Evidence receipts expose source fields and calculations. Plan B recomputes. The judge desk supports an isolated import and closure simulation. Saved `.qala.json` packs contain receipts and actual route geometry.

Default opening screen uses the current Astana time. For a repeatable daylight demonstration, explicitly set 2026-10-18 12:00-13:00 in advanced controls. This is a selected planning time, not a claim that the venue is currently open. The source schedules may be stale.

## Build and validate

```powershell
npm run lint
npm run typecheck
npm test
.\scripts\package-windows.ps1
```

Portable x64 output and its SHA256 file are in `release/windows/`. The executable is unsigned. The app bundles its renderer, fonts, POI snapshot and pedestrian network, and provides narrow native save/open operations. It runs without a separate Vite or Node installation.

See [requirements](REQUIREMENTS.md), [test scenarios](docs/TEST_SCENARIOS.md), [RAG](docs/RAG.md), [privacy and limitations](docs/PRIVACY_AND_LIMITATIONS.md), [deployment](docs/DEPLOYMENT.md), and [submission checklist](submission/SUBMISSION_CHECKLIST.md). STATUS.md is the release checkpoint and separates local evidence from external blockers.

## Data

`npm run collect` runs the automated OSM pipeline. Raw responses, query text, source timestamps, element IDs, hashes, normalized POIs and audit are retained in `data/snapshots/`. Existing downloads are reused by default; rename the raw files into a dated archive to deliberately make a fresh source run. `node scripts/sync-data.mjs` copies only distributable snapshot data into the renderer.

The current snapshot has 120 POIs selected from 204 nearby records and includes 5,403 walking ways. Its source is the Geofabrik Kazakhstan extract through 21 November 2026 at 21:20 UTC. Coverage starts near Expo/Mega Silk Way and Keruen in the Nurzhol area. See the dataset audit for the source and missing fields. Hours and route accessibility still depend on OpenStreetMap tags.

Windows uses the operating system's location service after **Use my location** is selected. Windows must permit location access for desktop apps. Manual map and landmark selection are available when the device cannot supply a position.

`npm run build:pages` builds the static web edition using the same local planner, OpenStreetMap snapshot, offline packs and Open-Meteo forecast. It links the Windows executable and SHA256 through the matching GitHub release. The Pages edition uses local explanations. The Node and Sites server adapters remain available for deployments with authorized providers.

© OpenStreetMap contributors. OSM-derived databases are available under ODbL 1.0. See DATA_SOURCES_AND_LICENSES.md and data/ODbL-NOTICE.md.
