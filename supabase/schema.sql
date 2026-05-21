-- Core tables for Digital Twin (Supabase/Postgres)

create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text,
  role text,
  primary_goal text,
  personality_tone text,
  work_start_hour int,
  work_end_hour int,
  morning_check_in_hour int,
  evening_check_in_hour int,
  onboarding_complete boolean,
  created_at timestamptz default now(),
  timezone text
);

create table if not exists daily_entries (
  id text primary key,
  user_id uuid not null,
  date text not null,
  tasks_planned jsonb,
  tasks_completed jsonb,
  energy_level int,
  mood text,
  notes text,
  created_at timestamptz
);

create table if not exists habits (
  id text primary key,
  user_id uuid not null,
  name text,
  icon text,
  color text,
  frequency text,
  target_days int,
  created_at timestamptz,
  is_active boolean
);

create table if not exists journal_entries (
  id text primary key,
  user_id uuid not null,
  date text,
  title text,
  content text,
  mood text,
  energy_level int,
  tags jsonb,
  ai_reflection text,
  created_at timestamptz,
  updated_at timestamptz,
  word_count int
);

create table if not exists messages (
  id text primary key,
  user_id uuid not null,
  role text,
  content text,
  timestamp timestamptz,
  is_voice boolean,
  is_proactive boolean
);

create table if not exists feature_vectors (
  id text primary key,
  user_id uuid not null,
  date text,
  window_days int,
  total_entries int,
  total_tasks_planned int,
  total_tasks_completed int,
  completion_rate numeric,
  avg_energy numeric,
  mood_counts jsonb,
  habit_completion_rate numeric,
  journal_count int,
  message_count int,
  created_at timestamptz
);

create table if not exists behavior_models (
  id text primary key,
  user_id uuid not null,
  updated_at timestamptz,
  baseline_completion_rate numeric,
  baseline_energy numeric,
  energy_completion_slope numeric,
  weekday_completion jsonb,
  task_load_threshold numeric,
  habit_adherence numeric,
  consistency_score int
);

create table if not exists temporal_insights (
  id text primary key,
  user_id uuid not null,
  trend text,
  energy_trend numeric,
  completion_trend numeric,
  seasonality jsonb,
  peak_day text
);

create table if not exists forecasts (
  id text primary key,
  user_id uuid not null,
  date text,
  expected_energy numeric,
  expected_completion_rate numeric,
  risk_level text
);

create table if not exists xai_explanations (
  id text primary key,
  user_id uuid not null,
  explanation text,
  factors jsonb,
  confidence numeric
);

-- Enable RLS
alter table profiles enable row level security;
alter table daily_entries enable row level security;
alter table habits enable row level security;
alter table journal_entries enable row level security;
alter table messages enable row level security;
alter table feature_vectors enable row level security;
alter table behavior_models enable row level security;
alter table temporal_insights enable row level security;
alter table forecasts enable row level security;
alter table xai_explanations enable row level security;

-- Simple RLS policies (user can access their own rows)
create policy "profiles_is_owner" on profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "daily_entries_is_owner" on daily_entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "habits_is_owner" on habits
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "journal_entries_is_owner" on journal_entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "messages_is_owner" on messages
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "feature_vectors_is_owner" on feature_vectors
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "behavior_models_is_owner" on behavior_models
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "temporal_insights_is_owner" on temporal_insights
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "forecasts_is_owner" on forecasts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "xai_explanations_is_owner" on xai_explanations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
