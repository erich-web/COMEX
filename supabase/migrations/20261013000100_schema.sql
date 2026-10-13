-- RPE COMEX — Schema base
-- Fuso de referência da aplicação: America/Sao_Paulo

create extension if not exists "pgcrypto";

-- ============================================================
-- ENUMS
-- ============================================================
create type user_role as enum ('admin', 'executive', 'unit_lead', 'guest');
create type meeting_status as enum ('preparing', 'published', 'in_progress', 'closed', 'cancelled');
create type block_kind as enum ('opening', 'accountability', 'business_review', 'deliberation', 'knowledge', 'brainstorm', 'growth', 'closing', 'custom');
create type agenda_category as enum ('strategic_decision', 'accountability', 'business_review', 'brainstorm', 'knowledge', 'marketing_sales', 'innovation', 'other');
create type agenda_status as enum ('received', 'in_review', 'returned', 'approved', 'scheduled', 'discussed', 'postponed', 'archived');
create type urgency_level as enum ('low', 'medium', 'high', 'critical');
create type task_status as enum ('not_started', 'in_progress', 'waiting', 'blocked', 'done', 'cancelled');
create type task_priority as enum ('low', 'medium', 'high');
create type growth_status as enum ('idea', 'evaluating', 'approved', 'executing', 'done', 'scaled', 'discontinued');
create type minutes_status as enum ('draft', 'approved');
create type kpi_unit_type as enum ('currency', 'percent', 'number', 'score');
create type kpi_category as enum ('commercial', 'operational', 'experience', 'events');
create type period_type as enum ('week', 'month', 'year');

-- ============================================================
-- UTIL
-- ============================================================
create or replace function set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ============================================================
-- IDENTIDADE
-- ============================================================
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null default '',
  short_name text,
  role user_role not null default 'guest',
  is_active boolean not null default true,
  phone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated before update on profiles for each row execute function set_updated_at();

-- Convites: quem pode entrar e com qual papel (vinculado no primeiro login)
create table invited_users (
  email text primary key,
  full_name text not null,
  short_name text,
  role user_role not null default 'executive',
  created_at timestamptz not null default now()
);

create table business_units (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  pillar text not null default 'RPE Restaurantes',
  city text,
  is_active boolean not null default true,
  sort_order int not null default 100,
  created_at timestamptz not null default now()
);

