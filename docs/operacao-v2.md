# Central COMEX v2 — o que mudou e como operar (26/10/2026)

App: https://comex-omega.vercel.app · Repositório: github.com/erich-web/COMEX · Supabase: projeto `rpe-comex`

## 1. Enviar pautas ficou mais fácil (celular)
- **Colar lista ou texto**: uma linha por assunto (ou texto corrido). O assistente separa as pautas e propõe título, pergunta-chave, tempo, temática e empresa. Tudo entra como rascunho para revisar antes de enviar.
- **Importar PDF, foto ou Word**: o arquivo fica anexado à primeira pauta e o assistente extrai os assuntos (lê PDF e foto de anotações).
- Em cada pauta: botão **"Sugerir pergunta-chave e tempo"** — preenche a pergunta se estiver vazia e lista **o que falta** (números, proposta, responsável, material). Tema de 20+ min sem material é sinalizado.
- Anexar arquivo agora aparece direto no cartão da pauta.

## 2. Compromissos (tarefas)
- Status com cor e rótulo em todas as listas; **troca de status em um toque** (botão "Status" na própria lista) com comentário opcional e "Marcar como concluída".
- No detalhe: faixa **Concluída / Bloqueada / X dias de atraso** e **linha do tempo** das mudanças (quem mudou, quando).
- **Lembrete por e-mail a cada 3 dias** (editável em IA e e-mails) para quem tem pendências, com atrasados em destaque e link direto.

## 3. E-mail da véspera do COMEX
Enviado automaticamente no dia anterior à reunião (8h) para todos os membros ativos: ata anterior (resumo + link), decisões da última reunião e status de execução, compromissos em aberto do destinatário, agenda publicada, botão **Enviar pautas** e as 3 principais análises do agente. O organizador recebe ainda pendências por pessoa.
Cada pessoa pode desligar os e-mails em **Perfil → E-mails do COMEX**.

## 4. Agente de IA
- Modelo padrão `claude-sonnet-5-5` com fallback automático (o antigo `claude-sonnet-4-5` está aposentado pela Anthropic).
- Agora lê o **texto integral das atas** (importado do Drive/OneDrive) — antes só tinha títulos e links.
- **Organização → IA e e-mails** (`/admin/ia`): testar conexão, gerar análises, ver cada chamada à IA (modelo, tempo, erro), status do e-mail/cron, disparos manuais e pré-visualização do resumo da véspera.

## 5. Modo reunião (`/apresentar/...`)
- **Cronômetro regressivo** por pauta/bloco: verde → âmbar nos últimos 20% → vermelho piscando ao estourar; barra de progresso; tecla **P** pausa.
- Cabeçalho mostra **"X min atrasados/adiantados"** em relação à agenda publicada e o **término previsto**.
- Novo slide **"Leitura da ata anterior"** logo após a abertura: resumo, decisões (executadas / em execução) e compromissos ainda abertos daquela reunião, com link para o PDF.
- Encerramento lista as decisões do dia e cobra decisão se não houver nenhuma.

## 6. Atas (arquivo do Wesley)
- Em **Organização → reunião → Ata**: **enviar o PDF/Word** ou **colar o link do OneDrive/Drive** → o texto é extraído e entra na ata (pesquisável, lido pelo agente, mostrado no modo reunião).
- **"Estruturar com IA"** propõe resumo executivo, decisões e compromissos (com responsável e prazo) — você marca o que está certo e registra; decisões com responsável geram tarefa.
- Histórico: as 30 atas de 2026 (jan–jul) foram importadas do Google Drive para o app. A de 14/10 está no OneDrive (link do Wesley) — importar pelo link ou upload.

## Variáveis de ambiente (Vercel → Settings → Environment Variables → Redeploy)
| Variável | Para quê |
|---|---|
| `ANTHROPIC_API_KEY` | Agente, assistente de pautas, estruturação de atas (já existia — confirme em `/admin/ia` → Testar conexão) |
| `RESEND_API_KEY` | Envio de e-mails (conta em resend.com) |
| `EMAIL_FROM` | Remetente, ex.: `COMEX Grupo RPE <comex@gruporpe.com.br>` — exige domínio verificado no Resend; sem ela usa o remetente de teste, que só entrega ao dono da conta |
| `SUPABASE_SERVICE_ROLE_KEY` | Rotina diária automática (Supabase → Settings → API) — só no servidor |
| `CRON_SECRET` | Qualquer string longa; a Vercel usa para chamar `/api/cron/daily` às 8h |

## Rotina automática (8h, horário de São Paulo)
1. Encerra reuniões esquecidas "em andamento".
2. Véspera do COMEX: renova as análises do agente, garante o resumo da última ata e envia o **resumo da véspera**.
3. Demais dias: **lembrete de pendências** a cada N dias (padrão 3).
Tudo registrado em `/admin/ia` (últimos e-mails, chamadas de IA, rotinas).
