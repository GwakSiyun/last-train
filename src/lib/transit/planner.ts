import type { DayType, PlannedLeg, PlanResult, Route, TimetableProvider } from './types';

export interface PlanOptions {
  dayType: DayType;
  /** 현재 위치 → 첫 역 승강장까지 도보 */
  walkToStationMinutes: number;
  /** 놓치지 않기 위한 여유 */
  bufferMinutes: number;
}

/**
 * 막차 역산.
 * 마지막 구간의 막차에서 시작해 거꾸로 올라가며,
 * 각 구간마다 "다음 구간 열차를 탈 수 있는 가장 늦은 열차"를 고른다.
 */
export async function planLastTrain(
  route: Route,
  timetable: TimetableProvider,
  options: PlanOptions,
): Promise<PlanResult> {
  const { segments, transferWalkMinutes } = route;
  const legs: PlannedLeg[] = new Array(segments.length);

  let deadline: number | undefined;

  for (let i = segments.length - 1; i >= 0; i--) {
    const segment = segments[i];
    const notAfter = deadline === undefined ? undefined : deadline - segment.rideMinutes;

    const [departAt, lastDeparture] = await Promise.all([
      timetable.latestDeparture({ segment, dayType: options.dayType, notAfter }),
      timetable.latestDeparture({ segment, dayType: options.dayType }),
    ]);

    if (departAt === null) return { ok: false, reason: 'NO_TRAIN', segment };

    legs[i] = {
      segment,
      departAt,
      arriveAt: departAt + segment.rideMinutes,
      isLastTrain: departAt === lastDeparture,
    };

    // 이전 구간은 환승 도보를 마치고 이 열차 출발 전에 도착해야 한다
    deadline = departAt - (transferWalkMinutes[i - 1] ?? 0);
  }

  const boardBy = legs[0].departAt;
  return {
    ok: true,
    legs,
    transferWalkMinutes,
    boardBy,
    leaveBy: boardBy - options.walkToStationMinutes - options.bufferMinutes,
    arriveAt: legs[legs.length - 1].arriveAt,
  };
}
