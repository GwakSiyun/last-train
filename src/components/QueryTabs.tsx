import Link from 'next/link';

export interface TabOption<T extends string> {
  value: T;
  label: string;
}

interface QueryTabsProps<T extends string> {
  /** 바꿀 쿼리 파라미터 이름 (예: "sort", "day") */
  paramKey: string;
  options: readonly TabOption<T>[];
  current: T;
  /** 이 값이면 파라미터를 URL에서 뺀다 */
  defaultValue: T;
  /** 현재 검색 조건 — 이 파라미터만 바꾼 링크를 만든다 */
  params: Record<string, string | undefined>;
  label?: string;
}

/** 링크 탭 — JS 없이 동작 (같은 검색 조건은 캐시돼 ODsay 재호출 없음) */
export default function QueryTabs<T extends string>({
  paramKey,
  options,
  current,
  defaultValue,
  params,
  label,
}: QueryTabsProps<T>) {
  const hrefFor = (value: T): string => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v && k !== paramKey) q.set(k, v);
    if (value !== defaultValue) q.set(paramKey, value);
    return `/?${q}`;
  };

  return (
    <nav aria-label={label} className="flex items-center gap-2">
      {label && <span className="shrink-0 text-[11px] text-white/40">{label}</span>}
      <div
        className="grid flex-1 gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1 text-sm"
        style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      >
        {options.map((opt) => (
          <Link
            key={opt.value}
            href={hrefFor(opt.value)}
            scroll={false}
            aria-current={opt.value === current ? 'page' : undefined}
            className={`truncate rounded-lg px-1 py-1.5 text-center transition-colors ${
              opt.value === current ? 'bg-indigo-500 font-semibold text-white' : 'text-white/60 hover:bg-white/5'
            }`}
          >
            {opt.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
