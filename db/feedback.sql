-- 만듦 사이트 공용 의견 테이블 (Neon: make-it-for-u-feedback)
-- Neon 콘솔 SQL Editor 에서 한 번 실행한다. 여러 번 실행해도 안전하다.
create table if not exists feedback (
  id          bigint generated always as identity primary key,
  site        text        not null,                                         -- 어느 사이트 의견인지 (last-train …)
  message     text        not null check (char_length(message) between 1 and 1000),
  contact     text        check (char_length(contact) <= 100),             -- 답장 받을 연락처 (선택)
  source      text        not null default 'direct',                        -- 들어온 경로: youtube · instagram · naver · google · direct · other
  created_at  timestamptz not null default now()
);

create index if not exists feedback_site_created_idx on feedback (site, created_at desc);

-- 사이트별 · 경로별 의견 수 (기획서 피드백 기록용)
-- select site, source, count(*) from feedback group by site, source order by site, count(*) desc;
