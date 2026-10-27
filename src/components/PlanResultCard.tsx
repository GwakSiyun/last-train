import { formatClock, formatDuration } from '@/lib/transit/time';
import type { PlanResult, ServiceMinutes } from '@/lib/transit/types';

interface PlanResultCardProps {
  plan: Extract<PlanResult, { ok: true }>;
  now: ServiceMinutes;
  walkToStationMinutes: number;
  bufferMinutes: number;
}

const URGENT_MINUTES = 15;

export default function PlanResultCard({
  plan,
  now,
  walkToStationMinutes,
  bufferMinutes,
}: PlanResultCardProps) {
  const remaining = plan.leaveBy - now;
  const missed = remaining < 0;
  const urgent = !missed && remaining <= URGENT_MINUTES;

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
              이 시각까지 출발했어야 했어요 ({formatDuration(-remaining)} 지남)
            </p>
          </>
        ) : (
          <>
            <p className="text-sm text-white/70">이 시각까지 출발하세요</p>
            <p className="mt-1 text-5xl font-bold tabular-nums">{formatClock(plan.leaveBy)}</p>
            <p className={`mt-2 text-sm ${urgent ? 'text-amber-200' : 'text-white/60'}`}>
              {urgent ? '서둘러요! ' : ''}지금부터 {formatDuration(remaining)} 남았어요
            </p>
          </>
        )}
        <p className="mt-3 text-xs text-white/40">
          도보 {walkToStationMinutes}분 + 여유 {bufferMinutes}분 포함 · 기준 시각 {formatClock(now)}
        </p>
      </div>

      <ol className="grid gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        {plan.legs.map((leg, i) => (
          <li key={`${leg.segment.line}-${leg.segment.from.id}`} className="grid gap-2">
            {i > 0 && (
              <p className="pl-4 text-xs text-white/40">
                ↳ {leg.segment.from.name} 환승 · 도보 {plan.transferWalkMinutes[i - 1]}분
              </p>
            )}
            <div className="flex items-start gap-3 rounded-xl bg-white/[0.04] p-3">
              <span className="shrink-0 rounded-md bg-white/10 px-2 py-1 text-xs font-semibold">
                {leg.segment.line}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {leg.segment.from.name} → {leg.segment.to.name}
                  {leg.isLastTrain && (
                    <span className="ml-2 rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] text-rose-200">
                      막차
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-xs text-white/50">
                  {leg.segment.direction} · {formatClock(leg.departAt)} 출발 → {formatClock(leg.arriveAt)} 도착
                </p>
              </div>
            </div>
          </li>
        ))}
        <p className="pt-1 text-right text-xs text-white/50">
          최종 도착 {formatClock(plan.arriveAt)}
        </p>
      </ol>
    </section>
  );
}
