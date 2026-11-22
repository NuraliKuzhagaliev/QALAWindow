import { openDB } from "idb";
import { validatePack, type Pack } from "../../packages/domain/imports";
const db = () =>
  openDB("qala-window", 1, {
    upgrade(database) {
      database.createObjectStore("packs", { keyPath: "saved_at" });
    },
  });
export async function saveLocal(pack: Pack) {
  const d = await db();
  await d.put("packs", pack);
}
export async function listLocal(): Promise<Pack[]> {
  const d = await db();
  return (await d.getAll("packs"))
    .map(validatePack)
    .sort((a, b) => b.saved_at.localeCompare(a.saved_at));
}
export async function deleteLocal(id: string) {
  const d = await db();
  await d.delete("packs", id);
}
export async function clearLocal() {
  const d = await db();
  try {
    await d.clear("packs");
  } finally {
    d.close();
  }
  if (window.qalaNative) {
    await window.qalaNative.clear();
    return;
  }
  if ("caches" in window)
    for (const key of await caches.keys())
      if (key.startsWith("qala-")) await caches.delete(key);
  if ("serviceWorker" in navigator)
    for (const sw of await navigator.serviceWorker.getRegistrations())
      await sw.unregister();
}
declare global {
  interface Window {
    qalaNative?: {
      save: (text: string) => Promise<boolean>;
      open: () => Promise<string | null>;
      clear: () => Promise<boolean>;
      version: string;
      apiBase: string;
    };
  }
}