create table business_unit_members (
  unit_id uuid not null references business_units(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  is_lead boolean not null default false,
  can_edit boolean not null default true,
  primary key (unit_id, profile_id)
);
create index on business_unit_members(profile_id);

-- Convites também podem pré-associar unidades (por slug)
create table invited_user_units (
  email text not null references invited_users(email) on delete cascade,
  unit_slug text not null,
  is_lead boolean not null default true,
  primary key (email, unit_slug)
);

-- ============================================================
-- ESTRATÉGIA
-- ============================================================
create table strategic_goals (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  sort_order int not null default 100,
  is_active boolean not null default true
);

create table annual_targets (
  year int primary key,
  revenue_target numeric(14,2),
  revenue_budget numeric(14,2),
  revenue_actual numeric(14,2),
  scenario_conservative numeric(14,2),
  scenario_base numeric(14,2),
  scenario_optimistic numeric(14,2),
  expansion_contribution numeric(14,2),
  note text,
  updated_at timestamptz not null default now()
);

create table unit_annual_revenue (
  unit_id uuid not null references business_units(id) on delete cascade,
  year int not null,
  revenue_actual numeric(14,2),
  revenue_budget numeric(14,2),
  updated_at timestamptz not null default now(),
  primary key (unit_id, year)
);

-- ============================================================
-- PROVOCAÇÕES
-- ============================================================
create table weekly_prompts (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  author text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ============================================================
-- REUNIÕES
-- ============================================================
create table meetings (
  id uuid primary key default gen_random_uuid(),
  series_date date not null unique,              -- data da ocorrência (terça)
  scheduled_at timestamptz not null,
  duration_minutes int not null default 180 check (duration_minutes between 15 and 600),
  status meeting_status not null default 'preparing',
  title text not null default 'COMEX',
  prompt_id uuid references weekly_prompts(id) on delete set null,
  review_unit_ids uuid[] not null default '{}',  -- unidades em business review profundo
  notes text,
  published_at timestamptz,
  started_at timestamptz,
  closed_at timestamptz,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on meetings(scheduled_at);
create trigger meetings_updated before update on meetings for each row execute function set_updated_at();

create table meeting_blocks (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references meetings(id) on delete cascade,
  kind block_kind not null default 'custom',
  title text not null,
  duration_minutes int not null check (duration_minutes between 1 and 240),
  sort_order int not null default 0,
  notes text
);
create index on meeting_blocks(meeting_id, sort_order);

create table meeting_participants (
  meeting_id uuid not null references meetings(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  attended boolean,
  primary key (meeting_id, profile_id)
);

-- ============================================================
-- PAUTAS
-- ============================================================
create table agenda_submissions (
  id uuid primary key default gen_random_uuid(),
  client_batch_id uuid not null unique,          -- idempotência do envio
  submitted_by uuid not null references profiles(id),
  reflection text,
  target_meeting_id uuid references meetings(id) on delete set null,
  item_count int not null default 0,
  is_late boolean not null default false,
  submitted_at timestamptz not null default now()
);
create index on agenda_submissions(submitted_by, submitted_at desc);

create table agenda_items (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid references agenda_submissions(id) on delete set null,
  submitted_by uuid not null references profiles(id),
  title text not null check (char_length(title) between 3 and 200),
  description text not null default '',
  unit_id uuid references business_units(id) on delete set null,
  expected_outcome text,
  category agenda_category not null default 'other',
  ai_suggested_category agenda_category,
  problem text,
  proposed_solution text,
  expected_impact text,
  urgency urgency_level not null default 'medium',
  suggested_minutes int check (suggested_minutes is null or suggested_minutes between 1 and 180),
  people_involved text,
  links jsonb not null default '[]'::jsonb,
  strategic_goal_id uuid references strategic_goals(id) on delete set null,
  requires_decision boolean not null default false,
  -- organização
  status agenda_status not null default 'received',
  meeting_id uuid references meetings(id) on delete set null,
  block_id uuid references meeting_blocks(id) on delete set null,
  allotted_minutes int check (allotted_minutes is null or allotted_minutes between 1 and 180),
  sort_order int not null default 0,
  presenter_id uuid references profiles(id) on delete set null,
  priority int not null default 0,
  admin_notes text,
  return_reason text,
  discussed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index on agenda_items(submitted_by, created_at desc);
create index on agenda_items(meeting_id, block_id, sort_order);
create index on agenda_items(status);
create trigger agenda_items_updated before update on agenda_items for each row execute function set_updated_at();

create table agenda_comments (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references agenda_items(id) on delete cascade,
  author_id uuid not null references profiles(id),
  body text not null,
  created_at timestamptz not null default now()
);
create index on agenda_comments(item_id, created_at);

create table agenda_attachments (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references agenda_items(id) on delete cascade,
  name text not null,
  storage_path text,
  url text,
  uploaded_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- ============================================================
-- ATAS E DECISÕES
-- ============================================================
create table meeting_minutes (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null unique references meetings(id) on delete cascade,
  title text,
  summary text,
  content text not null default '',
  source_notes text,
  drive_url text,
  status minutes_status not null default 'draft',
  approved_by uuid references profiles(id),
  approved_at timestamptz,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger minutes_updated before update on meeting_minutes for each row execute function set_updated_at();

create table meeting_decisions (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references meetings(id) on delete cascade,
  agenda_item_id uuid references agenda_items(id) on delete set null,
  title text not null,
  description text,
  owner_id uuid references profiles(id) on delete set null,
  unit_id uuid references business_units(id) on delete set null,
  strategic_goal_id uuid references strategic_goals(id) on delete set null,
  due_date date,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index on meeting_decisions(meeting_id);

-- ============================================================
-- TAREFAS
-- ============================================================
create table tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 300),
  description text,
  owner_id uuid references profiles(id) on delete set null,
  legacy_owner_text text,                        -- responsável em texto (importações)
  unit_id uuid references business_units(id) on delete set null,
  pillar text,
  meeting_id uuid references meetings(id) on delete set null,
  agenda_item_id uuid references agenda_items(id) on delete set null,
  decision_id uuid references meeting_decisions(id) on delete set null,
  checkin_id uuid,
  due_date date,
  priority task_priority not null default 'medium',
  status task_status not null default 'not_started',
  completed_at timestamptz,
  evidence_url text,
  evidence_note text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index on tasks(owner_id, status, due_date);
create index on tasks(meeting_id);
create index on tasks(unit_id);
create trigger tasks_updated before update on tasks for each row execute function set_updated_at();

create table task_assignees (
  task_id uuid not null references tasks(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  primary key (task_id, profile_id)
);

create table task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  author_id uuid not null references profiles(id),
  body text not null,
  created_at timestamptz not null default now()
);
create index on task_comments(task_id, created_at);

create table task_activity (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  actor_id uuid references profiles(id),
  action text not null,
  from_value text,
  to_value text,
  created_at timestamptz not null default now()
);
create index on task_activity(task_id, created_at);

-- completed_at automático
create or replace function tasks_before_write() returns trigger language plpgsql as $$
begin
  if new.status = 'done' and new.completed_at is null then new.completed_at = now(); end if;
  if new.status <> 'done' then new.completed_at = null; end if;
  return new;
end $$;
create trigger tasks_before before insert or update on tasks for each row execute function tasks_before_write();

-- histórico automático (após gravar)
create or replace function log_task_activity() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into task_activity(task_id, actor_id, action, to_value) values (new.id, auth.uid(), 'created', new.status::text);
  elsif new.status is distinct from old.status then
    insert into task_activity(task_id, actor_id, action, from_value, to_value) values (new.id, auth.uid(), 'status', old.status::text, new.status::text);
  elsif new.owner_id is distinct from old.owner_id then
    insert into task_activity(task_id, actor_id, action, from_value, to_value) values (new.id, auth.uid(), 'owner', old.owner_id::text, new.owner_id::text);
  elsif new.due_date is distinct from old.due_date then
    insert into task_activity(task_id, actor_id, action, from_value, to_value) values (new.id, auth.uid(), 'due_date', old.due_date::text, new.due_date::text);
  end if;
  return null;
end $$;
create trigger tasks_log after insert or update on tasks for each row execute function log_task_activity();

-- ============================================================
-- PERFORMANCE
-- ============================================================
create table kpi_definitions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  category kpi_category not null default 'commercial',
  unit_type kpi_unit_type not null default 'number',
  higher_is_better boolean not null default true,
  has_budget boolean not null default true,
  has_prior_year boolean not null default true,
  applies_to_all boolean not null default true,
  sort_order int not null default 100,
  is_active boolean not null default true
);

-- Indicadores específicos por unidade (além dos applies_to_all)
create table unit_kpis (
  unit_id uuid not null references business_units(id) on delete cascade,
  kpi_id uuid not null references kpi_definitions(id) on delete cascade,
  is_active boolean not null default true,
  primary key (unit_id, kpi_id)
);

create table kpi_entries (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references business_units(id) on delete cascade,
  kpi_id uuid not null references kpi_definitions(id) on delete cascade,
  period period_type not null default 'week',
  period_start date not null,
  value numeric(16,4),
  budget_value numeric(16,4),
  prior_year_value numeric(16,4),
  note text,
  updated_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (unit_id, kpi_id, period, period_start)
);
create index on kpi_entries(unit_id, period, period_start desc);
create trigger kpi_entries_updated before update on kpi_entries for each row execute function set_updated_at();

create table weekly_checkins (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references business_units(id) on delete cascade,
  week_start date not null,                      -- segunda-feira da semana
  author_id uuid not null references profiles(id),
  sales_summary text,
  problems jsonb not null default '[]'::jsonb,   -- até 3 {title, detail}
  solutions text,
  sales_initiatives text,
  growth_initiative text,                        -- "Qual iniciativa concreta..."
  needs_from_comex text,
  commitments text,
  is_late boolean not null default false,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (unit_id, week_start)
);
create trigger checkins_updated before update on weekly_checkins for each row execute function set_updated_at();
alter table tasks add constraint tasks_checkin_fk foreign key (checkin_id) references weekly_checkins(id) on delete set null;

-- ============================================================
-- GROWTH
-- ============================================================
create table growth_ideas (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  kind text,                                     -- campanha, promoção, CRM, cross-sell, evento, produto, parceria...
  unit_id uuid references business_units(id) on delete set null,
  author_id uuid not null references profiles(id),
  strategic_goal_id uuid references strategic_goals(id) on delete set null,
  status growth_status not null default 'idea',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger growth_ideas_updated before update on growth_ideas for each row execute function set_updated_at();

create table growth_experiments (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid references growth_ideas(id) on delete set null,
  title text not null,
  hypothesis text,
  objective text,
  unit_id uuid references business_units(id) on delete set null,
  owner_id uuid references profiles(id) on delete set null,
  investment numeric(14,2),
  deadline date,
  expected_revenue numeric(14,2),
  success_metrics text,
  actual_result text,
  actual_revenue numeric(14,2),
  next_decision text,
  status growth_status not null default 'approved',
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger growth_exp_updated before update on growth_experiments for each row execute function set_updated_at();

-- ============================================================
-- COMUNICAÇÃO E SISTEMA
-- ============================================================
create table weekly_reflections (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  prompt_id uuid references weekly_prompts(id) on delete set null,
  submission_id uuid references agenda_submissions(id) on delete set null,
  text text not null,
  converted_to text,                             -- 'agenda_item' | 'growth_idea'
  created_at timestamptz not null default now()
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  kind text not null,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index on notifications(profile_id, read_at, created_at desc);

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  table_name text not null,
  record_id text,
  action text not null,
  diff jsonb,
  created_at timestamptz not null default now()
);

create table app_settings (
  key text primary key,
  value jsonb not null,
  updated_by uuid references profiles(id),
  updated_at timestamptz not null default now()
);
