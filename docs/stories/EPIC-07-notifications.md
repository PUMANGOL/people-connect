# EPIC-07 · Assistente Virtual com IA

**Objectivo:** Implementar chatbot conversacional que responde a FAQs em linguagem natural, alimentado pela Base de Conhecimento, com guardrails, registo de interacções e sistema de avaliação.
**Prioridade:** MVP
**Sprint:** 3 (Out 2026)
**Componentes PRD:** C-05 AI Chatbot Interface, C-06 Knowledge Base Retriever
**Nota:** Provider de IA TBD — a arquitectura deve abstrair o provider para facilitar troca futura.

---

## S-070 · Interface Conversacional do Chatbot

**Esforço:** L (5 pt)
**Dependências:** EPIC-00, EPIC-01

### User Story
Como novo colaborador, quero conversar com um assistente virtual em linguagem natural para tirar dúvidas sobre a Pumangol sem precisar de agendar reunião.

### Critérios de Aceitação
- [ ] Página `/assistente` com interface de chat moderna:
  - Área de mensagens com scroll automático
  - Input de texto com botão enviar + tecla Enter
  - Mensagens do utilizador alinhadas à direita (bolha azul)
  - Mensagens do assistente à esquerda (bolha branco/cinza)
  - Avatar do assistente: ícone Pumangol estilizado
  - Indicador de "a escrever..." enquanto aguarda resposta
- [ ] Mensagem de boas-vindas ao abrir:
  "Olá! Sou o assistente da Pumangol. Posso ajudar-te com dúvidas sobre políticas, benefícios, processos, segurança e muito mais. Em que posso ajudar?"
- [ ] Sugestões rápidas abaixo da mensagem de boas-vindas:
  - "Quais são os meus benefícios?"
  - "Como peço cartão de acesso?"
  - "Onde encontro os treinos obrigatórios?"
  - "Qual é o código de conduta?"
- [ ] Respostas formatadas: negrito, listas, links clicáveis
- [ ] Citação da direcção/fonte quando aplicável
- [ ] Mobile-first: funciona perfeitamente em smartphone
- [ ] Sessão persistente durante a visita (histórico de mensagens mantido)

---

## S-071 · Camada de Abstracção do Provider IA

**Esforço:** M (3 pt)
**Dependências:** S-070

### User Story
Como dev, quero uma camada de abstracção sobre o provider de IA para poder trocar entre diferentes modelos/APIs sem reescrever o chatbot.

### Critérios de Aceitação
- [ ] Interface `AIProvider` em `src/services/ai-provider.ts`:
  ```typescript
  interface AIProvider {
    generateResponse(prompt: string, context: FAQContext[]): Promise<AIResponse>;
    name: string;
    model: string;
  }
  ```
- [ ] Implementação inicial com provider configurável via `.env` (VITE_AI_PROVIDER)
- [ ] Providers preparados: placeholder/mock (para desenvolvimento), API genérica (REST)
- [ ] System prompt configurável em `src/lib/ai-config.ts`:
  - Tom: profissional mas próximo, português angolano
  - Restrições: não dá conselhos legais/financeiros/médicos individuais
  - Comportamento: cita fontes, diz "não sei" quando não sabe, escala para DPC
- [ ] Response streaming suportado (texto aparece progressivamente)
- [ ] Timeout configurável (default: 30s)
- [ ] Fallback em caso de erro: "De momento não consigo responder. Por favor contacta a DPC em dpc@pumangol.ao."

---

## S-072 · Knowledge Base Retriever (Motor de Busca de FAQs)

**Esforço:** L (5 pt)
**Dependências:** EPIC-06, S-071

### User Story
Como sistema, quero identificar as FAQs mais relevantes para cada pergunta do utilizador e enviá-las como contexto ao modelo de IA.

### Critérios de Aceitação
- [ ] Dado uma pergunta em linguagem natural:
  1. Pesquisa por palavras-chave nas FAQs publicadas (full-text search PostgreSQL)
  2. Match por variantes da pergunta (comparação de similaridade)
  3. Ranking por relevância (número de matches, exactidão)
  4. Retorna top 3-5 FAQs mais relevantes
- [ ] Apenas FAQs com estado "publicada" são consideradas
- [ ] Se nenhuma FAQ com score ≥ threshold → flag `escalada_para_dpc = true`
- [ ] Context formatado para envio ao provider IA:
  ```
  Responde com base APENAS no seguinte contexto oficial da Pumangol:
  ---
  [FAQ 1: Pergunta | Resposta | Direcção: X]
  [FAQ 2: Pergunta | Resposta | Direcção: Y]
  ---
  Se nenhuma FAQ responde à pergunta, diz que não tens essa informação e sugere contactar a DPC.
  ```
