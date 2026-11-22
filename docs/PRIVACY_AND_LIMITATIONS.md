# Privacy, evidence and limitations

Manual location is the default. GPS is requested only after an explicit click, with nearby disclosure. There is no account, background tracking, ad analytics or persistent location history. Exact coordinates are sent ephemerally to the server and routing provider when needed. Map providers can see the viewport. External providers and hosts may retain their own logs; the app cannot promise their deletion. Application code does not log request bodies, precise coordinates or persistent IPs.

The model receives public POI facts and typed preferences, without raw query text or exact coordinates. Group preference profiles stay in browser memory by default and are evaluated with the shared local planner. Individual scores are preference matches, never probabilities of satisfaction.

Saved packs are explicit, stored in IndexedDB in web/desktop. Native save/open uses user-selected files. A custom location requires explicit inclusion consent before export. Default exports use a named public starting area. Clear saved data removes app-owned IndexedDB/cache data and native files in the application's managed packs folder. User-exported copies outside that folder are under the user's control.

OSM data is community-maintained and can be stale, wrong or incomplete. A new retrieved_at date means downloaded then, not verified then. Source_updated_at reflects upstream edits where available. Unknown hours, prices, sockets, quietness, indoor status, child suitability and accessibility stay unknown. No ratings or reviews are generated. Contradictory field states block strict availability rather than selecting a convenient value. Snapshot hashes prove integrity only.

3,801 collected ways do not prove a safe or step-free route. Snapping from a venue center can leave a substantial unverified connector. The UI makes those plans conditional. Sidewalk surface, ice, crossings, shelter, wind at a building and current closures are not verified. Visit durations and local walking speed are product estimates. Neither source schedules nor forecasts guarantee access, arrival or safety. No airport excursion is suggested from a flight departure time alone.

Forecasts are Open-Meteo estimates at the fixed public Astana city grid. The client can request that same grid directly if QALA's weather endpoint fails. Open-Meteo can see normal connection metadata, and the request includes neither a visitor's location nor preferences. Free endpoint use is non-commercial. If both paths fail, manual comfort choices are labeled simulation. Scenario closures and judge imports are isolated, visibly simulated and unverified.

The renderer escapes imported text. Imports are restricted by schema, fields, coordinates, row count and bytes. Markup/formula-like content is rejected. Sources and query text never become model instructions. No arbitrary URL fetching is exposed. Electron has Node integration disabled, context isolation and sandboxing enabled, narrow validated IPC, navigation restrictions and a CSP. The Windows build is unsigned.

Current quality limits: cafe-heavy data, incomplete entrance/indoor evidence, a bounded network, generic controlled-generation wording, unreviewed Kazakh prose and no field/user study. A finite passing suite is not a universal accuracy or accessibility certification. Actual billing cost has not been measured.
