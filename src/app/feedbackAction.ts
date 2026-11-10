'use server';

import { MAX_CONTACT, MAX_MESSAGE, SOURCES, hasFeedbackDb, saveFeedback, type FeedbackSource } from '@/lib/feedback';

/**
 * 의견 보내기. 입력은 브라우저에서 오므로(조작 가능) 길이 · 형태를 다시 검사한다.
 * 스팸 방지: 사람 눈에 안 보이는 칸(website)이 채워졌으면 봇으로 보고 저장하지 않는다.
 * 이때도 성공처럼 답해 봇이 눈치채지 못하게 한다.
 */

export type FeedbackState = { status: 'idle' } | { status: 'sent' } | { status: 'error'; message: string };

const field = (formData: FormData, name: string): string => {
  const v = formData.get(name);
  return typeof v === 'string' ? v.trim() : '';
};

function toSource(value: string): FeedbackSource {
  return SOURCES.find((s) => s === value) ?? 'other';
}

export async function sendFeedbackAction(_prev: FeedbackState, formData: FormData): Promise<FeedbackState> {
  const message = field(formData, 'message');
  const contact = field(formData, 'contact');
  if (!message) return { status: 'error', message: '의견을 적어주세요.' };
  if (message.length > MAX_MESSAGE) return { status: 'error', message: `의견은 ${MAX_MESSAGE}자까지 보낼 수 있어요.` };
  if (contact.length > MAX_CONTACT) return { status: 'error', message: `연락처는 ${MAX_CONTACT}자까지예요.` };

  if (field(formData, 'website')) return { status: 'sent' };

  if (!hasFeedbackDb()) return { status: 'error', message: '지금은 의견을 받을 수 없어요. 잠시 후 다시 시도해주세요.' };
  try {
    await saveFeedback({ message, contact: contact || null, source: toSource(field(formData, 'source')) });
  } catch {
    return { status: 'error', message: '보내지 못했어요. 잠시 후 다시 시도해주세요.' };
  }
  return { status: 'sent' };
}
