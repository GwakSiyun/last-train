import { ImageResponse } from 'next/og';

import { SITE_NAME } from '@/lib/site';

/** 카톡·SNS 링크 미리보기 이미지 (빌드 시 1회 생성) */

export const alt = '막차 계산기 — 환승 포함 지하철 막차 출발 시각';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const HEADLINE = '몇 시까지 나가야 막차 탈 수 있지?';
const SUB = '환승역 막차까지 따져서 출발 시각을 알려드려요';
const CLOCK = '23:41';
const LINE_BADGES = [
  { label: '2', color: '#00A84D' },
  { label: '3', color: '#EF7C1C' },
  { label: '5', color: '#996CAC' },
];

/**
 * 한글 글리프가 기본 폰트에 없어서 Noto Sans KR을 필요한 글자만 받아온다.
 * 실패하면(네트워크 등) 한글 없이 영문만 그린다 — 빌드는 깨지지 않게.
 */
async function loadKoreanFont(text: string): Promise<ArrayBuffer | null> {
  try {
    const css = await fetch(
      `https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@800&text=${encodeURIComponent(text)}`,
    ).then((r) => r.text());
    const url = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/)?.[1];
    if (!url) return null;
    return await fetch(url).then((r) => r.arrayBuffer());
  } catch {
    return null;
  }
}

export default async function OpengraphImage(): Promise<ImageResponse> {
  const font = await loadKoreanFont(`${SITE_NAME}${HEADLINE}${SUB}${CLOCK}${LINE_BADGES.map((b) => b.label).join('')}`);

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px 80px',
          background: 'linear-gradient(135deg, #0b1020 0%, #1e1b4b 100%)',
          color: '#e7ebf5',
          fontFamily: font ? 'NotoSansKR' : 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ fontSize: 28, letterSpacing: 6, color: '#a5b4fc' }}>LAST TRAIN</div>
          {font && <div style={{ fontSize: 40, fontWeight: 800 }}>{SITE_NAME}</div>}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {font && <div style={{ fontSize: 64, fontWeight: 800, lineHeight: 1.2 }}>{HEADLINE}</div>}
          {font && <div style={{ fontSize: 32, color: '#c7d2fe' }}>{SUB}</div>}
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 12 }}>
            {LINE_BADGES.map((b) => (
              <div
                key={b.label}
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  background: b.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 30,
                  fontWeight: 800,
                  color: 'white',
                }}
              >
                {b.label}
              </div>
            ))}
          </div>
          <div style={{ fontSize: 120, fontWeight: 800, letterSpacing: -4 }}>{CLOCK}</div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: font ? [{ name: 'NotoSansKR', data: font, weight: 800, style: 'normal' }] : [],
    },
  );
}
