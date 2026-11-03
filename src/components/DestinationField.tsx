'use client';

import { useRef, useState } from 'react';

import LineBadge from './LineBadge';
import { searchPlacesAction } from '@/app/actions';
import { stationKey } from '@/lib/transit/lines';
import type { PlaceOption } from '@/lib/transit/types';

interface StationName {
  name: string;
  lines: string[];
}

interface DestinationFieldProps {
  stations: StationName[];
  defaultName?: string;
  defaultLat?: string;
  defaultLng?: string;
  defaultAddress?: string;
  className: string;
}

/** 타자 칠 때마다 검색하지 않도록 */
const DEBOUNCE_MS = 300;
const MAX_STATIONS = 3;

type Suggestion = { kind: 'station'; station: StationName } | { kind: 'place'; place: PlaceOption };

interface Selected {
  lat: string;
  lng: string;
  address: string;
}

function matchStations(stations: StationName[], query: string): StationName[] {
  const q = stationKey(query).replace(/역$/, '');
  if (!q) return [];
  return stations.filter((s) => stationKey(s.name).startsWith(q)).slice(0, MAX_STATIONS);
}

/**
 * 도착지 입력 — 역 이름 또는 장소(건물·주소). 장소를 고르면 좌표를 hidden input으로 실어 보낸다.
 * 고르지 않고 제출하면 서버가 역 이름 → 장소 검색 1순위 순서로 찾는다.
 */
export default function DestinationField({
  stations,
  defaultName,
  defaultLat,
  defaultLng,
  defaultAddress,
  className,
}: DestinationFieldProps) {
  const [text, setText] = useState(defaultName ?? '');
  const [selected, setSelected] = useState<Selected | null>(
    defaultLat && defaultLng ? { lat: defaultLat, lng: defaultLng, address: defaultAddress ?? '' } : null,
  );
  const [places, setPlaces] = useState<PlaceOption[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** 늦게 도착한 이전 검색 결과가 최신 결과를 덮지 않도록 */
  const latestQuery = useRef('');

  const suggestions: Suggestion[] = [
    ...matchStations(stations, text).map((station) => ({ kind: 'station' as const, station })),
    ...places.map((place) => ({ kind: 'place' as const, place })),
  ];

  function onChange(value: string): void {
    setText(value);
    setSelected(null);
    setOpen(true);
    latestQuery.current = value.trim();
    if (timer.current) clearTimeout(timer.current);
    if (value.trim().length < 2) {
      setPlaces([]);
      return;
    }
    timer.current = setTimeout(async () => {
      const query = value.trim();
      const result = await searchPlacesAction(query);
      if (latestQuery.current === query) setPlaces(result);
    }, DEBOUNCE_MS);
  }

  function choose(s: Suggestion): void {
    if (s.kind === 'station') {
      setText(s.station.name);
      setSelected(null);
    } else {
      setText(s.place.name);
      setSelected({ lat: s.place.lat.toFixed(6), lng: s.place.lng.toFixed(6), address: s.place.address });
    }
    setOpen(false);
  }

  return (
    <div className="relative grid gap-1 text-xs text-white/60">
      <label htmlFor="destination">도착역 또는 장소</label>
      <input
        id="destination"
        name="to"
        value={text}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        required
        autoComplete="off"
        placeholder="예: 광화문, 롯데월드, 홍대 놀이터"
        className={className}
      />
      {selected && (
        <>
          <input type="hidden" name="toLat" value={selected.lat} />
          <input type="hidden" name="toLng" value={selected.lng} />
          <input type="hidden" name="toAddr" value={selected.address} />
          <p className="truncate text-[11px] text-emerald-300/80">📍 {selected.address}</p>
        </>
      )}
      {open && suggestions.length > 0 && (
        <ul className="absolute top-full right-0 left-0 z-10 mt-1 max-h-72 overflow-y-auto rounded-xl border border-white/10 bg-slate-900 py-1 shadow-xl">
          {suggestions.map((s) => (
            <li key={s.kind === 'station' ? `s:${s.station.name}` : `p:${s.place.name}:${s.place.address}`}>
              {/* onMouseDown: input blur보다 먼저 실행돼야 목록이 닫히기 전에 고를 수 있다 */}
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(s);
                }}
                className="grid w-full gap-0.5 px-3 py-2 text-left hover:bg-white/5"
              >
                {s.kind === 'station' ? (
                  <span className="flex flex-wrap items-center gap-1.5 text-sm text-white">
                    🚇 {s.station.name}
                    {s.station.lines.map((line) => (
                      <LineBadge key={line} line={line} size="sm" />
                    ))}
                  </span>
                ) : (
                  <>
                    <span className="text-sm text-white">📍 {s.place.name}</span>
                    <span className="truncate text-[11px] text-white/40">{s.place.address}</span>
                  </>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
