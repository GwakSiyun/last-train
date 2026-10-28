import 'server-only';

import { MOCK_STATIONS, mockRouteProvider, mockTimetableProvider } from './mock';
import { odsayRouteProvider } from './odsay';
import { seoulStations, seoulTimetableProvider } from './seoul';
import type { RouteProvider, StationOption, TimetableProvider } from './types';

/**
 * 경로를 어디서 받는지:
 * - browser: 브라우저가 ODsay URI 키로 호출 (배포용 — Vercel은 IP가 바뀌어 Server 키 불가)
 * - server: 서버가 ODsay Server 키로 호출 (등록된 IP에서만 — 로컬 개발용)
 * - mock: 샘플 데이터
 */
export type RouteMode = 'browser' | 'server' | 'mock';

export interface TransitProviders {
  isMock: boolean;
  routeMode: RouteMode;
  /** routeMode가 'server' | 'mock'일 때만 사용 */
  routes: RouteProvider;
  timetable: TimetableProvider;
  stations: () => Promise<StationOption[]>;
}

/**
 * 서울 시간표 키 + ODsay 키(둘 중 하나)가 있으면 실데이터, 아니면 샘플 데이터.
 * 둘 다 있으면 browser 우선 — 로컬에서도 배포와 같은 경로로 확인하기 위해.
 * 실데이터 호출이 실패해도 샘플로 몰래 바꾸지 않는다 (화면에 오류 표시).
 */
export function getProviders(): TransitProviders {
  const hasSeoul = Boolean(process.env.SEOUL_OPEN_API_KEY);
  const routeMode: RouteMode = !hasSeoul
    ? 'mock'
    : process.env.NEXT_PUBLIC_ODSAY_WEB_KEY
      ? 'browser'
      : process.env.ODSAY_API_KEY
        ? 'server'
        : 'mock';

  if (routeMode === 'mock') {
    return {
      isMock: true,
      routeMode,
      routes: mockRouteProvider,
      timetable: mockTimetableProvider,
      stations: async () => MOCK_STATIONS,
    };
  }
  return {
    isMock: false,
    routeMode,
    routes: odsayRouteProvider,
    timetable: seoulTimetableProvider,
    stations: seoulStations,
  };
}
