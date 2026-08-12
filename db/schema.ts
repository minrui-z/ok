import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const notes = sqliteTable("notes", {
  id: text("id").primaryKey(),
  scope: text("scope", { enum: ["trip", "day"] }).notNull(),
  dayId: text("day_id"),
  authorId: text("author_id").notNull(),
  authorName: text("author_name").notNull(),
  content: text("content").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [
  index("idx_notes_scope_day_updated").on(table.scope, table.dayId, table.updatedAt),
  index("idx_notes_author").on(table.authorId),
]);

export const polls = sqliteTable("polls", {
  id: text("id").primaryKey(),
  question: text("question").notNull(),
  type: text("type", { enum: ["single", "multiple"] }).notNull(),
  scope: text("scope", { enum: ["trip", "day"] }).notNull(),
  dayId: text("day_id"),
  status: text("status", { enum: ["open", "closed"] }).notNull().default("open"),
  authorId: text("author_id").notNull(),
  authorName: text("author_name").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [
  index("idx_polls_scope_day_updated").on(table.scope, table.dayId, table.updatedAt),
  index("idx_polls_author").on(table.authorId),
]);

export const pollOptions = sqliteTable("poll_options", {
  id: text("id").primaryKey(),
  pollId: text("poll_id").notNull().references(() => polls.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  position: integer("position").notNull(),
}, (table) => [
  uniqueIndex("uidx_poll_options_position").on(table.pollId, table.position),
  index("idx_poll_options_poll").on(table.pollId),
]);

export const pollVotes = sqliteTable("poll_votes", {
  pollId: text("poll_id").notNull().references(() => polls.id, { onDelete: "cascade" }),
  optionId: text("option_id").notNull().references(() => pollOptions.id, { onDelete: "cascade" }),
  participantId: text("participant_id").notNull(),
  participantName: text("participant_name").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [
  primaryKey({ columns: [table.pollId, table.participantId, table.optionId] }),
  index("idx_poll_votes_poll_option").on(table.pollId, table.optionId),
  index("idx_poll_votes_participant").on(table.participantId),
]);

export const unlockAttempts = sqliteTable("unlock_attempts", {
  sourceHash: text("source_hash").primaryKey(),
  windowStartedAt: integer("window_started_at").notNull(),
  failures: integer("failures").notNull(),
  lockedUntil: integer("locked_until").notNull().default(0),
});

export const expenses = sqliteTable("expenses", {
  id: text("id").primaryKey(),
  dayId: text("day_id"),
  description: text("description").notNull(),
  category: text("category", { enum: ["transport", "rental", "parking", "food", "ticket", "other"] }).notNull(),
  amountCents: integer("amount_cents").notNull(),
  currency: text("currency", { enum: ["USD", "TWD"] }).notNull(),
  paidBy: text("paid_by").notNull(),
  participantsJson: text("participants_json").notNull(),
  authorId: text("author_id").notNull(),
  authorName: text("author_name").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [
  index("idx_expenses_day_updated").on(table.dayId, table.updatedAt),
  index("idx_expenses_author").on(table.authorId),
]);

export const placeConfirmations = sqliteTable("place_confirmations", {
  id: text("id").primaryKey(),
  activityId: text("activity_id").notNull(),
  placeName: text("place_name").notNull(),
  officialUrl: text("official_url").notNull(),
  authorId: text("author_id").notNull(),
  authorName: text("author_name").notNull(),
  confirmedAt: integer("confirmed_at").notNull(),
  expiresAt: integer("expires_at").notNull(),
}, (table) => [
  index("idx_place_confirmations_activity_latest").on(table.activityId, table.confirmedAt),
]);

export const itineraryVersions = sqliteTable("itinerary_versions", {
  tripId: text("trip_id").notNull(),
  version: integer("version").notNull(),
  schemaVersion: integer("schema_version").notNull().default(1),
  snapshotJson: text("snapshot_json").notNull(),
  action: text("action", {
    enum: [
      "seed",
      "activity.create",
      "activity.update",
      "activity.move",
      "activity.delete",
      "day.update",
      "day.adapt",
      "version.restore",
    ],
  }).notNull(),
  targetId: text("target_id"),
  sourceVersion: integer("source_version"),
  summary: text("summary").notNull(),
  authorId: text("author_id"),
  authorName: text("author_name").notNull(),
  createdAt: integer("created_at").notNull(),
}, (table) => [
  primaryKey({ columns: [table.tripId, table.version] }),
]);
