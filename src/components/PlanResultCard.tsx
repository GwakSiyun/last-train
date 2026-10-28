import LegTimeline from './LegTimeline';
import { stationLabel } from '@/lib/transit/lines';
import { transferCount, tripMinutes } from '@/lib/transit/planner';
import { formatClock, formatDuration } from '@/lib/transit/time';
import type { PlanResult, ServiceMinutes } from '@/lib/transit/types';

type OkPlan = Extract<PlanResult, { ok: true }>;

interface PlanResultCardProps {
  plan: OkPlan;
  now: ServiceMinutes;
  bufferMinutes: number;
  /** 정렬 기준에 맞춘 추천 이유 (예: "가장 빨리 도착하는 경로") */
  title: string;
}

const URGENT_MINUTES = 15;

/** "소요 43분 · 환승 2회" */
export function routeStats(plan: OkPlan): string {
  const transfers = transferCount(plan);
  return `소요 ${formatDuration(tripMinutes(plan))} · ${transfers === 0 ? '환승 없음' : `환승 ${transfers}회`}`;
}

/** 출발 마감 시각 + 구간 타임라인을 한 카드에 */
export default function PlanResultCard({ plan, now, bufferMinutes, title }: PlanResultCardProps) {
  const remaining = plan.leaveBy - now;
  const missed = remaining < 0;
  const urgent = !missed && remaining <= URGENT_MINUTES;
  const walk = plan.route.walkToFirstStationMinutes;
  const firstStation = plan.legs[0].segment.from.name;

  const tone = missed
    ? 'border-rose-400/40 bg-rose-500/10'
    : urgent
      ? 'border-amber-400/40 bg-amber-500/10'
      : 'border-indigo-400/30 bg-indigo-500/10';

  return (
    <section className={`overflow-hidden rounded-2xl border ${tone}`}>
      <div className="flex items-end justify-between gap-4 px-5 pt-4 pb-3">
        <div>
          <p className={`text-xs ${missed ? 'text-rose-200' : 'text-white/70'}`}>
            {missed ? '막차를 놓쳤어요 · 이때까지 나갔어야 해요' : '이 시각까지 출발하세요'}
          </p>
          <p className="mt-0.5 text-5xl font-bold tracking-tight tabular-nums">{formatClock(plan.leaveBy)}</p>
        </div>
        <p
          className={`pb-1 text-right text-sm font-medium ${
            missed ? 'text-rose-200' : urgent ? 'text-amber-200' : 'text-white/70'
          }`}
        >
          {missed
            ? `${formatDuration(Math.ceil(-remaining))} 지남`
            : `${urgent ? '서둘러요! ' : ''}${formatDuration(Math.floor(remaining))} 남음`}
        </p>
      </div>
      <p className="px-5 pb-3 text-[11px] text-white/40">
        {stationLabel(firstStation)}까지 도보 {walk}분 + 여유 {bufferMinutes}분 포함 · 기준 {formatClock(now)}
      </p>

      <div className="border-t border-white/10 bg-black/20 px-4 py-3">
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <h2 className="text-xs font-semibold text-white/80">{title}</h2>
          <span className="text-[11px] text-white/50">{routeStats(plan)}</span>
        </div>
        <LegTimeline plan={plan} />
      </div>
    </section>
  );
}
