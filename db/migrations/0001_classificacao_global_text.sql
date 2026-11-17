ALTER TABLE "colaborador_feedback" ALTER COLUMN "classificacao_global" SET DATA TYPE text USING "classificacao_global"::text;--> statement-breakpoint
ALTER TABLE "mentor_avaliacoes" ALTER COLUMN "classificacao_global" SET DATA TYPE text USING "classificacao_global"::text;
