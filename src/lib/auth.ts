import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/types";

export type Profile = Tables<"profiles">;
export type UnitMembership = { unit_id: string; is_lead: boolean; can_edit: boolean; unit: Tables<"business_units"> };

export type Session = {
  profile: Profile;
  units: UnitMembership[];
  isAdmin: boolean;
  isMember: boolean;
};

/** Sessão atual (cacheada por request). Redireciona para /login sem usuário. */
export const getSession = cache(async (): Promise<Session> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (!profile) {
    // Trigger de criação pode não ter rodado (usuário muito antigo) — cria perfil mínimo como convidado inativo
    const { data: created } = await supabase
      .from("profiles")
      .insert({ id: user.id, email: user.email ?? "", full_name: user.email?.split("@")[0] ?? "", role: "guest", is_active: false })
      .select("*")
      .single();
    if (!created) redirect("/pendente");
    return { profile: created, units: [], isAdmin: false, isMember: false };
  }

  const { data: members } = await supabase
    .from("business_unit_members")
    .select("unit_id, is_lead, can_edit, unit:business_units(*)")
    .eq("profile_id", user.id);

  const units = (members ?? [])
    .filter((m) => m.unit && (m.unit as Tables<"business_units">).is_active)
    .map((m) => ({ unit_id: m.unit_id, is_lead: m.is_lead, can_edit: m.can_edit, unit: m.unit as Tables<"business_units"> }))
    .sort((a, b) => a.unit.sort_order - b.unit.sort_order);

  const isAdmin = profile.role === "admin" && profile.is_active;
  const isMember = profile.is_active && ["admin", "executive", "unit_lead"].includes(profile.role);
  return { profile, units, isAdmin, isMember };
});

/** Exige membro ativo; convidados/inativos vão para /pendente. */
export async function requireMember(): Promise<Session> {
  const s = await getSession();
  if (!s.isMember) redirect("/pendente");
  return s;
}

export async function requireAdmin(): Promise<Session> {
  const s = await requireMember();
  if (!s.isAdmin) redirect("/");
  return s;
}
