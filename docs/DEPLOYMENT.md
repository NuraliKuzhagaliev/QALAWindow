# Build and deployment

For the local service, use Node 22.23.5 or newer, source `scripts/env.ps1`, then run `npm ci`, `npm run build` and `npm start`. The service hosts both `dist/client` and `/api`. Set `HOST=0.0.0.0` and use the host's `PORT` for a deployment. The service uses the immutable snapshot and optional runtime keys.

All runtime secrets are server-only. `.env.local` is never copied into dist, Electron or source archives. The only optional frontend variable is VITE_PUBLIC_API_URL, a public API address. The Sites adapter uses the same Hono application/domain/planner with runtime environment bindings. Public deployment status and exact URL are recorded in STATUS.md only after a successful deployment/access check.

Model policy: configurable MODEL_PROVIDER/MODEL_ID; 12 RPM and two simultaneous model requests; appropriate public-bundle cache; no automatic model fallback; no daily-quota retry loop. No billing activation, paid hosting purchase or unlimited retries are authorized by this build.

Routing: optional HeiGIT matrix and directions with foot-walking profile, allowlisted server hostname, bounded candidates, snap checks and exact selected-leg revalidation. A provider failure activates a 30-minute cooldown. Collected OSM walking network is an explicit timestamped local source, not a fabricated live API response. Set ROUTING_PROVIDER=local-network to select it explicitly. Current hosted provider access must not be claimed successful solely because a key exists.

Run `scripts/package-windows.ps1` to build the unsigned portable x64 executable and SHA256 file in `release/windows`. User data, Chromium cache and native managed packs stay under `.desktop-data` beside the portable executable, or `QALA_DATA_DIR` if configured. The packaged renderer needs no development server.

`Regression` in GitHub Actions runs lint, type checking, deterministic tests and the Pages build on every push or pull request to `main`. Publish the EXE and checksum to the matching GitHub release before pushing the contents of the validated Pages build to `gh-pages`. Use a fresh browser session to verify the public page and follow its EXE link to compare the downloaded bytes against SHA256. To roll back the site, revert the Pages deployment commit on `gh-pages` and rerun both public checks against the prior release.

For a clean reproducibility check, use the lockfile with npm ci after loading env.ps1. Project caches may be removed only after verifying the resolved paths remain inside this project. The release archive excludes node_modules, secrets, caches, temporary profiles and personal source documents. Source documents remain locally preserved for audit.
