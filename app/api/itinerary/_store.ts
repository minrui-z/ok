import { tripDays } from "../../trip-data";
import { ensureCollabSchema } from "../collab/_lib";
import {
  ITINERARY_SCHEMA_VERSION,
  ItineraryInputError,
  type ItineraryAction,
  type TripDocument,
  validateTripDocument,
} from "./_model";

export const ITINERARY_TRIP_ID = "boston-apsa-2026";

export type ItineraryVersionRow = {
  tripId: string;
  version: number;
  schemaVersion: number;
  snapshotJson: string;
  action: ItineraryAction;
  targetId: string | null;
  sourceVersion: number | null;
  summary: string;
  authorId: string | null;
  authorName: string;
  createdAt: number;
};

const selectVersionSql = `
  SELECT
    trip_id AS tripId,
    version,
    schema_version AS schemaVersion,
    snapshot_json AS snapshotJson,
    action,
    target_id AS targetId,
    source_version AS sourceVersion,
    summary,
    author_id AS authorId,
    author_name AS authorName,
    created_at AS createdAt
  FROM itinerary_versions
`;

function seedDocument() {
  return validateTripDocument({ schemaVersion: ITINERARY_SCHEMA_VERSION, days: tripDays });
}

export async function ensureItinerarySeed(db: D1Database) {
  await ensureCollabSchema(db);
  const document = seedDocument();
  await db.prepare(
    "INSERT OR IGNORE INTO itinerary_versions (trip_id, version, schema_version, snapshot_json, action, target_id, source_version, summary, author_id, author_name, created_at) VALUES (?, 1, ?, ?, 'seed', NULL, NULL, ?, NULL, ?, ?)",
  ).bind(
    ITINERARY_TRIP_ID,
    ITINERARY_SCHEMA_VERSION,
    JSON.stringify(document),
    "建立 Boston 2026 初始行程",
    "系統",
    Date.now(),
  ).run();
}

export async function latestItineraryVersion(db: D1Database) {
  await ensureItinerarySeed(db);
  const row = await db.prepare(
    `${selectVersionSql} WHERE trip_id = ? ORDER BY version DESC LIMIT 1`,
  ).bind(ITINERARY_TRIP_ID).first<ItineraryVersionRow>();
  if (!row) throw new ItineraryInputError("行程尚未建立。", 503);
  return row;
}

export async function itineraryVersion(db: D1Database, version: number) {
  await ensureItinerarySeed(db);
  return db.prepare(
    `${selectVersionSql} WHERE trip_id = ? AND version = ? LIMIT 1`,
  ).bind(ITINERARY_TRIP_ID, version).first<ItineraryVersionRow>();
}

export function documentFromVersion(row: ItineraryVersionRow): TripDocument {
  let parsed: unknown;
  try { parsed = JSON.parse(row.snapshotJson); }
  catch { throw new ItineraryInputError("已儲存的行程資料無法讀取。", 500); }
  return validateTripDocument(parsed);
}

export async function appendItineraryVersion(
  db: D1Database,
  expectedVersion: number,
  values: {
    document: TripDocument;
    action: Exclude<ItineraryAction, "seed">;
    targetId: string | null;
    sourceVersion: number | null;
    summary: string;
    authorId: string;
    authorName: string;
  },
) {
  const version = expectedVersion + 1;
  const createdAt = Date.now();
  const snapshotJson = JSON.stringify(values.document);
  if (new TextEncoder().encode(snapshotJson).byteLength > 512_000) {
    throw new ItineraryInputError("行程資料太大，請減少單一活動的內容。", 413);
  }
  await db.prepare(
    "INSERT INTO itinerary_versions (trip_id, version, schema_version, snapshot_json, action, target_id, source_version, summary, author_id, author_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  ).bind(
    ITINERARY_TRIP_ID,
    version,
    ITINERARY_SCHEMA_VERSION,
    snapshotJson,
    values.action,
    values.targetId,
    values.sourceVersion,
    values.summary,
    values.authorId,
    values.authorName,
    createdAt,
  ).run();
  return { version, createdAt };
}

export async function itineraryHistory(db: D1Database, beforeVersion: number | null, limit: number) {
  await ensureItinerarySeed(db);
  const fields = `
    SELECT version, action, target_id AS targetId, source_version AS sourceVersion,
      summary, author_id AS authorId, author_name AS authorName, created_at AS createdAt
    FROM itinerary_versions
  `;
  const statement = beforeVersion === null
    ? db.prepare(`${fields} WHERE trip_id = ? ORDER BY version DESC LIMIT ?`).bind(ITINERARY_TRIP_ID, limit)
    : db.prepare(`${fields} WHERE trip_id = ? AND version < ? ORDER BY version DESC LIMIT ?`).bind(ITINERARY_TRIP_ID, beforeVersion, limit);
  return statement.all<{
    version: number;
    action: ItineraryAction;
    targetId: string | null;
    sourceVersion: number | null;
    summary: string;
    authorId: string | null;
    authorName: string;
    createdAt: number;
  }>();
}
