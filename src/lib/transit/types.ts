/** 평일 / 토요일 / 휴일 — 서울 지하철 시간표 구분과 동일 */
export type DayType = 'WEEKDAY' | 'SATURDAY' | 'HOLIDAY';

/**
 * 하루 운행 기준 분(minute).
 * 운행일은 04:00에 시작하므로 00:30 막차는 24:30 = 1470 으로 표현한다.
 */
export type ServiceMinutes = number;

export interface Place {
  name: string;
  lat: number;
  lng: number;
}

/** 역 선택지 (도착역·출발역 검색용) */
export interface StationOption extends Place {
  lines: string[];
}

export interface SegmentStation {
  name: string;
}

/** 한 노선을 한 방향으로 타고 가는 구간 */
export interface Segment {
  /** 표시용 노선명 (예: "2호선") */
  line: string;
  /** 방면 표시 (예: "교대 방면") */
  direction: string;
  from: SegmentStation;
  to: SegmentStation;
  /** 경로 API가 준 예상 소요시간 — 시간표 조회 시 이상치 필터에 사용 */
  rideMinutes: number;
  /** 빠른 환승 위치 (예: "3-2" = 3번째 칸 2번 문). ODsay가 안 주면 없음 */
  door?: string;
  /** 지하철로 들어가는 출구 번호 (첫 구간, ODsay가 줄 때만) */
  startExitNo?: string;
  /** 지하철에서 나가는 출구 번호 (마지막 구간, ODsay가 줄 때만) */
  endExitNo?: string;
}

export interface Route {
  segments: Segment[];
  /** 출발지 → 첫 역 도보 */
  walkToFirstStationMinutes: number;
  /** segments[i] → segments[i+1] 환승 도보 시간. 길이 = segments.length - 1 */
  transferWalkMinutes: number[];
}

export interface RouteProvider {
  findRoutes(origin: Place, destination: Place): Promise<Route[]>;
}

export interface TrainQuery {
  segment: Segment;
  dayType: DayType;
  /** 내릴 역에 이 시각까지 도착하는 열차 중 가장 늦게 출발하는 것. 없으면 막차. */
  arriveBy?: ServiceMinutes;
}

export type TrainResult =
  | { status: 'OK'; departAt: ServiceMinutes; arriveAt: ServiceMinutes }
  | { status: 'NO_TRAIN' }
  /** 시간표 데이터가 없는 노선·역 (예: 신분당선) */
  | { status: 'UNSUPPORTED' }
  /** 원래 시간표가 있는 노선(1~9호선)인데 서울 API가 빈 값을 줌 — 일시 장애 */
  | { status: 'UNAVAILABLE' };

export interface TimetableProvider {
  latestTrain(query: TrainQuery): Promise<TrainResult>;
}

export interface PlannedLeg {
  segment: Segment;
  departAt: ServiceMinutes;
  arriveAt: ServiceMinutes;
  /** 이 구간이 내릴 역까지 가는 막차인지 */
  isLastTrain: boolean;
}

export type PlanResult =
  | {
      ok: true;
      route: Route;
      legs: PlannedLeg[];
      /** 첫 열차 출발 시각 */
      boardBy: ServiceMinutes;
      /** 현재 위치에서 출발해야 하는 시각 (도보·여유 포함) */
      leaveBy: ServiceMinutes;
      arriveAt: ServiceMinutes;
    }
  | { ok: false; route: Route; reason: Exclude<TrainResult['status'], 'OK'>; segment: Segment };
