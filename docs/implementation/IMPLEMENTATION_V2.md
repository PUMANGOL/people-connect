# Registo de Implementacao - Plataforma DPC v2.0

## Finalidade

Este documento e o registo tecnico da implementacao da especificacao v2.0. Complementa o [backlog v2.0](../../EPICS_AND_STORIES.md), os ADRs em `docs/architecture/` e o historico Git. Deve ser actualizado em cada entrega relevante.

## Referencia e ambito

- Fonte funcional: `PROMPT_Claude_Code_Implementacao_v2.0.md`, recebido em 23-07-2026.
- Ambito: isolamento do assistente, welcome flow, reorganizacao de colaborador e admin, recrutamento simplificado e redesign global.
- Fora de ambito: funcionalidades nao especificadas no documento de origem.

## Baseline tecnico (23-07-2026)

| Area | Estado observado | Implicacao v2.0 |
|---|---|---|
| Frontend | React 19, Vite 6, TypeScript, Tailwind CSS 4 e Zustand. | Manter componentes e servicos por dominio. |
| Backend | Netlify Functions e PostgreSQL Neon. | Todas as novas entidades requerem migration e autorizacao no servidor. |
| Autenticacao | JWT em `sessionStorage`, com suporte MSAL. | Nunca gravar tokens ou dados pessoais em `localStorage`. |
| Assistente | Sessao activa no browser e historico no backend. | A sessao deve ser associada ao utilizador e validada no backend. |
| Design | Componentes UI proprios e `lucide-react`. | Tokens centralizados sao a primeira entrega visual. |

## Decisoes de implementacao

1. **Privacidade do chat:** `user_id` vem da sessao autenticada no servidor; parametros recebidos do cliente nunca concedem acesso por si so. A chave de sessao no browser inclui o identificador do utilizador e e removida no logout.
2. **Persistencia:** dados de negocio, progresso, quiz e configuracao pertencem a PostgreSQL. O browser conserva apenas estado efemero nao sensivel quando necessario.
3. **Migrations:** cada migration e aditiva, reversivel quando razoavel e acompanhada de indexes e constraints necessarios.
4. **Compatibilidade:** rotas removidas sao redireccionadas durante a transicao quando isso nao cria ambiguidades de permissao.
5. **Design:** verde e vermelho Pumangol serao acentos de marca e estados, sobre base clara com contraste WCAG AA.

## Diario de entregas

| Data | Entrega | Evidencia | Estado |
|---|---|---|---|
| 23-07-2026 | Backlog v2.0 e registo tecnico criados. | `EPICS_AND_STORIES.md`, este documento. | Concluida |
| 23-07-2026 | EPIC 1 (stories 1.1-1.3): isolamento do assistente por `user_id`. | `netlify/functions/chat-sessoes.ts`, `netlify/functions/_shared/agent/loop.ts`, `src/pages/AiAssistant.tsx`. `npm run typecheck` e `npm run build` sem erros. | Concluida |
| 24-07-2026 | Story 6.1: tokens de design v2.0 (verde+vermelho Pumangol). | `src/index.css`, `CLAUDE.md`. `npm run typecheck` e `npm run build` sem erros. | Concluida |
| 24-07-2026 | EPIC 6 (stories 6.2-6.7): fecho do redesign sobre a base re-skinada. | `src/index.css` (reduced-motion), `src/components/ui/data-table.tsx` (zebra), `DashboardSemanalPage.tsx` (vermelho Pumangol), gradientes/tints do chat. Build/typecheck OK. | Concluida (validacao visual desktop/mobile pendente) |
| 24-07-2026 | Migration 011 + EPICs 2, 3, 5 (maioria) e 4.1/4.5. | Migration 011; 7 funcoes backend; servico `onboarding-v2`; VideoGate/QuizEngine/WelcomeGuard; WelcomeFlow; paginas colaborador (documentos, submissoes) e admin (quiz, videos, evolucao, documentos, documentos-exigidos); Sidebar/App.tsx; lista real de colaboradores; "Criar como Novo Colaborador". Build/typecheck OK. | Concluida (parcial nas stories abaixo) |

## Estado consolidado e trabalho pendente (24-07-2026)

