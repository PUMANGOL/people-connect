-- Comunidade (página inicial): publicações dos admins, reacções e comentários dos utilizadores.

CREATE TABLE IF NOT EXISTS "comunidade_posts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "autor_id" uuid REFERENCES "utilizadores"("id") ON DELETE SET NULL,
  "titulo" text,
  "conteudo" text NOT NULL,
  "imagem" text,
  "fixado" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "comunidade_posts_created_idx" ON "comunidade_posts" ("created_at");

CREATE TABLE IF NOT EXISTS "comunidade_reacoes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "post_id" uuid NOT NULL REFERENCES "comunidade_posts"("id") ON DELETE CASCADE,
  "utilizador_id" uuid NOT NULL REFERENCES "utilizadores"("id") ON DELETE CASCADE,
  "tipo" text NOT NULL CHECK ("tipo" IN ('like', 'dislike')),
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "comunidade_reacoes_post_utilizador_uidx" ON "comunidade_reacoes" ("post_id", "utilizador_id");

CREATE TABLE IF NOT EXISTS "comunidade_comentarios" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "post_id" uuid NOT NULL REFERENCES "comunidade_posts"("id") ON DELETE CASCADE,
  "autor_id" uuid REFERENCES "utilizadores"("id") ON DELETE SET NULL,
  "conteudo" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "comunidade_comentarios_post_idx" ON "comunidade_comentarios" ("post_id");
