ALTER TABLE "processos_admissao" ADD COLUMN "oferta_validade" date;--> statement-breakpoint
ALTER TABLE "processos_admissao" ADD COLUMN "oferta_condicoes" text;--> statement-breakpoint
ALTER TABLE "processos_admissao" ADD COLUMN "oferta_enviada_em" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "processos_admissao" ADD COLUMN "oferta_destinatario" text;