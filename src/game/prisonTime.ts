export type PrisonTimeUnit = 'minute' | 'hour' | 'month' | 'year';

export const MINUTES_PER_HOUR = 60;
export const MINUTES_PER_DAY = 1440; // 24 * 60
export const MINUTES_PER_MONTH = 43200; // 30 * 24 * 60
export const MINUTES_PER_YEAR = 518400; // 12 * 30 * 24 * 60

export interface RemainingPrisonParts {
  totalMinutes: number;
  years: number;
  months: number;
  days: number;
  hours: number;
  minutes: number;
}

export function durationToMinutes(value: number, unit: PrisonTimeUnit): number {
  const safe = Number.isFinite(value) ? Math.max(1, Math.floor(value)) : 1;
  switch (unit) {
    case 'year':
      return safe * MINUTES_PER_YEAR;
    case 'month':
      return safe * MINUTES_PER_MONTH;
    case 'hour':
      return safe * MINUTES_PER_HOUR;
    case 'minute':
    default:
      return safe;
  }
}

export function decomposeRemainingMinutes(remainingMinutes: number): RemainingPrisonParts {
  const totalMinutes = Math.max(0, Math.ceil(remainingMinutes));
  const years = Math.floor(totalMinutes / MINUTES_PER_YEAR);
  const remAfterYears = totalMinutes % MINUTES_PER_YEAR;

  const months = Math.floor(remAfterYears / MINUTES_PER_MONTH);
  const remAfterMonths = remAfterYears % MINUTES_PER_MONTH;

  const days = Math.floor(remAfterMonths / MINUTES_PER_DAY);
  const remAfterDays = remAfterMonths % MINUTES_PER_DAY;

  const hours = Math.floor(remAfterDays / MINUTES_PER_HOUR);
  const minutes = remAfterDays % MINUTES_PER_HOUR;

  return { totalMinutes, years, months, days, hours, minutes };
}

function formatArabicUnit(
  count: number,
  singular: string,
  dual: string,
  pluralFew: string,
  pluralMany: string
): string {
  if (count === 1) return singular;
  if (count === 2) return dual;
  if (count >= 3 && count <= 10) return `${count} ${pluralFew}`;
  return `${count} ${pluralMany}`;
}

export function formatRemainingPrisonTime(
  remainingMinutes: number,
  maxParts: number = 4
): string {
  const p = decomposeRemainingMinutes(remainingMinutes);
  if (p.totalMinutes <= 0) {
    return 'انتهت المدة';
  }

  const parts: string[] = [];
  if (p.years > 0) {
    parts.push(formatArabicUnit(p.years, 'سنة واحدة', 'سنتان', 'سنوات', 'سنة'));
  }
  if (p.months > 0) {
    parts.push(formatArabicUnit(p.months, 'شهر واحد', 'شهران', 'أشهر', 'شهراً'));
  }
  if (p.days > 0) {
    parts.push(formatArabicUnit(p.days, 'يوم واحد', 'يومان', 'أيام', 'يوماً'));
  }
  if (p.hours > 0) {
    parts.push(formatArabicUnit(p.hours, 'ساعة واحدة', 'ساعتان', 'ساعات', 'ساعة'));
  }
  if (p.minutes > 0 || parts.length === 0) {
    parts.push(formatArabicUnit(p.minutes, 'دقيقة واحدة', 'دقيقتان', 'دقائق', 'دقيقة'));
  }

  return parts.slice(0, maxParts).join(' و ');
}
