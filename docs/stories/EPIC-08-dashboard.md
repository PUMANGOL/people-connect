# EPIC-08 · Dashboard Executivo & Analítica

**Objectivo:** Vista única e actualizada dos KPIs de talento da Pumangol, cruzando dados dos três módulos. Audiência: Responsável DPC, PCE, Comité Executivo.
**Prioridade:** MVP
**Sprint:** 4 (Nov 2026)
**Componentes PRD:** C-08 Analytics Dashboard

---

## S-080 · Dashboard Executivo — Layout Principal

**Esforço:** L (5 pt)
**Dependências:** EPIC-00, EPIC-03, EPIC-05, EPIC-07

### User Story
Como responsável DPC, quero um dashboard unificado que me dê visibilidade instantânea do estado do recrutamento, onboarding e assistente IA num único ecrã.

### Critérios de Aceitação
- [ ] Página `/` (home page) = Dashboard Executivo
- [ ] Secção de stat cards no topo (KPIs globais):
  - Vagas abertas (contagem)
  - Candidatos activos no pipeline (contagem)
  - Colaboradores em onboarding (contagem)
  - Taxa de resolução automática do chatbot (%)
  - Time-to-fill médio (dias)
  - Satisfação média onboarding (score /5)
- [ ] Cada stat card com: ícone, valor actual, variação vs período anterior (seta + %)
- [ ] Cores dos cards: verde (melhoria), vermelho (deterioração), neutro (sem variação significativa)
- [ ] Filtro global: período (últimos 7 dias, 30 dias, 90 dias, este ano)
- [ ] Layout responsivo: 3 colunas em desktop, 2 em tablet, 1 em mobile

---

## S-081 · Painel de Recrutamento no Dashboard

**Esforço:** M (3 pt)
**Dependências:** S-080, EPIC-03

### User Story
Como responsável DPC, quero ver métricas de recrutamento no dashboard para reportar ao PCE sem sair da plataforma.

### Critérios de Aceitação
- [ ] Secção "Recrutamento" com:
  - Gráfico de funil: candidatos por fase do pipeline (horizontal)
  - Gráfico de barras: vagas abertas por direcção
  - Lista das 5 vagas mais urgentes (prazo mais próximo)
  - Taxa de conversão: candidatos → contratados (% e tendência)
- [ ] Time-to-fill: gráfico de linha com evolução mensal
- [ ] Click em qualquer métrica → navega para a página de recrutamento com filtros aplicados

---

## S-082 · Painel de Onboarding no Dashboard

**Esforço:** M (3 pt)
**Dependências:** S-080, EPIC-05

### User Story
Como responsável DPC, quero ver o estado dos onboardings activos no dashboard para identificar atrasos rapidamente.

### Critérios de Aceitação
- [ ] Secção "Onboarding" com:
  - Gráfico donut: colaboradores por estado (não iniciado, em curso, concluído)
  - Progresso médio global (% com barra)
  - Lista de etapas mais atrasadas (top 5) com nome do colaborador
  - Satisfação média nos check-ins (score /5)
- [ ] Timeline: colaboradores concluídos por mês (gráfico de barras)
- [ ] Alertas: colaboradores com onboarding atrasado > 7 dias
- [ ] Click em colaborador → navega para página de progresso

---

## S-083 · Painel do Assistente IA no Dashboard

**Esforço:** M (3 pt)
**Dependências:** S-080, EPIC-07

### User Story
Como responsável DPC, quero ver métricas de uso do assistente virtual para saber se está a resolver dúvidas e onde precisa de mais conteúdo.

### Critérios de Aceitação
- [ ] Secção "Assistente IA" com:
  - Volume de interacções (total e por dia/semana — gráfico de linha)
  - Taxa de resolução automática (% respostas sem escalação)
  - Satisfação média (score /5)
  - Top 10 perguntas mais frequentes
  - Top 5 perguntas sem resposta (oportunidades para novas FAQs)
