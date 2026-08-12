import assert from "node:assert/strict";
import test from "node:test";
import { officialPlaceForActivity } from "../app/place-directory";
import { tripDays } from "../app/trip-data";
import { resolveDayActivities } from "../app/trip-utils";

test("every displayed sight in the original and rain itineraries has a trusted official page", () => {
  for (const rainy of [false, true]) {
    for (const day of tripDays) {
      const sights = resolveDayActivities(day, "full", rainy).all.filter((activity) => activity.category === "sight");
      for (const sight of sights) {
        const official = officialPlaceForActivity(sight);
        assert.ok(official, `${sight.id} (${sight.title}) is missing an official page`);
        assert.match(official.officialUrl, /^https:\/\//);
      }
    }
  }
});

test("a repurposed stable ID does not inherit the original place link", () => {
  const original = tripDays.flatMap((day) => day.activities).find((activity) => activity.id === "sep05-bpl")!;
  assert.ok(officialPlaceForActivity(original));
  assert.equal(officialPlaceForActivity({ ...original, title: "Completely different stop", place: "Elsewhere" }), null);
});
