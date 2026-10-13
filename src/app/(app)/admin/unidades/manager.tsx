"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { setUnitMembers, upsertKpiDefinition, upsertUnit } from "@/actions/admin";
import { Button } from "@/components/ui/button";
import { Badge, FieldError, Input, Label, Select } from "@/components/ui/primitives";
import { Sheet } from "@/components/ui/sheet";
import { toast } from "@/components/ui/toast";
import type { Tables } from "@/lib/types";
import { cn } from "@/lib/utils";

type Unit = Tables<"business_units"> & { kpi_ids: string[]; members: { profile_id: string; name: string; is_lead: boolean; can_edit: boolean }[] };
type Kpi = Tables<"kpi_definitions">;
const CAT: Record<string, string> = { commercial: "Comercial", operational: "Operacional", experience: "Experiência", events: "Eventos" };

export function UnitsManager({ units, kpis, profiles }: { units: Unit[]; kpis: Kpi[]; profiles: { id: string; name: string }[] }) {
  const [unit, setUnit] = useState<Unit | "new" | null>(null);
  const [kpi, setKpi] = useState<Kpi | "new" | null>(null);
  return (
    <div className="space-y-6">
      <section>
        <div className="mb-2 flex items-center justify-between">
          <div className="section-label">Unidades de negócio</div>
          <Button variant="green" size="sm" onClick={() => setUnit("new")}>
            <Plus /> Unidade
          </Button>
        </div>
        <div className="divide-y divide-line border border-line bg-surface">
          {units.map((u) => (
            <button key={u.id} onClick={() => setUnit(u)} className="flex w-full items-center gap-3 px-3 py-3 text-left hover:bg-black/[0.03]">
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">
                  {u.name} {!u.is_active ? <Badge variant="soft">inativa</Badge> : null}
                </span>
                <span className="block text-xs text-mute">
                  {u.pillar} · {u.members.map((m) => m.name).join(", ") || "sem responsáveis"} · {u.kpi_ids.length ? `${u.kpi_ids.length} KPIs específicos` : "KPIs padrão"}
                </span>
              </span>
            </button>
          ))}
        </div>
      </section>
      <section>
        <div className="mb-2 flex items-center justify-between">
          <div className="section-label">Catálogo de indicadores</div>
          <Button variant="outline" size="sm" onClick={() => setKpi("new")}>
            <Plus /> Indicador
          </Button>
        </div>
        <div className="divide-y divide-line border border-line bg-surface">
          {kpis.map((k) => (
            <button key={k.id} onClick={() => setKpi(k)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-black/[0.03]">
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{k.name}</span>
                <span className="block text-[11px] text-mute">
                  {CAT[k.category]} · {k.unit_type} · {k.applies_to_all ? "todas as unidades" : "específico"} {!k.is_active ? "· inativo" : ""}
                </span>
              </span>
            </button>
          ))}
        </div>
      </section>
      {unit ? <UnitSheet unit={unit === "new" ? null : unit} kpis={kpis} profiles={profiles} onClose={() => setUnit(null)} /> : null}
      {kpi ? <KpiSheet kpi={kpi === "new" ? null : kpi} onClose={() => setKpi(null)} /> : null}
    </div>
  );
}

function UnitSheet({ unit, kpis, profiles, onClose }: { unit: Unit | null; kpis: Kpi[]; profiles: { id: string; name: string }[]; onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [f, setF] = useState({ name: unit?.name ?? "", slug: unit?.slug ?? "", pillar: unit?.pillar ?? "RPE Restaurantes", city: unit?.city ?? "", is_active: unit?.is_active ?? true, sort_order: unit?.sort_order ?? 100, kpi_ids: unit?.kpi_ids ?? [] });
  const [members, setMembers] = useState(unit?.members ?? []);
  const specific = kpis.filter((k) => !k.applies_to_all && k.is_active);
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()} title={unit ? unit.name : "Nova unidade"}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label>Nome *</Label>
            <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value, slug: unit ? f.slug : e.target.value.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") })} aria-invalid={!!errors.name} />
            <FieldError>{errors.name?.[0]}</FieldError>
          </div>
          <div>
            <Label>Slug (URL)</Label>
            <Input value={f.slug} onChange={(e) => setF({ ...f, slug: e.target.value })} aria-invalid={!!errors.slug} />
            <FieldError>{errors.slug?.[0]}</FieldError>
          </div>
          <div>
            <Label>Pilar</Label>
            <Select value={f.pillar} onChange={(e) => setF({ ...f, pillar: e.target.value })}>
              {["RPE Restaurantes", "RPE Hotéis", "RPE Eventos", "RPE Empreendimentos", "RPE Properties", "Grupo / Holding"].map((p) => (
                <option key={p}>{p}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Cidade</Label>
            <Input value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} />
          </div>
          <div>
            <Label>Ordem</Label>
            <Input type="number" value={f.sort_order} onChange={(e) => setF({ ...f, sort_order: Number(e.target.value) })} />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 accent-[#00b73d]" checked={f.is_active} onChange={(e) => setF({ ...f, is_active: e.target.checked })} /> Unidade ativa
        </label>
        <div>
          <Label>Indicadores específicos (além dos padrão)</Label>
          <div className="flex flex-wrap gap-1.5">
            {specific.map((k) => {
              const on = f.kpi_ids.includes(k.id);
              return (
                <button key={k.id} type="button" onClick={() => setF({ ...f, kpi_ids: on ? f.kpi_ids.filter((x) => x !== k.id) : [...f.kpi_ids, k.id] })} className={cn("border px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.08em]", on ? "border-black bg-black text-offwhite" : "border-line")}>
                  {k.name}
                </button>
              );
            })}
          </div>
        </div>
        {unit ? (
          <div>
            <Label>Responsáveis</Label>
            <div className="space-y-1.5">
              {profiles.map((p) => {
                const m = members.find((x) => x.profile_id === p.id);
                return (
                  <div key={p.id} className={cn("flex items-center gap-2 border px-2.5 py-2", m ? "border-black" : "border-line")}>
                    <button type="button" className="flex-1 text-left text-sm" onClick={() => setMembers(m ? members.filter((x) => x.profile_id !== p.id) : [...members, { profile_id: p.id, name: p.name, is_lead: true, can_edit: true }])}>
                      {p.name}
                    </button>
                    {m ? (
                      <>
                        <label className="flex items-center gap-1 text-[10px] font-bold uppercase">
                          <input type="checkbox" className="accent-[#00b73d]" checked={m.is_lead} onChange={(e) => setMembers(members.map((x) => (x.profile_id === p.id ? { ...x, is_lead: e.target.checked } : x)))} /> líder
                        </label>
                        <label className="flex items-center gap-1 text-[10px] font-bold uppercase">
                          <input type="checkbox" className="accent-[#00b73d]" checked={m.can_edit} onChange={(e) => setMembers(members.map((x) => (x.profile_id === p.id ? { ...x, can_edit: e.target.checked } : x)))} /> edita
                        </label>
                      </>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
        <Button
          variant="primary"
          size="lg"
          block
          loading={pending}
          onClick={() =>
            start(async () => {
              const r = await upsertUnit(unit?.id ?? null, f);
              if (!r.ok) {
                setErrors(r.fieldErrors ?? {});
                return toast.error(r.error);
              }
              if (unit) {
                const m = await setUnitMembers(unit.id, members.map(({ profile_id, is_lead, can_edit }) => ({ profile_id, is_lead, can_edit })));
                if (!m.ok) return toast.error(m.error);
              }
              toast(r.message ?? "Salvo");
              onClose();
              router.refresh();
            })
          }
        >
          Salvar unidade
        </Button>
      </div>
    </Sheet>
  );
}

function KpiSheet({ kpi, onClose }: { kpi: Kpi | null; onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [f, setF] = useState({
    key: kpi?.key ?? "",
    name: kpi?.name ?? "",
    category: (kpi?.category ?? "commercial") as Kpi["category"],
    unit_type: (kpi?.unit_type ?? "number") as Kpi["unit_type"],
    higher_is_better: kpi?.higher_is_better ?? true,
    has_budget: kpi?.has_budget ?? true,
    has_prior_year: kpi?.has_prior_year ?? true,
    applies_to_all: kpi?.applies_to_all ?? false,
    sort_order: kpi?.sort_order ?? 100,
    is_active: kpi?.is_active ?? true,
  });
  const chk = (k: keyof typeof f, label: string) => (
    <label key={k} className="flex items-center gap-2 text-sm">
      <input type="checkbox" className="size-4 accent-[#00b73d]" checked={!!f[k]} onChange={(e) => setF({ ...f, [k]: e.target.checked })} /> {label}
    </label>
  );
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()} title={kpi ? kpi.name : "Novo indicador"}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label>Nome *</Label>
            <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value, key: kpi ? f.key : e.target.value.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/(^_|_$)/g, "") })} />
          </div>
          <div>
            <Label>Chave</Label>
            <Input value={f.key} onChange={(e) => setF({ ...f, key: e.target.value })} disabled={!!kpi} />
          </div>
          <div>
            <Label>Categoria</Label>
            <Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as Kpi["category"] })}>
              {Object.entries(CAT).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Tipo</Label>
            <Select value={f.unit_type} onChange={(e) => setF({ ...f, unit_type: e.target.value as Kpi["unit_type"] })}>
              <option value="currency">R$</option>
              <option value="percent">%</option>
              <option value="number">Número</option>
              <option value="score">Nota</option>
            </Select>
          </div>
          <div>
            <Label>Ordem</Label>
            <Input type="number" value={f.sort_order} onChange={(e) => setF({ ...f, sort_order: Number(e.target.value) })} />
          </div>
        </div>
        {chk("higher_is_better", "Quanto maior, melhor")}
        {chk("has_budget", "Tem orçado")}
        {chk("has_prior_year", "Compara com ano anterior")}
        {chk("applies_to_all", "Vale para todas as unidades")}
        {chk("is_active", "Ativo")}
        <Button
          variant="primary"
          size="lg"
          block
          loading={pending}
          onClick={() =>
            start(async () => {
              const r = await upsertKpiDefinition(kpi?.id ?? null, f);
              if (r.ok) {
                toast(r.message ?? "Salvo");
                onClose();
                router.refresh();
              } else toast.error(r.error);
            })
          }
        >
          Salvar indicador
        </Button>
      </div>
    </Sheet>
  );
}
