/**
 * Streak: consecutive calendar days (Europe/Berlin) with at least one XP
 * event. The current streak still counts if today has no activity yet but
 * yesterday had.
 */

const berlinDay = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Berlin",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** YYYY-MM-DD of the instant in Germany. */
export function toBerlinDay(date: Date): string {
  return berlinDay.format(date);
}

function shiftDay(day: string, delta: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

export type StreakInfo = {
  current: number;
  longest: number;
  /** True if today already has an XP event. */
  activeToday: boolean;
};

export function computeStreak(eventDates: readonly (string | Date)[], now: Date = new Date()): StreakInfo {
  const days = new Set(eventDates.map((d) => toBerlinDay(typeof d === "string" ? new Date(d) : d)));
  const today = toBerlinDay(now);
  const activeToday = days.has(today);

  let current = 0;
  let day = activeToday ? today : shiftDay(today, -1);
  while (days.has(day)) {
    current += 1;
    day = shiftDay(day, -1);
  }

  let longest = 0;
  for (const start of days) {
    // Only count runs from their first day.
    if (days.has(shiftDay(start, -1))) continue;
    let length = 0;
    let next = start;
    while (days.has(next)) {
      length += 1;
      next = shiftDay(next, 1);
    }
    longest = Math.max(longest, length);
  }

  return { current, longest, activeToday };
}
