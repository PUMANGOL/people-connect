# Modelo de Dados — Plataforma DPC Pumangol

> **Referência funcional das tabelas.**
> Este documento descreve o esquema em linguagem de negócio, para que a
> equipa de IT possa implementá-lo em qualquer sistema (PostgreSQL,
> SQL Server, Oracle, MySQL). Não inclui DDL — apenas propósito de cada
> tabela e os seus campos-chave.
>
> Convenções:
> - `PK` = chave primária · `FK` = chave estrangeira · `UQ` = índice único
> - Todas as chaves primárias são `UUID` (equivalente a `uniqueidentifier`).
> - Todas as tabelas têm `created_at` e, quando faz sentido, `updated_at`.
> - Datas usam `TIMESTAMP WITH TIME ZONE`; datas simples usam `DATE`.

---

## 1. Enumerações de domínio

Valores fechados usados pelas tabelas abaixo. Podem ser implementados
como `ENUM`, tabelas de lookup ou `CHECK` constraints.

| Enum | Valores |
|---|---|
| `perfil_utilizador` | `rh_admin`, `mentor`, `novo_colaborador` |
| `estado_vaga` | `aberta`, `em_triagem`, `em_entrevistas`, `em_proposta`, `fechada`, `cancelada` |
| `estado_pipeline` | `pedido_director`, `aprovacao_interna`, `publicacao`, `triagem_cvs`, `primeira_entrevista_dpc`, `segunda_entrevista_area`, `proposta`, `aceitacao`, `contratacao`, `transicao_onboarding` |
| `origem_candidato` | `publicacao`, `referenciacao`, `headhunter`, `candidatura_espontanea` |
| `fase_entrevista` | `primeira_entrevista_dpc`, `segunda_entrevista_area`, `entrevista_tecnica` |
| `recomendacao_entrevista` | `avancar`, `reserva`, `rejeitar` |
| `estado_onboarding` | `nao_iniciado`, `em_curso`, `concluido` |
| `tipo_etapa` | `documental`, `conversacional`, `formacao`, `administrativo`, `misto` |
| `estado_etapa` | `pendente`, `em_preparacao`, `em_curso`, `aguardar_validacao`, `concluida`, `reagendada`, `bloqueada`, `cancelada`, `atrasada` (legado) |
| `categoria_trilho` | `gestao`, `tecnicos` |
| `momento_avaliacao` | `dia_15`, `dia_30`, `dia_60`, `dia_90`, `final` |
| `estado_avaliacao` | `rascunho`, `submetida`, `validada` |
| `estado_faq` | `rascunho`, `em_revisao`, `publicada`, `arquivada` |
| `categoria_faq` | `beneficios`, `seguranca`, `acessos`, `formacao`, `processos`, `cultura`, `it`, `logistica` |
| `canal_notificacao` | `email`, `in_app`, `ambos` |
| `estado_notificacao` | `pendente`, `enviada`, `falha`, `lida` |

---

## 2. Tabelas transversais

### `direccoes`
Direcções e gabinetes oficiais da Pumangol. Usada como referência em
vagas, colaboradores, FAQs e documentos.
- `id` (PK), `nome`, `sigla` (UQ), `responsavel_faq_owner`

### `utilizadores`
Contas de acesso à plataforma.
- `id` (PK), `nome`, `email` (UQ), `perfil` (`perfil_utilizador`),
  `departamento`, `estado` (`activo`/`inactivo`), `created_at`
- **Autenticação local** (tabela `auth_local`) guarda `password_hash`
  (bcrypt) e liga a `utilizadores.id`.

### `audit_log`
Rasto genérico de operações críticas.
- `id` (PK), `utilizador_id` (FK), `accao`, `entidade`, `entidade_id`,
  `dados_anteriores` (JSON), `dados_novos` (JSON), `timestamp`

### `notificacoes`
Notificações genéricas do sistema (canal in-app e email).
- `id` (PK), `destinatario_id` (FK utilizadores), `tipo`, `canal`,
  `mensagem`, `estado`, `link_accao`, `enviada_em`, `lida_em`, `created_at`

---

## 3. Recrutamento

### `vagas`
Vagas abertas para preenchimento (modelo legado — na V2 o recrutamento
está simplificado, mas a tabela mantém-se para retrocompatibilidade).
- `id` (PK), `titulo`, `direccao`, `justificativa`, `numero_posicoes`,
  `estado` (`estado_vaga`), `data_abertura`, `prazo_alvo`, `requisitos`,
  `owner`, `referencia_externa`, `created_at`, `updated_at`

