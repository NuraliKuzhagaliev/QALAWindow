import { createApp } from "../api/app";
import snapshot from "../../data/snapshots/pois.json";
import network from "../../data/snapshots/network.json";
import type { Snapshot } from "../../packages/domain/index";
import type { Network } from "../../packages/planner/routes";
import type { ProviderConfig } from "../api/providers";
import { assets } from "./generated-assets";
const applications = new WeakMap<object, ReturnType<typeof createApp>>();
const decoded = new Map<string, Uint8Array>();
export default {
  async fetch(request: Request, env: ProviderConfig) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      let app = applications.get(env);
      if (!app) {
        app = createApp(
          snapshot as unknown as Snapshot,
          network as unknown as Network,
          env,
        );
        applications.set(env, app);
      }
      const response = await app.fetch(request);
      const headers = new Headers(response.headers);
      if (request.headers.get("Origin") === "qala://app") {
        headers.set("Access-Control-Allow-Origin", "qala://app");
        headers.set(
          "Access-Control-Allow-Headers",
          "content-type,x-qala-session",
        );
        headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
      }
      if (request.method === "OPTIONS")
        return new Response(null, { status: 204, headers });
      return new Response(response.body, { status: response.status, headers });
    }
    let name;
    try {
      name = decodeURIComponent(url.pathname);
    } catch {
      return new Response("Invalid path", { status: 400 });
    }
    if (name === "/") name = "/index.html";
    const asset = assets[name];
    if (!asset) return new Response("QALA asset unavailable", { status: 404 });
    let bytes = decoded.get(name);
    if (!bytes) {
      const raw = atob(asset.data);
      bytes = Uint8Array.from(raw, (c) => c.charCodeAt(0));
      decoded.set(name, bytes);
    }
    return new Response(bytes as BodyInit, {
      headers: {
        "Content-Type": asset.type,
        "Cache-Control": name.includes("/assets/")
          ? "public,max-age=31536000,immutable"
          : "no-cache",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
        "Content-Security-Policy":
          "default-src 'self'; script-src 'self' blob:; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; font-src 'self' https://tiles.openfreemap.org; img-src 'self' data: blob: https://tiles.openfreemap.org; connect-src 'self' https://tiles.openfreemap.org https://*.openfreemap.org https://api.open-meteo.com; object-src 'none'; base-uri 'self'; frame-src 'none'; frame-ancestors 'none'",
      },
    });
  },
};
