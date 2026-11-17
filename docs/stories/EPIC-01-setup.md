# EPIC-01 · Setup, Infraestrutura & Modelo de Dados

**Objectivo:** Preparar o ambiente de desenvolvimento, configurar Neon DB, definir o modelo de dados completo do PRD e as fundações técnicas para todos os módulos.
**Prioridade:** MVP — pré-requisito de todas as outras EPICs
**Sprint:** 1 (Jul-Ago 2026)

---

## S-010 · Estrutura de Projecto Refactored

**Esforço:** M (3 pt)
**Dependências:** —

### User Story
Como dev, quero uma estrutura de pastas reorganizada para suportar os três módulos do PRD (Recrutamento, Onboarding, Assistente IA) mais os motores transversais.

### Critérios de Aceitação
- [ ] Estrutura `src/` reorganizada com módulos explícitos
- [ ] Path alias `@/` confirmado no `tsconfig.json` e `vite.config.ts`
- [ ] `.env.example` actualizado com todas as variáveis (Neon DB, API IA, etc.)
- [ ] `package.json` com dependências actualizadas (Neon serverless driver, framer-motion, etc.)

### Notas Técnicas
```
src/
  pages/
    recrutamento/
      Vagas.tsx
      VagaDetalhe.tsx
      Pipeline.tsx
      Candidatos.tsx
      Entrevistas.tsx
    onboarding/
      Trilhos.tsx
      TrilhoDetalhe.tsx
      ColaboradorOnboarding.tsx
    assistente/
      AiAssistant.tsx
      BaseConhecimento.tsx
      FAQEditor.tsx
    dashboard/
      DashboardExecutivo.tsx
    auth/
      Login.tsx
  components/
    ui/              # Design system components
    layout/          # Shell, Sidebar, TopNav
    recrutamento/    # Componentes específicos do módulo
    onboarding/
    assistente/
    dashboard/
    shared/          # Componentes partilhados entre módulos
  hooks/
  services/
  lib/
    types.ts
    constants.ts
    utils.ts
    validators.ts
  store/
```

Variáveis `.env`:
```
VITE_NEON_DATABASE_URL=
VITE_API_BASE_URL=
VITE_AI_API_KEY=
VITE_AI_MODEL=
VITE_AZURE_CLIENT_ID=
VITE_AZURE_TENANT_ID=
VITE_AZURE_REDIRECT_URI=
```

---

## S-011 · Modelo de Dados — Entidades de Recrutamento (Neon DB)

**Esforço:** L (5 pt)
**Dependências:** S-010

### User Story
Como dev, quero as tabelas de Recrutamento criadas em Neon DB com tipos TypeScript correspondentes para que o módulo de recrutamento tenha persistência real.

### Critérios de Aceitação
- [ ] Tabela `vagas` com todos os campos do PRD Secção 7.1: id (UUID), titulo, direccao, justificativa, numero_posicoes, estado (enum), data_abertura, prazo_alvo, requisitos, owner
- [ ] Tabela `candidatos`: id, vaga_id (FK), nome, contactos (JSONB), cv_ref, origem (enum), estado_pipeline (enum), data_entrada, historico (JSONB array)
- [ ] Tabela `entrevistas`: id, candidato_id (FK), fase (enum), entrevistador, data, avaliacao (JSONB), parecer, recomendacao (enum)
- [ ] Enums PostgreSQL: `estado_vaga`, `origem_candidato`, `estado_pipeline`, `fase_entrevista`, `recomendacao_entrevista`
- [ ] Índices em campos frequentemente consultados (estado, vaga_id, candidato_id)
- [ ] Tipos TypeScript em `src/lib/types.ts` a espelhar exactamente as tabelas
- [ ] Migration scripts versionados em `db/migrations/`

