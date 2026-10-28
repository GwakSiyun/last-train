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

export function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = store.get(key) as Entry<T> | undefined;
  if (hit && hit.expiresAt > Date.now()) return hit.value;

  const value = load();
  store.set(key, { expiresAt: Date.now() + ttlMs, value });
  value.catch(() => store.delete(key));

  if (store.size > MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (oldest !== undefined) store.delete(oldest);
  }
  return value;
}

export const ONE_DAY_MS = 24 * 60 * 60 * 1000;
