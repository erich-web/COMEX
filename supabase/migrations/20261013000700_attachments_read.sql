-- Anexos de pautas (PDFs enviados pelos executivos) ficam visíveis a todos os membros
-- quando a pauta está na agenda ou já foi discutida; antes disso, só autor e admin.
create policy "attachments: ler agendadas" on agenda_attachments for select to authenticated using (
  is_member() and exists (
    select 1 from agenda_items i
    where i.id = agenda_attachments.item_id and i.meeting_id is not null and i.status in ('scheduled','discussed')
  )
);
create index if not exists agenda_attachments_item_idx on agenda_attachments(item_id);
