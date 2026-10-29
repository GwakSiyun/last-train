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
    <ol className="grid gap-1.5">
      {plan.legs.map((leg, i) => (
        <li key={`${i}-${leg.segment.line}-${leg.segment.from.name}`} className="grid gap-1.5">
          {i > 0 && (
            <p className="pl-3 text-[11px] text-white/40">
              ↳ {leg.segment.from.name} 환승 · 도보 {plan.route.transferWalkMinutes[i - 1]}분
            </p>
          )}
          <div
            className="flex items-center gap-2.5 rounded-lg border-l-4 bg-white/[0.04] px-3 py-2"
            style={{ borderLeftColor: lineStyle(leg.segment.line).color }}
          >
            <LineBadge line={leg.segment.line} />
            <div className="min-w-0 flex-1">
              {/* 역 이름이 길면 줄바꿈 (잘리면 도착역이 안 보임) — 막차 배지는 항상 보이게 */}
              <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm font-medium">
                <span className="break-keep">
                  {leg.segment.from.name} → {leg.segment.to.name}
                </span>
                {leg.isLastTrain && (
                  <span className="shrink-0 rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] text-rose-200">
                    막차
                  </span>
                )}
              </p>
              {leg.segment.direction && (
                <p className="truncate text-[11px] text-white/40">{leg.segment.direction}</p>
              )}
            </div>
            <p className="shrink-0 text-right text-xs tabular-nums text-white/70">
              {formatClock(leg.departAt)}
              <span className="text-white/30"> → </span>
              {formatClock(leg.arriveAt)}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
