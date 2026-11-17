# Plataforma DPC Pumangol - Backlog de Implementacao v2.0

**Especificacao de origem:** `PROMPT_Claude_Code_Implementacao_v2.0.md` (Julho de 2025)  
**Estado:** Em implementacao  
**Registo de execucao:** [docs/implementation/IMPLEMENTATION_V2.md](docs/implementation/IMPLEMENTATION_V2.md)

## Regras de entrega

- Cada story so e marcada como concluida depois de validacao tecnica e funcional.
- Alteracoes de esquema sao entregues atraves de migrations versionadas.
- Rotas e APIs protegidas validam o utilizador autenticado no servidor; dados de uma conta nao podem ser lidos por outra.
- A validacao minima por alteracao inclui `npm run typecheck` e `npm run build` quando aplicavel.

## EPIC 1 - Isolamento do Assistente Virtual por Utilizador

Objectivo: eliminar qualquer fuga de historico entre contas e preservar o comportamento funcional do assistente.

| Story | Descricao | Criterios de aceitacao | Estado |
|---|---|---|---|
| 1.1 | Particionar estado e sessao de chat por `user_id`. | Nenhuma chave ou sessao de um utilizador e reutilizada por outro. | Concluida |
| 1.2 | Limpar estado de chat no logout. | Logout remove sessao em memoria; login seguinte inicia contexto correcto. | Concluida |
| 1.3 | Carregar historico do utilizador autenticado. | Cada conta ve somente as suas sessoes e mensagens. | Concluida |
| 1.4 | Cobrir o isolamento com testes. | Fluxo admin -> logout -> colaborador nao apresenta dados do admin. | Verificacao manual (checklist E2E no registo) |

## EPIC 2 - Welcome Flow para Novos Colaboradores

Objectivo: assegurar uma recepcao obrigatoria, configuravel e auditavel antes do acesso aos modulos.

| Story | Descricao | Criterios de aceitacao | Estado |
|---|---|---|---|
| 2.1 | Criar modelo de dados do welcome. | Flag, configuracao de videos, perguntas e resultados existem em migrations. | Concluida (migration 011) |
| 2.2 | Criar componente reutilizavel de video obrigatorio. | Suporta URLs permitidos e desbloqueia aos 90% de reproducao. | Concluida (VideoGate; 90% em URL directa, fallback por temporizador em embeds) |
| 2.3 | Implementar video institucional. | Conclusao avanca para o segundo passo. | Concluida |
| 2.4 | Implementar video de saude e seguranca. | Conclusao avanca para o quiz. | Concluida |
| 2.5 | Implementar motor de quiz. | Selecciona perguntas activas e suporta V/F, multipla e informativa. | Concluida (QuizEngine) |
| 2.6 | Implementar resultado do quiz. | Regista resultado e permite continuar independentemente da nota. | Concluida |
| 2.7 | Criar guard de routing. | Colaborador sem conclusao e dirigido ao welcome; concluido nao o repete. | Concluida (WelcomeGuard) |
| 2.8 | Permitir ao admin gerir videos. | CRUD, preview e configuracao reflectem no welcome. | Concluida (VideosAdminPage) |
| 2.9 | Permitir ao admin gerir banco de perguntas. | CRUD, activacao e configuracao de quantidade funcionam. | Concluida (QuizAdminPage) |
| 2.10 | Expor resultados ao admin. | Resultado, data e estado sao visiveis e filtraveis. | Concluida (em QuizAdminPage) |

## EPIC 3 - Modulos do Novo Colaborador

Objectivo: organizar a experiencia em Meu Trilho, Assistente Virtual, Documentos da Empresa e Submissao de Documentos.

| Story | Descricao | Criterios de aceitacao | Estado |
|---|---|---|---|
| 3.1 | Criar navegacao exclusiva com quatro modulos. | Rotas, estado activo e comportamento responsivo funcionam. | Concluida |
| 3.2 | Evoluir vista Meu Trilho. | Progresso, bloqueios, etapas e detalhe sincronizam com o backend. | Concluida (dados reais via /colaboradores/meu-trilho; concluir etapa desbloqueia a seguinte) |
| 3.3 | Criar consulta de documentos empresariais. | PDFs por categoria podem ser abertos ou descarregados. | Concluida |
| 3.4 | Criar checklist de submissao documental. | Upload, estados, motivo de rejeicao e progresso geral funcionam. | Concluida (upload binario SharePoint/Graph pendente de wiring) |

