import assert from "node:assert/strict";
import test from "node:test";
import { applyOperation, parseOperation } from "../app/api/itinerary/_model";
import { tripDays, type Activity, type TripDay } from "../app/trip-data";
import {
  applyDayAdaptation,
  resolveDayActivities,
} from "../app/trip-utils";

function activity(
  id: string,
  start: string,
  priority: Activity["priority"] = "recommended",
  extra: Partial<Activity> = {},
): Activity {
  return {
    id,
    timeLabel: start.slice(11, 16),
    start,
    timezone: "America/New_York",
    title: id,
    detail: `${id} detail`,
    icon: "landmark",
    category: "sight",
    priority,
    durationMin: 45,
    ...extra,
  };
}

function day(activities: Activity[]): TripDay {
  return {
    id: "test-day",
    date: "9/3",
    isoDate: "2026-09-03",
    weekday: "週四",
    location: "Boston",
    title: "Test day",
    note: "Test",
    color: "#123456",
    kind: "city",
    activities,
  };
}

test("delay overlay shifts flexible stops, stops at a protected boundary, and stays immutable", () => {
  const source = day([
    activity("anchor", "2026-09-03T09:00:00-04:00"),
    activity("flex", "2026-09-03T10:00:00-04:00"),
    activity("fixed", "2026-09-03T11:30:00-04:00", "essential", { fixed: true }),
    activity("after-fixed", "2026-09-03T13:00:00-04:00"),
  ]);
  const original = structuredClone(source);
  const adapted = applyDayAdaptation(source, {
    fromActivityId: "anchor",
    delayMin: 30,
    skippedActivityIds: [],
  });

  assert.equal(adapted.activities[0].timeLabel, "09:30");
  assert.equal(adapted.activities[1].timeLabel, "10:30");
  assert.equal(adapted.activities[2].timeLabel, "11:30");
  assert.equal(adapted.activities[3].timeLabel, "13:00");
  assert.deepEqual(source, original);
});

test("chosen flexible stops are removed but protected stops can never be omitted", () => {
  const source = day([
    activity("anchor", "2026-09-03T09:00:00-04:00"),
    activity("optional", "2026-09-03T10:00:00-04:00", "optional"),
    activity("fixed", "2026-09-03T11:30:00-04:00", "essential", { ticketed: true }),
  ]);
  const adapted = applyDayAdaptation(source, {
    fromActivityId: "anchor",
    delayMin: 15,
    skippedActivityIds: ["optional", "fixed"],
  });

  assert.deepEqual(adapted.activities.map((item) => item.id), ["anchor", "fixed"]);
  assert.equal(adapted.activities[1].timeLabel, "11:30");
});

test("skipping a stop recalculates the following transport from the retained stop", () => {
  const source = day([
    activity("anchor", "2026-09-03T09:00:00-04:00", "essential", {
      coordinates: [42.355, -71.0656],
    }),
    activity("optional", "2026-09-03T10:00:00-04:00", "optional", {
      coordinates: [42.36, -71.0563],
      travelFromPrevious: { mode: "walk", summary: "anchor→optional", minutes: 10, bufferMin: 8 },
    }),
    activity("fixed", "2026-09-03T11:30:00-04:00", "essential", {
      coordinates: [42.3481, -71.0837],
      fixed: true,
      travelFromPrevious: { mode: "walk", summary: "optional→fixed", minutes: 7, bufferMin: 12 },
    }),
  ]);
  const adapted = applyDayAdaptation(source, {
    fromActivityId: "anchor",
    delayMin: 30,
    skippedActivityIds: ["optional"],
  });

  const fixed = adapted.activities[1];
  assert.equal(fixed.id, "fixed");
  assert.equal(fixed.timeLabel, "11:30");
  assert.match(fixed.travelFromPrevious?.summary ?? "", /anchor→fixed（省略後估算）/);
  assert.match(fixed.travelFromPrevious?.note ?? "", /Google Maps/);
  assert.notEqual(fixed.travelFromPrevious?.minutes, 7);
});

test("delay is applied before rain replacement and intensity filtering", () => {
  const source = tripDays.find((item) => item.id === "sep-08")!;
  const adapted = {
    ...source,
    adaptation: { fromActivityId: "sep08-cliff", delayMin: 30 as const, skippedActivityIds: [] },
  };
  const rainy = resolveDayActivities(adapted, "full", true);
  assert.equal(rainy.visible.find((item) => item.id === "sep08-marble-rain")?.timeLabel, "12:15");

  const skipped = resolveDayActivities({
    ...adapted,
    adaptation: { ...adapted.adaptation, skippedActivityIds: ["sep08-cliff"] },
  }, "full", true);
  assert.equal(skipped.visible.some((item) => item.id === "sep08-marble-rain"), false);
});

test("day.adapt is versionable and validates protected and out-of-order skips", () => {
  const source = { schemaVersion: 1 as const, days: tripDays };
  const operation = parseOperation({
    type: "day.adapt",
    dayId: "sep-03",
    adaptation: {
      fromActivityId: "sep03-common",
      delayMin: 30,
      skippedActivityIds: ["sep03-uss"],
    },
  });
  const applied = applyOperation(source, operation);
  const adapted = applied.document.days.find((item) => item.id === "sep-03")!;

  assert.equal(applied.action, "day.adapt");
  assert.equal(applied.targetId, "sep-03");
  assert.match(applied.summary, /延後 30 分鐘.*省略 1 項/);
  assert.deepEqual(adapted.adaptation, {
    fromActivityId: "sep03-common",
    delayMin: 30,
    skippedActivityIds: ["sep03-uss"],
  });
  assert.equal(source.days.find((item) => item.id === "sep-03")?.adaptation, undefined);

  const cleared = applyOperation(applied.document, parseOperation({
    type: "day.adapt",
    dayId: "sep-03",
    adaptation: null,
  }));
  assert.equal(cleared.document.days.find((item) => item.id === "sep-03")?.adaptation, undefined);
  assert.match(cleared.summary, /清除/);

  assert.throws(() => applyOperation(source, parseOperation({
    type: "day.adapt",
    dayId: "sep-03",
    adaptation: {
      fromActivityId: "sep03-old-north",
      delayMin: 15,
      skippedActivityIds: ["sep03-common"],
    },
  })), /只能省略延誤起點之後/);

  assert.throws(() => applyOperation(source, parseOperation({
    type: "day.adapt",
    dayId: "sep-03",
    adaptation: {
      fromActivityId: "sep03-common",
      delayMin: 15,
      skippedActivityIds: ["sep03-apsa-event"],
    },
  })), /不能省略/);
});
