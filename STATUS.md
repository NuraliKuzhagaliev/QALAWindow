# Status

QALA Window 0.1.2 uses the 21 November 2026 OpenStreetMap snapshot and the Windows platform location service. The Windows permission flow was verified with a simulated device position. Physical GPS depends on permission and device signals.

The [public GitHub Pages site](https://nuralikuzhagaliev.github.io/QALAWindow/) replaces the earlier Sites deployment. It opens without signing in. The [public GitHub repository](https://github.com/NuraliKuzhagaliev/QALAWindow) contains source code, tests, documentation and OSM data. The [v0.1.2 release](https://github.com/NuraliKuzhagaliev/QALAWindow/releases/tag/v0.1.2) contains the Windows executable, checksum, static web archive and demo.

The Pages edition uses the local planner and the free Open-Meteo forecast. An anonymous browser rendered a three-stop plan and weather from the published site without making an application API request. [GitHub Pages deployment](tests/evidence/github-pages-0.1.2.json) · [Anonymous browser check](tests/evidence/static-web-0.1.2-public.json)

The full Windows download from the public Desktop panel matched the published SHA256 and the checksum of the local release. [Download verification](tests/evidence/download-0.1.2-public.json)

See [0.1.2 verification](docs/RELEASE_0.1.2.md), [0.1.1 verification](docs/RELEASE_0.1.1.md), and [the original audit](AUDIT_REPORT.md).
