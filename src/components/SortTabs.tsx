import Link from 'next/link';

import { SORT_KEYS, type SortKey } from '@/lib/transit/planner';

interface SortTabsProps {
  current: SortKey;
  /** 현재 검색 조건 — 정렬만 바꾼 링크를 만든다 */
  params: Record<string, string | undefined>;
}

export const SORT_LABEL: Record<SortKey, string> = {
  late: '늦게 출발순',
  fast: '최단시간순',
  transfer: '최소환승순',
};

/** 정렬 탭 — 링크라서 JS 없이 동작 (같은 조건은 캐시돼 ODsay 재호출 없음) */
export default function SortTabs({ current, params }: SortTabsProps) {
  const hrefFor = (sort: SortKey): string => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v && k !== 'sort') q.set(k, v);
    if (sort !== 'late') q.set('sort', sort);
    return `/?${q}`;
  };

  return (
    <nav className="grid grid-cols-3 gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1 text-sm">
      {SORT_KEYS.map((key) => (
        <Link
          key={key}
          href={hrefFor(key)}
          scroll={false}
          aria-current={key === current ? 'page' : undefined}
          className={`rounded-lg py-2 text-center transition-colors ${
            key === current ? 'bg-indigo-500 font-semibold text-white' : 'text-white/60 hover:bg-white/5'
          }`}
        >
          {SORT_LABEL[key]}
        </Link>
      ))}
    </nav>
  );
}
