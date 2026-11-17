# EPIC-10 · Melhorias MVP & Plataforma 100% Funcional

**Objectivo:** Após o primeiro deploy no Netlify, corrigir bugs, completar páginas em falta, definir claramente os 2 perfis de utilizador (RH Admin + Novo Colaborador), rebranding e preparar plataforma para uso real.
**Prioridade:** CRÍTICA — Bloqueia adopção
**Sprint:** Sprint 5 (pós-deploy)

---

## S-100 · Rebranding: Nome, Logo e Metadata

**Esforço:** S (2 pt)
**Dependências:** —

### User Story
Como responsável DPC, quero que a plataforma tenha a identidade visual e nomenclatura correcta da Pumangol para transmitir profissionalismo ao PCE e Comité Executivo.

### Critérios de Aceitação
- [ ] Nome oficial da plataforma: **"Plataforma Digital de Recrutamento: Onboarding & IA"**
- [ ] Aplicar em:
  - `<title>` do HTML (index.html)
  - Meta description e OG tags
  - Página de login (título grande)
  - Sidebar (rebranding "Pumangol / Plataforma DPC" → nome oficial)
  - Rodapé se existir
- [ ] Logo Pumangol (SVG/PNG oficial) em:
  - Sidebar header (substituindo o "P" quadrado dourado actual)
  - Página de login
  - `favicon.ico` e `apple-touch-icon.png`
  - Header do PDF de relatórios exportados
- [ ] Ficheiro `public/pumangol-logo.svg` e `public/pumangol-logo.png` (versão horizontal para header)
- [ ] Substituir placeholder da barra de pesquisa da TopNav por "Pesquisar na plataforma..."
- [ ] Update do `README.md` com nome oficial

---

## S-101 · Rework do Modelo de Perfis (2 perfis, não 5)

**Esforço:** M (3 pt)
**Dependências:** EPIC-02

### User Story
Como responsável DPC, quero que a plataforma tenha apenas 2 perfis claramente definidos para simplificar governance e evitar confusão de acessos.

### Critérios de Aceitação
- [ ] **Perfil 1 — RH Admin (`rh_admin`)**: acesso total
  - Dashboard, Recrutamento (Vagas + Pipeline + Candidatos + Entrevistas), Onboarding (Trilhos + Colaboradores), Assistente IA, Base de Conhecimento, Escalações, Audit Log, Definições
- [ ] **Perfil 2 — Novo Colaborador (`novo_colaborador`)**: acesso restrito ao trilho pessoal
  - Página inicial: o seu progresso de onboarding (checklist de etapas)
  - Assistente Virtual (chatbot IA)
  - Sem acesso a Recrutamento, Dashboard, Base de Conhecimento (editor), Audit Log
- [ ] **REMOVER completamente** o perfil `colaborador_activo`
  - Remover rota pública `/chat` do App.tsx
  - Remover componente `PublicRoute.tsx`
  - Remover referências em `permissions.ts`, `types.ts`, `Login.tsx`
- [ ] **REMOVER** também os perfis `gestor_talento` e `owner_conhecimento` do MVP (podem voltar em V2)
  - Simplificar `PERMISSIONS` map em `permissions.ts` para conter apenas `rh_admin` + `novo_colaborador`
- [ ] Sidebar do Novo Colaborador: apenas mostra "Meu Onboarding" + "Assistente Virtual"
- [ ] RoleGuard nas rotas admin apenas aceita `rh_admin`
- [ ] Login redirects:
  - `rh_admin` → `/` (Dashboard)
  - `novo_colaborador` → `/meu-onboarding/:token` (ou `/onboarding` se autenticado por SSO)

---

## S-102 · Login Funcional & SSO Microsoft Entra ID

**Esforço:** L (5 pt)
**Dependências:** S-101

### User Story
Como utilizador da Pumangol, quero fazer login com a minha conta Microsoft corporativa (SSO) para aceder à plataforma sem passwords adicionais.

### Critérios de Aceitação
- [ ] Configurar MSAL.js real (não mock) com:
  - `VITE_AZURE_CLIENT_ID` — App registration no Azure AD Pumangol
  - `VITE_AZURE_TENANT_ID`
  - `VITE_AZURE_REDIRECT_URI` — URL Netlify + localhost:3000
- [ ] Botão "Entrar com Microsoft" na página de login funcional
- [ ] Após SSO: mapear email/grupo AD → perfil na tabela `utilizadores` (Neon)
  - Se email pertence ao grupo `dpc-admins@pumangol.ao` → `rh_admin`
  - Se colaborador existe em `colaboradores` com link_token válido → `novo_colaborador`
  - Caso contrário: acesso negado ("Contacta a DPC para provisionar acesso")
