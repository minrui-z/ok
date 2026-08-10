import assert from "node:assert/strict";
import test from "node:test";
import { tripDays } from "../app/trip-data";
import { getStopState, resolveDayActivities } from "../app/trip-utils";

test("rain replacements are applied before intensity filtering", () => {
  const day = tripDays.find((item) => item.id === "sep-04")!;
  const standard = resolveDayActivities(day, "standard", true);
  assert.equal(standard.visible.some((activity) => activity.id === "sep04-mfa-rain"), false);
  assert.equal(standard.hidden.some((activity) => activity.id === "sep04-mfa-rain"), true);

  const full = resolveDayActivities(day, "full", true);
  assert.equal(full.visible.some((activity) => activity.id === "sep04-mfa-rain"), true);
  assert.equal(full.visible.some((activity) => activity.id === "sep04-fens"), false);
});

test("ticketed fixed activities are not replaced by rain mode", () => {
  const day = tripDays.find((item) => item.id === "sep-07")!;
  const result = resolveDayActivities(day, "full", true);
  assert.equal(result.visible.some((activity) => activity.id === "sep07-game"), true);
});

test("next-stop math compares explicit time zones by absolute time", () => {
  const state = getStopState(new Date("2026-09-01T23:00:00Z"), tripDays, new Set());
  assert.equal(state.phase, "active");
  if (state.phase !== "active") return;
  assert.equal(state.next?.id, "sep01-sea");
  assert.equal(state.countdownMs, 10 * 60_000);
});

test("vague APSA times remain current until manually completed", () => {
  const now = new Date("2026-09-04T13:00:00Z");
  const pending = getStopState(now, tripDays, new Set());
  assert.equal(pending.phase, "active");
  if (pending.phase !== "active") return;
  assert.equal(pending.current?.id, "sep04-prep");

  const completed = getStopState(now, tripDays, new Set(["sep04-prep", "sep04-talk"]));
  assert.equal(completed.phase, "active");
  if (completed.phase !== "active") return;
  assert.equal(completed.next?.id, "sep04-gardner");
});

test("pre-trip and post-trip states are explicit", () => {
  const before = getStopState(new Date("2026-08-20T00:00:00Z"), tripDays, new Set());
  assert.equal(before.phase, "before");
  if (before.phase === "before") assert.equal(before.next.id, "sep01-tpe");
  assert.equal(getStopState(new Date("2026-09-13T00:00:00Z"), tripDays, new Set()).phase, "complete");
});
