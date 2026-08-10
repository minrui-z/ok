export type DailyForecast = {
  date: string;
  weatherCode: number;
  maxC: number;
  minC: number;
  rainChance: number;
};

export type TransitAlert = {
  id: string;
  title: string;
  effect: string;
  severity: number;
  updatedAt: string | null;
};

type JsonRecord = Record<string, unknown>;

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
  const daily = payload.daily as JsonRecord | undefined;
  const dates = Array.isArray(daily?.time) ? daily.time : [];
  const codes = Array.isArray(daily?.weather_code) ? daily.weather_code : [];
  const max = Array.isArray(daily?.temperature_2m_max) ? daily.temperature_2m_max : [];
  const min = Array.isArray(daily?.temperature_2m_min) ? daily.temperature_2m_min : [];
  const rain = Array.isArray(daily?.precipitation_probability_max) ? daily.precipitation_probability_max : [];

  return dates.flatMap((date, index) => {
    if (typeof date !== "string") return [];
    return [{
      date,
      weatherCode: Number(codes[index] ?? -1),
      maxC: Math.round(Number(max[index] ?? 0)),
      minC: Math.round(Number(min[index] ?? 0)),
      rainChance: Math.round(Number(rain[index] ?? 0)),
    }];
  });
}

export function parseMbtaAlerts(payload: JsonRecord): TransitAlert[] {
  const data = Array.isArray(payload.data) ? payload.data : [];
  return data.flatMap((item) => {
    const record = item as JsonRecord;
    const attributes = record.attributes as JsonRecord | undefined;
    const title = attributes?.short_header ?? attributes?.header;
    if (typeof record.id !== "string" || typeof title !== "string") return [];
    return [{
      id: record.id,
      title,
      effect: typeof attributes?.effect === "string" ? attributes.effect.replaceAll("_", " ") : "服務公告",
      severity: Number(attributes?.severity ?? 0),
      updatedAt: typeof attributes?.updated_at === "string" ? attributes.updated_at : null,
    }];
  }).sort((left, right) => right.severity - left.severity).slice(0, 4);
}

export function parseMlbGame(payload: JsonRecord) {
  const dates = Array.isArray(payload.dates) ? payload.dates : [];
  const firstDate = dates[0] as JsonRecord | undefined;
  const games = Array.isArray(firstDate?.games) ? firstDate.games : [];
  const game = games[0] as JsonRecord | undefined;
  if (!game) return null;
  const status = game.status as JsonRecord | undefined;
  const teams = game.teams as JsonRecord | undefined;
  const away = (teams?.away as JsonRecord | undefined)?.team as JsonRecord | undefined;
  const home = (teams?.home as JsonRecord | undefined)?.team as JsonRecord | undefined;
  return {
    gamePk: Number(game.gamePk),
    gameDate: typeof game.gameDate === "string" ? game.gameDate : null,
    status: typeof status?.detailedState === "string" ? status.detailedState : "待確認",
    abstractState: typeof status?.abstractGameState === "string" ? status.abstractGameState : "Preview",
    away: typeof away?.name === "string" ? away.name : "Los Angeles Angels",
    home: typeof home?.name === "string" ? home.name : "Boston Red Sox",
  };
}
