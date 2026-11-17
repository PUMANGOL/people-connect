# ADR-005 · Assistente Virtual — Integração com Ecossistema Microsoft

**Data:** 2026-07-14
**Estado:** Proposto — decisão pendente aprovação PCE
**Contexto:** A Pumangol usa Microsoft 365 corporativo. A story S-105 (EPIC-10) requer avaliar substituir/complementar o chatbot próprio pela solução Microsoft.

---

## Contexto

A Pumangol tem infraestrutura Microsoft 365 (Entra ID, Teams, SharePoint, Copilot corporativo). Desenvolver e manter um chatbot proprietário implica:
- Curadoria constante da base de FAQ
- Custos de LLM externo (OpenAI, Claude) por token
- Ausência de integração nativa com Teams/Outlook
- Riscos de compliance com dados internos

A alternativa é aproveitar o Copilot Microsoft já disponível no ecossistema.

## Opções avaliadas

### Opção 1 — Copilot Studio (ex-Power Virtual Agents)

**O que é:** Plataforma low-code para criar bots corporativos com knowledge base própria, publicáveis em Teams, web, Slack.

**Prós:**
- FAQs Pumangol carregam-se como knowledge source (URLs, SharePoint, ficheiros, Dataverse)
- Guardrails nativos (topic-based routing, autoridade humana)
- Deploy em web via embed script (JavaScript SDK)
- Integração nativa com Teams e Entra ID
- Não requer licença Copilot por utilizador (paga-se por mensagem)
- Analytics nativos (perguntas, resolução, feedback)

**Contras:**
- Curva de aprendizagem inicial para configurar tópicos e knowledge sources
- Personalização visual limitada dentro do iframe
- Custo por mensagem (~$0.01 USD)

**Custo estimado:** ~$200-500/mês para 20-50k mensagens

### Opção 2 — Microsoft 365 Copilot Chat embedded

**O que é:** Iframe do Copilot corporativo da Pumangol (o mesmo que aparece no Word/Teams).

**Prós:**
- Reutiliza directamente o Copilot já licenciado
- Acesso automático a documentos SharePoint/OneDrive do utilizador
- Auth via Entra ID transparente

**Contras:**
- Requer licença **M365 Copilot** por utilizador (~$30 USD/mês/utilizador — caro para todos os colaboradores)
- Contexto é do próprio utilizador (não FAQ Pumangol curada)
- Menos controlo sobre respostas (risco de respostas fora de tema)
- API de embed ainda em preview

**Custo estimado:** ~$30/utilizador/mês (proibitivo para novos colaboradores esporádicos)

### Opção 3 — Azure OpenAI Service (com RAG próprio)

**O que é:** Hospedar GPT-4 numa subscrição Azure Pumangol, com custom system prompt e RAG sobre FAQs.

**Prós:**
- Controlo total sobre respostas (system prompt customizado)
- Dados nunca saem do tenant Azure Pumangol (compliance ✓)
- Preço por token (mais barato para volumes moderados)
- Pode usar qualquer modelo (GPT-4, GPT-4o, Claude via marketplace)

**Contras:**
- Requer construir RAG (vector store, embedding, retrieval) — mais engenharia
- Manutenção contínua da knowledge base
- Sem UI out-of-the-box

**Custo estimado:** ~$50-200/mês (dependente do volume)

## Recomendação: **Opção 1 — Copilot Studio**

Melhor equilíbrio entre:
- **Time-to-value:** 2-4 semanas para MVP
- **Custo:** previsível e escalável
- **Compliance:** dados ficam no ambiente Microsoft Pumangol
- **Manutenção:** knowledge base gerida no portal Copilot Studio (não código)
- **Diferenciação:** integra Teams (colaboradores podem falar com o bot também no Teams)

O bot "Assistente Pumangol DPC" seria criado no Copilot Studio, com:
- Knowledge sources: SharePoint "Documentos DPC" + tabela FAQs da Neon (via connector custom)
- Tópicos manuais para intents críticos (férias, benefícios, escalação)
- Publicação: canal web (para embed na plataforma) + canal Teams

## Implementação — Fase 1 (MVP)

1. **DSI configura o bot no Copilot Studio** com knowledge sources iniciais
2. **DSI activa o canal Web** e obtém o `bot_id`/embed script
3. **Frontend Pumangol** implementa `CopilotStudioProvider` no `ai-provider.ts`:
   - Se `VITE_AI_PROVIDER=copilot_studio` e `VITE_COPILOT_BOT_ID` → carrega o SDK do webchat
   - Fallback: `MockAIProvider` (comportamento actual)
4. **Testes com 5 utilizadores DPC** durante 2 semanas
5. **Publicar para toda a Pumangol** no go-live

## Implementação — Fase 2 (V2)

- Ligar FAQs da Neon DB como fonte via **Power Automate flow** → Copilot Studio
- Sync bidireccional: perguntas escaladas no Copilot Studio → tabela `interaccoes_chatbot` na Neon (para analytics unificados)

## Consequências

- Reduzimos manutenção do chatbot próprio (deixa de ser feature crítica)
- Dependência do Microsoft (aceitável dada a stack Pumangol)
- Analytics dependem do Copilot Studio (exportação para relatórios via Power BI ou API)
- O `AIProvider` interface mantém-se — permite trocar de provider sem alterar UX
