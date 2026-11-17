ALTER TABLE "processos_admissao" ADD COLUMN "documentos_token" text;--> statement-breakpoint
ALTER TABLE "processos_admissao" ADD COLUMN "documentos_enviado_em" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "processos_admissao" ADD CONSTRAINT "processos_admissao_documentos_token_unique" UNIQUE("documentos_token");--> statement-breakpoint
CREATE TABLE "admissao_documentos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"processo_id" uuid NOT NULL,
	"documento_exigido_id" uuid NOT NULL,
	"obrigatorio" boolean DEFAULT true NOT NULL,
	"ordem" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "admissao_submissoes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admissao_documento_id" uuid NOT NULL,
	"estado" text DEFAULT 'submetido' NOT NULL,
	"ficheiro_nome" text NOT NULL,
	"ficheiro_tipo" text NOT NULL,
	"ficheiro" bytea NOT NULL,
	"motivo" text,
	"submetido_em" timestamp with time zone DEFAULT now() NOT NULL,
	"avaliado_em" timestamp with time zone
);--> statement-breakpoint
ALTER TABLE "admissao_documentos" ADD CONSTRAINT "admissao_documentos_processo_id_processos_admissao_id_fk" FOREIGN KEY ("processo_id") REFERENCES "public"."processos_admissao"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admissao_documentos" ADD CONSTRAINT "admissao_documentos_exigido_fk" FOREIGN KEY ("documento_exigido_id") REFERENCES "public"."documentos_exigidos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admissao_submissoes" ADD CONSTRAINT "admissao_submissoes_documento_fk" FOREIGN KEY ("admissao_documento_id") REFERENCES "public"."admissao_documentos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "admissao_documentos_processo_doc_uidx" ON "admissao_documentos" USING btree ("processo_id","documento_exigido_id");--> statement-breakpoint
CREATE INDEX "admissao_documentos_processo_idx" ON "admissao_documentos" USING btree ("processo_id");--> statement-breakpoint
ALTER TABLE "admissao_submissoes" ADD CONSTRAINT "admissao_submissoes_admissao_documento_id_unique" UNIQUE("admissao_documento_id");