- [ ] Novo colaborador sem SSO: acesso via link único UUID (`/meu-onboarding/:token`) enviado por email na admissão
- [ ] Dev mode continua a funcionar (`VITE_AUTH_MODE=dev`) mas apenas expõe `rh_admin` e `novo_colaborador` no selector
- [ ] Logout limpa store, chama `msalInstance.logoutRedirect()`, redireciona para `/login`
- [ ] Session timeout (60min) → redirect para login com toast informativo
- [ ] Documentação: passos para o admin IT Pumangol criar o App Registration Azure

---

## S-103 · Fix 404 & Criar Páginas em Falta (Definições, Analítica)

**Esforço:** M (3 pt)
**Dependências:** —

### User Story
Como utilizador, quero que todos os links no sidebar levem a páginas funcionais (não 404) para ter uma experiência fluida.

### Critérios de Aceitação
- [ ] Diagnosticar todos os links do Sidebar que dão 404
- [ ] Criar página **`/analitica`** (`src/pages/Analitica.tsx`):
  - Dashboard analítico focado em métricas de recrutamento e onboarding
  - Reutiliza componente `RecrutamentoAnalytics.tsx` já existente
  - Adicionar secção de analítica de onboarding (etapas mais atrasadas, tempo médio por trilho)
  - Adicionar analítica do chatbot (interacções, taxa resolução, top perguntas)
- [ ] Criar página **`/configuracoes`** (`src/pages/configuracoes/DefinicoesPage.tsx`):
  - Tabs: **Perfil** | **Preferências** | **Direcções** | **Trilhos padrão**
  - Perfil: nome, email, foto (readonly, vem do SSO)
  - Preferências: tema (claro/escuro), idioma (PT-AO fixo por agora), notificações email opt-in por tipo
  - Direcções: lista das 7 direcções Pumangol com FAQ owner por cada
  - Trilhos: link para `/onboarding/trilhos`
- [ ] Actualizar `App.tsx` com as novas rotas
- [ ] Actualizar `permissions.ts` com resources `configuracoes` e `analitica`
- [ ] Página `/onboarding/formacoes` — decidir: criar ou remover do Sidebar (recomendação: remover do MVP, feature V2)
- [ ] Verificar que **todos** os links do Sidebar respondem 200 (não 404)

---

## S-104 · Fix Chatbot: Interface Não Abre em Estado Inicial

**Esforço:** M (3 pt)
**Dependências:** EPIC-07

### User Story
Como utilizador, quero que ao clicar em "Assistente" o chatbot abra imediatamente com uma mensagem de boas-vindas e pronto para receber a primeira pergunta.

### Critérios de Aceitação
- [ ] Investigar bug: página `/assistente` fica em branco / não responde ao clique
  - Verificar erros no console do browser (provavelmente relacionado com `crypto.randomUUID()` ou `motion/react`)
  - Verificar se a página está a montar correctamente
- [ ] Chat inicial deve mostrar:
  - Mensagem de boas-vindas do assistente
  - 4 sugestões rápidas visíveis (chips clicáveis)
  - Input activo e focável
- [ ] Clique em sugestão rápida → envia pergunta automaticamente
- [ ] Tratamento de estado vazio: se `MOCK_FAQS` vazio ou API IA falha → mostrar fallback claro em vez de tela branca
- [ ] Testar responsivo em mobile (chat ocupa 100% viewport, input não escondido pelo teclado)
- [ ] Adicionar `try/catch` no `handleSend` para nunca deixar o UI em estado indeterminado

---

## S-105 · Integração Copilot Microsoft (Assistente Virtual)

**Esforço:** L (5 pt) — Investigação + Implementação
**Dependências:** S-104

### User Story
Como responsável DPC, quero integrar o Microsoft 365 Copilot / Copilot Studio como assistente virtual da plataforma para aproveitar o investimento no ecossistema Microsoft e evitar manter um chatbot próprio.

### Critérios de Aceitação
- [ ] **Fase 1 — Investigação (spike de 4h):**
  - Avaliar 3 opções:
    1. **Copilot Studio (ex-Power Virtual Agents)**: criar bot dedicado ligado a FAQs, embutido via iframe/webchat SDK
    2. **Microsoft 365 Copilot Chat embedded**: usar o Copilot corporativo como iframe (requer licença M365 Copilot por utilizador)
    3. **Azure OpenAI Service**: usar GPT-4 hosted na Azure com system prompt DPC (mais flexível, custo por token)
  - Comparativo: custo, tempo de setup, capacidade RAG sobre FAQs Pumangol, controlo de resposta, compliance com dados internos
  - Recomendação técnica documentada em `docs/architecture/ADR-005-assistente-virtual-microsoft.md`
