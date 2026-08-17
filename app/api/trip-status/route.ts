import { getPlaceStatuses } from "../../place-status";
import type { TripDay } from "../../trip-data";
import { getD1 } from "../../../db/index";
import { documentFromVersion, latestItineraryVersion } from "../itinerary/_store";
import {
  buildUrgentAlerts,
  destinationDetails,
  parseMbtaAlerts,
  parseMlbGame,
  parseNwsAlerts,
  parseWeather,
  tripDestinations,
  type BaseballSourceStatus,
  type StatusSourceFailure,
  type TransitSourceStatus,
  type TripDestination,
  type TripStatusPayload,
  type WeatherAlertSourceStatus,
  type WeatherSourceStatus,
} from "../../status-utils";

const sources = {
  weather: "https://open-meteo.com/en/docs",
  nws: "https://www.weather.gov/documentation/services-web-api",
  mbta: "https://www.mbta.com/alerts",
  baseball: "https://www.mlb.com/redsox/schedule/2026-09",
};

const relevantMbtaRoutes = ["Green-B", "Green-C", "Green-D", "Green-E", "Orange", "CR-Newburyport"];

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : null;
}

async function readJson(url: string, headers: HeadersInit = {}) {
  const response = await fetch(url, { headers: { accept: "application/json", ...headers } });
  if (!response.ok) throw new Error(`Upstream returned ${response.status}`);
  return await response.json() as JsonRecord;
}

function requireArray(payload: JsonRecord, field: string) {
  if (!Array.isArray(payload[field])) throw new Error(`Upstream payload is missing ${field}`);
}

function requireWeather(payload: JsonRecord) {
  const daily = asRecord(payload.daily);
  if (!daily || !Array.isArray(daily.time)) throw new Error("Weather payload is missing daily.time");
}

function weatherUrl(destination: TripDestination) {
  const [latitude, longitude] = destinationDetails[destination].coordinates;
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
    timezone: "America/New_York",
    forecast_days: "16",
  });
  return `https://api.open-meteo.com/v1/forecast?${params}`;
}

function nwsUrl(destination: TripDestination) {
  const [latitude, longitude] = destinationDetails[destination].coordinates;
  return `https://api.weather.gov/alerts/active?point=${latitude.toFixed(4)},${longitude.toFixed(4)}`;
}

function mbtaUrl() {
  const params = new URLSearchParams({
    "filter[route]": relevantMbtaRoutes.join(","),
    "filter[datetime]": "NOW",
    sort: "-severity",
  });
  return `https://api-v3.mbta.com/alerts?${params}`;
}

function failedWeather(checkedAt: string): WeatherSourceStatus {
  return { ok: false, source: sources.weather, checkedAt, error: "天氣預報來源暫時無法讀取。", days: [] };
}

function failedNws(checkedAt: string): WeatherAlertSourceStatus {
  return { ok: false, source: sources.nws, checkedAt, error: "NWS 官方警報暫時無法讀取。", alerts: [] };
}

