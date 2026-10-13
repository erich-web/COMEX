import { test, expect, type Page } from "@playwright/test";

/**
 * E2E dos fluxos críticos do MVP contra o banco real (projeto rpe-comex).
 * Requer servidor com E2E_TEST_LOGIN=1 e os usuários de QA (ver README › Testes).
 */
const ADMIN = { email: "qa.admin@gruporpe.com.br", password: process.env.E2E_QA_PASSWORD ?? "Comex-QA-2026!" };
const EXEC = { email: "qa.exec@gruporpe.com.br", password: process.env.E2E_QA_PASSWORD ?? "Comex-QA-2026!" };

async function login(page: Page, user: { email: string; password: string }) {
  await page.goto("/login");
  const res = await page.request.post("/auth/test-login", { data: user });
  expect(res.ok(), "login de teste (E2E_TEST_LOGIN=1)").toBeTruthy();
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/bom dia|boa tarde|boa noite/i);
}

test.describe("Executivo — mobile", () => {
  test("1-3. entra pelo celular, vê meta RPE 2030, provocação e tarefas pendentes", async ({ page }) => {
    await login(page, EXEC);
    await expect(page.getByText("RPE 2030 —")).toBeVisible();
    await expect(page.locator("text=/“.+”/").first()).toBeVisible(); // provocação
    await expect(page.getByRole("heading", { name: "Minhas tarefas" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Navegação principal" })).toBeVisible();
    // sem rolagem horizontal
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow).toBe(false);
    await page.screenshot({ path: `tests/e2e/screenshots/dashboard-${test.info().project.name}.png`, fullPage: true });
  });

  test("4-7. cadastra cinco pautas, envia com um botão, recebe confirmação e revê o que enviou", async ({ page }) => {
    await login(page, EXEC);
    await page.goto("/enviar-pautas"); // link permanente
    await expect(page).toHaveURL(/\/pautas\/nova/);
    const stamp = Date.now().toString().slice(-5);
    const titles = ["Estudos de cardápio", "Aplicativo do Grupo", "Estratégia comercial da Mercearia Amauri", "Novo fornecedor", "Ideia para crescimento de vendas"].map((t) => `${t} #${stamp}`);
    for (let i = 0; i < titles.length; i++) {
      if (i > 0) await page.getByRole("button", { name: /Adicionar outra pauta/i }).click();
      await page.locator(`#t-${i}`).fill(titles[i]);
      await page.locator(`#d-${i}`).fill(`Contexto da pauta ${i + 1}: o que está acontecendo e o que precisamos discutir no COMEX.`);
    }
    await page.screenshot({ path: `tests/e2e/screenshots/pautas-form-${test.info().project.name}.png`, fullPage: true });
    const submit = page.getByRole("button", { name: "Enviar 5 pautas" });
    await expect(submit).toBeVisible();
    await submit.click();
    await expect(page.getByText("5 pautas registradas")).toBeVisible({ timeout: 20_000 });
    await page.screenshot({ path: `tests/e2e/screenshots/pautas-confirm-${test.info().project.name}.png` });
    await page.goto("/pautas");
    for (const t of titles) await expect(page.getByText(t, { exact: true })).toBeVisible();
  });

  test("valida pauta incompleta apontando qual precisa de correção e preservando as demais", async ({ page }) => {
    await login(page, EXEC);
    await page.goto("/pautas/nova");
    await page.locator("#t-0").fill("Pauta completa de validação");
    await page.locator("#d-0").fill("Descrição suficientemente longa para passar na validação.");
    await page.getByRole("button", { name: /Adicionar outra pauta/i }).click();
    await page.locator("#t-1").fill("X"); // título curto
    await page.getByRole("button", { name: "Enviar 2 pautas" }).click();
    await expect(page.getByText(/precisa de correção/i).first()).toBeVisible();
    await expect(page.locator("#t-0")).toHaveValue("Pauta completa de validação");
  });

  test("16. atualiza status e conclui uma tarefa", async ({ page }) => {
    await login(page, EXEC);
    await page.goto("/tarefas/nova");
    const title = `Tarefa E2E ${Date.now()}`;
    await page.getByPlaceholder(/Apresentar proposta/).fill(title);
    await page.getByRole("button", { name: "Criar tarefa" }).click();
    await expect(page).toHaveURL(/\/tarefas\/[0-9a-f-]+/);
    await page.getByRole("button", { name: "Em andamento" }).click();
    await expect(page.getByText("Status atualizado")).toBeVisible();
    await page.getByRole("button", { name: "Concluir tarefa" }).click();
    await page.getByPlaceholder(/Resultado, números/).fill("Entregue no COMEX.");
    await page.getByRole("button", { name: "Confirmar conclusão" }).click();
    await expect(page.getByText("Tarefa concluída com evidência")).toBeVisible();
    await expect(page.getByText("Concluída", { exact: true }).first()).toBeVisible();
  });

  test("9. atualiza indicadores da unidade e 10. registra check-in com problemas, soluções e ações comerciais", async ({ page }) => {
    await login(page, EXEC);
    await page.goto("/unidades/mercearia-amauri/indicadores");
    await expect(page.getByRole("heading", { name: "Atualizar indicadores" })).toBeVisible();
    const first = page.getByPlaceholder("—").first();
    await first.fill("182500");
    await page.getByRole("button", { name: /Salvar/ }).click();
    await expect(page).toHaveURL(/\/unidades\/mercearia-amauri$/);
    await expect(page.getByText("R$ 182.500")).toBeVisible();

    await page.goto("/unidades/mercearia-amauri/checkin");
    await page.getByPlaceholder(/abaixo do orçado/).fill("Semana 6% abaixo do orçado; sábado forte.");
    await page.getByRole("button", { name: "Adicionar problema" }).click();
    await page.getByPlaceholder("Problema 1").fill("CMV acima de 32%");
    await page.getByPlaceholder("Uma iniciativa, mensurável").fill("Sábado de feijoada com venda ativa na porta");
    await page.getByRole("button", { name: "Adicionar compromisso" }).click();
    await page.getByPlaceholder("Compromisso").fill(`Revisar fichas técnicas E2E ${Date.now()}`);
    await page.getByRole("button", { name: /Registrar check-in|Atualizar check-in/ }).click();
    await expect(page.getByText(/Check-in registrado/)).toBeVisible();
  });

  test("8. consulta atas anteriores (histórico importado)", async ({ page }) => {
    await login(page, EXEC);
    await page.goto("/reunioes");
    await expect(page.getByText("Desempenho, Direcionamento, Desenvolvimento e Defesa")).toBeVisible();
    await page.getByText("Desempenho, Direcionamento, Desenvolvimento e Defesa").click();
    await expect(page.getByText(/Feijoada Mercearia Amauri/)).toBeVisible();
    await expect(page.getByRole("link", { name: /Abrir no Drive/ })).toBeVisible();
  });

  test("permissões: executivo não acessa administração", async ({ page }) => {
    await login(page, EXEC);
    await page.goto("/admin/pautas");
    await expect(page).toHaveURL(/\/$/);
    await page.goto("/mais");
    await expect(page.getByText("Administração")).toHaveCount(0);
  });
});

test.describe("Administrador", () => {
  test("11-12. vê pautas recebidas, organiza em bloco com controle de tempo e publica a agenda", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/admin/pautas");
    await expect(page.getByRole("heading", { name: "Organizar pautas" })).toBeVisible();
    const card = page.locator('[role="button"]').filter({ hasText: /Estudos de cardápio/ }).first();
    await expect(card).toBeVisible();
    await card.click();
    await page.getByRole("button", { name: "Aprovar" }).click();
    const select = page.getByLabel("Bloco na reunião");
    await select.selectOption({ index: 1 });
    await expect(page.getByText(/min$/).first()).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByText(/pautas agendadas/)).toBeVisible();
    await page.screenshot({ path: `tests/e2e/screenshots/admin-pautas-${test.info().project.name}.png`, fullPage: true });
  });

  test("13-15. modo reunião em tela grande registra decisão que gera tarefa", async ({ page, browser }) => {
    await login(page, ADMIN);
    await page.goto("/proximo-comex");
    const link = page.getByRole("link", { name: /Modo reunião/ });
    const href = await link.getAttribute("href");
    const desktop = await browser.newContext({ viewport: { width: 1600, height: 900 }, storageState: await page.context().storageState() });
    const big = await desktop.newPage();
    await big.goto(href!);
    await expect(big.getByText("RPE 2030 —")).toBeVisible();
    await big.keyboard.press("d");
    const title = `Decisão E2E ${Date.now()}`;
    await big.getByRole("textbox").first().fill(title);
    await big.getByRole("button", { name: "Registrar decisão" }).click();
    await expect(big.getByText(title)).toBeVisible();
    await big.screenshot({ path: "tests/e2e/screenshots/modo-reuniao.png" });
    await desktop.close();
    await page.goto("/admin/tarefas?f=open");
    await expect(page.getByText(title)).toBeVisible();
  });

  test("17. accountability: painel consolidado por pessoa", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/admin");
    await expect(page.getByText("Accountability por pessoa")).toBeVisible();
    await expect(page.getByText("Tarefas atrasadas")).toBeVisible();
  });
});
