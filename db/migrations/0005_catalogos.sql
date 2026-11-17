-- Catálogos geridos pelo admin: funções, direcções e categorias de onboarding.
-- A categoria deixa de ser um enum fixo para aceitar valores criados no catálogo.

CREATE TABLE IF NOT EXISTS "funcoes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "nome" text NOT NULL UNIQUE,
  "activo" boolean NOT NULL DEFAULT true,
  "ordem" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "funcoes_nome_lower_uidx" ON "funcoes" (lower("nome"));

CREATE TABLE IF NOT EXISTS "categorias_onboarding" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "slug" text NOT NULL UNIQUE,
  "nome" text NOT NULL,
  "activo" boolean NOT NULL DEFAULT true,
  "ordem" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE "direccoes" ADD COLUMN IF NOT EXISTS "activo" boolean NOT NULL DEFAULT true;
ALTER TABLE "direccoes" ADD COLUMN IF NOT EXISTS "ordem" integer NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'colaboradores'
      AND column_name = 'categoria' AND udt_name = 'categoria_trilho'
  ) THEN
    ALTER TABLE colaboradores ALTER COLUMN categoria TYPE text USING categoria::text;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'trilhos_onboarding'
      AND column_name = 'categoria' AND udt_name = 'categoria_trilho'
  ) THEN
    ALTER TABLE trilhos_onboarding ALTER COLUMN categoria TYPE text USING categoria::text;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'mentor_avaliacoes'
      AND column_name = 'categoria' AND udt_name = 'categoria_trilho'
  ) THEN
    ALTER TABLE mentor_avaliacoes ALTER COLUMN categoria TYPE text USING categoria::text;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'colaborador_feedback'
      AND column_name = 'categoria' AND udt_name = 'categoria_trilho'
  ) THEN
    ALTER TABLE colaborador_feedback ALTER COLUMN categoria TYPE text USING categoria::text;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'mentors'
      AND column_name = 'categorias_suportadas' AND udt_name = '_categoria_trilho'
  ) THEN
    ALTER TABLE mentors
      ALTER COLUMN categorias_suportadas TYPE text[]
      USING categorias_suportadas::text[];
  END IF;
END $$;

INSERT INTO categorias_onboarding (slug, nome, ordem)
VALUES
  ('gestao', 'Direção / Gestão', 1),
  ('tecnicos', 'Técnicos', 2)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO direccoes (nome, sigla, ordem)
SELECT v.nome, v.sigla, v.ordem
FROM (VALUES
  ('Comissão Executiva', 'CEX', 1),
  ('Direcção Comercial', 'DCOM', 2),
  ('Direcção de Auditoria', 'DAUD', 3),
  ('Direcção de BLT – BSM, Logística e Transportes', 'DBLT', 4),
  ('Direcção de Compras & Aprovisionamento', 'DCA', 5),
  ('Direcção de Conveniência', 'DCONV', 6),
  ('Direcção de Marketing e Comunicação', 'DMC', 7),
  ('Direcção de Operações de Terminais', 'DOT', 8),
  ('Direcção de Pessoas e Cultura', 'DPC', 9),
  ('Direcção de Retalho & Manutenção', 'DRM', 10),
  ('Direcção de Segurança Patrimonial', 'DSP', 11),
  ('Direcção Financeira', 'DFIN', 12),
  ('Direcção Jurídica', 'DJUR', 13),
  ('Gabinete de Activos e Protocolo', 'GAP', 14),
  ('Gabinete de Construção', 'GCON', 15),
  ('Gabinete do PCE', 'GPCE', 16),
  ('Gabinete Técnico', 'GTEC', 17)
) AS v(nome, sigla, ordem)
WHERE NOT EXISTS (
  SELECT 1 FROM direccoes d WHERE d.nome = v.nome OR d.sigla = v.sigla
);

INSERT INTO direccoes (nome, sigla, ordem)
SELECT s.nome, 'X' || substr(md5(s.nome), 1, 8), 100
FROM (
  SELECT DISTINCT btrim(direccao) AS nome
  FROM colaboradores
  WHERE direccao IS NOT NULL AND btrim(direccao) <> ''
) s
WHERE NOT EXISTS (
  SELECT 1 FROM direccoes d WHERE lower(d.nome) = lower(s.nome)
);

INSERT INTO funcoes (nome)
SELECT s.nome
FROM (
  SELECT DISTINCT btrim(funcao) AS nome FROM colaboradores WHERE funcao IS NOT NULL
  UNION
  SELECT DISTINCT btrim(funcao) FROM trilhos_onboarding WHERE funcao IS NOT NULL
  UNION
  SELECT DISTINCT btrim(funcao) FROM mentors WHERE funcao IS NOT NULL
) s
WHERE s.nome <> ''
  AND NOT EXISTS (SELECT 1 FROM funcoes f WHERE lower(f.nome) = lower(s.nome));
