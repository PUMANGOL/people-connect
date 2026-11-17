# Handover ao IT — Plataforma DPC Pumangol

> **Este é o ponto de entrada para a equipa de IT.**
> Guarda-o no topo da lista. Todas as respostas rápidas estão aqui.

---

## 1. O que estás a receber

Um projecto **completo e funcional** — não é um protótipo:

- **Frontend** em React 19 + Vite + TypeScript
- **Backend serverless** em Netlify Functions (Node.js 20)
- **Base de dados PostgreSQL** com 20 migrations versionadas
- **Assistente Virtual com IA** funcional (RAG + tool-calling)
- **Documentação funcional (PRD)** e **protótipo HTML** de referência
  visual em `IT-Handover/`

Mais um bónus:
- `IT-Handover/prototype/` — protótipo em HTML/CSS/JS puro que
  representa a **visão de produto**. Serve como referência visual — não
  é a aplicação de produção.

---

## 2. Como começar

```bash
# 1) Instalar dependências
npm install

# 2) Configurar ambiente
cp .env.example .env
#    editar .env com credenciais reais (ver README secção 6)

# 3) Preparar a base de dados
#    Criar as tabelas no vosso SGBD com base em db/SCHEMA.md
#    (referência funcional — nomes, campos, relações, enums).
#    Requer PostgreSQL 15+ com extensão pgvector, OU alternativa
#    equivalente com suporte a vector search (ver db/SCHEMA.md §12).

# 4) Arrancar em modo desenvolvimento completo
npm run dev:full
#    abre em http://localhost:8888

# 5) Verificar tipos (nenhum erro esperado)
npm run typecheck
```

---

## 3. Documentos por ordem de leitura

| # | Ficheiro | Para quê |
|---|---|---|
| 1 | [`README.md`](./README.md) | Como instalar, correr, fazer deploy |
| 2 | [`IT-Handover/DOCUMENTACAO.md`](./IT-Handover/DOCUMENTACAO.md) | **PRD funcional** — regras de negócio, requisitos, fluxos, matriz de requisitos |
| 3 | [`IT-Handover/prototype/index.html`](./IT-Handover/prototype/index.html) | Protótipo visual — a visão do produto |
| 4 | [`db/SCHEMA.md`](./db/SCHEMA.md) | Referência funcional do modelo de dados (tabelas, campos, relações, enums) |
| 5 | `docs/architecture/` | ADRs — decisões técnicas registadas |
| 6 | `docs/stories/` | User stories por EPIC (0 → 11) |
| 7 | `docs/flows/mermaid-flows.md` | Diagramas de fluxo em Mermaid |

---

## 4. Estrutura de alto nível

```
plataforma-dpc-pumangol/
├── src/                  Frontend React (páginas, componentes, stores)
├── netlify/functions/    Backend serverless (36 endpoints)
├── db/SCHEMA.md          Referência do modelo de dados (tabelas, enums, relações)
├── lib/                  Tipos + constantes partilhadas
├── public/               Assets (logos, favicon)
├── docs/                 ADRs, EPICs, fluxos
├── IT-Handover/          PRD + protótipo HTML
├── package.json          Manifesto npm
├── vite.config.ts        Config do Vite
├── netlify.toml          Config de build + headers + redirects
├── tsconfig.json         Config TypeScript
├── .env.example          Modelo de variáveis de ambiente
└── README.md             Guia de instalação
```

---

## 5. O que a plataforma faz (visão de 30 segundos)

- **Recrutamento** — Dashboard semanal + candidatos importados por Excel.
- **Onboarding** — Welcome Flow (vídeos + quiz), Trilhos com desbloqueio
  sequencial, Documentos exigidos, Mentoria, Avaliações por momento
  (dia 15/30/60/90/final), Comparação 360°.
- **Assistente IA** — Chat com resposta baseada em conhecimento oficial
  (FAQs + documentos indexados via RAG). Escala automaticamente à DPC
  quando não tem confiança.
- **Transversais** — Base de Conhecimento, Dashboard Executivo, Timeline
  por colaborador, Notificações in-app, Auditoria.

**Perfis:** RH Admin, Mentor, Novo Colaborador.

---

## 6. Portabilidade

O projecto está desenhado para ser **transportado** — não fica preso ao
Netlify:

- **Frontend** — SPA estática (`npm run build` → `dist/`). Serve em
  qualquer host de estáticos (Azure Static Web Apps, S3+CloudFront,
  IIS, Nginx, Vercel).
- **Backend** — cada Function usa a assinatura Web `Request → Response`.
  Portar para **Azure Functions** ou **Express** requer apenas um wrapper
  fino do handler; a lógica de negócio é reutilizável.
- **Base de dados** — PostgreSQL padrão + extensão `pgvector`. Funciona
  em qualquer PostgreSQL 15+ (Neon, RDS, Cloud SQL, Azure Database for
  PostgreSQL, ou on-prem).
- **Provider de IA** — abstraído por interface (`src/services/ai-provider.ts`
  + `netlify/functions/_shared/piramyd-client.ts`). Suporta qualquer
  provider OpenAI-compatible.

---

## 7. Segurança — antes de ir para produção

Checklist mínima:

- [ ] `.env` real **fora** do repositório
- [ ] `AUTH_JWT_SECRET` gerado com `openssl rand -hex 32` (≥ 32 bytes)
- [ ] `DATABASE_URL` a apontar a instância dedicada (não a sandbox)
- [ ] `sslmode=require` na string de conexão
- [ ] Headers de segurança activos (já configurados no `netlify.toml`)
- [ ] CSP a rever se se acrescentar CDNs
- [ ] Verificar que os endpoints `/api/auth-*`, `/api/kb-upload` e
  `/api/agent-*` estão a validar JWT correctamente
- [ ] Auditar rate-limit se se colocar atrás do Netlify (recomenda-se
  Azure API Management ou equivalente conforme o desenho oficial)

---

## 8. O que ainda **não** está implementado (V2)

Documentado em detalhe em
[`IT-Handover/DOCUMENTACAO.md`](./IT-Handover/DOCUMENTACAO.md), secção 18:

1. Repositório documental corporativo (SharePoint via Microsoft Graph).
2. Notificações por email transaccional (Microsoft Graph Mail.Send).
3. SSO Microsoft Entra ID (a biblioteca `@azure/msal-browser` está
   instalada mas o login corrente é local).
4. Gráfico temporal no Dashboard de Evolução.
5. Alinhamento fino da importação Excel à aba `Candidatos`.

---

## 9. Contactos

- **Negócio (DPC):** `dpc@pumangol.ao`
- **Origem do projecto:** este repositório é o ponto de verdade — as
  regras estão em [`CLAUDE.md`](./CLAUDE.md) e no PRD.

---

_Boa continuação. Se algo não ficar claro, a resposta está quase
sempre num destes três sítios: `README.md`, `IT-Handover/DOCUMENTACAO.md`,
`db/SCHEMA.md`._