### Notas Técnicas
```sql
CREATE TYPE estado_vaga AS ENUM (
  'aberta', 'em_triagem', 'em_entrevistas', 'em_proposta', 'fechada', 'cancelada'
);

CREATE TYPE estado_pipeline AS ENUM (
  'pedido_director', 'aprovacao_interna', 'publicacao',
  'triagem_cvs', 'primeira_entrevista_dpc', 'segunda_entrevista_area',
  'proposta', 'aceitacao', 'contratacao', 'transicao_onboarding'
);

CREATE TYPE origem_candidato AS ENUM (
  'publicacao', 'referenciacao', 'headhunter', 'candidatura_espontanea'
);

CREATE TABLE vagas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo VARCHAR(255) NOT NULL,
  direccao VARCHAR(100) NOT NULL,
  justificativa TEXT,
  numero_posicoes INT DEFAULT 1,
  estado estado_vaga DEFAULT 'aberta',
  data_abertura DATE DEFAULT CURRENT_DATE,
  prazo_alvo DATE,
  requisitos TEXT,
  owner VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## S-012 · Modelo de Dados — Entidades de Onboarding (Neon DB)

**Esforço:** L (5 pt)
**Dependências:** S-010

### User Story
Como dev, quero as tabelas de Onboarding com o conceito de Trilhos por função criadas em Neon DB.

### Critérios de Aceitação
- [ ] Tabela `colaboradores`: id, candidato_id_origem (FK nullable), nome, funcao, direccao, data_admissao, estado_onboarding (enum)
- [ ] Tabela `trilhos_onboarding`: id, funcao, nome, etapas (JSONB), duracao_estimada, versao
- [ ] Tabela `etapas_trilho`: id, trilho_id (FK), ordem, nome, tipo (enum), duracao_dias, conteudo_ref, criterio_conclusao
- [ ] Tabela `progresso_onboarding`: id, colaborador_id (FK), trilho_id (FK), etapa_id (FK), estado (enum), data_inicio, data_conclusao, responsavel
- [ ] Enums: `estado_onboarding`, `tipo_etapa` (documental, conversacional, formacao, administrativo, misto)
- [ ] Índice composto em (colaborador_id, trilho_id) para consultas de progresso
- [ ] Tipos TypeScript correspondentes

### Notas Técnicas
```sql
CREATE TYPE estado_onboarding AS ENUM ('nao_iniciado', 'em_curso', 'concluido');
CREATE TYPE tipo_etapa AS ENUM ('documental', 'conversacional', 'formacao', 'administrativo', 'misto');
CREATE TYPE estado_etapa AS ENUM ('pendente', 'em_curso', 'concluida', 'atrasada');

CREATE TABLE trilhos_onboarding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funcao VARCHAR(100) NOT NULL,
  nome VARCHAR(255) NOT NULL,
  duracao_estimada INT, -- dias úteis
  versao VARCHAR(20) DEFAULT '1.0',
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## S-013 · Modelo de Dados — Base de Conhecimento & Chatbot (Neon DB)

**Esforço:** M (3 pt)
**Dependências:** S-010

### User Story
Como dev, quero as tabelas de FAQs e interacções do chatbot criadas para suportar o Assistente IA e a Base de Conhecimento.

### Critérios de Aceitação
- [ ] Tabela `faqs`: id, direccao, categoria, pergunta, variantes (TEXT[]), resposta, palavras_chave (TEXT[]), owner, estado (enum), data_actualizacao
- [ ] Tabela `interaccoes_chatbot`: id, colaborador_id (FK nullable), sessao_id, pergunta, resposta, faqs_consultadas (UUID[]), timestamp, satisfacao (1-5 nullable), escalada_para_dpc (boolean)
- [ ] Enums: `estado_faq` (rascunho, em_revisao, publicada, arquivada)
- [ ] Índice GIN em `palavras_chave` e `variantes` para full-text search
- [ ] Tipos TypeScript correspondentes

---

## S-014 · Modelo de Dados — Tabelas Transversais (Neon DB)

**Esforço:** M (3 pt)
**Dependências:** S-010

### User Story
Como dev, quero tabelas de suporte para autenticação, auditoria e notificações.

