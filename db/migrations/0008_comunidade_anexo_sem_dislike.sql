-- Comunidade: campo para anexar um PDF às publicações (reservado, ainda sem UI)
-- e remoção da reacção "dislike" (só existe "like").

ALTER TABLE "comunidade_posts" ADD COLUMN IF NOT EXISTS "anexo_pdf" text;
ALTER TABLE "comunidade_posts" ADD COLUMN IF NOT EXISTS "anexo_nome" text;

DELETE FROM "comunidade_reacoes" WHERE "tipo" <> 'like';
ALTER TABLE "comunidade_reacoes" DROP CONSTRAINT IF EXISTS "comunidade_reacoes_tipo_check";
ALTER TABLE "comunidade_reacoes" ADD CONSTRAINT "comunidade_reacoes_tipo_check" CHECK ("tipo" = 'like');
