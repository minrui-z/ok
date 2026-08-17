import type { PlaceStatus } from "./place-status";

export const tripDestinations = ["boston", "salem", "newport", "concord"] as const;

export type TripDestination = (typeof tripDestinations)[number];

export const destinationDetails: Record<TripDestination, { label: string; coordinates: [number, number] }> = {
  boston: { label: "Boston", coordinates: [42.3601, -71.0589] },
  salem: { label: "Salem", coordinates: [42.5215, -70.8967] },
  newport: { label: "Newport", coordinates: [41.4901, -71.3128] },
  concord: { label: "Concord", coordinates: [42.4604, -71.3489] },
};

const destinationDates: Partial<Record<string, TripDestination>> = {
  "2026-09-06": "salem",
  "2026-09-08": "newport",
  "2026-09-09": "concord",
};

export function destinationForDate(date: string): TripDestination {
  return destinationDates[date] ?? "boston";
}

export type DailyForecast = {
  date: string;
  weatherCode: number;
  maxC: number;
  minC: number;
  rainChance: number;
};

export type ActivePeriod = {
  start: string | null;
  end: string | null;
};

export type TransitAlert = {
  id: string;
  title: string;
  description: string | null;
  effect: string;
  effectCode: string;
  serviceEffect: string | null;
  severity: number;
  routeIds: string[];
  activePeriods: ActivePeriod[];
  lifecycle: string | null;
  timeframe: string | null;
  updatedAt: string | null;
  url: string | null;
};

export type NwsSeverity = "Extreme" | "Severe" | "Moderate" | "Minor" | "Unknown";

export type NwsAlert = {
  id: string;
  destination: TripDestination;
  event: string;
  headline: string;
  severity: NwsSeverity;
  urgency: string;
  certainty: string;
  area: string;
  description: string;
  instruction: string | null;
  startsAt: string | null;
  endsAt: string | null;
  updatedAt: string | null;
  source: string;
};

export type MlbGame = {
  gamePk: number;
  gameDate: string | null;
  status: string;
  abstractState: string;
  away: string;
  home: string;
};

export type SourceCheck = {
  ok: boolean;
  source: string;
  checkedAt: string;
  error: string | null;
};

export type WeatherSourceStatus = SourceCheck & { days: DailyForecast[] };
export type WeatherAlertSourceStatus = SourceCheck & { alerts: NwsAlert[] };
export type TransitSourceStatus = SourceCheck & { alerts: TransitAlert[] };
export type BaseballSourceStatus = SourceCheck & { game: MlbGame | null };

export type UrgentAlertLevel = "critical" | "warning" | "info";
export type UrgentAlertKind = "weather" | "transit" | "baseball" | "place" | "source";
export type UrgentAlertPreference = "weather" | "transit" | "baseball" | "places" | null;

export type UrgentAlert = {
  id: string;
  fingerprint: string;
  kind: UrgentAlertKind;
  preference: UrgentAlertPreference;
  level: UrgentAlertLevel;
  title: string;
  detail: string;
  source: string;
  sourceLabel: string;
  checkedAt: string;
  updatedAt: string | null;
  destinations: TripDestination[];
  date: string | null;
  notify: boolean;
};

export type TripStatusPayload = {
  checkedAt: string;
  weather: Record<TripDestination, WeatherSourceStatus>;
  weatherAlerts: Record<TripDestination, WeatherAlertSourceStatus>;
  transit: TransitSourceStatus;
  baseball: BaseballSourceStatus;
  places: { checkedAt: string; items: PlaceStatus[] };
  urgentAlerts: UrgentAlert[];
};

export type StatusSourceFailure = {
  id: string;
  title: string;
  source: string;
  preference: UrgentAlertPreference;
  destination?: TripDestination;
  destinations?: TripDestination[];
  date?: string;
};

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : null;
}

function textValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function dateValue(value: unknown) {
  const valueText = textValue(value);
  return valueText && !Number.isNaN(Date.parse(valueText)) ? valueText : null;
}

