-- Perfil pessoal (foto, capa, contactos, interesses) e ficheiros anexados às etapas dos trilhos.
-- Os ficheiros vivem no bucket S3; aqui guardam-se apenas as chaves dos objectos.

CREATE TABLE IF NOT EXISTS "perfis_utilizador" (
  "utilizador_id" uuid PRIMARY KEY REFERENCES "utilizadores"("id") ON DELETE CASCADE,
  "foto_key" text,
  "capa_key" text,
  "bio" text,
  "localizacao" text,
  "telefone" text,
  "extensao" text,
  "disponibilidade" text NOT NULL DEFAULT 'disponivel'
    CHECK ("disponibilidade" IN ('disponivel', 'ocupado', 'ausente')),
  "posso_ajudar" text[] NOT NULL DEFAULT '{}',
  "interesses" text[] NOT NULL DEFAULT '{}',
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

-- Lista de documentos que o colaborador anexa na etapa: [{ "chave", "nome", "obrigatorio" }]
ALTER TABLE "etapas_trilho" ADD COLUMN IF NOT EXISTS "documentos_pedidos" jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS "etapa_anexos" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "progresso_id" uuid NOT NULL REFERENCES "progresso_onboarding"("id") ON DELETE CASCADE,
  "documento_chave" text NOT NULL,
  "ficheiro_key" text NOT NULL,
  "ficheiro_nome" text NOT NULL,
  "ficheiro_tipo" text NOT NULL,
  "tamanho" integer NOT NULL,
  "enviado_por" uuid REFERENCES "utilizadores"("id") ON DELETE SET NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "etapa_anexos_progresso_idx" ON "etapa_anexos" ("progresso_id");
