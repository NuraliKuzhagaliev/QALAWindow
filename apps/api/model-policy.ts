const minuteCalls: number[] = [];
let active = 0,
  cooldownUntil = 0;
const outputs = new Map<string, { at: number; value: unknown }>();
export const modelUsage = {
  calls: 0,
  cacheHits: 0,
  failures: 0,
  inputTokens: 0,
  outputTokens: 0,
};
export const cacheKey = (value: unknown) => JSON.stringify(value);
export function cachedOutput(key: string) {
  const entry = outputs.get(key);
  if (entry && Date.now() - entry.at < 15 * 60000) {
    modelUsage.cacheHits++;
    return entry.value;
  }
  return null;
}
export function saveOutput(key: string, value: unknown) {
  if (outputs.size > 200) outputs.delete(outputs.keys().next().value!);
  outputs.set(key, { at: Date.now(), value });
}
const pacificClock = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Los_Angeles",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  hourCycle: "h23",
});
export function nextGeminiDailyReset(now: number) {
  const parts = pacificClock.formatToParts(now);
  const field = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  const midnightDuringDaylightTime = Date.UTC(
    field("year"),
    field("month") - 1,
    field("day") + 1,
    7,
  );
  const pacificHour = pacificClock
    .formatToParts(midnightDuringDaylightTime)
    .find((part) => part.type === "hour")?.value;
  return Number(pacificHour) === 0
    ? midnightDuringDaylightTime
    : midnightDuringDaylightTime + 60 * 60_000;
}

export async function modelFetch(
  url: string,
  options: RequestInit,
  provider: string,
) {
  const now = Date.now();
  while (minuteCalls.length && minuteCalls[0] < now - 60000)
    minuteCalls.shift();
  if (now < cooldownUntil)
    throw new Error(
      "Model quota cooldown active. Use validated facts and retry after reset.",
    );
  if (minuteCalls.length >= 12 || active >= 2)
    throw new Error(
      "Model request capacity reached. Validated facts remain available.",
    );
  minuteCalls.push(now);
  active++;
  modelUsage.calls++;
  try {
    const response = await fetch(url, {
      ...options,
      signal: AbortSignal.timeout(15000),
    });
    if (response.status === 429) {
      const raw = await response.clone().text();
      const daily = /per.?day|daily|requestsperday|quota.*day/i.test(raw);
      const failedAt = Date.now();
      const retryAfter = response.headers.get("retry-after");
      const retryMs = !retryAfter
        ? 0
        : /^\d+$/.test(retryAfter)
          ? Number(retryAfter) * 1000
          : Date.parse(retryAfter) - failedAt;
      const minimum =
        failedAt + Math.max(60_000, Number.isFinite(retryMs) ? retryMs : 0);
      cooldownUntil = daily
        ? Math.max(
            minimum,
            provider === "gemini"
              ? nextGeminiDailyReset(failedAt)
              : failedAt + 86_400_000,
          )
        : minimum;
      modelUsage.failures++;
    }
    return response;
  } catch (e) {
    modelUsage.failures++;
    throw new Error("Model network timeout or connection failure", {
      cause: e,
    });
  } finally {
    active--;
  }
}
