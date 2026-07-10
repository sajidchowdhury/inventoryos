// src/lib/schedule-compute.ts
// Phase C: nextRunAt computation logic for report schedules.
//
// Given a schedule's frequency + dayOfWeek/dayOfMonth/startDate, computes the
// next run date. Used:
//   - On schedule create/update (to set initial nextRunAt)
//   - After each run (to compute the next run)
//   - By the schedule-checker cron (to verify nextRunAt is correct)

/**
 * Compute the next run date for a schedule.
 *
 * @param frequency - "weekly" | "monthly" | "date_range"
 * @param dayOfWeek - For weekly: 0=Sun, 1=Mon, ..., 6=Sat
 * @param dayOfMonth - For monthly: 1-28
 * @param startDate - For date_range: the start date
 * @param endDate - For date_range: the end date (null = no end)
 * @param lastRunAt - The last time this schedule ran (null = never)
 * @param now - Current time (default: new Date())
 * @returns The next run date, or null if the schedule has ended (date_range past endDate)
 */
export function computeNextRunAt(
  frequency: string,
  dayOfWeek: number | null | undefined,
  dayOfMonth: number | null | undefined,
  startDate: Date | null | undefined,
  endDate: Date | null | undefined,
  lastRunAt: Date | null | undefined,
  now: Date = new Date()
): Date | null {
  if (frequency === "weekly") {
    return computeNextWeeklyRun(dayOfWeek, lastRunAt, now);
  } else if (frequency === "monthly") {
    return computeNextMonthlyRun(dayOfMonth, lastRunAt, now);
  } else if (frequency === "date_range") {
    return computeNextDateRangeRun(startDate, endDate, lastRunAt, now);
  }
  return null;
}

/**
 * Weekly: next occurrence of dayOfWeek at 06:00 UTC.
 * If today is the target day and we haven't run yet today, run today.
 * If today is the target day and we already ran today, run next week.
 * Otherwise, run on the next occurrence of dayOfWeek.
 */
function computeNextWeeklyRun(
  dayOfWeek: number | null | undefined,
  lastRunAt: Date | null | undefined,
  now: Date
): Date | null {
  if (dayOfWeek === null || dayOfWeek === undefined) return null;

  const nextRun = new Date(now);
  nextRun.setUTCHours(6, 0, 0, 0); // 06:00 UTC

  const currentDay = nextRun.getUTCDay();
  let daysUntilTarget = (dayOfWeek - currentDay + 7) % 7;

  // If today is the target day:
  if (daysUntilTarget === 0) {
    // If we already ran today (lastRunAt is today), schedule for next week
    if (lastRunAt) {
      const lastRunDay = new Date(lastRunAt);
      lastRunDay.setUTCHours(0, 0, 0, 0);
      const todayMidnight = new Date(now);
      todayMidnight.setUTCHours(0, 0, 0, 0);

      if (lastRunDay.getTime() >= todayMidnight.getTime()) {
        // Already ran today → next week
        daysUntilTarget = 7;
      }
    }
    // If we haven't run today and it's before 06:00 UTC, run today
    // If it's after 06:00 UTC and we haven't run today, still schedule today
    // (the checker will pick it up immediately)
  }

  nextRun.setUTCDate(nextRun.getUTCDate() + daysUntilTarget);
  return nextRun;
}

/**
 * Monthly: next occurrence of dayOfMonth at 06:00 UTC.
 * If today is the target day and we haven't run yet, run today.
 * If the target day has passed this month, run next month.
 * Clamped to day 28 to avoid skipped months (Feb has 28 days).
 */
