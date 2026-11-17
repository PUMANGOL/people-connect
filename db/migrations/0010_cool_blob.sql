-- Migração gerada pelo drizzle-kit para pôr o snapshot em dia (o meta/ só tinha o 0000).
-- A versão original repetia, sem IF NOT EXISTS, tudo o que as migrações 0001–0009 já criaram
-- (tabelas da comunidade, catálogos, acesso_convites, colunas de mentors, welcome_videos…)
-- e falhava com "already exists", bloqueando as migrações seguintes.
-- Ficam só as conversões de tipo, que podem correr de novo sem efeito
-- (na BD, colaboradores.categoria e trilhos_onboarding.categoria ainda eram varchar).

ALTER TABLE "colaborador_feedback" ALTER COLUMN "categoria" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "colaborador_feedback" ALTER COLUMN "classificacao_global" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "colaboradores" ALTER COLUMN "categoria" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "mentor_avaliacoes" ALTER COLUMN "categoria" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "mentor_avaliacoes" ALTER COLUMN "classificacao_global" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "mentors" ALTER COLUMN "utilizador_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "mentors" ALTER COLUMN "categorias_suportadas" SET DATA TYPE text[];--> statement-breakpoint
ALTER TABLE "trilhos_onboarding" ALTER COLUMN "categoria" SET DATA TYPE text;