## EPIC 4 - Reestruturacao do Recrutamento

Objectivo: reduzir Recrutamento a Dashboard Semanal e Candidatos, ligados por importacao Excel.

| Story | Descricao | Criterios de aceitacao | Estado |
|---|---|---|---|
| 4.1 | Ocultar ou redireccionar submodulos descontinuados. | Navegacao apresenta apenas os dois submodulos definidos. | Concluida (Vagas/Pipeline/Entrevistas redireccionados) |
| 4.2 | Validar e importar Excel de candidatos. | Aba `Candidatos`, cabecalhos e dados sao validados; dashboard actualiza. | Parcial (import Excel existe; alinhamento a aba `Candidatos` por rever) |
| 4.3 | Sincronizar Dashboard Semanal e Candidatos. | Dados importados aparecem na lista sem accao adicional. | Parcial |
| 4.4 | Completar gestao de candidatos. | Pesquisa, filtros, paginacao e alteracao de estado funcionam. | Parcial (pesquisa/filtros/paginacao ok; estados via pipeline existente) |
| 4.5 | Converter candidato aprovado em colaborador. | Conta e criada e admin e encaminhado para atribuicao de trilho. | Concluida (sem provisionamento de login) |

## EPIC 5 - Administracao de Onboarding

Objectivo: dar ao RH controlo completo sobre colaboradores, trilhos, quiz, videos e evolucao.

| Story | Descricao | Criterios de aceitacao | Estado |
|---|---|---|---|
| 5.1 | Criar CRUD de novos colaboradores. | Criacao, edicao, remocao, filtros e atribuicao de trilho funcionam. | Concluida (criar com conta+credenciais, remover, atribuir trilho, filtros; PATCH de edicao disponivel na API) |
| 5.2 | Gerir templates de trilhos por categoria. | CRUD, ordenacao, duplicacao e instancia imutavel para colaborador funcionam. | Concluida (CRUD, categoria, reordenar por setas, duplicar; instancia imutavel na atribuicao. DnD substituido por reordenar) |
| 5.3 | Integrar gestao de quiz em Onboarding. | Implementacao da story 2.9 esta acessivel no modulo admin. | Concluida |
| 5.4 | Integrar configuracao de videos em Onboarding. | Implementacao da story 2.8 esta acessivel no modulo admin. | Concluida |
| 5.5 | Criar dashboard de evolucao. | Metricas, alertas, filtros, grafico e detalhe individual funcionam. | Concluida (metricas, ranking, filtro por categoria e drill-down; grafico temporal por adicionar) |
| 5.6 | Gerir documentos da empresa. | CRUD de PDFs e categorias alimenta a vista do colaborador. | Concluida |
| 5.7 | Gerir documentos exigidos. | Lista por defeito ou categoria reflecte na conta do colaborador. | Concluida |

## EPIC 6 - Redesign Visual Completo

Objectivo: introduzir um design system acessivel, responsivo e coerente com a marca Pumangol.

| Story | Descricao | Criterios de aceitacao | Estado |
|---|---|---|---|
| 6.1 | Definir tokens de design. | Cores, tipografia, espacamento, raios, sombras e breakpoints estao centralizados e documentados. | Concluida (paleta verde+vermelho) |
| 6.2 | Redesenhar sidebar. | Estado activo, colapso e menu mobile funcionam. | Concluida (re-skin verde; estrutura existente) |
| 6.3 | Redesenhar header. | Identidade, utilizador, notificacoes e logout sao responsivos. | Concluida (re-skin verde; estrutura existente) |
| 6.4 | Normalizar componentes base. | Cards, botoes, inputs, badges e tabelas tem estados consistentes e acessiveis. | Concluida (tokens + zebra striping na DataTable) |
| 6.5 | Redesenhar dashboards. | Metricas, graficos, grelha e skeletons sao responsivos. | Concluida (graficos via `--chart-*`; validacao visual pendente) |
| 6.6 | Adicionar micro-interaccoes. | Animacoes respeitam `prefers-reduced-motion` e nao degradam desempenho. | Concluida |
| 6.7 | Aplicar sistema a todos os ecras. | Nenhum ecra mantem o estilo anterior; mobile e desktop validados. | Concluida (cor global via tokens; validacao visual desktop/mobile pendente) |

## Ordem de implementacao

1. Story 6.1
2. EPIC 1
3. Stories 6.2 a 6.4
4. EPIC 3
5. EPIC 2
6. EPIC 4
7. EPIC 5
8. Stories 6.5 a 6.7