function computeNextMonthlyRun(
  dayOfMonth: number | null | undefined,
  lastRunAt: Date | null | undefined,
  now: Date
): Date | null {
  if (!dayOfMonth || dayOfMonth < 1 || dayOfMonth > 28) return null;

  const nextRun = new Date(now);
  nextRun.setUTCHours(6, 0, 0, 0);

  const currentDay = nextRun.getUTCDate();

  if (currentDay < dayOfMonth) {
    // Target day is later this month
    nextRun.setUTCDate(dayOfMonth);
  } else if (currentDay > dayOfMonth) {
    // Target day has passed → next month
    nextRun.setUTCMonth(nextRun.getUTCMonth() + 1);
    nextRun.setUTCDate(dayOfMonth);
  } else {
    // Today is the target day
    if (lastRunAt) {
      const lastRunDay = new Date(lastRunAt);
      lastRunDay.setUTCHours(0, 0, 0, 0);
      const todayMidnight = new Date(now);
      todayMidnight.setUTCHours(0, 0, 0, 0);

      if (lastRunDay.getTime() >= todayMidnight.getTime()) {
        // Already ran today → next month
        nextRun.setUTCMonth(nextRun.getUTCMonth() + 1);
        nextRun.setUTCDate(dayOfMonth);
      }
    }
  }

  return nextRun;
}

/**
 * Date range: runs once per day from startDate to endDate at 06:00 UTC.
 * If startDate is in the future, next run is startDate.
 * If we're within the range and haven't run today, next run is today.
 * If we've run today, next run is tomorrow.
 * If we're past endDate, return null (schedule is done).
 */
function computeNextDateRangeRun(
  startDate: Date | null | undefined,
  endDate: Date | null | undefined,
  lastRunAt: Date | null | undefined,
  now: Date
): Date | null {
  if (!startDate) return null;

  const start = new Date(startDate);
  start.setUTCHours(6, 0, 0, 0);

  // If start date is in the future, next run is the start date
  if (start.getTime() > now.getTime()) {
    return start;
  }

  // If we're past the end date, schedule is done
  if (endDate) {
    const end = new Date(endDate);
    end.setUTCHours(23, 59, 59, 999);
    if (end.getTime() < now.getTime()) {
      return null; // Schedule has ended
    }
  }

  // We're within the range. Next run is today or tomorrow.
  const nextRun = new Date(now);
  nextRun.setUTCHours(6, 0, 0, 0);

  // If we already ran today, schedule for tomorrow
  if (lastRunAt) {
    const lastRunDay = new Date(lastRunAt);
    lastRunDay.setUTCHours(0, 0, 0, 0);
    const todayMidnight = new Date(now);
    todayMidnight.setUTCHours(0, 0, 0, 0);

    if (lastRunDay.getTime() >= todayMidnight.getTime()) {
      // Already ran today → tomorrow
      nextRun.setUTCDate(nextRun.getUTCDate() + 1);
    }
  }

  // If next run would be past end date, return null
  if (endDate) {
    const end = new Date(endDate);
    end.setUTCHours(23, 59, 59, 999);
    if (nextRun.getTime() > end.getTime()) {
      return null;
    }
  }

  return nextRun;
}

/**
 * Format a frequency + day config into a human-readable string.
 * Used by the UI to display "Every Monday" or "1st of every month" etc.
 */
export function formatFrequency(
  frequency: string,
  dayOfWeek: number | null | undefined,
  dayOfMonth: number | null | undefined,
  startDate: Date | null | undefined,
  endDate: Date | null | undefined
): string {
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const ordinals = ["", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th",
    "11th", "12th", "13th", "14th", "15th", "16th", "17th", "18th", "19th", "20th",
    "21st", "22nd", "23rd", "24th", "25th", "26th", "27th", "28th"];

  if (frequency === "weekly" && dayOfWeek !== null && dayOfWeek !== undefined) {
    return `Every ${dayNames[dayOfWeek]}`;
  } else if (frequency === "monthly" && dayOfMonth) {
    return `${ordinals[dayOfMonth]} of every month`;
  } else if (frequency === "date_range") {
    const start = startDate ? new Date(startDate).toLocaleDateString() : "??";
    const end = endDate ? new Date(endDate).toLocaleDateString() : "ongoing";
    return `Daily from ${start} to ${end}`;
  }
  return frequency;
}
