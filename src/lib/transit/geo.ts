/** 클라이언트에서도 쓰는 거리 계산 — 외부 API 호출 없음 */

export interface Coord {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_M = 6_371_000;
const rad = (deg: number): number => (deg * Math.PI) / 180;

/** 두 좌표 사이 직선거리(m) */
export function distanceMeters(a: Coord, b: Coord): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

export function nearest<T extends Coord>(from: Coord, items: T[]): { item: T; meters: number } | null {
  let best: { item: T; meters: number } | null = null;
  for (const item of items) {
    const meters = distanceMeters(from, item);
    if (!best || meters < best.meters) best = { item, meters };
  }
  return best;
}
