-- Documentos de admissão novos ficam no Serviço de Ficheiros (só o id).
-- A coluna bytea mantém os ficheiros já entregues e passa a poder ficar vazia.

ALTER TABLE "admissao_submissoes" ADD COLUMN IF NOT EXISTS "ficheiro_id" text;
ALTER TABLE "admissao_submissoes" ALTER COLUMN "ficheiro" DROP NOT NULL;
