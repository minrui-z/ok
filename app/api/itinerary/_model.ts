import type {
  Activity,
  ActivityCategory,
  ActivityPriority,
  IconKey,
  PlacePhoto,
  TravelLeg,
  TravelMode,
  TripDay,
} from "../../trip-data";

export const ITINERARY_SCHEMA_VERSION = 1;

export type TripDocument = {
  schemaVersion: typeof ITINERARY_SCHEMA_VERSION;
  days: TripDay[];
};

export type ItineraryAction =
  | "seed"
  | "activity.create"
  | "activity.update"
  | "activity.move"
  | "activity.delete"
  | "day.update"
  | "version.restore";

export type ItineraryOperation =
  | { type: "activity.create"; dayId: string; index?: number; activity: Record<string, unknown> }
  | { type: "activity.update"; activityId: string; changes: Record<string, unknown> }
  | { type: "activity.move"; activityId: string; toDayId: string; toIndex: number }
  | { type: "activity.delete"; activityId: string; confirmImportant: boolean }
  | { type: "day.update"; dayId: string; changes: Record<string, unknown> }
  | { type: "version.restore"; version: number };

export type AppliedOperation = {
  document: TripDocument;
  action: Exclude<ItineraryAction, "seed">;
  targetId: string | null;
  sourceVersion: number | null;
  summary: string;
};

export class ItineraryInputError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "ItineraryInputError";
  }
}

const iconKeys = new Set<IconKey>([
  "plane", "bus", "train", "hotel", "food", "walk", "landmark", "talk", "car", "shop",
  "ship", "ticket", "camera", "coffee", "trophy", "store", "waves", "luggage",
]);
const categories = new Set<ActivityCategory>(["flight", "transit", "stay", "conference", "sight", "food", "shopping"]);
const priorities = new Set<ActivityPriority>(["essential", "recommended", "optional"]);
const travelModes = new Set<TravelMode>(["walk", "transit", "train", "drive", "flight", "indoor"]);
const timezones = new Set(["Asia/Taipei", "America/Los_Angeles", "America/New_York"]);
const dayKinds = new Set(["flight", "city", "apsa", "daytrip", "drive", "return"]);
const idPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/;

const activityFields = new Set([
  "id", "timeLabel", "start", "timezone", "title", "detail", "icon", "category", "priority",
  "durationMin", "coordinates", "place", "photo", "officialUrl", "officialLabel", "outdoors",
  "fixed", "ticketed", "vague", "travelFromPrevious", "rainAlternative",
]);
const activityChangeFields = new Set([...activityFields].filter((field) => field !== "id"));
const rainActivityFields = new Set([...activityFields].filter((field) => field !== "rainAlternative"));
const dayFields = new Set(["id", "date", "isoDate", "weekday", "location", "title", "note", "color", "kind", "activities"]);
const dayChangeFields = new Set(["date", "isoDate", "weekday", "location", "title", "note", "color", "kind"]);

function record(value: unknown, message: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ItineraryInputError(message);
  return value as Record<string, unknown>;
}

function assertOnlyKeys(value: Record<string, unknown>, allowed: Set<string>, message: string) {
  if (Object.keys(value).some((key) => !allowed.has(key))) throw new ItineraryInputError(message);
}

function text(value: unknown, max: number, label: string, min = 1) {
  if (typeof value !== "string") throw new ItineraryInputError(`${label}格式不正確。`);
  const clean = value.trim();
  if (clean.length < min || clean.length > max) throw new ItineraryInputError(`${label}長度不正確。`);
  return clean;
}

function optionalText(value: unknown, max: number, label: string) {
  if (value === undefined || value === null || value === "") return undefined;
  return text(value, max, label);
}

function id(value: unknown, label: string) {
  const clean = text(value, 80, label);
  if (!idPattern.test(clean)) throw new ItineraryInputError(`${label}格式不正確。`);
  return clean;
}

