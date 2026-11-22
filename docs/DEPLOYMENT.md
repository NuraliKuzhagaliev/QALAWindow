# Build and deployment

Local Node service: source scripts/env.ps1, npm ci, npm run build, npm start. The service hosts both dist/client and /api. Set HOST=0.0.0.0 and PORT from the host for a deployment. A stateless deployment needs only the immutable snapshot and runtime keys. No writable hosted user database or persistent hosted filesystem is required.

All runtime secrets are server-only. `.env.local` is never copied into dist, Electron or source archives. The only optional frontend variable is VITE_PUBLIC_API_URL, a public API address. The Sites adapter uses the same Hono application/domain/planner with runtime environment bindings. Public deployment status and exact URL are recorded in STATUS.md only after a successful deployment/access check.

Model policy: configurable MODEL_PROVIDER/MODEL_ID; 12 RPM and two simultaneous model requests; appropriate public-bundle cache; no automatic model fallback; no daily-quota retry loop. No billing activation, paid hosting purchase or unlimited retries are authorized by this build.

Routing: optional HeiGIT matrix and directions with foot-walking profile, allowlisted server hostname, bounded candidates, snap checks and exact selected-leg revalidation. A provider failure activates a 30-minute cooldown. Collected OSM walking network is an explicit timestamped local source, not a fabricated live API response. Set ROUTING_PROVIDER=local-network to select it explicitly. Current hosted provider access must not be claimed successful solely because a key exists.

Windows: npm run package:win. Portable unsigned x64 artifact in release/windows, with SHA256 checksums. User data, Chromium cache and native managed packs stay under .desktop-data beside the portable executable, or QALA_DATA_DIR if explicitly configured. The renderer is packaged locally and works without dev tools. No shared provider key is bundled.

For a clean reproducibility check, use the lockfile with npm ci after loading env.ps1. Project caches may be removed only after verifying the resolved paths remain inside this project. The release archive excludes node_modules, secrets, caches, temporary profiles and personal source documents. Source documents remain locally preserved for audit.
