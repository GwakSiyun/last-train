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
  door?: string;
  startExitNo?: string;
  endExitNo?: string;
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

/** message는 화면에 그대로 보여줄 수 있는 문장 */
export class OdsayError extends Error {}

/**
 * 길찾기 API 문서(lab.odsay.com/guide)에 있는 오류 코드 → 안내 문구.
 * ⚠️ 하루 호출 한도(Basic 30회) 초과 응답은 문서에 없고, 실제로 넘겨 확인하면 그날 사이트가 멈춰서 미확인.
 *    그래서 문서에 없는 오류는 '사용량 초과일 수 있음'으로 안내하고 원래 메시지를 같이 보여준다.
 */
const KNOWN_ERRORS: Record<string, string> = {
  '-98': '출발지와 도착지가 700m 안이에요. 걸어가도 되는 거리예요 🚶',
  '-99': '지하철 경로를 찾지 못했어요.',
  '3': '출발지 근처에서 지하철역을 찾지 못했어요.',
  '4': '도착지 근처에서 지하철역을 찾지 못했어요.',
  '5': '출발지·도착지 근처에서 지하철역을 찾지 못했어요.',
  '6': '서비스 지역이 아니에요. (수도권 지하철만 지원해요)',
};

/** 500은 문서상 '서버 내부 오류'지만 인증 실패도 500으로 온다 (2026-10-29 실응답) → 메시지로 구분 */
const SERVER_ERROR_MESSAGE = '서버 내부 오류';
const SERVER_ERROR_TEXT = '경로 검색 서버(ODsay)에 오류가 있어요. 잠시 후 다시 시도해주세요.';

export const QUOTA_MESSAGE = '오늘 검색이 많아서 무료 경로 검색 사용량을 다 썼을 수 있어요. 내일 다시 써주세요 🙏';

function errorField(error: unknown, field: 'code' | 'message' | 'msg'): string | undefined {
  const first = Array.isArray(error) ? error[0] : error;
  if (!first || typeof first !== 'object') return undefined;
  const value = (first as Record<string, unknown>)[field];
  return typeof value === 'string' || typeof value === 'number' ? String(value) : undefined;
}

function errorMessage(error: unknown): string {
  const code = errorField(error, 'code');
  const raw = errorField(error, 'message') ?? errorField(error, 'msg') ?? '알 수 없는 오류';
  // 키·도메인/IP 등록 문제: {code:"500", message:"[ApiKeyAuthFailed] ..."} — 사용량이 아니라 운영자 쪽 설정 문제
  if (raw.includes('ApiKeyAuthFailed')) return `경로 검색 인증에 실패했어요. 운영자가 확인 중이에요 🙏 (ODsay: ${raw})`;
  const known = code === undefined ? undefined : KNOWN_ERRORS[code];
  if (known) return known;
  if (code === '500' && raw.includes(SERVER_ERROR_MESSAGE)) return SERVER_ERROR_TEXT;
  return `${QUOTA_MESSAGE} (ODsay: ${raw})`;
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

/**
 * 값이 없으면 태그가 빠지거나 문자열 "null"로 온다 → 둘 다 없음 처리.
 * 2026-10-29 실응답(홍대입구→노원): 2호선 door "9-1", 마지막 4호선 door "null"·endExitNo "3", startExitNo 없음.
 */
function optionalText(value: unknown): string | undefined {
  if (typeof value !== 'string' && typeof value !== 'number') return undefined;
  const text = String(value).trim();
  return text && text !== 'null' ? text : undefined;
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
      door: optionalText(sub.door),
      startExitNo: optionalText(sub.startExitNo),
      endExitNo: optionalText(sub.endExitNo),
    });
  }

  return segments.length > 0 ? { segments, walkToFirstStationMinutes, transferWalkMinutes } : null;
}

/** 응답 → 경로 목록. 오류 응답이면 OdsayError */
export function parseOdsayRoutes(body: OdsayResponse): Route[] {
  if (body.error) throw new OdsayError(errorMessage(body.error));
  return (body.result?.path ?? []).map(toRoute).filter((r): r is Route => r !== null);
}