**Concluido e a compilar:** EPIC 1 (isolamento chat); EPIC 6 (redesign verde+vermelho); EPIC 2 completo (welcome flow, quiz, videos, guard, admin); EPIC 3.1/3.3/3.4; EPIC 4.1/4.5; EPIC 5.3/5.4/5.5/5.6/5.7.

### Provisionamento de contas + motor de instancia de trilho (24-07-2026)

Entregue (fecha o fluxo end-to-end):
- **Provisionamento de conta**: `POST /api/colaboradores` cria (ou reutiliza) a linha em `utilizadores` (perfil `novo_colaborador`, password bcrypt via pgcrypto), liga `colaboradores.utilizador_id`, e devolve as credenciais geradas (email derivado do nome se omitido) apenas quando a conta e nova. A `CandidatosPage` ("Criar como Novo Colaborador") e a `Onboarding` (novo colaborador) mostram as credenciais.
- **Motor de instancia**: `POST /api/colaboradores/:id/atribuir-trilho` copia o template para uma instancia imutavel (`is_template=false`), replica as etapas e gera `progresso_onboarding` sequencial (1a etapa em curso, restantes pendentes); reatribuir limpa a instancia/progresso anteriores. Editar o template nao afecta instancias ja atribuidas.
- **Meu Trilho real**: `GET /api/colaboradores/meu-trilho` resolve o colaborador por `utilizador_id` e devolve trilho + etapas + progresso; `PATCH /api/colaboradores/etapa/:id/concluir` conclui e desbloqueia a etapa seguinte, marcando o onboarding como concluido no fim.
- **Backend `trilhos.ts`**: CRUD de templates + etapas, duplicar. **`colaboradores.ts`**: agora com `requireAuth`, editar (PATCH) e remover (DELETE).
- **Frontend**: `Onboarding` (criar+credenciais, atribuir trilho, remover, filtros), `TrilhosPage` (CRUD, categoria, reordenar, duplicar), `MeuTrilhoPage` (dados reais + concluir etapa).

**Pendente (nao bloqueia o fluxo principal):**
- **Upload binario para SharePoint/Graph** na submissao: hoje regista nome + estado; falta o envio do ficheiro (o endpoint `/documents/upload` e stub no repo).
- **EPIC 4.2/4.3/4.4**: alinhar o import do Dashboard Semanal a aba `Candidatos` e simplificar estados para Em analise/Aprovado/Rejeitado (hoje usa o pipeline granular existente).
- **Modal de edicao de dados do colaborador** na UI (o `PATCH` ja existe na API).
- **Validacao runtime**: aplicar a migration 011 e testar contra BD Neon real (nao verificavel neste ambiente).

**Aplicar a migracao (obrigatorio antes de usar):** `npm run db:migrate` (idempotente; inclui seeds de exemplo).

## EPIC 6 - Fecho do redesign (stories 6.2-6.7)

O remapeamento de tokens da story 6.1 re-skina automaticamente as stories 6.2 (sidebar), 6.3 (header) e a maior parte da 6.7 (cor global), porque a estrutura ja existia (sidebar colapsavel + menu mobile, header com utilizador/notificacoes/logout, framer-motion, toasts, skeletons). Ajustes especificos entregues:
- 6.6: guard global `@media (prefers-reduced-motion: reduce)` em `index.css`.
- 6.4: zebra striping (`even:bg-surface-secondary/40`) + hover reforcado na `DataTable`; componentes base ja assentam em tokens.
- 6.5: graficos usam `--chart-*` (verde/vermelho/teal/ambar); `DashboardSemanalPage` alinha a prioridade Alta ao vermelho Pumangol `#CB2B2B`.
- Limpeza de hexes fixos gold/navy visiveis (gradientes do avatar DPC, tint do botao de envio) para verde; foreground escuro sobre o verde de acento por contraste (AA).

Pendente (nao bloqueante): tints de sombra `rgba(gold/navy)` de baixissima opacidade (<=0.12) em classes arbitrarias dos blocos GenUI, e a validacao visual ecra a ecra em desktop e mobile (recomenda-se `npm run dev`).

## EPIC 6 - Story 6.1 (detalhe)

