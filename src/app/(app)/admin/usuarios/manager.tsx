"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, UserCheck, UserX } from "lucide-react";
import { deleteInvite, setUnitMembers, updateProfileAdmin, upsertInvite } from "@/actions/admin";
import { Button } from "@/components/ui/button";
import { Badge, Card, FieldError, Hint, Input, Label, Select } from "@/components/ui/primitives";
import { Sheet } from "@/components/ui/sheet";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

type Role = "admin" | "executive" | "unit_lead" | "guest";
const ROLE: Record<Role, string> = { admin: "CEO / Administrador", executive: "Executivo COMEX", unit_lead: "Responsável por unidade", guest: "Convidado" };
type P = { id: string; email: string; full_name: string; short_name: string | null; role: Role; is_active: boolean; units: { unit_id: string; is_lead: boolean; can_edit: boolean }[] };
type I = { email: string; full_name: string; short_name: string | null; role: Role; unit_slugs: string[] };
type U = { id: string; slug: string; name: string };

export function UsersManager({ profiles, invites, units }: { profiles: P[]; invites: I[]; units: U[] }) {
  const router = useRouter();
  const [, start] = useTransition();
  const [editing, setEditing] = useState<P | null>(null);
  const [inviteOpen, setInviteOpen] = useState<I | null>(null);
  const pendingInvites = invites.filter((i) => !profiles.some((p) => p.email === i.email));

  return (
    <div className="space-y-6">
      <section>
        <div className="mb-2 flex items-center justify-between">
          <div className="section-label">Usuários ({profiles.length})</div>
          <Button variant="green" size="sm" onClick={() => setInviteOpen({ email: "", full_name: "", short_name: "", role: "executive", unit_slugs: [] })}>
            <Plus /> Convidar
          </Button>
        </div>
        <div className="divide-y divide-line border border-line bg-surface">
          {profiles.map((p) => (
            <button key={p.id} onClick={() => setEditing(p)} className="flex w-full items-center gap-3 px-3 py-3 text-left hover:bg-black/[0.03]">
              <span className={cn("flex size-9 shrink-0 items-center justify-center text-xs font-bold", p.is_active ? "bg-black text-offwhite" : "bg-black/10 text-mute")}>{(p.short_name ?? p.full_name ?? "?").slice(0, 1).toUpperCase()}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">
                  {p.full_name || p.email}
                  {!p.is_active ? <span className="ml-2 text-[10px] font-bold uppercase tracking-[0.1em] text-alert">aguardando liberação</span> : null}
                </span>
                <span className="block truncate text-xs text-mute">
                  {p.email} · {ROLE[p.role]}
                  {p.units.length ? ` · ${p.units.map((u) => units.find((x) => x.id === u.unit_id)?.name).filter(Boolean).join(", ")}` : ""}
                </span>
              </span>
              {p.is_active ? <UserCheck className="size-4 text-green-dark" /> : <UserX className="size-4 text-alert" />}
            </button>
          ))}
          {profiles.length === 0 ? <div className="px-3 py-4 text-sm text-mute">Ninguém entrou ainda. Os convidados aparecem aqui após o primeiro login.</div> : null}
        </div>
      </section>

      <section>
        <div className="section-label mb-2">Convites pendentes ({pendingInvites.length})</div>
        <Hint className="mb-2 mt-0">Quem estiver nesta lista entra automaticamente com o papel e as unidades definidas ao usar o link mágico. Confira os e-mails antes de compartilhar o link do COMEX.</Hint>
        <div className="divide-y divide-line border border-line bg-surface">
          {pendingInvites.map((i) => (
            <div key={i.email} className="flex items-center gap-3 px-3 py-2.5">
              <button className="min-w-0 flex-1 text-left" onClick={() => setInviteOpen(i)}>
                <div className="truncate text-sm font-medium">{i.full_name}</div>
                <div className="truncate text-xs text-mute">
                  {i.email} · {ROLE[i.role]}
                  {i.unit_slugs.length ? ` · ${i.unit_slugs.map((s) => units.find((u) => u.slug === s)?.name ?? s).join(", ")}` : ""}
                </div>
              </button>
              <button className="p-1 text-mute hover:text-alert" aria-label="Remover convite" onClick={() => start(async () => { const r = await deleteInvite(i.email); r.ok ? router.refresh() : toast.error(r.error); })}>
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
          {pendingInvites.length === 0 ? <div className="px-3 py-3 text-sm text-mute">Sem convites pendentes.</div> : null}
        </div>
      </section>

      {inviteOpen ? <InviteSheet invite={inviteOpen} units={units} onClose={() => setInviteOpen(null)} /> : null}
      {editing ? <ProfileSheet profile={editing} units={units} onClose={() => setEditing(null)} /> : null}
    </div>
  );
}

function InviteSheet({ invite, units, onClose }: { invite: I; units: U[]; onClose: () => void }) {
  const router = useRouter();
  const [f, setF] = useState({ ...invite, short_name: invite.short_name ?? "" });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [pending, start] = useTransition();
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()} title={invite.email ? "Editar convite" : "Convidar executivo"} description="O acesso é liberado automaticamente no primeiro login com este e-mail.">
      <div className="space-y-4">
        <div>
          <Label>E-mail *</Label>
          <Input type="email" inputMode="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} disabled={!!invite.email} aria-invalid={!!errors.email} />
          <FieldError>{errors.email?.[0]}</FieldError>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Nome completo *</Label>
            <Input value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} aria-invalid={!!errors.full_name} />
            <FieldError>{errors.full_name?.[0]}</FieldError>
          </div>
          <div>
            <Label>Nome curto</Label>
            <Input value={f.short_name} onChange={(e) => setF({ ...f, short_name: e.target.value })} placeholder="Como aparece nas tarefas" />
          </div>
        </div>
        <div>
          <Label>Papel</Label>
          <Select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as Role })}>
            {Object.entries(ROLE).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Unidades sob responsabilidade</Label>
          <div className="flex flex-wrap gap-1.5">
            {units.map((u) => {
              const on = f.unit_slugs.includes(u.slug);
              return (
                <button key={u.id} type="button" onClick={() => setF({ ...f, unit_slugs: on ? f.unit_slugs.filter((s) => s !== u.slug) : [...f.unit_slugs, u.slug] })} className={cn("border px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.08em]", on ? "border-black bg-black text-offwhite" : "border-line")}>
                  {u.name}
                </button>
              );
            })}
          </div>
        </div>
        <Button
          variant="green"
          size="lg"
          block
          loading={pending}
          onClick={() =>
            start(async () => {
              const r = await upsertInvite(f);
              if (r.ok) {
                toast(r.message ?? "Salvo");
                onClose();
                router.refresh();
              } else {
                setErrors(r.fieldErrors ?? {});
                toast.error(r.error);
              }
            })
          }
        >
          Salvar convite
        </Button>
      </div>
    </Sheet>
  );
}