function finiteNumber(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeNwsSeverity(value: unknown): NwsSeverity {
  const severity = textValue(value);
  return severity === "Extreme" || severity === "Severe" || severity === "Moderate" || severity === "Minor"
    ? severity
    : "Unknown";
}

export function weatherLabel(code: number) {
  if (code === 0) return "晴朗";
  if (code <= 3) return "多雲";
  if (code === 45 || code === 48) return "有霧";
  if (code <= 57) return "毛毛雨";
  if (code <= 67) return "有雨";
  if (code <= 77) return "降雪";
  if (code <= 82) return "陣雨";
  if (code <= 86) return "陣雪";
  if (code >= 95) return "雷雨";
  return "天氣待確認";
}

export function parseWeather(payload: JsonRecord): DailyForecast[] {
  const daily = record(payload.daily);
  const dates = Array.isArray(daily?.time) ? daily.time : [];
  const codes = Array.isArray(daily?.weather_code) ? daily.weather_code : [];
  const max = Array.isArray(daily?.temperature_2m_max) ? daily.temperature_2m_max : [];
  const min = Array.isArray(daily?.temperature_2m_min) ? daily.temperature_2m_min : [];
  const rain = Array.isArray(daily?.precipitation_probability_max) ? daily.precipitation_probability_max : [];

  return dates.flatMap((date, index) => {
    if (typeof date !== "string") return [];
    return [{
      date,
      weatherCode: finiteNumber(codes[index], -1),
      maxC: Math.round(finiteNumber(max[index])),
      minC: Math.round(finiteNumber(min[index])),
      rainChance: Math.round(finiteNumber(rain[index])),
    }];
  });
}

function routeIdsForAlert(item: JsonRecord, attributes: JsonRecord) {
  const ids = new Set<string>();
  const informedEntities = Array.isArray(attributes.informed_entity) ? attributes.informed_entity : [];
  informedEntities.forEach((entity) => {
    const entityRecord = record(entity);
    const id = textValue(entityRecord?.route) ?? textValue(entityRecord?.route_id);
    if (id) ids.add(id);
  });

  const relationships = record(item.relationships);
  const routeRelationship = record(relationships?.route);
  const routeData = routeRelationship?.data;
  const routeRecords = Array.isArray(routeData) ? routeData : routeData ? [routeData] : [];
  routeRecords.forEach((route) => {
    const id = textValue(record(route)?.id);
    if (id) ids.add(id);
  });
  return [...ids];
}

function activePeriodsForAlert(attributes: JsonRecord): ActivePeriod[] {
  const periods = Array.isArray(attributes.active_period) ? attributes.active_period : [];
  return periods.flatMap((period) => {
    const periodRecord = record(period);
    if (!periodRecord) return [];
    return [{ start: dateValue(periodRecord.start), end: dateValue(periodRecord.end) }];
  });
}

export function parseMbtaAlerts(payload: JsonRecord): TransitAlert[] {
  const data = Array.isArray(payload.data) ? payload.data : [];
  return data.flatMap((item) => {
    const itemRecord = record(item);
    const attributes = record(itemRecord?.attributes);
    if (!itemRecord || !attributes) return [];
    const id = textValue(itemRecord.id);
    const title = textValue(attributes.short_header) ?? textValue(attributes.header);
    if (!id || !title) return [];
    const effectCode = (textValue(attributes.effect) ?? "UNKNOWN_EFFECT").toUpperCase();
    return [{
      id,
      title,
      description: textValue(attributes.description),
      effect: effectCode.replaceAll("_", " ").toLocaleLowerCase(),
      effectCode,
      serviceEffect: textValue(attributes.service_effect),
      severity: finiteNumber(attributes.severity),
      routeIds: routeIdsForAlert(itemRecord, attributes),
      activePeriods: activePeriodsForAlert(attributes),
      lifecycle: textValue(attributes.lifecycle),
      timeframe: textValue(attributes.timeframe),
      updatedAt: dateValue(attributes.updated_at) ?? dateValue(attributes.last_push_notification_timestamp),
      url: textValue(attributes.url),
    }];
  }).sort((left, right) => right.severity - left.severity).slice(0, 12);
}

export function parseNwsAlerts(payload: JsonRecord, destination: TripDestination): NwsAlert[] {
  const features = Array.isArray(payload.features) ? payload.features : [];
  return features.flatMap((feature) => {
    const featureRecord = record(feature);
    const properties = record(featureRecord?.properties);
    if (!featureRecord || !properties) return [];
    const source = textValue(featureRecord.id) ?? textValue(properties["@id"]);
    const event = textValue(properties.event);
    if (!source || !event) return [];
    return [{
      id: source,
      destination,
      event,
      headline: textValue(properties.headline) ?? event,
      severity: normalizeNwsSeverity(properties.severity),
      urgency: textValue(properties.urgency) ?? "Unknown",
      certainty: textValue(properties.certainty) ?? "Unknown",
      area: textValue(properties.areaDesc) ?? destinationDetails[destination].label,
      description: textValue(properties.description) ?? "請查看 NWS 官方警報內容。",
      instruction: textValue(properties.instruction),
      startsAt: dateValue(properties.onset) ?? dateValue(properties.effective),
      endsAt: dateValue(properties.ends) ?? dateValue(properties.expires),
      updatedAt: dateValue(properties.sent) ?? dateValue(properties.effective),
      source,
    }];
  });
}

export function parseMlbGame(payload: JsonRecord): MlbGame | null {
  const dates = Array.isArray(payload.dates) ? payload.dates : [];
  const firstDate = record(dates[0]);
  const games = Array.isArray(firstDate?.games) ? firstDate.games : [];
  const game = record(games[0]);
  if (!game) return null;
  const status = record(game.status);
  const teams = record(game.teams);
  const away = record(record(teams?.away)?.team);
  const home = record(record(teams?.home)?.team);
  return {
    gamePk: finiteNumber(game.gamePk),
    gameDate: dateValue(game.gameDate),
    status: textValue(status?.detailedState) ?? "待確認",
    abstractState: textValue(status?.abstractGameState) ?? "Preview",
    away: textValue(away?.name) ?? "Seattle Mariners",
    home: textValue(home?.name) ?? "Boston Red Sox",
  };
}

function fingerprint(parts: Array<string | number | null | undefined>) {
  return parts.map((part) => String(part ?? "")).join("|");
}

function transitLevel(alert: TransitAlert): UrgentAlertLevel | null {
  if (["NO_SERVICE", "SUSPENSION", "SHUTTLE", "STATION_CLOSURE", "STOP_CLOSURE"].includes(alert.effectCode) || alert.severity >= 8) return "critical";
  if (["DELAY", "DETOUR", "SERVICE_CHANGE", "TRACK_CHANGE", "ACCESS_ISSUE"].includes(alert.effectCode) || alert.severity >= 4) return "warning";
  return null;
}

function nwsLevel(alert: NwsAlert): UrgentAlertLevel {
  if (alert.severity === "Extreme" || alert.severity === "Severe") return "critical";
  if (alert.severity === "Moderate" || alert.severity === "Minor") return "warning";
  return "info";
}

function destinationList(alerts: NwsAlert[]) {
  return [...new Set(alerts.map((alert) => alert.destination))];
}

export function buildUrgentAlerts(input: {
  checkedAt: string;
  weatherAlerts: NwsAlert[];
  transitAlerts: TransitAlert[];
  game: MlbGame | null;
  places: PlaceStatus[];
  sourceFailures?: StatusSourceFailure[];
}): UrgentAlert[] {
  const alerts: UrgentAlert[] = [];
  const groupedWeather = new Map<string, NwsAlert[]>();
  input.weatherAlerts.forEach((alert) => groupedWeather.set(alert.id, [...(groupedWeather.get(alert.id) ?? []), alert]));

  groupedWeather.forEach((matches, id) => {
    const alert = matches[0];
    const level = nwsLevel(alert);
    alerts.push({
      id: `nws:${id}`,
      fingerprint: fingerprint(["nws", id, alert.updatedAt, alert.severity, alert.headline]),
      kind: "weather",
      preference: "weather",
      level,
      title: alert.headline,
      detail: `${alert.area} · ${alert.event}`,
      source: alert.source,
      sourceLabel: "NWS 官方警報",
      checkedAt: input.checkedAt,
      updatedAt: alert.updatedAt,
      destinations: destinationList(matches),
      date: null,
      notify: level !== "info",
    });
  });

  input.transitAlerts.forEach((alert) => {
    const level = transitLevel(alert);
    if (!level) return;
    const routeLabel = alert.routeIds.length ? alert.routeIds.join("、") : "行程相關路線";
    alerts.push({
      id: `mbta:${alert.id}`,
      fingerprint: fingerprint(["mbta", alert.id, alert.updatedAt, alert.effectCode, alert.title]),
      kind: "transit",
      preference: "transit",
      level,
      title: `MBTA ${routeLabel}`,
      detail: alert.title,
      source: alert.url ?? "https://www.mbta.com/alerts",
      sourceLabel: "MBTA 官方公告",
      checkedAt: input.checkedAt,
      updatedAt: alert.updatedAt,
      destinations: ["boston", "salem"],
      date: null,
      notify: true,
    });
  });

  const game = input.game;
  if (game && /(delay|postpon|cancel|suspend|resched)/i.test(game.status)) {
    alerts.push({
      id: `mlb:${game.gamePk}`,
      fingerprint: fingerprint(["mlb", game.gamePk, game.status, game.gameDate]),
      kind: "baseball",
      preference: "baseball",
      level: /cancel|postpon|suspend/i.test(game.status) ? "critical" : "warning",
      title: `Red Sox：${game.status}`,
      detail: `${game.away} @ ${game.home}`,
      source: game.gamePk ? `https://www.mlb.com/gameday/${game.gamePk}` : "https://www.mlb.com/redsox/schedule/2026-09",
      sourceLabel: "MLB 官方賽程",
      checkedAt: input.checkedAt,
      updatedAt: game.gameDate,
      destinations: ["boston"],
      date: "2026-09-02",
      notify: true,
    });
  }

  input.places.filter((place) => place.state === "official-exception").forEach((place) => {
    const blocking = place.impact === "blocking";
    alerts.push({
      id: `place:${place.id}`,
      fingerprint: fingerprint(["place", place.id, place.state, place.summary, place.curatedAt]),
      kind: "place",
      preference: "places",
      level: blocking ? "critical" : "info",
      title: place.name,
      detail: place.summary,
      source: place.source,
      sourceLabel: place.sourceLabel,
      checkedAt: place.checkedAt,
      updatedAt: `${place.curatedAt}T00:00:00-04:00`,
      destinations: [place.destination],
      date: place.date,
      notify: blocking,
    });
  });

  input.sourceFailures?.forEach((failure) => {
    alerts.push({
      id: `source:${failure.id}`,
      fingerprint: fingerprint(["source", failure.id, input.checkedAt]),
      kind: "source",
      preference: failure.preference,
      level: "warning",
      title: failure.title,
      detail: "這次更新沒有取得資料，狀態不能視為正常；請直接查看官方來源。",
      source: failure.source,
      sourceLabel: "官方資料來源",
      checkedAt: input.checkedAt,
      updatedAt: null,
      destinations: failure.destinations ?? (failure.destination ? [failure.destination] : []),
      date: failure.date ?? null,
      notify: false,
    });
  });

  const levelOrder: Record<UrgentAlertLevel, number> = { critical: 0, warning: 1, info: 2 };
  return alerts.sort((left, right) => levelOrder[left.level] - levelOrder[right.level] || (right.updatedAt ?? "").localeCompare(left.updatedAt ?? ""));
}