### `candidatos`
Candidatos submetidos a vagas.
- `id` (PK), `vaga_id` (FK), `nome`, `email`, `telefone`,
  `contactos` (JSON), `cv_ref`, `origem` (`origem_candidato`),
  `estado_pipeline` (`estado_pipeline`), `data_entrada`,
  `historico` (JSON — transições anteriores), `created_at`, `updated_at`

### `entrevistas`
Registo de entrevistas realizadas por candidato.
- `id` (PK), `candidato_id` (FK), `fase` (`fase_entrevista`),
  `entrevistador`, `data`, `avaliacao` (JSON), `parecer`,
  `recomendacao` (`recomendacao_entrevista`), `created_at`

---

## 4. Onboarding — Colaboradores e Trilhos

### `colaboradores`
Pessoa em processo de integração. Estende `utilizadores`.
- `id` (PK), `utilizador_id` (FK utilizadores), `candidato_id_origem` (FK
  candidatos), `nome`, `funcao`, `direccao`, `categoria` (`gestao`/`tecnicos`),
  `data_admissao`, `estado_onboarding` (`estado_onboarding`),
  `welcome_completed` (bool), `trilho_id` (FK trilhos_onboarding — a
  instância atribuída), `link_token` (UUID), `email`, `created_at`, `updated_at`

### `trilhos_onboarding`
Planos de integração. Podem ser **templates** (reutilizáveis) ou
**instâncias** (cópia imutável atribuída a um colaborador).
- `id` (PK), `funcao`, `nome`, `duracao_estimada` (dias),
  `versao`, `activo` (bool), `categoria` (`gestao`/`tecnicos`),
  `descricao`, `is_template` (bool), `created_at`

### `etapas_trilho`
Unidades de trabalho de um trilho, ordenadas.
- `id` (PK), `trilho_id` (FK), `ordem`, `nome`, `tipo` (`tipo_etapa`),
  `duracao_dias`, `descricao`, `conteudo_ref`, `criterio_conclusao`,
  `obrigatoria` (bool), `bloqueante` (bool), `fase`, `fase_nome`,
  `responsavel_default`, `checklist_items` (JSON),
  `evidencias_obrigatorias` (bool)

### `progresso_onboarding`
Progresso individual do colaborador em cada etapa do seu trilho.
- `id` (PK), `colaborador_id` (FK), `trilho_id` (FK), `etapa_id` (FK),
  `estado` (`estado_etapa`), `data_inicio`, `data_conclusao`,
  `data_prevista`, `responsavel`

### `checklist_progresso`
Estado individual dos itens de checklist de uma etapa em curso.
- `id` (PK), `progresso_id` (FK progresso_onboarding), `item_key`,
  `concluido` (bool), `concluido_em`, `concluido_por` (FK utilizadores),
  `comentario`
- **UQ:** `(progresso_id, item_key)`

---

## 5. Welcome Flow

### `welcome_videos`
Vídeos oficiais de boas-vindas (6 slots configuráveis).
- `id` (PK), `slot` (UQ — ex.: `institucional`, `hse`,
  `dpc_beneficios`, `dpc_avaliacao`, `dpc_saude_bemestar`,
  `dpc_formacao`), `titulo`, `url`, `descricao`,
  `duracao_minima_segundos` (int, para desbloquear), `ativo` (bool —
  desactivado não aparece no Welcome Flow), `ordem` (int — sequência dos
  passos, definida no admin), `updated_at`

### `quiz_perguntas`
Banco de perguntas do quiz de boas-vindas.
- `id` (PK), `tipo` (`verdadeiro_falso` / `escolha_multipla` /
  `informativa`), `pergunta`, `opcoes` (JSON — array de strings),
  `resposta_correcta` (índice em `opcoes`; 1=V/0=F; null se
  `informativa`), `explicacao`, `activa` (bool), `created_at`

### `quiz_config`
Configuração singleton do quiz.
- `id = 1` (PK, único), `perguntas_por_sessao`, `ordem_aleatoria` (bool),
  `quiz_ativo` (bool — desligado, o Welcome Flow termina após os vídeos)

### `quiz_resultados`
Registo do resultado de um colaborador.
- `id` (PK), `colaborador_id` (FK), `utilizador_id` (FK), `total`,
  `acertos`, `percentagem`, `detalhes` (JSON), `created_at`