- [ ] **Fase 2 — Implementação:**
  - Criar `MicrosoftCopilotProvider` implementando `AIProvider` interface (já abstraída em `ai-provider.ts`)
  - Auth via MSAL scope adequado (Bot Framework ou Azure OpenAI resource)
  - Manter fallback para `MockAIProvider` em dev
  - Configuração via `VITE_AI_PROVIDER=microsoft_copilot` + `VITE_COPILOT_BOT_ID` ou `VITE_AZURE_OPENAI_ENDPOINT`
- [ ] Preservar guardrails: só responde com base em FAQs Pumangol, fallback → `dpc@pumangol.ao`
- [ ] Preservar interface do chat: sem alterações UX mesmo mudando o provider

---

## S-106 · Fix Persistência de Entrevistas + Geração de Relatório PDF

**Esforço:** L (5 pt)
**Dependências:** EPIC-01 (Neon DB), EPIC-04

### User Story
Como gestor de talento, quero que ao registar uma entrevista os dados fiquem guardados na base de dados e possa exportar um relatório PDF do parecer para partilhar com a área contratante.

### Critérios de Aceitação
- [ ] **Persistência (guardar dados):**
  - Ligar `EntrevistasPage.tsx` ao serviço `recrutamento.service.ts` (não usar apenas mock)
  - `POST /api/entrevistas` cria registo na tabela `entrevistas` (Neon DB)
  - `PATCH /api/entrevistas/:id/avaliacao` guarda avaliação (4 dimensões) + parecer + recomendação
  - Actualizar UI com estado optimista + rollback em caso de erro
  - Toast de sucesso: "Entrevista registada e guardada na base de dados"
- [ ] **Relatório PDF:**
  - Instalar `jspdf` + `jspdf-autotable` (ou `@react-pdf/renderer`)
  - Botão "Exportar Relatório" no modal de avaliação da entrevista (após submissão)
  - PDF contém:
    - Cabeçalho: logo Pumangol + título "Relatório de Entrevista"
    - Dados: candidato (nome, vaga, direcção), entrevistador, fase, data
    - Avaliação: 4 dimensões com estrelas (Competência técnica, Fit cultural, Comunicação, Motivação)
    - Recomendação (avancar/reserva/rejeitar) com destaque visual
    - Parecer textual completo
    - Rodapé: data de geração, "Documento confidencial DPC"
  - Nome do ficheiro: `entrevista-{candidato-nome}-{data}.pdf`
  - Download automático ao clicar em "Exportar PDF"
- [ ] Testar com dados reais + mock

---

## S-107 · Relatórios Executivos: Vista + Exportação Multi-Módulo

**Esforço:** L (5 pt)
**Dependências:** EPIC-08

### User Story
Como responsável DPC, quero uma secção dedicada de relatórios com vistas prontas para exportação em PDF/Excel para partilhar com o PCE e Comité Executivo mensalmente.

### Critérios de Aceitação
- [ ] Criar página **`/analitica/relatorios`** (ou substituir a `Analitica.tsx`)
- [ ] Secções (accordion ou tabs):

  **1. Relatório de Recrutamento**
  - KPIs: vagas abertas/fechadas, time-to-fill médio, taxa de conversão, direcções mais activas
  - Gráfico funil do pipeline
  - Lista de vagas com estado + prazo
  - Exportação: PDF (formatado) + Excel (dados brutos)

  **2. Relatório de Onboarding**
  - KPIs: colaboradores em curso, taxa conclusão, tempo médio, satisfação média
  - Gráfico donut: colaboradores por estado
  - Timeline: novos colaboradores por mês
  - Etapas mais atrasadas (top 5)
  - Exportação: PDF + Excel

  **3. Relatório do Assistente IA**
  - KPIs: total interacções, taxa resolução, satisfação, escalações
  - Top 10 perguntas frequentes
  - Top 5 perguntas sem resposta (oportunidades de FAQ)
  - Interacções por direcção
  - Exportação: PDF + Excel

  **4. Relatório End-to-End (opcional MVP)**
  - Tempo médio total: pedido de vaga → integração plena
  - Funil visual: Vagas → Candidatos → Entrevistas → Contratações → Onboarding OK
  - Breakdown por direcção
  - Exportação: PDF

- [ ] Filtro global: período (últimos 7d, 30d, 90d, este ano, custom range)
- [ ] Cada relatório PDF:
  - Capa com logo Pumangol + título + data de geração + período
  - Página de resumo executivo (top 3 insights)
  - Secções com KPIs, gráficos (via `html2canvas` ou `@react-pdf/renderer`), tabelas
  - Rodapé em todas as páginas
- [ ] Excel: uma sheet por módulo, colunas legíveis, sem células mescladas
- [ ] Botão de exportação dropdown: "PDF" ou "Excel"
- [ ] Histórico local: últimos 10 relatórios gerados (data, quem gerou, tipo) — armazenado em `localStorage` MVP, Neon em V2

