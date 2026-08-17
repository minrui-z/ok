import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { tripDays } from "../app/trip-data";
import { parseMbtaAlerts, parseMlbGame, parseWeather, weatherLabel } from "../app/status-utils";
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

test("rain-resolved activities preserve their original order", () => {
  const day = tripDays.find((item) => item.id === "sep-04")!;
  const result = resolveDayActivities(day, "standard", true);
  assert.deepEqual(result.all.map((activity) => activity.id), ["sep04-prep", "sep04-talk", "sep04-gardner", "sep04-mfa-rain", "sep04-dinner"]);
});

test("ticketed fixed activities are not replaced by rain mode", () => {
  const day = tripDays.find((item) => item.id === "sep-02")!;
  const result = resolveDayActivities(day, "full", true);
  assert.equal(result.visible.some((activity) => activity.id === "sep07-game"), true);
});

test("every sight and rain replacement has a real place photo", () => {
  const missingSightPhotos = tripDays.flatMap((day) => day.activities)
    .filter((activity) => activity.category === "sight" && !activity.photo)
    .map((activity) => activity.id);
  const missingRainPhotos = tripDays.flatMap((day) => day.activities)
    .filter((activity) => activity.rainAlternative && !activity.rainAlternative.photo)
    .map((activity) => activity.rainAlternative!.id);

  assert.deepEqual(missingSightPhotos, []);
  assert.deepEqual(missingRainPhotos, []);

  const photoPaths = new Set(tripDays.flatMap((day) => day.activities)
    .flatMap((activity) => [activity.photo?.src, activity.rainAlternative?.photo?.src])
    .filter((src): src is string => Boolean(src)));
  assert.equal([...photoPaths].every((src) => existsSync(join(process.cwd(), "public", src.replace(/^\//, "")))), true);
});

test("travel legs include positive travel time and explicit buffers", () => {
  const legs = tripDays.flatMap((day) => day.activities)
    .flatMap((activity) => activity.travelFromPrevious ? [activity.travelFromPrevious] : []);

  assert.ok(legs.length >= 30);
  assert.equal(legs.every((leg) => leg.minutes > 0 && leg.bufferMin >= 0 && leg.summary.length > 0), true);
});

test("rain replacements keep the original travel leg", () => {
  const day = tripDays.find((item) => item.id === "sep-08")!;
  const original = day.activities.find((activity) => activity.id === "sep08-cliff")!;
  const rainy = resolveDayActivities(day, "standard", true).visible.find((activity) => activity.id === "sep08-marble-rain")!;

  assert.deepEqual(rainy.travelFromPrevious, original.travelFromPrevious);
});

test("Quincy Market remains explicit in both fair-weather and rain plans", () => {
  const day = tripDays.find((item) => item.id === "sep-07")!;
  const planned = day.activities.find((activity) => activity.id === "sep07-brunch")!;
  const rainy = resolveDayActivities(day, "full", true).all.find((activity) => activity.id === "sep07-market-rain")!;

  assert.match(`${planned.title} ${planned.detail} ${planned.place}`, /Quincy Market/);
  assert.match(`${rainy.title} ${rainy.detail} ${rainy.place}`, /Quincy Market/);
});

test("Cambridge day includes both MIT and Harvard while Freedom Trail stays on 9/7", () => {
  const cambridge = tripDays.find((item) => item.id === "sep-03")!;
  const freedomTrail = tripDays.find((item) => item.id === "sep-07")!;

  assert.match(cambridge.activities.map((activity) => activity.title).join(" "), /MIT/);
  assert.match(cambridge.activities.map((activity) => activity.title).join(" "), /Harvard/);
  assert.match(freedomTrail.title, /Freedom Trail/);
  assert.equal(freedomTrail.activities.some((activity) => /Quincy Market/.test(`${activity.title} ${activity.detail}`)), true);
});

test("purchased Mariners ticket uses the official Boston date and time", () => {
  const arrivalDay = tripDays.find((item) => item.id === "sep-02")!;
  const game = arrivalDay.activities.find((activity) => activity.id === "sep07-game")!;

  assert.equal(game.title, "Red Sox vs. Mariners");
  assert.equal(game.start, "2026-09-02T16:10:00-04:00");
  assert.equal(game.ticketed, true);
  assert.equal(game.fixed, true);
});

test("next-stop math compares explicit time zones by absolute time", () => {
  const state = getStopState(new Date("2026-09-01T23:00:00Z"), tripDays, new Set());
  assert.equal(state.phase, "active");
  if (state.phase !== "active") return;
  assert.equal(state.next?.id, "sep01-sea");
  assert.equal(state.countdownMs, 10 * 60_000);
});

test("vague APSA times stay pending without eclipsing timed stops", () => {
  const now = new Date("2026-09-04T13:00:00Z");
  const pending = getStopState(now, tripDays, new Set());
  assert.equal(pending.phase, "active");
  if (pending.phase !== "active") return;
  assert.equal(pending.current, null);
  assert.equal(pending.next?.id, "sep04-gardner");

  const manuallySelected = getStopState(now, tripDays, new Set(), "sep04-prep");
  assert.equal(manuallySelected.phase, "active");
  if (manuallySelected.phase !== "active") return;
  assert.equal(manuallySelected.current?.id, "sep04-prep");

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

test("official status payloads degrade into stable display data", () => {
  const weather = parseWeather({ daily: { time: ["2026-09-07"], weather_code: [61], temperature_2m_max: [23.4], temperature_2m_min: [16.2], precipitation_probability_max: [72] } });
  assert.deepEqual(weather[0], { date: "2026-09-07", weatherCode: 61, maxC: 23, minC: 16, rainChance: 72 });
  assert.equal(weatherLabel(61), "有雨");

  const alerts = parseMbtaAlerts({ data: [{ id: "a", attributes: { short_header: "Green Line delay", effect: "DELAY", severity: 7, updated_at: "2026-09-07T10:00:00Z" } }] });
  assert.equal(alerts[0].title, "Green Line delay");
  assert.equal(alerts[0].severity, 7);

  const game = parseMlbGame({ dates: [{ games: [{ gamePk: 824717, gameDate: "2026-09-02T20:10:00Z", status: { detailedState: "Scheduled", abstractGameState: "Preview" }, teams: { away: { team: { name: "Seattle Mariners" } }, home: { team: { name: "Boston Red Sox" } } } }] }] });
  assert.equal(game?.gamePk, 824717);
  assert.equal(game?.status, "Scheduled");
});
