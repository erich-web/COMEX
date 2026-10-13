// Gera supabase/migrations/20261013000400_seed_legacy.sql a partir do protótipo em legacy/index.html
// Reproduz a lógica de merge do init() do protótipo (SEED + SEED2) sem depender do browser.
import fs from "node:fs";

const src = fs.readFileSync(new URL("../legacy/index.html", import.meta.url), "utf8");

// ---- SEED (2 atas com conteúdo + tarefas) — avaliado em sandbox mínima
const seedSrc = src.match(/const T=\(id,titulo[\s\S]*?\nconst SEED=(\{[\s\S]*?\n\]\});\n/);
if (!seedSrc) throw new Error("SEED não encontrado");
const T = (id, titulo, responsavel, prazo, pilar, ataId, notas) => ({
  id, titulo, responsavel, prazo, pilar, ataId, notas: notas || "", status: "pendente",
  criadaEm: ataId === "a2807" ? "2026-07-28" : "2026-08-04",
});
// eslint-disable-next-line no-new-func
const SEED = new Function("T", `return ${seedSrc[1]};`)(T);

// ---- SEED2 (JSON)
const seed2Src = src.match(/const SEED2=(\{[\s\S]*?\});\n/);
if (!seed2Src) throw new Error("SEED2 não encontrado");
const SEED2 = JSON.parse(seed2Src[1]);

const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// Merge idêntico ao protótipo
const atas = SEED.atas.map((a) => ({ ...a }));
const tasks = SEED.tasks.map((t) => ({ ...t }));
SEED2.atas.forEach((a) => {
  const ex = atas.find((x) => x.data === a.data);
  if (ex) ex.driveUrl = a.driveUrl;
  else atas.push({ id: "d" + a.data, conteudo: "", data: a.data, titulo: a.titulo, driveUrl: a.driveUrl });
});
SEED2.tasks.forEach((t) => {
  const ex = tasks.find((x) => norm(x.titulo) === norm(t.titulo));
  if (ex) {
    if (t.status === "concluida" && ex.status !== "concluida") { ex.status = "concluida"; ex.concluidaEm = t.concluidaEm || ex.prazo || "2026-08-04"; }
    if (!ex.prazo && t.prazo) ex.prazo = t.prazo;
    if (!ex.ataId && t.reuniao === "COMEX") { const a = atas.find((x) => x.data === t.reuniaoData); if (a) ex.ataId = a.id; }
    return;
  }
  let ataId = null;
  if (t.reuniao === "COMEX" && t.reuniaoData) {
    let best = null, bd = 99;
    atas.forEach((a) => { const d = Math.abs((new Date(a.data) - new Date(t.reuniaoData)) / 86400000); if (d < bd) { bd = d; best = a; } });
    if (best && bd <= 3) ataId = best.id;
  }
  tasks.push({ id: "x" + tasks.length, criadaEm: t.reuniaoData, titulo: t.titulo, responsavel: t.responsavel, prazo: t.prazo, pilar: t.pilar, notas: t.notas, status: t.status, concluidaEm: t.concluidaEm, ataId });
});

const q = (s) => (s == null || s === "" ? "null" : `'${String(s).replace(/'/g, "''")}'`);
const ataDate = (id) => atas.find((a) => a.id === id)?.data;

const atasJson = atas.sort((x, y) => x.data.localeCompare(y.data)).map((a) => ({ d: a.data, t: a.titulo || "COMEX", c: a.conteudo || "", u: a.driveUrl || null }));
const tasksJson = tasks.map((t) => ({
  t: t.titulo, n: t.notas || null, r: t.responsavel || null, p: t.pilar || null, d: t.prazo || null,
  s: t.status === "concluida" ? "done" : "not_started",
  c: t.status === "concluida" ? (t.concluidaEm || t.prazo || ataDate(t.ataId) || "2026-08-04") : null,
  m: ataDate(t.ataId) || null, k: t.criadaEm || ataDate(t.ataId) || "2026-08-04",
}));
const j = (o) => "'" + JSON.stringify(o).replace(/'/g, "''") + "'::jsonb";
let sql = `-- Seed: histórico importado do protótipo (atas ${atas.length}, tarefas ${tasks.length})
-- Gerado por scripts/legacy-seed.mjs — não editar à mão.

with a as (select * from jsonb_to_recordset(${j(atasJson)}) as x(d date, t text, c text, u text)),
m as (
  insert into meetings(series_date, scheduled_at, status, title, closed_at)
  select d, (d::text || ' 09:00')::timestamp at time zone 'America/Sao_Paulo', 'closed', t, (d::text || ' 12:00')::timestamp at time zone 'America/Sao_Paulo' from a
  on conflict (series_date) do nothing
  returning id, series_date
)
insert into meeting_minutes(meeting_id, title, content, drive_url, status, approved_at)
select m.id, a.t, a.c, a.u, 'approved', (a.d::text || ' 12:00')::timestamp at time zone 'America/Sao_Paulo'
from m join a on a.d = m.series_date
on conflict (meeting_id) do nothing;

insert into tasks(title, description, legacy_owner_text, pillar, due_date, status, completed_at, meeting_id, created_at)
select x.t, x.n, x.r, x.p, x.d, x.s::task_status, x.c::timestamptz, (select id from meetings mm where mm.series_date = x.m), x.k::timestamptz
from jsonb_to_recordset(${j(tasksJson)}) as x(t text, n text, r text, p text, d date, s text, c date, m date, k date);

select link_legacy_task_owners();
`;
fs.writeFileSync(new URL("../supabase/migrations/20261013000400_seed_legacy.sql", import.meta.url), sql);
console.log(`ok: ${atas.length} atas, ${tasks.length} tarefas`);
