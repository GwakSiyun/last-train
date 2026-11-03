'use server';

import { hasKakaoKey, searchPlaces } from '@/lib/transit/kakao';
import { planAllRoutes, type SortKey } from '@/lib/transit/planner';
import { getProviders } from '@/lib/transit/providers';
import type { DayType, PlaceOption, PlanResult, Route, RouteArrival, Segment } from '@/lib/transit/types';

/**
 * 브라우저가 ODsay에서 받은 경로 → 서버가 서울 시간표로 막차 계산.
 * 입력은 브라우저에서 오므로(조작 가능) 형태·크기를 검증한다. 시간표 키는 서버에만 있다.
 */

const DAY_TYPES: readonly DayType[] = ['WEEKDAY', 'SATURDAY', 'HOLIDAY'];
const SORT_KEYS: readonly SortKey[] = ['late', 'fast', 'transfer'];
const MAX_ROUTES = 6;
const MAX_SEGMENTS = 8;

export type PlanActionResult = { ok: true; plans: PlanResult[] } | { ok: false; message: string };

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const isText = (v: unknown, max = 40): v is string => typeof v === 'string' && v.length > 0 && v.length <= max;
/** 빠른 환승 위치 — 없거나 이상하면 버린다(경로 자체는 유효) */
const optionalShort = (v: unknown): string | undefined => (isText(v, 12) ? v : undefined);
const isMinutes = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 300;

function toSegment(v: unknown): Segment | null {
  if (!isObject(v) || !isObject(v.from) || !isObject(v.to)) return null;
  const { line, direction, rideMinutes } = v;
  if (!isText(line) || typeof direction !== 'string' || direction.length > 60 || !isMinutes(rideMinutes)) return null;
  if (!isText(v.from.name) || !isText(v.to.name)) return null;
  return {
    line,
    direction,
    rideMinutes,
    from: { name: v.from.name },
    to: { name: v.to.name },
    door: optionalShort(v.door),
  };
}

/** 마지막 역 → 목적지 정보 — 없거나 이상하면 버린다(경로 자체는 유효) */
function toArrival(v: unknown): RouteArrival | undefined {
  if (!isObject(v) || !isMinutes(v.walkMinutes)) return undefined;
  return { walkMinutes: v.walkMinutes, exitNo: optionalShort(v.exitNo) };
}

function toRoute(v: unknown): Route | null {
  if (!isObject(v) || !Array.isArray(v.segments) || !Array.isArray(v.transferWalkMinutes)) return null;
  if (v.segments.length === 0 || v.segments.length > MAX_SEGMENTS) return null;
  if (v.transferWalkMinutes.length !== v.segments.length - 1) return null;
  if (!isMinutes(v.walkToFirstStationMinutes) || !v.transferWalkMinutes.every(isMinutes)) return null;

  const segments = v.segments.map(toSegment);
  if (segments.some((s) => s === null)) return null;
  return {
    segments: segments as Segment[],
    walkToFirstStationMinutes: v.walkToFirstStationMinutes,
    transferWalkMinutes: v.transferWalkMinutes,
    arrival: toArrival(v.arrival),
  };
}

export async function planRoutesAction(
  rawRoutes: unknown,
  dayType: unknown,
  sort: unknown,
  bufferMinutes: unknown,
): Promise<PlanActionResult> {
  const buffer = isMinutes(bufferMinutes) ? Math.min(30, bufferMinutes) : 3;
  if (!Array.isArray(rawRoutes) || rawRoutes.length > MAX_ROUTES) return { ok: false, message: '경로 데이터가 올바르지 않아요.' };
  const day = DAY_TYPES.find((d) => d === dayType);
  const sortKey = SORT_KEYS.find((s) => s === sort);
  if (!day || !sortKey) return { ok: false, message: '요청 값이 올바르지 않아요.' };

  const routes = rawRoutes.map(toRoute);
  if (routes.some((r) => r === null)) return { ok: false, message: '경로 데이터가 올바르지 않아요.' };

  try {
    const plans = await planAllRoutes(
      routes as Route[],
      getProviders().timetable,
      { dayType: day, bufferMinutes: buffer },
      sortKey,
    );
    return { ok: true, plans };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : '막차를 계산하지 못했어요.' };
  }
}

const MAX_QUERY_LENGTH = 40;

/** 도착지 입력 자동완성 — 카카오 키는 서버에만 있어서 브라우저는 이 액션으로 검색한다 */
export async function searchPlacesAction(query: unknown): Promise<PlaceOption[]> {
  const q = typeof query === 'string' ? query.trim() : '';
  if (q.length < 2 || q.length > MAX_QUERY_LENGTH || !hasKakaoKey()) return [];
  try {
    return await searchPlaces(q);
  } catch {
    return []; // 자동완성 실패는 조용히 — 역 이름 입력은 그대로 된다
  }
}
