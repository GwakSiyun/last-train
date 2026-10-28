import OtherRoutes from '@/components/OtherRoutes';
import PlanResultCard from '@/components/PlanResultCard';
import SearchForm from '@/components/SearchForm';
import { findByStationName } from '@/lib/transit/lines';
import { planAllRoutes } from '@/lib/transit/planner';
import { getProviders, type TransitProviders } from '@/lib/transit/providers';
import { DAY_TYPE_LABEL, nowInSeoul, type SeoulNow } from '@/lib/transit/time';
import type { Place, PlanResult, StationOption } from '@/lib/transit/types';

interface SearchParams {
  from?: string;
  to?: string;
  lat?: string;
  lng?: string;
}

const BUFFER_MINUTES = 3;

function Notice({ children, tone = 'plain' }: { children: React.ReactNode; tone?: 'plain' | 'error' }) {
  const cls =
    tone === 'error'
      ? 'border-rose-400/30 bg-rose-500/10 text-rose-100'
      : 'border-white/10 bg-white/[0.03] text-white/70';
  return <p className={`rounded-2xl border p-4 text-sm ${cls}`}>{children}</p>;
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

  const origin = resolveOrigin(params, stations);
  if (typeof origin === 'string') return <Notice>{origin}</Notice>;
  if (origin.name === destination.name) return <Notice>출발역과 도착역이 같아요.</Notice>;

  let plans: PlanResult[];
  try {
    const routes = await providers.routes.findRoutes(origin, destination);
    plans = await planAllRoutes(routes, providers.timetable, {
      dayType: now.dayType,
      bufferMinutes: BUFFER_MINUTES,
    });
  } catch (e) {
    return <Notice tone="error">경로·시간표를 불러오지 못했어요: {errorText(e)}</Notice>;
  }

  if (plans.length === 0) {
    return (
      <Notice>{providers.isMock ? '이 구간은 샘플 데이터에 경로가 없어요.' : '지하철 경로를 찾지 못했어요.'}</Notice>
    );
  }

  const [best, ...rest] = plans;
  return (
    <>
      {best.ok ? (
        <PlanResultCard plan={best} now={now.minutes} bufferMinutes={BUFFER_MINUTES} />
      ) : (
        <Notice>막차를 계산할 수 있는 경로가 없어요. (시간표 정보가 없는 노선만 있어요)</Notice>
      )}
      <OtherRoutes plans={best.ok ? rest : plans} />
    </>
  );
}

export default async function Home({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const providers = getProviders();
  const now = nowInSeoul();

  let stations: StationOption[] = [];
  let stationsError: string | null = null;
  try {
    stations = await providers.stations();
  } catch (e) {
    stationsError = errorText(e);
  }

  return (
    <main className="mx-auto grid max-w-md gap-5 px-4 py-10">
      <header>
        <p className="text-xs tracking-widest text-indigo-300">LAST TRAIN</p>
        <h1 className="mt-1 text-2xl font-bold">막차 계산기</h1>
        <p className="mt-1 text-sm text-white/60">
          환승까지 따져서, 몇 시까지 나가야 막차를 탈 수 있는지 알려드려요.
        </p>
      </header>

      {providers.isMock && (
        <p className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          ⚠️ 샘플 데이터예요. 실제 노선·막차 시각과 다릅니다. (API 키 미설정)
        </p>
      )}

      {stationsError && <Notice tone="error">역 목록을 불러오지 못했어요: {stationsError}</Notice>}

      <SearchForm stations={stations} defaults={params} />

      <p className="text-xs text-white/40">
        오늘은 {DAY_TYPE_LABEL[now.dayType]} 시간표 기준 · 공휴일은 아직 반영하지 않아요 · 서울 시간표가
        없는 노선(신분당선 등)은 계산에서 빠져요
      </p>

      {params.to && !stationsError && (
        <Result params={params} stations={stations} providers={providers} now={now} />
      )}
    </main>
  );
}
