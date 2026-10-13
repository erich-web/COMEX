-- RPE COMEX — Funções, triggers de auth e RLS

-- ============================================================
-- HELPERS DE AUTORIZAÇÃO
-- ============================================================
create or replace function current_role_of(uid uuid) returns user_role
language sql stable security definer set search_path = public as $$
  select role from profiles where id = uid and is_active
$$;

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'admin' from profiles where id = auth.uid() and is_active), false)
$$;

create or replace function is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role in ('admin','executive','unit_lead') from profiles where id = auth.uid() and is_active), false)
$$;

create or replace function can_edit_unit(p_unit uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_admin() or exists (
    select 1 from business_unit_members m where m.unit_id = p_unit and m.profile_id = auth.uid() and m.can_edit
  )
$$;

-- ============================================================
-- NOVO USUÁRIO → PROFILE (vincula convite)
-- ============================================================
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare inv invited_users%rowtype; u record;
begin
  select * into inv from invited_users where lower(email) = lower(new.email);
  insert into profiles (id, email, full_name, short_name, role, is_active)
  values (
    new.id, lower(new.email),
    coalesce(inv.full_name, new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
    coalesce(inv.short_name, inv.full_name, split_part(new.email,'@',1)),
    coalesce(inv.role, 'guest'),
    inv.email is not null
  ) on conflict (id) do nothing;
  if inv.email is not null then
    for u in select iu.unit_slug, iu.is_lead from invited_user_units iu where iu.email = inv.email loop
      insert into business_unit_members(unit_id, profile_id, is_lead, can_edit)
      select b.id, new.id, u.is_lead, true from business_units b where b.slug = u.unit_slug
      on conflict do nothing;
    end loop;
  end if;
  return new;
end $$;


create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();

-- Admin pode "aplicar" um convite a um perfil já existente (usuário entrou antes do convite)
create or replace function apply_invite(p_email text) returns void
language plpgsql security definer set search_path = public as $$
declare inv invited_users%rowtype; pid uuid; u record;
begin
  if not is_admin() then raise exception 'not allowed'; end if;
  select * into inv from invited_users where lower(email) = lower(p_email);
  if inv.email is null then return; end if;
  select id into pid from profiles where lower(email) = lower(p_email);
  if pid is null then return; end if;
  update profiles set role = inv.role, is_active = true,
    full_name = case when full_name = '' then inv.full_name else full_name end,
    short_name = coalesce(short_name, inv.short_name)
  where id = pid;
  for u in select iu.unit_slug, iu.is_lead from invited_user_units iu where iu.email = inv.email loop
    insert into business_unit_members(unit_id, profile_id, is_lead, can_edit)
    select b.id, pid, u.is_lead, true from business_units b where b.slug = u.unit_slug
    on conflict do nothing;
  end loop;
end $$;

-- ============================================================
-- CALENDÁRIO: garante reuniões futuras (terças 9h, America/Sao_Paulo)
-- ============================================================
create or replace function ensure_upcoming_meetings(p_weeks int default 8) returns int
language plpgsql security definer set search_path = public as $$
declare
  s jsonb; wd int; t text; dur int; blocks jsonb; b jsonb;
  d date; first date; created int := 0; mid uuid; i int := 0;
begin
  if auth.uid() is null then return 0; end if;
  select value into s from app_settings where key = 'calendar';
  wd := coalesce((s->>'weekday')::int, 2);            -- 0=dom … 2=ter
  t := coalesce(s->>'time', '09:00');
  dur := coalesce((s->>'duration_minutes')::int, 180);
  select value into blocks from app_settings where key = 'default_blocks';

  first := (now() at time zone 'America/Sao_Paulo')::date;
  -- próxima ocorrência do weekday (inclui hoje)
  first := first + ((wd - extract(dow from first)::int + 7) % 7);
  for i in 0..p_weeks-1 loop
    d := first + (i*7);
    if not exists (select 1 from meetings where series_date = d) then
      insert into meetings(series_date, scheduled_at, duration_minutes, status, created_by)
      values (d, ((d::text || ' ' || t)::timestamp) at time zone 'America/Sao_Paulo', dur, 'preparing', auth.uid())
      returning id into mid;
      if blocks is not null then
        for b in select * from jsonb_array_elements(blocks) loop
          insert into meeting_blocks(meeting_id, kind, title, duration_minutes, sort_order)
          values (mid, (b->>'kind')::block_kind, b->>'title', (b->>'minutes')::int, (b->>'order')::int);
        end loop;
      end if;
      created := created + 1;
    end if;
  end loop;
  return created;
end $$;

-- ============================================================
-- ENVIO DE PAUTAS EM LOTE (transacional + idempotente)
-- ============================================================
create or replace function submit_agenda_batch(p_batch_id uuid, p_items jsonb, p_reflection text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  sub agenda_submissions%rowtype;
  it jsonb; n int := 0; mid uuid; deadline timestamptz; late boolean := false;
  cal jsonb; dl jsonb; ids uuid[] := '{}'; new_id uuid; prompt uuid;
begin
  if uid is null or not is_member() then raise exception 'not allowed'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'empty batch'; end if;

  -- idempotência: lote já registrado
  select * into sub from agenda_submissions where client_batch_id = p_batch_id;
  if sub.id is not null then
    return jsonb_build_object('submission_id', sub.id, 'count', sub.item_count, 'duplicate', true);
  end if;

  perform ensure_upcoming_meetings(4);
  select id, prompt_id into mid, prompt from meetings
    where status in ('preparing','published') and scheduled_at > now()
    order by scheduled_at limit 1;

  -- prazo recomendado (sexta 17h antes da reunião)
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
      submission_id, submitted_by, title, description, unit_id, expected_outcome, category,
      problem, proposed_solution, expected_impact, urgency, suggested_minutes, people_involved, links,
      strategic_goal_id, requires_decision, status
    ) values (
      sub.id, uid,
      trim(it->>'title'),
      coalesce(it->>'description',''),
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

  -- notifica administradores
  insert into notifications(profile_id, kind, title, body, link)
  select p.id, 'agenda_received', n || ' pauta(s) recebida(s)',
         (select coalesce(short_name, full_name) from profiles where id = uid) || ' enviou ' || n || ' pauta(s) para o próximo COMEX.',
         '/admin/pautas'
  from profiles p where p.role = 'admin' and p.is_active and p.id <> uid;

  return jsonb_build_object('submission_id', sub.id, 'count', n, 'item_ids', to_jsonb(ids), 'is_late', late, 'duplicate', false);
end $$;

-- ============================================================
-- DECISÃO → TAREFA (admin / modo reunião)
-- ============================================================
create or replace function create_decision_with_task(
  p_meeting uuid, p_title text, p_description text, p_owner uuid, p_due date, p_unit uuid, p_agenda_item uuid, p_create_task boolean default true
) returns uuid
language plpgsql security definer set search_path = public as $$
declare did uuid;
begin
  if not is_admin() then raise exception 'not allowed'; end if;
  insert into meeting_decisions(meeting_id, agenda_item_id, title, description, owner_id, unit_id, due_date, created_by)
  values (p_meeting, p_agenda_item, p_title, p_description, p_owner, p_unit, p_due, auth.uid()) returning id into did;
  if p_create_task then
    insert into tasks(title, description, owner_id, unit_id, meeting_id, agenda_item_id, decision_id, due_date, created_by)
    values (p_title, p_description, p_owner, p_unit, p_meeting, p_agenda_item, did, p_due, auth.uid());
    if p_owner is not null then
      insert into notifications(profile_id, kind, title, body, link)
      values (p_owner, 'task_assigned', 'Nova tarefa do COMEX', p_title, '/tarefas');
    end if;
  end if;
  return did;
end $$;

-- ============================================================
-- RLS
-- ============================================================
alter table profiles enable row level security;
alter table invited_users enable row level security;
alter table invited_user_units enable row level security;
alter table business_units enable row level security;
alter table business_unit_members enable row level security;
alter table strategic_goals enable row level security;
alter table annual_targets enable row level security;
alter table unit_annual_revenue enable row level security;
alter table weekly_prompts enable row level security;
alter table meetings enable row level security;
alter table meeting_blocks enable row level security;
alter table meeting_participants enable row level security;
alter table agenda_submissions enable row level security;
alter table agenda_items enable row level security;
alter table agenda_comments enable row level security;
alter table agenda_attachments enable row level security;
alter table meeting_minutes enable row level security;
alter table meeting_decisions enable row level security;
alter table tasks enable row level security;
alter table task_assignees enable row level security;
alter table task_comments enable row level security;
alter table task_activity enable row level security;
alter table kpi_definitions enable row level security;
alter table unit_kpis enable row level security;
alter table kpi_entries enable row level security;
alter table weekly_checkins enable row level security;
alter table growth_ideas enable row level security;
alter table growth_experiments enable row level security;
alter table weekly_reflections enable row level security;
alter table notifications enable row level security;
alter table audit_logs enable row level security;
alter table app_settings enable row level security;

-- profiles
create policy "profiles: ler" on profiles for select to authenticated using (true);
create policy "profiles: editar próprio" on profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid() and role = (select role from profiles p where p.id = auth.uid()) and is_active = (select is_active from profiles p where p.id = auth.uid()));
create policy "profiles: admin" on profiles for all to authenticated using (is_admin()) with check (is_admin());

-- convites e cadastros base: leitura para membros, escrita admin
create policy "invited: admin" on invited_users for all to authenticated using (is_admin()) with check (is_admin());
create policy "invited_units: admin" on invited_user_units for all to authenticated using (is_admin()) with check (is_admin());

create policy "units: ler" on business_units for select to authenticated using (true);
create policy "units: admin" on business_units for all to authenticated using (is_admin()) with check (is_admin());
create policy "members: ler" on business_unit_members for select to authenticated using (true);
create policy "members: admin" on business_unit_members for all to authenticated using (is_admin()) with check (is_admin());
create policy "goals: ler" on strategic_goals for select to authenticated using (true);
create policy "goals: admin" on strategic_goals for all to authenticated using (is_admin()) with check (is_admin());
create policy "targets: ler" on annual_targets for select to authenticated using (is_member());
create policy "targets: admin" on annual_targets for all to authenticated using (is_admin()) with check (is_admin());
create policy "unit_rev: ler" on unit_annual_revenue for select to authenticated using (is_member());
create policy "unit_rev: editar" on unit_annual_revenue for all to authenticated using (can_edit_unit(unit_id)) with check (can_edit_unit(unit_id));
create policy "prompts: ler" on weekly_prompts for select to authenticated using (true);
create policy "prompts: admin" on weekly_prompts for all to authenticated using (is_admin()) with check (is_admin());
create policy "settings: ler" on app_settings for select to authenticated using (true);
create policy "settings: admin" on app_settings for all to authenticated using (is_admin()) with check (is_admin());

-- reuniões
create policy "meetings: ler" on meetings for select to authenticated using (is_member());
create policy "meetings: admin" on meetings for all to authenticated using (is_admin()) with check (is_admin());
create policy "blocks: ler" on meeting_blocks for select to authenticated using (is_member());
create policy "blocks: admin" on meeting_blocks for all to authenticated using (is_admin()) with check (is_admin());
create policy "participants: ler" on meeting_participants for select to authenticated using (is_member());
create policy "participants: admin" on meeting_participants for all to authenticated using (is_admin()) with check (is_admin());

-- pautas
create policy "submissions: ler" on agenda_submissions for select to authenticated using (submitted_by = auth.uid() or is_admin());
create policy "items: ler" on agenda_items for select to authenticated using (
  deleted_at is null and (
    submitted_by = auth.uid() or is_admin() or presenter_id = auth.uid()
    or (meeting_id is not null and exists (select 1 from meetings m where m.id = agenda_items.meeting_id and m.status in ('published','in_progress','closed')))
  )
);
create policy "items: editar própria" on agenda_items for update to authenticated
  using (submitted_by = auth.uid() and status in ('received','returned','in_review'))
  with check (submitted_by = auth.uid());
create policy "items: admin" on agenda_items for all to authenticated using (is_admin()) with check (is_admin());
create policy "comments: ler" on agenda_comments for select to authenticated using (
  is_admin() or exists (select 1 from agenda_items i where i.id = agenda_comments.item_id and (i.submitted_by = auth.uid() or i.presenter_id = auth.uid()))
);
create policy "comments: criar" on agenda_comments for insert to authenticated with check (author_id = auth.uid() and is_member());
create policy "attachments: ler" on agenda_attachments for select to authenticated using (
  is_admin() or exists (select 1 from agenda_items i where i.id = agenda_attachments.item_id and i.submitted_by = auth.uid())
);
create policy "attachments: criar" on agenda_attachments for insert to authenticated with check (uploaded_by = auth.uid());

-- atas e decisões
create policy "minutes: ler" on meeting_minutes for select to authenticated using (is_member() and (status = 'approved' or is_admin()));
create policy "minutes: admin" on meeting_minutes for all to authenticated using (is_admin()) with check (is_admin());
create policy "decisions: ler" on meeting_decisions for select to authenticated using (is_member());
create policy "decisions: admin" on meeting_decisions for all to authenticated using (is_admin()) with check (is_admin());

-- tarefas (transparência entre o comitê; edição só do responsável/colaborador/admin)
create policy "tasks: ler" on tasks for select to authenticated using (is_member() and deleted_at is null);
create policy "tasks: criar" on tasks for insert to authenticated with check (is_member() and created_by = auth.uid());
create policy "tasks: editar" on tasks for update to authenticated using (
  is_admin() or owner_id = auth.uid() or created_by = auth.uid()
  or exists (select 1 from task_assignees a where a.task_id = tasks.id and a.profile_id = auth.uid())
);
create policy "tasks: admin delete" on tasks for delete to authenticated using (is_admin());
create policy "assignees: ler" on task_assignees for select to authenticated using (is_member());
create policy "assignees: editar" on task_assignees for all to authenticated using (
  is_admin() or exists (select 1 from tasks t where t.id = task_assignees.task_id and (t.owner_id = auth.uid() or t.created_by = auth.uid()))
) with check (is_member());
create policy "task_comments: ler" on task_comments for select to authenticated using (is_member());
create policy "task_comments: criar" on task_comments for insert to authenticated with check (is_member() and author_id = auth.uid());
create policy "task_activity: ler" on task_activity for select to authenticated using (is_member());

-- performance
create policy "kpis: ler" on kpi_definitions for select to authenticated using (true);
create policy "kpis: admin" on kpi_definitions for all to authenticated using (is_admin()) with check (is_admin());
create policy "unit_kpis: ler" on unit_kpis for select to authenticated using (true);
create policy "unit_kpis: admin" on unit_kpis for all to authenticated using (is_admin()) with check (is_admin());
create policy "entries: ler" on kpi_entries for select to authenticated using (is_member());
create policy "entries: editar" on kpi_entries for all to authenticated using (can_edit_unit(unit_id)) with check (can_edit_unit(unit_id));
create policy "checkins: ler" on weekly_checkins for select to authenticated using (is_member());
create policy "checkins: editar" on weekly_checkins for all to authenticated using (can_edit_unit(unit_id)) with check (can_edit_unit(unit_id));

-- growth
create policy "ideas: ler" on growth_ideas for select to authenticated using (is_member());
create policy "ideas: criar" on growth_ideas for insert to authenticated with check (is_member() and author_id = auth.uid());
create policy "ideas: editar" on growth_ideas for update to authenticated using (author_id = auth.uid() or is_admin());
create policy "ideas: admin delete" on growth_ideas for delete to authenticated using (is_admin());
create policy "experiments: ler" on growth_experiments for select to authenticated using (is_member());
create policy "experiments: editar" on growth_experiments for all to authenticated using (is_admin() or owner_id = auth.uid()) with check (is_admin() or owner_id = auth.uid());

-- comunicação
create policy "reflections: ler" on weekly_reflections for select to authenticated using (profile_id = auth.uid() or is_admin());
create policy "reflections: admin" on weekly_reflections for update to authenticated using (is_admin());
create policy "notifications: próprias" on notifications for select to authenticated using (profile_id = auth.uid());
create policy "notifications: marcar lida" on notifications for update to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy "audit: admin" on audit_logs for select to authenticated using (is_admin());

-- ============================================================
-- STORAGE: bucket privado de evidências e anexos
-- ============================================================
insert into storage.buckets (id, name, public) values ('comex', 'comex', false) on conflict (id) do nothing;
create policy "comex storage: ler" on storage.objects for select to authenticated using (bucket_id = 'comex' and is_member());
create policy "comex storage: enviar" on storage.objects for insert to authenticated with check (bucket_id = 'comex' and is_member() and (storage.foldername(name))[1] = auth.uid()::text);
create policy "comex storage: apagar próprio" on storage.objects for delete to authenticated using (bucket_id = 'comex' and ((storage.foldername(name))[1] = auth.uid()::text or is_admin()));
