import type { DayType, PlannedLeg, PlanResult, Route, TimetableProvider } from './types';

export interface PlanOptions {
  dayType: DayType;
  /** 놓치지 않기 위한 여유 */
  bufferMinutes: number;
}

/**
 * 막차 역산.
 * 마지막 구간의 막차(내릴 역까지 가는 마지막 열차)에서 시작해 거꾸로 올라가며,
 * 각 구간마다 "다음 구간 열차를 탈 수 있는 가장 늦은 열차"를 고른다.
 */
export async function planLastTrain(
  route: Route,
  timetable: TimetableProvider,
  options: PlanOptions,
): Promise<PlanResult> {
  const { segments, transferWalkMinutes } = route;
  const legs: PlannedLeg[] = new Array(segments.length);

  let arriveBy: number | undefined;

  for (let i = segments.length - 1; i >= 0; i--) {
    const segment = segments[i];

    const [train, lastTrain] = await Promise.all([
      timetable.latestTrain({ segment, dayType: options.dayType, arriveBy }),
      arriveBy === undefined
        ? null
        : timetable.latestTrain({ segment, dayType: options.dayType }),
    ]);

    if (train.status !== 'OK') return { ok: false, route, reason: train.status, segment };

    legs[i] = {
      segment,
      departAt: train.departAt,
      arriveAt: train.arriveAt,
      isLastTrain:
        lastTrain === null || (lastTrain.status === 'OK' && lastTrain.departAt === train.departAt),
    };

    // 이전 구간은 환승 도보를 마치고 이 열차 출발 전에 도착해야 한다
    arriveBy = train.departAt - (transferWalkMinutes[i - 1] ?? 0);
  }

  const boardBy = legs[0].departAt;
  return {
    ok: true,
    route,
    legs,
    boardBy,
    leaveBy: boardBy - route.walkToFirstStationMinutes - options.bufferMinutes,
    arriveAt: legs[legs.length - 1].arriveAt,
  };
}

type OkPlan = Extract<PlanResult, { ok: true }>;

/** 늦게 출발 / 최단 시간 / 최소 환승 */
export type SortKey = 'late' | 'fast' | 'transfer';

export const SORT_KEYS: readonly SortKey[] = ['late', 'fast', 'transfer'];

/** 막차 기준으로 탔을 때 현재 위치 출발 → 최종 도착 (여유 시간 제외, 환승 대기 포함) */
export function tripMinutes(plan: OkPlan): number {
  return plan.arriveAt - (plan.boardBy - plan.route.walkToFirstStationMinutes);
}

export function transferCount(plan: PlanResult): number {
  return plan.route.segments.length - 1;
}

const COMPARE: Record<SortKey, (a: OkPlan, b: OkPlan) => number> = {
  late: (a, b) => b.leaveBy - a.leaveBy,
  fast: (a, b) => tripMinutes(a) - tripMinutes(b) || b.leaveBy - a.leaveBy,
  transfer: (a, b) => transferCount(a) - transferCount(b) || b.leaveBy - a.leaveBy,
};

/** 계산 불가 경로는 항상 뒤로 */
export function sortPlans(plans: PlanResult[], key: SortKey): PlanResult[] {
  return [...plans].sort((a, b) => {
    if (a.ok && b.ok) return COMPARE[key](a, b);
    return a.ok ? -1 : b.ok ? 1 : 0;
  });
}

/** 모든 경로를 계산해 정렬 (기본: 가장 늦게 출발해도 되는 순) */
export async function planAllRoutes(
  routes: Route[],
  timetable: TimetableProvider,
  options: PlanOptions,
  sort: SortKey = 'late',
): Promise<PlanResult[]> {
  const results = await Promise.all(routes.map((r) => planLastTrain(r, timetable, options)));
  return sortPlans(results, sort);
}
