# COMEX — Grupo RPE

Plataforma do Comitê Executivo do Grupo RPE, pensada para o celular e para a dinâmica da terça-feira: **enviar pautas em lote**, **arquivar e consultar as atas** e um **Agente COMEX** que lê atas e pautas para apontar problemas recorrentes, decisões travadas, ideias de crescimento e perguntas críticas.

- **Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · Lucide · Supabase (Postgres + Auth + Storage + RLS) · Zod · API da Anthropic (agente).
- **Visual:** padrão interno "SaaS azul" (fundo slate, cards brancos, azul `#2563eb`, fonte do sistema) — o mesmo do sistema de RH e do dashboard Campos Hall.
- **Protótipo aprovado:** canvas "COMEX — protótipo simplificado" (4 telas de celular + desktop de organização). O protótipo anterior, em preto/verde, foi substituído.

## O que o app faz

| Celular (4 abas) | |
|---|---|
| **Início** | botão único "Enviar pautas", provocação da semana, o que te espera na terça (suas pautas, compromissos vencendo, Business Review), último aviso do agente |
| **Pautas** | envio de várias pautas num só envio — **título, pergunta-chave, duração (chips), temática (chips), empresa (chips)**; contexto e links opcionais; rascunho local; idempotente; validação por pauta |
| **Atas** | busca por texto, filtros (com decisões, minha unidade, ano), card da última ata com resumo, decisões, compromissos e PDF no Drive; histórico importado (31 atas) |
| **Agente** | cards de *problema recorrente*, *decisão em aberto*, *ideia de crescimento*, *pergunta crítica* e *sugestão*, cada um com "Virar pauta" e links para as atas de origem; caixa de pergunta livre |

**Assistente de pautas (out/2026):** no envio, "Colar lista ou texto" e "Importar PDF, foto ou Word" montam várias pautas de uma vez (título, pergunta-chave, tempo, temática, empresa) para revisão; em cada pauta, "Sugerir pergunta-chave e tempo" completa o que falta e lista pendências (números, proposta, material). Anexo visível em cada pauta.

**Compromissos:** status com cor e rótulo em toda a lista, troca de status em um toque (sem abrir a tarefa), linha do tempo das mudanças e faixa de "concluída / bloqueada / atrasada" no detalhe.

**E-mails automáticos (`/api/cron/daily`, 8h de São Paulo):** lembrete de compromissos pendentes a cada 3 dias (editável) e, na véspera do COMEX, resumo com a última ata, decisões, compromissos do destinatário, agenda publicada, link de envio de pautas e análises do agente. Disparos manuais, pré-visualização e diagnóstico em `/admin/ia`; cada pessoa pode desligar em Perfil.

**Atas:** em Organização → reunião → Ata, envie o PDF/Word do Wesley ou cole o link do OneDrive/Drive — o texto é extraído e "Estruturar com IA" propõe resumo, decisões e compromissos para você marcar e registrar. O modo reunião abre com a leitura da ata anterior (resumo, decisões e compromissos abertos), cronômetro regressivo por pauta e indicador de atraso em relação à agenda.

**Desktop (quem organiza):** `/admin` — pautas recebidas à esquerda, agenda da terça à direita com minutos por bloco e alerta de excesso; "Sugestão do agente" distribui as pautas nos blocos; publicar agenda; blocos/participantes/ata; compromissos de todos com accountability por pessoa; pessoas e empresas; IA e e-mails (`/admin/ia`); configurações (calendário, provocações). Modo reunião em `/apresentar/[id]`.

Temáticas: Crescimento e vendas · Decisão estratégica · Problema e solução · Ideia / inovação · Prestação de contas · Conhecimento.

## Estrutura

