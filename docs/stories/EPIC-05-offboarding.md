# EPIC-05 · Módulo de Onboarding (Trilhos por Função)

**Objectivo:** Estruturar a integração de novos colaboradores em trilhos por função, com checklists, conteúdos por direcção e visibilidade de progresso. Transição automática desde o módulo de recrutamento.
**Prioridade:** MVP
**Sprint:** 2 (Set 2026)
**Componentes PRD:** C-04 Onboarding Track Manager

---

## S-050 · Gestão de Trilhos de Onboarding (Templates)

**Esforço:** L (5 pt)
**Dependências:** EPIC-01 S-012

### User Story
Como responsável DPC, quero definir trilhos de onboarding por função para padronizar a experiência de integração.

### Critérios de Aceitação
- [ ] Página `/onboarding/trilhos` com lista de trilhos existentes
- [ ] Cada trilho mostra: nome, função, nº etapas, duração estimada, versão, estado (activo/inactivo)
- [ ] Criar novo trilho:
  - Nome (ex: "Trilho Engenharia 90 dias")
  - Função associada (ex: "Engenheiro de Operações")
  - Duração estimada (dias úteis)
- [ ] Editor de etapas (ordenável por drag-and-drop):
  - Nome da etapa
  - Tipo: documental, conversacional, formação, administrativo, misto
  - Duração estimada (dias)
  - Descrição / conteúdo
  - Referência a conteúdos (URL, documento, link LMS)
  - Critério de conclusão (texto descritivo)
- [ ] Versionamento: ao editar um trilho com colaboradores em curso, cria nova versão sem afectar os existentes
- [ ] Trilhos iniciais sugeridos pelo PRD:
  - Boas-vindas e contexto (1 dia, conversacional)
  - Cultura e valores Pumangol (2 dias, documental)
  - Conhecimento da direcção (3-5 dias, conversacional)
  - Treinos obrigatórios HSE/Segurança (1 semana, formação)
  - Imersão funcional (2-3 semanas, misto)
  - Check-in 30/60/90 dias (ao longo, conversacional)

---

## S-051 · Atribuição Automática de Trilho ao Novo Colaborador

**Esforço:** M (3 pt)
**Dependências:** S-050, EPIC-03 S-037

### User Story
Como sistema, quero atribuir automaticamente o trilho de onboarding correcto quando um candidato é contratado, com base na sua função.

### Critérios de Aceitação
- [ ] Ao criar Colaborador (transição do recrutamento):
  - Sistema procura trilho activo para a função do colaborador
  - Se encontrado: atribui automaticamente
  - Se não encontrado: flag para atribuição manual + alerta à DPC
- [ ] Cria registos `progresso_onboarding` para cada etapa do trilho (estado: pendente)
- [ ] Primeira etapa marcada como "em_curso" automaticamente
- [ ] Data de início de cada etapa calculada com base na duração das etapas anteriores

---

## S-052 · Dashboard de Onboarding (Vista Admin)

**Esforço:** L (5 pt)
**Dependências:** S-051

### User Story
Como gestor de talento DPC, quero ver todos os colaboradores em onboarding com o seu progresso para intervir em etapas atrasadas.

### Critérios de Aceitação
- [ ] Página `/onboarding` com lista de colaboradores em onboarding activo
- [ ] Cada colaborador mostra: nome, função, direcção, data admissão, trilho, % progresso (barra), dias restantes
- [ ] Filtros: por direcção, por estado (não iniciado, em curso, concluído), por trilho
- [ ] Ordenação: por progresso, por data admissão, por dias restantes
- [ ] Indicadores visuais:
  - Verde: no prazo
  - Amarelo: a aproximar-se do prazo
  - Vermelho: atrasado (etapa pendente além da data prevista)
- [ ] Click num colaborador → página de detalhe do progresso
- [ ] Stat cards no header: total em onboarding, progresso médio, etapas mais atrasadas

---

