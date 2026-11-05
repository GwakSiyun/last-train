'use client';

import { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';

import { sendFeedbackAction, type FeedbackState } from '@/app/feedbackAction';

const SOURCE_KEY = 'feedback-source';
const MAX_MESSAGE = 1000;
const MAX_CONTACT = 100;

/** 처음 들어온 경로: 영상 링크의 ?from=youtube 가 먼저, 없으면 어디서 왔는지(referrer) */
function detectSource(): string {
  const from = new URLSearchParams(window.location.search).get('from');
  if (from) return from;
  let host = '';
  try {
    host = document.referrer ? new URL(document.referrer).hostname : '';
  } catch {
    return 'other';
  }
  if (!host || host === window.location.hostname) return 'direct';
  if (host.includes('naver')) return 'naver';
  if (host.includes('google')) return 'google';
  if (host.includes('youtube') || host === 'youtu.be') return 'youtube';
  if (host.includes('instagram')) return 'instagram';
  return 'other';
}

function savedSource(): string {
  try {
    return sessionStorage.getItem(SOURCE_KEY) ?? detectSource();
  } catch {
    return detectSource();
  }
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-xl bg-indigo-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
    >
      {pending ? '보내는 중…' : '보내기'}
    </button>
  );
}

function FeedbackForm({ onClose }: { onClose: () => void }) {
  const [state, action] = useActionState<FeedbackState, FormData>(sendFeedbackAction, { status: 'idle' });
  const [openedAt] = useState(() => Date.now());

  if (state.status === 'sent') {
    return (
      <div className="grid gap-4 text-center">
        <p className="text-sm text-white/80">
          고마워요! 보내주신 의견은 꼼꼼히 읽고
          <br />
          다음 업데이트에 반영할게요 🙌
        </p>
        <button type="button" onClick={onClose} className="rounded-xl border border-white/15 px-4 py-2 text-sm">
          닫기
        </button>
      </div>
    );
  }

  return (
    <form action={action} className="grid gap-3">
      <label className="grid gap-1.5 text-sm">
        <span className="text-white/70">불편했던 점 · 바라는 기능</span>
        <textarea
          name="message"
          required
          maxLength={MAX_MESSAGE}
          rows={5}
          placeholder="예) 환승 시간을 더 여유 있게 잡고 싶어요"
          className="resize-none rounded-xl border border-white/10 bg-white/[0.04] p-3 text-base outline-none focus:border-indigo-400 sm:text-sm"
        />
      </label>
      <label className="grid gap-1.5 text-sm">
        <span className="text-white/70">
          연락처 <span className="text-white/40">(선택 · 답장이 필요하면)</span>
        </span>
        <input
          name="contact"
          maxLength={MAX_CONTACT}
          placeholder="이메일 또는 인스타 아이디"
          className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-base outline-none focus:border-indigo-400 sm:text-sm"
        />
      </label>
      {/* 봇 걸러내기용 — 사람에겐 안 보인다 */}
      <input name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
      <input type="hidden" name="openedAt" value={openedAt} />
      <input type="hidden" name="source" value={savedSource()} />

      {state.status === 'error' && <p className="text-xs text-rose-300">{state.message}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-sm text-white/60">
          취소
        </button>
        <SubmitButton />
      </div>
    </form>
  );
}

/** 헤더의 "의견 보내기" — 누르면 입력창이 뜨고, 서버 액션으로 저장한다 */
export default function FeedbackButton() {
  const [open, setOpen] = useState(false);

  // 처음 들어온 경로를 기억 (검색하며 주소가 바뀌어도 유지)
  useEffect(() => {
    try {
      if (!sessionStorage.getItem(SOURCE_KEY)) sessionStorage.setItem(SOURCE_KEY, detectSource());
    } catch {
      // 저장소를 못 쓰는 브라우저면 보낼 때 다시 판단
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="shrink-0 rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/70 hover:border-indigo-400/50 hover:text-white"
      >
        💬 의견 보내기
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 grid place-items-end bg-black/60 p-4 sm:place-items-center"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="feedback-title"
            className="grid w-full max-w-md gap-4 rounded-2xl border border-white/10 bg-[#0f1528] p-5"
          >
            <div className="grid gap-1">
              <h2 id="feedback-title" className="text-base font-semibold">
                막차 계산기에 의견 보내기
              </h2>
              <p className="text-xs text-white/50">써보면서 불편했던 점이나 있었으면 하는 기능을 알려주세요.</p>
            </div>
            <FeedbackForm onClose={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