```
src/app/
  login/ auth/ pendente/        login por magic link; test-login só com E2E_TEST_LOGIN=1
  (app)/page.tsx                Início
  (app)/pautas/                 minhas pautas · nova (lote) · [id]
  (app)/atas/                   lista · [id]
  (app)/agente/                 Agente COMEX
  (app)/tarefas/                compromissos (via Início e atas)
  (app)/proximo-comex/          agenda publicada da terça
  (app)/admin/                  organizar a terça (page) · reunioes/[id] (blocos, ata) · tarefas · usuarios · unidades · calendario · provocacoes
  apresentar/[id]/              modo reunião (tela grande)
  enviar-pautas/                link permanente → /pautas/nova
  (app)/admin/ia/               diagnóstico da IA e dos e-mails, disparos manuais, regras dos lembretes
  api/cron/daily/               rotina diária (Vercel Cron) — lembretes, resumo da véspera, encerramento de reuniões esquecidas
  anexos/ata/[meetingId]/       arquivo original da ata (URL assinada)
src/actions/                    server actions (zod + RLS): agenda, agenda-ai, agent, tasks, meetings, minutes, notifications, admin, ai
src/lib/llm.ts                  API da Anthropic (modelo padrão claude-sonnet-5-5, fallback automático, blocos PDF/imagem)
src/lib/agent-core.ts           núcleo do agente (corpus das atas, análises, pergunta livre, resumo de ata) — usado pelo app e pelo cron
src/lib/ai-call.ts              chamadas com registro em ai_runs
src/lib/email.ts                envio pelo Resend (REST) + email_log · src/lib/email-templates.ts · src/lib/jobs.ts (rotinas)
src/lib/minutes-import.ts       extração de texto (unpdf / mammoth), normalização e download por link (OneDrive/Drive)
supabase/migrations/            schema · funções/RLS · seeds · hardening · simplify_agent · email_minutes_ai (email_log, ai_runs, job_runs, notify_email, file_path)
tests/unit (Vitest) · tests/e2e (Playwright)
```

## Configuração

1. **Supabase** — projeto `rpe-comex` (`ayjcvwohmgehaitysjqa`), migrado até `20261026000100_email_minutes_ai.sql`. Para um projeto novo, aplique `supabase/migrations/*.sql` em ordem.
2. **Auth** → *URL Configuration*: Site URL = URL pública; `https://SEU-DOMINIO/auth/callback` em Redirect URLs. Provedor Email (magic link).
3. **Variáveis** (`.env.example`):
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (nunca a `service_role`)
   - `NEXT_PUBLIC_APP_URL` (link permanente `/enviar-pautas`)
   - `ANTHROPIC_API_KEY` — **obrigatória para o Agente** (análises, pergunta livre, sugestão de agenda, assistente de pautas, estruturação de atas); `ANTHROPIC_MODEL` opcional (padrão `claude-sonnet-5-5`, com fallback automático se o modelo for recusado)
   - `RESEND_API_KEY` — envio de e-mails (lembretes e resumo da véspera); `EMAIL_FROM` — remetente, ex.: `COMEX Grupo RPE <comex@gruporpe.com.br>` (exige domínio verificado no Resend; sem ela usa `onboarding@resend.dev`, que só entrega para o dono da conta)
   - `SUPABASE_SERVICE_ROLE_KEY` — só no servidor; usada pela rotina diária (`/api/cron/daily`). Nunca vai para o navegador.
   - `CRON_SECRET` — qualquer string longa; a Vercel envia `Authorization: Bearer <CRON_SECRET>` ao chamar o cron (`vercel.json`, 11:00 UTC = 8h em São Paulo)
4. `npm install && npm run dev`

## Deploy (Vercel)

Projeto `comex` (time `erich-webs-projects`), produção em **https://comex-omega.vercel.app**. Push em `main` = deploy. Para ativar o agente, adicione `ANTHROPIC_API_KEY` em *Environment Variables* e faça um redeploy; para os e-mails, `RESEND_API_KEY`, `EMAIL_FROM`, `SUPABASE_SERVICE_ROLE_KEY` e `CRON_SECRET`. O estado de cada uma aparece em `/admin/ia`. Não defina `E2E_TEST_LOGIN` em produção.

## Acesso e permissões

- Entra quem está em **Pessoas e empresas** (`invited_users`); o primeiro login recebe papel e empresas. E-mails não convidados veem "Acesso em liberação".
- Convites iniciais: `erich@gruporpe.com.br` (admin). Luiz, João, Felipe e Bruno estão como `nome@gruporpe.com.br` — confirme antes de divulgar o link.
- Papéis `admin`, `executive`, `unit_lead`, `guest`; tudo imposto por RLS. O agente responde apenas com os dados que o usuário pode ver.
- Compromissos importados têm o responsável em texto; em Compromissos → "Vincular por nome" eles são ligados aos perfis.

## Rotina (editável em Configurações)

| Quando | O quê |
|---|---|
| Sexta 17h | prazo recomendado para pautas |
| Segunda 18h | organização da agenda e análise do agente |
| Terça 9h–12h | COMEX |

Fora do prazo nada é bloqueado — a pauta entra como extraordinária.

## Testes

```bash
npm run test:unit                 # Vitest
npm run build && E2E_TEST_LOGIN=1 npm run start
npm run test:e2e                  # Playwright — iPhone 375×812 e Android 390×844
```

E2E usa `qa.admin@` e `qa.exec@gruporpe.com.br` (senha em `E2E_QA_PASSWORD`). Remova os usuários de QA quando não precisar mais. O lote de pautas com pergunta-chave foi verificado também diretamente no banco sob RLS.