- [ ] Gráfico de pizza: interacções por direcção (qual tema gera mais perguntas)
- [ ] Indicador de cobertura: % de FAQs actualizadas na Base de Conhecimento

---

## S-084 · Painel de Cruzamento End-to-End

**Esforço:** M (3 pt)
**Dependências:** S-081, S-082, S-083

### User Story
Como PCE, quero ver a jornada completa do colaborador desde o pedido de vaga até à integração plena para entender a eficiência do processo end-to-end.

### Critérios de Aceitação
- [ ] Métrica principal: Tempo médio total pedido de vaga → integração plena (dias)
- [ ] Funnel visual: Vagas → Candidatos → Entrevistas → Contratações → Onboarding concluído
- [ ] Breakdown por direcção: qual direcção é mais rápida/lenta no processo completo
- [ ] Tendência mensal com gráfico de linha
- [ ] Comparação com metas definidas (se configuradas)

---

## S-085 · Exportação de Relatórios Executivos

**Esforço:** M (3 pt)
**Dependências:** S-080 a S-084

### User Story
Como responsável DPC, quero exportar o dashboard como relatório PDF ou Excel para partilhar com o PCE e o Comité Executivo.

### Critérios de Aceitação
- [ ] Botão "Exportar Relatório" no dashboard com dropdown:
  - PDF: relatório formatado com gráficos, branding Pumangol, data de geração
  - Excel: dados brutos tabulados por módulo (vagas, candidatos, onboardings, interacções)
- [ ] Relatório PDF inclui:
  - Capa com logo, título "Relatório de Talento — [Mês/Ano]", data
  - Secção por módulo com KPIs e gráficos
  - Página de resumo executivo
- [ ] Filtros do dashboard reflectidos na exportação
- [ ] Download automático após geração
- [ ] Histórico de relatórios gerados (data, quem gerou)

---

## S-086 · Alertas e Notificações do Dashboard

**Esforço:** M (3 pt)
**Dependências:** S-080

### User Story
Como gestor DPC, quero receber alertas quando métricas críticas mudam para agir proactivamente.

### Critérios de Aceitação
- [ ] Secção "Alertas" no dashboard com lista de itens accionáveis:
  - Vagas com prazo alvo ultrapassado
  - Colaboradores com onboarding atrasado > 7 dias
  - FAQs com avaliação negativa frequente
  - Perguntas do chatbot sem resposta (escaladas)
  - Direcções sem owner de conhecimento
- [ ] Cada alerta com: tipo (ícone), descrição, data, acção (link para resolver)
- [ ] Contador de alertas no ícone de notificações da TopNav
- [ ] Alertas dismissíveis (marcar como lido / resolvido)
- [ ] Ordenação: mais recentes primeiro, agrupados por tipo

---

## S-087 · Notificações In-App & Email

**Esforço:** L (5 pt)
**Dependências:** S-086

### User Story
Como utilizador da plataforma, quero receber notificações dentro da plataforma e por email para eventos importantes.

### Critérios de Aceitação
- [ ] Sistema de notificações in-app:
  - Bell icon na TopNav com badge de contagem
  - Dropdown com lista de notificações (últimas 20)
  - Cada notificação: ícone tipo, mensagem, tempo relativo, link de acção
  - Marcar como lida individual / marcar todas como lidas
- [ ] Tipos de notificações:
  - Nova vaga criada (para gestor)
  - Candidato movido de fase
  - Entrevista agendada
  - Parecer de entrevista pendente
  - Novo colaborador em onboarding
  - Etapa de onboarding atrasada
  - Check-in 30/60/90 dias a aproximar
  - FAQ reportada / desactualizada
  - Pergunta do chatbot escalada
- [ ] Email (futuro — via Microsoft Graph API Mail.Send):
  - Template de email HTML com branding Pumangol
  - Retry com backoff exponencial (1s → 2s → 4s, máx 3 tentativas)
  - Opt-out por tipo de notificação
- [ ] Persistência em tabela `notificacoes` do Neon DB
