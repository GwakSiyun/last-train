import 'server-only';

/**
 * 성공한 결과만 저장하는 메모리 캐시.
 * ODsay·서울 API는 오류도 HTTP 200으로 주기 때문에 fetch 캐시를 쓰면 오류가 하루 동안 남는다.
 * ⚠️ 서버 인스턴스 메모리라 재시작·서버리스 콜드스타트 시 비워진다.
 */
interface Entry<T> {
  expiresAt: number;
  value: Promise<T>;
}

const store = new Map<string, Entry<unknown>>();
const MAX_ENTRIES = 500;

/** keep이 false를 돌려주는 결과(예: 빈 응답)는 오류처럼 저장하지 않는다 */
export function cached<T>(
  key: string,
  ttlMs: number,
  load: () => Promise<T>,
  keep: (value: T) => boolean = () => true,
): Promise<T> {
  const hit = store.get(key) as Entry<T> | undefined;
  if (hit && hit.expiresAt > Date.now()) return hit.value;

  const value = load();
  const entry: Entry<T> = { expiresAt: Date.now() + ttlMs, value };
  store.set(key, entry);
  const drop = (): void => {
    if (store.get(key) === entry) store.delete(key);
  };
  value.then((v) => {
    if (!keep(v)) drop();
  }, drop);

  if (store.size > MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (oldest !== undefined) store.delete(oldest);
  }
  return value;
}

export const ONE_DAY_MS = 24 * 60 * 60 * 1000;
