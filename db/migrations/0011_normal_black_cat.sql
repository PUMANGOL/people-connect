CREATE TABLE "evento_presencas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"evento_id" uuid NOT NULL,
	"utilizador_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "eventos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"titulo" text NOT NULL,
	"descricao" text,
	"categoria" text DEFAULT 'oficial' NOT NULL,
	"local" text,
	"zona" text,
	"link_online" text,
	"inicio" timestamp with time zone NOT NULL,
	"fim" timestamp with time zone,
	"dia_inteiro" boolean DEFAULT false NOT NULL,
	"destaque" boolean DEFAULT false NOT NULL,
	"criado_por" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "evento_presencas" ADD CONSTRAINT "evento_presencas_evento_id_eventos_id_fk" FOREIGN KEY ("evento_id") REFERENCES "public"."eventos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evento_presencas" ADD CONSTRAINT "evento_presencas_utilizador_id_utilizadores_id_fk" FOREIGN KEY ("utilizador_id") REFERENCES "public"."utilizadores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eventos" ADD CONSTRAINT "eventos_criado_por_utilizadores_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."utilizadores"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "evento_presencas_evento_utilizador_uidx" ON "evento_presencas" USING btree ("evento_id","utilizador_id");--> statement-breakpoint
CREATE INDEX "evento_presencas_utilizador_idx" ON "evento_presencas" USING btree ("utilizador_id");--> statement-breakpoint
CREATE INDEX "eventos_inicio_idx" ON "eventos" USING btree ("inicio");