### `fichas_trabalhador`
Ficha do Trabalhador (modelo em papel "FICHA DO NOVO TRABALHADOR").
Primeiro passo do Welcome Flow; editável depois em "A Minha Ficha".
- `id` (PK), `colaborador_id` (FK, **UQ**), `nome`, `data_inicio`, `numero_bi`,
  `funcao`, `sexo` (`M` / `F`), `data_nascimento`, `local_nascimento`,
  `estado_civil`, `morada`, `provincia`, `telefone`, `telemovel`, `email`
- `conjuge` (JSON, só casado / união de facto), `filhos` (JSON array),
  `contactos_emergencia` (JSON array, máx. 2)
- `estado` (`rascunho` / `submetida`), `submetida_em`, `actualizado_por` (FK),
  `created_at`, `updated_at`

---

## 6. Documentos

### `documentos_empresa`
PDFs oficiais consultáveis pelo colaborador.
- `id` (PK), `nome`, `categoria` (`politica` / `regulamento` / `manual`
  / `guia`), `url`, `ficheiro_ref`, `descricao`, `created_at`

### `documentos_exigidos`
Itens da checklist que o colaborador tem de submeter.
- `id` (PK), `nome`, `descricao`, `obrigatorio` (bool),
  `categoria` (NULL = todos), `ordem`, `activo` (bool), `created_at`

### `submissoes_documentos`
Submissões feitas pelo colaborador.
- `id` (PK), `colaborador_id` (FK), `documento_exigido_id` (FK),
  `estado` (`pendente` / `submetido` / `aprovado` / `rejeitado`),
  `ficheiro_ref`, `ficheiro_nome`, `motivo_rejeicao`, `submetido_em`,
  `avaliado_em`, `created_at`
- **UQ:** `(colaborador_id, documento_exigido_id)`

---

## 7. Mentoria

### `mentors`
Colaboradores da Pumangol com papel de mentor.
- `id` (PK), `utilizador_id` (FK, UQ), `categorias_suportadas`
  (array de `categoria_trilho`), `activo` (bool), `bio`, `created_at`

### `mentor_assignments`
Atribuições entre mentor e colaborador. Histórico auditável.
- `id` (PK), `colaborador_id` (FK), `mentor_id` (FK), `atribuido_em`,
  `atribuido_por` (FK utilizadores), `terminado_em`,
  `terminado_por` (FK utilizadores), `motivo_termino`, `activo` (bool)
- **UQ parcial:** um colaborador só pode ter **uma** atribuição activa.

### `mentor_avaliacoes`
Formulário preenchido pelo mentor em cada momento oficial.
- `id` (PK), `colaborador_id` (FK), `mentor_id` (FK),
  `categoria` (`categoria_trilho`), `momento` (`momento_avaliacao`),
  `periodo_inicio`, `periodo_fim`, `criterios` (JSON — `{chave: nota|"N/A"}`),
  `comentarios_criterios` (JSON), `pontos_fortes`,
  `oportunidades_melhoria`, `situacoes_contributo`,
  `classificacao_global`, `manter_mentor` (`sim`/`nao`/`a_avaliar`),
  `necessita_orientacao` (bool), `necessita_clarificacao` (bool),
  `observacoes_dpc`, `plano_accao` (JSON), `estado` (`estado_avaliacao`),
  `preenchido_por` (FK), `preenchido_em`, `validado_por` (FK),
  `validado_em`, `created_at`, `updated_at`
- **UQ:** `(colaborador_id, momento)`

### `colaborador_feedback`
Auto-avaliação submetida pelo próprio colaborador.
- `id` (PK), `colaborador_id` (FK), `categoria`, `momento`,
  `periodo_inicio`, `periodo_fim`, `avaliacao_geral` (JSON),
  `blocos_aprendizagem` (JSON), `principais_aprendizagens`,
  `duvidas_reforco` (JSON), `stakeholders` (JSON),
  `oportunidades` (JSON), `suporte_adicional` (JSON),
  `feedback_mentor_gestor` (JSON), `classificacao_global`,
  `comentarios_finais`, `plano_accao` (JSON),
  `estado` (`estado_avaliacao`), `desbloqueado` (bool),
  `submetido_em`, `created_at`, `updated_at`
- **UQ:** `(colaborador_id, momento)`

---

## 8. Timeline, Notificações e Auditoria de Onboarding

### `onboarding_timeline`
Cadeia imutável de eventos por colaborador. 16 tipos de evento.
- `id` (PK), `colaborador_id` (FK), `tipo` (enum — ver lista completa
  na secção 17.1 do PRD), `actor_id` (FK utilizadores), `actor_nome`,
  `actor_role`, `descricao`, `meta` (JSON), `created_at`

