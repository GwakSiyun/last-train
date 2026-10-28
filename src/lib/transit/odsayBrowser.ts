/**
 * 브라우저에서 ODsay 호출 (URI 키 = 등록된 도메인에서만 동작).
 * Vercel은 서버 IP가 바뀌어 Server 키를 못 쓰기 때문에 배포 환경은 이 경로를 쓴다.
 * ⚠️ 키가 브라우저에 노출된다 (도메인 제한 키라 의도된 방식). 같은 검색은 sessionStorage에 저장해 호출 수를 아낀다.
 */
import { ODSAY_ENDPOINT, OdsayError, odsayCacheKey, odsayQuery, parseOdsayRoutes, type OdsayResponse } from './odsayParse';
import type { Place, Route } from './types';

const CACHE_TTL_MS = 12 * 60 * 60 * 1000;

interface CacheEntry {
  savedAt: number;
  routes: Route[];
}

function readCache(key: string): Route[] | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry;
    return Date.now() - entry.savedAt < CACHE_TTL_MS ? entry.routes : null;
  } catch {
    return null; // 사파리 개인정보 보호 모드 등 저장소 사용 불가
  }
}

function writeCache(key: string, routes: Route[]): void {
  try {
    sessionStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), routes } satisfies CacheEntry));
  } catch {
    // 저장 실패해도 결과는 그대로 쓴다
  }
}

export function hasWebKey(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_ODSAY_WEB_KEY);
}

export async function fetchRoutesInBrowser(origin: Place, destination: Place): Promise<Route[]> {
  const key = process.env.NEXT_PUBLIC_ODSAY_WEB_KEY;
  if (!key) throw new OdsayError('NEXT_PUBLIC_ODSAY_WEB_KEY가 설정되지 않았어요.');

  const query = odsayQuery(origin, destination);
  const cacheKey = odsayCacheKey(query);
  const hit = readCache(cacheKey);
  if (hit) return hit;

  query.set('apiKey', key);
  const res = await fetch(`${ODSAY_ENDPOINT}?${query}`);
  if (!res.ok) throw new OdsayError(`ODsay HTTP ${res.status}`);

  const routes = parseOdsayRoutes((await res.json()) as OdsayResponse);
  writeCache(cacheKey, routes);
  return routes;
}
