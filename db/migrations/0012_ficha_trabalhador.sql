CREATE TABLE "fichas_trabalhador" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"colaborador_id" uuid NOT NULL,
	"nome" text,
	"data_inicio" date,
	"numero_bi" text,
	"funcao" text,
	"sexo" text,
	"data_nascimento" date,
	"local_nascimento" text,
	"estado_civil" text,
	"morada" text,
	"provincia" text,
	"telefone" text,
	"telemovel" text,
	"email" text,
	"conjuge" jsonb,
	"filhos" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"contactos_emergencia" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"estado" text DEFAULT 'rascunho' NOT NULL,
	"submetida_em" timestamp with time zone,
	"actualizado_por" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fichas_trabalhador_colaborador_id_unique" UNIQUE("colaborador_id")
);
--> statement-breakpoint
ALTER TABLE "fichas_trabalhador" ADD CONSTRAINT "fichas_trabalhador_colaborador_id_colaboradores_id_fk" FOREIGN KEY ("colaborador_id") REFERENCES "public"."colaboradores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fichas_trabalhador" ADD CONSTRAINT "fichas_trabalhador_actualizado_por_utilizadores_id_fk" FOREIGN KEY ("actualizado_por") REFERENCES "public"."utilizadores"("id") ON DELETE set null ON UPDATE no action;