export async function GET() {
  const checkedAt = new Date().toISOString();
  let itineraryDays: TripDay[] | undefined;
  try {
    const itinerary = await latestItineraryVersion(getD1());
    itineraryDays = documentFromVersion(itinerary).days;
  } catch {
    // Live source checks still work if itinerary storage is temporarily unavailable.
  }

  const weatherRequests = tripDestinations.map((destination) => readJson(weatherUrl(destination)).then((payload) => {
    requireWeather(payload);
    return parseWeather(payload);
  }));

  // NWS requires a descriptive User-Agent. The project URL gives the agency a stable app identity.
  // https://www.weather.gov/documentation/services-web-api
  const nwsRequests = tripDestinations.map((destination) => readJson(nwsUrl(destination), {
    accept: "application/geo+json",
    "user-agent": "BostonAPSA2026/1.0 (https://boston-apsa-2026.mingzran.chatgpt.site/)",
  }).then((payload) => {
    requireArray(payload, "features");
    return parseNwsAlerts(payload, destination);
  }));

  // Route filtering keeps unrelated system notices out of the trip alert feed.
  // https://api-v3.mbta.com/docs/swagger/swagger.json
  const transitRequest = readJson(mbtaUrl()).then((payload) => {
    requireArray(payload, "data");
    return parseMbtaAlerts(payload);
  });
  const baseballRequest = readJson("https://statsapi.mlb.com/api/v1/schedule?sportId=1&teamId=111&date=2026-09-02").then((payload) => {
    requireArray(payload, "dates");
    return parseMlbGame(payload);
  });

  const [weatherResults, nwsResults, transitResult, baseballResult] = await Promise.all([
    Promise.allSettled(weatherRequests),
    Promise.allSettled(nwsRequests),
    Promise.resolve(transitRequest).then(
      (value) => ({ status: "fulfilled", value }) as const,
      (reason) => ({ status: "rejected", reason }) as const,
    ),
    Promise.resolve(baseballRequest).then(
      (value) => ({ status: "fulfilled", value }) as const,
      (reason) => ({ status: "rejected", reason }) as const,
    ),
  ]);

  const weather = {} as Record<TripDestination, WeatherSourceStatus>;
  const weatherAlerts = {} as Record<TripDestination, WeatherAlertSourceStatus>;
  const sourceFailures: StatusSourceFailure[] = [];

  tripDestinations.forEach((destination, index) => {
    const weatherResult = weatherResults[index];
    if (weatherResult.status === "fulfilled") {
      weather[destination] = { ok: true, source: sources.weather, checkedAt, error: null, days: weatherResult.value };
    } else {
      weather[destination] = failedWeather(checkedAt);
      sourceFailures.push({
        id: `weather-${destination}`,
        title: `${destinationDetails[destination].label} 天氣預報未更新`,
        source: sources.weather,
        preference: "weather",
        destination,
      });
    }

    const nwsResult = nwsResults[index];
    if (nwsResult.status === "fulfilled") {
      weatherAlerts[destination] = { ok: true, source: sources.nws, checkedAt, error: null, alerts: nwsResult.value };
    } else {
      weatherAlerts[destination] = failedNws(checkedAt);
      sourceFailures.push({
        id: `nws-${destination}`,
        title: `${destinationDetails[destination].label} 官方天氣警報未更新`,
        source: sources.nws,
        preference: "weather",
        destination,
      });
    }
  });

  const transit: TransitSourceStatus = transitResult.status === "fulfilled"
    ? { ok: true, source: sources.mbta, checkedAt, error: null, alerts: transitResult.value }
    : { ok: false, source: sources.mbta, checkedAt, error: "MBTA 官方公告暫時無法讀取。", alerts: [] };
  if (!transit.ok) sourceFailures.push({
    id: "mbta",
    title: "MBTA 相關路線公告未更新",
    source: sources.mbta,
    preference: "transit",
    destinations: ["boston", "salem"],
  });

  const baseball: BaseballSourceStatus = baseballResult.status === "fulfilled"
    ? { ok: true, source: sources.baseball, checkedAt, error: null, game: baseballResult.value }
    : { ok: false, source: sources.baseball, checkedAt, error: "MLB 官方賽程暫時無法讀取。", game: null };
  if (!baseball.ok) sourceFailures.push({
    id: "mlb-red-sox",
    title: "Red Sox 官方賽程未更新",
    source: sources.baseball,
    preference: "baseball",
    destination: "boston",
    date: "2026-09-02",
  });

  const places = getPlaceStatuses(checkedAt, itineraryDays);
  const payload: TripStatusPayload = {
    checkedAt,
    weather,
    weatherAlerts,
    transit,
    baseball,
    places: { checkedAt, items: places },
    urgentAlerts: buildUrgentAlerts({
      checkedAt,
      weatherAlerts: tripDestinations.flatMap((destination) => weatherAlerts[destination].alerts),
      transitAlerts: transit.alerts,
      game: baseball.game,
      places,
      sourceFailures,
    }),
  };

  return Response.json(payload, {
    headers: { "cache-control": "public, max-age=300, stale-while-revalidate=300" },
  });
}
