-- Estrutura orgânica vinda do directório Microsoft (Entra ID): unidade, cargo e local de cada pessoa.
-- Liga-se a utilizadores/colaboradores pelo email (UPN e aliases SMTP), sem chave estrangeira,
-- para que contas criadas depois da importação fiquem logo associadas.

CREATE TABLE IF NOT EXISTS "estrutura_organica" (
  "entra_object_id" uuid PRIMARY KEY,
  "nome" text NOT NULL,
  "emails" text[] NOT NULL DEFAULT '{}',
  "cargo" text,
  "direccao" text,
  "unidade" text,
  "local_trabalho" text,
  "cidade" text,
  "importado_em" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "estrutura_organica_emails_idx" ON "estrutura_organica" USING gin ("emails");
CREATE INDEX IF NOT EXISTS "estrutura_organica_unidade_idx" ON "estrutura_organica" ("unidade");
