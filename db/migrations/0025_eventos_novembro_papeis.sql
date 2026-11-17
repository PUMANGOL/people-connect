-- Agenda de Novembro 2026 e separação dos novos (mentorados) no controlo de acesso.
-- As mudanças de papel (mentor, mentorado, colaborador) fazem-se na app, em Utilizadores.
-- Angola não tem horário de verão: meio-dia em UTC+1 cai no dia certo do calendário.

INSERT INTO "grupo" ("nome", "chave", "descricao", "sistema")
VALUES (
  'Mentorados',
  'mentorados',
  'Novos colaboradores em acompanhamento. Grupo à parte dos colaboradores.',
  true
)
ON CONFLICT ("chave") DO NOTHING;

UPDATE "grupo"
   SET "descricao" = 'Colaboradores. Não inclui os novos em acompanhamento.'
 WHERE "chave" = 'colaboradores';

UPDATE "grupo"
   SET "descricao" = 'Quem acompanha mentorados. Vê o portal de mentor, além do acesso de colaborador.'
 WHERE "chave" = 'mentores';

INSERT INTO "grupo_acesso" ("grupo_id", "acesso_id")
SELECT destino.id, ga.acesso_id
  FROM "grupo_acesso" ga
  JOIN "grupo" origem ON origem.id = ga.grupo_id AND origem.chave = 'colaboradores'
  JOIN "grupo" destino ON destino.chave = 'mentorados'
ON CONFLICT DO NOTHING;

INSERT INTO "grupo_utilizador" ("grupo_id", "utilizador_id")
SELECT g.id, u.id
  FROM "utilizadores" u
  JOIN "grupo" g ON g.chave = 'mentorados'
 WHERE u.estado = 'activo'
   AND u.perfil = 'novo_colaborador'
ON CONFLICT DO NOTHING;

DELETE FROM "grupo_utilizador" gu
 USING "grupo" g, "utilizadores" u
 WHERE gu.grupo_id = g.id
   AND g.chave = 'colaboradores'
   AND gu.utilizador_id = u.id
   AND u.perfil = 'novo_colaborador';

INSERT INTO "eventos" (
  "titulo", "descricao", "categoria", "local", "zona", "inicio", "fim", "dia_inteiro", "destaque"
)
SELECT v.titulo, v.descricao, v.categoria, v.local, v.zona, v.inicio, v.fim, true, false
  FROM (
    VALUES
      (
        'Sessão de Ginástica Laboral – Cidade Financeira',
        'Agenda de actividades de Novembro.',
        'bem_estar',
        'Cidade Financeira',
        NULL::text,
        timestamptz '2026-11-10 12:00:00+01',
        timestamptz '2026-11-10 18:00:00+01'
      ),
      (
        'Lançamento da Plataforma de Onboarding Digital – People Connect',
        'Agenda de actividades de Novembro.',
        'oficial',
        'People Connect',
        NULL::text,
        timestamptz '2026-11-13 12:00:00+01',
        timestamptz '2026-11-13 18:00:00+01'
      ),
      (
        'Palestra sobre Cancro da Próstata - Diagnóstico Precoce, Prevenção e Combate',
        'Agenda de actividades de Novembro. Novembro Azul.',
        'bem_estar',
        NULL::text,
        NULL::text,
        timestamptz '2026-11-13 12:00:00+01',
        timestamptz '2026-11-13 18:00:00+01'
      ),
      (
        'Evento Novembro Azul dedicado aos Colaboradores da Pumangol',
        'Agenda de actividades de Novembro.',
        'comunidade',
        NULL::text,
        NULL::text,
        timestamptz '2026-11-14 12:00:00+01',
        timestamptz '2026-11-14 18:00:00+01'
      ),
      (
        'Divulgação da Voz do Colaborador',
        'Agenda de actividades de Novembro.',
        'comunidade',
        NULL::text,
        NULL::text,
        timestamptz '2026-11-16 12:00:00+01',
        timestamptz '2026-11-16 18:00:00+01'
      ),
      (
        'Visita do Inspector Cutala – Sinalização de Segurança',
        'Agenda de actividades de Novembro.',
        'obrigatorio',
        NULL::text,
        NULL::text,
        timestamptz '2026-11-19 12:00:00+01',
        timestamptz '2026-11-19 18:00:00+01'
      ),
      (
        'Divulgação “Sabias que?” – Trabalhador-Estudante',
        'Agenda de actividades de Novembro.',
        'comunidade',
        NULL::text,
        NULL::text,
        timestamptz '2026-11-19 12:00:00+01',
        timestamptz '2026-11-19 18:00:00+01'
      ),
      (
        'Cerimónia de Entrega de Certificados – The Bridge',
        'Agenda de actividades de Novembro.',
        'formacao',
        'The Bridge',
        NULL::text,
        timestamptz '2026-11-25 12:00:00+01',
        timestamptz '2026-11-25 18:00:00+01'
      ),
      (
        'Divulgação dos Resultados do Pumangol Pulse',
        'Agenda de actividades de Novembro.',
        'oficial',
        NULL::text,
        NULL::text,
        timestamptz '2026-11-27 12:00:00+01',
        timestamptz '2026-11-27 18:00:00+01'
      ),
      (
        'Encerramento do Novembro Azul, no Complexo Cardeal Dom Alexandre Morro Bento (sessão de ginástica)',
        'Agenda de actividades de Novembro.',
        'bem_estar',
        'Complexo Cardeal Dom Alexandre, Morro Bento',
        NULL::text,
        timestamptz '2026-11-28 12:00:00+01',
        timestamptz '2026-11-28 18:00:00+01'
      )
  ) AS v(titulo, descricao, categoria, local, zona, inicio, fim)
 WHERE NOT EXISTS (
   SELECT 1
     FROM "eventos" e
    WHERE e.titulo = v.titulo
      AND e.inicio = v.inicio
 );
