# EPIC-04 · Módulo de Recrutamento — Entrevistas, Relatórios & Analítica

**Objectivo:** Completar o módulo de recrutamento com funcionalidades avançadas de relatórios, analítica de pipeline e integrações.
**Prioridade:** MVP — complemento do EPIC-03
**Sprint:** 1 (Jul-Ago 2026)
**Componentes PRD:** C-03 Interview & Report Generator (avançado)

---

## S-040 · Vista de Calendário de Entrevistas

**Esforço:** M (3 pt)
**Dependências:** EPIC-03 S-035

### User Story
Como especialista de recrutamento, quero ver todas as entrevistas agendadas num calendário para gerir a minha agenda sem conflitos.

### Critérios de Aceitação
- [ ] Página `/recrutamento/entrevistas` com vista calendário (mensal/semanal/diária)
- [ ] Cada entrevista como bloco no calendário: nome do candidato, vaga, tipo
- [ ] Cor do bloco por tipo de entrevista (1ª DPC = azul, 2ª Área = verde, Painel = gold)
- [ ] Click no bloco abre drawer com detalhes da entrevista
- [ ] Drag para reagendar (actualiza data no DB)
- [ ] Filtros: por entrevistador, por vaga, por tipo
- [ ] Indicador de entrevistas sem parecer registado (ícone de alerta)

---

## S-041 · Template Builder para Relatórios

**Esforço:** M (3 pt)
**Dependências:** EPIC-03 S-036

### User Story
Como responsável DPC, quero personalizar o template do relatório pós-entrevista para adequar ao formato esperado pelo PCE.

### Critérios de Aceitação
- [ ] Campos do template configuráveis: quais dimensões de avaliação incluir
- [ ] Logo e branding Pumangol no header do PDF
- [ ] Opção de incluir/excluir secções (avaliação numérica, parecer qualitativo, etc.)
- [ ] Preview antes de gerar o PDF final
- [ ] Template guardado em `settings` para reutilização
- [ ] Suporte a assinatura digital (texto + data) do entrevistador

---

## S-042 · Analítica de Recrutamento (Micro-Dashboard)

**Esforço:** L (5 pt)
**Dependências:** EPIC-03

### User Story
Como responsável DPC, quero métricas do recrutamento na página de recrutamento para ter visibilidade rápida sem ir ao dashboard global.

### Critérios de Aceitação
- [ ] Header da página `/recrutamento` com stat cards:
  - Vagas abertas (total)
  - Candidatos activos no pipeline (total)
  - Time-to-fill médio (dias)
  - Taxa de conversão (candidatos → contratados)
- [ ] Gráfico de funil: candidatos por fase do pipeline
- [ ] Gráfico de barras: vagas por direcção
- [ ] Gráfico de linha: vagas abertas vs fechadas ao longo do tempo
- [ ] Filtro por período (último mês, trimestre, semestre, ano)
- [ ] Dados calculados a partir das tabelas existentes (sem nova tabela)

---

## S-043 · Gestão Documental de Candidatos

**Esforço:** M (3 pt)
**Dependências:** EPIC-03 S-033

### User Story
Como especialista de recrutamento, quero gerir os documentos dos candidatos (CVs, certificados) de forma organizada.

### Critérios de Aceitação
- [ ] Upload de múltiplos ficheiros por candidato (CV, certificados, carta motivação)
- [ ] Validação: PDF/DOCX/JPG/PNG, máximo 10MB por ficheiro
- [ ] Visualização inline de PDFs no browser
- [ ] Download individual e em batch (ZIP)
- [ ] Lista de documentos no perfil do candidato com tipo, data upload, tamanho
- [ ] Armazenamento: filesystem local no V1, migração para SharePoint via Graph API no V2

---

## S-044 · Histórico e Timeline do Candidato

**Esforço:** S (2 pt)
**Dependências:** EPIC-03 S-034

### User Story
Como especialista de recrutamento, quero ver toda a história de um candidato numa timeline visual para perceber rapidamente o que aconteceu.

### Critérios de Aceitação
- [ ] Timeline vertical no perfil do candidato com:
  - Data de entrada no pipeline
  - Cada transição de fase (com nota, se existir)
  - Entrevistas realizadas (com avaliação resumida)
  - Documentos submetidos
  - Contratação (se aplicável)
- [ ] Cada evento com ícone, data/hora, actor (quem fez)
- [ ] Cores por tipo de evento: transição (azul), entrevista (gold), documento (verde), contratação (sucesso)
- [ ] Scroll infinito para candidatos com muitos eventos