---

## S-108 · Ligação Real com Neon DB (Frontend → Backend → DB)

**Esforço:** XL (8 pt)
**Dependências:** EPIC-01, Neon DB criada

### User Story
Como plataforma em produção, os dados devem persistir na Neon DB e não em mocks in-memory para que múltiplos utilizadores vejam o mesmo estado.

### Critérios de Aceitação
- [ ] **Decisão arquitectural:** criar Netlify Functions (`/netlify/functions/*`) como backend serverless
  - Vantagem: co-deploy com frontend, mesmo domínio, sem CORS
  - `VITE_NEON_DATABASE_URL` fica **apenas no ambiente do backend** (não exposta ao browser)
- [ ] Criar funções serverless para cada domínio:
  - `netlify/functions/vagas.ts` — CRUD vagas
  - `netlify/functions/candidatos.ts` — CRUD + pipeline moves
  - `netlify/functions/entrevistas.ts` — CRUD + avaliação
  - `netlify/functions/colaboradores.ts` — CRUD onboarding
  - `netlify/functions/faqs.ts` — CRUD FAQs
  - `netlify/functions/chatbot.ts` — RAG + AI provider proxy
  - `netlify/functions/dashboard.ts` — agregações KPIs
- [ ] Middleware de auth JWT (validação token Entra ID)
- [ ] Cliente HTTP (`api.client.ts`) já existe — adaptar baseURL para Netlify Functions
- [ ] Substituir MOCK_* nas páginas por chamadas reais aos serviços
- [ ] Loading + error states adequados em cada página
- [ ] Configurar `netlify.toml` com redirects `/api/*` → `/.netlify/functions/*`
- [ ] Variáveis de ambiente no Netlify (sem prefixo `VITE_` para backend):
  - `DATABASE_URL` (não `VITE_`) — connection string Neon
  - `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`
  - `AI_API_KEY`, `AI_MODEL`
- [ ] `VITE_API_BASE_URL=/api` (relativa, mesma origem)

---

## S-109 · Guardar Trilho Padrão Pumangol na DB

**Esforço:** S (2 pt)
**Dependências:** S-108

### User Story
Como responsável DPC, quero que exista um trilho padrão de onboarding pré-configurado na base de dados para ser atribuído automaticamente aos novos colaboradores.

### Critérios de Aceitação
- [ ] Script SQL de seed (executar no Neon SQL Editor):
  - Trilho "Trilho Genérico Pumangol 90 dias"
  - 6 etapas: Boas-vindas, Cultura e Valores, Conhecimento Direcção, HSE, Imersão Funcional, Check-in 30d
- [ ] Botão "Atribuir trilho" ao criar colaborador cria registos em `progresso_onboarding`
- [ ] Adicionar em `db/migrations/005_seed_trilho_padrao.sql` (novo ficheiro)

---

## S-110 · Netlify Deploy: Config Correcta + Env Vars

**Esforço:** S (2 pt)
**Dependências:** —

### User Story
Como owner do projecto, quero que o deploy no Netlify tenha routing SPA correcto e variáveis de ambiente configuradas para tudo funcionar em produção.

### Critérios de Aceitação
- [ ] Criar `netlify.toml` na raiz com:
  ```toml
  [build]
    command = "npm run build"
    publish = "dist"

  [[redirects]]
    from = "/api/*"
    to = "/.netlify/functions/:splat"
    status = 200

  [[redirects]]
    from = "/*"
    to = "/index.html"
    status = 200
  ```
- [ ] Documentar em `README.md` as env vars a configurar no Netlify UI:
  - `VITE_AI_PROVIDER=mock` (por agora)
  - `VITE_API_BASE_URL=/api`
  - `DATABASE_URL=...` (backend only, sem VITE_)
  - Azure SSO vars quando disponíveis
- [ ] Testar: deploy sem env vars → app carrega mas mostra warnings amigáveis
- [ ] Testar: rotas SPA funcionam sem 404 (ex: refresh em `/recrutamento/vagas`)

---

## Prioridades para 100% Funcional

**P0 — Bloqueador (fazer primeiro):**
- S-100 Rebranding (logo + nome)
- S-101 Simplificar 2 perfis (RH Admin + Novo Colaborador)
- S-103 Fix 404 (Analítica + Definições)
- S-104 Fix Chatbot em branco
- S-110 Netlify config (routing SPA)

**P1 — Essencial (segunda vaga):**
- S-102 Login SSO real
- S-106 Persistência entrevistas + PDF relatório
- S-107 Relatórios exportação

**P2 — Diferenciador:**
- S-105 Integração Copilot Microsoft (spike + implementação)
- S-108 Ligação Neon DB via Netlify Functions
- S-109 Trilho padrão na DB
