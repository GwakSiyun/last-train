'use client';

import { useEffect, useRef, useState } from 'react';

import LineBadge from './LineBadge';
import { nearest, type Coord } from '@/lib/transit/geo';
import { stationLabel } from '@/lib/transit/lines';

interface StationPoint extends Coord {
  name: string;
  lines: string[];
}

interface LocationFieldProps {
  stations: StationPoint[];
  defaultLat?: string;
  defaultLng?: string;
}

/** 이보다 멀면 "근처에 역이 없다"고 안내 */
const NEARBY_LIMIT_M = 3000;

function formatMeters(m: number): string {
  return m < 1000 ? `${Math.round(m / 10) * 10}m` : `${(m / 1000).toFixed(1)}km`;
}

type Status =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; accuracy?: number }
  | { kind: 'error'; message: string };

const GEO_ERRORS: Record<number, string> = {
  1: '위치 권한이 거부됐어요. 브라우저 설정에서 허용하거나 출발역을 입력해주세요.',
  2: '현재 위치를 찾지 못했어요.',
  3: '위치 확인이 너무 오래 걸려요. 다시 시도해주세요.',
};

/** 현재 위치(GPS)를 hidden input으로 폼에 실어 보낸다 — 이 페이지의 유일한 client 섬 */
export default function LocationField({ stations, defaultLat, defaultLng }: LocationFieldProps) {
  const [coords, setCoords] = useState(
    defaultLat && defaultLng ? { lat: defaultLat, lng: defaultLng } : null,
  );
  const [status, setStatus] = useState<Status>(coords ? { kind: 'ready' } : { kind: 'idle' });
  /** 위치를 받은 뒤 제출할 폼 — hidden input이 실제로 렌더된 다음(effect)에 제출해야 좌표가 실린다 */
  const pendingSubmit = useRef<HTMLFormElement | null>(null);

  const closest = coords ? nearest({ lat: Number(coords.lat), lng: Number(coords.lng) }, stations) : null;

  useEffect(() => {
    const form = pendingSubmit.current;
    if (form && coords) {
      pendingSubmit.current = null;
      form.requestSubmit();
    }
  }, [coords]);

  function locate(button: HTMLButtonElement): void {
    if (!('geolocation' in navigator)) {
      setStatus({ kind: 'error', message: '이 브라우저는 위치 기능을 지원하지 않아요.' });
      return;
    }
    setStatus({ kind: 'loading' });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // 도착역이 이미 입력돼 있으면 좌표 렌더 후 바로 계산
        const form = button.form;
        const to = form?.elements.namedItem('to');
        if (form && to instanceof HTMLInputElement && to.value.trim()) pendingSubmit.current = form;

        setCoords({ lat: pos.coords.latitude.toFixed(5), lng: pos.coords.longitude.toFixed(5) });
        setStatus({ kind: 'ready', accuracy: Math.round(pos.coords.accuracy) });
      },
      (err) => setStatus({ kind: 'error', message: GEO_ERRORS[err.code] ?? '위치를 가져오지 못했어요.' }),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  }

  return (
    <div className="grid gap-1.5">
      {coords && (
        <>
          <input type="hidden" name="lat" value={coords.lat} />
          <input type="hidden" name="lng" value={coords.lng} />
        </>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={(e) => locate(e.currentTarget)}
          disabled={status.kind === 'loading'}
          className="flex-1 rounded-xl border border-indigo-400/40 bg-indigo-500/10 py-2.5 text-sm font-medium text-indigo-100 hover:bg-indigo-500/20 disabled:opacity-60"
        >
          {status.kind === 'loading' ? '위치 확인 중…' : '📍 현재 위치에서 출발'}
        </button>
        {coords && (
          <button
            type="button"
            onClick={() => {
              setCoords(null);
              setStatus({ kind: 'idle' });
            }}
            className="rounded-xl border border-white/10 px-3 text-xs text-white/60 hover:bg-white/5"
          >
            해제
          </button>
        )}
      </div>
      {status.kind === 'ready' && (
        <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/5 px-3 py-2">
          {closest && closest.meters <= NEARBY_LIMIT_M ? (
            <p className="flex flex-wrap items-center gap-1.5 text-sm text-emerald-100">
              가장 가까운 역: <strong>{stationLabel(closest.item.name)}</strong>
              {closest.item.lines.map((line) => (
                <LineBadge key={line} line={line} size="sm" />
              ))}
              <span className="text-xs text-emerald-200/70">· 직선 약 {formatMeters(closest.meters)}</span>
            </p>
          ) : (
            <p className="text-sm text-amber-100">
              {closest
                ? `근처에 지하철역이 없어요 (가장 가까운 ${stationLabel(closest.item.name)} ${formatMeters(closest.meters)})`
                : '역 목록이 없어 가까운 역을 찾지 못했어요.'}
            </p>
          )}
          <p className="mt-0.5 text-xs text-emerald-300/70">
            현재 위치 사용 중{status.accuracy ? ` (오차 약 ${status.accuracy}m)` : ''} · 실제 탈 역과 걷는
            시간은 계산 결과에 나와요
          </p>
        </div>
      )}
      {status.kind === 'error' && <p className="text-xs text-rose-300">{status.message}</p>}
    </div>
  );
}
