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

/** 장소 검색 결과 (도착지를 역이 아닌 건물·주소로 고를 때) */
export interface PlaceOption extends Place {
  address: string;
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
}

export interface Route {
  segments: Segment[];
  /** 출발지 → 첫 역 도보 */
  walkToFirstStationMinutes: number;
  /** segments[i] → segments[i+1] 환승 도보 시간. 길이 = segments.length - 1 */
  transferWalkMinutes: number[];
  /** 마지막 역 → 목적지. 목적지가 장소(좌표)일 때만 의미 있다 */
  arrival?: RouteArrival;
}

export interface RouteArrival {
  /** 내릴 출구 번호 (ODsay endExitNo). 안 주면 없음 */
  exitNo?: string;
  walkMinutes: number;
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

export interface PartialTrainQuery {
  segment: Segment;
  dayType: DayType;
  /** 내릴 역까지 가는 막차의 출발 시각 — 이보다 늦게 출발하는 열차만 찾는다 */
  after: ServiceMinutes;
}

/** 내릴 역 전에 운행이 끝나는 열차 (예: 노원행 막차를 놓쳐도 타는 한성대입구행) */
export interface PartialTrain {
  departAt: ServiceMinutes;
  /** 종착역 도착 */
  arriveAt: ServiceMinutes;
  /** 종착역 이름 */
  terminal: string;
}

export interface TimetableProvider {
  latestTrain(query: TrainQuery): Promise<TrainResult>;
  /** 종착역 정보가 없는 시간표(샘플 등)는 구현하지 않는다 */
  latestPartialTrain?(query: PartialTrainQuery): Promise<PartialTrain | null>;
}

/** 마지막 구간을 '중간에 끊기는 열차'로 바꿔 탄 계획 — 마지막 leg의 도착역이 종착역 */
export interface PartialPlan {
  legs: PlannedLeg[];
  leaveBy: ServiceMinutes;
  terminal: string;
  /** 마지막 구간 열차의 종착역 도착 시각 */
  terminalArriveAt: ServiceMinutes;
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
      /** 막차를 놓쳐도 마지막 구간 중간역까지는 가는 대안 (더 늦게 나가도 될 때만) */
      partial?: PartialPlan;
    }
  | { ok: false; route: Route; reason: Exclude<TrainResult['status'], 'OK'>; segment: Segment };
