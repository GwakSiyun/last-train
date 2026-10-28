/**
 * 노선·역 이름 정규화.
 * ODsay("수도권 2호선") ↔ 서울 열린데이터("02호선")를 같은 키로 맞춘다.
 */

/** "수도권 2호선" | "02호선" | "2호선(급행)" → "02호선" */
export function lineKey(name: string): string {
  const base = name.replace(/^수도권\s*/, '').replace(/\(.*?\)/g, '').trim();
  const numbered = base.match(/^0?(\d)호선$/);
  return numbered ? `0${numbered[1]}호선` : base;
}

/** "수도권 2호선" → "2호선" (화면 표시용) */
export function lineLabel(name: string): string {
  return name.replace(/^수도권\s*/, '').trim();
}

/** "강남" → "강남역", "서울역" → "서울역" (이미 '역'으로 끝나면 그대로) */
export function stationLabel(name: string): string {
  return name.endsWith('역') ? name : `${name}역`;
}

/**
 * 사용자 입력 → 역 찾기. 정확히 같은 이름을 먼저, 없으면 끝의 '역'·괄호·공백을 무시하고 비교.
 * ("홍제역" → 홍제, "서울역" → 서울역 / 목록엔 GTX "서울"도 따로 있어서 정확 일치를 우선)
 */
export function findByStationName<T extends { name: string }>(items: T[], query: string | undefined): T | undefined {
  const q = query?.trim();
  if (!q) return undefined;
  const exact = items.find((s) => s.name === q);
  if (exact) return exact;

  const loose = (name: string): string => stationKey(name).replace(/역$/, '');
  const target = loose(q);
  return target ? items.find((s) => loose(s.name) === target) : undefined;
}

/** "총신대입구(이수)" → "총신대입구" */
export function stationKey(name: string): string {
  return name.replace(/\(.*?\)/g, '').replace(/\s+/g, '').trim();
}
