-- Catálogo dos valores do mural. O admin acrescenta tipos sem alterar o código.
-- A lista fechada em reconhecimentos.valor deixa de impedir chaves novas.

CREATE TABLE IF NOT EXISTS "reconhecimento_valores" (
  "chave" text PRIMARY KEY,
  "nome" text NOT NULL,
  "curto" text NOT NULL,
  "tom" text NOT NULL,
  "ordem" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

INSERT INTO "reconhecimento_valores" ("chave", "nome", "curto", "tom", "ordem")
VALUES
  ('seguranca', 'Segurança em primeiro', 'Segurança', 'navy', 1),
  ('cliente', 'Foco no cliente', 'Cliente', 'info', 2),
  ('equipa', 'Espírito de equipa', 'Equipa', 'gold', 3),
  ('inovacao', 'Inovação', 'Inovação', 'warning', 4),
  ('integridade', 'Integridade', 'Integridade', 'red', 5)
ON CONFLICT ("chave") DO NOTHING;

DO $$
DECLARE nome text;
BEGIN
  FOR nome IN
    SELECT c.conname
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
     WHERE n.nspname = 'public'
       AND t.relname = 'reconhecimentos'
       AND c.contype = 'c'
       AND pg_get_constraintdef(c.oid) ILIKE '%valor%'
       AND pg_get_constraintdef(c.oid) NOT ILIKE '%visibilidade%'
  LOOP
    EXECUTE format('ALTER TABLE reconhecimentos DROP CONSTRAINT %I', nome);
  END LOOP;
END $$;
