import 'server-only';

import { cached, ONE_DAY_MS } from './cache';
import { ODSAY_ENDPOINT, OdsayError, QUOTA_MESSAGE, odsayCacheKey, odsayQuery, parseOdsayRoutes, type OdsayResponse } from './odsayParse';
import type { Place, Route, RouteProvider } from './types';

/**
 * 서버에서 ODsay 호출 (Server 키 = 등록된 IP에서만 동작 → 로컬 개발용).
 * 배포(Vercel)는 IP가 바뀌어서 브라우저 호출(URI 키, LiveResult)을 쓴다.
 */
export const odsayRouteProvider: RouteProvider = {
  async findRoutes(origin: Place, destination: Place): Promise<Route[]> {
    const key = process.env.ODSAY_API_KEY;
    if (!key) throw new OdsayError('ODSAY_API_KEY가 설정되지 않았어요.');

    const query = odsayQuery(origin, destination);
    return cached(odsayCacheKey(query), ONE_DAY_MS, async () => {
      query.set('apiKey', key);
      const res = await fetch(`${ODSAY_ENDPOINT}?${query}`, { cache: 'no-store' });
      if (!res.ok) throw new OdsayError(`${QUOTA_MESSAGE} (ODsay HTTP ${res.status})`);
      return parseOdsayRoutes((await res.json()) as OdsayResponse);
    });
  },
};
