-- 하나비 동기화 스키마
-- Supabase 대시보드 → SQL Editor 에 전체 붙여넣고 Run 하세요. (여러 번 실행해도 안전)

-- 1) SRS 학습 진도 (카드별)
create table if not exists public.srs_progress (
  user_id uuid not null references auth.users on delete cascade,
  card_id text not null,
  deck_id text not null,
  state text not null,
  ef double precision,
  interval_days double precision,
  step_index int,
  reps int,
  lapses int,
  due_at bigint,
  last_reviewed_at bigint,
  stability double precision,
  difficulty double precision,
  scheduled_days double precision,
  learning_steps int,
  fsrs_state int,
  updated_at bigint not null,
  primary key (user_id, card_id)
);

-- 2) 일별 학습 통계
create table if not exists public.daily_stats (
  user_id uuid not null references auth.users on delete cascade,
  date text not null,
  reviews int not null default 0,
  new_cards int not null default 0,
  quiz_total int not null default 0,
  quiz_correct int not null default 0,
  micro_sessions int not null default 0,
  study_seconds int not null default 0,
  updated_at bigint not null,
  primary key (user_id, date)
);

-- 3) 개인 설정 (목표 레벨, 학습량, TTS 등)
create table if not exists public.user_settings (
  user_id uuid not null references auth.users on delete cascade,
  key text not null,
  value jsonb,
  updated_at bigint not null,
  primary key (user_id, key)
);

-- 4) 신고한 카드 (뜻 오류 표시)
create table if not exists public.flagged_cards (
  user_id uuid not null references auth.users on delete cascade,
  card_id text not null,
  updated_at bigint not null,
  primary key (user_id, card_id)
);

-- ── 행 수준 보안: 로그인한 본인 데이터만 접근 ──
alter table public.srs_progress  enable row level security;
alter table public.daily_stats   enable row level security;
alter table public.user_settings enable row level security;
alter table public.flagged_cards enable row level security;

drop policy if exists "own srs"      on public.srs_progress;
drop policy if exists "own stats"    on public.daily_stats;
drop policy if exists "own settings" on public.user_settings;
drop policy if exists "own flagged"  on public.flagged_cards;

create policy "own srs" on public.srs_progress
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own stats" on public.daily_stats
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own settings" on public.user_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own flagged" on public.flagged_cards
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 증분 동기화용 인덱스
create index if not exists srs_progress_sync_idx on public.srs_progress (user_id, updated_at);
create index if not exists daily_stats_sync_idx  on public.daily_stats  (user_id, updated_at);
