import LineBadge from './LineBadge';
import { lineStyle } from '@/lib/transit/lineColors';
import { formatClock } from '@/lib/transit/time';
import type { PlanResult } from '@/lib/transit/types';

interface LegTimelineProps {
  plan: Extract<PlanResult, { ok: true }>;
}

/** 구간별 탑승 시각 — 추천 경로 카드와 다른 경로 펼침에서 같이 쓴다 */
export default function LegTimeline({ plan }: LegTimelineProps) {
  return (
    <ol className="grid gap-2">
      {plan.legs.map((leg, i) => (
        <li key={`${i}-${leg.segment.line}-${leg.segment.from.name}`} className="grid gap-2">
          {i > 0 && (
            <p className="pl-4 text-xs text-white/40">
              ↳ {leg.segment.from.name} 환승 · 도보 {plan.route.transferWalkMinutes[i - 1]}분
            </p>
          )}
          <div
            className="flex items-start gap-3 rounded-xl border-l-4 bg-white/[0.04] p-3"
            style={{ borderLeftColor: lineStyle(leg.segment.line).color }}
          >
            <LineBadge line={leg.segment.line} />
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
                {leg.segment.direction && `${leg.segment.direction} · `}
                {formatClock(leg.departAt)} 출발 → {formatClock(leg.arriveAt)} 도착
              </p>
            </div>
          </div>
        </li>
      ))}
      <p className="pt-1 text-right text-xs text-white/50">최종 도착 {formatClock(plan.arriveAt)}</p>
    </ol>
  );
}
