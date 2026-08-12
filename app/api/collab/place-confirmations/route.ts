import { findActivityById, officialPlaceForActivity } from "../../../place-directory";
import type { Activity } from "../../../trip-data";
import { documentFromVersion, latestItineraryVersion } from "../../itinerary/_store";
import { apiError, authenticated, json, requireSameOrigin, textValue } from "../_lib";

const CONFIRMATION_AGE_MS = 24 * 60 * 60 * 1_000;
const activityIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/;

type ConfirmationRow = {
  id: string;
  activityId: string;
  placeName: string;
  officialUrl: string;
  authorId: string;
  authorName: string;
  confirmedAt: number;
  expiresAt: number;
};

const latestConfirmationSql = `
  SELECT
    confirmation.id,
    confirmation.activity_id AS activityId,
    confirmation.place_name AS placeName,
    confirmation.official_url AS officialUrl,
    confirmation.author_id AS authorId,
    confirmation.author_name AS authorName,
    confirmation.confirmed_at AS confirmedAt,
    confirmation.expires_at AS expiresAt
  FROM place_confirmations AS confirmation
  WHERE confirmation.rowid = (
    SELECT latest.rowid
    FROM place_confirmations AS latest
    WHERE latest.activity_id = confirmation.activity_id
    ORDER BY latest.confirmed_at DESC, latest.rowid DESC
    LIMIT 1
  )
`;

function activityIdValue(value: unknown) {
  const activityId = textValue(value, 80);
  return activityId && activityIdPattern.test(activityId) ? activityId : null;
}

function itineraryActivities(days: ReturnType<typeof documentFromVersion>["days"]) {
  const activities: Activity[] = [];
  for (const day of days) {
    for (const activity of day.activities) {
      activities.push(activity);
      if (activity.rainAlternative) activities.push(activity.rainAlternative);
    }
  }
  return activities;
}

function confirmablePlace(activity: Activity) {
  if (activity.category !== "sight") return null;
  const official = officialPlaceForActivity(activity);
  if (!official || !isHttps(official.officialUrl)) return null;
  return { activityId: activity.id, placeName: activity.title, officialUrl: official.officialUrl };
}

function eligibleActivityMap(days: ReturnType<typeof documentFromVersion>["days"]) {
  return new Map(itineraryActivities(days).flatMap((activity) => {
    const place = confirmablePlace(activity);
    return place ? [[place.activityId, place] as const] : [];
  }));
}

function isHttps(value: string | undefined): value is string {
  if (!value) return false;
  try { return new URL(value).protocol === "https:"; }
  catch { return false; }
}

export async function GET(request: Request) {
  const auth = await authenticated(request);
  if (!auth) return apiError("請先輸入旅行密碼。", 401);

  const requested = new URL(request.url).searchParams.get("activityId");
  const activityId = requested === null ? null : activityIdValue(requested);
  if (requested !== null && !activityId) return apiError("景點 ID 不正確。", 400);

  const latestItinerary = documentFromVersion(await latestItineraryVersion(auth.db));
  const eligible = eligibleActivityMap(latestItinerary.days);
  const result = activityId
    ? await auth.db.prepare(`${latestConfirmationSql} AND confirmation.activity_id = ? ORDER BY confirmation.confirmed_at DESC`).bind(activityId).all<ConfirmationRow>()
    : await auth.db.prepare(`${latestConfirmationSql} ORDER BY confirmation.confirmed_at DESC`).all<ConfirmationRow>();
  const now = Date.now();
  const confirmations = result.results
    .filter((confirmation: ConfirmationRow) => eligible.get(confirmation.activityId)?.officialUrl === confirmation.officialUrl)
    .map((confirmation: ConfirmationRow) => ({
      ...confirmation,
      fresh: confirmation.expiresAt > now,
    }));

  return json({ confirmations, participantId: auth.session.participantId, serverNow: now });
}

export async function POST(request: Request) {
  if (!requireSameOrigin(request)) return apiError("請從目前網站送出。", 403);
  const auth = await authenticated(request);
  if (!auth) return apiError("請先輸入旅行密碼。", 401);

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || Object.keys(body).some((key) => key !== "activityId")) {
    return apiError("只需提供要確認的景點。", 400);
  }
  const activityId = activityIdValue(body.activityId);
  if (!activityId) return apiError("景點 ID 不正確。", 400);

  const latestItinerary = documentFromVersion(await latestItineraryVersion(auth.db));
  const activity = findActivityById(latestItinerary.days, activityId);
  if (!activity) return apiError("找不到這個景點。", 404);
  if (activity.category !== "sight") return apiError("這個行程不是可確認營業的景點。", 400);
  const place = confirmablePlace(activity);
  if (!place) return apiError("這個景點尚未設定官方頁面。", 400);

  const confirmation: ConfirmationRow = {
    id: crypto.randomUUID(),
    activityId: place.activityId,
    placeName: place.placeName,
    officialUrl: place.officialUrl,
    authorId: auth.session.participantId,
    authorName: auth.session.nickname,
    confirmedAt: Date.now(),
    expiresAt: 0,
  };
  confirmation.expiresAt = confirmation.confirmedAt + CONFIRMATION_AGE_MS;

  await auth.db.prepare(
    "INSERT INTO place_confirmations (id, activity_id, place_name, official_url, author_id, author_name, confirmed_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  ).bind(
    confirmation.id,
    confirmation.activityId,
    confirmation.placeName,
    confirmation.officialUrl,
    confirmation.authorId,
    confirmation.authorName,
    confirmation.confirmedAt,
    confirmation.expiresAt,
  ).run();

  return json({ confirmation: { ...confirmation, fresh: true } }, 201);
}
