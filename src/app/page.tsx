import LiveResult from '@/components/LiveResult';
import Notice from '@/components/Notice';
import ResultView, { BUFFER_MINUTES } from '@/components/ResultView';
import SearchForm from '@/components/SearchForm';
import SearchPanel from '@/components/SearchPanel';
import { findByStationName } from '@/lib/transit/lines';
import { planAllRoutes, SORT_KEYS, type SortKey } from '@/lib/transit/planner';
import { getProviders, type TransitProviders } from '@/lib/transit/providers';
import { holidayName, hasHolidayKey } from '@/lib/transit/holidays';
import { DAY_TYPE_LABEL, nowInSeoul, withHoliday, type SeoulNow } from '@/lib/transit/time';
import type { DayType, Place, PlanResult, StationOption } from '@/lib/transit/types';

interface SearchParams {
  from?: string;
  to?: string;
  lat?: string;
  lng?: string;
  sort?: string;
  /** 시간표 요일 직접 선택 (공휴일 등). 없으면 오늘 요일 */
  day?: string;
}

const DAY_TYPES: readonly DayType[] = ['WEEKDAY', 'SATURDAY', 'HOLIDAY'];

function parseDay(value: string | undefined, today: DayType): DayType {
  return DAY_TYPES.find((d) => d === value) ?? today;
}

function parseSort(value: string | undefined): SortKey {
  return SORT_KEYS.find((k) => k === value) ?? 'late';
}

function footnote(now: SeoulNow, holidayChecked: boolean): string {
  const today = now.holidayName
    ? `오늘은 ${now.holidayName}이라 휴일 시간표로 계산해요`
    : holidayChecked
      ? `오늘은 ${DAY_TYPE_LABEL[now.dayType]} 시간표로 계산해요 (공휴일 자동 확인)`
      : `오늘은 ${DAY_TYPE_LABEL[now.dayType]}로 계산해요 · 공휴일이면 결과 위에서 '휴일·공휴일'을 골라주세요`;
  return `${today} · 서울 시간표가 없는 노선(신분당선 등)은 계산에서 빠져요`;
}

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : '알 수 없는 오류가 발생했어요.';
}

function parseCoord(value: string | undefined, min: number, max: number): number | null {
  const n = Number(value);
  return value && Number.isFinite(n) && n >= min && n <= max ? n : null;
}

const findStation = findByStationName<StationOption>;

function resolveOrigin(params: SearchParams, stations: StationOption[]): Place | string {
  if (params.from?.trim()) {
    return findStation(stations, params.from) ?? `"${params.from.trim()}" 역을 찾지 못했어요. 목록에서 골라주세요.`;
  }
  const lat = parseCoord(params.lat, 33, 39);
  const lng = parseCoord(params.lng, 124, 132);
  if (lat !== null && lng !== null) return { name: '현재 위치', lat, lng };
  return '현재 위치를 켜거나 출발역을 입력해주세요.';
}

async function Result({
  params,
  stations,
  providers,
  now,
}: {
  params: SearchParams;
  stations: StationOption[];
  providers: TransitProviders;
  now: SeoulNow;
}) {
  const destination = findStation(stations, params.to);
  if (!destination) return <Notice>도착역 &quot;{params.to}&quot;을(를) 찾지 못했어요. 목록에서 골라주세요.</Notice>;

  const sort = parseSort(params.sort);
  const dayType = parseDay(params.day, now.dayType);
  const nowMinutes = dayType === now.dayType ? now.minutes : null;
  const origin = resolveOrigin(params, stations);
  if (typeof origin === 'string') return <Notice>{origin}</Notice>;
  if (origin.name === destination.name) return <Notice>출발역과 도착역이 같아요.</Notice>;

  const tabParams = { ...params };
  const to: Place = { name: destination.name, lat: destination.lat, lng: destination.lng };

  // 배포: 브라우저가 ODsay 호출 → 서버 액션이 막차 계산
  if (providers.routeMode === 'browser') {
    return (
      <LiveResult
        key={JSON.stringify([origin, to, sort, dayType])}
        origin={{ name: origin.name, lat: origin.lat, lng: origin.lng }}
        destination={to}
        sort={sort}
        dayType={dayType}
        today={now.dayType}
        nowMinutes={nowMinutes}
        params={tabParams}
      />
    );
  }

  // 로컬(Server 키)·샘플: 서버에서 모두 계산
  let plans: PlanResult[];
  try {
    const routes = await providers.routes.findRoutes(origin, destination);
    plans = await planAllRoutes(routes, providers.timetable, { dayType, bufferMinutes: BUFFER_MINUTES }, sort);
  } catch (e) {
    return <Notice tone="error">경로·시간표를 불러오지 못했어요: {errorText(e)}</Notice>;
  }

  return (
    <ResultView
      plans={plans}
      sort={sort}
      dayType={dayType}
      today={now.dayType}
      nowMinutes={nowMinutes}
      params={tabParams}
      emptyMessage={providers.isMock ? '이 구간은 샘플 데이터에 경로가 없어요.' : '지하철 경로를 찾지 못했어요.'}
    />
  );
}

