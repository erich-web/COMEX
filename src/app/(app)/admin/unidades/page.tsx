import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Container } from "@/components/app/page-header";
import { UnitsManager } from "./manager";

export const metadata = { title: "Unidades e indicadores" };

export default async function AdminUnidadesPage() {
  await requireAdmin();
  const supabase = await createClient();
  const [{ data: units }, { data: kpis }, { data: unitKpis }, { data: members }, { data: profiles }] = await Promise.all([
    supabase.from("business_units").select("*").order("sort_order"),
    supabase.from("kpi_definitions").select("*").order("sort_order"),
    supabase.from("unit_kpis").select("*"),
    supabase.from("business_unit_members").select("*, profile:profiles(short_name,full_name)"),
    supabase.from("profiles").select("id,short_name,full_name").eq("is_active", true).order("full_name"),
  ]);
  return (
    <div className="fade-in">
      <PageHeader title="Unidades e indicadores" label="Administração" back="/admin" />
      <Container className="py-4">
        <UnitsManager
          units={(units ?? []).map((u) => ({ ...u, kpi_ids: (unitKpis ?? []).filter((k) => k.unit_id === u.id && k.is_active).map((k) => k.kpi_id), members: (members ?? []).filter((m) => m.unit_id === u.id).map((m) => ({ profile_id: m.profile_id, name: m.profile?.short_name ?? m.profile?.full_name ?? "", is_lead: m.is_lead, can_edit: m.can_edit })) }))}
          kpis={kpis ?? []}
          profiles={(profiles ?? []).map((p) => ({ id: p.id, name: p.short_name ?? p.full_name }))}
        />
      </Container>
    </div>
  );
}
