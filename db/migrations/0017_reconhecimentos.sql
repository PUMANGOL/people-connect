-- Mural de reconhecimento: publicações, aplausos, comentários e voto do mês.

CREATE TABLE IF NOT EXISTS "reconhecimentos" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "autor_id" uuid NOT NULL REFERENCES "utilizadores"("id") ON DELETE CASCADE,
  "destinatario_id" uuid REFERENCES "utilizadores"("id") ON DELETE SET NULL,
  "destinatario_nome" text NOT NULL,
  "valor" text NOT NULL CHECK ("valor" IN ('seguranca', 'cliente', 'equipa', 'inovacao', 'integridade')),
  "mensagem" text NOT NULL,
  "visibilidade" text NOT NULL DEFAULT 'publico' CHECK ("visibilidade" IN ('publico', 'privado')),
  "informar_chefe" boolean NOT NULL DEFAULT false,
  "direccao" text,
  "posto" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "reconhecimentos_created_idx" ON "reconhecimentos" ("created_at");
CREATE INDEX IF NOT EXISTS "reconhecimentos_destinatario_idx" ON "reconhecimentos" ("destinatario_id");

CREATE TABLE IF NOT EXISTS "reconhecimento_aplausos" (
  "reconhecimento_id" uuid NOT NULL REFERENCES "reconhecimentos"("id") ON DELETE CASCADE,
  "utilizador_id" uuid NOT NULL REFERENCES "utilizadores"("id") ON DELETE CASCADE,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("reconhecimento_id", "utilizador_id")
);

CREATE TABLE IF NOT EXISTS "reconhecimento_comentarios" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "reconhecimento_id" uuid NOT NULL REFERENCES "reconhecimentos"("id") ON DELETE CASCADE,
  "autor_id" uuid REFERENCES "utilizadores"("id") ON DELETE SET NULL,
  "conteudo" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "reconhecimento_comentarios_idx" ON "reconhecimento_comentarios" ("reconhecimento_id");

CREATE TABLE IF NOT EXISTS "reconhecimento_votos" (
  "eleitor_id" uuid NOT NULL REFERENCES "utilizadores"("id") ON DELETE CASCADE,
  "nomeado_id" uuid NOT NULL REFERENCES "utilizadores"("id") ON DELETE CASCADE,
  "mes" date NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("eleitor_id", "mes")
);
