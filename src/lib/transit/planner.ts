import type {
  DayType,
  PartialPlan,
  PlannedLeg,
  PlanResult,
  Route,
  Segment,
  ServiceMinutes,
  TimetableProvider,
  TrainResult,
} from './types';

export interface PlanOptions {
  dayType: DayType;
  /** 놓치지 않기 위한 여유 */
  bufferMinutes: number;
}

type BackwardResult =
  { ok: true; legs: PlannedLeg[] } | { ok: false; reason: Exclude<TrainResult['status'], 'OK'>; segment: Segment };

/**
 * segments[0..count-1]을 뒤에서부터 역산. arriveBy가 없으면 마지막 구간은 막차.
 * 각 구간마다 "다음 구간 열차를 탈 수 있는 가장 늦은 열차"를 고른다.
 */
async function planBackward(
  route: Route,
  count: number,
  timetable: TimetableProvider,
  options: PlanOptions,
  arriveBy?: ServiceMinutes,
): Promise<BackwardResult> {
  const { segments, transferWalkMinutes } = route;
  const legs: PlannedLeg[] = new Array(count);

  for (let i = count - 1; i >= 0; i--) {
    const segment = segments[i];

    const [train, lastTrain] = await Promise.all([
      timetable.latestTrain({ segment, dayType: options.dayType, arriveBy }),
      arriveBy === undefined ? null : timetable.latestTrain({ segment, dayType: options.dayType }),
    ]);

    if (train.status !== 'OK') return { ok: false, reason: train.status, segment };

    legs[i] = {
      segment,
      departAt: train.departAt,
      arriveAt: train.arriveAt,
      isLastTrain: lastTrain === null || (lastTrain.status === 'OK' && lastTrain.departAt === train.departAt),
    };

    // 이전 구간은 환승 도보를 마치고 이 열차 출발 전에 도착해야 한다
    arriveBy = train.departAt - (transferWalkMinutes[i - 1] ?? 0);
  }
  return { ok: true, legs };
}

function leaveByOf(route: Route, legs: PlannedLeg[], options: PlanOptions): ServiceMinutes {
  return legs[0].departAt - route.walkToFirstStationMinutes - options.bufferMinutes;
}

/**
 * 막차를 놓쳤을 때의 대안: 마지막 구간을 '내릴 역 전에 끝나는 더 늦은 열차'로 바꾸고 앞 구간을 다시 역산.
 * 실제로 더 늦게 나가도 될 때만 돌려준다.
 */
async function planPartial(
  route: Route,
  mainLegs: PlannedLeg[],
  timetable: TimetableProvider,
  options: PlanOptions,
): Promise<PartialPlan | undefined> {
  if (!timetable.latestPartialTrain) return undefined;
  const lastIndex = route.segments.length - 1;
  const segment = route.segments[lastIndex];
  const train = await timetable.latestPartialTrain({
    segment,
    dayType: options.dayType,
    after: mainLegs[lastIndex].departAt,
  });
  if (!train) return undefined;

  const lastLeg: PlannedLeg = {
    segment: { ...segment, to: { name: train.terminal } },
    departAt: train.departAt,
    arriveAt: train.arriveAt,
    isLastTrain: true,
  };
  let legs = [lastLeg];
  if (lastIndex > 0) {
    const before = await planBackward(
      route,
      lastIndex,
      timetable,
      options,
      train.departAt - route.transferWalkMinutes[lastIndex - 1],
    );
    if (!before.ok) return undefined;
    legs = [...before.legs, lastLeg];
  }

  const leaveBy = leaveByOf(route, legs, options);
  if (leaveBy <= leaveByOf(route, mainLegs, options)) return undefined;
  return { legs, leaveBy, terminal: train.terminal, terminalArriveAt: train.arriveAt };
}

/** 막차 역산: 마지막 구간의 막차(내릴 역까지 가는 마지막 열차)에서 시작해 거꾸로 올라간다 */
export async function planLastTrain(
  route: Route,
  timetable: TimetableProvider,
  options: PlanOptions,
): Promise<PlanResult> {
  const result = await planBackward(route, route.segments.length, timetable, options);
  if (!result.ok) return { ok: false, route, reason: result.reason, segment: result.segment };

  const { legs } = result;
  return {
    ok: true,
    route,
    legs,
    boardBy: legs[0].departAt,
    leaveBy: leaveByOf(route, legs, options),
    arriveAt: legs[legs.length - 1].arriveAt,
    partial: await planPartial(route, legs, timetable, options),
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
