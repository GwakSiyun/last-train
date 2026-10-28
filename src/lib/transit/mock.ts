/**
 * ⚠️ 샘플 데이터 — 실제 노선·소요시간·막차 시각이 아니다.
 * API 키가 없을 때(.env.local 미설정) 화면·계산 로직 확인용.
 * 화면에는 반드시 "샘플 데이터" 배너가 함께 표시된다.
 */
import type {
  Route,
  RouteProvider,
  Segment,
  ServiceMinutes,
  StationOption,
  TimetableProvider,
  TrainQuery,
  TrainResult,
} from './types';

const st = (name: string, lat: number, lng: number): StationOption => ({
  name,
  lat,
  lng,
  lines: [],
});

export const MOCK_STATIONS: StationOption[] = [
  st('강남', 37.4979, 127.0276),
  st('광화문', 37.5717, 126.9765),
  st('사당', 37.4765, 126.9816),
  st('서울역', 37.5546, 126.9706),
  st('여의도', 37.5216, 126.9242),
  st('잠실', 37.5133, 127.1001),
  st('홍대입구', 37.5572, 126.9245),
];

const seg = (line: string, direction: string, from: string, to: string, rideMinutes: number): Segment => ({
  line,
  direction,
  from: { name: from },
  to: { name: to },
  rideMinutes,
});

const ROUTES: Record<string, Route[]> = {
  '강남>홍대입구': [
    { segments: [seg('2호선', '역삼 방면', '강남', '홍대입구', 36)], walkToFirstStationMinutes: 5, transferWalkMinutes: [] },
  ],
  '홍대입구>잠실': [
    { segments: [seg('2호선', '신촌 방면', '홍대입구', '잠실', 44)], walkToFirstStationMinutes: 5, transferWalkMinutes: [] },
  ],
  '사당>서울역': [
    { segments: [seg('4호선', '총신대입구 방면', '사당', '서울역', 18)], walkToFirstStationMinutes: 5, transferWalkMinutes: [] },
  ],
  '강남>광화문': [
    {
      segments: [seg('2호선', '역삼 방면', '강남', '충정로', 35), seg('5호선', '서대문 방면', '충정로', '광화문', 4)],
      walkToFirstStationMinutes: 5,
      transferWalkMinutes: [4],
    },
    {
      segments: [seg('2호선', '교대 방면', '강남', '교대', 2), seg('3호선', '고속터미널 방면', '교대', '종로3가', 21), seg('5호선', '광화문 방면', '종로3가', '광화문', 3)],
      walkToFirstStationMinutes: 6,
      transferWalkMinutes: [2, 3],
    },
  ],
  '잠실>여의도': [
    {
      segments: [seg('2호선', '성수 방면', '잠실', '영등포구청', 40), seg('5호선', '여의도 방면', '영등포구청', '여의도', 4)],
      walkToFirstStationMinutes: 5,
      transferWalkMinutes: [5],
    },
  ],
};

/** 평일 막차 (샘플). 토요일·휴일은 10분 이르게 가정. key = 노선|타는역 */
const WEEKDAY_LAST: Record<string, ServiceMinutes> = {
  '2호선|강남': 24 * 60 + 2,
  '2호선|충정로': 24 * 60 + 30,
  '2호선|홍대입구': 23 * 60 + 58,
  '2호선|잠실': 24 * 60 + 5,
  '3호선|교대': 24 * 60 + 11,
  '4호선|사당': 24 * 60 + 10,
  '5호선|충정로': 24 * 60 + 18,
  '5호선|종로3가': 24 * 60 + 40,
  '5호선|영등포구청': 24 * 60 + 33,
};

const FIRST_TRAIN: ServiceMinutes = 5 * 60 + 30;
/** 심야 배차 간격 (샘플) */
const HEADWAY = 8;

export const mockRouteProvider: RouteProvider = {
  async findRoutes(origin, destination) {
    return ROUTES[`${origin.name}>${destination.name}`] ?? [];
  },
};

export const mockTimetableProvider: TimetableProvider = {
  async latestTrain({ segment, dayType, arriveBy }: TrainQuery): Promise<TrainResult> {
    const weekdayLast = WEEKDAY_LAST[`${segment.line}|${segment.from.name}`];
    if (weekdayLast === undefined) return { status: 'UNSUPPORTED' };

    const last = dayType === 'WEEKDAY' ? weekdayLast : weekdayLast - 10;
    const departBy = arriveBy === undefined ? last : Math.min(last, arriveBy - segment.rideMinutes);

    // 막차에서 배차간격만큼 거슬러 올라간 열차 중 departBy 이하 첫 열차
    const steps = Math.ceil((last - departBy) / HEADWAY);
    const departAt = last - steps * HEADWAY;
    if (departAt < FIRST_TRAIN) return { status: 'NO_TRAIN' };
    return { status: 'OK', departAt, arriveAt: departAt + segment.rideMinutes };
  },
};
