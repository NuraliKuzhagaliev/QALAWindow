import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const assets = await readdir("dist/client/assets");
const urls = [
  "./",
  "./index.html",
  "./data/pois.json",
  "./data/network.json",
  ...assets.map((p) => "./assets/" + p),
];
const version = createHash("sha256")
  .update(JSON.stringify(assets))
  .digest("hex")
  .slice(0, 10);
await writeFile(
  "dist/client/sw.js",
  `const NAME='qala-${version}';const URLS=${JSON.stringify(urls)};self.addEventListener('install',e=>e.waitUntil(caches.open(NAME).then(c=>c.addAll(URLS)).then(()=>self.skipWaiting())));self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('qala-')&&k!==NAME).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==self.location.origin||u.pathname.startsWith('/api/')||u.pathname.includes('/downloads/'))return;e.respondWith(fetch(e.request).catch(()=>caches.match(e.request).then(r=>r||new Response('Offline asset unavailable',{status:503}))));});`,
);
