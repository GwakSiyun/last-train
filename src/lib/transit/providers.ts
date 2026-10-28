import 'server-only';

import { MOCK_STATIONS, mockRouteProvider, mockTimetableProvider } from './mock';
import { odsayRouteProvider } from './odsay';
import { seoulStations, seoulTimetableProvider } from './seoul';
import type { RouteProvider, StationOption, TimetableProvider } from './types';

export interface TransitProviders {
  isMock: boolean;
  routes: RouteProvider;
  timetable: TimetableProvider;
  stations: () => Promise<StationOption[]>;
}

/**
 * 키 두 개가 모두 있으면 실데이터, 하나라도 없으면 샘플 데이터.
 * 실데이터 호출이 실패해도 샘플로 몰래 바꾸지 않는다 (화면에 오류 표시).
 */
export function getProviders(): TransitProviders {
  const live = Boolean(process.env.ODSAY_API_KEY && process.env.SEOUL_OPEN_API_KEY);

  if (!live) {
    return {
      isMock: true,
      routes: mockRouteProvider,
      timetable: mockTimetableProvider,
      stations: async () => MOCK_STATIONS,
    };
  }
  return {
    isMock: false,
    routes: odsayRouteProvider,
    timetable: seoulTimetableProvider,
    stations: seoulStations,
  };
}
