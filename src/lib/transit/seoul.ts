import 'server-only';

import { cached, ONE_DAY_MS } from './cache';
import { uniqueLines } from './lineColors';
import { lineKey, stationKey } from './lines';
import type {
  DayType,
  PartialTrain,
  PartialTrainQuery,
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
 * ⚠️ 1~9호선도 일시적으로 전부 빈 값(INFO-200)을 줄 때가 있음 (2026-10-28 16시경 3~9호선 확인) → UNAVAILABLE.
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
  /** 1·2 = 상·하행(내·외선) */
  INOUT_TAG: string;
  /** 이 열차의 종착역 STATION_CD / 이름 (2026-11-03 실응답 확인: 4704 → 0419 한성대입구) */
  DESTSTATION: string;
  SUBWAYENAME: string;
}

interface Train {
  trainNo: string;
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

  // 빈 결과는 저장하지 않는다 — 서울 API가 일시적으로 비었다가 복구돼도 바로 반영되게
  return cached(`seoul:${path}`, ONE_DAY_MS, async (): Promise<T[]> => {
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
  }, (rows) => rows.length > 0);
}

/** 평소 시간표가 있는 노선 — 이 노선이 비어 있으면 '지원 안 함'이 아니라 일시 장애 */
function hasTimetableNormally(line: string): boolean {
  return /^0[1-9]호선$/.test(lineKey(line));
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

async function stationRows(stationCd: string, dayType: DayType): Promise<TimetableRow[]> {
  const tables = await Promise.all(
    INOUT_TAGS.map((inout) =>
      fetchRows<TimetableRow>('SearchSTNTimeTableByIDService', stationCd, WEEK_TAG[dayType], inout),
    ),
  );
  return tables.flat();
}

function rowTime(row: TimetableRow, pick: 'depart' | 'arrive'): ServiceMinutes | null {
  const [primary, fallback] = pick === 'depart' ? [row.LEFTTIME, row.ARRIVETIME] : [row.ARRIVETIME, row.LEFTTIME];
  return parseTime(primary) ?? parseTime(fallback);
}

function timesOf(rows: TimetableRow[], pick: 'depart' | 'arrive'): Map<string, ServiceMinutes> {
  const times = new Map<string, ServiceMinutes>();
  for (const row of rows) {
    const t = rowTime(row, pick);
    if (t !== null) times.set(row.TRAIN_NO, t);
  }
  return times;
}

/** 반대 방향·순환선 반대로 도는 열차를 거르는 최대 탑승 시간 */
function maxRideMinutes(rideMinutes: number): number {
  return rideMinutes * 2 + 10;
}

/** 두 역 시간표를 열차번호로 조인 (출발은 내림·도착은 올림 — 보수적으로) */
function joinTrains(
  departs: Map<string, ServiceMinutes>,
  arrives: Map<string, ServiceMinutes>,
  rideMinutes: number,
): Train[] {
  const trains: Train[] = [];
  for (const [trainNo, depart] of departs) {
    const arrive = arrives.get(trainNo);
    if (arrive === undefined) continue;
    const ride = arrive - depart;
    if (ride > 0 && ride <= maxRideMinutes(rideMinutes)) {
      trains.push({ trainNo, departAt: Math.floor(depart), arriveAt: Math.ceil(arrive) });
    }
  }
  return trains;
}

/**
 * 타는 역·내리는 역 시간표를 열차번호로 조인 → 실제로 내릴 역까지 가는 열차만 남는다.
 * (예: 압구정까지만 가는 막차는 종로3가 시간표에 없어서 자동 제외)
 */
async function trainsBetween(query: TrainQuery): Promise<Train[] | 'NO_STATION' | 'EMPTY_TIMETABLE'> {
  const index = await stationCodeIndex();
  const key = lineKey(query.segment.line);
  const fromCd = index.get(`${key}|${stationKey(query.segment.from.name)}`);
  const toCd = index.get(`${key}|${stationKey(query.segment.to.name)}`);
  if (!fromCd || !toCd) return 'NO_STATION';

  const [fromRows, toRows] = await Promise.all([stationRows(fromCd, query.dayType), stationRows(toCd, query.dayType)]);
  const departs = timesOf(fromRows, 'depart');
  const arrives = timesOf(toRows, 'arrive');
  if (departs.size === 0 || arrives.size === 0) return 'EMPTY_TIMETABLE';
  return joinTrains(departs, arrives, query.segment.rideMinutes);
}

/** 한 구간에서 종착역 후보를 몇 곳까지 확인할지 (역마다 시간표 2번 호출) */
const MAX_TERMINALS = 3;

/**
 * 내릴 역까지 가는 막차보다 늦게 출발하지만 내릴 역 전에 운행이 끝나는 열차 중 가장 늦은 것.
 * - 같은 방향(INOUT_TAG)이고, 내릴 역 시간표에 없는 열차
 * - 종착역이 실제로 가는 길 위인지 확인: 내릴 역까지 가는 열차가 그 종착역을 중간에 지나야 한다
 *   (5호선 마천/하남처럼 갈라지는 노선에서 다른 갈래로 가는 열차를 거르기 위함)
 */
async function latestPartialTrain(query: PartialTrainQuery): Promise<PartialTrain | null> {
  const index = await stationCodeIndex();
  const key = lineKey(query.segment.line);
  const fromCd = index.get(`${key}|${stationKey(query.segment.from.name)}`);
  const toCd = index.get(`${key}|${stationKey(query.segment.to.name)}`);
  if (!fromCd || !toCd) return null;

  const [fromRows, toRows] = await Promise.all([stationRows(fromCd, query.dayType), stationRows(toCd, query.dayType)]);
  const arrives = timesOf(toRows, 'arrive');
  const fullTrains = joinTrains(timesOf(fromRows, 'depart'), arrives, query.segment.rideMinutes);
  const last = fullTrains.find((t) => t.departAt === query.after);
  const direction = last && fromRows.find((r) => r.TRAIN_NO === last.trainNo)?.INOUT_TAG;
  if (!direction) return null;

  const candidates = fromRows
    .map((row) => ({ row, depart: rowTime(row, 'depart') }))
    .filter(
      (c): c is { row: TimetableRow; depart: ServiceMinutes } =>
        c.depart !== null &&
        Math.floor(c.depart) > query.after &&
        c.row.INOUT_TAG === direction &&
        Boolean(c.row.DESTSTATION) &&
        !arrives.has(c.row.TRAIN_NO),
    )
    .sort((a, b) => b.depart - a.depart);

  const terminals = [...new Set(candidates.map((c) => c.row.DESTSTATION))].slice(0, MAX_TERMINALS);
  for (const terminalCd of terminals) {
    const terminalArrives = timesOf(await stationRows(terminalCd, query.dayType), 'arrive');
    const onTheWay = fullTrains.some((t) => {
      const passAt = terminalArrives.get(t.trainNo);
      return passAt !== undefined && passAt > t.departAt && passAt < t.arriveAt;
    });
    if (!onTheWay) continue;

    for (const { row, depart } of candidates) {
      if (row.DESTSTATION !== terminalCd) continue;
      const arrive = terminalArrives.get(row.TRAIN_NO);
      if (arrive === undefined || arrive <= depart || arrive - depart > maxRideMinutes(query.segment.rideMinutes))
        continue;
      return { departAt: Math.floor(depart), arriveAt: Math.ceil(arrive), terminal: stationKey(row.SUBWAYENAME) };
    }
  }
  return null;
}

export const seoulTimetableProvider: TimetableProvider = {
  async latestTrain(query: TrainQuery): Promise<TrainResult> {
    const trains = await trainsBetween(query);
    if (trains === 'EMPTY_TIMETABLE' && hasTimetableNormally(query.segment.line)) {
      return { status: 'UNAVAILABLE' };
    }
    // 역 매칭 실패·시간표 자체가 없는 노선·같이 서는 열차 없음
    if (typeof trains === 'string' || trains.length === 0) return { status: 'UNSUPPORTED' };

    const { arriveBy } = query;
    const candidates = arriveBy === undefined ? trains : trains.filter((t) => t.arriveAt <= arriveBy);
    if (candidates.length === 0) return { status: 'NO_TRAIN' };

    const best = candidates.reduce((a, b) => (b.departAt > a.departAt ? b : a));
    return { status: 'OK', departAt: best.departAt, arriveAt: best.arriveAt };
  },
  latestPartialTrain,
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
