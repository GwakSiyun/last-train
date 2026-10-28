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

/** 모든 경로를 계산해 가장 늦게 출발해도 되는 순으로 정렬. 계산 불가 경로는 뒤로. */
export async function planAllRoutes(
  routes: Route[],
  timetable: TimetableProvider,
  options: PlanOptions,
): Promise<PlanResult[]> {
  const results = await Promise.all(routes.map((r) => planLastTrain(r, timetable, options)));
  return results.sort((a, b) => {
    if (a.ok && b.ok) return b.leaveBy - a.leaveBy;
    return a.ok ? -1 : b.ok ? 1 : 0;
  });
}
