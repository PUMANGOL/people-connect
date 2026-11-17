import { sql } from 'drizzle-orm';
import {
  boolean,
  customType,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  primaryKey,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

/** VECTOR(1024) — modelo baai/bge-m3, como em SCHEMA.md §9 e §12. */
export const vector = customType<{ data: number[] | string; driverData: string }>({
  dataType() {
    return 'vector(1024)';
  },
  toDriver(value) {
    return Array.isArray(value) ? `[${value.join(',')}]` : value;
  },
});

export const perfilUtilizador = pgEnum('perfil_utilizador', ['rh_admin', 'mentor', 'novo_colaborador']);
export const estadoVaga = pgEnum('estado_vaga', ['aberta', 'em_triagem', 'em_entrevistas', 'em_proposta', 'fechada', 'cancelada']);
export const estadoPipeline = pgEnum('estado_pipeline', [
  'pedido_director', 'aprovacao_interna', 'publicacao', 'triagem_cvs',
  'primeira_entrevista_dpc', 'segunda_entrevista_area', 'proposta',
  'aceitacao', 'contratacao', 'transicao_onboarding',
]);
export const origemCandidato = pgEnum('origem_candidato', ['publicacao', 'referenciacao', 'headhunter', 'candidatura_espontanea']);
export const faseEntrevista = pgEnum('fase_entrevista', ['primeira_entrevista_dpc', 'segunda_entrevista_area', 'entrevista_tecnica']);
export const recomendacaoEntrevista = pgEnum('recomendacao_entrevista', ['avancar', 'reserva', 'rejeitar']);
export const estadoOnboarding = pgEnum('estado_onboarding', ['nao_iniciado', 'em_curso', 'concluido']);
export const estadoAdmissao = pgEnum('estado_admissao', [
  'rascunho', 'em_aprovacao', 'oferta_enviada', 'oferta_aceite', 'documentacao_pendente',
  'em_verificacoes', 'em_contratacao', 'em_cadastro', 'pre_onboarding',
  'pronto_para_entrada', 'transferido_onboarding', 'cancelado',
]);
export const estadoEtapaAdmissao = pgEnum('estado_etapa_admissao', ['pendente', 'em_curso', 'concluida', 'rejeitada']);
export const semaforoAdmissao = pgEnum('semaforo_admissao', ['verde', 'amarelo', 'vermelho']);
export const tipoEtapa = pgEnum('tipo_etapa', ['documental', 'conversacional', 'formacao', 'administrativo', 'misto']);
export const estadoEtapa = pgEnum('estado_etapa', [
  'pendente', 'em_preparacao', 'em_curso', 'aguardar_validacao', 'concluida',
  'reagendada', 'bloqueada', 'cancelada', 'atrasada',
]);
export const categoriaTrilho = pgEnum('categoria_trilho', ['gestao', 'tecnicos']);
export const momentoAvaliacao = pgEnum('momento_avaliacao', ['dia_15', 'dia_30', 'dia_60', 'dia_90', 'final']);
export const estadoAvaliacao = pgEnum('estado_avaliacao', ['rascunho', 'submetida', 'validada']);
export const estadoFaq = pgEnum('estado_faq', ['rascunho', 'em_revisao', 'publicada', 'arquivada']);
export const categoriaFaq = pgEnum('categoria_faq', ['beneficios', 'seguranca', 'acessos', 'formacao', 'processos', 'cultura', 'it', 'logistica']);
export const canalNotificacao = pgEnum('canal_notificacao', ['email', 'in_app', 'ambos']);
export const estadoNotificacao = pgEnum('estado_notificacao', ['pendente', 'enviada', 'falha', 'lida']);

const ts = (name: string) => timestamp(name, { withTimezone: true });
const createdAt = () => ts('created_at').notNull().defaultNow();

export const direccoes = pgTable('direccoes', {
  id: uuid('id').primaryKey().defaultRandom(),
  nome: text('nome').notNull(),
  sigla: text('sigla').notNull().unique(),
  responsavelFaqOwner: text('responsavel_faq_owner'),
  activo: boolean('activo').notNull().default(true),
  ordem: integer('ordem').notNull().default(0),
  createdAt: createdAt(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
});

export const funcoes = pgTable('funcoes', {
  id: uuid('id').primaryKey().defaultRandom(),
  nome: text('nome').notNull().unique(),
  activo: boolean('activo').notNull().default(true),
  ordem: integer('ordem').notNull().default(0),
  createdAt: createdAt(),
});

export const categoriasOnboarding = pgTable('categorias_onboarding', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  nome: text('nome').notNull(),
  activo: boolean('activo').notNull().default(true),
  ordem: integer('ordem').notNull().default(0),
  createdAt: createdAt(),
});

export const utilizadores = pgTable('utilizadores', {
  id: uuid('id').primaryKey().defaultRandom(),
  nome: text('nome').notNull(),
  email: text('email').notNull().unique(),
  perfil: perfilUtilizador('perfil').notNull(),
  departamento: text('departamento'),
  estado: text('estado').notNull().default('activo'),
  /** O login compara bcrypt aqui, via pgcrypto. SCHEMA.md descreve a mesma hash em auth_local. */
  passwordHash: text('password_hash'),
  createdAt: createdAt(),
});

/** Perfil pessoal editável por cada utilizador. foto_key e capa_key são chaves no bucket S3. */
export const perfisUtilizador = pgTable('perfis_utilizador', {
  utilizadorId: uuid('utilizador_id').primaryKey().references(() => utilizadores.id, { onDelete: 'cascade' }),
  fotoKey: text('foto_key'),
  capaKey: text('capa_key'),
  bio: text('bio'),
  localizacao: text('localizacao'),
  telefone: text('telefone'),
  extensao: text('extensao'),
  /** disponivel | ocupado | ausente */
  disponibilidade: text('disponibilidade').notNull().default('disponivel'),
  possoAjudar: text('posso_ajudar').array().notNull().default(sql`'{}'::text[]`),
  interesses: text('interesses').array().notNull().default(sql`'{}'::text[]`),
  updatedAt: ts('updated_at').notNull().defaultNow(),
});

/**
 * Estrutura orgânica importada do directório Microsoft (Entra ID) com scripts/importar-estrutura-entra.ts.
 * Liga-se às pessoas pelo email (emails = UPN + aliases SMTP, em minúsculas).
 */
export const estruturaOrganica = pgTable('estrutura_organica', {
  entraObjectId: uuid('entra_object_id').primaryKey(),
  nome: text('nome').notNull(),
  emails: text('emails').array().notNull().default(sql`'{}'::text[]`),
  cargo: text('cargo'),
  direccao: text('direccao'),
  unidade: text('unidade'),
  localTrabalho: text('local_trabalho'),
  cidade: text('cidade'),
  importadoEm: ts('importado_em').notNull().defaultNow(),
}, (t) => [
  index('estrutura_organica_unidade_idx').on(t.unidade),
]);

/** Convite de primeira password (mentor sem conta). O token em claro só vai no email. */
export const acessoConvites = pgTable('acesso_convites', {
  id: uuid('id').primaryKey().defaultRandom(),
  utilizadorId: uuid('utilizador_id').notNull().references(() => utilizadores.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: ts('expires_at').notNull(),
  usedAt: ts('used_at'),
  createdAt: createdAt(),
});

export const authLocal = pgTable('auth_local', {
  id: uuid('id').primaryKey().defaultRandom(),
  utilizadorId: uuid('utilizador_id').notNull().references(() => utilizadores.id, { onDelete: 'cascade' }).unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: createdAt(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
});

export const auditLog = pgTable('audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  utilizadorId: uuid('utilizador_id').references(() => utilizadores.id, { onDelete: 'cascade' }),
  accao: text('accao').notNull(),
  entidade: text('entidade').notNull(),
  entidadeId: text('entidade_id'),
  dadosAnteriores: jsonb('dados_anteriores'),
  dadosNovos: jsonb('dados_novos'),
  timestamp: ts('timestamp').notNull().defaultNow(),
});

export const notificacoes = pgTable('notificacoes', {
  id: uuid('id').primaryKey().defaultRandom(),
  destinatarioId: uuid('destinatario_id').references(() => utilizadores.id, { onDelete: 'cascade' }),
  tipo: text('tipo').notNull(),
  canal: canalNotificacao('canal').notNull().default('in_app'),
  mensagem: text('mensagem').notNull(),
  estado: estadoNotificacao('estado').notNull().default('pendente'),
  linkAccao: text('link_accao'),
  enviadaEm: ts('enviada_em'),
  lidaEm: ts('lida_em'),
  createdAt: createdAt(),
});

export const vagas = pgTable('vagas', {
  id: uuid('id').primaryKey().defaultRandom(),
  titulo: text('titulo').notNull(),
  direccao: text('direccao'),
  justificativa: text('justificativa'),
  numeroPosicoes: integer('numero_posicoes').notNull().default(1),
  estado: estadoVaga('estado').notNull().default('aberta'),
  dataAbertura: date('data_abertura').defaultNow(),
  prazoAlvo: date('prazo_alvo'),
  requisitos: text('requisitos'),
  owner: text('owner'),
  referenciaExterna: text('referencia_externa'),
  createdAt: createdAt(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
});

export const candidatos = pgTable('candidatos', {
  id: uuid('id').primaryKey().defaultRandom(),
  vagaId: uuid('vaga_id').references(() => vagas.id, { onDelete: 'set null' }),
  nome: text('nome').notNull(),
  email: text('email'),
  telefone: text('telefone'),
  contactos: jsonb('contactos'),
  cvRef: text('cv_ref'),
  origem: origemCandidato('origem').notNull().default('candidatura_espontanea'),
  estadoPipeline: estadoPipeline('estado_pipeline').notNull().default('triagem_cvs'),
  dataEntrada: date('data_entrada').defaultNow(),
  historico: jsonb('historico'),
  createdAt: createdAt(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
});

export const processosAdmissao = pgTable('processos_admissao', {
  id: uuid('id').primaryKey().defaultRandom(),
  candidatoRef: text('candidato_ref'),
  nome: text('nome').notNull(),
  email: text('email'),
  telefone: text('telefone'),
  funcao: text('funcao'),
  direccao: text('direccao'),
  empresa: text('empresa'),
  gestor: text('gestor'),
  localTrabalho: text('local_trabalho'),
  categoria: text('categoria'),
  tipoContrato: text('tipo_contrato'),
  dataPrevistaEntrada: date('data_prevista_entrada'),
  estado: estadoAdmissao('estado').notNull().default('rascunho'),
  etapaActual: text('etapa_actual').notNull().default('ADM-001'),
  semaforo: semaforoAdmissao('semaforo').notNull().default('verde'),
  bloqueado: boolean('bloqueado').notNull().default(false),
  bloqueioMotivo: text('bloqueio_motivo'),
  motivoCancelamento: text('motivo_cancelamento'),
  ofertaValidade: date('oferta_validade'),
  ofertaCondicoes: text('oferta_condicoes'),
  ofertaEnviadaEm: ts('oferta_enviada_em'),
  ofertaDestinatario: text('oferta_destinatario'),
  documentosToken: text('documentos_token').unique(),
  documentosEnviadoEm: ts('documentos_enviado_em'),
  colaboradorId: uuid('colaborador_id'),
  criadoPor: uuid('criado_por').references(() => utilizadores.id, { onDelete: 'set null' }),
  createdAt: createdAt(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
}, (t) => [
  index('processos_admissao_estado_idx').on(t.estado),
  index('processos_admissao_candidato_ref_idx').on(t.candidatoRef),
]);

export const etapasAdmissao = pgTable('etapas_admissao', {
  id: uuid('id').primaryKey().defaultRandom(),
  processoId: uuid('processo_id').notNull().references(() => processosAdmissao.id, { onDelete: 'cascade' }),
  codigo: text('codigo').notNull(),
  ordem: integer('ordem').notNull(),
  estado: estadoEtapaAdmissao('estado').notNull().default('pendente'),
  resultado: text('resultado'),
  observacao: text('observacao'),
  concluidaEm: ts('concluida_em'),
  concluidaPor: uuid('concluida_por').references(() => utilizadores.id, { onDelete: 'set null' }),
}, (t) => [
  uniqueIndex('etapas_admissao_processo_codigo_uidx').on(t.processoId, t.codigo),
  index('etapas_admissao_processo_idx').on(t.processoId),
]);

export const entrevistas = pgTable('entrevistas', {
  id: uuid('id').primaryKey().defaultRandom(),
  candidatoId: uuid('candidato_id').references(() => candidatos.id, { onDelete: 'cascade' }),
  fase: faseEntrevista('fase'),
  entrevistador: text('entrevistador'),
  data: ts('data'),
  avaliacao: jsonb('avaliacao'),
  parecer: text('parecer'),
  recomendacao: recomendacaoEntrevista('recomendacao'),
  createdAt: createdAt(),
});

export const trilhosOnboarding = pgTable('trilhos_onboarding', {
  id: uuid('id').primaryKey().defaultRandom(),
  funcao: text('funcao'),
  nome: text('nome').notNull(),
  duracaoEstimada: integer('duracao_estimada'),
  versao: integer('versao').notNull().default(1),
  activo: boolean('activo').notNull().default(true),
  categoria: text('categoria'),
  descricao: text('descricao'),
  isTemplate: boolean('is_template').notNull().default(true),
  createdAt: createdAt(),
});

export const etapasTrilho = pgTable('etapas_trilho', {
  id: uuid('id').primaryKey().defaultRandom(),
  trilhoId: uuid('trilho_id').notNull().references(() => trilhosOnboarding.id, { onDelete: 'cascade' }),
  ordem: integer('ordem').notNull(),
  nome: text('nome').notNull(),
  tipo: tipoEtapa('tipo').notNull().default('documental'),
  duracaoDias: integer('duracao_dias'),
  descricao: text('descricao'),
  conteudoRef: text('conteudo_ref'),
  criterioConclusao: text('criterio_conclusao'),
  obrigatoria: boolean('obrigatoria').notNull().default(true),
  bloqueante: boolean('bloqueante').notNull().default(false),
  fase: text('fase'),
  faseNome: text('fase_nome'),
  responsavelDefault: text('responsavel_default'),
  checklistItems: jsonb('checklist_items'),
  evidenciasObrigatorias: boolean('evidencias_obrigatorias').notNull().default(false),
  /** [{ chave, nome, obrigatorio }] — documentos que o colaborador anexa nesta etapa. */
  documentosPedidos: jsonb('documentos_pedidos').notNull().default([]),
});

export const colaboradores = pgTable('colaboradores', {
  id: uuid('id').primaryKey().defaultRandom(),
  utilizadorId: uuid('utilizador_id').references(() => utilizadores.id, { onDelete: 'cascade' }),
  candidatoIdOrigem: uuid('candidato_id_origem').references(() => candidatos.id, { onDelete: 'set null' }),
  nome: text('nome').notNull(),
  funcao: text('funcao'),
  direccao: text('direccao'),
  categoria: text('categoria'),
  dataAdmissao: date('data_admissao'),
  estadoOnboarding: estadoOnboarding('estado_onboarding').notNull().default('nao_iniciado'),
  welcomeCompleted: boolean('welcome_completed').notNull().default(false),
  trilhoId: uuid('trilho_id').references(() => trilhosOnboarding.id, { onDelete: 'set null' }),
  linkToken: uuid('link_token').defaultRandom(),
  email: text('email'),
  createdAt: createdAt(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
}, (t) => [
  index('colaboradores_utilizador_idx').on(t.utilizadorId),
]);

export const progressoOnboarding = pgTable('progresso_onboarding', {
  id: uuid('id').primaryKey().defaultRandom(),
  colaboradorId: uuid('colaborador_id').notNull().references(() => colaboradores.id, { onDelete: 'cascade' }),
  trilhoId: uuid('trilho_id').references(() => trilhosOnboarding.id, { onDelete: 'cascade' }),
  etapaId: uuid('etapa_id').references(() => etapasTrilho.id, { onDelete: 'cascade' }),
  estado: estadoEtapa('estado').notNull().default('pendente'),
  dataInicio: date('data_inicio'),
  dataConclusao: date('data_conclusao'),
  dataPrevista: date('data_prevista'),
  responsavel: text('responsavel'),
  observacoes: text('observacoes'),
}, (t) => [
  index('progresso_colaborador_idx').on(t.colaboradorId),
]);

export const checklistProgresso = pgTable('checklist_progresso', {
  id: uuid('id').primaryKey().defaultRandom(),
  progressoId: uuid('progresso_id').notNull().references(() => progressoOnboarding.id, { onDelete: 'cascade' }),
  itemKey: text('item_key').notNull(),
  concluido: boolean('concluido').notNull().default(false),
  concluidoEm: ts('concluido_em'),
  concluidoPor: uuid('concluido_por').references(() => utilizadores.id, { onDelete: 'set null' }),
  comentario: text('comentario'),
}, (t) => [
  uniqueIndex('checklist_progresso_item_uidx').on(t.progressoId, t.itemKey),
]);

/** Ficheiros (no bucket S3) anexados pelo colaborador aos documentos pedidos numa etapa. */
export const etapaAnexos = pgTable('etapa_anexos', {
  id: uuid('id').primaryKey().defaultRandom(),
  progressoId: uuid('progresso_id').notNull().references(() => progressoOnboarding.id, { onDelete: 'cascade' }),
  documentoChave: text('documento_chave').notNull(),
  ficheiroKey: text('ficheiro_key').notNull(),
  ficheiroNome: text('ficheiro_nome').notNull(),
  ficheiroTipo: text('ficheiro_tipo').notNull(),
  tamanho: integer('tamanho').notNull(),
  enviadoPor: uuid('enviado_por').references(() => utilizadores.id, { onDelete: 'set null' }),
  createdAt: createdAt(),
}, (t) => [
  index('etapa_anexos_progresso_idx').on(t.progressoId),
]);

export const welcomeVideos = pgTable('welcome_videos', {
  id: uuid('id').primaryKey().defaultRandom(),
  slot: text('slot').notNull().unique(),
  titulo: text('titulo').notNull(),
  url: text('url'),
  descricao: text('descricao'),
  duracaoMinimaSegundos: integer('duracao_minima_segundos').notNull().default(0),
  ativo: boolean('ativo').notNull().default(true),
  ordem: integer('ordem').notNull().default(0),
  updatedAt: ts('updated_at').notNull().defaultNow(),
});

export const quizPerguntas = pgTable('quiz_perguntas', {
  id: uuid('id').primaryKey().defaultRandom(),
  tipo: text('tipo').notNull(),
  pergunta: text('pergunta').notNull(),
  opcoes: jsonb('opcoes'),
  respostaCorrecta: integer('resposta_correcta'),
  explicacao: text('explicacao'),
  activa: boolean('activa').notNull().default(true),
  createdAt: createdAt(),
});

export const quizConfig = pgTable('quiz_config', {
  id: integer('id').primaryKey(),
  perguntasPorSessao: integer('perguntas_por_sessao').notNull().default(5),
  ordemAleatoria: boolean('ordem_aleatoria').notNull().default(true),
  quizAtivo: boolean('quiz_ativo').notNull().default(true),
});

export const quizResultados = pgTable('quiz_resultados', {
  id: uuid('id').primaryKey().defaultRandom(),
  colaboradorId: uuid('colaborador_id').references(() => colaboradores.id, { onDelete: 'cascade' }),
  utilizadorId: uuid('utilizador_id').references(() => utilizadores.id, { onDelete: 'cascade' }),
  total: integer('total').notNull(),
  acertos: integer('acertos').notNull(),
  percentagem: real('percentagem').notNull(),
  detalhes: jsonb('detalhes'),
  createdAt: createdAt(),
});

export const documentosEmpresa = pgTable('documentos_empresa', {
  id: uuid('id').primaryKey().defaultRandom(),
  nome: text('nome').notNull(),
  categoria: text('categoria'),
  url: text('url'),
  ficheiroRef: text('ficheiro_ref'),
  descricao: text('descricao'),
  createdAt: createdAt(),
});

export const documentosExigidos = pgTable('documentos_exigidos', {
  id: uuid('id').primaryKey().defaultRandom(),
  nome: text('nome').notNull(),
  descricao: text('descricao'),
  obrigatorio: boolean('obrigatorio').notNull().default(true),
  categoria: text('categoria'),
  ordem: integer('ordem').notNull().default(0),
  activo: boolean('activo').notNull().default(true),
  createdAt: createdAt(),
});

const bytea = customType<{ data: Buffer }>({
  dataType() {
    return 'bytea';
  },
});

export const admissaoDocumentos = pgTable('admissao_documentos', {
  id: uuid('id').primaryKey().defaultRandom(),
  processoId: uuid('processo_id').notNull().references(() => processosAdmissao.id, { onDelete: 'cascade' }),
  documentoExigidoId: uuid('documento_exigido_id').notNull().references(() => documentosExigidos.id, { onDelete: 'restrict' }),
  obrigatorio: boolean('obrigatorio').notNull().default(true),
  ordem: integer('ordem').notNull().default(0),
  createdAt: createdAt(),
}, (t) => [
  uniqueIndex('admissao_documentos_processo_doc_uidx').on(t.processoId, t.documentoExigidoId),
  index('admissao_documentos_processo_idx').on(t.processoId),
]);

export const admissaoSubmissoes = pgTable('admissao_submissoes', {
  id: uuid('id').primaryKey().defaultRandom(),
  admissaoDocumentoId: uuid('admissao_documento_id').notNull().references(() => admissaoDocumentos.id, { onDelete: 'cascade' }).unique(),
  estado: text('estado').notNull().default('submetido'),
  ficheiroNome: text('ficheiro_nome').notNull(),
  ficheiroTipo: text('ficheiro_tipo').notNull(),
  ficheiro: bytea('ficheiro').notNull(),
  motivo: text('motivo'),
  submetidoEm: ts('submetido_em').notNull().defaultNow(),
  avaliadoEm: ts('avaliado_em'),
});

export const submissoesDocumentos = pgTable('submissoes_documentos', {
  id: uuid('id').primaryKey().defaultRandom(),
  colaboradorId: uuid('colaborador_id').notNull().references(() => colaboradores.id, { onDelete: 'cascade' }),
  documentoExigidoId: uuid('documento_exigido_id').notNull().references(() => documentosExigidos.id, { onDelete: 'cascade' }),
  estado: text('estado').notNull().default('pendente'),
  ficheiroRef: text('ficheiro_ref'),
  ficheiroNome: text('ficheiro_nome'),
  motivoRejeicao: text('motivo_rejeicao'),
  submetidoEm: ts('submetido_em'),
  avaliadoEm: ts('avaliado_em'),
  createdAt: createdAt(),
}, (t) => [
  uniqueIndex('submissoes_colaborador_doc_uidx').on(t.colaboradorId, t.documentoExigidoId),
]);

/**
 * Ficha do Trabalhador (modelo "FICHA DO NOVO TRABALHADOR Pumangol").
 * Preenchida pelo colaborador no Welcome Flow; a DPC consulta e exporta para Excel.
 * Cônjuge, filhos e contactos de emergência em jsonb (formas em lib/ficha-trabalhador.ts).
 */
export const fichasTrabalhador = pgTable('fichas_trabalhador', {
  id: uuid('id').primaryKey().defaultRandom(),
  colaboradorId: uuid('colaborador_id').notNull().references(() => colaboradores.id, { onDelete: 'cascade' }).unique(),
  nome: text('nome'),
  dataInicio: date('data_inicio'),
  numeroBi: text('numero_bi'),
  funcao: text('funcao'),
  sexo: text('sexo'),
  dataNascimento: date('data_nascimento'),
  localNascimento: text('local_nascimento'),
  estadoCivil: text('estado_civil'),
  morada: text('morada'),
  provincia: text('provincia'),
  telefone: text('telefone'),
  telemovel: text('telemovel'),
  email: text('email'),
  conjuge: jsonb('conjuge'),
  filhos: jsonb('filhos').notNull().default(sql`'[]'::jsonb`),
  contactosEmergencia: jsonb('contactos_emergencia').notNull().default(sql`'[]'::jsonb`),
  // rascunho | submetida
  estado: text('estado').notNull().default('rascunho'),
  submetidaEm: ts('submetida_em'),
  actualizadoPor: uuid('actualizado_por').references(() => utilizadores.id, { onDelete: 'set null' }),
  createdAt: createdAt(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
});

export const mentors = pgTable('mentors', {
  id: uuid('id').primaryKey().defaultRandom(),
  /** Conta de login opcional. A lista da empresa pode existir sem utilizador. */
  utilizadorId: uuid('utilizador_id').references(() => utilizadores.id, { onDelete: 'set null' }).unique(),
  nome: text('nome').notNull(),
  email: text('email'),
  departamento: text('departamento'),
  area: text('area'),
  funcao: text('funcao'),
  /** Início do contrato na empresa (ContractStartDate da lista de colaboradores). */
  dataInicioContrato: date('data_inicio_contrato'),
  categoriasSuportadas: text('categorias_suportadas').array(),
  activo: boolean('activo').notNull().default(true),
  bio: text('bio'),
  createdAt: createdAt(),
});

export const mentorAssignments = pgTable('mentor_assignments', {
  id: uuid('id').primaryKey().defaultRandom(),
  colaboradorId: uuid('colaborador_id').notNull().references(() => colaboradores.id, { onDelete: 'cascade' }),
  mentorId: uuid('mentor_id').notNull().references(() => mentors.id, { onDelete: 'cascade' }),
  atribuidoEm: ts('atribuido_em').notNull().defaultNow(),
  atribuidoPor: uuid('atribuido_por').references(() => utilizadores.id, { onDelete: 'set null' }),
  terminadoEm: ts('terminado_em'),
  terminadoPor: uuid('terminado_por').references(() => utilizadores.id, { onDelete: 'set null' }),
  motivoTermino: text('motivo_termino'),
  activo: boolean('activo').notNull().default(true),
}, (t) => [
  uniqueIndex('mentor_assignments_um_activo').on(t.colaboradorId).where(sql`${t.activo} = true`),
]);

export const mentorAvaliacoes = pgTable('mentor_avaliacoes', {
  id: uuid('id').primaryKey().defaultRandom(),
  colaboradorId: uuid('colaborador_id').notNull().references(() => colaboradores.id, { onDelete: 'cascade' }),
  mentorId: uuid('mentor_id').notNull().references(() => mentors.id, { onDelete: 'cascade' }),
  categoria: text('categoria').notNull(),
  momento: momentoAvaliacao('momento').notNull(),
  periodoInicio: date('periodo_inicio'),
  periodoFim: date('periodo_fim'),
  criterios: jsonb('criterios'),
  comentariosCriterios: jsonb('comentarios_criterios'),
  pontosFortes: text('pontos_fortes'),
  oportunidadesMelhoria: text('oportunidades_melhoria'),
  situacoesContributo: text('situacoes_contributo'),
  classificacaoGlobal: text('classificacao_global'),
  manterMentor: text('manter_mentor'),
  necessitaOrientacao: boolean('necessita_orientacao'),
  necessitaClarificacao: boolean('necessita_clarificacao'),
  observacoesDpc: text('observacoes_dpc'),
  planoAccao: jsonb('plano_accao'),
  estado: estadoAvaliacao('estado').notNull().default('rascunho'),
  preenchidoPor: uuid('preenchido_por').references(() => utilizadores.id, { onDelete: 'set null' }),
  preenchidoEm: ts('preenchido_em'),
  validadoPor: uuid('validado_por').references(() => utilizadores.id, { onDelete: 'set null' }),
  validadoEm: ts('validado_em'),
  createdAt: createdAt(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
}, (t) => [
  uniqueIndex('mentor_avaliacoes_momento_uidx').on(t.colaboradorId, t.momento),
]);

export const colaboradorFeedback = pgTable('colaborador_feedback', {
  id: uuid('id').primaryKey().defaultRandom(),
  colaboradorId: uuid('colaborador_id').notNull().references(() => colaboradores.id, { onDelete: 'cascade' }),
  categoria: text('categoria'),
  momento: momentoAvaliacao('momento').notNull(),
  periodoInicio: date('periodo_inicio'),
  periodoFim: date('periodo_fim'),
  avaliacaoGeral: jsonb('avaliacao_geral'),
  blocosAprendizagem: jsonb('blocos_aprendizagem'),
  principaisAprendizagens: text('principais_aprendizagens'),
  duvidasReforco: jsonb('duvidas_reforco'),
  stakeholders: jsonb('stakeholders'),
  oportunidades: jsonb('oportunidades'),
  suporteAdicional: jsonb('suporte_adicional'),
  feedbackMentorGestor: jsonb('feedback_mentor_gestor'),
  classificacaoGlobal: text('classificacao_global'),
  comentariosFinais: text('comentarios_finais'),
  planoAccao: jsonb('plano_accao'),
  estado: estadoAvaliacao('estado').notNull().default('rascunho'),
  desbloqueado: boolean('desbloqueado').notNull().default(false),
  submetidoEm: ts('submetido_em'),
  createdAt: createdAt(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
}, (t) => [
  uniqueIndex('colaborador_feedback_momento_uidx').on(t.colaboradorId, t.momento),
]);

export const onboardingTimeline = pgTable('onboarding_timeline', {
  id: uuid('id').primaryKey().defaultRandom(),
  colaboradorId: uuid('colaborador_id').notNull().references(() => colaboradores.id, { onDelete: 'cascade' }),
  tipo: text('tipo').notNull(),
  actorId: uuid('actor_id').references(() => utilizadores.id, { onDelete: 'set null' }),
  actorNome: text('actor_nome'),
  actorRole: text('actor_role'),
  descricao: text('descricao'),
  meta: jsonb('meta'),
  createdAt: createdAt(),
});

export const onboardingNotificacoes = pgTable('onboarding_notificacoes', {
  id: uuid('id').primaryKey().defaultRandom(),
  destinatarioId: uuid('destinatario_id').references(() => utilizadores.id, { onDelete: 'cascade' }),
  destinatarioRole: text('destinatario_role'),
  colaboradorId: uuid('colaborador_id').references(() => colaboradores.id, { onDelete: 'cascade' }),
  tipo: text('tipo').notNull(),
  titulo: text('titulo'),
  mensagem: text('mensagem'),
  linkAccao: text('link_accao'),
  lida: boolean('lida').notNull().default(false),
  lidaEm: ts('lida_em'),
  createdAt: createdAt(),
});

export const onboardingAudit = pgTable('onboarding_audit', {
  id: uuid('id').primaryKey().defaultRandom(),
  utilizadorId: uuid('utilizador_id').references(() => utilizadores.id, { onDelete: 'set null' }),
  utilizadorNome: text('utilizador_nome'),
  utilizadorRole: text('utilizador_role'),
  operacao: text('operacao').notNull(),
  entidade: text('entidade'),
  entidadeId: text('entidade_id'),
  colaboradorId: uuid('colaborador_id'),
  valorAnterior: jsonb('valor_anterior'),
  valorNovo: jsonb('valor_novo'),
  ipOrigem: text('ip_origem'),
  userAgent: text('user_agent'),
  createdAt: createdAt(),
});

export const onboardingComentarios = pgTable('onboarding_comentarios', {
  id: uuid('id').primaryKey().defaultRandom(),
  colaboradorId: uuid('colaborador_id').notNull().references(() => colaboradores.id, { onDelete: 'cascade' }),
  etapaProgressoId: uuid('etapa_progresso_id').references(() => progressoOnboarding.id, { onDelete: 'set null' }),
  autorId: uuid('autor_id').references(() => utilizadores.id, { onDelete: 'set null' }),
  autorNome: text('autor_nome'),
  autorRole: text('autor_role'),
  visivelColaborador: boolean('visivel_colaborador').notNull().default(false),
  texto: text('texto').notNull(),
  createdAt: createdAt(),
});

export const faqs = pgTable('faqs', {
  id: uuid('id').primaryKey().defaultRandom(),
  direccao: text('direccao'),
  categoria: categoriaFaq('categoria'),
  pergunta: text('pergunta').notNull(),
  variantes: text('variantes').array(),
  resposta: text('resposta').notNull(),
  palavrasChave: text('palavras_chave').array(),
  owner: text('owner'),
  estado: estadoFaq('estado').notNull().default('rascunho'),
  vezesCitada: integer('vezes_citada').notNull().default(0),
  dataActualizacao: ts('data_actualizacao').notNull().defaultNow(),
  createdAt: createdAt(),
  embedding: vector('embedding'),
  embeddingActualizadoEm: ts('embedding_actualizado_em'),
});

export const kbDocumentos = pgTable('kb_documentos', {
  id: uuid('id').primaryKey().defaultRandom(),
  titulo: text('titulo').notNull(),
  descricao: text('descricao'),
  categoria: categoriaFaq('categoria'),
  direccao: text('direccao'),
  tipoFicheiro: text('tipo_ficheiro'),
  ficheiroUrl: text('ficheiro_url'),
  ficheiroHash: text('ficheiro_hash'),
  tamanhoBytes: integer('tamanho_bytes'),
  criadoPor: uuid('criado_por').references(() => utilizadores.id, { onDelete: 'set null' }),
  estado: text('estado').notNull().default('processando'),
  erroProcessamento: text('erro_processamento'),
  chunksTotal: integer('chunks_total'),
  embeddingModel: text('embedding_model'),
  createdAt: createdAt(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
});

export const kbChunks = pgTable('kb_chunks', {
  id: uuid('id').primaryKey().defaultRandom(),
  documentoId: uuid('documento_id').notNull().references(() => kbDocumentos.id, { onDelete: 'cascade' }),
  ordem: integer('ordem').notNull(),
  conteudo: text('conteudo').notNull(),
  tokens: integer('tokens'),
  embedding: vector('embedding'),
  metadata: jsonb('metadata'),
  createdAt: createdAt(),
}, (t) => [
  index('kb_chunks_embedding_hnsw').using('hnsw', t.embedding.op('vector_cosine_ops')),
  index('kb_chunks_fts').using('gin', sql`to_tsvector('portuguese', ${t.conteudo})`),
]);

export const chatSessoes = pgTable('chat_sessoes', {
  id: uuid('id').primaryKey().defaultRandom(),
  utilizadorId: uuid('utilizador_id').notNull().references(() => utilizadores.id, { onDelete: 'cascade' }),
  colaboradorId: uuid('colaborador_id').references(() => colaboradores.id, { onDelete: 'set null' }),
  titulo: text('titulo'),
  iniciadaEm: ts('iniciada_em').notNull().defaultNow(),
  ultimaActividade: ts('ultima_actividade').notNull().defaultNow(),
  arquivada: boolean('arquivada').notNull().default(false),
}, (t) => [
  index('chat_sessoes_utilizador_idx').on(t.utilizadorId),
]);

export const chatMensagens = pgTable('chat_mensagens', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessaoId: uuid('sessao_id').notNull().references(() => chatSessoes.id, { onDelete: 'cascade' }),
  papel: text('papel').notNull(),
  conteudo: text('conteudo').notNull(),
  tokensInput: integer('tokens_input'),
  tokensOutput: integer('tokens_output'),
  latenciaMs: integer('latencia_ms'),
  modelo: text('modelo'),
  chunksUtilizados: uuid('chunks_utilizados').array(),
  scoreRelevancia: real('score_relevancia'),
  escaladaParaDpc: boolean('escalada_para_dpc').notNull().default(false),
  createdAt: createdAt(),
});

export const escalacoes = pgTable('escalacoes', {
  id: uuid('id').primaryKey().defaultRandom(),
  mensagemId: uuid('mensagem_id').references(() => chatMensagens.id, { onDelete: 'set null' }),
  sessaoId: uuid('sessao_id').references(() => chatSessoes.id, { onDelete: 'cascade' }),
  utilizadorId: uuid('utilizador_id').references(() => utilizadores.id, { onDelete: 'set null' }),
  pergunta: text('pergunta'),
  contexto: text('contexto'),
  estado: text('estado').notNull().default('pendente'),
  criadoEm: ts('criado_em').notNull().defaultNow(),
  respondidaEm: ts('respondida_em'),
});

export const agentConfig = pgTable('agent_config', {
  id: uuid('id').primaryKey().defaultRandom(),
  chave: text('chave').notNull().unique(),
  systemPrompt: text('system_prompt'),
  mensagemBoasVindas: text('mensagem_boas_vindas'),
  emailEscalacao: text('email_escalacao'),
  temperature: real('temperature'),
  maxTokens: integer('max_tokens'),
  topK: integer('top_k'),
  minRelevanceScore: real('min_relevance_score'),
  maxToolSteps: integer('max_tool_steps'),
  reasoningEffort: text('reasoning_effort'),
  actualizadoPor: uuid('actualizado_por').references(() => utilizadores.id, { onDelete: 'set null' }),
  updatedAt: ts('updated_at').notNull().defaultNow(),
});

// ===== Comunidade (página inicial) =====
// Admins publicam; todos os utilizadores dão like e comentam.

export const comunidadePosts = pgTable('comunidade_posts', {
  id: uuid('id').primaryKey().defaultRandom(),
  autorId: uuid('autor_id').references(() => utilizadores.id, { onDelete: 'set null' }),
  titulo: text('titulo'),
  conteudo: text('conteudo').notNull(),
  imagem: text('imagem'),
  // Anexo PDF (link/caminho do ficheiro + nome original) — reservado para uso futuro
  anexoPdf: text('anexo_pdf'),
  anexoNome: text('anexo_nome'),
  fixado: boolean('fixado').notNull().default(false),
  createdAt: createdAt(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
}, (t) => [
  index('comunidade_posts_created_idx').on(t.createdAt),
]);

export const comunidadeReacoes = pgTable('comunidade_reacoes', {
  id: uuid('id').primaryKey().defaultRandom(),
  postId: uuid('post_id').notNull().references(() => comunidadePosts.id, { onDelete: 'cascade' }),
  utilizadorId: uuid('utilizador_id').notNull().references(() => utilizadores.id, { onDelete: 'cascade' }),
  tipo: text('tipo').notNull(), // só 'like'
  createdAt: createdAt(),
}, (t) => [
  uniqueIndex('comunidade_reacoes_post_utilizador_uidx').on(t.postId, t.utilizadorId),
]);

export const comunidadeComentarios = pgTable('comunidade_comentarios', {
  id: uuid('id').primaryKey().defaultRandom(),
  postId: uuid('post_id').notNull().references(() => comunidadePosts.id, { onDelete: 'cascade' }),
  autorId: uuid('autor_id').references(() => utilizadores.id, { onDelete: 'set null' }),
  conteudo: text('conteudo').notNull(),
  createdAt: createdAt(),
}, (t) => [
  index('comunidade_comentarios_post_idx').on(t.postId),
]);

// ===== Reconhecimento (mural de valores) =====

export const reconhecimentos = pgTable('reconhecimentos', {
  id: uuid('id').primaryKey().defaultRandom(),
  autorId: uuid('autor_id').notNull().references(() => utilizadores.id, { onDelete: 'cascade' }),
  destinatarioId: uuid('destinatario_id').references(() => utilizadores.id, { onDelete: 'set null' }),
  destinatarioNome: text('destinatario_nome').notNull(),
  valor: text('valor').notNull(),
  mensagem: text('mensagem').notNull(),
  visibilidade: text('visibilidade').notNull().default('publico'),
  informarChefe: boolean('informar_chefe').notNull().default(false),
  direccao: text('direccao'),
  posto: boolean('posto').notNull().default(false),
  createdAt: createdAt(),
}, (t) => [
  index('reconhecimentos_created_idx').on(t.createdAt),
  index('reconhecimentos_destinatario_idx').on(t.destinatarioId),
]);

export const reconhecimentoAplausos = pgTable('reconhecimento_aplausos', {
  reconhecimentoId: uuid('reconhecimento_id').notNull().references(() => reconhecimentos.id, { onDelete: 'cascade' }),
  utilizadorId: uuid('utilizador_id').notNull().references(() => utilizadores.id, { onDelete: 'cascade' }),
  createdAt: createdAt(),
}, (t) => [
  uniqueIndex('reconhecimento_aplausos_uidx').on(t.reconhecimentoId, t.utilizadorId),
]);

export const reconhecimentoComentarios = pgTable('reconhecimento_comentarios', {
  id: uuid('id').primaryKey().defaultRandom(),
  reconhecimentoId: uuid('reconhecimento_id').notNull().references(() => reconhecimentos.id, { onDelete: 'cascade' }),
  autorId: uuid('autor_id').references(() => utilizadores.id, { onDelete: 'set null' }),
  conteudo: text('conteudo').notNull(),
  createdAt: createdAt(),
}, (t) => [
  index('reconhecimento_comentarios_idx').on(t.reconhecimentoId),
]);

export const reconhecimentoVotos = pgTable('reconhecimento_votos', {
  eleitorId: uuid('eleitor_id').notNull().references(() => utilizadores.id, { onDelete: 'cascade' }),
  nomeadoId: uuid('nomeado_id').notNull().references(() => utilizadores.id, { onDelete: 'cascade' }),
  mes: date('mes').notNull(),
  createdAt: createdAt(),
}, (t) => [
  uniqueIndex('reconhecimento_votos_eleitor_mes_uidx').on(t.eleitorId, t.mes),
]);

// ============================================================
// Eventos e Agenda — o admin regista; todos os perfis consultam o calendário
// e confirmam presença.
// ============================================================

export const eventos = pgTable('eventos', {
  id: uuid('id').primaryKey().defaultRandom(),
  titulo: text('titulo').notNull(),
  descricao: text('descricao'),
  // oficial | formacao | comunidade | obrigatorio | bem_estar (ver CATEGORIAS_EVENTO no frontend)
  categoria: text('categoria').notNull().default('oficial'),
  // Local livre (ex.: "Auditório Sede") + zona para o filtro (sede | talatona | academia | postos | online)
  local: text('local'),
  zona: text('zona'),
  // Link da reunião online (Microsoft Teams)
  linkOnline: text('link_online'),
  inicio: ts('inicio').notNull(),
  fim: ts('fim'),
  diaInteiro: boolean('dia_inteiro').notNull().default(false),
  // Fixado como evento em destaque (senão, o destaque é o próximo evento)
  destaque: boolean('destaque').notNull().default(false),
  criadoPor: uuid('criado_por').references(() => utilizadores.id, { onDelete: 'set null' }),
  createdAt: createdAt(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
}, (t) => [
  index('eventos_inicio_idx').on(t.inicio),
]);

/**
 * Controlo de acesso por página. O perfil (rh_admin, mentor, novo_colaborador)
 * continua a ser o tecto. Uma página restrita só aparece a quem estiver num
 * grupo com esse acesso — para testar em produção sem abrir a toda a gente.
 * O grupo `dev` gere esta matriz; não é um perfil de administrador.
 */
export const grupos = pgTable('grupo', {
  id: uuid('id').primaryKey().defaultRandom(),
  nome: text('nome').notNull(),
  chave: text('chave').notNull().unique(),
  descricao: text('descricao'),
  sistema: boolean('sistema').notNull().default(false),
  createdAt: createdAt(),
});

export const acessos = pgTable('acesso', {
  id: uuid('id').primaryKey().defaultRandom(),
  chave: text('chave').notNull().unique(),
  nome: text('nome').notNull(),
  rota: text('rota').notNull(),
  modulo: text('modulo').notNull(),
  perfis: text('perfis').array().notNull().default(sql`'{}'::text[]`),
  ordem: integer('ordem').notNull().default(0),
  restrito: boolean('restrito').notNull().default(false),
  /** true depois da concessão inicial. Páginas novas ficam false e sem grupos. */
  concessaoInicial: boolean('concessao_inicial').notNull().default(false),
  sistema: boolean('sistema').notNull().default(false),
  createdAt: createdAt(),
});

export const grupoUtilizador = pgTable('grupo_utilizador', {
  grupoId: uuid('grupo_id').notNull().references(() => grupos.id, { onDelete: 'cascade' }),
  utilizadorId: uuid('utilizador_id').notNull().references(() => utilizadores.id, { onDelete: 'cascade' }),
  createdAt: createdAt(),
}, (t) => [
  primaryKey({ columns: [t.grupoId, t.utilizadorId] }),
]);

export const grupoAcesso = pgTable('grupo_acesso', {
  grupoId: uuid('grupo_id').notNull().references(() => grupos.id, { onDelete: 'cascade' }),
  acessoId: uuid('acesso_id').notNull().references(() => acessos.id, { onDelete: 'cascade' }),
}, (t) => [
  primaryKey({ columns: [t.grupoId, t.acessoId] }),
]);

export const eventoPresencas = pgTable('evento_presencas', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventoId: uuid('evento_id').notNull().references(() => eventos.id, { onDelete: 'cascade' }),
  utilizadorId: uuid('utilizador_id').notNull().references(() => utilizadores.id, { onDelete: 'cascade' }),
  createdAt: createdAt(),
}, (t) => [
  uniqueIndex('evento_presencas_evento_utilizador_uidx').on(t.eventoId, t.utilizadorId),
  index('evento_presencas_utilizador_idx').on(t.utilizadorId),
]);