function integer(value: unknown, min: number, max: number, label: string) {
  if (!Number.isInteger(value) || Number(value) < min || Number(value) > max) {
    throw new ItineraryInputError(`${label}數值不正確。`);
  }
  return Number(value);
}

function optionalBoolean(value: unknown, label: string) {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "boolean") throw new ItineraryInputError(`${label}格式不正確。`);
  return value;
}

function httpsUrl(value: unknown, max: number, label: string) {
  const clean = optionalText(value, max, label);
  if (!clean) return undefined;
  let parsed: URL;
  try { parsed = new URL(clean); } catch { throw new ItineraryInputError(`${label}格式不正確。`); }
  if (parsed.protocol !== "https:") throw new ItineraryInputError(`${label}必須使用 HTTPS。`);
  return parsed.toString();
}

function enumValue<T extends string>(value: unknown, allowed: Set<T>, label: string): T {
  if (typeof value !== "string" || !allowed.has(value as T)) throw new ItineraryInputError(`${label}格式不正確。`);
  return value as T;
}

function sanitizePhoto(value: unknown): PlacePhoto | undefined {
  if (value === undefined || value === null) return undefined;
  const photo = record(value, "照片資料不正確。");
  assertOnlyKeys(photo, new Set(["src", "alt", "credit", "source"]), "照片包含不支援的欄位。");
  const src = text(photo.src, 240, "照片路徑");
  if (!src.startsWith("/places/") || src.includes("..")) {
    throw new ItineraryInputError("目前只能使用網站既有的景點照片。");
  }
  const source = httpsUrl(photo.source, 500, "照片來源");
  if (!source) throw new ItineraryInputError("照片來源不正確。");
  return { src, alt: text(photo.alt, 240, "照片說明"), credit: text(photo.credit, 240, "照片出處"), source };
}

function sanitizeTravelLeg(value: unknown): TravelLeg | undefined {
  if (value === undefined || value === null) return undefined;
  const leg = record(value, "交通資料不正確。");
  assertOnlyKeys(leg, new Set(["mode", "summary", "minutes", "bufferMin", "note"]), "交通資料包含不支援的欄位。");
  const result: TravelLeg = {
    mode: enumValue(leg.mode, travelModes, "交通方式"),
    summary: text(leg.summary, 240, "交通摘要"),
    minutes: integer(leg.minutes, 1, 1_440, "交通時間"),
    bufferMin: integer(leg.bufferMin, 0, 1_440, "緩衝時間"),
  };
  const note = optionalText(leg.note, 500, "交通備註");
  if (note) result.note = note;
  return result;
}

function sanitizeCoordinates(value: unknown): [number, number] | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value) || value.length !== 2 || !value.every((coordinate) => typeof coordinate === "number" && Number.isFinite(coordinate))) {
    throw new ItineraryInputError("座標格式不正確。");
  }
  if (value[0] < -90 || value[0] > 90 || value[1] < -180 || value[1] > 180) {
    throw new ItineraryInputError("座標超出有效範圍。");
  }
  return [value[0], value[1]];
}

