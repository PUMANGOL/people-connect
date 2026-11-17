# Plataforma DPC Pumangol — Recrutamento, Onboarding e Assistente Virtual

Plataforma digital interna da **Direcção de Pessoas e Culturas (DPC)** da
Pumangol. Cobre o ciclo completo desde a abertura de uma vaga até à
integração plena de um novo colaborador, apoiada por um **Assistente
Virtual com IA** que responde a políticas internas com base em
conhecimento oficial da empresa.

> **Entrega para a equipa de IT.**
> Este documento é o ponto de partida para instalar, executar, evoluir e
> operar a plataforma. Para a visão funcional, regras de negócio,
> requisitos e diagramas, consulta a pasta [`IT-Handover/`](./IT-Handover/).

---

## 1. Módulos

| Bloco | Módulo | Objectivo |
|---|---|---|
| Funcional | **Recrutamento** | Dashboard semanal + candidatos importados por Excel |
| Funcional | **Onboarding** | Welcome Flow → Trilhos → Mentoria → Avaliações |
| Funcional | **Assistente IA** | Chat conversacional com respostas baseadas na Base de Conhecimento |
| Transversal | **Base de Conhecimento** | FAQs oficiais + documentos indexados |
| Transversal | **Dashboard Executivo** | KPIs, alertas, exportações |

Perfis suportados: **RH Admin**, **Mentor**, **Novo Colaborador**.

---

## 2. Stack técnico

| Camada | Tecnologia |
|---|---|
| Frontend | React 19 + Next.js + TypeScript + Tailwind CSS 4 |
| UI | shadcn/ui + lucide-react + motion |
| Routing | react-router-dom v7, montado no App Router |
| Estado | Zustand |
| API Client | axios com interceptors JWT |
| Backend | Route Handlers Next.js (a lógica continua em `netlify/functions`) |
| Base de dados | PostgreSQL serverless (Neon) + `pgvector` para embeddings |
| Autenticação (V1) | JWT local (HS256) |
| Autenticação (V2) | Microsoft Entra ID (MSAL) — planeada |
| Armazenamento (V1) | Referência simples no ficheiro `submissoes_documentos.ficheiro_ref` |
| Armazenamento (V2) | SharePoint via Microsoft Graph — planeada |
| Notificações (V1) | In-app |
| Notificações (V2) | Microsoft Graph Mail.Send — planeada |
| Provider IA | Abstraído por interface — pode ser trocado sem alterar a UI |
| Runtime | Next.js na máquina local (`next dev` / `next start`) |

---

## 3. Pré-requisitos

- **Node.js 20.x**
- **npm 10+** (vem com o Node)
- **Docker** — só para o Postgres local (`pgvector`)
- **PostgreSQL** com `pgvector`, publicado em `localhost:5432` pelo Compose

Para o Assistente IA:
- Uma **API key de um provider OpenAI-compatible** (ver Secção 6.2).

---

## 4. Instalação

```bash
# 1. Clonar o repositório
git clone <URL_DO_REPO> plataforma-dpc-pumangol
cd plataforma-dpc-pumangol

# 2. Instalar dependências
npm install

# 3. Configurar variáveis de ambiente
cp .env.example .env
#   → editar .env e preencher os valores reais (ver Secção 6)

# 4. Preparar a base de dados
#   → criar as tabelas a partir de db/SCHEMA.md (referência funcional)
#   → requer PostgreSQL 15+ com pgvector (ou alternativa vector — ver §12)
```

---

## 5. Executar localmente

### 5.1. Desenvolvimento (Next.js)

Frontend e API no mesmo processo, em <http://localhost:3000>.

```bash
npm run dev
```

`/api/*` é servido pelos route handlers, que reutilizam os handlers
existentes em `netlify/functions`.

### 5.2. Base de dados (Docker)

A aplicação não vai para o Docker. Só o Postgres:

```bash
docker compose up -d
npm run db:migrate
npm run db:seed
npm run dev
```

O Compose publica a base em `localhost:5432`. O `.env` já aponta `DATABASE_URL` para aí.

---

## 6. Variáveis de ambiente

O desenho das bases (identidade partilhada e base deste produto) está em
[`docs/README-bases.md`](./docs/README-bases.md).

O build corre sem variáveis. Para a aplicação usar a base de dados, o
`.env` precisa destas, lidas quando o servidor arranca:

| Variável | Descrição |
|---|---|
| `DATABASE_URL` | Base deste produto (`next_pumangol_onboarding`). Formato `postgresql://user:pass@host:5432/base` |
| `AUTH_DATABASE_URL` | Base de identidade (`next_pumangol_auth`), partilhada pelos produtos |
| `AUTH_JWT_SECRET` | Chave que assina o login. Gerar com `openssl rand -hex 32` |
| `BETTER_AUTH_SECRET` | Segredo do better-auth. Pode ser o mesmo valor que `AUTH_JWT_SECRET` |
| `BETTER_AUTH_URL` | URL público desta aplicação, sem barra no fim |

> ⚠️ Nunca fazer commit de `.env` ou de qualquer chave real. O `.gitignore`
> já protege `.env*` — apenas `.env.example` é versionado.

Sem provider IA configurado a plataforma **continua a funcionar** — o
Assistente arranca em **modo demo** e responde apenas com FAQs
publicadas (retrieval por palavras-chave).

---

## 7. Comandos disponíveis

