# EPIC-06 · Base de Conhecimento

**Objectivo:** Criar o repositório estruturado e versionado de FAQs por direcção que alimenta o Assistente IA. Motor transversal sem o qual o chatbot não funciona — dependência crítica do Módulo 3.
**Prioridade:** MVP — caminho crítico para Sprint 3
**Sprint:** 0 (paralelo Jul-Set) + Sprint 2 (Set 2026)
**Componentes PRD:** C-07 Knowledge Base Editor, C-06 Knowledge Base Retriever (parcial)

---

## S-060 · Editor de FAQs (CRUD Completo)

**Esforço:** L (5 pt)
**Dependências:** EPIC-01 S-013

### User Story
Como owner de conhecimento de uma direcção, quero criar, editar e gerir FAQs da minha direcção para que o chatbot tenha informação actualizada e validada.

### Critérios de Aceitação
- [ ] Página `/base-conhecimento` com lista de FAQs, filtráveis por direcção, categoria, estado
- [ ] Formulário de criação/edição de FAQ:
  - Pergunta canónica (obrigatório)
  - Variantes da pergunta (lista editável — "outras formas de perguntar a mesma coisa")
  - Resposta oficial (rich text: negrito, itálico, listas, links)
  - Direcção responsável (select, pré-preenchido para owners)
  - Categoria temática (select: benefícios, segurança, acessos, formação, processos, cultura, IT, logística)
  - Palavras-chave (tags input)
  - Owner (quem validou — auto-preenchido com utilizador actual)
- [ ] Estados com workflow:
  - Rascunho → Em Revisão → Publicada → Arquivada
  - Apenas FAQs "Publicadas" ficam disponíveis ao chatbot
  - Transição para "Publicada" requer confirmação
- [ ] Contagem de vezes que cada FAQ foi citada pelo chatbot (readonly, calculado)
- [ ] Data de última actualização visível + alerta se > 6 meses sem actualizar

---

## S-061 · Vista por Direcção com Estatísticas

**Esforço:** M (3 pt)
**Dependências:** S-060

### User Story
Como responsável DPC, quero ver o estado das FAQs agrupadas por direcção para saber quais direcções estão em dia e quais precisam de atenção.

### Critérios de Aceitação
- [ ] Página `/base-conhecimento` com tabs ou cards por direcção:
  - Academia, DPC, HSE, Segurança, DSI, DRM, DCO, Outras
- [ ] Cada direcção mostra:
  - Total de FAQs (publicadas / total)
  - Owner nomeado (ou "Sem owner" em vermelho)
  - % de FAQs actualizadas nos últimos 6 meses
  - Última actualização
- [ ] Click numa direcção → `/base-conhecimento/:direccao` com lista de FAQs
- [ ] Indicador visual por direcção:
  - Verde: ≥ 15 FAQs publicadas + owner nomeado + > 70% actualizadas
  - Amarelo: parcialmente completa
  - Vermelho: < 5 FAQs ou sem owner

---

## S-062 · Importação Bulk de FAQs

**Esforço:** M (3 pt)
**Dependências:** S-060

### User Story
Como owner de conhecimento, quero importar FAQs em bloco a partir de um ficheiro Excel/CSV para não ter de criar uma a uma no Sprint 0.

### Critérios de Aceitação
- [ ] Template Excel/CSV para download com colunas: pergunta, resposta, categoria, palavras_chave, variantes
- [ ] Upload de ficheiro com validação de formato
- [ ] Preview das FAQs a importar antes de confirmar
- [ ] Todas importadas com estado "rascunho" (requerem revisão e publicação individual)
- [ ] Relatório de importação: X importadas, Y com erros (com detalhe)
- [ ] Suporte a UTF-8 para caracteres em português

---

## S-063 · Pesquisa e Navegação na Base de Conhecimento

**Esforço:** M (3 pt)
**Dependências:** S-060

### User Story
Como utilizador DPC, quero pesquisar FAQs por texto livre ou filtros para encontrar rapidamente informação sem precisar do chatbot.

### Critérios de Aceitação
- [ ] Search bar global na página de base de conhecimento
- [ ] Pesquisa por texto livre (match em pergunta, resposta, variantes, palavras_chave)
- [ ] Filtros combinados: direcção + categoria + estado
- [ ] Resultados com highlight do termo pesquisado
- [ ] Ordenação: relevância, data, direcção
- [ ] Preview expandível: mostra resposta completa inline sem mudar de página
- [ ] Atalho: click na FAQ abre em modo de edição

---

## S-064 · Curadoria e Workflow de Validação

**Esforço:** S (2 pt)
**Dependências:** S-060

### User Story
Como responsável DPC, quero um workflow de validação para garantir que FAQs publicadas foram revistas antes de ficarem acessíveis ao chatbot.

### Critérios de Aceitação
- [ ] Dashboard de curadoria: FAQs por estado com contagens
  - Rascunhos pendentes de revisão
  - Em revisão (aguardam publicação)
  - Publicadas
  - Arquivadas
- [ ] Bulk actions: seleccionar múltiplas FAQs → publicar / arquivar / atribuir owner
- [ ] Notificação ao owner quando uma FAQ da sua direcção é reportada como desactualizada
- [ ] Log de alterações por FAQ (quem editou, quando, o que mudou)
- [ ] Flag "Actualização urgente" para FAQs referenciadas frequentemente pelo chatbot com avaliação negativa
