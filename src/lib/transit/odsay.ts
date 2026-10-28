import 'server-only';

import { cached, ONE_DAY_MS } from './cache';
import { lineLabel } from './lines';
import type { Place, Route, RouteProvider, Segment } from './types';

/**
 * ODsay 대중교통 길찾기 (searchPubTransPathT, 2026-10-28 실호출로 응답 확인).
 * - 출발지를 좌표로 주면 첫 subPath가 "걷기(trafficType 3) → 첫 역"이라 역까지 도보 시간이 같이 온다.
 * - Basic 플랜은 하루 30회 → 좌표를 소수 3자리(~100m)로 반올림해 캐시 적중률을 높인다.
 * - Server 키라 등록된 IP에서만 호출 가능 (IP 바뀌면 ApiKeyAuthFailed).
 */

const ENDPOINT = 'https://api.odsay.com/v1/api/searchPubTransPathT';
const SUBWAY_ONLY = '1';

const TRAFFIC_SUBWAY = 1;
const TRAFFIC_WALK = 3;

interface OdsaySubPath {
  trafficType: number;
  sectionTime: number;
  lane?: { name: string }[];
  way?: string;
  startName?: string;
  endName?: string;
}

interface OdsayPath {
  subPath: OdsaySubPath[];
}

interface OdsayResponse {
  result?: { path?: OdsayPath[] };
  error?: unknown;
}

export class OdsayError extends Error {}

function errorMessage(error: unknown): string {
  // 확인된 형태: { error: [{ code, message }] }
  const first = Array.isArray(error) ? error[0] : error;
  if (first && typeof first === 'object') {
    const { message, msg } = first as { message?: unknown; msg?: unknown };
    if (typeof message === 'string') return message;
    if (typeof msg === 'string') return msg;
  }
  return 'ODsay 경로 검색에 실패했어요.';
}

const round = (n: number): string => n.toFixed(3);

function toRoute(path: OdsayPath): Route | null {
  const segments: Segment[] = [];
  const transferWalkMinutes: number[] = [];
  let walkToFirstStationMinutes = 0;
  let pendingWalk = 0;

  for (const sub of path.subPath) {
    if (sub.trafficType === TRAFFIC_WALK) {
      pendingWalk += sub.sectionTime;
      continue;
    }
    if (sub.trafficType !== TRAFFIC_SUBWAY) return null; // 지하철 전용 검색이라 오면 안 됨

    if (segments.length === 0) walkToFirstStationMinutes = pendingWalk;
    else transferWalkMinutes.push(pendingWalk);
    pendingWalk = 0;

    segments.push({
      line: lineLabel(sub.lane?.[0]?.name ?? '지하철'),
      direction: sub.way ? `${sub.way} 방면` : '',
      from: { name: sub.startName ?? '' },
      to: { name: sub.endName ?? '' },
      rideMinutes: sub.sectionTime,
    });
  }

  return segments.length > 0 ? { segments, walkToFirstStationMinutes, transferWalkMinutes } : null;
}

export const odsayRouteProvider: RouteProvider = {
  async findRoutes(origin: Place, destination: Place): Promise<Route[]> {
    const key = process.env.ODSAY_API_KEY;
    if (!key) throw new OdsayError('ODSAY_API_KEY가 설정되지 않았어요.');

    const params = new URLSearchParams({
      SX: round(origin.lng),
      SY: round(origin.lat),
      EX: round(destination.lng),
      EY: round(destination.lat),
      SearchPathType: SUBWAY_ONLY,
      apiKey: key,
    });

    const cacheKey = `odsay:${params.get('SX')},${params.get('SY')}>${params.get('EX')},${params.get('EY')}`;

    return cached(cacheKey, ONE_DAY_MS, async () => {
      const res = await fetch(`${ENDPOINT}?${params}`, { cache: 'no-store' });
      if (!res.ok) throw new OdsayError(`ODsay HTTP ${res.status}`);

      const body = (await res.json()) as OdsayResponse;
      if (body.error) throw new OdsayError(errorMessage(body.error));

      return (body.result?.path ?? []).map(toRoute).filter((r): r is Route => r !== null);
    });
  },
};
