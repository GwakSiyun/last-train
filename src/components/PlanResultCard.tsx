import LegTimeline from './LegTimeline';
import { stationLabel } from '@/lib/transit/lines';
import { formatClock, formatDuration } from '@/lib/transit/time';
import type { PlanResult, ServiceMinutes } from '@/lib/transit/types';

type OkPlan = Extract<PlanResult, { ok: true }>;

interface PlanResultCardProps {
  plan: OkPlan;
  now: ServiceMinutes;
  bufferMinutes: number;
}

const URGENT_MINUTES = 15;

export default function PlanResultCard({ plan, now, bufferMinutes }: PlanResultCardProps) {
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
    <section className="grid gap-4">
      <div className={`rounded-2xl border p-5 ${tone}`}>
        {missed ? (
          <>
            <p className="text-sm text-rose-200">막차를 놓쳤어요</p>
            <p className="mt-1 text-4xl font-bold tabular-nums">{formatClock(plan.leaveBy)}</p>
            <p className="mt-2 text-sm text-white/60">
              이 시각까지 출발했어야 했어요 ({formatDuration(Math.ceil(-remaining))} 지남)
            </p>
          </>
        ) : (
          <>
            <p className="text-sm text-white/70">이 시각까지 출발하세요</p>
            <p className="mt-1 text-5xl font-bold tabular-nums">{formatClock(plan.leaveBy)}</p>
            <p className={`mt-2 text-sm ${urgent ? 'text-amber-200' : 'text-white/60'}`}>
              {urgent ? '서둘러요! ' : ''}지금부터 {formatDuration(Math.floor(remaining))} 남았어요
            </p>
          </>
        )}
        <p className="mt-3 text-xs text-white/40">
          {stationLabel(firstStation)}까지 도보 {walk}분 + 여유 {bufferMinutes}분 포함 · 기준 시각{' '}
          {formatClock(now)}
        </p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <LegTimeline plan={plan} />
      </div>
    </section>
  );
}
