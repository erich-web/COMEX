import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getUnits } from "@/lib/queries";
import { PageHeader, Container } from "@/components/app/page-header";
import { UsersManager } from "./manager";

export const metadata = { title: "Usuários e permissões" };

export default async function UsuariosPage() {
  await requireAdmin();
  const supabase = await createClient();
  const [{ data: profiles }, { data: invites }, { data: inviteUnits }, { data: members }, units] = await Promise.all([
    supabase.from("profiles").select("*").order("full_name"),
    supabase.from("invited_users").select("*").order("full_name"),
    supabase.from("invited_user_units").select("*"),
    supabase.from("business_unit_members").select("*"),
    getUnits(),
  ]);
  return (
    <div className="fade-in">
      <PageHeader title="Usuários e permissões" label="Administração" back="/admin" />
      <Container className="py-4">
        <UsersManager
          profiles={(profiles ?? []).map((p) => ({ id: p.id, email: p.email, full_name: p.full_name, short_name: p.short_name, role: p.role, is_active: p.is_active, units: (members ?? []).filter((m) => m.profile_id === p.id).map((m) => ({ unit_id: m.unit_id, is_lead: m.is_lead, can_edit: m.can_edit })) }))}
          invites={(invites ?? []).map((i) => ({ email: i.email, full_name: i.full_name, short_name: i.short_name, role: i.role, unit_slugs: (inviteUnits ?? []).filter((u) => u.email === i.email).map((u) => u.unit_slug) }))}
          units={units.map((u) => ({ id: u.id, slug: u.slug, name: u.name }))}
        />
      </Container>
    </div>
  );
}
