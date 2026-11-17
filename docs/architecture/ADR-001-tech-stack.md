# ADR-001 · Decisões de Stack Tecnológico — Plataforma DPC Pumangol

| Campo | Detalhe |
|---|---|
| Estado | Aceite |
| Data | Abril 2025 |
| Autores | Equipa de Produto / DPC |

---

## Contexto

A plataforma DPC necessita de suportar três perfis de utilizador com modos de acesso distintos (SSO corporativo, link único sem password, link público sem login), integrar com o ecossistema Microsoft 365 da Pumangol e incluir um chatbot com RAG em Português. O horizonte de entrega do MVP é de 1–2 meses com equipa reduzida.

---

## Decisão 1: React (SPA) vs Next.js (SSR)

**Escolha: React + Vite (SPA)**

| Factor | React SPA | Next.js SSR |
|---|---|---|
| Velocidade de setup | Alto — Vite zero-config | Médio — mais configuração |
| SEO | Irrelevante — app interna | Vantagem não necessária |
| MSAL integration | Directa — client-side | Requer adaptação para SSR |
| Complexidade MVP | Menor | Maior |
| Hospedagem | Azure Static Web Apps | Azure App Service ou similar |

**Justificação:** Plataforma interna sem requisitos de SEO. MSAL.js é optimizado para SPA. Vite reduz o tempo de setup significativamente. Azure Static Web Apps suporta SPA nativamente com routing.

---

## Decisão 2: Autenticação — MSAL.js vs Auth0

**Escolha: MSAL.js + Microsoft Entra ID**

**Justificação:** A Pumangol já tem licenças Microsoft 365 activas. Entra ID é o provedor de identidade corporativo existente. Usar Auth0 introduziria um sistema de identidade paralelo sem benefício. MSAL.js com PKCE é o fluxo recomendado pela Microsoft para SPAs.

**Nota:** Links únicos de onboarding (UUID token) gerados pelo backend, sem envolver o Entra ID — validados na API com lookup na BD.

---

## Decisão 3: Vector Store — FAISS vs ChromaDB vs Azure AI Search

**Escolha: FAISS (MVP) com migração para Azure AI Search (Fase 2)**

| Factor | FAISS | ChromaDB | Azure AI Search |
|---|---|---|---|
| Setup | In-process, zero infra | Servidor separado | Azure managed service |
| Custo MVP | Gratuito | Gratuito | Pago por unidade |
| Escalabilidade | Limitada (in-memory) | Boa | Excelente |
| Persistência | Ficheiro local | BD local | Cloud |
| Integração LangChain | Nativa | Nativa | Nativa |

**Justificação:** Para o MVP com uma base de conhecimento pequena (< 500 documentos), FAISS em memória é suficiente e elimina a necessidade de gerir infra adicional. A Fase 2 migra para Azure AI Search para persistência e escala, mantendo a API LangChain idêntica.

---

## Decisão 4: Base de Dados — PostgreSQL vs Supabase vs SQLite

**Escolha: PostgreSQL gerido (Azure Database for PostgreSQL)**

**Justificação:** Dados estruturados com relações complexas (processos, etapas, documentos, notificações). SQLite inadequado para ambiente multi-utilizador. Supabase adiciona camada desnecessária ao ecossistema Microsoft já escolhido. PostgreSQL em Azure mantém tudo no mesmo cloud provider.

---

## Decisão 5: Notificações — Microsoft Graph API vs SendGrid vs SMTP directo

**Escolha: Microsoft Graph API (Mail.Send)**

**Justificação:** A Pumangol tem Microsoft 365. Usar `noreply-dpc@pumangol.ao` via Graph API garante que os emails partem de um domínio corporativo verificado, passam os filtros SPF/DKIM da empresa e não requerem contrato com fornecedor externo.

---

## Decisão 6: Chatbot Backend — LangChain vs LlamaIndex vs RAG custom

**Escolha: LangChain (Python) + Azure OpenAI GPT-4o**

**Justificação:** LangChain tem o maior ecossistema de integrações (FAISS, ChromaDB, Azure AI Search, OpenAI) e é o mais documentado para RAG. Azure OpenAI garante que os dados não saem do ambiente Microsoft — crítico para documentos confidenciais de RH. GPT-4o com T=0.2 assegura respostas determinísticas e factuais.

**Parâmetros do modelo:**
- Model: `gpt-4o`
- Temperature: `0.2`
- Max tokens: `800`
- Top-k chunks: `5`
- Score threshold: `0.75` (abaixo → fallback)

---

## Decisão 7: Estado Global — Zustand vs Redux vs React Context

**Escolha: Zustand**

**Justificação:** Estado mínimo necessário (utilizador autenticado, notificações, processo activo). Redux é overengineering para este âmbito. React Context causa re-renders excessivos com dados que mudam frequentemente. Zustand é leve, sem boilerplate e com TypeScript nativo.

---

## Consequências

- A equipa de backend precisa de ter Python disponível para o serviço LangChain (separado do Node.js principal)
- FAISS persiste o índice em disco — backup incluído na estratégia de dados
- MSAL requer registo da app no Entra ID com redirect URIs correctos antes do desenvolvimento começar
- Azure OpenAI requer aprovação de acesso e Key Vault para gestão de segredos
