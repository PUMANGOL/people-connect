# Handoff — Deploy Netlify · Agente DPC

Documento de passagem de bastão para colocar a plataforma em produção no Netlify.

**Repo:** https://github.com/jcalala/Onboarding-Digital---Recrutamento  
**Branch com o agente:** `feature/agente-dpc-piramyd-genui`  
**Neon project:** `empty-water-67731687`  
https://console.neon.tech/app/projects/empty-water-67731687

> ⚠️ **Segredos:** este ficheiro contém API keys e connection strings do ambiente de desenvolvimento.  
> Depois do deploy, preferir rodopiar as keys e **não** deixar este doc público se o repositório for aberto.  
> Em Netlify: Site configuration → Environment variables (nunca no frontend com prefixo `VITE_` excepto o que for público).

---

## 1. O que é obrigatório no Netlify

| Variável | Scope | Obrigatória | Notas |
|----------|--------|-------------|--------|
| `DATABASE_URL` | Builds + Functions | **Sim** | Neon Postgres (sem prefixo `VITE_`) |
| `AUTH_JWT_SECRET` | Functions | **Sim** | Mesmo secret em todos os deploys da app |
| `PIRAMYD_API_KEY` | Functions | **Sim** | Agente LLM (tool-calling) |
| `PIRAMYD_BASE_URL` | Functions | Recomendado | Default: `https://api.piramyd.cloud/v1` |
| `PIRAMYD_CHAT_MODEL` | Functions | Recomendado | Default: `gpt-5.4` |
| `VITE_API_BASE_URL` | Builds | Recomendado | `/api` (redirects Netlify → functions) |

### Opcionais

| Variável | Uso |
|----------|-----|
| `NVIDIA_API_KEY` | Embeddings / fallback RAG (só se quiseres vector search com NVIDIA) |
| `NVIDIA_BASE_URL` | `https://integrate.api.nvidia.com/v1` |
| `NVIDIA_CHAT_MODEL` | `deepseek-ai/deepseek-v4-flash` |
| `NVIDIA_EMBED_MODEL` | `baai/bge-m3` |
| `VITE_AZURE_*` | SSO Entra ID (ainda opcional; login local activo) |

---

## 2. Valores usados neste ambiente (copiar para Netlify)

```bash
# --- Neon DB ---
DATABASE_URL=postgresql://neondb_owner:npg_OHcB48hPMnjA@ep-silent-snow-atlik3nc.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require

# --- Auth JWT (login local) ---
AUTH_JWT_SECRET=4581ee2d62b5f134715d4036a9ec895847c7aba915cca2e856471de6f0392393

# --- Piramyd (agente principal) ---
PIRAMYD_API_KEY=sk-b302fff272354c6aad32651943216bfc
PIRAMYD_BASE_URL=https://api.piramyd.cloud/v1
PIRAMYD_CHAT_MODEL=gpt-5.4

# --- Frontend ---
VITE_API_BASE_URL=/api
VITE_AI_PROVIDER=mock
```

**Piramyd:** https://api.piramyd.cloud/llms.txt · Dashboard: https://dash.piramyd.cloud  

**NVIDIA (opcional — vazio em dev actual):**

```bash
NVIDIA_API_KEY=
NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1
NVIDIA_CHAT_MODEL=deepseek-ai/deepseek-v4-flash
NVIDIA_EMBED_MODEL=baai/bge-m3
```

Sem `NVIDIA_API_KEY`, o retrieval denso (pgvector) fica desligado; o agente continua com Piramyd + FAQs keyword + tools Neon.

---

## 3. Deploy no Netlify (passos)

### 3.1 Ligar o site

