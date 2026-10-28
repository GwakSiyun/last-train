import type { DayType, ServiceMinutes } from './types';

const SERVICE_DAY_START_HOUR = 4;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export interface SeoulNow {
  minutes: ServiceMinutes;
  /** 요일 기준 (공휴일은 withHoliday로 덮어쓴다) */
  dayType: DayType;
  /** 운행일 날짜 "YYYYMMDD" — 새벽 1시면 전날 */
  serviceDate: string;
  /** 오늘이 공휴일이면 이름 (예: "개천절") */
  holidayName?: string;
}

function seoulParts(date: Date, options: Intl.DateTimeFormatOptions): Record<string, string> {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul', ...options }).formatToParts(date);
  return Object.fromEntries(parts.map((p) => [p.type, p.value]));
}

/**
 * 서울 기준 현재 운행일 시각.
 * 00:00~03:59는 전날 운행일의 24:00~27:59로 본다.
 * 공휴일은 여기서 판별하지 않는다 (withHoliday 참고).
 */
export function nowInSeoul(date: Date = new Date()): SeoulNow {
  const clock = seoulParts(date, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const hour = Number(clock.hour);
  let minutes = hour * 60 + Number(clock.minute);
  if (hour < SERVICE_DAY_START_HOUR) minutes += 24 * 60;

  // 운행일 = 4시간 전 시각의 날짜·요일
  const serviceDay = seoulParts(new Date(date.getTime() - SERVICE_DAY_START_HOUR * 60 * 60 * 1000), {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  });
  const weekdayIndex = WEEKDAYS.indexOf(serviceDay.weekday as (typeof WEEKDAYS)[number]);
  const dayType: DayType = weekdayIndex === 0 ? 'HOLIDAY' : weekdayIndex === 6 ? 'SATURDAY' : 'WEEKDAY';

  return { minutes, dayType, serviceDate: `${serviceDay.year}${serviceDay.month}${serviceDay.day}` };
}

/** 공휴일이면 휴일 시간표로 */
export function withHoliday(now: SeoulNow, holidayName: string | null): SeoulNow {
  return holidayName ? { ...now, dayType: 'HOLIDAY', holidayName } : now;
}

/** 1470 → "00:30" */
export function formatClock(minutes: ServiceMinutes): string {
  const m = ((minutes % 1440) + 1440) % 1440;
  const hh = String(Math.floor(m / 60)).padStart(2, '0');
  const mm = String(m % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

/** 95 → "1시간 35분" */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}분`;
  return m === 0 ? `${h}시간` : `${h}시간 ${m}분`;
}

export const DAY_TYPE_LABEL: Record<DayType, string> = {
  WEEKDAY: '평일',
  SATURDAY: '토요일',
  HOLIDAY: '휴일',
};
