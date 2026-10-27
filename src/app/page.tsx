import PlanResultCard from '@/components/PlanResultCard';
import SearchForm from '@/components/SearchForm';
import { planLastTrain } from '@/lib/transit/planner';
import { getProviders } from '@/lib/transit/providers';
import { DAY_TYPE_LABEL, nowInSeoul } from '@/lib/transit/time';

interface SearchParams {
  from?: string;
  to?: string;
  walk?: string;
  buffer?: string;
}

const DEFAULT_WALK = 5;
const DEFAULT_BUFFER = 3;

function parseMinutes(value: string | undefined, fallback: number): number {
  const n = Number(value);
  if (value === undefined || value === '' || !Number.isFinite(n)) return fallback;
  return Math.min(60, Math.max(0, Math.round(n)));
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/70">
      {children}
    </p>
  );
}

export default async function Home({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const providers = getProviders();
  const now = nowInSeoul();

  const walk = parseMinutes(params.walk, DEFAULT_WALK);
  const buffer = parseMinutes(params.buffer, DEFAULT_BUFFER);
  const { from, to } = params;

  let result: React.ReactNode = null;
  if (from && to) {
    if (from === to) {
      result = <Notice>출발역과 도착역이 같아요.</Notice>;
    } else {
      const route = await providers.routes.findRoute(from, to);
      if (!route) {
        result = <Notice>이 구간은 아직 샘플 데이터에 경로가 없어요. 다른 역을 골라주세요.</Notice>;
      } else {
        const plan = await planLastTrain(route, providers.timetable, {
          dayType: now.dayType,
          walkToStationMinutes: walk,
          bufferMinutes: buffer,
        });
        result = plan.ok ? (
          <PlanResultCard
            plan={plan}
            now={now.minutes}
            walkToStationMinutes={walk}
            bufferMinutes={buffer}
          />
        ) : (
          <Notice>
            {plan.segment.line} {plan.segment.from.name}역의 열차 시간표를 찾지 못했어요.
          </Notice>
        );
      }
    }
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
          ⚠️ 샘플 데이터예요. 실제 노선·막차 시각과 다릅니다. (API 연동 전)
        </p>
      )}

      <SearchForm
        origins={providers.origins}
        destinations={providers.destinations}
        defaults={{ from, to, walk, buffer }}
      />

      <p className="text-xs text-white/40">
        오늘은 {DAY_TYPE_LABEL[now.dayType]} 시간표 기준 · 공휴일은 아직 반영하지 않아요
      </p>

      {result}
    </main>
  );
}
