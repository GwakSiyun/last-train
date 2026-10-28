import LocationField from './LocationField';
import type { StationOption } from '@/lib/transit/types';

interface SearchFormProps {
  stations: StationOption[];
  defaults: { from?: string; to?: string; lat?: string; lng?: string; day?: string; sort?: string };
}

/** 모바일은 16px — 아이폰 사파리는 입력칸 글자가 16px 미만이면 포커스 때 화면을 확대한다 */
const fieldClass =
  'w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-base outline-none lg:text-sm placeholder:text-white/30 focus:border-indigo-400';

const STATION_LIST_ID = 'station-list';

/** GET 폼 — 위치 버튼만 client, 나머지는 searchParams로 서버에 전달 */
export default function SearchForm({ stations, defaults }: SearchFormProps) {
  return (
    <form method="GET" className="grid gap-2.5 rounded-2xl border border-white/10 bg-white/[0.03] p-3.5">
      {/* 다시 검색해도 고른 시간표 요일·정렬 유지 */}
      {defaults.day && <input type="hidden" name="day" value={defaults.day} />}
      {defaults.sort && <input type="hidden" name="sort" value={defaults.sort} />}
      <datalist id={STATION_LIST_ID}>
        {/* 텍스트 = 자동완성 목록에 보이는 보조 설명 (예: "2호선 · 신분당선") */}
        {stations.map((s) => (
          <option key={s.name} value={s.name}>
            {s.lines.join(' · ')}
          </option>
        ))}
      </datalist>


      <LocationField
        stations={stations.map(({ name, lat, lng, lines }) => ({ name, lat, lng, lines }))}
        defaultLat={defaults.lat}
        defaultLng={defaults.lng}
      />

      <label className="grid gap-1 text-xs text-white/60">
        <span>
          또는 출발역 입력 <span className="text-white/30">(현재 위치보다 우선)</span>
        </span>
        <input
          name="from"
          list={STATION_LIST_ID}
          defaultValue={defaults.from}
          autoComplete="off"
          placeholder="예: 강남"
          className={fieldClass}
        />
      </label>

      <label className="grid gap-1 text-xs text-white/60">
        도착역
        <input
          name="to"
          list={STATION_LIST_ID}
          defaultValue={defaults.to}
          required
          autoComplete="off"
          placeholder="예: 광화문"
          className={fieldClass}
        />
      </label>

      <button
        type="submit"
        className="rounded-xl bg-indigo-500 py-2.5 text-sm font-semibold text-white hover:bg-indigo-400"
      >
        막차 계산하기
      </button>
    </form>
  );
}
