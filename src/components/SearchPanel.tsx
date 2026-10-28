'use client';

import { useState } from 'react';

interface SearchPanelProps {
  /** 검색 결과가 있으면 모바일에서 폼을 접고 요약 바만 보여준다 */
  collapsible: boolean;
  origin: string;
  destination: string;
  /** 서버에서 렌더한 폼 (children 합성 — 폼은 server 유지) */
  children: React.ReactNode;
}

/** 모바일 접기/펼치기만 담당. 데스크톱(lg)에선 항상 펼침. */
export default function SearchPanel({ collapsible, origin, destination, children }: SearchPanelProps) {
  const [open, setOpen] = useState(!collapsible);

  return (
    <div className="grid gap-2">
      {collapsible && !open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left lg:hidden"
        >
          <span className="min-w-0 truncate text-sm">
            <span className="text-white/60">{origin}</span>
            <span className="mx-2 text-white/30">→</span>
            <span className="font-semibold">{destination}</span>
          </span>
          <span className="shrink-0 text-xs text-indigo-300">수정</span>
        </button>
      )}
      <div className={open ? '' : 'hidden lg:block'}>{children}</div>
    </div>
  );
}