### Critérios de Aceitação
- [ ] Tabela `utilizadores`: id, nome, email, perfil (enum), departamento, estado, created_at
- [ ] Tabela `audit_log`: id, utilizador_id, accao, entidade, entidade_id, dados_anteriores (JSONB), dados_novos (JSONB), timestamp
- [ ] Tabela `notificacoes`: id, destinatario_id, tipo, canal, mensagem, estado, enviada_em, lida_em
- [ ] Tabela `direccoes`: id, nome, sigla, responsavel_faq_owner
- [ ] Seeds iniciais: direcções (Academia, DPC, HSE, Segurança, DSI, DRM, DCO)
- [ ] Enum `perfil_utilizador`: rh_admin, gestor_talento, owner_conhecimento, novo_colaborador

---

## S-015 · Cliente API Refactored + Neon DB Connection

**Esforço:** M (3 pt)
**Dependências:** S-010

### User Story
Como dev, quero um cliente HTTP centralizado e uma conexão ao Neon DB configurada para que o backend sirva dados reais.

### Critérios de Aceitação
- [ ] Instância Axios em `src/services/api.client.ts` com interceptors JWT (mantido do S-002 original)
- [ ] Módulo `src/services/db.client.ts` com conexão Neon DB via `@neondatabase/serverless`
- [ ] Pool de conexões configurado (connection pooling do Neon)
- [ ] Tipos de resposta: `ApiResponse<T>`, `ApiError`, `PaginatedResponse<T>`
- [ ] Error handling centralizado com retry em erros transitórios

### Notas Técnicas
```typescript
// src/services/db.client.ts
import { neon } from '@neondatabase/serverless';

const sql = neon(import.meta.env.VITE_NEON_DATABASE_URL);

export { sql };
```

---

## S-016 · Routing Refactored para Novos Módulos

**Esforço:** M (3 pt)
**Dependências:** S-010, EPIC-02

### User Story
Como sistema, quero rotas configuradas para os três módulos do PRD mais os motores transversais.

### Critérios de Aceitação
- [ ] Rotas admin (RoleGuard: rh_admin):
  - `/` → Dashboard Executivo
  - `/recrutamento` → Lista de vagas
  - `/recrutamento/vagas/:id` → Detalhe da vaga + pipeline
  - `/recrutamento/candidatos` → Lista de candidatos
  - `/recrutamento/entrevistas` → Calendário de entrevistas
  - `/onboarding` → Lista de colaboradores em onboarding
  - `/onboarding/trilhos` → Gestão de trilhos
  - `/onboarding/trilhos/:id` → Detalhe do trilho
  - `/onboarding/colaborador/:id` → Progresso do colaborador
  - `/assistente` → Interface do chatbot (modo admin)
  - `/base-conhecimento` → Editor de FAQs
  - `/base-conhecimento/:direccao` → FAQs por direcção
  - `/relatorios` → Dashboard com exportações
- [ ] Rotas novo colaborador (TokenGuard):
  - `/meu-onboarding/:token` → Checklist + progresso pessoal
  - `/meu-onboarding/:token/assistente` → Chatbot pessoal
- [ ] Rota pública:
  - `/chat` → Chatbot sem auth
- [ ] Páginas de erro mantidas: 404, 403, link inválido

---

## S-017 · Zustand Stores Refactored

**Esforço:** S (2 pt)
**Dependências:** S-010

### User Story
Como dev, quero stores Zustand reorganizados para os novos módulos do PRD.

### Critérios de Aceitação
- [ ] `auth.store.ts`: user, role, isAuthenticated, permissions
- [ ] `recrutamento.store.ts`: vagaActiva, filtrosPipeline, viewMode (kanban/lista)
- [ ] `onboarding.store.ts`: trilhoActivo, colaboradorActivo, filtrosProgresso
- [ ] `ui.store.ts`: sidebarOpen, sidebarCollapsed, toasts, modals, theme
- [ ] `notifications.store.ts`: notifications, unreadCount
- [ ] Re-export via `src/store/index.ts`
