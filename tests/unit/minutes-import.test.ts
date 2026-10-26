import { describe, expect, it } from "vitest";
import { directDownloadUrl, normalizeMinutesText } from "@/lib/minutes-import";
import { preComexDigestEmail, taskReminderEmail } from "@/lib/email-templates";

describe("normalizeMinutesText", () => {
  it("junta linhas quebradas pelo PDF e remove o rodapé do modelo", () => {
    const raw = `Reunião: COMEX\n\nData: 21/07/2026\n\nD1 — DESEMPENHO\n\n• Controle de CMV: Houve uma preocupação com o CMV elevado na\n\nunidade Amauri (44%), levando à decisão de aumentar os preços.\n\nAta de Reunião RPE RPE\\_IMP\\_001\n\n• Migração para PJ: redução visível no INSS.\n\n2\\. Reestruturação e Eventos`;
    const out = normalizeMinutesText(raw);
    expect(out).toContain("CMV elevado na unidade Amauri (44%)");
    expect(out).not.toContain("RPE_IMP_001");
    expect(out).toContain("2. Reestruturação e Eventos");
    expect(out.split("\n").filter((l) => l.startsWith("•"))).toHaveLength(2);
  });
  it("mantém um participante por linha", () => {
    const raw = `PARTICIPANTES\n\nNome Cargo\n\nFelipe Diretor de Operações\n\nIsabela Diretora de Marketing\n\nD1 — DESEMPENHO\n\nTexto.`;
    const out = normalizeMinutesText(raw);
    expect(out).toContain("Felipe Diretor de Operações\nIsabela Diretora de Marketing");
  });
});

describe("directDownloadUrl", () => {
  it("converte link do OneDrive para a API de shares", () => {
    const r = directDownloadUrl("https://1drv.ms/b/c/36e2401e0434cdd9/IQCx?e=tk0tId");
    expect(r.kind).toBe("onedrive");
    expect(r.url.startsWith("https://api.onedrive.com/v1.0/shares/u!")).toBe(true);
    expect(r.url.endsWith("/root/content")).toBe(true);
    expect(r.url).not.toContain("=");
  });
  it("converte link do Google Drive para download direto", () => {
    const r = directDownloadUrl("https://drive.google.com/file/d/1PEMXW_A2Y2Aa3IBsU49nDc_FUZ-yN89S/view");
    expect(r).toEqual({ url: "https://drive.google.com/uc?export=download&id=1PEMXW_A2Y2Aa3IBsU49nDc_FUZ-yN89S&confirm=t", kind: "gdrive" });
  });
});

describe("e-mails", () => {
  const tasks = [
    { id: "t1", title: "Fechar fornecedor de vinhos", due_date: "2026-10-20", status: "in_progress", unit: "Mercearia Amauri" },
    { id: "t2", title: "Planilha de eventos", due_date: null, status: "not_started", unit: null },
  ];
  it("lembrete conta atrasados no assunto", () => {
    const m = taskReminderEmail({ firstName: "Luiz", tasks, today: "2026-10-26", appUrl: "https://comex.test", nextMeetingLabel: "terça-feira, 27 de outubro às 09:00", everyDays: 3 });
    expect(m.subject).toContain("1 compromisso atrasado");
    expect(m.html).toContain("6 dias de atraso");
    expect(m.html).toContain("https://comex.test/tarefas/t1");
    expect(m.html).not.toContain("<script");
  });
  it("resumo da véspera traz ata, decisões e link de pautas", () => {
    const m = preComexDigestEmail({
      firstName: "Erich",
      isAdmin: true,
      today: "2026-10-26",
      appUrl: "https://comex.test",
      meeting: { id: "m2", series_date: "2026-10-27", time: "09:00", published: true, itemsCount: 3 },
      deadlineLabel: "Sexta-feira até 17h",
      lastMeeting: { id: "m1", series_date: "2026-10-20", title: "COMEX — 20/10", summary: "Decidimos X e Y.", hasContent: true, driveUrl: null, fileName: "ata.pdf" },
      decisions: [{ title: "Aprovar piloto", owner: "Luiz", due_date: "2026-11-03", done: false }],
      myTasks: tasks,
      teamLate: [{ name: "Luiz", late: 1, open: 2 }],
      agenda: [{ time: "09:25", title: "Business Review Nami", presenter: "João", minutes: 20, block: "Business Review" }],
      myPautas: 0,
      insights: [{ kind: "growth_idea", title: "Cross-selling eventos", suggestion: "Oferecer…" }],
      pendingClose: 1,
    });
    expect(m.subject).toContain("Amanhã tem COMEX (27/10)");
    expect(m.html).toContain("Decidimos X e Y.");
    expect(m.html).toContain("Aprovar piloto");
    expect(m.html).toContain("/enviar-pautas");
    expect(m.html).toContain("Cross-selling eventos");
    expect(m.html).toContain("Business Review Nami");
  });
});