1. [app.netlify.com](https://app.netlify.com) → **Add new site** → Import from Git  
2. Repo: `jcalala/Onboarding-Digital---Recrutamento`  
3. Branch de produção: `feature/agente-dpc-piramyd-genui` (ou `main` depois do merge)  
4. Build settings (já no `netlify.toml`):
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
   - **Functions directory:** `netlify/functions`
   - **Node:** 20

### 3.2 Environment variables

Site configuration → Environment variables → **Add a variable** / **Import from .env**

Para cada variável da secção 2:

- Scopes: **Production**, **Deploy Previews**, **Branch deploys** (ou só Production se preferires)
- `DATABASE_URL`, `AUTH_JWT_SECRET`, `PIRAMYD_*` → **Functions** (e Build se o build as ler; em geral Functions)
- `VITE_*` → **Builds** (Vite embute no bundle em build time)

Depois de alterar `VITE_*`, faz **Clear cache and deploy site**.

### 3.3 Redirects / API

Já configurados no `netlify.toml`:

```
/api/*  →  /.netlify/functions/:splat   (200)
/*      →  /index.html                  (200 SPA)
```

O frontend chama `/api/agent-turn`, `/api/auth-login`, etc.

### 3.4 Deploy

```bash
# Local (opcional, com Netlify CLI linkado)
netlify login
netlify link
netlify env:set PIRAMYD_API_KEY "sk-b302fff272354c6aad32651943216bfc"
# ... restantes env:set ...
netlify deploy --prod
```

Ou push na branch ligada → build automático.

---

## 4. Base de dados (Neon)

- Project ID: `empty-water-67731687`  
- Host: `ep-silent-snow-atlik3nc.c-9.us-east-1.aws.neon.tech`  
- Database: `neondb`  
- Branch usada em dev: **production**

Migrations já aplicadas localmente (`db/migrations/001`–`007`). Para reaplicar noutro branch Neon:

```bash
export DATABASE_URL='postgresql://...'
npm run db:migrate
# ou: node scripts/run-migrations.mjs
```

---

## 5. Contas de teste (auth local)

| Email | Password | Perfil |
|-------|----------|--------|
| `teste.admin@pumangol.ao` | `Teste@2026` | `rh_admin` |
| `admin@pumangol.ao` | `Pumangol@2026` | `rh_admin` |
| `ana.silva@pumangol.ao` | `Pumangol@2026` | `novo_colaborador` |

Login: `/login` → Assistente: `/assistente`

---

## 6. Endpoints relevantes do agente

| Método | Path | Auth | Função |
|--------|------|------|--------|
| POST | `/api/auth-login` | Não | JWT local |
| POST | `/api/agent-turn` | Bearer JWT | Turno do agente (Piramyd + tools) |
| POST | `/api/chat-mensagens` | Bearer JWT | Compat (delega no agente) |
| GET/PATCH | `/api/escalacoes` | Bearer JWT | Escalações DPC |
| GET | `/api/faqs` | — | FAQs |
| GET | `/api/health` | — | Health + DB |

---

## 7. Checklist pós-deploy

- [ ] Site abre e SPA routes funcionam (`/login`, `/assistente`)  
- [ ] Login com `teste.admin@pumangol.ao`  
- [ ] `POST /api/health` → `database: neondb`  
- [ ] Chat: pergunta “Quantos dias de férias tenho?” → resposta com fontes  
- [ ] Chat: “Que documentos tens na base de conhecimento?” → inventário (sem escalação)  
- [ ] Netlify Functions logs sem `PIRAMYD_API_KEY não configurada`  
- [ ] Timeout: agent pode demorar 15–40s; em free tier Netlify functions ~10–26s — se timeout, upgrade ou atalhos já no código  

---

## 8. Dev local (referência)

```bash
cd Onboarding-Digital-Recrutamento
cp .env.example .env   # preencher com os valores da secção 2
npm install
npm run db:migrate
npm run dev:full       # Netlify Dev → http://localhost:8888
```

Timeout local das functions: default ~30s no CLI; em dev o timeout do `netlify-cli` pode ser ajustado (ex. patch `SYNCHRONOUS_FUNCTION_TIMEOUT` no package, se necessário).

---

## 9. Contactos / links

| Recurso | URL |
|---------|-----|
| GitHub | https://github.com/jcalala/Onboarding-Digital---Recrutamento |
| Branch agente | `feature/agente-dpc-piramyd-genui` |
| Neon | https://console.neon.tech/app/projects/empty-water-67731687 |
| Piramyd docs | https://api.piramyd.cloud/llms.txt |
| Piramyd dash | https://dash.piramyd.cloud |
| Netlify | https://app.netlify.com |

---

*Gerado para handoff de deploy · Plataforma DPC Pumangol · Onboarding Digital / Recrutamento*
