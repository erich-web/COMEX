-- ============================================================
-- COMEX v2 (out/2026): e-mails, importação de atas, diagnóstico de IA
-- ============================================================

-- Ata: arquivo original (PDF/Word enviado pelo Wesley) + marca de estruturação por IA
alter table meeting_minutes add column if not exists file_path text;
alter table meeting_minutes add column if not exists file_name text;
alter table meeting_minutes add column if not exists structured_at timestamptz;

-- Preferência de e-mail por pessoa (lembretes e resumo da véspera)
alter table profiles add column if not exists notify_email boolean not null default true;

-- ------------------------------------------------------------
-- Log de e-mails enviados (idempotência do lembrete/resumo + auditoria)
-- ------------------------------------------------------------
create table if not exists email_log (
  id uuid primary key default gen_random_uuid(),
  kind text not null,                              -- task_reminder | pre_comex_digest | test | …
  profile_id uuid references profiles(id) on delete set null,
  to_email text not null,
  subject text not null,
  status text not null default 'sent' check (status in ('sent','failed','skipped')),
  error text,
  meta jsonb not null default '{}'::jsonb,          -- {meeting_id, task_count, provider_id…}
  sent_at timestamptz not null default now()
);
create index if not exists email_log_kind_profile_idx on email_log(kind, profile_id, sent_at desc);
create index if not exists email_log_sent_idx on email_log(sent_at desc);
alter table email_log enable row level security;
create policy "email_log: admin" on email_log for all to authenticated using (is_admin()) with check (is_admin());

-- ------------------------------------------------------------
-- Log das chamadas de IA (diagnóstico em /admin/ia)
-- ------------------------------------------------------------
create table if not exists ai_runs (
  id uuid primary key default gen_random_uuid(),
  kind text not null,                              -- analysis | question | agenda_plan | minutes_structure | agenda_draft | agenda_assist | test
  model text,
  ok boolean not null default true,
  error text,
  input_tokens int,
  output_tokens int,
  duration_ms int,
  actor_id uuid references profiles(id) on delete set null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists ai_runs_created_idx on ai_runs(created_at desc);
alter table ai_runs enable row level security;
create policy "ai_runs: admin" on ai_runs for select to authenticated using (is_admin());
create policy "ai_runs: membro grava" on ai_runs for insert to authenticated with check (is_member());

-- ------------------------------------------------------------
-- Log das rotinas automáticas (cron diário)
-- ------------------------------------------------------------
create table if not exists job_runs (
  id uuid primary key default gen_random_uuid(),
  kind text not null,                              -- daily | manual_digest | manual_reminders
  ok boolean not null default true,
  report jsonb not null default '{}'::jsonb,
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists job_runs_started_idx on job_runs(started_at desc);
alter table job_runs enable row level security;
create policy "job_runs: admin" on job_runs for all to authenticated using (is_admin()) with check (is_admin());

-- ------------------------------------------------------------
-- Configuração padrão das notificações (editável em Configurações)
-- ------------------------------------------------------------
insert into app_settings(key, value)
values ('notifications', '{"task_reminder_every_days": 3, "digest_day_before": true, "send_hour": 8}'::jsonb)
on conflict (key) do nothing;
