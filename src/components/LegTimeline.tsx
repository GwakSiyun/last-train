import LineBadge from './LineBadge';
import { lineStyle } from '@/lib/transit/lineColors';
import { formatClock } from '@/lib/transit/time';
import type { PlanResult } from '@/lib/transit/types';

type OkPlan = Extract<PlanResult, { ok: true }>;

interface LegTimelineProps {
  plan: OkPlan;
}

/** 이 이하면 환승이 빠듯하다고 경고 */
const TIGHT_TRANSFER_MINUTES = 1;

/** 환승역에 내려서 걸어간 뒤 다음 열차까지 남는 시간 (출발은 내림·도착은 올림이라 보수적) */
function transferSlack(plan: OkPlan, i: number): number {
  return plan.legs[i].departAt - plan.legs[i - 1].arriveAt - plan.route.transferWalkMinutes[i - 1];
}

function Chip({ children, tone = 'plain' }: { children: React.ReactNode; tone?: 'plain' | 'accent' }) {
  const color = tone === 'accent' ? 'bg-amber-400/15 text-amber-200' : 'bg-white/[0.06] text-white/60';
  return <span className={`rounded px-1.5 py-0.5 text-[10px] ${color}`}>{children}</span>;
}

/** 구간별 탑승 시각 — 추천 경로 카드와 다른 경로 펼침에서 같이 쓴다 */
export default function LegTimeline({ plan }: LegTimelineProps) {
  return (
    <ol className="grid gap-1.5">
      {plan.legs.map((leg, i) => {
        const isLast = i === plan.legs.length - 1;
        const slack = i > 0 ? transferSlack(plan, i) : null;
        const tight = slack !== null && slack <= TIGHT_TRANSFER_MINUTES;
        const { door, startExitNo, endExitNo } = leg.segment;
        return (
          <li key={`${i}-${leg.segment.line}-${leg.segment.from.name}`} className="grid gap-1.5">
            {slack !== null && (
              <p className={`pl-3 text-[11px] ${tight ? 'text-amber-300' : 'text-white/40'}`}>
                ↳ {leg.segment.from.name} 환승 · 도보 {plan.route.transferWalkMinutes[i - 1]}분 · 여유{' '}
                {Math.max(0, Math.floor(slack))}분{tight && ' ⚠️ 빠듯해요'}
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
                {leg.segment.direction && <p className="truncate text-[11px] text-white/40">{leg.segment.direction}</p>}
                {/* 빠른 환승 위치는 다음 환승이 있는 구간에만 (마지막 구간 값의 의미는 문서에 없음) */}
                {((door && !isLast) || (i === 0 && startExitNo) || (isLast && endExitNo)) && (
                  <p className="mt-1 flex flex-wrap gap-1">
                    {i === 0 && startExitNo && <Chip>{startExitNo}번 출구로 들어가기</Chip>}
                    {door && !isLast && <Chip tone="accent">빠른 환승 {door}</Chip>}
                    {isLast && endExitNo && <Chip>{endExitNo}번 출구로 나가기</Chip>}
                  </p>
                )}
              </div>
              <p className="shrink-0 text-right text-xs tabular-nums text-white/70">
                {formatClock(leg.departAt)}
                <span className="text-white/30"> → </span>
                {formatClock(leg.arriveAt)}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
