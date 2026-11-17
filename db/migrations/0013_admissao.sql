CREATE TYPE "public"."estado_admissao" AS ENUM('rascunho', 'em_aprovacao', 'oferta_enviada', 'oferta_aceite', 'documentacao_pendente', 'em_verificacoes', 'em_contratacao', 'em_cadastro', 'pre_onboarding', 'pronto_para_entrada', 'transferido_onboarding', 'cancelado');--> statement-breakpoint
CREATE TYPE "public"."estado_etapa_admissao" AS ENUM('pendente', 'em_curso', 'concluida', 'rejeitada');--> statement-breakpoint
CREATE TYPE "public"."semaforo_admissao" AS ENUM('verde', 'amarelo', 'vermelho');--> statement-breakpoint
CREATE TABLE "processos_admissao" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidato_ref" text,
	"nome" text NOT NULL,
	"email" text,
	"telefone" text,
	"funcao" text,
	"direccao" text,
	"empresa" text,
	"gestor" text,
	"local_trabalho" text,
	"categoria" text,
	"tipo_contrato" text,
	"data_prevista_entrada" date,
	"estado" "estado_admissao" DEFAULT 'rascunho' NOT NULL,
	"etapa_actual" text DEFAULT 'ADM-001' NOT NULL,
	"semaforo" "semaforo_admissao" DEFAULT 'verde' NOT NULL,
	"bloqueado" boolean DEFAULT false NOT NULL,
	"bloqueio_motivo" text,
	"motivo_cancelamento" text,
	"criado_por" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "etapas_admissao" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"processo_id" uuid NOT NULL,
	"codigo" text NOT NULL,
	"ordem" integer NOT NULL,
	"estado" "estado_etapa_admissao" DEFAULT 'pendente' NOT NULL,
	"resultado" text,
	"observacao" text,
	"concluida_em" timestamp with time zone,
	"concluida_por" uuid
);--> statement-breakpoint
ALTER TABLE "processos_admissao" ADD CONSTRAINT "processos_admissao_criado_por_utilizadores_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."utilizadores"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "etapas_admissao" ADD CONSTRAINT "etapas_admissao_processo_id_processos_admissao_id_fk" FOREIGN KEY ("processo_id") REFERENCES "public"."processos_admissao"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "etapas_admissao" ADD CONSTRAINT "etapas_admissao_concluida_por_utilizadores_id_fk" FOREIGN KEY ("concluida_por") REFERENCES "public"."utilizadores"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "processos_admissao_estado_idx" ON "processos_admissao" USING btree ("estado");--> statement-breakpoint
CREATE INDEX "processos_admissao_candidato_ref_idx" ON "processos_admissao" USING btree ("candidato_ref");--> statement-breakpoint
CREATE UNIQUE INDEX "processos_admissao_candidato_aberto_uidx" ON "processos_admissao" USING btree ("candidato_ref") WHERE candidato_ref IS NOT NULL AND estado <> 'cancelado';--> statement-breakpoint
CREATE UNIQUE INDEX "etapas_admissao_processo_codigo_uidx" ON "etapas_admissao" USING btree ("processo_id","codigo");--> statement-breakpoint
CREATE INDEX "etapas_admissao_processo_idx" ON "etapas_admissao" USING btree ("processo_id");