import 'server-only';

import { cached, ONE_DAY_MS } from './cache';

/**
 * 한국천문연구원 특일 정보 — 공휴일 조회 (getRestDeInfo, 2026-10-28 실호출로 응답 확인).
 * - solYear만 주면 1년치. _type=json 지원.
 * - ⚠️ 결과 1건이면 item이 배열이 아닌 객체, 0건이면 items가 "" (빈 문자열)로 온다.
 * - 대체공휴일·노동절 등도 포함되며 isHoliday === 'Y'만 공휴일로 본다.
 */

const ENDPOINT = 'https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo';
const OK = '00';

interface HolidayItem {
  dateName: string;
  isHoliday: string;
  locdate: number;
}

interface HolidayResponse {
  response?: {
    header?: { resultCode?: string; resultMsg?: string };
    body?: { items?: { item?: HolidayItem | HolidayItem[] } | '' };
  };
}

export function hasHolidayKey(): boolean {
  return Boolean(process.env.DATA_GO_KR_SERVICE_KEY);
}

/** 해당 연도 공휴일: "20261003" → "개천절" */
function holidaysOf(year: number): Promise<Map<string, string>> {
  return cached(`holidays:${year}`, ONE_DAY_MS, async () => {
    const key = process.env.DATA_GO_KR_SERVICE_KEY;
    if (!key) throw new Error('DATA_GO_KR_SERVICE_KEY가 설정되지 않았어요.');

    const params = new URLSearchParams({
      serviceKey: key,
      solYear: String(year),
      numOfRows: '100',
      _type: 'json',
    });
    const res = await fetch(`${ENDPOINT}?${params}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`공휴일 API HTTP ${res.status}`);

    // 키 오류 등은 json 요청에도 XML로 올 수 있다 → 파싱 실패 = 오류
    const body = (await res.json().catch(() => {
      throw new Error('공휴일 API 응답을 읽지 못했어요 (인증키 확인 필요).');
    })) as HolidayResponse;

    const header = body.response?.header;
    if (header?.resultCode !== OK) throw new Error(`공휴일 API: ${header?.resultMsg ?? '알 수 없는 응답'}`);

    const items = body.response?.body?.items;
    const raw = items === '' || !items?.item ? [] : Array.isArray(items.item) ? items.item : [items.item];

    return new Map(raw.filter((h) => h.isHoliday === 'Y').map((h) => [String(h.locdate), h.dateName]));
  });
}

/** "20261003" → "개천절" / 공휴일 아니면 null */
export async function holidayName(ymd: string): Promise<string | null> {
  const holidays = await holidaysOf(Number(ymd.slice(0, 4)));
  return holidays.get(ymd) ?? null;
}
