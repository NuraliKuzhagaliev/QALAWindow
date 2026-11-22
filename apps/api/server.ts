import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { readFile } from "node:fs/promises";
import { createApp } from "./app";
try {
  process.loadEnvFile(".env.local");
} catch {}
const snapshot = JSON.parse(await readFile("data/snapshots/pois.json", "utf8"));
const network = JSON.parse(
  await readFile("data/snapshots/network.json", "utf8"),
);
const app = createApp(snapshot, network, process.env);
const { version } = JSON.parse(await readFile("package.json", "utf8"));
const portable = `QALAWindow-${version}-Windows-x64.exe`;
for (const name of [portable, `${portable}.sha256`]) {
  app.get(
    `/downloads/${name}`,
    serveStatic({ path: `release/windows/${name}` }),
  );
  app.get(`/downloads/${name}`, (c) => c.notFound());
}
app.get("/downloads/*", (c) => c.notFound());
app.get("/data/*", serveStatic({ root: "public" }));
app.get("*", serveStatic({ root: "dist/client" }));
app.get("*", serveStatic({ path: "dist/client/index.html" }));
serve(
  {
    fetch: app.fetch,
    hostname: process.env.HOST || "127.0.0.1",
    port: Number(process.env.PORT || 8787),
  },
  (info) =>
    console.log(`QALA Window API listening on http://127.0.0.1:${info.port}`),
);
