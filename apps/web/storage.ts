import { openDB } from "idb";
import { validatePack, type Pack } from "../../packages/domain/imports";
const db = () =>
  openDB("qala-window", 1, {
    upgrade(database) {
      database.createObjectStore("packs", { keyPath: "saved_at" });
    },
  });
export async function saveLocal(pack: Pack): Promise<Pack> {
  const d = await db();
  try {
    const tx = d.transaction("packs", "readwrite");
    const stored: Pack[] = await tx.store.getAll();
    const sameRoute = stored
      .reverse()
      .find(
        (item) =>
          item.result.requestId === pack.result.requestId &&
          item.datasetVersion === pack.datasetVersion &&
          item.publicStart === pack.publicStart &&
          item.result.plan?.id === pack.result.plan?.id &&
          item.result.plan?.returnTime === pack.result.plan?.returnTime &&
          JSON.stringify(item.result.plan?.legs) ===
            JSON.stringify(pack.result.plan?.legs),
      );
    let savedAt = sameRoute?.saved_at ?? pack.saved_at;
    if (!sameRoute) {
      const occupied = new Set(stored.map((item) => item.saved_at));
      let time = Date.parse(savedAt);
      while (occupied.has(savedAt)) savedAt = new Date(++time).toISOString();
    }
    const saved =
      savedAt === pack.saved_at ? pack : { ...pack, saved_at: savedAt };
    await tx.store.put(saved);
    await tx.done;
    return saved;
  } finally {
    d.close();
  }
}
export async function listLocal(): Promise<Pack[]> {
  const d = await db();
  try {
    return (await d.getAll("packs"))
      .map(validatePack)
      .sort((a, b) => b.saved_at.localeCompare(a.saved_at));
  } finally {
    d.close();
  }
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