function sanitizeActivity(value: unknown, allowRainAlternative = true): Activity {
  const raw = record(value, "活動資料不正確。");
  assertOnlyKeys(raw, allowRainAlternative ? activityFields : rainActivityFields, "活動包含不支援的欄位。");

  const start = optionalText(raw.start, 48, "開始時間");
  if (start && (!/T/.test(start) || !/(?:Z|[+-]\d{2}:\d{2})$/.test(start) || !Number.isFinite(Date.parse(start)))) {
    throw new ItineraryInputError("開始時間必須包含有效的日期、時間與時區偏移。");
  }

  const activity: Activity = {
    id: id(raw.id, "活動 ID"),
    timeLabel: text(raw.timeLabel, 32, "顯示時間"),
    timezone: enumValue(raw.timezone, timezones, "時區") as Activity["timezone"],
    title: text(raw.title, 160, "活動名稱"),
    detail: text(raw.detail, 1_000, "活動說明"),
    icon: enumValue(raw.icon, iconKeys, "圖示"),
    category: enumValue(raw.category, categories, "活動分類"),
    priority: enumValue(raw.priority, priorities, "活動優先度"),
    durationMin: integer(raw.durationMin, 0, 10_080, "停留時間"),
  };

  if (start) activity.start = start;
  const coordinates = sanitizeCoordinates(raw.coordinates);
  if (coordinates) activity.coordinates = coordinates;
  const place = optionalText(raw.place, 240, "地點");
  if (place) activity.place = place;
  const photo = sanitizePhoto(raw.photo);
  if (photo) activity.photo = photo;
  const officialUrl = httpsUrl(raw.officialUrl, 500, "官方網址");
  if (officialUrl) activity.officialUrl = officialUrl;
  const officialLabel = optionalText(raw.officialLabel, 80, "官方連結名稱");
  if (officialLabel) activity.officialLabel = officialLabel;
  const outdoors = optionalBoolean(raw.outdoors, "戶外標記");
  if (outdoors !== undefined) activity.outdoors = outdoors;
  const fixed = optionalBoolean(raw.fixed, "固定行程標記");
  if (fixed !== undefined) activity.fixed = fixed;
  const ticketed = optionalBoolean(raw.ticketed, "票券標記");
  if (ticketed !== undefined) activity.ticketed = ticketed;
  const vague = optionalBoolean(raw.vague, "未定時間標記");
  if (vague !== undefined) activity.vague = vague;
  const travelFromPrevious = sanitizeTravelLeg(raw.travelFromPrevious);
  if (travelFromPrevious) activity.travelFromPrevious = travelFromPrevious;
  if (allowRainAlternative && raw.rainAlternative !== undefined && raw.rainAlternative !== null) {
    activity.rainAlternative = sanitizeActivity(raw.rainAlternative, false);
  }
  return activity;
}

function sanitizeDay(value: unknown): TripDay {
  const raw = record(value, "日期資料不正確。");
  assertOnlyKeys(raw, dayFields, "日期資料包含不支援的欄位。");
  const isoDate = text(raw.isoDate, 10, "日期");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate) || !Number.isFinite(Date.parse(`${isoDate}T00:00:00Z`))) {
    throw new ItineraryInputError("日期格式不正確。");
  }
  const color = text(raw.color, 9, "日期顏色");
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) throw new ItineraryInputError("日期顏色格式不正確。");
  if (!Array.isArray(raw.activities) || raw.activities.length > 100) throw new ItineraryInputError("每日活動數量不正確。");
  return {
    id: id(raw.id, "日期 ID"),
    date: text(raw.date, 16, "顯示日期"),
    isoDate,
    weekday: text(raw.weekday, 16, "星期"),
    location: text(raw.location, 120, "地區"),
    title: text(raw.title, 160, "日期標題"),
    note: text(raw.note, 1_000, "日期說明"),
    color,
    kind: enumValue(raw.kind, dayKinds, "日期類型") as TripDay["kind"],
    activities: raw.activities.map((activity) => sanitizeActivity(activity)),
  };
}

export function validateTripDocument(value: unknown): TripDocument {
  const raw = record(value, "行程資料不正確。");
  assertOnlyKeys(raw, new Set(["schemaVersion", "days"]), "行程包含不支援的欄位。");
  if (raw.schemaVersion !== ITINERARY_SCHEMA_VERSION) throw new ItineraryInputError("行程資料版本不支援。", 500);
  if (!Array.isArray(raw.days) || raw.days.length < 1 || raw.days.length > 40) throw new ItineraryInputError("行程日期數量不正確。");
  const days = raw.days.map((day) => sanitizeDay(day));
  const dayIds = new Set<string>();
  const activityIds = new Set<string>();
  for (const day of days) {
    if (dayIds.has(day.id)) throw new ItineraryInputError("日期 ID 不可重複。", 500);
    dayIds.add(day.id);
    for (const activity of day.activities) {
      for (const activityId of [activity.id, activity.rainAlternative?.id].filter((value): value is string => Boolean(value))) {
        if (activityIds.has(activityId)) throw new ItineraryInputError("活動 ID 不可重複。", 500);
        activityIds.add(activityId);
      }
    }
  }
  return { schemaVersion: ITINERARY_SCHEMA_VERSION, days };
}

