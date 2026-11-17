-- Grupos e páginas. O perfil continua a limitar o menu; uma página restrita
-- só é visível para os grupos que a tenham em grupo_acesso.
-- O grupo DEV (sistema) gere esta matriz — não é um perfil de administrador.

CREATE TABLE IF NOT EXISTS "grupo" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "nome" text NOT NULL,
  "chave" text NOT NULL,
  "descricao" text,
  "sistema" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "grupo_chave_uidx" ON "grupo" ("chave");

CREATE TABLE IF NOT EXISTS "acesso" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "chave" text NOT NULL,
  "nome" text NOT NULL,
  "rota" text NOT NULL,
  "modulo" text NOT NULL,
  "perfis" text[] NOT NULL DEFAULT '{}',
  "ordem" integer NOT NULL DEFAULT 0,
  "restrito" boolean NOT NULL DEFAULT false,
  "sistema" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "acesso_chave_uidx" ON "acesso" ("chave");

CREATE TABLE IF NOT EXISTS "grupo_utilizador" (
  "grupo_id" uuid NOT NULL REFERENCES "grupo"("id") ON DELETE CASCADE,
  "utilizador_id" uuid NOT NULL REFERENCES "utilizadores"("id") ON DELETE CASCADE,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("grupo_id", "utilizador_id")
);

CREATE INDEX IF NOT EXISTS "grupo_utilizador_utilizador_idx" ON "grupo_utilizador" ("utilizador_id");

CREATE TABLE IF NOT EXISTS "grupo_acesso" (
  "grupo_id" uuid NOT NULL REFERENCES "grupo"("id") ON DELETE CASCADE,
  "acesso_id" uuid NOT NULL REFERENCES "acesso"("id") ON DELETE CASCADE,
  PRIMARY KEY ("grupo_id", "acesso_id")
);

INSERT INTO "grupo" ("nome", "chave", "descricao", "sistema")
VALUES (
  'DEV',
  'dev',
  'Contas de desenvolvimento. Gerem os acessos e podem ver páginas em teste.',
  true
)
ON CONFLICT ("chave") DO NOTHING;
