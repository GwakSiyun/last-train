import 'server-only';

import { cached, ONE_DAY_MS } from './cache';
import type { PlaceOption } from './types';

/**
 * 카카오 로컬 키워드 검색 — 도착지를 건물·주소로 고를 때.
 * REST 키는 서버에만 둔다 (NEXT_PUBLIC 아님). 응답 형태는 2026-11-03 실호출로 확인:
 * { documents: [{ place_name, road_address_name, address_name, x(경도), y(위도), ... }], meta }
 */
const ENDPOINT = 'https://dapi.kakao.com/v2/local/search/keyword.json';
const MAX_RESULTS = 5;

/** 수도권 대략 범위 — 이 밖의 장소는 지하철 막차 계산 대상이 아니라 뺀다 */
const AREA = { minLat: 36.7, maxLat: 38.3, minLng: 126.3, maxLng: 127.9 };

interface KakaoDocument {
  place_name: string;
  road_address_name: string;
  address_name: string;
  x: string;
  y: string;
}

interface KakaoResponse {
  documents?: KakaoDocument[];
}

export function hasKakaoKey(): boolean {
  return Boolean(process.env.KAKAO_REST_API_KEY);
}

function toPlace(doc: KakaoDocument): PlaceOption | null {
  const lat = Number(doc.y);
  const lng = Number(doc.x);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < AREA.minLat || lat > AREA.maxLat || lng < AREA.minLng || lng > AREA.maxLng) return null;
  return { name: doc.place_name, address: doc.road_address_name || doc.address_name, lat, lng };
}

export async function searchPlaces(query: string): Promise<PlaceOption[]> {
  const key = process.env.KAKAO_REST_API_KEY;
  if (!key) throw new Error('KAKAO_REST_API_KEY가 설정되지 않았어요.');

  return cached(`kakao:${query}`, ONE_DAY_MS, async () => {
    const params = new URLSearchParams({ query, size: '15' });
    const res = await fetch(`${ENDPOINT}?${params}`, {
      headers: { Authorization: `KakaoAK ${key}` },
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`장소 검색에 실패했어요. (카카오 HTTP ${res.status})`);
    const body = (await res.json()) as KakaoResponse;
    return (body.documents ?? [])
      .map(toPlace)
      .filter((p): p is PlaceOption => p !== null)
      .slice(0, MAX_RESULTS);
  });
}
