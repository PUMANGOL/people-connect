-- Comissão Executiva: cinco colaboradores, com conta sem password e grupo próprio.
-- Perfil `mentor` é o de colaborador na aplicação. Não entram no grupo Mentores.

WITH pessoas (nome, email, funcao) AS (
  VALUES
    ('Ivanilson Machado'::text, 'ivanilson.machado@pumangol.co.ao', 'Presidente da Comissão Executiva & CEO'),
    ('André Pitra', 'andre.pitra@pumangol.co.ao', 'Vogal da Comissão Executiva (Chief Support & Safety Officer)'),
    ('Caetano Pinto', 'caetano.pinto@pumangol.co.ao', 'Vogal da Comissão Executiva & CFO'),
    ('Nuno Santos', 'nuno.santos@pumangol.co.ao', 'Vogal da Comissão Executiva (Chief Operating Officer)'),
    ('Solange Melo', 'solange.melo@pumangol.co.ao', 'Vogal da Comissão Executiva (Chief Legal & Governance Officer)')
),
grupo_ce AS (
  INSERT INTO grupo (nome, chave, descricao, sistema)
  VALUES (
    'Comissão Executiva',
    'comissao_executiva',
    'Membros da Comissão Executiva.',
    false
  )
  ON CONFLICT (chave) DO UPDATE
    SET nome = EXCLUDED.nome,
        descricao = EXCLUDED.descricao
  RETURNING id
),
contas AS (
  INSERT INTO utilizadores (nome, email, perfil, departamento, estado)
  SELECT nome, email, 'mentor'::perfil_utilizador, 'Comissão Executiva', 'activo'
    FROM pessoas
  ON CONFLICT (email) DO UPDATE
    SET nome = EXCLUDED.nome,
        departamento = EXCLUDED.departamento,
        perfil = CASE
          WHEN utilizadores.perfil = 'novo_colaborador'::perfil_utilizador THEN 'mentor'::perfil_utilizador
          ELSE utilizadores.perfil
        END
  RETURNING id, lower(email) AS email
),
ligados AS (
  UPDATE mentors m
     SET nome = p.nome,
         email = p.email,
         departamento = 'Comissão Executiva',
         funcao = p.funcao,
         activo = true
    FROM pessoas p
    JOIN contas c ON c.email = p.email
   WHERE m.utilizador_id = c.id
  RETURNING m.id
),
novos AS (
  INSERT INTO mentors (utilizador_id, nome, email, departamento, funcao, activo)
  SELECT c.id, p.nome, p.email, 'Comissão Executiva', p.funcao, true
    FROM pessoas p
    JOIN contas c ON c.email = p.email
   WHERE NOT EXISTS (
     SELECT 1 FROM mentors m WHERE m.utilizador_id = c.id
   )
  RETURNING id
)
INSERT INTO grupo_utilizador (grupo_id, utilizador_id)
SELECT g.id, c.id
  FROM contas c
  JOIN grupo_ce g ON true
 WHERE (SELECT count(*) FROM ligados) >= 0
   AND (SELECT count(*) FROM novos) >= 0
UNION
SELECT g.id, c.id
  FROM contas c
  JOIN grupo g ON g.chave = 'colaboradores'
ON CONFLICT DO NOTHING;
