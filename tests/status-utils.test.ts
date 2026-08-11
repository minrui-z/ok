import assert from "node:assert/strict";
import test from "node:test";
import { getPlaceStatuses } from "../app/place-status";
import { tripDays } from "../app/trip-data";
import {
  buildUrgentAlerts,
  destinationForDate,
  parseMbtaAlerts,
  parseNwsAlerts,
} from "../app/status-utils";

test("trip dates select weather for the actual day-trip destination", () => {
  assert.equal(destinationForDate("2026-09-06"), "salem");
  assert.equal(destinationForDate("2026-09-08"), "newport");
  assert.equal(destinationForDate("2026-09-09"), "concord");
  assert.equal(destinationForDate("2026-09-05"), "boston");
});

test("MBTA parser preserves affected routes and active periods", () => {
  const alerts = parseMbtaAlerts({
    data: [{
      id: "green-delay",
      attributes: {
        short_header: "Green Line delay",
        description: "Allow extra time.",
        effect: "DELAY",
        severity: 7,
        active_period: [{ start: "2026-09-04T10:00:00-04:00", end: "2026-09-04T12:00:00-04:00" }],
        updated_at: "2026-09-04T10:05:00-04:00",
      },
      relationships: { route: { data: { id: "Green-E", type: "route" } } },
    }],
  });

  assert.equal(alerts[0].effectCode, "DELAY");
  assert.deepEqual(alerts[0].routeIds, ["Green-E"]);
  assert.deepEqual(alerts[0].activePeriods, [{ start: "2026-09-04T10:00:00-04:00", end: "2026-09-04T12:00:00-04:00" }]);
});

test("NWS alerts are deduplicated across nearby trip destinations", () => {
  const officialId = "https://api.weather.gov/alerts/abc";
  const feature = {
    id: officialId,
    properties: {
      event: "Flash Flood Warning",
      headline: "Flash Flood Warning issued for eastern Massachusetts",
      severity: "Severe",
      urgency: "Immediate",
      certainty: "Likely",
      areaDesc: "Suffolk County",
      description: "Move away from flood-prone areas.",
      sent: "2026-09-06T12:00:00-04:00",
      expires: "2026-09-06T14:00:00-04:00",
    },
  };
  const boston = parseNwsAlerts({ features: [feature] }, "boston");
  const salem = parseNwsAlerts({ features: [feature] }, "salem");
  const urgent = buildUrgentAlerts({
    checkedAt: "2026-09-06T16:05:00.000Z",
    weatherAlerts: [...boston, ...salem],
    transitAlerts: [],
    game: null,
    places: [],
  });

  assert.equal(urgent.length, 1);
  assert.equal(urgent[0].level, "critical");
  assert.equal(urgent[0].notify, true);
  assert.deepEqual(urgent[0].destinations, ["boston", "salem"]);
  assert.equal(urgent[0].source, officialId);
});

test("curated place checks keep open, exception and unconfirmed distinct", () => {
  const places = getPlaceStatuses("2026-08-12T12:00:00.000Z");
  assert.equal(places.find((place) => place.id === "gardner-sep04")?.state, "planned-open");
  assert.equal(places.find((place) => place.id === "breakers-sep08")?.state, "official-exception");
  assert.equal(places.find((place) => place.id === "new-balance-sep09")?.state, "unconfirmed");
  assert.equal(places.every((place) => place.source.startsWith("https://") && place.checkedAt.length > 0), true);
});

test("stale manually reviewed hours are downgraded before the trip", () => {
  const places = getPlaceStatuses("2026-09-01T12:00:00.000Z");
  assert.equal(places.find((place) => place.id === "gardner-sep04")?.state, "unconfirmed");
  assert.match(places.find((place) => place.id === "gardner-sep04")?.summary ?? "", /最後整理於/);
  assert.equal(places.find((place) => place.id === "breakers-sep08")?.state, "official-exception");
});

test("shared itinerary time changes invalidate the old place-hours check", () => {
  const days = structuredClone(tripDays);
  const activity = days.flatMap((day) => day.activities).find((item) => item.id === "sep04-gardner");
  assert.ok(activity);
  activity.timeLabel = "20:30";
  const places = getPlaceStatuses("2026-08-12T12:00:00.000Z", days);
  assert.equal(places.find((place) => place.id === "gardner-sep04")?.state, "unconfirmed");
  assert.match(places.find((place) => place.id === "gardner-sep04")?.summary ?? "", /20:30/);
});

test("a failed official source is represented as a warning, not an all-clear", () => {
  const alerts = buildUrgentAlerts({
    checkedAt: "2026-09-06T16:05:00.000Z",
    weatherAlerts: [],
    transitAlerts: [],
    game: null,
    places: [],
    sourceFailures: [{
      id: "nws-salem",
      title: "Salem 官方天氣警報未更新",
      source: "https://www.weather.gov/documentation/services-web-api",
      preference: "weather",
      destination: "salem",
    }],
  });

  assert.equal(alerts[0].kind, "source");
  assert.equal(alerts[0].level, "warning");
  assert.equal(alerts[0].notify, false);
  assert.match(alerts[0].detail, /不能視為正常/);
});
