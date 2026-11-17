ALTER TABLE "mentors" ADD COLUMN IF NOT EXISTS "nome" text;--> statement-breakpoint
ALTER TABLE "mentors" ADD COLUMN IF NOT EXISTS "email" text;--> statement-breakpoint
ALTER TABLE "mentors" ADD COLUMN IF NOT EXISTS "departamento" text;--> statement-breakpoint
ALTER TABLE "mentors" ADD COLUMN IF NOT EXISTS "area" text;--> statement-breakpoint
ALTER TABLE "mentors" ADD COLUMN IF NOT EXISTS "funcao" text;--> statement-breakpoint
UPDATE "mentors" m
SET
  nome = COALESCE(NULLIF(btrim(m.nome), ''), u.nome),
  email = COALESCE(NULLIF(btrim(m.email), ''), u.email),
  departamento = COALESCE(NULLIF(btrim(m.departamento), ''), u.departamento)
FROM "utilizadores" u
WHERE m.utilizador_id = u.id;--> statement-breakpoint
ALTER TABLE "mentors" ALTER COLUMN "nome" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "mentors" ALTER COLUMN "utilizador_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "mentors" DROP CONSTRAINT IF EXISTS "mentors_utilizador_id_utilizadores_id_fk";--> statement-breakpoint
ALTER TABLE "mentors" ADD CONSTRAINT "mentors_utilizador_id_utilizadores_id_fk" FOREIGN KEY ("utilizador_id") REFERENCES "public"."utilizadores"("id") ON DELETE set null ON UPDATE no action;
