import type { Station } from '@/lib/transit/types';

interface SearchFormProps {
  origins: Station[];
  destinations: Station[];
  defaults: { from?: string; to?: string; walk: number; buffer: number };
}

const fieldClass =
  'w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none focus:border-indigo-400';

/** GET 폼 — 클라이언트 JS 없이 searchParams로 서버에 전달 */
export default function SearchForm({ origins, destinations, defaults }: SearchFormProps) {
  return (
    <form method="GET" className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="grid grid-cols-2 gap-3">
        <label className="grid gap-1.5 text-xs text-white/60">
          출발역
          <select name="from" defaultValue={defaults.from ?? ''} required className={fieldClass}>
            <option value="" disabled>
              선택
            </option>
            {origins.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5 text-xs text-white/60">
          도착역
          <select name="to" defaultValue={defaults.to ?? ''} required className={fieldClass}>
            <option value="" disabled>
              선택
            </option>
            {destinations.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="grid gap-1.5 text-xs text-white/60">
          역까지 걸어가는 시간 (분)
          <input
            type="number"
            name="walk"
            min={0}
            max={60}
            defaultValue={defaults.walk}
            className={fieldClass}
          />
        </label>
        <label className="grid gap-1.5 text-xs text-white/60">
          여유 시간 (분)
          <input
            type="number"
            name="buffer"
            min={0}
            max={60}
            defaultValue={defaults.buffer}
            className={fieldClass}
          />
        </label>
      </div>

      <button
        type="submit"
        className="mt-1 rounded-xl bg-indigo-500 py-3 text-sm font-semibold text-white hover:bg-indigo-400"
      >
        막차 계산하기
      </button>
    </form>
  );
}
