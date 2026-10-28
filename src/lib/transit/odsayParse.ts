/**
 * ODsay 응답 파싱 — 서버(Server 키)와 브라우저(URI 키) 양쪽에서 쓴다. (server-only 아님)
 * 응답 형태는 2026-10-28 실호출로 확인 (searchPubTransPathT).
 * - 출발지를 좌표로 주면 첫 subPath가 "걷기(trafficType 3) → 첫 역"이라 역까지 도보 시간이 같이 온다.
 * - 오류도 HTTP 200: { error: [{ code, message }] }
 */
import { lineLabel } from './lines';
import type { Place, Route, Segment } from './types';

export const ODSAY_ENDPOINT = 'https://api.odsay.com/v1/api/searchPubTransPathT';
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

export interface OdsayResponse {
  result?: { path?: OdsayPath[] };
  error?: unknown;
}

export class OdsayError extends Error {}

function errorMessage(error: unknown): string {
  const first = Array.isArray(error) ? error[0] : error;
  if (first && typeof first === 'object') {
    const { message, msg } = first as { message?: unknown; msg?: unknown };
    if (typeof message === 'string') return message;
    if (typeof msg === 'string') return msg;
  }
  return 'ODsay 경로 검색에 실패했어요.';
}

/**
 * 좌표는 소수 3자리(~100m)로 반올림 — 같은 동네 검색이 같은 캐시 키가 되도록 (Basic 하루 30회).
 * apiKey는 호출하는 쪽에서 붙인다.
 */
export function odsayQuery(origin: Place, destination: Place): URLSearchParams {
  return new URLSearchParams({
    SX: origin.lng.toFixed(3),
    SY: origin.lat.toFixed(3),
    EX: destination.lng.toFixed(3),
    EY: destination.lat.toFixed(3),
    SearchPathType: SUBWAY_ONLY,
  });
}

export function odsayCacheKey(query: URLSearchParams): string {
  return `odsay:${query.get('SX')},${query.get('SY')}>${query.get('EX')},${query.get('EY')}`;
}

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

/** 응답 → 경로 목록. 오류 응답이면 OdsayError */
export function parseOdsayRoutes(body: OdsayResponse): Route[] {
  if (body.error) throw new OdsayError(errorMessage(body.error));
  return (body.result?.path ?? []).map(toRoute).filter((r): r is Route => r !== null);
}
