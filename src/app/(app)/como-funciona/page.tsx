import Link from "next/link";
import { requireMember } from "@/lib/auth";
import { getSettings } from "@/lib/queries";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { ACCOUNTABILITY_FIELDS, GUIDE_RULES } from "@/lib/guide";

export const metadata = { title: "Como funciona" };

export default async function ComoFuncionaPage() {
  await requireMember();
  const settings = await getSettings();
  return (
    <div className="fade-in">
      <PageHeader title="Como funciona o COMEX" label="Orientação para enviar pautas e prestar contas" back="/" />
      <div className="mx-auto max-w-3xl space-y-5 px-4 py-4 md:px-8">
        <p className="text-[14px] leading-relaxed text-ink-2">
          O COMEX acontece toda terça, 9h–12h. O que entra na reunião é o que foi enviado pelo app até <strong>{settings.agendaDeadline.label.toLowerCase()}</strong>. Salve o link de envio nos favoritos do celular.
        </p>
        <ol className="space-y-2">
          {GUIDE_RULES.map((r, i) => (
            <li key={i} className="flex gap-3 rounded-[14px] border border-line bg-surface p-4">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-[13px] font-bold text-primary-ink">{i + 1}</span>
              <div>
                <div className="text-[15px] font-semibold">{r.title}</div>
                <div className="mt-0.5 text-[13px] leading-relaxed text-ink-2">{r.text}</div>
              </div>
            </li>
          ))}
        </ol>

        <section className="rounded-[14px] border border-line bg-surface p-4">
          <h2 className="text-[16px] font-bold">Prestação de contas da unidade — toda semana</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-2">
            Quem responde por unidade envia, junto com as pautas, uma pauta de 10 minutos com a temática <strong>Prestação de contas</strong>. O formulário já pede os quatro blocos abaixo — sempre os mesmos, para comparar semana a semana. Na terça, cada um apresenta em 5 minutos a partir do que enviou, sem slide novo.
          </p>
          <ul className="mt-3 space-y-2">
            {ACCOUNTABILITY_FIELDS.map((f) => (
              <li key={f.key} className="rounded-[10px] bg-bg px-3 py-2.5">
                <div className="text-[14px] font-semibold">{f.label}</div>
                <div className="text-[13px] text-ink-2">{f.hint}</div>
              </li>
            ))}
          </ul>
        </section>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button asChild variant="primary" size="lg" className="flex-1">
            <Link href="/pautas/nova">Enviar pautas</Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="flex-1">
            <Link href="/tarefas">Revisar meus compromissos</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