### `onboarding_notificacoes`
Notificações direccionadas do módulo Onboarding.
- `id` (PK), `destinatario_id` (FK), `destinatario_role`,
  `colaborador_id` (FK), `tipo` (enum), `titulo`, `mensagem`,
  `link_accao`, `lida` (bool), `lida_em`, `created_at`

### `onboarding_audit`
Auditoria específica do módulo Onboarding (mais rica que `audit_log`).
- `id` (PK), `utilizador_id` (FK), `utilizador_nome`,
  `utilizador_role`, `operacao`, `entidade`, `entidade_id`,
  `colaborador_id`, `valor_anterior` (JSON), `valor_novo` (JSON),
  `ip_origem`, `user_agent`, `created_at`

### `onboarding_comentarios`
Comentários do mentor sobre o colaborador (livres, opcionalmente
ligados a uma etapa).
- `id` (PK), `colaborador_id` (FK), `etapa_progresso_id` (FK),
  `autor_id` (FK utilizadores), `autor_nome`, `autor_role`,
  `visivel_colaborador` (bool), `texto`, `created_at`

---

## 9. Base de Conhecimento (RAG)

### `faqs`
Perguntas frequentes oficiais.
- `id` (PK), `direccao`, `categoria` (`categoria_faq`), `pergunta`,
  `variantes` (array de strings), `resposta`,
  `palavras_chave` (array de strings), `owner`, `estado` (`estado_faq`),
  `vezes_citada`, `data_actualizacao`, `created_at`,
  `embedding` (vector — opcional; ver secção 12), `embedding_actualizado_em`

### `kb_documentos`
Documentos oficiais indexados na Base de Conhecimento.
- `id` (PK), `titulo`, `descricao`, `categoria`, `direccao`,
  `tipo_ficheiro` (`pdf` / `docx` / `manual`), `ficheiro_url`,
  `ficheiro_hash` (SHA-256), `tamanho_bytes`,
  `criado_por` (FK utilizadores),
  `estado` (`processando` / `indexado` / `falha` / `arquivado`),
  `erro_processamento`, `chunks_total`, `embedding_model`,
  `created_at`, `updated_at`

### `kb_chunks`
Fragmentos dos documentos, com embedding vectorial.
- `id` (PK), `documento_id` (FK), `ordem`, `conteudo`, `tokens`,
  `embedding` (vector de 1024 dimensões — modelo `baai/bge-m3`),
  `metadata` (JSON), `created_at`
- **Índice:** HNSW (cosine) sobre `embedding` para pesquisa semântica
  eficiente.

---

## 10. Chat e Assistente Virtual

### `chat_sessoes`
Sessões de conversa entre o utilizador e o Assistente.
- `id` (PK), `utilizador_id` (FK), `colaborador_id` (FK — opcional),
  `titulo`, `iniciada_em`, `ultima_actividade`, `arquivada` (bool)

### `chat_mensagens`
Cada turno da conversa (utilizador, assistente, sistema, ferramenta).
- `id` (PK), `sessao_id` (FK), `papel` (`user`/`assistant`/`system`/`tool`),
  `conteudo`, `tokens_input`, `tokens_output`, `latencia_ms`, `modelo`,
  `chunks_utilizados` (array de FK kb_chunks), `score_relevancia`,
  `escalada_para_dpc` (bool), `created_at`

### `escalacoes`
Perguntas com baixa confiança elevadas para tratamento humano da DPC.
- `id` (PK), `mensagem_id` (FK chat_mensagens), `sessao_id` (FK),
  `utilizador_id` (FK), `pergunta`, `contexto`,
  `estado` (`pendente` / `em_analise` / `respondida` / `adicionada_kb`),
  `criado_em`, `respondida_em`

### `agent_config`
Configuração do Assistente Virtual (singleton `chave = 'default'`).
- `id` (PK), `chave` (UQ), `system_prompt`, `mensagem_boas_vindas`,
  `email_escalacao`, `temperature`, `max_tokens`, `top_k`,
  `min_relevance_score`, `max_tool_steps`, `reasoning_effort`,
  `actualizado_por` (FK utilizadores), `updated_at`

### `comunidade_posts`
Publicações da Comunidade (página inicial). Só `rh_admin` cria/edita/remove.
- `id` (PK), `autor_id` (FK utilizadores), `titulo`, `conteudo`,
  `imagem` (link http/https — sem ficheiros na BD),
  `anexo_pdf`, `anexo_nome` (anexo PDF — reservado, ainda sem UI),
  `fixado` (bool), `created_at`, `updated_at`

