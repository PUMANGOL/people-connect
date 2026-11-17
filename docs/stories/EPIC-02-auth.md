# EPIC-02 · Autenticação, Autorização & RBAC

**Objectivo:** Implementar sistema de autenticação com SSO Microsoft Entra ID e controlo de acesso baseado em perfis conforme o PRD.
**Prioridade:** MVP — pré-requisito de todos os módulos
**Sprint:** 1 (Jul-Ago 2026)

---

## S-020 · MSAL.js + Microsoft Entra ID Setup

**Esforço:** L (5 pt)
**Dependências:** EPIC-01

### User Story
Como utilizador DPC, quero fazer login com a minha conta Microsoft corporativa para aceder à plataforma sem criar novas credenciais.

### Critérios de Aceitação
- [ ] MSAL.js configurado com OAuth 2.0 + PKCE flow
- [ ] Login redirect para Microsoft Entra ID
- [ ] Scopes configurados: `openid`, `profile`, `email`
- [ ] Token armazenado apenas em memória (sessionStorage como fallback, nunca localStorage)
- [ ] Silent token renewal implementado
- [ ] Logout limpa sessão MSAL + store Zustand
- [ ] Página de login com botão "Entrar com Microsoft" + branding Pumangol (navy/gold)
- [ ] Fallback: se Entra ID não estiver configurado, auth simples com email/password para desenvolvimento

---

## S-021 · Sistema RBAC com Perfis do PRD

**Esforço:** M (3 pt)
**Dependências:** S-020

### User Story
Como sistema, quero controlar o acesso a funcionalidades com base no perfil do utilizador.

### Critérios de Aceitação
- [ ] Perfis implementados:
  - `rh_admin` — Acesso total: Recrutamento, Onboarding, Base de Conhecimento, Dashboard, Assistente, Configurações
  - `gestor_talento` — Recrutamento + Onboarding (sem configuração de sistema)
  - `owner_conhecimento` — Apenas editor de FAQs da sua direcção
  - `novo_colaborador` — Apenas o seu trilho de onboarding + chatbot
- [ ] Hook `usePermission(resource, action)` que verifica permissões
- [ ] Componente `<RoleGuard roles={[...]} fallback={<Unauthorized />}>` actualizado
- [ ] Middleware de verificação no API client
- [ ] Perfil extraído do token JWT claim ou mapeado via tabela `utilizadores`
- [ ] Mapa de permissões por recurso em `src/lib/permissions.ts`

---

## S-022 · TokenGuard para Novo Colaborador (Link Único)

**Esforço:** M (3 pt)
**Dependências:** S-020

### User Story
Como novo colaborador, quero aceder ao meu trilho de onboarding e ao chatbot através de um link único recebido por email.

### Critérios de Aceitação
- [ ] URL formato: `/meu-onboarding/{uuid-token}`
- [ ] Token validado via API (existência, não expirado, associado a colaborador activo)
- [ ] Token com validade configurável (default: 90 dias desde data_admissao)
- [ ] Após validação, cria sessão temporária com perfil `novo_colaborador`
- [ ] Token inválido/expirado → `/link-invalido` com mensagem e contacto DPC
- [ ] Cada acesso com token registado em audit_log

---

## S-023 · Rota Pública do Chatbot (Sem Auth)

**Esforço:** S (1 pt)
**Dependências:** S-020

### User Story
Como colaborador activo ou visitante, quero aceder ao chatbot sem login.

### Critérios de Aceitação
- [ ] Rota `/chat` acessível sem autenticação
- [ ] Sem acesso a dados pessoais ou informação de onboarding
- [ ] Rate limiting: máximo 20 interacções por sessão/IP por hora
- [ ] Interacções registadas com sessão anónima (UUID gerado no browser)
- [ ] Guardrails do chatbot activos
