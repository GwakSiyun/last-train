import LegTimeline from './LegTimeline';
import { RouteLines } from './LineBadge';
import { routeStats } from './PlanResultCard';
import { stationLabel } from '@/lib/transit/lines';
import { formatClock } from '@/lib/transit/time';
import type { PlanResult } from '@/lib/transit/types';

interface OtherRoutesProps {
  plans: PlanResult[];
}

/**
 * 추천 경로 외 나머지. 계산된 경로는 <details>로 펼쳐 구간별 시각을 비교할 수 있다 (JS 없음).
 * 계산 불가 경로도 이유와 함께 그대로 보여준다.
 */
export default function OtherRoutes({ plans }: OtherRoutesProps) {
  if (plans.length === 0) return null;

  return (
    <section className="grid gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <h2 className="text-xs text-white/50">다른 경로</h2>
      <ul className="grid gap-2">
        {plans.map((plan, i) => {
          const lines = plan.route.segments.map((s) => s.line);

          if (!plan.ok) {
            return (
              <li key={i} className="flex items-center justify-between gap-3 px-1 py-1.5">
                <RouteLines lines={lines} />
                <span className="shrink-0 text-xs text-white/40">
                  {plan.reason === 'UNSUPPORTED'
                    ? `${plan.segment.line} 시간표 정보 없음`
                    : `${plan.segment.line} 탈 수 있는 열차 없음`}
                </span>
              </li>
            );
          }

          return (
            <li key={i}>
              <details className="group rounded-xl bg-white/[0.03]">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 hover:bg-white/[0.04] [&::-webkit-details-marker]:hidden">
                  <span className="grid gap-1">
                    <RouteLines lines={lines} />
                    <span className="text-[11px] text-white/40">{routeStats(plan)}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2 text-sm tabular-nums text-white/70">
                    {formatClock(plan.leaveBy)} 출발
                    <span className="text-xs text-white/40 transition-transform group-open:rotate-180">▾</span>
                  </span>
                </summary>
                <div className="border-t border-white/5 p-3">
                  <p className="mb-2 text-xs text-white/40">
                    {stationLabel(plan.legs[0].segment.from.name)}까지 도보{' '}
                    {plan.route.walkToFirstStationMinutes}분
                  </p>
                  <LegTimeline plan={plan} />
                </div>
              </details>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
