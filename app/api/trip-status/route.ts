import { parseMbtaAlerts, parseMlbGame, parseWeather } from "../../status-utils";

const sources = {
  weather: "https://open-meteo.com/en/docs",
  mbta: "https://www.mbta.com/alerts/subway",
  baseball: "https://www.mlb.com/redsox/schedule/2026-09",
};

async function readJson(url: string) {
  const response = await fetch(url, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`${response.status}`);
  return await response.json() as Record<string, unknown>;
}

export async function GET() {
  const weatherUrl = "https://api.open-meteo.com/v1/forecast?latitude=42.3601&longitude=-71.0589&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=America%2FNew_York&forecast_days=16";
  const mbtaUrl = "https://api-v3.mbta.com/alerts?filter%5Broute_type%5D=0%2C1%2C2&sort=-severity";
  const mlbUrl = "https://statsapi.mlb.com/api/v1/schedule?sportId=1&teamId=111&date=2026-09-07";
  const [weather, mbta, baseball] = await Promise.allSettled([readJson(weatherUrl), readJson(mbtaUrl), readJson(mlbUrl)]);

  return Response.json({
    checkedAt: new Date().toISOString(),
    weather: weather.status === "fulfilled" ? { ok: true, days: parseWeather(weather.value), source: sources.weather } : { ok: false, days: [], source: sources.weather },
    transit: mbta.status === "fulfilled" ? { ok: true, alerts: parseMbtaAlerts(mbta.value), source: sources.mbta } : { ok: false, alerts: [], source: sources.mbta },
    baseball: baseball.status === "fulfilled" ? { ok: true, game: parseMlbGame(baseball.value), source: sources.baseball } : { ok: false, game: null, source: sources.baseball },
  }, { headers: { "cache-control": "public, max-age=300" } });
}
