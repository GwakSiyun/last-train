'use client';

import { useEffect, useState } from 'react';

import Notice from './Notice';
import ResultView, { BUFFER_MINUTES, DayTabs } from './ResultView';
import { planRoutesAction } from '@/app/actions';
import { fetchRoutesInBrowser } from '@/lib/transit/odsayBrowser';
import { OdsayError } from '@/lib/transit/odsayParse';
import type { SortKey } from '@/lib/transit/planner';
import type { DayType, Place, PlanResult, ServiceMinutes } from '@/lib/transit/types';

interface LiveResultProps {
  origin: Place;
  destination: Place;
  sort: SortKey;
  dayType: DayType;
  today: DayType;
  nowMinutes: ServiceMinutes | null;
  params: Record<string, string | undefined>;
}

function failText(detail: string): string {
  return `경로·시간표를 불러오지 못했어요: ${detail}`;
}

type State = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'done'; plans: PlanResult[] };

/**
 * 배포 환경용: 브라우저가 ODsay에서 경로를 받고(URI 키) → 서버 액션이 서울 시간표로 막차 계산.
 * 데이터를 브라우저에서 가져오는 건 Vercel IP 제약 때문 (서버 우선 원칙의 예외).
 * 검색 조건이 바뀌면 부모가 key를 바꿔 새로 마운트한다 → 항상 loading부터 시작.
 */
export default function LiveResult({ origin, destination, sort, dayType, today, nowMinutes, params }: LiveResultProps) {
  const [state, setState] = useState<State>({ kind: 'loading' });
  // 서버에서 다시 렌더되면 같은 값도 새 객체로 오므로, 값 기준으로 비교
  const request = JSON.stringify({ origin, destination, sort, dayType });

  useEffect(() => {
    let cancelled = false;
    const q = JSON.parse(request) as Pick<LiveResultProps, 'origin' | 'destination' | 'sort' | 'dayType'>;
    (async () => {
      try {
        const routes = await fetchRoutesInBrowser(q.origin, q.destination);
        const result = await planRoutesAction(routes, q.dayType, q.sort, BUFFER_MINUTES);
        if (!cancelled) {
          setState(result.ok ? { kind: 'done', plans: result.plans } : { kind: 'error', message: failText(result.message) });
        }
      } catch (e) {
        // ODsay 오류는 이미 안내 문장으로 만들어져 있다
        const message = e instanceof OdsayError ? e.message : failText(e instanceof Error ? e.message : '알 수 없는 오류');
        if (!cancelled) setState({ kind: 'error', message });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [request]);

  if (state.kind === 'loading') {
    return (
      <>
        <DayTabs current={dayType} today={today} params={params} />
        <div className="grid h-48 animate-pulse place-items-center rounded-2xl border border-white/10 bg-white/[0.03] text-sm text-white/40">
          경로와 막차 시간표 확인 중…
        </div>
      </>
    );
  }
  if (state.kind === 'error') return <Notice tone="error">{state.message}</Notice>;

  return (
    <ResultView
      plans={state.plans}
      sort={sort}
      dayType={dayType}
      today={today}
      nowMinutes={nowMinutes}
      params={params}
      emptyMessage="지하철 경로를 찾지 못했어요."
    />
  );
}