- [ ] Performance: resposta do retriever < 500ms
- [ ] Cache de queries frequentes (Redis ou in-memory no V1)

---

## S-073 · Guardrails e Segurança do Chatbot

**Esforço:** M (3 pt)
**Dependências:** S-071

### User Story
Como responsável DPC, quero que o chatbot não invente respostas nem aborde temas que não deve para proteger a organização e os colaboradores.

### Critérios de Aceitação
- [ ] O chatbot NÃO:
  - Inventa políticas (responde só com base na Base de Conhecimento)
  - Dá conselhos legais, financeiros, médicos ou de RH individual
  - Responde sobre processos individuais (salário, contrato, desempenho)
  - Toma decisões (aprovar, rejeitar, autorizar)
- [ ] Detecção de perguntas fora de âmbito:
  - "Qual é o meu salário?" → "Essa informação é individual. Contacta directamente a DPC em dpc@pumangol.ao."
  - Pergunta sem FAQ relevante → "Não tenho informação sobre esse tema. Sugiro que contactes [direcção relevante]."
- [ ] Content filter: rejeita inputs ofensivos, muito longos (> 500 chars), ou que tentam manipular o sistema (prompt injection básico)
- [ ] Limite de mensagens por sessão configurável (default: 50)
- [ ] Mensagem de encerramento quando limite atingido

---

## S-074 · Registo de Interacções e Avaliação

**Esforço:** M (3 pt)
**Dependências:** S-070, S-072

### User Story
Como responsável DPC, quero que todas as interacções com o chatbot sejam registadas e que o utilizador possa avaliar as respostas para melhorar continuamente a Base de Conhecimento.

### Critérios de Aceitação
- [ ] Cada interacção regista em `interaccoes_chatbot`:
  - colaborador_id (ou null para sessões anónimas)
  - sessao_id (UUID)
  - pergunta (texto do utilizador)
  - resposta (texto gerado)
  - faqs_consultadas (UUIDs das FAQs usadas como contexto)
  - timestamp
  - escalada_para_dpc (boolean)
- [ ] Botões de avaliação abaixo de cada resposta: polegar para cima / polegar para baixo
  - Para cima: regista satisfação = 5
  - Para baixo: abre modal com opções: "Resposta incorrecta", "Não respondeu à minha pergunta", "Outro" + campo de texto
  - Satisfação registada na interacção
- [ ] Se avaliação negativa → flag para revisão da FAQ na base de conhecimento
- [ ] Métricas acessíveis no dashboard: taxa de satisfação, perguntas sem resposta, FAQs mais consultadas

---

## S-075 · Escalação para DPC

**Esforço:** S (2 pt)
**Dependências:** S-073

### User Story
Como novo colaborador, quero ser encaminhado para uma pessoa real quando o chatbot não consegue responder à minha dúvida.

### Critérios de Aceitação
- [ ] Quando o chatbot não tem resposta:
  - Mensagem: "Não consegui encontrar essa informação na nossa base de conhecimento. Vou encaminhar a tua pergunta para a equipa da DPC."
  - Botão "Contactar DPC directamente" → mailto:dpc@pumangol.ao com pre-fill da pergunta
- [ ] Quando o utilizador avalia negativamente:
  - Opção "Falar com alguém da DPC" no modal de avaliação
- [ ] Escalações registadas como alerta para o admin no dashboard
- [ ] Admin pode ver todas as perguntas escaladas em `/assistente/escalacoes`
- [ ] Oportunidade de melhoria: cada escalação pode gerar nova FAQ (botão "Criar FAQ a partir desta pergunta")

---

## S-076 · Chatbot — Modo Público vs Modo Interno

**Esforço:** S (2 pt)
**Dependências:** S-070

### User Story
Como sistema, quero diferenciar o comportamento do chatbot entre o modo interno (colaboradores autenticados) e o modo público (acesso sem login).

### Critérios de Aceitação
- [ ] Modo interno (`/assistente` ou `/meu-onboarding/:token/assistente`):
  - Saudação personalizada com nome do colaborador
  - Acesso a FAQs de todas as direcções
  - Interacções registadas com colaborador_id
  - Sugestões personalizadas por direcção do colaborador
- [ ] Modo público (`/chat`):
  - Saudação genérica
  - Acesso apenas a FAQs marcadas como "públicas"
  - Interacções registadas com sessão anónima
  - Rate limiting mais restritivo
  - Sem referência a dados internos
- [ ] Layout diferenciado: modo público sem sidebar, com branding Pumangol standalone
