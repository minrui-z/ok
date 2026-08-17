import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  alternativePlanningStatusText,
  createAlternativeReplacement,
  evaluateAlternativeSchedule,
  nearbyAlternativeCandidates,
  rankNearbyAlternatives,
  type NearbyAlternativeRegion,
} from "../app/nearby-alternatives";
import { tripDays } from "../app/trip-data";

test("candidate directory has useful, sourced choices for every trip region", () => {
  const regions: NearbyAlternativeRegion[] = ["boston", "salem", "newport", "concord"];
  for (const region of regions) {
    const candidates = nearbyAlternativeCandidates.filter((candidate) => candidate.region === region);
    assert.ok(candidates.length >= 3 && candidates.length <= 5, `${region} should have 3–5 candidates`);
  }

  for (const candidate of nearbyAlternativeCandidates) {
    assert.match(candidate.officialUrl, /^https:\/\//);
    assert.match(candidate.schedule.sourceUrl, /^https:\/\//);
    assert.match(candidate.sourceCheckedAt, /^2026-\d{2}-\d{2}$/);
    assert.ok(candidate.officialLabel.length > 0);
    assert.ok(candidate.schedule.validFrom <= "2026-09-01");
    assert.ok(candidate.schedule.validThrough >= "2026-09-10");
    assert.ok(candidate.schedule.windows.length > 0);
    assert.equal(
      existsSync(join(process.cwd(), "public", candidate.photo.src.replace(/^\//, ""))),
      true,
      `${candidate.id} should use an existing local photo`,
    );
  }
});

test("published closures and weekday rules affect September 2026 filtering", () => {
  const bpl = nearbyAlternativeCandidates.find((candidate) => candidate.id === "alt-boston-bpl")!;
  const mfa = nearbyAlternativeCandidates.find((candidate) => candidate.id === "alt-boston-mfa")!;
  const newportArt = nearbyAlternativeCandidates.find((candidate) => candidate.id === "alt-newport-art-museum")!;
  const breakers = nearbyAlternativeCandidates.find((candidate) => candidate.id === "alt-newport-breakers")!;

  assert.deepEqual(
    evaluateAlternativeSchedule(bpl, new Date("2026-09-07T12:00:00-04:00")),
    {
      fits: false,
      status: "officially-closed",
      finishAt: new Date("2026-09-07T13:15:00-04:00"),
    },
  );
  assert.equal(evaluateAlternativeSchedule(mfa, new Date("2026-09-08T12:00:00-04:00")).fits, false);
  assert.equal(evaluateAlternativeSchedule(newportArt, new Date("2026-09-08T12:00:00-04:00")).fits, false);
  assert.equal(evaluateAlternativeSchedule(breakers, new Date("2026-09-08T15:30:00-04:00")).fits, true);
  assert.equal(evaluateAlternativeSchedule(breakers, new Date("2026-09-08T16:10:00-04:00")).fits, false);
});

test("ranking returns at most three fitting choices and prioritizes a fresh confirmation", () => {
  const day = tripDays.find((item) => item.id === "sep-06")!;
  const result = rankNearbyAlternatives({
    day,
    targetActivityId: "sep06-memorial",
    at: new Date("2026-09-06T14:00:00-04:00"),
    confirmations: [{
      candidateId: "alt-salem-seven-gables",
      expiresAt: "2026-09-07T13:00:00-04:00",
    }],
    confirmationNow: new Date("2026-09-06T14:00:00-04:00"),
  });

  assert.equal(result.suggestions.length, 3);
  assert.equal(result.suggestions[0].candidate.id, "alt-salem-seven-gables");
  assert.equal(result.suggestions[0].confirmedRecently, true);
  assert.equal(result.suggestions[0].planningStatus, "fresh-confirmation");
  assert.equal(result.suggestions.every((suggestion) => suggestion.googleMapsUrl.startsWith("https://www.google.com/maps/dir/")), true);
  assert.equal(result.suggestions.every((suggestion) => suggestion.requiredMin > 0), true);
  assert.equal(result.emptyReason, null);
});

test("ranking includes travel and buffer before the next protected activity", () => {
  const day = tripDays.find((item) => item.id === "sep-02")!;
  const result = rankNearbyAlternatives({
    day,
    targetActivityId: "sep02-copley",
    at: new Date("2026-09-02T13:00:00-04:00"),
    minimumBufferMin: 15,
  });

  assert.equal(result.nextProtected?.id, "sep07-arrive");
  assert.ok(result.suggestions.length >= 1);
  assert.equal(result.suggestions.every((suggestion) => suggestion.slackMin !== null && suggestion.slackMin >= 0), true);
  assert.equal(result.excluded.some((candidate) => candidate.status === "insufficient-time"), true);
  assert.equal(result.suggestions.some((suggestion) => suggestion.candidate.id === "alt-boston-bpl"), false);
});

test("planning copy never claims live-open status", () => {
  const statuses = [
    "fresh-confirmation",
    "published-window",
    "daylight-window",
    "officially-closed",
    "outside-hours",
    "date-not-covered",
    "insufficient-time",
  ] as const;
  for (const status of statuses) {
    const label = alternativePlanningStatusText(status);
    assert.ok(label.length > 0);
    assert.doesNotMatch(label, /營業中|目前開放|現在開放/);
  }
});

test("replacement refuses protected stops and leaves stable scheduling fields untouched", () => {
  const newport = tripDays.find((item) => item.id === "sep-08")!;
  const fixed = newport.activities.find((activity) => activity.id === "sep08-breakers")!;
  const salem = tripDays.find((item) => item.id === "sep-06")!;
  const flexible = salem.activities.find((activity) => activity.id === "sep06-memorial")!;
  const suggestion = rankNearbyAlternatives({
    day: salem,
    targetActivityId: flexible.id,
    at: new Date("2026-09-06T14:00:00-04:00"),
  }).suggestions[0];

  assert.equal(createAlternativeReplacement(fixed, suggestion).ok, false);
  const replacement = createAlternativeReplacement(flexible, suggestion);
  assert.equal(replacement.ok, true);
  if (!replacement.ok) return;
  assert.equal("id" in replacement.patch, false);
  assert.equal("start" in replacement.patch, false);
  assert.equal("timeLabel" in replacement.patch, false);
  assert.equal("timezone" in replacement.patch, false);
  assert.equal("priority" in replacement.patch, false);
  assert.equal(replacement.patch.officialUrl, suggestion.candidate.officialUrl);
  assert.equal(replacement.patch.travelFromPrevious?.minutes, suggestion.outbound.minutes);
  assert.equal(replacement.patch.rainAlternative, null);
});