function strictOperation(value: unknown, allowed: string[]) {
  const operation = record(value, "修改內容不正確。");
  assertOnlyKeys(operation, new Set(["type", ...allowed]), "修改內容包含不支援的欄位。");
  return operation;
}

function changeRecord(value: unknown, allowed: Set<string>, label: string) {
  const changes = record(value, `${label}不正確。`);
  if (!Object.keys(changes).length) throw new ItineraryInputError(`${label}不可為空。`);
  assertOnlyKeys(changes, allowed, `${label}包含不支援的欄位。`);
  return changes;
}

export function parseOperation(value: unknown): ItineraryOperation {
  const raw = record(value, "修改內容不正確。");
  switch (raw.type) {
    case "activity.create": {
      const operation = strictOperation(value, ["dayId", "index", "activity"]);
      const activity = record(operation.activity, "新活動資料不正確。");
      if (Object.hasOwn(activity, "id")) throw new ItineraryInputError("新活動 ID 由系統產生。");
      return {
        type: "activity.create",
        dayId: id(operation.dayId, "日期 ID"),
        ...(operation.index === undefined ? {} : { index: integer(operation.index, 0, 100, "活動位置") }),
        activity,
      };
    }
    case "activity.update": {
      const operation = strictOperation(value, ["activityId", "changes"]);
      return { type: "activity.update", activityId: id(operation.activityId, "活動 ID"), changes: changeRecord(operation.changes, activityChangeFields, "活動修改") };
    }
    case "activity.move": {
      const operation = strictOperation(value, ["activityId", "toDayId", "toIndex"]);
      return {
        type: "activity.move",
        activityId: id(operation.activityId, "活動 ID"),
        toDayId: id(operation.toDayId, "日期 ID"),
        toIndex: integer(operation.toIndex, 0, 100, "活動位置"),
      };
    }
    case "activity.delete": {
      const operation = strictOperation(value, ["activityId", "confirmImportant"]);
      if (operation.confirmImportant !== undefined && typeof operation.confirmImportant !== "boolean") throw new ItineraryInputError("刪除確認格式不正確。");
      return { type: "activity.delete", activityId: id(operation.activityId, "活動 ID"), confirmImportant: operation.confirmImportant === true };
    }
    case "day.update": {
      const operation = strictOperation(value, ["dayId", "changes"]);
      return { type: "day.update", dayId: id(operation.dayId, "日期 ID"), changes: changeRecord(operation.changes, dayChangeFields, "日期修改") };
    }
    case "version.restore": {
      const operation = strictOperation(value, ["version"]);
      return { type: "version.restore", version: integer(operation.version, 1, Number.MAX_SAFE_INTEGER, "版本") };
    }
    default:
      throw new ItineraryInputError("不支援這種行程修改。");
  }
}

function cloneDocument(document: TripDocument): TripDocument {
  return structuredClone(document);
}

function locateActivity(document: TripDocument, activityId: string) {
  for (let dayIndex = 0; dayIndex < document.days.length; dayIndex += 1) {
    const activityIndex = document.days[dayIndex].activities.findIndex((activity) => activity.id === activityId);
    if (activityIndex >= 0) return { dayIndex, activityIndex, activity: document.days[dayIndex].activities[activityIndex] };
  }
  throw new ItineraryInputError("找不到這個活動。", 404);
}

function withGeneratedActivityIds(activity: Record<string, unknown>, existingRainId?: string) {
  const result: Record<string, unknown> = { ...activity, id: crypto.randomUUID() };
  if (activity.rainAlternative && typeof activity.rainAlternative === "object" && !Array.isArray(activity.rainAlternative)) {
    result.rainAlternative = {
      ...(activity.rainAlternative as Record<string, unknown>),
      id: existingRainId ?? crypto.randomUUID(),
    };
  }
  return result;
}