| Comando | Descrição |
|---|---|
| `npm run dev` | Next.js em desenvolvimento, porta 3000 (UI + API) |
| `npm run build` | Build de produção (output standalone em `.next/`) |
| `npm run start` | Servir o build gerado |
| `docker compose up -d` | Postgres local, porta 5432 |
| `npm run db:seed` | Contas locais: admin, mentor e colaborador |
| `npm run lint` | Verificação de tipos TypeScript (`tsc --noEmit`) |
| `npm run typecheck` | Alias de `lint` |

---

## 8. Estrutura do repositório

```
plataforma-dpc-pumangol/
├── src/                       # Frontend React
│   ├── app/                   # App Router Next.js (layout + catch-all + /api)
│   ├── App.tsx                # Router + guards por perfil
│   ├── spa-shell.tsx          # Monta a SPA só no browser
│   ├── index.css              # Design tokens + Tailwind
│   ├── screens/               # Ecrãs organizados por módulo (react-router)
│   │   ├── admin/
│   │   ├── assistente/
│   │   ├── colaborador/
│   │   ├── configuracoes/
│   │   ├── mentor/
│   │   ├── onboarding/
│   │   ├── recrutamento/
│   │   └── welcome/
│   ├── components/            # Layout, Sidebar, TopNav, UI base
│   ├── services/              # Clientes de API por domínio
│   ├── store/                 # Zustand stores
│   ├── hooks/
│   └── lib/                   # Helpers e utilitários do frontend
│
├── netlify/functions/         # Handlers da API (servidos por Next.js)
│   ├── _shared/               # DB, auth, RAG, agente
│   │   └── agent/             # Orquestrador do Assistente Virtual
│   └── *.ts                   # ~36 endpoints (colaboradores, trilhos, agent-turn, kb-*, …)
│
├── db/
│   └── SCHEMA.md              # Referência funcional das tabelas
│
├── lib/                       # Tipos, constantes e validadores partilhados
├── components/                # Componentes shadcn base
├── public/                    # Assets estáticos (logos, favicon)
│
├── docs/                      # Documentação técnica (ADRs, EPICs, fluxos)
├── IT-Handover/               # ★ PRD funcional + protótipo para o IT
│
├── package.json
├── tsconfig.json
├── next.config.ts
├── Dockerfile
├── docker-compose.yml
├── netlify.toml               # Referência do hosting anterior
├── .env.example
└── README.md                  # (este ficheiro)
```

---

## 9. Base de dados

- **Referência funcional das tabelas em [`db/SCHEMA.md`](./db/SCHEMA.md)** —
  descreve todas as entidades, campos-chave, relações e enums em
  linguagem de negócio.
- Recomendado **PostgreSQL 15+** com extensão `pgvector` (para o RAG
  do Assistente). Neon, Azure Database for PostgreSQL Flexible Server,
  AWS RDS e Google Cloud SQL suportam-no.
- Alternativas com suporte nativo a vector: **SQL Server 2025+**,
  **Azure SQL**, **Oracle 23ai**. Também é possível manter os dados
  relacionais num SGBD sem vector e usar uma base vectorial dedicada
  (Pinecone, Qdrant, Azure AI Search) só para o RAG.
- Modelo funcional detalhado (fluxos, comportamento) em
  [`IT-Handover/DOCUMENTACAO.md`](./IT-Handover/DOCUMENTACAO.md)
  (secções 16 e 22).

---

## 10. Deploy

### 10.1. Máquina local

A aplicação corre com `npm run dev` ou `npm run start`. O Docker fica
reservado ao Postgres (`docker compose up -d`). Os headers de segurança
(`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`) estão
em `next.config.ts`.

### 10.2. Outros hosts

O frontend é um SPA estático (`dist/`) — funciona em qualquer host de
static assets (Azure Static Web Apps, S3+CloudFront, Vercel, IIS).
Neste caso, as Netlify Functions têm de ser portadas para:
- **Azure Functions** (Node.js 20) — mudança maioritariamente de handler,
  o corpo do código é reutilizável.
- **Express/Node** — os handlers já usam a assinatura `(req: Request) =>
  Promise<Response>` (fetch API), portanto adaptar com um wrapper simples.

---

## 11. Segurança — pontos-chave

- **Nunca** fazer commit de ficheiros `.env` ou chaves reais.
- Todos os endpoints protegidos validam JWT no início do handler
  (`requireAuth` em `netlify/functions/_shared/auth.ts`).
- RBAC verificado no **frontend** (guards + `hasPermission`) e no
  **backend** (por rota).
- HTTPS obrigatório em produção.
- Base de dados fora da rede pública sempre que possível; `sslmode=require`.
- Logging não deve incluir corpos de pedido com dados pessoais.
- Auditoria de operações críticas em `audit_log` + `onboarding_audit`.

Para uma revisão sistemática antes do go-live, sugere-se correr uma
auditoria dedicada aos endpoints de autenticação, upload e agente.

---

## 12. Onde continuar

- **PRD funcional completo** e regras de negócio →
  [`IT-Handover/DOCUMENTACAO.md`](./IT-Handover/DOCUMENTACAO.md)
- **Protótipo visual em HTML/CSS/JS** para conferir a visão →
  [`IT-Handover/prototype/index.html`](./IT-Handover/prototype/index.html)
- **Modelo de dados (tabelas, enums, relações)** → [`db/SCHEMA.md`](./db/SCHEMA.md)
- **ADRs (decisões arquitecturais)** → `docs/architecture/`
- **User stories por EPIC** → `docs/stories/`
- **Fluxos Mermaid** → `docs/flows/`

---

## 13. Contactos

Para dúvidas de negócio: **Direcção de Pessoas e Culturas (DPC)**
· `dpc@pumangol.ao`

---

_Última actualização do handover: Setembro de 2026._
