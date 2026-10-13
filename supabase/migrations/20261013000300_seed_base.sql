-- RPE COMEX — Seed base (cadastros iniciais editáveis pelo administrador)

create or replace function unaccent_safe(t text) returns text language sql immutable as $$
  select translate(t, 'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC')
$$;

-- Vincula responsáveis importados (texto) a perfis pelo nome curto
create or replace function link_legacy_task_owners() returns int
language plpgsql security definer set search_path = public as $$
declare n int := 0; r record;
begin
  for r in select t.id, t.legacy_owner_text from tasks t where t.owner_id is null and t.legacy_owner_text is not null loop
    update tasks set owner_id = (
      select p.id from profiles p
      where p.is_active and p.short_name is not null
        and lower(unaccent_safe(r.legacy_owner_text)) ~ ('(^|[^a-z])' || lower(unaccent_safe(p.short_name)) || '([^a-z]|$)')
      order by length(p.short_name) desc limit 1
    ) where id = r.id and owner_id is null;
    if found then n := n + 1; end if;
  end loop;
  return n;
end $$;

-- ---------- Unidades de negócio
insert into business_units (name, slug, pillar, city, sort_order) values
  ('Mercearia Amauri', 'mercearia-amauri', 'RPE Restaurantes', 'São Paulo, SP', 10),
  ('Nami', 'nami', 'RPE Restaurantes', 'Armação dos Búzios, RJ', 20),
  ('Mercearia Campos', 'mercearia-campos', 'RPE Restaurantes', 'Campos do Jordão, SP', 30),
  ('Bam Bam Café', 'bam-bam-cafe', 'RPE Restaurantes', 'Campos do Jordão, SP', 40),
  ('Mamma Gorda', 'mamma-gorda', 'RPE Restaurantes', 'Campos do Jordão, SP', 50),
  ('Eventos', 'eventos', 'RPE Eventos', 'Campos do Jordão / São Paulo', 60),
  ('Grupo / Holding', 'grupo-holding', 'Grupo / Holding', 'São Paulo, SP', 90)
on conflict (slug) do nothing;

-- ---------- Convites iniciais (e-mails dos executivos: confirmar/editar em Administração → Usuários)
insert into invited_users (email, full_name, short_name, role) values
  ('erich@gruporpe.com.br', 'Erich Progin', 'Erich', 'admin'),
  ('luiz@gruporpe.com.br', 'Luiz Vieira', 'Luiz', 'executive'),
  ('joao@gruporpe.com.br', 'João Vieira', 'João', 'executive'),
  ('felipe@gruporpe.com.br', 'Felipe Cottini', 'Felipe', 'executive'),
  ('bruno@gruporpe.com.br', 'Bruno', 'Bruno', 'executive')
on conflict (email) do nothing;

insert into invited_user_units (email, unit_slug, is_lead) values
  ('luiz@gruporpe.com.br', 'mercearia-amauri', true),
  ('joao@gruporpe.com.br', 'nami', true),
  ('felipe@gruporpe.com.br', 'mercearia-campos', true),
  ('bruno@gruporpe.com.br', 'bam-bam-cafe', true),
  ('bruno@gruporpe.com.br', 'mamma-gorda', true),
  ('bruno@gruporpe.com.br', 'eventos', true)
on conflict do nothing;

-- ---------- Objetivos estratégicos
insert into strategic_goals (name, description, sort_order) values
  ('Crescimento de receita', 'Vender mais e melhor em todas as unidades', 10),
  ('Melhoria de margem', 'CMV, CMO e rentabilidade', 20),
  ('Excelência operacional', 'Processos, qualidade e consistência', 30),
  ('Desenvolvimento de pessoas', 'Liderança, cultura e competências', 40),
  ('Expansão', 'Novas unidades e novos mercados', 50),
  ('Inovação e novos negócios', 'Produtos, serviços e modelos novos', 60)
on conflict (name) do nothing;

-- ---------- Metas RPE 2030
insert into annual_targets (year, revenue_target, note) values
  (2026, null, 'Preencher orçamento e realizado'),
  (2027, null, null), (2028, null, null), (2029, null, null),
  (2030, 200000000, 'Meta RPE 2030 — R$ 200 milhões de receita anual')
on conflict (year) do nothing;

