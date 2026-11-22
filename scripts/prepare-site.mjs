import {
  mkdir,
  readdir,
  readFile,
  writeFile,
  copyFile,
} from "node:fs/promises";
import path from "node:path";
import { build } from "esbuild";
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".svg": "image/svg+xml",
};
const assets = {};
async function walk(dir, relative = "") {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const r = path.posix.join(relative, e.name),
      p = path.join(dir, e.name);
    if (e.isDirectory()) await walk(p, r);
    else if (!r.startsWith("downloads/"))
      assets["/" + r] = {
        type: mime[path.extname(r)] || "application/octet-stream",
        data: (await readFile(p)).toString("base64"),
      };
  }
}
await walk("dist/client");
await writeFile(
  "apps/site/generated-assets.ts",
  `export const assets:Record<string,{type:string,data:string}>=${JSON.stringify(assets)};`,
);
const folder = "deploy/site";
await mkdir(folder + "/worker", { recursive: true });
await mkdir(folder + "/.openai", { recursive: true });
await mkdir(folder + "/scripts", { recursive: true });
try {
  await readFile(folder + "/.openai/hosting.json");
} catch {
  await writeFile(
    folder + "/.openai/hosting.json",
    JSON.stringify({ d1: null, r2: null }, null, 2),
  );
}
await build({
  entryPoints: ["apps/site/worker.ts"],
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  minify: true,
  outfile: folder + "/worker/index.js",
  legalComments: "eof",
});
await writeFile(
  folder + "/package.json",
  JSON.stringify(
    {
      name: "qala-window-hosted",
      version: "0.1.0",
      private: true,
      type: "module",
      scripts: { build: "node scripts/build.mjs" },
    },
    null,
    2,
  ),
);
await writeFile(
  folder + "/scripts/build.mjs",
  "import{mkdir,copyFile}from'node:fs/promises';await mkdir('dist/server',{recursive:true});await mkdir('dist/.openai',{recursive:true});await copyFile('worker/index.js','dist/server/index.js');await copyFile('.openai/hosting.json','dist/.openai/hosting.json');console.log('QALA Worker artifact built');\n",
);
await writeFile(
  folder + "/.gitignore",
  "dist/\n.env*\nnode_modules/\n.openai/state/\n",
);
await writeFile(
  folder + "/README.md",
  "# QALA Window hosted adapter\n\nGenerated from the shared TypeScript product in D:/projects/QALAWindow. Runtime keys are server-only environment bindings. No keys or personal source documents are included. Build: npm run build. Public OSM-derived data: ODbL 1.0, © OpenStreetMap contributors.\n",
);
await copyFile(
  "docs/DATA_SOURCES_AND_LICENSES.md",
  folder + "/DATA_SOURCES_AND_LICENSES.md",
);
console.log("Prepared sanitized Sites source; no environment files copied.");
