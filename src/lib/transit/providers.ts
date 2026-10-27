import { MOCK_DESTINATIONS, MOCK_ORIGINS, mockRouteProvider, mockTimetableProvider } from './mock';
import type { RouteProvider, Station, TimetableProvider } from './types';

export interface TransitProviders {
  isMock: boolean;
  routes: RouteProvider;
  timetable: TimetableProvider;
  origins: Station[];
  destinations: Station[];
}

/**
 * 서버 전용. 지금은 항상 mock.
 * TODO(연동): ODSAY_API_KEY(경로) + DATA_GO_KR_KEY(시간표)가 있으면 live provider로 교체.
 *   응답 shape는 키 발급 후 실제 호출로 확인하고 작성할 것 (추측 구현 금지).
 */
export function getProviders(): TransitProviders {
  return {
    isMock: true,
    routes: mockRouteProvider,
    timetable: mockTimetableProvider,
    origins: MOCK_ORIGINS,
    destinations: MOCK_DESTINATIONS,
  };
}
