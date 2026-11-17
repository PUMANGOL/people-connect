CREATE TABLE IF NOT EXISTS "acesso_convites" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "utilizador_id" uuid NOT NULL REFERENCES "utilizadores"("id") ON DELETE CASCADE,
  "token_hash" text NOT NULL UNIQUE,
  "expires_at" timestamptz NOT NULL,
  "used_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
