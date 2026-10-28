import 'server-only';

import { cached, ONE_DAY_MS } from './cache';
import { uniqueLines } from './lineColors';
import { lineKey, stationKey } from './lines';
import type {
  DayType,
  ServiceMinutes,
  StationOption,
  TimetableProvider,
  TrainQuery,
  TrainResult,
} from './types';

/**
 * 서울 열린데이터광장 지하철 API (2026-10-28 실호출로 응답 확인).
 * - SearchInfoBySubwayNameService: 역명·노선 → STATION_CD (전체 799역)
 * - SearchSTNTimeTableByIDService: STATION_CD·요일·상하행 → 열차별 시각 (자정 이후는 "24:38:00")
 * - subwayStationMaster: 역 좌표
 * ⚠️ 신분당선·수인분당선 등은 시간표가 비어 있음 → UNSUPPORTED 처리.
 */

const BASE = 'http://openapi.seoul.go.kr:8088';

const WEEK_TAG: Record<DayType, string> = { WEEKDAY: '1', SATURDAY: '2', HOLIDAY: '3' };
const INOUT_TAGS = ['1', '2'] as const;

interface StationInfoRow {
  STATION_CD: string;
  STATION_NM: string;
  LINE_NUM: string;
  FR_CODE: string;
}

interface StationMasterRow {
  BLDN_ID: string;
  BLDN_NM: string;
  ROUTE: string;
  LAT: string;
  LOT: string;
}

interface TimetableRow {
  TRAIN_NO: string;
  ARRIVETIME: string;
  LEFTTIME: string;
}

interface Train {
  departAt: ServiceMinutes;
  arriveAt: ServiceMinutes;
}

function apiKey(): string {
  const key = process.env.SEOUL_OPEN_API_KEY;
  if (!key) throw new Error('SEOUL_OPEN_API_KEY가 설정되지 않았어요.');
  return key;
}

interface SeoulResult {
  CODE: string;
  MESSAGE: string;
}

/** 데이터 없음 = 정상 응답의 빈 결과 */
const NO_DATA = 'INFO-200';

function fetchRows<T>(service: string, ...params: string[]): Promise<T[]> {
  const path = [service, '1', '1000', ...params].map(encodeURIComponent).join('/');

  return cached(`seoul:${path}`, ONE_DAY_MS, async () => {
    const res = await fetch(`${BASE}/${apiKey()}/json/${path}/`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`서울 API ${service} HTTP ${res.status}`);

    // 인증키 오류는 json 요청에도 XML로 와서 여기서 파싱 실패 → 오류로 처리
    const body = (await res.json().catch(() => {
      throw new Error(`서울 API ${service} 응답을 읽지 못했어요 (인증키 확인 필요).`);
    })) as Record<string, unknown>;

    const payload = body[service] as { row?: T[] } | undefined;
    if (payload) return payload.row ?? [];

    // 데이터가 없으면 서비스 키 없이 { RESULT: { CODE: 'INFO-200' } } 형태로 온다
    const result = body.RESULT as SeoulResult | undefined;
    if (result?.CODE === NO_DATA) return [];
    throw new Error(`서울 API ${service}: ${result?.MESSAGE ?? '알 수 없는 응답'}`);
  });
}

/** "24:38:30" → 1478.5 / "00:00:00"(시각 없음) → null */
function parseTime(value: string): ServiceMinutes | null {
  const m = value.match(/^(\d{1,2}):(\d{2}):(\d{2})$/);
  if (!m || value === '00:00:00') return null;
  let minutes = Number(m[1]) * 60 + Number(m[2]) + Number(m[3]) / 60;
  if (minutes < 4 * 60) minutes += 24 * 60;
  return minutes;
}

async function stationCodeIndex(): Promise<Map<string, string>> {
  const rows = await fetchRows<StationInfoRow>('SearchInfoBySubwayNameService');
  return new Map(rows.map((r) => [`${lineKey(r.LINE_NUM)}|${stationKey(r.STATION_NM)}`, r.STATION_CD]));
}

