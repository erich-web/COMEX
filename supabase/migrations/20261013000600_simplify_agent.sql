-- ============================================================
-- COMEX simplificado: pergunta-chave nas pautas + Agente COMEX
-- ============================================================

-- Pergunta-chave: o que o COMEX precisa responder sobre a pauta.
alter table agenda_items add column if not exists key_question text;

-- submit_agenda_batch passa a gravar key_question (demais campos permanecem opcionais).
create or replace function submit_agenda_batch(p_batch_id uuid, p_items jsonb, p_reflection text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  sub agenda_submissions%rowtype;
  it jsonb; n int := 0; mid uuid; deadline timestamptz; late boolean := false;
  dl jsonb; ids uuid[] := '{}'; new_id uuid; prompt uuid;
begin
  if uid is null or not is_member() then raise exception 'not allowed'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'empty batch'; end if;

  select * into sub from agenda_submissions where client_batch_id = p_batch_id;
  if sub.id is not null then
    return jsonb_build_object('submission_id', sub.id, 'count', sub.item_count, 'duplicate', true);
  end if;

  perform ensure_upcoming_meetings(4);
  select id, prompt_id into mid, prompt from meetings
    where status in ('preparing','published') and scheduled_at > now()
    order by scheduled_at limit 1;

  select value into dl from app_settings where key = 'agenda_deadline';
  if mid is not null and dl is not null then
    select ((m.series_date - ((extract(dow from m.series_date)::int - coalesce((dl->>'weekday')::int,5) + 7) % 7))::text || ' ' || coalesce(dl->>'time','17:00'))::timestamp at time zone 'America/Sao_Paulo'
      into deadline from meetings m where m.id = mid;
    late := now() > deadline;
  end if;

  insert into agenda_submissions(client_batch_id, submitted_by, reflection, target_meeting_id, is_late)
  values (p_batch_id, uid, nullif(trim(p_reflection),''), mid, late) returning * into sub;

  for it in select * from jsonb_array_elements(p_items) loop
    insert into agenda_items(
      submission_id, submitted_by, title, description, key_question, unit_id, expected_outcome, category,
      problem, proposed_solution, expected_impact, urgency, suggested_minutes, people_involved, links,
      strategic_goal_id, requires_decision, status
    ) values (
      sub.id, uid,
      trim(it->>'title'),
      coalesce(it->>'description',''),
      nullif(trim(coalesce(it->>'key_question','')),''),
      nullif(it->>'unit_id','')::uuid,
      nullif(it->>'expected_outcome',''),
      coalesce(nullif(it->>'category','')::agenda_category, 'other'),
      nullif(it->>'problem',''), nullif(it->>'proposed_solution',''), nullif(it->>'expected_impact',''),
      coalesce(nullif(it->>'urgency','')::urgency_level, 'medium'),
      nullif(it->>'suggested_minutes','')::int,
      nullif(it->>'people_involved',''),
      coalesce(it->'links','[]'::jsonb),
      nullif(it->>'strategic_goal_id','')::uuid,
      coalesce((it->>'requires_decision')::boolean, false),
      'received'
    ) returning id into new_id;
    ids := ids || new_id; n := n + 1;
  end loop;

  update agenda_submissions set item_count = n where id = sub.id;

  if nullif(trim(p_reflection),'') is not null then
    insert into weekly_reflections(profile_id, prompt_id, submission_id, text) values (uid, prompt, sub.id, trim(p_reflection));
  end if;

  insert into notifications(profile_id, kind, title, body, link)
  select p.id, 'agenda_received', n || ' pauta(s) recebida(s)',
         (select coalesce(short_name, full_name) from profiles where id = uid) || ' enviou ' || n || ' pauta(s) para o próximo COMEX.',
         '/admin'
  from profiles p where p.role = 'admin' and p.is_active and p.id <> uid;

  return jsonb_build_object('submission_id', sub.id, 'count', n, 'item_ids', to_jsonb(ids), 'is_late', late, 'duplicate', false);
end $$;

revoke execute on function submit_agenda_batch(uuid, jsonb, text) from public, anon;
grant execute on function submit_agenda_batch(uuid, jsonb, text) to authenticated;

-- ------------------------------------------------------------
-- Agente COMEX: análises geradas a partir de atas e pautas
-- ------------------------------------------------------------
create table if not exists agent_insights (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('recurring_problem','growth_idea','critical_question','suggestion','pending_decision')),
  title text not null,
  body text not null default '',
  suggestion text,
  unit_id uuid references business_units(id) on delete set null,
  evidence jsonb not null default '[]'::jsonb,          -- [{meeting_id, date, title}] / [{agenda_item_id, title}]
  status text not null default 'open' check (status in ('open','turned_into_agenda','dismissed')),
  agenda_item_id uuid references agenda_items(id) on delete set null,
  score int not null default 0,
  run_id uuid not null,
  generated_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists agent_insights_status_idx on agent_insights(status, created_at desc);
create index if not exists agent_insights_run_idx on agent_insights(run_id);

alter table agent_insights enable row level security;

create policy agent_insights_read on agent_insights for select to authenticated using (is_member());
create policy agent_insights_admin_write on agent_insights for all to authenticated using (is_admin()) with check (is_admin());
create policy agent_insights_member_status on agent_insights for update to authenticated using (is_member()) with check (is_member());

-- Log de perguntas ao agente (auditoria leve; sem resposta armazenada por padrão)
create table if not exists agent_questions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  question text not null,
  answer text,
  created_at timestamptz not null default now()
);
alter table agent_questions enable row level security;
create policy agent_questions_own on agent_questions for all to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());
