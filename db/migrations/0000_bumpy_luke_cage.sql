CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pgcrypto;--> statement-breakpoint
CREATE TYPE "public"."canal_notificacao" AS ENUM('email', 'in_app', 'ambos');--> statement-breakpoint
CREATE TYPE "public"."categoria_faq" AS ENUM('beneficios', 'seguranca', 'acessos', 'formacao', 'processos', 'cultura', 'it', 'logistica');--> statement-breakpoint
CREATE TYPE "public"."categoria_trilho" AS ENUM('gestao', 'tecnicos');--> statement-breakpoint
CREATE TYPE "public"."estado_avaliacao" AS ENUM('rascunho', 'submetida', 'validada');--> statement-breakpoint
CREATE TYPE "public"."estado_etapa" AS ENUM('pendente', 'em_preparacao', 'em_curso', 'aguardar_validacao', 'concluida', 'reagendada', 'bloqueada', 'cancelada', 'atrasada');--> statement-breakpoint
CREATE TYPE "public"."estado_faq" AS ENUM('rascunho', 'em_revisao', 'publicada', 'arquivada');--> statement-breakpoint
CREATE TYPE "public"."estado_notificacao" AS ENUM('pendente', 'enviada', 'falha', 'lida');--> statement-breakpoint
CREATE TYPE "public"."estado_onboarding" AS ENUM('nao_iniciado', 'em_curso', 'concluido');--> statement-breakpoint
CREATE TYPE "public"."estado_pipeline" AS ENUM('pedido_director', 'aprovacao_interna', 'publicacao', 'triagem_cvs', 'primeira_entrevista_dpc', 'segunda_entrevista_area', 'proposta', 'aceitacao', 'contratacao', 'transicao_onboarding');--> statement-breakpoint
CREATE TYPE "public"."estado_vaga" AS ENUM('aberta', 'em_triagem', 'em_entrevistas', 'em_proposta', 'fechada', 'cancelada');--> statement-breakpoint
CREATE TYPE "public"."fase_entrevista" AS ENUM('primeira_entrevista_dpc', 'segunda_entrevista_area', 'entrevista_tecnica');--> statement-breakpoint
CREATE TYPE "public"."momento_avaliacao" AS ENUM('dia_15', 'dia_30', 'dia_60', 'dia_90', 'final');--> statement-breakpoint
CREATE TYPE "public"."origem_candidato" AS ENUM('publicacao', 'referenciacao', 'headhunter', 'candidatura_espontanea');--> statement-breakpoint
CREATE TYPE "public"."perfil_utilizador" AS ENUM('rh_admin', 'mentor', 'novo_colaborador');--> statement-breakpoint
CREATE TYPE "public"."recomendacao_entrevista" AS ENUM('avancar', 'reserva', 'rejeitar');--> statement-breakpoint
CREATE TYPE "public"."tipo_etapa" AS ENUM('documental', 'conversacional', 'formacao', 'administrativo', 'misto');--> statement-breakpoint
CREATE TABLE "agent_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chave" text NOT NULL,
	"system_prompt" text,
	"mensagem_boas_vindas" text,
	"email_escalacao" text,
	"temperature" real,
	"max_tokens" integer,
	"top_k" integer,
	"min_relevance_score" real,
	"max_tool_steps" integer,
	"reasoning_effort" text,
	"actualizado_por" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_config_chave_unique" UNIQUE("chave")
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"utilizador_id" uuid,
	"accao" text NOT NULL,
	"entidade" text NOT NULL,
	"entidade_id" text,
	"dados_anteriores" jsonb,
	"dados_novos" jsonb,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_local" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"utilizador_id" uuid NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_local_utilizador_id_unique" UNIQUE("utilizador_id")
);
--> statement-breakpoint
CREATE TABLE "candidatos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vaga_id" uuid,
	"nome" text NOT NULL,
	"email" text,
	"telefone" text,
	"contactos" jsonb,
	"cv_ref" text,
	"origem" "origem_candidato" DEFAULT 'candidatura_espontanea' NOT NULL,
	"estado_pipeline" "estado_pipeline" DEFAULT 'triagem_cvs' NOT NULL,
	"data_entrada" date DEFAULT now(),
	"historico" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_mensagens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sessao_id" uuid NOT NULL,
	"papel" text NOT NULL,
	"conteudo" text NOT NULL,
	"tokens_input" integer,
	"tokens_output" integer,
	"latencia_ms" integer,
	"modelo" text,
	"chunks_utilizados" uuid[],
	"score_relevancia" real,
	"escalada_para_dpc" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_sessoes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"utilizador_id" uuid NOT NULL,
	"colaborador_id" uuid,
	"titulo" text,
	"iniciada_em" timestamp with time zone DEFAULT now() NOT NULL,
	"ultima_actividade" timestamp with time zone DEFAULT now() NOT NULL,
	"arquivada" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "checklist_progresso" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"progresso_id" uuid NOT NULL,
	"item_key" text NOT NULL,
	"concluido" boolean DEFAULT false NOT NULL,
	"concluido_em" timestamp with time zone,
	"concluido_por" uuid,
	"comentario" text
);
--> statement-breakpoint
CREATE TABLE "colaborador_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"colaborador_id" uuid NOT NULL,
	"categoria" "categoria_trilho",
	"momento" "momento_avaliacao" NOT NULL,
	"periodo_inicio" date,
	"periodo_fim" date,
	"avaliacao_geral" jsonb,
	"blocos_aprendizagem" jsonb,
	"principais_aprendizagens" text,
	"duvidas_reforco" jsonb,
	"stakeholders" jsonb,
	"oportunidades" jsonb,
	"suporte_adicional" jsonb,
	"feedback_mentor_gestor" jsonb,
	"classificacao_global" real,
	"comentarios_finais" text,
	"plano_accao" jsonb,
	"estado" "estado_avaliacao" DEFAULT 'rascunho' NOT NULL,
	"desbloqueado" boolean DEFAULT false NOT NULL,
	"submetido_em" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "colaboradores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"utilizador_id" uuid,
	"candidato_id_origem" uuid,
	"nome" text NOT NULL,
	"funcao" text,
	"direccao" text,
	"categoria" "categoria_trilho",
	"data_admissao" date,
	"estado_onboarding" "estado_onboarding" DEFAULT 'nao_iniciado' NOT NULL,
	"welcome_completed" boolean DEFAULT false NOT NULL,
	"trilho_id" uuid,
	"link_token" uuid DEFAULT gen_random_uuid(),
	"email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "direccoes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"sigla" text NOT NULL,
	"responsavel_faq_owner" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "direccoes_sigla_unique" UNIQUE("sigla")
);
--> statement-breakpoint
CREATE TABLE "documentos_empresa" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"categoria" text,
	"url" text,
	"ficheiro_ref" text,
	"descricao" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documentos_exigidos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"descricao" text,
	"obrigatorio" boolean DEFAULT true NOT NULL,
	"categoria" text,
	"ordem" integer DEFAULT 0 NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entrevistas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidato_id" uuid,
	"fase" "fase_entrevista",
	"entrevistador" text,
	"data" timestamp with time zone,
	"avaliacao" jsonb,
	"parecer" text,
	"recomendacao" "recomendacao_entrevista",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "escalacoes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mensagem_id" uuid,
	"sessao_id" uuid,
	"utilizador_id" uuid,
	"pergunta" text,
	"contexto" text,
	"estado" text DEFAULT 'pendente' NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"respondida_em" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "etapas_trilho" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trilho_id" uuid NOT NULL,
	"ordem" integer NOT NULL,
	"nome" text NOT NULL,
	"tipo" "tipo_etapa" DEFAULT 'documental' NOT NULL,
	"duracao_dias" integer,
	"descricao" text,
	"conteudo_ref" text,
	"criterio_conclusao" text,
	"obrigatoria" boolean DEFAULT true NOT NULL,
	"bloqueante" boolean DEFAULT false NOT NULL,
	"fase" text,
	"fase_nome" text,
	"responsavel_default" text,
	"checklist_items" jsonb,
	"evidencias_obrigatorias" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "faqs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"direccao" text,
	"categoria" "categoria_faq",
	"pergunta" text NOT NULL,
	"variantes" text[],
	"resposta" text NOT NULL,
	"palavras_chave" text[],
	"owner" text,
	"estado" "estado_faq" DEFAULT 'rascunho' NOT NULL,
	"vezes_citada" integer DEFAULT 0 NOT NULL,
	"data_actualizacao" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"embedding" vector(1024),
	"embedding_actualizado_em" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "kb_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"documento_id" uuid NOT NULL,
	"ordem" integer NOT NULL,
	"conteudo" text NOT NULL,
	"tokens" integer,
	"embedding" vector(1024),
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kb_documentos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"titulo" text NOT NULL,
	"descricao" text,
	"categoria" "categoria_faq",
	"direccao" text,
	"tipo_ficheiro" text,
	"ficheiro_url" text,
	"ficheiro_hash" text,
	"tamanho_bytes" integer,
	"criado_por" uuid,
	"estado" text DEFAULT 'processando' NOT NULL,
	"erro_processamento" text,
	"chunks_total" integer,
	"embedding_model" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mentor_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"colaborador_id" uuid NOT NULL,
	"mentor_id" uuid NOT NULL,
	"atribuido_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atribuido_por" uuid,
	"terminado_em" timestamp with time zone,
	"terminado_por" uuid,
	"motivo_termino" text,
	"activo" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mentor_avaliacoes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"colaborador_id" uuid NOT NULL,
	"mentor_id" uuid NOT NULL,
	"categoria" "categoria_trilho" NOT NULL,
	"momento" "momento_avaliacao" NOT NULL,
	"periodo_inicio" date,
	"periodo_fim" date,
	"criterios" jsonb,
	"comentarios_criterios" jsonb,
	"pontos_fortes" text,
	"oportunidades_melhoria" text,
	"situacoes_contributo" text,
	"classificacao_global" real,
	"manter_mentor" text,
	"necessita_orientacao" boolean,
	"necessita_clarificacao" boolean,
	"observacoes_dpc" text,
	"plano_accao" jsonb,
	"estado" "estado_avaliacao" DEFAULT 'rascunho' NOT NULL,
	"preenchido_por" uuid,
	"preenchido_em" timestamp with time zone,
	"validado_por" uuid,
	"validado_em" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mentors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"utilizador_id" uuid NOT NULL,
	"categorias_suportadas" "categoria_trilho"[],
	"activo" boolean DEFAULT true NOT NULL,
	"bio" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mentors_utilizador_id_unique" UNIQUE("utilizador_id")
);
--> statement-breakpoint
CREATE TABLE "notificacoes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"destinatario_id" uuid,
	"tipo" text NOT NULL,
	"canal" "canal_notificacao" DEFAULT 'in_app' NOT NULL,
	"mensagem" text NOT NULL,
	"estado" "estado_notificacao" DEFAULT 'pendente' NOT NULL,
	"link_accao" text,
	"enviada_em" timestamp with time zone,
	"lida_em" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "onboarding_audit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"utilizador_id" uuid,
	"utilizador_nome" text,
	"utilizador_role" text,
	"operacao" text NOT NULL,
	"entidade" text,
	"entidade_id" text,
	"colaborador_id" uuid,
	"valor_anterior" jsonb,
	"valor_novo" jsonb,
	"ip_origem" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "onboarding_comentarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"colaborador_id" uuid NOT NULL,
	"etapa_progresso_id" uuid,
	"autor_id" uuid,
	"autor_nome" text,
	"autor_role" text,
	"visivel_colaborador" boolean DEFAULT false NOT NULL,
	"texto" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "onboarding_notificacoes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"destinatario_id" uuid,
	"destinatario_role" text,
	"colaborador_id" uuid,
	"tipo" text NOT NULL,
	"titulo" text,
	"mensagem" text,
	"link_accao" text,
	"lida" boolean DEFAULT false NOT NULL,
	"lida_em" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "onboarding_timeline" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"colaborador_id" uuid NOT NULL,
	"tipo" text NOT NULL,
	"actor_id" uuid,
	"actor_nome" text,
	"actor_role" text,
	"descricao" text,
	"meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "progresso_onboarding" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"colaborador_id" uuid NOT NULL,
	"trilho_id" uuid,
	"etapa_id" uuid,
	"estado" "estado_etapa" DEFAULT 'pendente' NOT NULL,
	"data_inicio" date,
	"data_conclusao" date,
	"data_prevista" date,
	"responsavel" text
);
--> statement-breakpoint
CREATE TABLE "quiz_config" (
	"id" integer PRIMARY KEY NOT NULL,
	"perguntas_por_sessao" integer DEFAULT 5 NOT NULL,
	"ordem_aleatoria" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quiz_perguntas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tipo" text NOT NULL,
	"pergunta" text NOT NULL,
	"opcoes" jsonb,
	"resposta_correcta" integer,
	"explicacao" text,
	"activa" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quiz_resultados" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"colaborador_id" uuid,
	"utilizador_id" uuid,
	"total" integer NOT NULL,
	"acertos" integer NOT NULL,
	"percentagem" real NOT NULL,
	"detalhes" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "submissoes_documentos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"colaborador_id" uuid NOT NULL,
	"documento_exigido_id" uuid NOT NULL,
	"estado" text DEFAULT 'pendente' NOT NULL,
	"ficheiro_ref" text,
	"ficheiro_nome" text,
	"motivo_rejeicao" text,
	"submetido_em" timestamp with time zone,
	"avaliado_em" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trilhos_onboarding" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"funcao" text,
	"nome" text NOT NULL,
	"duracao_estimada" integer,
	"versao" integer DEFAULT 1 NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"categoria" "categoria_trilho",
	"descricao" text,
	"is_template" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "utilizadores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"email" text NOT NULL,
	"perfil" "perfil_utilizador" NOT NULL,
	"departamento" text,
	"estado" text DEFAULT 'activo' NOT NULL,
	"password_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "utilizadores_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "vagas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"titulo" text NOT NULL,
	"direccao" text,
	"justificativa" text,
	"numero_posicoes" integer DEFAULT 1 NOT NULL,
	"estado" "estado_vaga" DEFAULT 'aberta' NOT NULL,
	"data_abertura" date DEFAULT now(),
	"prazo_alvo" date,
	"requisitos" text,
	"owner" text,
	"referencia_externa" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "welcome_videos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slot" text NOT NULL,
	"titulo" text NOT NULL,
	"url" text,
	"descricao" text,
	"duracao_minima_segundos" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "welcome_videos_slot_unique" UNIQUE("slot")
);
--> statement-breakpoint
ALTER TABLE "agent_config" ADD CONSTRAINT "agent_config_actualizado_por_utilizadores_id_fk" FOREIGN KEY ("actualizado_por") REFERENCES "public"."utilizadores"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_utilizador_id_utilizadores_id_fk" FOREIGN KEY ("utilizador_id") REFERENCES "public"."utilizadores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_local" ADD CONSTRAINT "auth_local_utilizador_id_utilizadores_id_fk" FOREIGN KEY ("utilizador_id") REFERENCES "public"."utilizadores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidatos" ADD CONSTRAINT "candidatos_vaga_id_vagas_id_fk" FOREIGN KEY ("vaga_id") REFERENCES "public"."vagas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_mensagens" ADD CONSTRAINT "chat_mensagens_sessao_id_chat_sessoes_id_fk" FOREIGN KEY ("sessao_id") REFERENCES "public"."chat_sessoes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_sessoes" ADD CONSTRAINT "chat_sessoes_utilizador_id_utilizadores_id_fk" FOREIGN KEY ("utilizador_id") REFERENCES "public"."utilizadores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_sessoes" ADD CONSTRAINT "chat_sessoes_colaborador_id_colaboradores_id_fk" FOREIGN KEY ("colaborador_id") REFERENCES "public"."colaboradores"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_progresso" ADD CONSTRAINT "checklist_progresso_progresso_id_progresso_onboarding_id_fk" FOREIGN KEY ("progresso_id") REFERENCES "public"."progresso_onboarding"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_progresso" ADD CONSTRAINT "checklist_progresso_concluido_por_utilizadores_id_fk" FOREIGN KEY ("concluido_por") REFERENCES "public"."utilizadores"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "colaborador_feedback" ADD CONSTRAINT "colaborador_feedback_colaborador_id_colaboradores_id_fk" FOREIGN KEY ("colaborador_id") REFERENCES "public"."colaboradores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "colaboradores" ADD CONSTRAINT "colaboradores_utilizador_id_utilizadores_id_fk" FOREIGN KEY ("utilizador_id") REFERENCES "public"."utilizadores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "colaboradores" ADD CONSTRAINT "colaboradores_candidato_id_origem_candidatos_id_fk" FOREIGN KEY ("candidato_id_origem") REFERENCES "public"."candidatos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "colaboradores" ADD CONSTRAINT "colaboradores_trilho_id_trilhos_onboarding_id_fk" FOREIGN KEY ("trilho_id") REFERENCES "public"."trilhos_onboarding"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entrevistas" ADD CONSTRAINT "entrevistas_candidato_id_candidatos_id_fk" FOREIGN KEY ("candidato_id") REFERENCES "public"."candidatos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escalacoes" ADD CONSTRAINT "escalacoes_mensagem_id_chat_mensagens_id_fk" FOREIGN KEY ("mensagem_id") REFERENCES "public"."chat_mensagens"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escalacoes" ADD CONSTRAINT "escalacoes_sessao_id_chat_sessoes_id_fk" FOREIGN KEY ("sessao_id") REFERENCES "public"."chat_sessoes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escalacoes" ADD CONSTRAINT "escalacoes_utilizador_id_utilizadores_id_fk" FOREIGN KEY ("utilizador_id") REFERENCES "public"."utilizadores"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "etapas_trilho" ADD CONSTRAINT "etapas_trilho_trilho_id_trilhos_onboarding_id_fk" FOREIGN KEY ("trilho_id") REFERENCES "public"."trilhos_onboarding"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kb_chunks" ADD CONSTRAINT "kb_chunks_documento_id_kb_documentos_id_fk" FOREIGN KEY ("documento_id") REFERENCES "public"."kb_documentos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kb_documentos" ADD CONSTRAINT "kb_documentos_criado_por_utilizadores_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."utilizadores"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentor_assignments" ADD CONSTRAINT "mentor_assignments_colaborador_id_colaboradores_id_fk" FOREIGN KEY ("colaborador_id") REFERENCES "public"."colaboradores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentor_assignments" ADD CONSTRAINT "mentor_assignments_mentor_id_mentors_id_fk" FOREIGN KEY ("mentor_id") REFERENCES "public"."mentors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentor_assignments" ADD CONSTRAINT "mentor_assignments_atribuido_por_utilizadores_id_fk" FOREIGN KEY ("atribuido_por") REFERENCES "public"."utilizadores"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentor_assignments" ADD CONSTRAINT "mentor_assignments_terminado_por_utilizadores_id_fk" FOREIGN KEY ("terminado_por") REFERENCES "public"."utilizadores"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentor_avaliacoes" ADD CONSTRAINT "mentor_avaliacoes_colaborador_id_colaboradores_id_fk" FOREIGN KEY ("colaborador_id") REFERENCES "public"."colaboradores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentor_avaliacoes" ADD CONSTRAINT "mentor_avaliacoes_mentor_id_mentors_id_fk" FOREIGN KEY ("mentor_id") REFERENCES "public"."mentors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentor_avaliacoes" ADD CONSTRAINT "mentor_avaliacoes_preenchido_por_utilizadores_id_fk" FOREIGN KEY ("preenchido_por") REFERENCES "public"."utilizadores"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentor_avaliacoes" ADD CONSTRAINT "mentor_avaliacoes_validado_por_utilizadores_id_fk" FOREIGN KEY ("validado_por") REFERENCES "public"."utilizadores"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentors" ADD CONSTRAINT "mentors_utilizador_id_utilizadores_id_fk" FOREIGN KEY ("utilizador_id") REFERENCES "public"."utilizadores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notificacoes" ADD CONSTRAINT "notificacoes_destinatario_id_utilizadores_id_fk" FOREIGN KEY ("destinatario_id") REFERENCES "public"."utilizadores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_audit" ADD CONSTRAINT "onboarding_audit_utilizador_id_utilizadores_id_fk" FOREIGN KEY ("utilizador_id") REFERENCES "public"."utilizadores"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_comentarios" ADD CONSTRAINT "onboarding_comentarios_colaborador_id_colaboradores_id_fk" FOREIGN KEY ("colaborador_id") REFERENCES "public"."colaboradores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_comentarios" ADD CONSTRAINT "onboarding_comentarios_etapa_progresso_id_progresso_onboarding_id_fk" FOREIGN KEY ("etapa_progresso_id") REFERENCES "public"."progresso_onboarding"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_comentarios" ADD CONSTRAINT "onboarding_comentarios_autor_id_utilizadores_id_fk" FOREIGN KEY ("autor_id") REFERENCES "public"."utilizadores"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_notificacoes" ADD CONSTRAINT "onboarding_notificacoes_destinatario_id_utilizadores_id_fk" FOREIGN KEY ("destinatario_id") REFERENCES "public"."utilizadores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_notificacoes" ADD CONSTRAINT "onboarding_notificacoes_colaborador_id_colaboradores_id_fk" FOREIGN KEY ("colaborador_id") REFERENCES "public"."colaboradores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_timeline" ADD CONSTRAINT "onboarding_timeline_colaborador_id_colaboradores_id_fk" FOREIGN KEY ("colaborador_id") REFERENCES "public"."colaboradores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_timeline" ADD CONSTRAINT "onboarding_timeline_actor_id_utilizadores_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."utilizadores"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progresso_onboarding" ADD CONSTRAINT "progresso_onboarding_colaborador_id_colaboradores_id_fk" FOREIGN KEY ("colaborador_id") REFERENCES "public"."colaboradores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progresso_onboarding" ADD CONSTRAINT "progresso_onboarding_trilho_id_trilhos_onboarding_id_fk" FOREIGN KEY ("trilho_id") REFERENCES "public"."trilhos_onboarding"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progresso_onboarding" ADD CONSTRAINT "progresso_onboarding_etapa_id_etapas_trilho_id_fk" FOREIGN KEY ("etapa_id") REFERENCES "public"."etapas_trilho"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_resultados" ADD CONSTRAINT "quiz_resultados_colaborador_id_colaboradores_id_fk" FOREIGN KEY ("colaborador_id") REFERENCES "public"."colaboradores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_resultados" ADD CONSTRAINT "quiz_resultados_utilizador_id_utilizadores_id_fk" FOREIGN KEY ("utilizador_id") REFERENCES "public"."utilizadores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissoes_documentos" ADD CONSTRAINT "submissoes_documentos_colaborador_id_colaboradores_id_fk" FOREIGN KEY ("colaborador_id") REFERENCES "public"."colaboradores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissoes_documentos" ADD CONSTRAINT "submissoes_documentos_documento_exigido_id_documentos_exigidos_id_fk" FOREIGN KEY ("documento_exigido_id") REFERENCES "public"."documentos_exigidos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_sessoes_utilizador_idx" ON "chat_sessoes" USING btree ("utilizador_id");--> statement-breakpoint
CREATE UNIQUE INDEX "checklist_progresso_item_uidx" ON "checklist_progresso" USING btree ("progresso_id","item_key");--> statement-breakpoint
CREATE UNIQUE INDEX "colaborador_feedback_momento_uidx" ON "colaborador_feedback" USING btree ("colaborador_id","momento");--> statement-breakpoint
CREATE INDEX "colaboradores_utilizador_idx" ON "colaboradores" USING btree ("utilizador_id");--> statement-breakpoint
CREATE INDEX "kb_chunks_embedding_hnsw" ON "kb_chunks" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "kb_chunks_fts" ON "kb_chunks" USING gin (to_tsvector('portuguese', "conteudo"));--> statement-breakpoint
CREATE UNIQUE INDEX "mentor_assignments_um_activo" ON "mentor_assignments" USING btree ("colaborador_id") WHERE "mentor_assignments"."activo" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "mentor_avaliacoes_momento_uidx" ON "mentor_avaliacoes" USING btree ("colaborador_id","momento");--> statement-breakpoint
CREATE INDEX "progresso_colaborador_idx" ON "progresso_onboarding" USING btree ("colaborador_id");--> statement-breakpoint
CREATE UNIQUE INDEX "submissoes_colaborador_doc_uidx" ON "submissoes_documentos" USING btree ("colaborador_id","documento_exigido_id");--> statement-breakpoint
CREATE INDEX "faqs_fts" ON "faqs" USING gin (to_tsvector('portuguese', coalesce("pergunta", '') || ' ' || coalesce("resposta", '')));--> statement-breakpoint
INSERT INTO "quiz_config" ("id", "perguntas_por_sessao", "ordem_aleatoria") VALUES (1, 5, true);--> statement-breakpoint
INSERT INTO "welcome_videos" ("slot", "titulo") VALUES
  ('institucional', 'Vídeo institucional'),
  ('hse', 'Saúde e segurança'),
  ('dpc_beneficios', 'Benefícios'),
  ('dpc_avaliacao', 'Avaliação'),
  ('dpc_saude_bemestar', 'Saúde e bem-estar'),
  ('dpc_formacao', 'Formação');