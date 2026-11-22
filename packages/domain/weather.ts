import { z } from "zod";

// Use a fixed public city grid. The request never includes a planning location.
const endpoint =
  "https://api.open-meteo.com/v1/forecast?latitude=51.1&longitude=71.4&current=temperature_2m,apparent_temperature,precipitation,wind_speed_10m,wind_gusts_10m,is_day&hourly=precipitation_probability&forecast_days=1&timezone=Asia%2FAlmaty";

const current = z.looseObject({
  time: z.string().regex(/^\d{4}-\d\d-\d\dT\d\d:\d\d$/),
  temperature_2m: z.number(),
  apparent_temperature: z.number(),
  precipitation: z.number().nonnegative(),
  wind_speed_10m: z.number().nonnegative(),
});
const providerWeather = z.object({
  current,
  current_units: z.record(z.string(), z.string()),
  hourly: z.record(
    z.string(),
    z.array(z.union([z.string(), z.number(), z.null()])),
  ),
});
export const WeatherSnapshotSchema = z.object({
  current,
  units: providerWeather.shape.current_units,
  hourly: providerWeather.shape.hourly,
  retrieved_at: z.iso.datetime(),
  source: z.literal("https://open-meteo.com/"),
  license: z.literal("CC BY 4.0, non-commercial endpoint"),
  grid: z.literal("city-level 51.1,71.4"),
});
export type WeatherSnapshot = z.infer<typeof WeatherSnapshotSchema>;
export const weatherFreshMs = 15 * 60_000;

export class WeatherHttpError extends Error {
  constructor(readonly status: number) {
    super("Forecast provider returned an HTTP error");
  }
}

export async function fetchCityWeather(
  timeout: number,
): Promise<WeatherSnapshot> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(endpoint, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new WeatherHttpError(response.status);
    const data = providerWeather.parse(await response.json());
    return {
      current: data.current,
      units: data.current_units,
      hourly: data.hourly,
      retrieved_at: new Date().toISOString(),
      source: "https://open-meteo.com/",
      license: "CC BY 4.0, non-commercial endpoint",
      grid: "city-level 51.1,71.4",
    };
  } finally {
    clearTimeout(timer);
  }
}
