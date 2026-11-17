# EPIC-03 · Módulo de Recrutamento

**Objectivo:** Substituir o Excel partilhado da DPC como sistema de registo e fluxo de trabalho do processo de recrutamento. Cobrir o ciclo completo desde a abertura de uma vaga até ao registo da contratação, com geração automática de relatórios pós-entrevista.
**Prioridade:** MVP — módulo core, Sprint 1
**Sprint:** 1 (Jul-Ago 2026)
**Componentes PRD:** C-01 Vacancy Manager, C-02 Pipeline Engine, C-03 Interview & Report Generator

---

## S-030 · Página de Listagem de Vagas

**Esforço:** L (5 pt)
**Dependências:** EPIC-00, EPIC-01

### User Story
Como especialista de recrutamento, quero ver todas as vagas abertas numa vista organizada para ter visibilidade total do estado do recrutamento.

### Critérios de Aceitação
- [ ] Página `/recrutamento` com lista de vagas em formato tabela e cards (toggle view)
- [ ] Colunas: título, direcção, nº posições, estado (badge colorido), data abertura, prazo alvo, owner, nº candidatos
- [ ] Filtros: por estado, por direcção, por owner
- [ ] Ordenação por data, prazo, nº candidatos
- [ ] Search por título da vaga
- [ ] Botão "Nova Vaga" (abre modal/drawer)
- [ ] Indicador visual de vagas em atraso (prazo_alvo ultrapassado)
- [ ] Estado vazio: "Nenhuma vaga registada. Cria a primeira vaga para começar."
- [ ] Paginação com 10/25/50 items por página

---

## S-031 · Formulário de Criação/Edição de Vaga

**Esforço:** M (3 pt)
**Dependências:** S-030

### User Story
Como especialista de recrutamento, quero criar e editar vagas com campos estruturados para ter dados consistentes em todas as vagas.

### Critérios de Aceitação
- [ ] Modal ou drawer com formulário completo:
  - Título do cargo (obrigatório)
  - Direcção (select da lista de direcções)
  - Justificativa (textarea: substituição, expansão, novo projecto)
  - Número de posições (input numérico, default 1)
  - Prazo alvo (date picker)
  - Requisitos (rich text ou textarea)
  - Owner/Responsável (select da equipa DPC)
- [ ] Validação client-side: campos obrigatórios, prazo no futuro
- [ ] Ao criar: estado inicial = "aberta", data_abertura = hoje
- [ ] Ao editar: log de alterações em audit_log
- [ ] Feedback: toast de sucesso + redirect para detalhe da vaga
- [ ] Botão "Cancelar Vaga" com confirmação (motivo obrigatório)

---

## S-032 · Página de Detalhe da Vaga + Pipeline Kanban

**Esforço:** XL (8 pt)
**Dependências:** S-031

### User Story
Como especialista de recrutamento, quero ver o pipeline de candidatos de uma vaga num board Kanban para visualizar rapidamente em que fase cada candidato está.

### Critérios de Aceitação
- [ ] Página `/recrutamento/vagas/:id` com header da vaga (título, estado, direcção, datas, owner)
- [ ] Board Kanban com colunas representando as fases do pipeline:
  - Triagem de CVs → 1ª Entrevista DPC → 2ª Entrevista Área → Proposta → Aceitação → Contratação
- [ ] Cada candidato como card no board: nome, data entrada, badge de fase
- [ ] Drag-and-drop para mover candidatos entre fases
- [ ] Ao mover: modal de confirmação com campo para nota opcional
- [ ] Histórico de movimentos preservado com timestamps
- [ ] Contagem de candidatos por coluna
- [ ] Toggle para vista lista (alternativa ao Kanban)
- [ ] Botão "Adicionar Candidato" em cada coluna
- [ ] Acções rápidas no card: ver perfil, agendar entrevista, rejeitar

---

## S-033 · Registo e Gestão de Candidatos

**Esforço:** M (3 pt)
**Dependências:** S-032

### User Story
Como especialista de recrutamento, quero registar candidatos associados a uma vaga com os seus dados básicos e CV.

### Critérios de Aceitação
- [ ] Formulário de candidato:
  - Nome completo (obrigatório)
  - Email (obrigatório, validação formato)
  - Telefone (opcional)
  - CV (upload de ficheiro: PDF/DOCX, max 10MB)
  - Origem (select: publicação, referenciação, headhunter, candidatura espontânea)
  - Notas (textarea livre)
- [ ] Ao criar: estado_pipeline = "triagem_cvs", data_entrada = hoje
- [ ] Página de perfil do candidato: dados + histórico de fases + entrevistas + documentos
- [ ] Lista global de candidatos `/recrutamento/candidatos` com filtros por vaga, estado, origem
- [ ] Bulk actions: mover vários candidatos, exportar lista

---