Decisao de paleta: **verde Pumangol como cor primaria** sobre base clara, **vermelho carregado** reservado a alertas e accoes destrutivas, **teal/verde-agua** como complementar (info e graficos). Substitui o antigo par Navy+Gold.

Estrategia de aplicacao (baixo risco): manter os nomes das escalas Tailwind (`navy`, `gold`) usados em ~782 ocorrencias por 41 ficheiros e **redefinir apenas os valores** em `src/index.css`. Assim toda a plataforma re-skina para a nova paleta sem renomear classes, cobrindo grande parte da story 6.7 (cor).

Mapeamento das escalas:
- `navy` -> verde de marca (sidebar, primario, titulos e texto escuro): 700 `#1A5334` (sidebar), 900 `#0C2A1B` (tinta).
- `gold` -> verde de acento vivo (CTAs, indicadores activos, focus): 500 `#17B85F`.
- `error`/`destructive` -> vermelho carregado: 500 `#CB2B2B`, 600 `#A81E1E`.
- `info` -> teal complementar: 500 `#0EA5A5`.
- Variaveis shadcn (`:root` e `.dark`), `--chart-*`, `--sidebar-*` alinhadas; base `--background` `#F5F9F6`.
- Hexes fixos dos blocos custom (agente, login) e gradientes do avatar DPC (`AiAssistant.tsx`, `MessageBubble.tsx`) convertidos de gold/navy para verde.

Pendente do EPIC 6 (nas stories 6.2-6.7): tints de sombra `rgba(navy/gold)` de baixa opacidade em classes arbitrarias, estrutura de componentes (skeletons, zebra striping, estados de foco normalizados), drag-and-drop e validacao visual desktop/mobile ecra a ecra.

## EPIC 1 - Isolamento do assistente (detalhe)

Camada de dados (servidor):
- `chat-sessoes.ts` passa a exigir `requireAuth` e usa `user.id` da sessao autenticada; o parametro `utilizador_id` do cliente e ignorado. A leitura de mensagens valida a posse da sessao (`EXISTS ... utilizador_id = user.id`) e o `PATCH` so actua sobre sessoes do proprio utilizador.
- `_shared/agent/loop.ts` valida, antes de responder num turno com `sessao_id` existente, que a sessao pertence ao utilizador autenticado; caso contrario levanta erro.

Camada de estado (cliente):
- `AiAssistant.tsx` particiona a chave de sessao por utilizador (`pumangol_chat_sessao_id:<user_id>`), migra de `localStorage` para `sessionStorage` e limpa as mensagens em memoria sempre que `user.id` muda (efeito dedicado). `novaConversa` remove apenas a chave do utilizador actual.

Story 1.4 - checklist E2E manual (sem infra de testes automatizados no projecto):
1. Login como admin, usar o assistente e enviar mensagens; confirmar historico visivel.
2. Logout e login como novo colaborador (mesma aba); o chat abre vazio (sem historico do admin).
3. O colaborador envia mensagens; logout e novo login como admin; o admin ve apenas o seu historico.
4. Dois colaboradores distintos nunca veem as mensagens um do outro (validado tambem no servidor pela posse da sessao).

## Protocolo de verificacao por story

1. Validar comportamento no perfil RH e no perfil de novo colaborador quando aplicavel.
2. Executar verificacao de tipos e build de producao.
3. Validar visualmente desktop e mobile para ecras alterados.
4. Registar migration, rotas, API e riscos nesta pagina.
5. Criar um commit atomico por story quando o repositorio estiver pronto para esse ciclo.

## Riscos e dependencias

| Item | Impacto | Mitigacao |
|---|---|---|
| URLs externas de video | Deteccao precisa de 90% varia por fornecedor. | Adaptadores por fornecedor e fallback documentado para URL directa. |
| SharePoint/Graph | Upload e permissoes dependem de configuracao externa. | Preservar fluxo existente e validar configuracao antes de activacao. |
| Excel de origem | Cabecalhos e tipos podem variar. | Validacao explicita da aba e cabecalhos, com erros accionaveis. |
| Dados existentes | Novos campos requerem valores de transicao. | Migrations com defaults seguros e plano de backfill quando necessario. |