-- ---------- Provocações semanais
insert into weekly_prompts (text) values
  ('O que você fez nesta semana para nos aproximar dos R$ 200 milhões?'),
  ('Qual oportunidade de receita estamos deixando na mesa?'),
  ('Se você fosse dono de todas as unidades, o que faria diferente?'),
  ('O que estamos fazendo para vender mais?'),
  ('Que decisão precisamos tomar hoje para construir o Grupo de 2030?'),
  ('Estamos reagindo aos problemas ou criando oportunidades?'),
  ('Como fazer nossa unidade crescer sem depender apenas de novos investimentos?'),
  ('O que podemos aprender com os melhores negócios do mercado?'),
  ('Qual iniciativa pode transformar nossos resultados nos próximos 90 dias?'),
  ('Que problema estamos aceitando como normal e deveríamos resolver?');

-- ---------- Indicadores
insert into kpi_definitions (key, name, category, unit_type, higher_is_better, has_budget, has_prior_year, applies_to_all, sort_order) values
  ('revenue', 'Receita realizada', 'commercial', 'currency', true, true, true, true, 10),
  ('customers', 'Número de clientes', 'commercial', 'number', true, true, true, true, 20),
  ('avg_ticket', 'Ticket médio', 'commercial', 'currency', true, true, true, true, 30),
  ('revenue_delivery', 'Receita delivery / canais', 'commercial', 'currency', true, false, false, false, 40),
  ('occupancy', 'Ocupação (%)', 'commercial', 'percent', true, true, false, false, 50),
  ('cmv', 'CMV (%)', 'operational', 'percent', false, true, true, true, 60),
  ('cmo', 'CMO (%)', 'operational', 'percent', false, true, true, true, 70),
  ('contribution_margin', 'Margem de contribuição (%)', 'operational', 'percent', true, true, true, true, 80),
  ('operating_margin', 'Margem operacional (%)', 'operational', 'percent', true, true, true, true, 90),
  ('nps', 'NPS', 'experience', 'score', true, true, false, true, 100),
  ('rating', 'Avaliação média (Google/Trip)', 'experience', 'score', true, false, false, true, 110),
  ('complaints', 'Reclamações relevantes', 'experience', 'number', false, false, false, true, 120),
  ('events_pipeline', 'Pipeline comercial (R$)', 'events', 'currency', true, true, false, false, 200),
  ('events_contracts', 'Contratos assinados', 'events', 'number', true, true, false, false, 210),
  ('events_held', 'Eventos realizados', 'events', 'number', true, true, true, false, 220),
  ('events_contracted_revenue', 'Faturamento contratado (R$)', 'events', 'currency', true, true, false, false, 230),
  ('events_margin', 'Margem por evento (%)', 'events', 'percent', true, true, false, false, 240)
on conflict (key) do nothing;

insert into unit_kpis (unit_id, kpi_id)
select b.id, k.id from business_units b join kpi_definitions k on k.category = 'events' where b.slug = 'eventos'
on conflict do nothing;

-- ---------- Configurações
insert into app_settings (key, value) values
  ('calendar', '{"weekday": 2, "time": "09:00", "duration_minutes": 180, "timezone": "America/Sao_Paulo"}'),
  ('agenda_deadline', '{"weekday": 5, "time": "17:00", "label": "Sexta-feira até 17h"}'),
  ('prep_deadline', '{"weekday": 1, "time": "18:00", "label": "Segunda-feira até 18h"}'),
  ('goal_2030', '{"year": 2030, "revenue_target": 200000000, "label": "RPE 2030 — R$ 200 MILHÕES"}'),
  ('default_blocks', '[
    {"order": 1, "kind": "opening", "title": "Abertura e compromisso RPE 2030", "minutes": 5},
    {"order": 2, "kind": "accountability", "title": "Accountability e tarefas pendentes", "minutes": 20},
    {"order": 3, "kind": "business_review", "title": "Business Review — duas unidades", "minutes": 40},
    {"order": 4, "kind": "deliberation", "title": "Deliberações estratégicas", "minutes": 35},
    {"order": 5, "kind": "knowledge", "title": "Conhecimento, brainstorm ou convidado", "minutes": 45},
    {"order": 6, "kind": "growth", "title": "Growth, inovação e oportunidades", "minutes": 20},
    {"order": 7, "kind": "closing", "title": "Decisões, responsáveis e encerramento", "minutes": 15}
  ]')
on conflict (key) do nothing;