export function applyOperation(currentValue: unknown, operation: ItineraryOperation, restoreValue?: unknown): AppliedOperation {
  const current = validateTripDocument(currentValue);
  if (operation.type === "version.restore") {
    if (restoreValue === undefined) throw new ItineraryInputError("找不到要還原的版本。", 404);
    return {
      document: cloneDocument(validateTripDocument(restoreValue)),
      action: operation.type,
      targetId: null,
      sourceVersion: operation.version,
      summary: `還原為第 ${operation.version} 版行程`,
    };
  }

  const document = cloneDocument(current);
  if (operation.type === "activity.create") {
    const day = document.days.find((item) => item.id === operation.dayId);
    if (!day) throw new ItineraryInputError("找不到指定日期。", 404);
    const index = operation.index ?? day.activities.length;
    if (index > day.activities.length) throw new ItineraryInputError("活動位置超出範圍。");
    const activity = sanitizeActivity(withGeneratedActivityIds(operation.activity));
    day.activities.splice(index, 0, activity);
    return { document: validateTripDocument(document), action: operation.type, targetId: activity.id, sourceVersion: null, summary: `新增「${activity.title}」` };
  }

  if (operation.type === "day.update") {
    const dayIndex = document.days.findIndex((day) => day.id === operation.dayId);
    if (dayIndex < 0) throw new ItineraryInputError("找不到指定日期。", 404);
    const currentDay = document.days[dayIndex];
    const updated = sanitizeDay({ ...currentDay, ...operation.changes, id: currentDay.id, activities: currentDay.activities });
    document.days[dayIndex] = updated;
    return { document: validateTripDocument(document), action: operation.type, targetId: updated.id, sourceVersion: null, summary: `修改 ${updated.date}「${updated.title}」` };
  }

  const located = locateActivity(document, operation.activityId);
  const sourceDay = document.days[located.dayIndex];

  if (operation.type === "activity.update") {
    const rawChanges = { ...operation.changes };
    if (rawChanges.rainAlternative && typeof rawChanges.rainAlternative === "object" && !Array.isArray(rawChanges.rainAlternative)) {
      rawChanges.rainAlternative = {
        ...(rawChanges.rainAlternative as Record<string, unknown>),
        id: located.activity.rainAlternative?.id ?? crypto.randomUUID(),
      };
    }
    const updated = sanitizeActivity({ ...located.activity, ...rawChanges, id: located.activity.id });
    sourceDay.activities[located.activityIndex] = updated;
    return { document: validateTripDocument(document), action: operation.type, targetId: updated.id, sourceVersion: null, summary: `修改「${updated.title}」` };
  }

  if (operation.type === "activity.move") {
    const [activity] = sourceDay.activities.splice(located.activityIndex, 1);
    const targetDay = document.days.find((day) => day.id === operation.toDayId);
    if (!targetDay) throw new ItineraryInputError("找不到目的日期。", 404);
    if (operation.toIndex > targetDay.activities.length) throw new ItineraryInputError("活動位置超出範圍。");
    targetDay.activities.splice(operation.toIndex, 0, activity);
    return { document: validateTripDocument(document), action: operation.type, targetId: activity.id, sourceVersion: null, summary: `移動「${activity.title}」到 ${targetDay.date}` };
  }

  const important = located.activity.fixed || ["flight", "stay", "conference"].includes(located.activity.category);
  if (important && !operation.confirmImportant) {
    throw new ItineraryInputError("這是航班、住宿、APSA 或固定行程，請再次確認後再刪除。", 428);
  }
  sourceDay.activities.splice(located.activityIndex, 1);
  return { document: validateTripDocument(document), action: operation.type, targetId: located.activity.id, sourceVersion: null, summary: `刪除「${located.activity.title}」` };
}
