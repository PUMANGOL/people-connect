-- =============================================================================
-- Sincronizar mentores → utilizadores
--
-- Garante que todos os mentores com email válido têm uma conta em `utilizadores`
-- (perfil 'mentor', estado 'activo', SEM palavra-passe) e ficam ligados a ela
-- em `mentors.utilizador_id`.
--
-- Não mexe na tabela de autenticação (`user`, do better-auth): esse registo é
-- criado automaticamente pela plataforma quando a pessoa define a palavra-passe
-- (link de convite ou «Esqueci-me da palavra-passe»), sempre com o mesmo id.
--
-- Pode ser corrido mais do que uma vez: só cria/liga o que faltar.
-- Corre tudo numa transacção: revê os números do passo 4 antes do COMMIT.
-- =============================================================================

BEGIN;

-- 1. Ligar mentores a contas que JÁ existem com o mesmo email
--    (só se essa conta ainda não estiver ligada a outro mentor; utilizador_id é único)
WITH candidatos AS (
  SELECT DISTINCT ON (u.id)
         m.id AS mentor_id, u.id AS utilizador_id
    FROM mentors m
    JOIN utilizadores u ON lower(u.email) = lower(btrim(m.email))
   WHERE m.utilizador_id IS NULL
     AND NOT EXISTS (SELECT 1 FROM mentors m2 WHERE m2.utilizador_id = u.id)
   ORDER BY u.id, m.activo DESC, m.created_at
)
UPDATE mentors m
   SET utilizador_id = c.utilizador_id
  FROM candidatos c
 WHERE m.id = c.mentor_id;

-- 2. Criar contas para os mentores que ainda não têm nenhuma
--    (uma conta por email; emails repetidos em `mentors` geram uma só conta)
INSERT INTO utilizadores (nome, email, perfil, departamento, estado)
SELECT DISTINCT ON (lower(btrim(m.email)))
       COALESCE(NULLIF(btrim(m.nome), ''), 'Mentor'),
       lower(btrim(m.email)),
       'mentor'::perfil_utilizador,
       NULLIF(btrim(m.departamento), ''),
       'activo'
  FROM mentors m
 WHERE m.utilizador_id IS NULL
   AND btrim(m.email) ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'
   AND NOT EXISTS (SELECT 1 FROM utilizadores u WHERE lower(u.email) = lower(btrim(m.email)))
 ORDER BY lower(btrim(m.email)), m.activo DESC, m.created_at
ON CONFLICT (email) DO NOTHING;

-- 3. Ligar os mentores às contas acabadas de criar
--    (com email repetido, só um mentor fica ligado: o activo mais antigo)
WITH candidatos AS (
  SELECT DISTINCT ON (u.id)
         m.id AS mentor_id, u.id AS utilizador_id
    FROM mentors m
    JOIN utilizadores u ON lower(u.email) = lower(btrim(m.email))
   WHERE m.utilizador_id IS NULL
     AND NOT EXISTS (SELECT 1 FROM mentors m2 WHERE m2.utilizador_id = u.id)
   ORDER BY u.id, m.activo DESC, m.created_at
)
UPDATE mentors m
   SET utilizador_id = c.utilizador_id
  FROM candidatos c
 WHERE m.id = c.mentor_id;

-- 4. Verificação (rever antes do COMMIT)
SELECT
  count(*)                                                        AS mentores,
  count(*) FILTER (WHERE btrim(email) ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$') AS com_email_valido,
  count(*) FILTER (WHERE utilizador_id IS NOT NULL)               AS ligados_a_utilizador,
  count(*) FILTER (WHERE utilizador_id IS NULL
                     AND btrim(email) ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$') AS com_email_mas_sem_ligacao
  FROM mentors;
-- «com_email_mas_sem_ligacao» deve ficar só com os emails repetidos em `mentors`
-- (o 2.º, 3.º… mentor com o mesmo email não pode partilhar a conta).

-- 5. (OPCIONAL) Contas existentes com perfil «Colaborador» cujo email é de um mentor:
--    passar a «Mentor», como a plataforma faz ao atribuir um mentorado.
--    Atenção: a pessoa deixa de ver o menu de novo colaborador. Descomentar se pretendido.
-- UPDATE utilizadores u
--    SET perfil = 'mentor'::perfil_utilizador
--   FROM mentors m
--  WHERE m.utilizador_id = u.id
--    AND u.perfil = 'novo_colaborador'::perfil_utilizador;

COMMIT;
-- Para desistir em vez de gravar: trocar o COMMIT acima por ROLLBACK.