## S-034 · Motor de Pipeline (Transições de Estado)

**Esforço:** M (3 pt)
**Dependências:** S-032

### User Story
Como sistema, quero validar transições de fase dos candidatos para garantir que o processo de recrutamento segue o fluxo definido.

### Critérios de Aceitação
- [ ] Mapa de transições permitidas definido em `src/lib/constants.ts`:
  ```
  triagem_cvs → primeira_entrevista_dpc | rejeitado
  primeira_entrevista_dpc → segunda_entrevista_area | rejeitado
  segunda_entrevista_area → proposta | rejeitado
  proposta → aceitacao | rejeitado
  aceitacao → contratacao
  contratacao → transicao_onboarding
  ```
- [ ] Transições não permitidas bloqueadas com toast de erro
- [ ] "Rejeitado" acessível de qualquer fase (com motivo obrigatório)
- [ ] Cada transição regista: fase_anterior, fase_nova, timestamp, utilizador, nota
- [ ] Histórico completo visível no perfil do candidato (timeline visual)

---

## S-035 · Agendamento e Registo de Entrevistas

**Esforço:** L (5 pt)
**Dependências:** S-033

### User Story
Como especialista de recrutamento, quero agendar e registar entrevistas com avaliação estruturada para ter dados uniformes sobre cada candidato.

### Critérios de Aceitação
- [ ] Botão "Agendar Entrevista" no perfil do candidato
- [ ] Formulário de entrevista:
  - Tipo/Fase: 1ª DPC, 2ª Área, Painel (select)
  - Data e hora (datetime picker)
  - Entrevistador (text input ou select)
  - Local/link (text)
- [ ] Após a entrevista, formulário de parecer:
  - Avaliação estruturada (1-5) em dimensões: Técnico, Cultural, Motivação, Comunicação
  - Parecer qualitativo (textarea)
  - Recomendação: Avançar, Rejeitar, Segunda Opinião (radio)
- [ ] Vista calendário de entrevistas em `/recrutamento/entrevistas`
- [ ] Lista de entrevistas agendadas no detalhe da vaga
- [ ] Notificação automática ao entrevistador (email via Graph API — futuro)

---

## S-036 · Geração Automática de Relatório Pós-Entrevista

**Esforço:** M (3 pt)
**Dependências:** S-035

### User Story
Como especialista de recrutamento, quero que o sistema gere automaticamente um relatório formatado após cada entrevista para evitar reescrever informação em Word.

### Critérios de Aceitação
- [ ] Após submissão do parecer, gera relatório com:
  - Dados da vaga (título, direcção)
  - Dados do candidato (nome, origem)
  - Data e tipo de entrevista
  - Avaliação numérica por dimensão (gráfico radar ou barras)
  - Parecer qualitativo
  - Recomendação
  - Assinatura do entrevistador
- [ ] Exportação para PDF (client-side, sem dependência de servidor)
- [ ] Relatório acessível no perfil do candidato e no detalhe da vaga
- [ ] Template do relatório consistente e com branding Pumangol

---

## S-037 · Transição Candidato → Colaborador (Ponte Recrutamento-Onboarding)

**Esforço:** L (5 pt)
**Dependências:** S-034, EPIC-05

### User Story
Como especialista de recrutamento, quero registar a contratação de um candidato e que o sistema crie automaticamente o registo de colaborador com o trilho de onboarding atribuído.

### Critérios de Aceitação
- [ ] Ao mover candidato para "Contratação":
  - Modal com campos adicionais: função formal, direcção de afectação, data de admissão
  - Selecção do trilho de onboarding (automático por função, override manual possível)
- [ ] Sistema cria:
  - Registo `Colaborador` com `candidato_id_origem` linkado
  - Registo `ProgressoOnboarding` para cada etapa do trilho seleccionado
  - Link único (UUID token) para acesso do novo colaborador
- [ ] Vaga actualizada: se todas as posições preenchidas, estado → "fechada"
- [ ] Email automático ao novo colaborador com link de acesso (futuro, via Graph API)
- [ ] Entrada no audit_log com todos os dados da transição

---

## S-038 · Exportação de Dados e Mapas de Recrutamento

**Esforço:** M (3 pt)
**Dependências:** S-030 a S-036

### User Story
Como responsável DPC, quero exportar mapas e relatórios do recrutamento para partilhar com o PCE sem depender da plataforma.

### Critérios de Aceitação
- [ ] Exportação da lista de vagas para Excel (CSV/XLSX)
- [ ] Exportação do pipeline de uma vaga para Excel
- [ ] Exportação de relatório semanal agregado: vagas por estado, candidatos por fase, time-to-fill
- [ ] Exportação para PDF do relatório consolidado
- [ ] Filtros aplicados são reflectidos na exportação
- [ ] Botão de exportação com dropdown (Excel / PDF)