async function stationTimes(
  stationCd: string,
  dayType: DayType,
  pick: 'depart' | 'arrive',
): Promise<Map<string, ServiceMinutes>> {
  const tables = await Promise.all(
    INOUT_TAGS.map((inout) =>
      fetchRows<TimetableRow>('SearchSTNTimeTableByIDService', stationCd, WEEK_TAG[dayType], inout),
    ),
  );
  const times = new Map<string, ServiceMinutes>();
  for (const row of tables.flat()) {
    const [primary, fallback] =
      pick === 'depart' ? [row.LEFTTIME, row.ARRIVETIME] : [row.ARRIVETIME, row.LEFTTIME];
    const t = parseTime(primary) ?? parseTime(fallback);
    if (t !== null) times.set(row.TRAIN_NO, t);
  }
  return times;
}

/**
 * 타는 역·내리는 역 시간표를 열차번호로 조인 → 실제로 내릴 역까지 가는 열차만 남는다.
 * (예: 압구정까지만 가는 막차는 종로3가 시간표에 없어서 자동 제외)
 */
async function trainsBetween(query: TrainQuery): Promise<Train[] | null> {
  const index = await stationCodeIndex();
  const key = lineKey(query.segment.line);
  const fromCd = index.get(`${key}|${stationKey(query.segment.from.name)}`);
  const toCd = index.get(`${key}|${stationKey(query.segment.to.name)}`);
  if (!fromCd || !toCd) return null;

  const [departs, arrives] = await Promise.all([
    stationTimes(fromCd, query.dayType, 'depart'),
    stationTimes(toCd, query.dayType, 'arrive'),
  ]);

  // 반대 방향·순환선 반대로 도는 열차 제외
  const maxRide = query.segment.rideMinutes * 2 + 10;
  const trains: Train[] = [];
  for (const [trainNo, depart] of departs) {
    const arrive = arrives.get(trainNo);
    if (arrive === undefined) continue;
    const ride = arrive - depart;
    if (ride > 0 && ride <= maxRide) {
      // 출발은 내림(그 분까지 승강장에), 도착은 올림 — 보수적으로
      trains.push({ departAt: Math.floor(depart), arriveAt: Math.ceil(arrive) });
    }
  }
  return trains;
}

export const seoulTimetableProvider: TimetableProvider = {
  async latestTrain(query: TrainQuery): Promise<TrainResult> {
    const trains = await trainsBetween(query);
    // 역 매칭 실패(null) 또는 시간표 자체가 없는 노선([])
    if (trains === null || trains.length === 0) return { status: 'UNSUPPORTED' };

    const { arriveBy } = query;
    const candidates = arriveBy === undefined ? trains : trains.filter((t) => t.arriveAt <= arriveBy);
    if (candidates.length === 0) return { status: 'NO_TRAIN' };

    const best = candidates.reduce((a, b) => (b.departAt > a.departAt ? b : a));
    return { status: 'OK', ...best };
  },
};

/**
 * 역 검색 선택지 — 같은 이름의 여러 노선은 하나로 합친다.
 * 마스터 역명엔 부역명이 붙어 있어("광화문(세종문화회관)") 괄호를 떼고 합친다.
 */
export async function seoulStations(): Promise<StationOption[]> {
  const rows = await fetchRows<StationMasterRow>('subwayStationMaster');
  const byName = new Map<string, StationOption>();
  for (const r of rows) {
    const lat = Number(r.LAT);
    const lng = Number(r.LOT);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const name = stationKey(r.BLDN_NM);
    const existing = byName.get(name);
    if (existing) existing.lines.push(r.ROUTE);
    else byName.set(name, { name, lat, lng, lines: [r.ROUTE] });
  }
  // "경부선"·"과천선" 같은 운영 구간명을 1호선·4호선 등 익숙한 노선명으로 합친다
  for (const station of byName.values()) station.lines = uniqueLines(station.lines);
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name, 'ko'));
}
