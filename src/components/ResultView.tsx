import Notice from './Notice';
import OtherRoutes from './OtherRoutes';
import PlanResultCard from './PlanResultCard';
import QueryTabs, { type TabOption } from './QueryTabs';
import type { SortKey } from '@/lib/transit/planner';
import { DAY_TYPE_LABEL } from '@/lib/transit/time';
import type { DayType, PlanResult, ServiceMinutes } from '@/lib/transit/types';

/** 결과 화면 — 서버 계산(로컬)·브라우저 경로 조회(배포) 양쪽이 같이 쓴다 */

export const BUFFER_MINUTES = 3;

const SORT_OPTIONS: readonly TabOption<SortKey>[] = [
  { value: 'late', label: '늦게 출발순' },
  { value: 'fast', label: '최단시간순' },
  { value: 'transfer', label: '최소환승순' },
];

const DAY_TYPES: readonly DayType[] = ['WEEKDAY', 'SATURDAY', 'HOLIDAY'];

const CARD_TITLE: Record<SortKey, string> = {
  late: '가장 늦게 출발해도 되는 경로',
  fast: '가장 빨리 도착하는 경로',
  transfer: '환승이 가장 적은 경로',
};

type Params = Record<string, string | undefined>;

interface DayTabsProps {
  current: DayType;
  today: DayType;
  params: Params;
}

export function DayTabs({ current, today, params }: DayTabsProps) {
  const options = DAY_TYPES.map((d) => ({
    value: d,
    label: d === today ? `${DAY_TYPE_LABEL[d]}(오늘)` : d === 'HOLIDAY' ? '휴일·공휴일' : DAY_TYPE_LABEL[d],
  }));
  return (
    <QueryTabs label="시간표" paramKey="day" options={options} current={current} defaultValue={today} params={params} />
  );
}

interface ResultViewProps {
  plans: PlanResult[];
  sort: SortKey;
  dayType: DayType;
  today: DayType;
  /** 오늘이 아닌 요일을 보고 있으면 null */
  nowMinutes: ServiceMinutes | null;
  params: Params;
  emptyMessage: string;
}

export default function ResultView({ plans, sort, dayType, today, nowMinutes, params, emptyMessage }: ResultViewProps) {
  const dayTabs = <DayTabs current={dayType} today={today} params={params} />;
  if (plans.length === 0) {
    return (
      <>
        {dayTabs}
        <Notice>{emptyMessage}</Notice>
      </>
    );
  }

  const [best, ...rest] = plans;
  return (
    <>
      {dayTabs}
      {plans.filter((p) => p.ok).length > 1 && (
        <QueryTabs label="정렬" paramKey="sort" options={SORT_OPTIONS} current={sort} defaultValue="late" params={params} />
      )}
      {best.ok ? (
        <PlanResultCard
          plan={best}
          now={nowMinutes}
          dayLabel={DAY_TYPE_LABEL[dayType]}
          bufferMinutes={BUFFER_MINUTES}
          title={CARD_TITLE[sort]}
        />
      ) : (
        <Notice>
          {plans.some((p) => !p.ok && p.reason === 'UNAVAILABLE')
            ? '서울시 지하철 시간표를 지금 불러오지 못했어요. 서울 열린데이터 쪽 일시적인 문제라 잠시 후 다시 시도해주세요.'
            : '막차를 계산할 수 있는 경로가 없어요. (시간표 정보가 없는 노선만 있어요)'}
        </Notice>
      )}
      <OtherRoutes plans={best.ok ? rest : plans} />
    </>
  );
}
