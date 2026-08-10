import type { Activity, ActivityCategory, ActivityPriority, TripDay } from "./trip-data";
import { tripEnd, tripStart } from "./trip-data";

export type Intensity = "relaxed" | "standard" | "full";

const allowedPriority: Record<Intensity, ActivityPriority[]> = {
  relaxed: ["essential"],
  standard: ["essential", "recommended"],
  full: ["essential", "recommended", "optional"],
};

export function resolveDayActivities(
  day: TripDay,
  intensity: Intensity,
  rainy: boolean,
): { visible: Activity[]; hidden: Activity[] } {
  // Rain replacements are resolved before intensity so an optional outdoor stop
  // cannot accidentally promote its indoor fallback into a lighter itinerary.
  const resolved = day.activities.map((activity) => {
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
  };
}

export type StopState =
  | { phase: "before"; current: null; next: Activity; countdownMs: number }
  | { phase: "active"; current: Activity | null; next: Activity | null; countdownMs: number | null }
  | { phase: "complete"; current: null; next: null; countdownMs: null };

function flatten(days: TripDay[]) {
  return days.flatMap((day) => day.activities.map((activity) => ({ ...activity, dayId: day.id, isoDate: day.isoDate })));
}

export function getStopState(
  now: Date,
  days: TripDay[],
  completedIds: Set<string>,
  manualActivityId?: string | null,
): StopState {
  const all = flatten(days);
  const nowMs = now.getTime();

  if (nowMs < new Date(tripStart).getTime()) {
    const first = all.find((activity) => activity.start);
    if (!first) return { phase: "complete", current: null, next: null, countdownMs: null };
    return { phase: "before", current: null, next: first, countdownMs: new Date(first.start!).getTime() - nowMs };
  }

  if (nowMs > new Date(tripEnd).getTime()) {
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

  const bostonDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

  const vagueToday = all.find(
    (activity) => activity.vague && activity.isoDate === bostonDate && !completedIds.has(activity.id),
  );
  if (vagueToday) {
    const next = all.slice(all.findIndex((item) => item.id === vagueToday.id) + 1).find((item) => !completedIds.has(item.id)) ?? null;
    return { phase: "active", current: vagueToday, next, countdownMs: next?.start ? Math.max(0, new Date(next.start).getTime() - nowMs) : null };
  }

  const timed = all.filter((activity) => activity.start && !completedIds.has(activity.id));
  const current = timed.find((activity) => {
    const start = new Date(activity.start!).getTime();
    return start <= nowMs && nowMs < start + activity.durationMin * 60_000;
  }) ?? null;
  const next = timed.find((activity) => new Date(activity.start!).getTime() > nowMs) ?? null;

  return {
    phase: "active",
    current,
    next,
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
