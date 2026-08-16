import type { DateRangeOption } from "../types/history";
import { isCleanCorrection } from "./feedbackParsing";
import { shortDayLabel } from "./format";

export interface TurnLike {
  created_at: string;
  corrections: string;
}

export interface Bucket {
  label: string;
  shortLabel: string;
  count: number;
  cleanCount: number;
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export function buildDailyBuckets(turns: TurnLike[], days: number): Bucket[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const buckets: (Bucket & { date: Date })[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const label = shortDayLabel(date);
    buckets.push({ date, label, shortLabel: label, count: 0, cleanCount: 0 });
  }

  const byKey = new Map(buckets.map((bucket) => [dayKey(bucket.date), bucket]));

  turns.forEach((turn) => {
    const bucket = byKey.get(dayKey(new Date(turn.created_at)));
    if (bucket) {
      bucket.count += 1;
      if (isCleanCorrection(turn.corrections)) {
        bucket.cleanCount += 1;
      }
    }
  });

  return buckets;
}

export function buildWeeklyBuckets(turns: TurnLike[], weeks: number): Bucket[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const buckets: (Bucket & { start: Date; endExclusive: Date })[] = [];
  for (let i = weeks - 1; i >= 0; i -= 1) {
    const start = new Date(today);
    start.setDate(start.getDate() - i * 7 - 6);
    const endExclusive = new Date(start);
    endExclusive.setDate(endExclusive.getDate() + 7);
    const lastDay = new Date(endExclusive);
    lastDay.setDate(lastDay.getDate() - 1);

    buckets.push({
      start,
      endExclusive,
      label: `${shortDayLabel(start)} - ${shortDayLabel(lastDay)}`,
      shortLabel: shortDayLabel(start),
      count: 0,
      cleanCount: 0,
    });
  }

  turns.forEach((turn) => {
    const created = new Date(turn.created_at);
    const bucket = buckets.find((b) => created >= b.start && created < b.endExclusive);
    if (bucket) {
      bucket.count += 1;
      if (isCleanCorrection(turn.corrections)) {
        bucket.cleanCount += 1;
      }
    }
  });

  return buckets;
}

export function rangeToDays(range: DateRangeOption): number | null {
  if (range === "7" || range === "30" || range === "90") {
    return Number(range);
  }
  return null;
}

export function filterTurnsByRange<T extends TurnLike>(turns: T[], range: DateRangeOption): T[] {
  const days = rangeToDays(range);
  if (days === null) {
    return turns;
  }

  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - (days - 1));

  return turns.filter((turn) => new Date(turn.created_at) >= cutoff);
}

export function buildBuckets(
  turns: TurnLike[],
  allTurns: TurnLike[],
  range: DateRangeOption,
): Bucket[] {
  const days = rangeToDays(range);

  if (days === 7 || days === 30) {
    return buildDailyBuckets(turns, days);
  }

  if (days === 90) {
    return buildWeeklyBuckets(turns, 13);
  }

  const oldest = allTurns.length
    ? allTurns.reduce(
        (min, turn) => Math.min(min, new Date(turn.created_at).getTime()),
        Date.now(),
      )
    : Date.now();
  const spanWeeks = Math.max(1, Math.ceil((Date.now() - oldest) / (7 * 24 * 60 * 60 * 1000)) + 1);
  const weeks = Math.min(52, spanWeeks);

  return buildWeeklyBuckets(turns, weeks);
}

function localDayNumber(date: Date): number {
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / oneDay);
}

export interface StreakResult {
  current: number;
  longest: number;
}

export function computeStreaks(turns: TurnLike[]): StreakResult {
  const dayNumbers = Array.from(
    new Set(turns.map((turn) => localDayNumber(new Date(turn.created_at)))),
  ).sort((a, b) => a - b);

  if (dayNumbers.length === 0) {
    return { current: 0, longest: 0 };
  }

  let longest = 1;
  let run = 1;

  for (let i = 1; i < dayNumbers.length; i += 1) {
    run = dayNumbers[i] - dayNumbers[i - 1] === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
  }

  const todayNumber = localDayNumber(new Date());
  const lastDayNumber = dayNumbers[dayNumbers.length - 1];

  let current = 0;
  if (todayNumber - lastDayNumber <= 1) {
    current = 1;
    for (let i = dayNumbers.length - 1; i > 0; i -= 1) {
      if (dayNumbers[i] - dayNumbers[i - 1] === 1) {
        current += 1;
      } else {
        break;
      }
    }
  }

  return { current, longest };
}
