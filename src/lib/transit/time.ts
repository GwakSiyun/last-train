import type { DayType, ServiceMinutes } from './types';

const SERVICE_DAY_START_HOUR = 4;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export interface SeoulNow {
  minutes: ServiceMinutes;
  dayType: DayType;
}

/**
 * 서울 기준 현재 운행일 시각.
 * 00:00~03:59는 전날 운행일의 24:00~27:59로 본다.
 * ⚠️ 공휴일은 판별하지 않음 — 평일 공휴일도 WEEKDAY로 계산된다.
 */
export function nowInSeoul(date: Date = new Date()): SeoulNow {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hourCycle: 'h23',
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((p) => p.type === type)?.value ?? '';

  const hour = Number(get('hour'));
  const minute = Number(get('minute'));
  let weekdayIndex = WEEKDAYS.indexOf(get('weekday') as (typeof WEEKDAYS)[number]);

  let minutes = hour * 60 + minute;
  if (hour < SERVICE_DAY_START_HOUR) {
    minutes += 24 * 60;
    weekdayIndex = (weekdayIndex + 6) % 7;
  }

  const dayType: DayType =
    weekdayIndex === 0 ? 'HOLIDAY' : weekdayIndex === 6 ? 'SATURDAY' : 'WEEKDAY';

  return { minutes, dayType };
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