## S-053 · Página de Progresso do Colaborador (Vista Admin)

**Esforço:** M (3 pt)
**Dependências:** S-052

### User Story
Como gestor DPC, quero ver o progresso detalhado de cada colaborador no seu trilho de onboarding.

### Critérios de Aceitação
- [ ] Página `/onboarding/colaborador/:id` com:
  - Header: dados do colaborador (nome, função, direcção, data admissão, foto placeholder)
  - Barra de progresso global (%)
  - Timeline/stepper vertical com todas as etapas do trilho
- [ ] Cada etapa na timeline mostra:
  - Nome e tipo (ícone)
  - Estado: pendente (cinza), em curso (azul), concluída (verde), atrasada (vermelho)
  - Data prevista vs data real de conclusão
  - Botão "Marcar como concluída" (acção manual do admin)
  - Conteúdos associados (links, documentos)
- [ ] Secção de notas/observações do admin
- [ ] Botão "Enviar lembrete" (gera notificação ao colaborador)

---

## S-054 · Portal do Novo Colaborador (Vista Pessoal)

**Esforço:** L (5 pt)
**Dependências:** S-052, EPIC-02 S-022

### User Story
Como novo colaborador, quero ver o meu trilho de onboarding com checklist clara e conteúdos para saber exactamente o que se espera de mim.

### Critérios de Aceitação
- [ ] Página `/meu-onboarding/:token` acessível via link único
- [ ] Layout simplificado (sem sidebar admin): header Pumangol + conteúdo centrado
- [ ] Mensagem de boas-vindas personalizada: "Olá {nome}, bem-vindo à Pumangol!"
- [ ] Checklist visual das etapas do trilho:
  - Ícone de tipo + nome + descrição curta
  - Estado visual (checkbox animado, ícone colorido)
  - Conteúdos da etapa (links, documentos para ler/ver)
  - Botão "Concluí esta etapa" para etapas auto-reportáveis
- [ ] Barra de progresso global no topo
- [ ] Secção "Próxima etapa" em destaque
- [ ] Link para o Assistente IA: "Tens dúvidas? Pergunta ao assistente."
- [ ] Informações de contacto da DPC para questões que o chatbot não resolve
- [ ] Mobile-first: layout optimizado para smartphone

---

## S-055 · Check-in 30/60/90 Dias

**Esforço:** M (3 pt)
**Dependências:** S-052

### User Story
Como gestor DPC, quero que o sistema agende automaticamente check-ins aos 30, 60 e 90 dias do onboarding.

### Critérios de Aceitação
- [ ] Etapas de check-in pré-definidas nos trilhos (30, 60, 90 dias)
- [ ] Notificação automática ao admin 3 dias antes de cada check-in
- [ ] Formulário de check-in com:
  - Satisfação do colaborador (1-5)
  - Observações do colaborador (texto)
  - Avaliação do gestor (texto)
  - Pontos de acção (lista)
- [ ] Dados de check-in visíveis no perfil do colaborador
- [ ] Ao concluir o check-in de 90 dias: estado onboarding → "concluído"
- [ ] Notificação ao colaborador quando onboarding é marcado como concluído

---

## S-056 · Onboarding — Estado Vazio e Primeiro Uso

**Esforço:** S (2 pt)
**Dependências:** S-050

### User Story
Como utilizador DPC a usar a plataforma pela primeira vez, quero orientação clara sobre como configurar o primeiro trilho de onboarding.

### Critérios de Aceitação
- [ ] Se não existirem trilhos: estado vazio com ilustração + "Cria o teu primeiro trilho de onboarding" + botão CTA
- [ ] Se existirem trilhos mas sem colaboradores: "Ainda não há colaboradores em onboarding. Contrata o primeiro candidato no módulo de Recrutamento."
- [ ] Wizard guiado para criar primeiro trilho (3 passos): nome/função → etapas → revisão
- [ ] Trilho template "Genérico Pumangol" pré-carregado como sugestão