function ProfileSheet({ profile, units, onClose }: { profile: P; units: U[]; onClose: () => void }) {
  const router = useRouter();
  const [f, setF] = useState({ full_name: profile.full_name, short_name: profile.short_name ?? "", role: profile.role, is_active: profile.is_active });
  const [members, setMembers] = useState(profile.units);
  const [pending, start] = useTransition();
  const toggle = (unitId: string) => setMembers((m) => (m.some((x) => x.unit_id === unitId) ? m.filter((x) => x.unit_id !== unitId) : [...m, { unit_id: unitId, is_lead: true, can_edit: true }]));
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()} title={profile.full_name || profile.email} description={profile.email}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label>Nome completo</Label>
            <Input value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} />
          </div>
          <div>
            <Label>Nome curto</Label>
            <Input value={f.short_name} onChange={(e) => setF({ ...f, short_name: e.target.value })} />
          </div>
          <div>
            <Label>Papel</Label>
            <Select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as Role })}>
              {Object.entries(ROLE).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 accent-[#00b73d]" checked={f.is_active} onChange={(e) => setF({ ...f, is_active: e.target.checked })} /> Acesso ativo
        </label>
        <div>
          <Label>Unidades e permissões</Label>
          <div className="space-y-1.5">
            {units.map((u) => {
              const m = members.find((x) => x.unit_id === u.id);
              return (
                <div key={u.id} className={cn("flex items-center gap-2 border px-2.5 py-2", m ? "border-black" : "border-line")}>
                  <button type="button" onClick={() => toggle(u.id)} className="flex-1 text-left text-sm font-medium">
                    {u.name}
                  </button>
                  {m ? (
                    <>
                      <label className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.08em]">
                        <input type="checkbox" className="accent-[#00b73d]" checked={m.is_lead} onChange={(e) => setMembers(members.map((x) => (x.unit_id === u.id ? { ...x, is_lead: e.target.checked } : x)))} /> líder
                      </label>
                      <label className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.08em]">
                        <input type="checkbox" className="accent-[#00b73d]" checked={m.can_edit} onChange={(e) => setMembers(members.map((x) => (x.unit_id === u.id ? { ...x, can_edit: e.target.checked } : x)))} /> edita
                      </label>
                    </>
                  ) : (
                    <Badge variant="soft">visualiza</Badge>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        <Button
          variant="primary"
          size="lg"
          block
          loading={pending}
          onClick={() =>
            start(async () => {
              const r = await updateProfileAdmin(profile.id, f);
              if (!r.ok) return toast.error(r.error);
              const r2 = await setMembersForProfile(profile.id, members, units);
              if (!r2.ok) return toast.error(r2.error);
              toast("Perfil salvo");
              onClose();
              router.refresh();
            })
          }
        >
          Salvar
        </Button>
      </div>
    </Sheet>
  );
}

/** Ajusta a participação deste perfil em cada unidade sem afetar os demais membros. */
async function setMembersForProfile(profileId: string, members: { unit_id: string; is_lead: boolean; can_edit: boolean }[], units: U[]) {
  const { createClient } = await import("@/lib/supabase/client");
  const supabase = createClient();
  const { data: all, error } = await supabase.from("business_unit_members").select("*").in("unit_id", units.map((u) => u.id));
  if (error) return { ok: false as const, error: error.message };
  for (const u of units) {
    const others = (all ?? []).filter((m) => m.unit_id === u.id && m.profile_id !== profileId).map((m) => ({ profile_id: m.profile_id, is_lead: m.is_lead, can_edit: m.can_edit }));
    const mine = members.find((m) => m.unit_id === u.id);
    const current = (all ?? []).find((m) => m.unit_id === u.id && m.profile_id === profileId);
    const changed = JSON.stringify(mine ? { is_lead: mine.is_lead, can_edit: mine.can_edit } : null) !== JSON.stringify(current ? { is_lead: current.is_lead, can_edit: current.can_edit } : null);
    if (!changed) continue;
    const r = await setUnitMembers(u.id, mine ? [...others, { profile_id: profileId, is_lead: mine.is_lead, can_edit: mine.can_edit }] : others);
    if (!r.ok) return r;
  }
  return { ok: true as const };
}
