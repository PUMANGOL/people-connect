# EPIC-09 · Integração, Polimento & Go-Live

**Objectivo:** Integrar os três módulos, refinar UX, executar piloto com a equipa DPC, documentar e preparar go-live.
**Prioridade:** MVP — Sprint final
**Sprint:** 4 (Nov 2026)

---

## S-090 · Integração End-to-End: Recrutamento → Onboarding → Assistente

**Esforço:** L (5 pt)
**Dependências:** EPIC-03, EPIC-05, EPIC-07

### User Story
Como utilizador DPC, quero que o fluxo completo desde a abertura de uma vaga até à integração plena do colaborador funcione sem interrupções.

### Critérios de Aceitação
- [ ] Fluxo testável end-to-end:
  1. Criar vaga → Adicionar candidatos → Mover pelo pipeline
  2. Registar entrevistas → Gerar relatórios
  3. Registar contratação → Colaborador criado automaticamente
  4. Trilho de onboarding atribuído → Link único gerado
  5. Colaborador acede via link → Vê checklist → Usa chatbot
  6. Admin vê tudo no dashboard
- [ ] Dados consistentes entre módulos (IDs linkados, contagens correctas)
- [ ] Navegação cross-module funcional (links entre recrutamento, onboarding, dashboard)
- [ ] Sem dead-ends: cada acção leva a um próximo passo claro

---

## S-091 · Auditoria e Logging Completo

**Esforço:** M (3 pt)
**Dependências:** EPIC-01 S-014

### User Story
Como responsável DPC, quero que todas as acções críticas fiquem registadas para rastreabilidade.

### Critérios de Aceitação
- [ ] Acções registadas em `audit_log`:
  - Criação/edição/cancelamento de vaga
  - Movimentação de candidato no pipeline
  - Registo de contratação (transição)
  - Criação/edição/publicação/arquivamento de FAQ
  - Login/logout de utilizadores
- [ ] Cada log: utilizador_id, accao, entidade, entidade_id, timestamp, dados_anteriores, dados_novos
- [ ] Vista de audit log acessível em `/configuracoes/audit` (rh_admin only)
- [ ] Filtros: por utilizador, por tipo de acção, por período
- [ ] Exportação do audit log para CSV

---

## S-092 · Seed Data para Demonstração e Piloto

**Esforço:** M (3 pt)
**Dependências:** EPIC-01

### User Story
Como equipa DPC no piloto, quero dados de exemplo na plataforma para testar todos os fluxos sem precisar de criar tudo do zero.

### Critérios de Aceitação
- [ ] Script de seed que cria:
  - 3 vagas em diferentes estados (aberta, em entrevistas, fechada)
  - 10 candidatos distribuídos pelas fases do pipeline
  - 5 entrevistas registadas com pareceres
  - 2 colaboradores em onboarding activo
  - 1 trilho de onboarding completo ("Trilho Genérico Pumangol")
  - 20 FAQs publicadas (5 por direcção: DPC, HSE, DSI, Academia)
  - 10 interacções de chatbot de exemplo
- [ ] Seed executável via `npm run seed` (idempotente — pode correr várias vezes)
- [ ] Flag para modo demo vs produção (dados de seed apenas em desenvolvimento)

---

## S-093 · Responsividade e Mobile UX

**Esforço:** L (5 pt)
**Dependências:** EPIC-00

### User Story
Como novo colaborador, quero usar a plataforma no meu smartphone para consultar o meu onboarding e o chatbot em qualquer momento.

### Critérios de Aceitação
- [ ] Todas as páginas testadas em viewports: 375px (iPhone SE), 390px (iPhone 14), 768px (iPad), 1024px+
- [ ] Sidebar: drawer overlay em mobile, colapsável em tablet
- [ ] Tabelas: convertem para card list em mobile
- [ ] Kanban: scroll horizontal em mobile, cards empilhados
- [ ] Formulários: campos full-width em mobile
- [ ] Chat: ocupa 100% do viewport em mobile, teclado não esconde input
- [ ] Touch targets: mínimo 44x44px em todos os botões interactivos
- [ ] Sem scroll horizontal no body em nenhum viewport

---

## S-094 · Performance e Optimização

**Esforço:** M (3 pt)
**Dependências:** Todos os módulos

### User Story
Como utilizador, quero que a plataforma carregue rapidamente e responda sem lag.

### Critérios de Aceitação
- [ ] Lighthouse score ≥ 90 em Performance
- [ ] First Contentful Paint < 1.5s
- [ ] Time to Interactive < 3s
- [ ] Code splitting por rota (React.lazy + Suspense)
- [ ] Imagens e assets optimizados
- [ ] Queries ao Neon DB com índices adequados (verificar plano de execução)
- [ ] Debounce em search inputs (300ms)
- [ ] Paginação server-side em todas as listas > 50 items

---

## S-095 · Acessibilidade (a11y)

**Esforço:** M (3 pt)
**Dependências:** EPIC-00

### User Story
Como utilizador, quero que a plataforma seja acessível a pessoas com diferentes capacidades.

### Critérios de Aceitação
- [ ] Navegação por teclado funcional em todas as páginas
- [ ] ARIA labels em todos os elementos interactivos
- [ ] Contraste de cores WCAG AA em todos os textos
- [ ] Focus visible em todos os elementos focáveis
- [ ] Alt text em todas as imagens/ícones informativos
- [ ] Formulários com labels associados e mensagens de erro anunciadas
- [ ] Skip to main content link

---

## S-096 · Documentação de Operações

**Esforço:** S (2 pt)
**Dependências:** Todos

### User Story
Como administrador, quero documentação clara sobre como operar e manter a plataforma.

### Critérios de Aceitação
- [ ] README.md actualizado com:
  - Instruções de setup local
  - Variáveis de ambiente necessárias
  - Comandos de desenvolvimento, build e seed
  - Arquitectura de alto nível
- [ ] Guia de utilizador básico: como criar vaga, como usar o chatbot, como gerir FAQs
- [ ] Documentação da API (se backend separado)
- [ ] Plano de evolução pós-V1 documentado
