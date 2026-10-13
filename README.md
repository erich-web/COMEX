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

**Desktop (quem organiza):** `/admin` — pautas recebidas à esquerda, agenda da terça à direita com minutos por bloco e alerta de excesso; "Sugestão do agente" distribui as pautas nos blocos; publicar agenda; blocos/participantes/ata; compromissos de todos com accountability por pessoa; pessoas e empresas; configurações (calendário, provocações). Modo reunião em `/apresentar/[id]`.

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
src/actions/                    server actions (zod + RLS): agenda, agent, tasks, meetings, admin, ai
src/lib/llm.ts                  chamada à API da Anthropic (server-only)
supabase/migrations/            schema · funções/RLS · seeds · hardening · simplify_agent (key_question, agent_insights, agent_questions)
tests/unit (Vitest) · tests/e2e (Playwright)
```

## Configuração

1. **Supabase** — projeto `rpe-comex` (`ayjcvwohmgehaitysjqa`), migrado até `20261013000600_simplify_agent.sql`. Para um projeto novo, aplique `supabase/migrations/*.sql` em ordem.
2. **Auth** → *URL Configuration*: Site URL = URL pública; `https://SEU-DOMINIO/auth/callback` em Redirect URLs. Provedor Email (magic link).
3. **Variáveis** (`.env.example`):
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (nunca a `service_role`)
   - `NEXT_PUBLIC_APP_URL` (link permanente `/enviar-pautas`)
   - `ANTHROPIC_API_KEY` — **obrigatória para o Agente** (análises, pergunta livre e sugestão de agenda); `ANTHROPIC_MODEL` opcional
4. `npm install && npm run dev`

## Deploy (Vercel)

Projeto `comex` (time `erich-webs-projects`), produção em **https://comex-omega.vercel.app**. Push em `main` = deploy. Para ativar o agente, adicione `ANTHROPIC_API_KEY` em *Environment Variables* e faça um redeploy. Não defina `E2E_TEST_LOGIN` em produção.

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
