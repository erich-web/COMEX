# RPE COMEX

Plataforma de governança, performance e crescimento do Comitê Executivo do Grupo RPE. Mobile-first, com banco real (Supabase), autenticação por link mágico e tudo orientado à meta **RPE 2030 — R$ 200 milhões**.

- **Stack:** Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind v4 · Lucide · Recharts · Supabase (Postgres + Auth + Storage + RLS) · Zod.
- **Design:** brandbook RPE (preto `#0F0F0F`, off-white `#F5F4F0`, verde `#00B73D`; Anton / Spectral / DM Sans auto-hospedadas; geometria angular).
- **Protótipo anterior:** preservado em `legacy/` (`legacy/index.html` e `legacy/quadro/`). Seu histórico (31 atas, 203 tarefas) foi importado para o banco.

## Estrutura

```
src/
  app/
    login/              login por magic link
    auth/               callback, signout, test-login (só E2E)
    (app)/              área autenticada (bottom nav mobile + sidebar desktop)
      page.tsx          dashboard pessoal
      pautas/           minhas pautas · nova (envio múltiplo) · [id]
      tarefas/          minhas tarefas · nova · [id]
      unidades/[slug]/  performance · indicadores · checkin
      proximo-comex/ reunioes/ growth/ rpe-2030/ perfil/ mais/
      admin/            painel do CEO, pautas (quadro), reuniões/[id] (blocos, ata), tarefas, usuários, unidades, calendário, metas, provocações
    apresentar/[id]/    modo reunião (tela grande)
    enviar-pautas/      link permanente → /pautas/nova
  actions/              server actions (zod + RLS)
  lib/                  auth, queries, agenda (cálculo de tempo), strategy (CAGR/gap), dates (America/Sao_Paulo), classify (heurística), supabase clients
  components/           ui (botões, cards, sheet, toast) e app (shell, header, timeline, task item)
  fonts/                woff2 (OFL)
supabase/migrations/    schema · funções/RLS · seed base · seed do histórico legado
scripts/legacy-seed.mjs gera o seed legado a partir de legacy/index.html
tests/unit (Vitest) · tests/e2e (Playwright)
```

## Configuração

1. **Supabase** — projeto `rpe-comex` (`ayjcvwohmgehaitysjqa`, já criado e migrado). Para um projeto novo, aplique `supabase/migrations/*.sql` em ordem (Dashboard → SQL ou `supabase db push`).
2. **Auth** → *URL Configuration*: `Site URL` = URL pública do app; adicione `https://SEU-DOMINIO/auth/callback` em *Redirect URLs*. Provedor *Email* com magic link habilitado (Google opcional).
3. **Variáveis** — copie `.env.example` para `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (chave *publishable*; nunca use a `service_role` no app)
   - `NEXT_PUBLIC_APP_URL` (usada no link permanente `/enviar-pautas`)
   - `ANTHROPIC_API_KEY` (opcional — habilita a geração assistida de atas e classificação por IA)
4. `npm install && npm run dev`

## Deploy (Vercel)

Importe o repositório, defina as variáveis acima em *Environment Variables* e publique. Não defina `E2E_TEST_LOGIN` em produção.

## Acesso e permissões

- Quem entra é quem está em **Administração → Usuários** (tabela `invited_users`): o primeiro login com o e-mail convidado recebe papel e unidades automaticamente. E-mails não convidados entram como *convidado inativo* e veem a tela “Acesso em liberação”.
- Convites iniciais: `erich@gruporpe.com.br` (admin). Os e-mails de Luiz, João, Felipe e Bruno foram cadastrados como `nome@gruporpe.com.br` — **confirme/edite antes de compartilhar o link**.
- Papéis: `admin` (tudo), `executive`, `unit_lead`, `guest`. A edição de indicadores/check-in depende da associação à unidade (`business_unit_members.can_edit`). Tudo é imposto por RLS no banco.
- Tarefas importadas do protótipo têm o responsável em texto; em **Painel do CEO → Vincular por nome** elas são ligadas aos perfis assim que as pessoas entram.

## Rotina semanal (configurável em Administração → Calendário)

| Quando | O quê |
|---|---|
| Sexta 17h | prazo recomendado para pautas (`/enviar-pautas`) |
| Segunda 18h | indicadores, tarefas e check-in das unidades |
| Terça 9h–12h | COMEX (reuniões criadas automaticamente; reagendar/cancelar não altera a recorrência) |

Fora do prazo nada é bloqueado — a contribuição é marcada como atrasada/extraordinária.

## Testes

```bash
npm run test:unit      # Vitest — cálculo de agenda/excesso de tempo, datas em SP, CAGR/gap, classificação
npm run build
E2E_TEST_LOGIN=1 npm run start   # em outro terminal
npm run test:e2e       # Playwright — iPhone 375×812 e Android 390×844
```

O E2E usa dois usuários de QA já existentes no projeto (`qa.admin@` e `qa.exec@gruporpe.com.br`, senha em `E2E_QA_PASSWORD`, padrão `Comex-QA-2026!`) e a rota `/auth/test-login`, que só existe com `E2E_TEST_LOGIN=1`. Remova os usuários de QA em Administração → Usuários quando não precisar mais. Em ambientes sem Chromium do Playwright, aponte `PLAYWRIGHT_CHROMIUM_PATH`.

Os fluxos do MVP também foram verificados diretamente no banco sob RLS (lote de 5 pautas idempotente, isolamento entre usuários, decisão → tarefa com histórico e notificação, publicação da agenda).

## Fases

- **Fase 1 (esta entrega):** fundação, auth, perfis/permissões, dashboard, envio múltiplo de pautas com rascunho e idempotência, organização administrativa com controle de tempo por bloco, calendário recorrente, tarefas (status, comentários, evidências no Storage), atas com decisões ligadas a tarefas, indicadores e check-in semanal, Growth RPE, RPE 2030 (CAGR, gap, cenários), provocações, notificações in-app, modo reunião.
- **Fase 2:** IA (`src/actions/ai.ts` já modular: atas a partir de anotações e classificação de pautas quando `ANTHROPIC_API_KEY` existe), análises automáticas mais profundas, assistente do CEO.
- **Fase 3:** Everest/BI, e-mail transacional, WhatsApp Business API, calendário externo.
