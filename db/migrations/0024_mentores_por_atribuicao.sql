-- A lista em `mentors` são colaboradores. Mentor é quem tem um novo
-- colaborador atribuído. Antigos e novos partilham o grupo Colaboradores.

UPDATE "grupo"
   SET "descricao" = 'Colaboradores. Os novos têm o mesmo acesso dos restantes.'
 WHERE "chave" = 'colaboradores';

UPDATE "grupo"
   SET "descricao" = 'Quem tem um novo colaborador atribuído. Vê o portal de mentor, além do acesso de colaborador.'
 WHERE "chave" = 'mentores';

INSERT INTO "grupo_utilizador" ("grupo_id", "utilizador_id")
SELECT g.id, u.id
  FROM "utilizadores" u
  JOIN "grupo" g ON g.chave = 'colaboradores'
 WHERE u.estado = 'activo'
   AND u.perfil IN ('mentor', 'novo_colaborador')
ON CONFLICT DO NOTHING;

INSERT INTO "grupo_utilizador" ("grupo_id", "utilizador_id")
SELECT g.id, m.utilizador_id
  FROM "mentors" m
  JOIN "grupo" g ON g.chave = 'mentores'
 WHERE m.utilizador_id IS NOT NULL
   AND EXISTS (
     SELECT 1 FROM "mentor_assignments" ma
      WHERE ma.mentor_id = m.id AND ma.activo = true
   )
ON CONFLICT DO NOTHING;

DELETE FROM "grupo_utilizador" gu
 USING "grupo" g
 WHERE gu.grupo_id = g.id
   AND g.chave = 'mentores'
   AND NOT EXISTS (
     SELECT 1
       FROM "mentors" m
       JOIN "mentor_assignments" ma ON ma.mentor_id = m.id AND ma.activo = true
      WHERE m.utilizador_id = gu.utilizador_id
   );
