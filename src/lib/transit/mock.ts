/**
 * ⚠️ 샘플 데이터 — 실제 노선·소요시간·막차 시각이 아니다.
 * API 키(ODsay·공공데이터) 연동 전 화면·계산 로직 확인용.
 * 화면에는 반드시 "샘플 데이터" 배너가 함께 표시된다.
 */
import type {
  DepartureQuery,
  Route,
  RouteProvider,
  Segment,
  ServiceMinutes,
  Station,
  TimetableProvider,
} from './types';

const st = (id: string, name: string): Station => ({ id, name });

export const MOCK_STATIONS = {
  gangnam: st('gangnam', '강남'),
  hongik: st('hongik', '홍대입구'),
  jamsil: st('jamsil', '잠실'),
  sadang: st('sadang', '사당'),
  seoul: st('seoul', '서울역'),
  chungjeongno: st('chungjeongno', '충정로'),
  gwanghwamun: st('gwanghwamun', '광화문'),
  ydpOffice: st('ydpOffice', '영등포구청'),
  yeouido: st('yeouido', '여의도'),
} satisfies Record<string, Station>;

const S = MOCK_STATIONS;

const seg = (
  line: string,
  direction: string,
  from: Station,
  to: Station,
  rideMinutes: number,
): Segment => ({ line, direction, from, to, rideMinutes });

const ROUTES: Record<string, Route> = {
  'gangnam>hongik': {
    segments: [seg('2호선', '합정 방면', S.gangnam, S.hongik, 36)],
    transferWalkMinutes: [],
  },
  'hongik>jamsil': {
    segments: [seg('2호선', '신촌 방면', S.hongik, S.jamsil, 44)],
    transferWalkMinutes: [],
  },
  'sadang>seoul': {
    segments: [seg('4호선', '당고개 방면', S.sadang, S.seoul, 18)],
    transferWalkMinutes: [],
  },
  'gangnam>gwanghwamun': {
    segments: [
      seg('2호선', '합정 방면', S.gangnam, S.chungjeongno, 35),
      seg('5호선', '마천 방면', S.chungjeongno, S.gwanghwamun, 4),
    ],
    transferWalkMinutes: [4],
  },
  'jamsil>yeouido': {
    segments: [
      seg('2호선', '성수 방면', S.jamsil, S.ydpOffice, 40),
      seg('5호선', '방화 방면', S.ydpOffice, S.yeouido, 4),
    ],
    transferWalkMinutes: [5],
  },
};

/** 출발역 선택지 — 샘플 경로가 있는 역만 */
export const MOCK_ORIGINS: Station[] = [S.gangnam, S.hongik, S.jamsil, S.sadang];
/** 도착역 선택지 */
export const MOCK_DESTINATIONS: Station[] = [S.hongik, S.jamsil, S.seoul, S.gwanghwamun, S.yeouido];

/** 평일 막차 (샘플). 토요일·휴일은 10분 이르게 가정. */
const WEEKDAY_LAST: Record<string, ServiceMinutes> = {
  '2호선|합정 방면|gangnam': 24 * 60 + 2,
  '2호선|합정 방면|chungjeongno': 24 * 60 + 30,
  '2호선|신촌 방면|hongik': 23 * 60 + 58,
  '2호선|성수 방면|jamsil': 24 * 60 + 5,
  '4호선|당고개 방면|sadang': 24 * 60 + 10,
  '5호선|마천 방면|chungjeongno': 24 * 60 + 18,
  '5호선|방화 방면|ydpOffice': 24 * 60 + 33,
};

const FIRST_TRAIN: ServiceMinutes = 5 * 60 + 30;
/** 심야 배차 간격 (샘플) */
const HEADWAY = 8;

export const mockRouteProvider: RouteProvider = {
  async findRoute(fromId, toId) {
    return ROUTES[`${fromId}>${toId}`] ?? null;
  },
};

export const mockTimetableProvider: TimetableProvider = {
  async latestDeparture({ segment, dayType, notAfter }: DepartureQuery) {
    const key = `${segment.line}|${segment.direction}|${segment.from.id}`;
    const weekdayLast = WEEKDAY_LAST[key];
    if (weekdayLast === undefined) return null;

    const last = dayType === 'WEEKDAY' ? weekdayLast : weekdayLast - 10;
    if (notAfter === undefined || notAfter >= last) return last;

    // 막차에서 배차간격만큼 거슬러 올라간 열차 중 notAfter 이하 첫 열차
    const steps = Math.ceil((last - notAfter) / HEADWAY);
    const departure = last - steps * HEADWAY;
    return departure >= FIRST_TRAIN ? departure : null;
  },
};
