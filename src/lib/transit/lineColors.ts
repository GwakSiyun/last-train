/**
 * 노선 표시 이름·색.
 * 역 마스터(ROUTE)는 운영 구간명("경부선", "과천선", "9호선(연장)")으로,
 * ODsay는 "2호선"·"신분당선"처럼 와서 사용자에게 익숙한 노선명으로 합친다.
 */

export interface LineStyle {
  /** 표시 이름 (예: "1호선", "신분당선") */
  label: string;
  /** 배지에 들어갈 짧은 글자 (예: "1", "신분당") */
  short: string;
  color: string;
}

const COLORS: Record<string, string> = {
  '1호선': '#0052A4',
  '2호선': '#00A84D',
  '3호선': '#EF7C1C',
  '4호선': '#00A5DE',
  '5호선': '#996CAC',
  '6호선': '#CD7C2F',
  '7호선': '#747F00',
  '8호선': '#E6186C',
  '9호선': '#BDB092',
  신분당선: '#D4003B',
  수인분당선: '#F5A200',
  경의중앙선: '#77C4A3',
  공항철도: '#0090D2',
  경춘선: '#0C8E72',
  경강선: '#003DA5',
  서해선: '#8FC31F',
  우이신설선: '#B0CE18',
  신림선: '#6789CA',
  'GTX-A': '#9A6292',
  인천1호선: '#7CA8D5',
  인천2호선: '#ED8B00',
  김포골드라인: '#A17800',
  의정부경전철: '#FDA600',
  용인에버라인: '#509F22',
};

/** 운영 구간명·표기 차이 → 표시 노선명 */
const ALIASES: Record<string, string> = {
  경부선: '1호선',
  경인선: '1호선',
  경원선: '1호선',
  장항선: '1호선',
  일산선: '3호선',
  과천선: '4호선',
  안산선: '4호선',
  진접선: '4호선',
  별내선: '8호선',
  분당선: '수인분당선',
  수인선: '수인분당선',
  중앙선: '경의중앙선',
  경의선: '경의중앙선',
  공항철도1호선: '공항철도',
  '수도권 광역급행철도': 'GTX-A',
  우이신설경전철: '우이신설선',
  인천선: '인천1호선',
  의정부선: '의정부경전철',
  에버라인선: '용인에버라인',
  용인경전철: '용인에버라인',
  김포도시철도: '김포골드라인',
};

/** 규칙으로 줄이면 어색한 배지 글자 */
const SHORT: Record<string, string> = {
  공항철도: '공항',
  인천1호선: '인천1',
  인천2호선: '인천2',
  용인에버라인: '에버라인',
  의정부경전철: '의정부',
};

const FALLBACK_COLOR = '#6B7280';

/** "수도권 2호선" | "02호선" | "9호선(연장)" | "경부선" → "2호선" / "9호선" / "1호선" */
export function canonicalLine(name: string): string {
  const raw = name.trim();
  if (ALIASES[raw]) return ALIASES[raw]; // "수도권 광역급행철도"는 접두어를 떼기 전에 매칭
  const base = raw.replace(/^수도권\s*/, '').replace(/\(.*?\)/g, '').trim();
  const numbered = base.match(/^0?(\d)호선$/);
  if (numbered) return `${numbered[1]}호선`;
  return ALIASES[base] ?? base;
}

export function lineStyle(name: string): LineStyle {
  const label = canonicalLine(name);
  const numbered = label.match(/^(\d)호선$/);
  return {
    label,
    short: numbered ? numbered[1] : (SHORT[label] ?? label.replace(/(선|라인)$/, '')),
    color: COLORS[label] ?? FALLBACK_COLOR,
  };
}

/** 중복 제거 + 숫자 노선 먼저 */
export function uniqueLines(names: string[]): string[] {
  const labels = [...new Set(names.map(canonicalLine))];
  return labels.sort((a, b) => {
    const na = a.match(/^(\d)호선$/)?.[1];
    const nb = b.match(/^(\d)호선$/)?.[1];
    if (na && nb) return Number(na) - Number(nb);
    if (na || nb) return na ? -1 : 1;
    return a.localeCompare(b, 'ko');
  });
}
