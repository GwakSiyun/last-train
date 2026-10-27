/** 평일 / 토요일 / 휴일 — 서울 지하철 시간표 구분과 동일 */
export type DayType = 'WEEKDAY' | 'SATURDAY' | 'HOLIDAY';

/**
 * 하루 운행 기준 분(minute).
 * 운행일은 04:00에 시작하므로 00:30 막차는 24:30 = 1470 으로 표현한다.
 */
export type ServiceMinutes = number;

export interface Station {
  id: string;
  name: string;
}

/** 한 노선을 한 방향으로 타고 가는 구간 */
export interface Segment {
  line: string;
  /** 방면 표시 (예: "합정 방면") */
  direction: string;
  from: Station;
  to: Station;
  rideMinutes: number;
}

export interface Route {
  segments: Segment[];
  /** segments[i] → segments[i+1] 환승 도보 시간. 길이 = segments.length - 1 */
  transferWalkMinutes: number[];
}

export interface DepartureQuery {
  segment: Segment;
  dayType: DayType;
  /** 이 시각 이전(포함) 출발 열차 중 가장 늦은 것. 없으면 막차. */
  notAfter?: ServiceMinutes;
}

export interface RouteProvider {
  findRoute(fromId: string, toId: string): Promise<Route | null>;
}

export interface TimetableProvider {
  /** 조건에 맞는 열차가 없으면 null */
  latestDeparture(query: DepartureQuery): Promise<ServiceMinutes | null>;
}

export interface PlannedLeg {
  segment: Segment;
  departAt: ServiceMinutes;
  arriveAt: ServiceMinutes;
  /** 이 구간이 해당 역·노선·방면의 막차인지 */
  isLastTrain: boolean;
}

export type PlanResult =
  | {
      ok: true;
      legs: PlannedLeg[];
      transferWalkMinutes: number[];
      /** 첫 열차 출발 시각 */
      boardBy: ServiceMinutes;
      /** 현재 위치에서 출발해야 하는 시각 (도보·여유 포함) */
      leaveBy: ServiceMinutes;
      arriveAt: ServiceMinutes;
    }
  | { ok: false; reason: 'NO_TRAIN'; segment: Segment };
