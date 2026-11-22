# Status

QALA Window 0.1.3 uses the 21 November 2026 OpenStreetMap snapshot. On the test device, the exact Windows EXE received a real position from Windows Location Services and set it as the starting point. The evidence records the outcome only.

The public GitHub Pages site serves 0.1.3. The GitHub release contains the portable Windows executable, SHA256 file and static web archive. The demo and captions are available with 0.1.2. [Open QALA Window](https://nuralikuzhagaliev.github.io/QALAWindow/) · [Release 0.1.3](https://github.com/NuraliKuzhagaliev/QALAWindow/releases/tag/v0.1.3) · [Demo release](https://github.com/NuraliKuzhagaliev/QALAWindow/releases/tag/v0.1.2)

An anonymous browser rendered a three-stop plan and a live Open-Meteo forecast. It checked individual group preferences, mobile privacy, map attribution and fallback accessibility. The site made zero application API requests. [GitHub Pages deployment](tests/evidence/github-pages-0.1.3.json) · [Anonymous browser check](tests/evidence/static-web-0.1.3-public.json)

The full 123,019,781-byte Windows download linked from the public Desktop panel matched the published and local SHA256. The source revision passed lint, type checking, 82 deterministic tests and the Pages build in CI. [Download verification](tests/evidence/download-0.1.3-public.json) · [GitHub Actions run](https://github.com/NuraliKuzhagaliev/QALAWindow/actions/runs/45042620457)

See [0.1.3 verification](docs/RELEASE_0.1.3.md), [0.1.2 verification](docs/RELEASE_0.1.2.md), and [the original audit](AUDIT_REPORT.md).