### `comunidade_reacoes`
Uma reacção por utilizador e publicação.
- `id` (PK), `post_id` (FK, cascade), `utilizador_id` (FK, cascade),
  `tipo` (só `like`), `created_at` — UQ (`post_id`, `utilizador_id`)

### `comunidade_comentarios`
- `id` (PK), `post_id` (FK, cascade), `autor_id` (FK utilizadores),
  `conteudo`, `created_at`

### `eventos`
Eventos e Agenda. Só `rh_admin` cria/edita/remove; todos os perfis consultam.
- `id` (PK), `titulo`, `descricao`,
  `categoria` (`oficial` / `formacao` / `comunidade` / `obrigatorio` / `bem_estar`),
  `local` (texto livre), `zona` (`sede` / `talatona` / `academia` / `postos` / `online` — filtro),
  `link_online` (Teams), `inicio`, `fim` (timestamptz), `dia_inteiro` (bool),
  `destaque` (bool — fixado no cartão em destaque), `criado_por` (FK utilizadores),
  `created_at`, `updated_at`

### `evento_presencas`
Presenças confirmadas.
- `id` (PK), `evento_id` (FK, cascade), `utilizador_id` (FK, cascade),
  `created_at` — UQ (`evento_id`, `utilizador_id`)

---

## 11. Relações principais

Visão de alto nível (ver diagrama ERD na secção 22 do PRD):

```
utilizadores 1 ──┬── N colaboradores
                 └── N mentors
                 └── N chat_sessoes
                 └── N notificacoes

colaboradores 1 ──┬── 1 trilhos_onboarding (instância imutável)
                  ├── N progresso_onboarding
                  ├── N submissoes_documentos
                  ├── N quiz_resultados
                  ├── N mentor_avaliacoes
                  ├── N colaborador_feedback
                  ├── N onboarding_timeline
                  ├── N onboarding_comentarios
                  └── 0..1 mentor_assignments (activo)

trilhos_onboarding 1 ── N etapas_trilho
etapas_trilho     1 ── N progresso_onboarding
progresso_onboarding 1 ── N checklist_progresso

kb_documentos 1 ── N kb_chunks (com embedding)

chat_sessoes 1 ── N chat_mensagens
chat_mensagens 1 ── 0..1 escalacoes

vagas 1 ── N candidatos
candidatos 1 ── N entrevistas
candidatos 1 ── 0..1 colaboradores (conversão)
```

---

## 12. Requisitos da base de dados

- **PostgreSQL 15+** recomendado (por causa da extensão `pgvector`),
  ou equivalente com suporte a vector search (Azure PostgreSQL Flexible
  Server, AWS RDS, Google Cloud SQL, Neon).
- **Extensão obrigatória:** `pgvector` (para embeddings do RAG).
- **Tipos avançados usados:** `UUID`, `JSONB`, `ARRAY`, `TIMESTAMPTZ`,
  `VECTOR(1024)`.
- **Full-text search:** as tabelas `kb_chunks` e `faqs` beneficiam de
  índice FTS em português (`to_tsvector('portuguese', conteudo)`) para
  retrieval híbrido semântico + palavras-chave.

Se o IT preferir outro SGBD sem suporte nativo a vector:
- **SQL Server 2025+** ou **Azure SQL** — suportam VECTOR nativo.
- **Oracle 23ai** — suporta VECTOR nativo.
- Alternativa: manter dados relacionais no SGBD escolhido e usar uma
  base vectorial separada (Pinecone, Qdrant, Weaviate, Azure AI Search)
  apenas para o RAG.

---

## 13. Boas práticas ao implementar

- Todas as chaves estrangeiras que apontam para `colaboradores` ou
  `utilizadores` devem ter `ON DELETE CASCADE` (para permitir remoção
  completa de dados de uma pessoa — cumprimento da política de dados
  pessoais).
- Índices recomendados: em todos os `*_id` de FK e em campos usados
  como filtro (`estado`, `direccao`, `categoria`, `created_at`).
- **Auditoria como append-only:** as tabelas `audit_log`,
  `onboarding_audit` e `onboarding_timeline` não devem permitir
  `UPDATE` ou `DELETE` em produção — só `INSERT`.
- **Instância vs template:** ao atribuir um trilho, criar sempre uma
  cópia completa (trilho + etapas + checklists) — nunca ligar
  directamente ao template. Isto garante que edições posteriores do
  template não afectam colaboradores já em curso.

---

_Este documento é a referência de dados para o handover. Não substitui
o PRD funcional em [`../IT-Handover/DOCUMENTACAO.md`](../IT-Handover/DOCUMENTACAO.md);
complementa-o com o detalhe de estrutura das tabelas._
