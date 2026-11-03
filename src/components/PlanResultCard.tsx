import LegTimeline from './LegTimeline';
import { stationLabel } from '@/lib/transit/lines';
import { transferCount, tripMinutes } from '@/lib/transit/planner';
import { formatClock, formatDuration } from '@/lib/transit/time';
import type { PartialPlan, PlanResult, ServiceMinutes } from '@/lib/transit/types';

type OkPlan = Extract<PlanResult, { ok: true }>;

/** 막차를 놓쳤을 때: 마지막 구간 중간역까지 가는 더 늦은 열차 */
function PartialNotice({
  partial,
  destination,
  now,
}: {
  partial: PartialPlan;
  destination: string;
  now: ServiceMinutes | null;
}) {
  const lastLeg = partial.legs[partial.legs.length - 1];
  const remaining = now === null ? null : partial.leaveBy - now;
  return (
    <div className="mx-4 mb-3 rounded-xl border border-violet-400/25 bg-violet-500/10 px-3 py-2.5">
      <p className="flex flex-wrap items-baseline gap-x-2 text-sm font-semibold text-violet-100">
        <span>🌙 이것도 놓쳤다면 {formatClock(partial.leaveBy)}까지 출발</span>
        {remaining !== null && remaining > 0 && (
          <span className="text-xs font-normal text-violet-200/70">{formatDuration(Math.floor(remaining))} 남음</span>
        )}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-violet-100/70">
        {lastLeg.segment.line} {formatClock(lastLeg.departAt)} {stationLabel(partial.terminal)}행을 타면{' '}
        {stationLabel(partial.terminal)}까지는 가요 ({formatClock(partial.terminalArriveAt)} 도착) ·{' '}
        {stationLabel(destination)}까지는 택시나 도보로 가야 해요
      </p>
    </div>
  );
}

/** 장소 검색으로 고른 도착지 — 이때만 출구·마지막 도보가 의미 있다 */
export interface DestinationPlace {
  name: string;
  address: string;
}

interface PlanResultCardProps {
  plan: OkPlan;
  /** 오늘이 아닌 요일 시간표를 보고 있으면 null — 남은 시간을 계산하지 않는다 */
  now: ServiceMinutes | null;
  /** "평일" / "토요일" / "휴일" */
  dayLabel: string;
  bufferMinutes: number;
  /** 정렬 기준에 맞춘 추천 이유 (예: "가장 빨리 도착하는 경로") */
  title: string;
  arrivalPlace?: DestinationPlace;
}

const URGENT_MINUTES = 15;

/** "소요 43분 · 환승 2회" */
export function routeStats(plan: OkPlan): string {
  const transfers = transferCount(plan);
  return `소요 ${formatDuration(tripMinutes(plan))} · ${transfers === 0 ? '환승 없음' : `환승 ${transfers}회`}`;
}

/** 마지막 역에서 내려 목적지까지 — "노원역 4번 출구로 나가서 도보 4분 · 01:04쯤 도착" */
function ArrivalLine({ plan, place }: { plan: OkPlan; place: DestinationPlace }) {
  const { arrival } = plan.route;
  if (!arrival) return null;
  const station = stationLabel(plan.legs[plan.legs.length - 1].segment.to.name);
  return (
    <div className="mt-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
      <p>
        🚪 {station} {arrival.exitNo ? <strong className="text-emerald-50">{arrival.exitNo}번 출구</strong> : ''}
        {arrival.exitNo ? '로 나가서' : '에서'} 도보 {arrival.walkMinutes}분 ·{' '}
        <span className="tabular-nums">{formatClock(plan.arriveAt + arrival.walkMinutes)}</span>쯤 도착
      </p>
      <p className="mt-0.5 truncate text-[11px] text-emerald-200/60">
        📍 {place.name}
        {place.address && ` · ${place.address}`}
      </p>
    </div>
  );
}

/** 출발 마감 시각 + 구간 타임라인을 한 카드에 */
export default function PlanResultCard({
  plan,
  now,
  dayLabel,
  bufferMinutes,
  title,
  arrivalPlace,
}: PlanResultCardProps) {
  const remaining = now === null ? null : plan.leaveBy - now;
  const missed = remaining !== null && remaining < 0;
  const urgent = remaining !== null && !missed && remaining <= URGENT_MINUTES;
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
          {remaining === null
            ? `${dayLabel} 시간표`
            : missed
              ? `${formatDuration(Math.ceil(-remaining))} 지남`
              : `${urgent ? '서둘러요! ' : ''}${formatDuration(Math.floor(remaining))} 남음`}
        </p>
      </div>
      <p className="px-5 pb-3 text-[11px] text-white/40">
        {stationLabel(firstStation)}까지 도보 {walk}분 + 여유 {bufferMinutes}분 포함 ·{' '}
        {now === null ? `${dayLabel} 기준 (오늘 아님)` : `${dayLabel} · 기준 ${formatClock(now)}`}
      </p>
      {plan.partial && (
        <PartialNotice partial={plan.partial} destination={plan.legs[plan.legs.length - 1].segment.to.name} now={now} />
      )}

      <div className="border-t border-white/10 bg-black/20 px-4 py-3">
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <h2 className="text-xs font-semibold text-white/80">{title}</h2>
          <span className="text-[11px] text-white/50">{routeStats(plan)}</span>
        </div>
        <LegTimeline plan={plan} />
        {arrivalPlace && <ArrivalLine plan={plan} place={arrivalPlace} />}
      </div>
    </section>
  );
}
