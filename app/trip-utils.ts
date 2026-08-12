import type {
  Activity,
  ActivityCategory,
  ActivityPriority,
  DayAdaptation,
  TravelLeg,
  TravelMode,
  TripDay,
} from "./trip-data";

export type Intensity = "relaxed" | "standard" | "full";

const allowedPriority: Record<Intensity, ActivityPriority[]> = {
  relaxed: ["essential"],
  standard: ["essential", "recommended"],
  full: ["essential", "recommended", "optional"],
};

const protectedCategories = new Set<ActivityCategory>(["flight", "stay", "conference"]);

export function isProtectedActivity(activity: Activity) {
  return Boolean(activity.fixed || activity.ticketed || protectedCategories.has(activity.category));
}

function shiftedIsoString(value: string, minutes: number) {
  const shifted = new Date(new Date(value).getTime() + minutes * 60_000);
  const offsetMatch = value.match(/([+-])(\d{2}):(\d{2})$/);
  if (!offsetMatch) return shifted.toISOString();

  const offsetMin = (offsetMatch[1] === "-" ? -1 : 1)
    * (Number(offsetMatch[2]) * 60 + Number(offsetMatch[3]));
  const local = new Date(shifted.getTime() + offsetMin * 60_000).toISOString().replace(/Z$/, "");
  return `${local}${offsetMatch[0]}`;
}

function shiftedTimeLabel(start: string, timezone: Activity["timezone"]) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(start));
}