export default async function Home({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const providers = getProviders();

  // 공휴일 키가 있으면 오늘이 공휴일인지 확인 → 휴일 시간표. 실패해도 요일 기준으로 계속 (안내 표시)
  let now = nowInSeoul();
  let holidayError: string | null = null;
  if (hasHolidayKey()) {
    try {
      now = withHoliday(now, await holidayName(now.serviceDate));
    } catch (e) {
      holidayError = errorText(e);
    }
  }

  let stations: StationOption[] = [];
  let stationsError: string | null = null;
  try {
    stations = await providers.stations();
  } catch (e) {
    stationsError = errorText(e);
  }

  const searched = Boolean(params.to && !stationsError);
  const originLabel = params.from?.trim() || (params.lat && params.lng ? '현재 위치' : '출발지');

  return (
    <main className="mx-auto grid max-w-md gap-4 px-4 py-5 lg:max-w-5xl lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:gap-8 lg:py-10">
      {/* 왼쪽(모바일: 위) — 검색. 데스크톱에선 스크롤해도 고정 */}
      <aside className="grid content-start gap-4 lg:sticky lg:top-10 lg:self-start">
        <header className="flex items-baseline justify-between gap-3 lg:block">
          <h1 className="text-xl font-bold lg:text-2xl">
            <span className="mr-2 text-xs font-medium tracking-widest text-indigo-300 lg:block lg:mb-1">
              LAST TRAIN
            </span>
            막차 계산기
          </h1>
          <p className="hidden text-sm text-white/60 lg:mt-1 lg:block">
            환승까지 따져서, 몇 시까지 나가야 막차를 탈 수 있는지 알려드려요.
          </p>
        </header>

        {providers.isMock && (
          <p className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            ⚠️ 샘플 데이터예요. 실제 노선·막차 시각과 다릅니다. (API 키 미설정)
          </p>
        )}

        {stationsError && <Notice tone="error">역 목록을 불러오지 못했어요: {stationsError}</Notice>}
        {holidayError && (
          <p className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            공휴일 정보를 불러오지 못해 요일 기준으로 계산해요. 공휴일이면 &apos;휴일·공휴일&apos;을 골라주세요. (
            {holidayError})
          </p>
        )}

        <SearchPanel collapsible={searched} origin={originLabel} destination={params.to ?? ''}>
          <SearchForm stations={stations} defaults={params} />
        </SearchPanel>

        <p className="hidden text-xs leading-relaxed text-white/40 lg:block">{footnote(now, hasHolidayKey() && !holidayError)}</p>
      </aside>

      {/* 오른쪽(모바일: 아래) — 결과 */}
      <section className="grid content-start gap-3">
        {searched ? (
          <Result params={params} stations={stations} providers={providers} now={now} />
        ) : (
          <div className="hidden h-full min-h-80 place-items-center rounded-2xl border border-dashed border-white/10 text-center text-sm text-white/40 lg:grid">
            <p>
              도착역을 입력하면
              <br />
              몇 시까지 나가야 하는지 여기에 떠요 🚇
            </p>
          </div>
        )}
        <p className="text-[11px] leading-relaxed text-white/30 lg:hidden">{footnote(now, hasHolidayKey() && !holidayError)}</p>
      </section>

      {/* 서비스 소개 — 검색엔진이 무슨 사이트인지 파악하도록 (화면에선 작게) */}
      <footer className="grid gap-1.5 border-t border-white/5 pt-4 text-[11px] leading-relaxed text-white/35 lg:col-span-2">
        <h2 className="text-xs font-semibold text-white/50">막차 계산기는 이렇게 계산해요</h2>
        <p>
          도착역을 입력하고 현재 위치(또는 출발역)를 고르면, 갈 수 있는 지하철 경로마다 마지막 구간의 막차에서
          거꾸로 계산해 환승역 막차까지 탈 수 있는 가장 늦은 출발 시각을 알려드려요. 역까지 걷는 시간과 환승 도보
          시간, 여유 3분을 포함해요.
        </p>
        <p>
          서울 열린데이터광장의 역별 열차 시간표(1~9호선 등)와 공휴일 정보를 사용하고, 평일·토요일·휴일 시간표를
          구분해요. 중간에 끊기는 막차(예: 일부 구간까지만 가는 열차)는 제외해요. 실제 운행은 지연·임시 변경이 있을 수
          있으니 여유 있게 출발하세요.
        </p>
      </footer>
    </main>
  );
}
