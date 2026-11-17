-- O menu passa a sair dos grupos. As páginas que já existiam recebem a
-- concessão do perfil actual (uma vez). Páginas criadas depois ficam
-- sem grupos até serem marcadas em Acessos.

ALTER TABLE "acesso" ADD COLUMN IF NOT EXISTS "concessao_inicial" boolean NOT NULL DEFAULT false;

INSERT INTO "grupo" ("nome", "chave", "descricao", "sistema")
VALUES
  ('Administradores', 'administradores', 'Páginas que o administrador DPC já via no menu.', true),
  ('Mentores', 'mentores', 'Páginas do portal de mentor.', true),
  ('Colaboradores', 'colaboradores', 'Páginas do colaborador.', true)
ON CONFLICT ("chave") DO NOTHING;

-- Páginas comuns aos três perfis.
INSERT INTO "grupo_acesso" ("grupo_id", "acesso_id")
SELECT g.id, a.id
  FROM "acesso" a
  JOIN "grupo" g ON g.chave IN ('administradores', 'mentores', 'colaboradores')
 WHERE a.sistema = false
   AND a.concessao_inicial = false
   AND 'rh_admin' = ANY(a.perfis)
   AND 'mentor' = ANY(a.perfis)
   AND 'novo_colaborador' = ANY(a.perfis)
ON CONFLICT DO NOTHING;

-- Só o administrador.
INSERT INTO "grupo_acesso" ("grupo_id", "acesso_id")
SELECT g.id, a.id
  FROM "acesso" a
  JOIN "grupo" g ON g.chave = 'administradores'
 WHERE a.sistema = false
   AND a.concessao_inicial = false
   AND 'rh_admin' = ANY(a.perfis)
   AND NOT ('mentor' = ANY(a.perfis))
   AND NOT ('novo_colaborador' = ANY(a.perfis))
ON CONFLICT DO NOTHING;

-- Portal do mentor (o admin só o vê se também estiver neste grupo).
INSERT INTO "grupo_acesso" ("grupo_id", "acesso_id")
SELECT g.id, a.id
  FROM "acesso" a
  JOIN "grupo" g ON g.chave = 'mentores'
 WHERE a.sistema = false
   AND a.concessao_inicial = false
   AND 'mentor' = ANY(a.perfis)
   AND NOT ('novo_colaborador' = ANY(a.perfis))
   AND NOT (
     'rh_admin' = ANY(a.perfis)
     AND 'mentor' = ANY(a.perfis)
     AND 'novo_colaborador' = ANY(a.perfis)
   )
ON CONFLICT DO NOTHING;

-- Páginas do colaborador.
INSERT INTO "grupo_acesso" ("grupo_id", "acesso_id")
SELECT g.id, a.id
  FROM "acesso" a
  JOIN "grupo" g ON g.chave = 'colaboradores'
 WHERE a.sistema = false
   AND a.concessao_inicial = false
   AND 'novo_colaborador' = ANY(a.perfis)
   AND NOT ('mentor' = ANY(a.perfis))
ON CONFLICT DO NOTHING;

UPDATE "acesso"
   SET "concessao_inicial" = true
 WHERE "sistema" = false
   AND "concessao_inicial" = false;

INSERT INTO "grupo_utilizador" ("grupo_id", "utilizador_id")
SELECT g.id, u.id
  FROM "utilizadores" u
  JOIN "grupo" g ON g.chave = 'administradores'
 WHERE u.perfil = 'rh_admin' AND u.estado = 'activo'
ON CONFLICT DO NOTHING;

INSERT INTO "grupo_utilizador" ("grupo_id", "utilizador_id")
SELECT g.id, u.id
  FROM "utilizadores" u
  JOIN "grupo" g ON g.chave = 'mentores'
 WHERE u.estado = 'activo'
   AND (
     u.perfil = 'mentor'
     OR EXISTS (
       SELECT 1 FROM "mentors" m
        WHERE m.utilizador_id = u.id AND m.activo = true
     )
   )
ON CONFLICT DO NOTHING;

INSERT INTO "grupo_utilizador" ("grupo_id", "utilizador_id")
SELECT g.id, u.id
  FROM "utilizadores" u
  JOIN "grupo" g ON g.chave = 'colaboradores'
 WHERE u.perfil = 'novo_colaborador' AND u.estado = 'activo'
ON CONFLICT DO NOTHING;