function straightLineDistanceKm(from: [number, number], to: [number, number]) {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const [fromLatitude, fromLongitude] = from;
  const [toLatitude, toLongitude] = to;
  const latitudeDelta = radians(toLatitude - fromLatitude);
  const longitudeDelta = radians(toLongitude - fromLongitude);
  const firstLatitude = radians(fromLatitude);
  const secondLatitude = radians(toLatitude);
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(firstLatitude) * Math.cos(secondLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return 6_371 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function bypassMode(day: TripDay, target: Activity, distanceKm: number): TravelMode {
  const authoredMode = target.travelFromPrevious?.mode;
  if (day.kind === "drive" || authoredMode === "drive") return "drive";
  if (distanceKm <= 0.35 && authoredMode === "indoor") return "indoor";
  if (distanceKm <= 2.2) return "walk";
  if (authoredMode === "train") return "train";
  return "transit";
}

function estimatedBypassLeg(day: TripDay, from: Activity, to: Activity): TravelLeg {
  const original = to.travelFromPrevious;
  if (!from.coordinates || !to.coordinates) {
    return {
      mode: original?.mode ?? "transit",
      summary: `${from.title}→${to.title}（需重新導航）`,
      minutes: original?.minutes ?? 20,
      bufferMin: original?.bufferMin ?? 10,
      note: "已省略中間站；此段缺少完整座標，出發前請以 Google Maps 重新確認。",
    };
  }

  // Straight-line distance is padded before converting to a conservative
  // planning time. This is intentionally a schedule estimate, not navigation.
  const distanceKm = straightLineDistanceKm(from.coordinates, to.coordinates) * 1.25;
  const mode = bypassMode(day, to, distanceKm);
  const minutes = Math.max(1, Math.ceil(
    mode === "walk" ? distanceKm / 4.5 * 60
      : mode === "drive" ? distanceKm / 35 * 60 + 5
        : mode === "train" ? distanceKm / 40 * 60 + 10
          : mode === "indoor" ? distanceKm / 3.5 * 60 + 4
            : distanceKm / 18 * 60 + 10,
  ));

  return {
    mode,
    summary: `${from.title}→${to.title}（省略後估算）`,
    minutes,
    bufferMin: original?.bufferMin ?? 10,
    note: "已依新起點重算；出發時仍請以 Google Maps 的即時路況為準。",
  };
}

/**
 * Applies a day-of delay without mutating the authored itinerary. Flexible,
 * explicitly timed stops shift from the anchor until the next protected stop;
 * the protected stop keeps its time and ends propagation. Chosen flexible
 * stops can be omitted anywhere at or after the anchor.
 */
export function applyDayAdaptation(
  day: TripDay,
  adaptation: DayAdaptation | null | undefined = day.adaptation,
): TripDay {
  if (!adaptation) return day;
  const anchorIndex = day.activities.findIndex((activity) => activity.id === adaptation.fromActivityId);
  if (anchorIndex < 0) return day;

  const skipped = new Set(adaptation.skippedActivityIds);
  let delayPropagates = false;
  let previousRetained: Activity | null = null;
  let skippedSincePrevious = false;
  const activities: Activity[] = [];

  day.activities.forEach((activity, index) => {
    if (index === anchorIndex) delayPropagates = true;
    if (index > anchorIndex && delayPropagates && isProtectedActivity(activity)) {
      delayPropagates = false;
    }

    if (index >= anchorIndex && skipped.has(activity.id) && !isProtectedActivity(activity)) {
      skippedSincePrevious = true;
      return;
    }
    let resolvedActivity = activity;
    if (!delayPropagates || isProtectedActivity(activity) || !activity.start || activity.vague) {
      resolvedActivity = activity;
    } else {
      const start = shiftedIsoString(activity.start, adaptation.delayMin);
      resolvedActivity = { ...activity, start, timeLabel: shiftedTimeLabel(start, activity.timezone) };
    }

    if (skippedSincePrevious && previousRetained) {
      resolvedActivity = {
        ...resolvedActivity,
        travelFromPrevious: estimatedBypassLeg(day, previousRetained, resolvedActivity),
      };
    }
    activities.push(resolvedActivity);
    previousRetained = resolvedActivity;
    skippedSincePrevious = false;
  });

  return { ...day, activities, adaptation };
}

export function resolveDayActivities(
  day: TripDay,
  intensity: Intensity,
  rainy: boolean,
): { visible: Activity[]; hidden: Activity[]; all: Activity[] } {
  const adapted = applyDayAdaptation(day);
  // Rain replacements are resolved before intensity so an optional outdoor stop
  // cannot accidentally promote its indoor fallback into a lighter itinerary.
  const resolved = adapted.activities.map((activity) => {
    if (!rainy || !activity.outdoors || activity.fixed || activity.ticketed || !activity.rainAlternative) {
      return activity;
    }

    return {
      ...activity.rainAlternative,
      priority: activity.priority,
      timeLabel: activity.timeLabel,
      start: activity.start,
      timezone: activity.timezone,
      durationMin: activity.durationMin,
      travelFromPrevious: activity.rainAlternative.travelFromPrevious ?? activity.travelFromPrevious,
    } satisfies Activity;
  });

  const allowed = new Set(allowedPriority[intensity]);
  return {
    visible: resolved.filter((activity) => allowed.has(activity.priority)),
    hidden: resolved.filter((activity) => !allowed.has(activity.priority)),
    all: resolved,
  };
}

export type ScheduleCheck = {
  id: string;
  from: Activity;
  to: Activity;
  availableMin: number;
  requiredMin: number;
  slackMin: number;
  state: "conflict" | "tight" | "clear";
};

/**
 * Checks adjacent, explicitly timed stops. Vague APSA blocks are intentionally
 * omitted until their real start time is known.
 */
export function checkSchedule(activities: Activity[]): ScheduleCheck[] {
  const timed = activities.filter((activity) => activity.start && !activity.vague);
  const checks: ScheduleCheck[] = [];

  for (let index = 1; index < timed.length; index += 1) {
    const from = timed[index - 1];
    const to = timed[index];
    const availableMin = Math.round((new Date(to.start!).getTime() - new Date(from.start!).getTime()) / 60_000);
    const requiredMin = from.durationMin + (to.travelFromPrevious?.minutes ?? 0) + (to.travelFromPrevious?.bufferMin ?? 0);
    const slackMin = availableMin - requiredMin;
    checks.push({
      id: `${from.id}--${to.id}`,
      from,
      to,
      availableMin,
      requiredMin,
      slackMin,
      state: slackMin < 0 ? "conflict" : slackMin < 15 ? "tight" : "clear",
    });
  }

  return checks;
}

export type DelaySkipSuggestion = {
  activity: Activity;
  projectedSkippedActivityIds: string[];
  checks: ScheduleCheck[];
  conflictCount: number;
  tightCount: number;
  shortageMin: number;
  resolvesAllConflicts: boolean;
};

export type DelaySuggestionOptions = {
  intensity?: Intensity;
  rainy?: boolean;
  limit?: number;
};

/**
 * Ranks removable stops for a delay preview. Optional stops always come before
 * recommended ones; essential and protected stops are never suggested. Each
 * result includes a freshly calculated schedule for the proposed omission.
 */
export function suggestDelaySkips(
  day: TripDay,
  adaptation: DayAdaptation,
  options: DelaySuggestionOptions = {},
): DelaySkipSuggestion[] {
  const anchorIndex = day.activities.findIndex((activity) => activity.id === adaptation.fromActivityId);
  if (anchorIndex < 0) return [];
  const intensity = options.intensity ?? "full";
  const rainy = options.rainy ?? false;
  const allowed = new Set(allowedPriority[intensity]);
  const alreadySkipped = new Set(adaptation.skippedActivityIds);
  const originalIndex = new Map(day.activities.map((activity, index) => [activity.id, index]));
  const priorityRank: Record<"optional" | "recommended", number> = { optional: 0, recommended: 1 };

  return day.activities
    .filter((activity, index): activity is Activity & { priority: "optional" | "recommended" } => (
      index >= anchorIndex
      && (activity.priority === "optional" || activity.priority === "recommended")
      && allowed.has(activity.priority)
      && !alreadySkipped.has(activity.id)
      && !isProtectedActivity(activity)
    ))
    .map((activity) => {
      const projectedSkippedActivityIds = [...adaptation.skippedActivityIds, activity.id]
        .sort((left, right) => (originalIndex.get(left) ?? 0) - (originalIndex.get(right) ?? 0));
      const projectedDay = {
        ...day,
        adaptation: { ...adaptation, skippedActivityIds: projectedSkippedActivityIds },
      };
      const checks = checkSchedule(resolveDayActivities(projectedDay, intensity, rainy).visible);
      const conflicts = checks.filter((check) => check.state === "conflict");
      return {
        activity,
        projectedSkippedActivityIds,
        checks,
        conflictCount: conflicts.length,
        tightCount: checks.filter((check) => check.state === "tight").length,
        shortageMin: conflicts.reduce((total, check) => total + Math.abs(check.slackMin), 0),
        resolvesAllConflicts: conflicts.length === 0,
      } satisfies DelaySkipSuggestion;
    })
    .sort((left, right) => (
      priorityRank[left.activity.priority] - priorityRank[right.activity.priority]
      || left.shortageMin - right.shortageMin
      || (originalIndex.get(left.activity.id) ?? 0) - (originalIndex.get(right.activity.id) ?? 0)
    ))
    .slice(0, Math.max(0, options.limit ?? 3));
}

export function bostonIsoDate(now: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export type StopState =
  | { phase: "before"; current: null; next: Activity; countdownMs: number }
  | { phase: "active"; current: Activity | null; next: Activity | null; countdownMs: number | null }
  | { phase: "complete"; current: null; next: null; countdownMs: null };

function flatten(days: TripDay[]) {
  return days.flatMap((day) => day.activities.map((activity) => ({ ...activity, dayId: day.id, isoDate: day.isoDate })));
}

function tripBounds(days: TripDay[]) {
  const timed = flatten(days).flatMap((activity) => {
    if (!activity.start) return [];
    const start = new Date(activity.start).getTime();
    if (!Number.isFinite(start)) return [];
    return [{ start, end: start + Math.max(0, activity.durationMin) * 60_000 }];
  });
  if (!timed.length) return null;
  return {
    start: Math.min(...timed.map((item) => item.start)),
    end: Math.max(...timed.map((item) => item.end)),
  };
}

export function getStopState(
  now: Date,
  days: TripDay[],
  completedIds: Set<string>,
  manualActivityId?: string | null,
): StopState {
  const all = flatten(days);
  const nowMs = now.getTime();
  const bounds = tripBounds(days);

  if (bounds && nowMs < bounds.start) {
    const first = all.find((activity) => activity.start);
    if (!first) return { phase: "complete", current: null, next: null, countdownMs: null };
    return { phase: "before", current: null, next: first, countdownMs: new Date(first.start!).getTime() - nowMs };
  }

  if (bounds && nowMs > bounds.end) {
    return { phase: "complete", current: null, next: null, countdownMs: null };
  }

  if (manualActivityId) {
    const index = all.findIndex((activity) => activity.id === manualActivityId);
    if (index >= 0) {
      const current = all[index];
      const next = all.slice(index + 1).find((activity) => !completedIds.has(activity.id)) ?? null;
      return {
        phase: "active",
        current,
        next,
        countdownMs: next?.start ? Math.max(0, new Date(next.start).getTime() - nowMs) : null,
      };
    }
  }

  const timed = all.filter((activity) => activity.start && !completedIds.has(activity.id));
  const current = timed.find((activity) => {
    const start = new Date(activity.start!).getTime();
    return start <= nowMs && nowMs < start + activity.durationMin * 60_000;
  }) ?? null;
  const next = timed.find((activity) => new Date(activity.start!).getTime() > nowMs) ?? null;

  // A vague block such as "上午" or "下午" must not eclipse explicitly timed
  // stops. It remains an unfinished task and becomes the next item only when
  // today's timed sequence no longer has something more precise to show.
  const bostonDate = bostonIsoDate(now);
  const vagueToday = all.find(
    (activity) => activity.vague && activity.isoDate === bostonDate && !completedIds.has(activity.id),
  ) ?? null;

  return {
    phase: "active",
    current,
    next: next ?? (!current ? vagueToday : null),
    countdownMs: next?.start ? new Date(next.start).getTime() - nowMs : null,
  };
}

export function filterMapActivities(
  days: TripDay[],
  selectedDayId: string,
  allDays: boolean,
  categories: Set<ActivityCategory>,
) {
  return days
    .filter((day) => allDays || day.id === selectedDayId)
    .flatMap((day) => day.activities
      .filter((activity) => activity.coordinates && categories.has(activity.category))
      .map((activity) => ({ day, activity })));
}

export function formatCountdown(milliseconds: number | null) {
  if (milliseconds === null) return "時間待確認";
  if (milliseconds <= 0) return "現在";
  const totalMinutes = Math.ceil(milliseconds / 60_000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days} 天 ${hours} 小時`;
  if (hours > 0) return `${hours} 小時 ${minutes} 分`;
  return `${minutes} 分`;
}
