import { lineStyle } from '@/lib/transit/lineColors';

interface LineBadgeProps {
  line: string;
  size?: 'sm' | 'md';
}

/** 노선 색 배지 — 숫자 노선은 동그라미, 나머지는 알약 모양 */
export default function LineBadge({ line, size = 'md' }: LineBadgeProps) {
  const { label, short, color } = lineStyle(line);
  const isNumber = /^\d$/.test(short);
  const dims = size === 'sm' ? 'h-5 min-w-5 text-[10px]' : 'h-6 min-w-6 text-xs';

  return (
    <span
      title={label}
      aria-label={label}
      style={{ backgroundColor: color }}
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white ${dims} ${
        isNumber ? '' : 'px-2'
      }`}
    >
      {short}
    </span>
  );
}

/** 경로 요약: ② → ③ → ⑤ */
export function RouteLines({ lines }: { lines: string[] }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {lines.map((line, i) => (
        <span key={i} className="inline-flex items-center gap-1">
          {i > 0 && <span className="text-[10px] text-white/30">→</span>}
          <LineBadge line={line} size="sm" />
        </span>
      ))}
    </span>
  );
}
