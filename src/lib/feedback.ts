import 'server-only';

import { neon } from '@neondatabase/serverless';

/**
 * 의견 저장 (Neon Postgres, 만듦 사이트 공용 DB). 접속 정보는 Vercel 이 연결해 준 DATABASE_URL — 서버 전용.
 * 테이블은 db/feedback.sql.
 */

export const SITE_ID = 'last-train';
export const MAX_MESSAGE = 1000;
export const MAX_CONTACT = 100;
export const SOURCES = ['youtube', 'instagram', 'naver', 'google', 'direct', 'other'] as const;
export type FeedbackSource = (typeof SOURCES)[number];

export interface FeedbackInput {
  message: string;
  contact: string | null;
  source: FeedbackSource;
}

export function hasFeedbackDb(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export async function saveFeedback(input: FeedbackInput): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL 이 설정되지 않았어요.');
  const sql = neon(url);
  await sql`insert into feedback (site, message, contact, source)
            values (${SITE_ID}, ${input.message}, ${input.contact}, ${input.source})`;
}
