import 'dotenv/config';
import postgres from 'postgres';

/**
 * Contas locais para desenvolvimento. Idempotente: voltar a correr
 * repõe a password e não duplica linhas.
 *
 * Password de todas: Pumangol123
 */
const PASSWORD = 'Pumangol123';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL não configurada');
  process.exit(1);
}

const sql = postgres(url, { ssl: /sslmode=require/i.test(url) ? 'require' : false, max: 1 });

try {
  await sql`
    INSERT INTO utilizadores (nome, email, perfil, departamento, estado, password_hash)
    VALUES
      ('Admin DPC', 'admin@pumangol.ao', 'rh_admin', 'DPC', 'activo', crypt(${PASSWORD}, gen_salt('bf'))),
      ('Ana Mentor', 'mentor@pumangol.ao', 'mentor', 'Operações', 'activo', crypt(${PASSWORD}, gen_salt('bf'))),
      ('João Colaborador', 'colaborador@pumangol.ao', 'novo_colaborador', 'Operações', 'activo', crypt(${PASSWORD}, gen_salt('bf')))
    ON CONFLICT (email) DO UPDATE SET
      nome = EXCLUDED.nome,
      perfil = EXCLUDED.perfil,
      departamento = EXCLUDED.departamento,
      estado = 'activo',
      password_hash = EXCLUDED.password_hash
  `;

  await sql`
    INSERT INTO auth_local (utilizador_id, password_hash)
    SELECT id, password_hash
    FROM utilizadores
    WHERE email IN ('admin@pumangol.ao', 'mentor@pumangol.ao', 'colaborador@pumangol.ao')
    ON CONFLICT (utilizador_id) DO UPDATE SET
      password_hash = EXCLUDED.password_hash,
      updated_at = NOW()
  `;

  await sql`
    INSERT INTO mentors (utilizador_id, nome, email, departamento, categorias_suportadas, activo)
    SELECT id, nome, email, departamento, ARRAY['gestao', 'tecnicos']::text[], true
    FROM utilizadores
    WHERE email = 'mentor@pumangol.ao'
    ON CONFLICT (utilizador_id) DO UPDATE SET
      activo = true,
      nome = EXCLUDED.nome,
      email = EXCLUDED.email,
      departamento = EXCLUDED.departamento,
      categorias_suportadas = EXCLUDED.categorias_suportadas
  `;

  await sql`
    INSERT INTO colaboradores (
      utilizador_id, nome, funcao, direccao, categoria, email,
      estado_onboarding, welcome_completed, data_admissao
    )
    SELECT id, nome, 'Técnico de operações', 'Operações', 'tecnicos', email,
           'nao_iniciado', false, CURRENT_DATE
    FROM utilizadores
    WHERE email = 'colaborador@pumangol.ao'
      AND NOT EXISTS (
        SELECT 1 FROM colaboradores c WHERE c.utilizador_id = utilizadores.id
      )
  `;

  await sql`
    INSERT INTO mentor_assignments (colaborador_id, mentor_id, atribuido_por, activo)
    SELECT c.id, m.id, admin.id, true
    FROM colaboradores c
    JOIN utilizadores cu ON cu.id = c.utilizador_id AND cu.email = 'colaborador@pumangol.ao'
    JOIN mentors m ON m.utilizador_id = (SELECT id FROM utilizadores WHERE email = 'mentor@pumangol.ao')
    JOIN utilizadores admin ON admin.email = 'admin@pumangol.ao'
    WHERE NOT EXISTS (
      SELECT 1 FROM mentor_assignments ma
      WHERE ma.colaborador_id = c.id AND ma.activo = true
    )
  `;

  const ok = await sql`
    SELECT email, perfil
    FROM utilizadores
    WHERE email IN ('admin@pumangol.ao', 'mentor@pumangol.ao', 'colaborador@pumangol.ao')
      AND password_hash = crypt(${PASSWORD}, password_hash)
    ORDER BY email
  `;

  if (ok.length !== 3) {
    throw new Error(`Esperadas 3 contas com password válida, obtidas ${ok.length}`);
  }

  console.log('Seed aplicado. Password de todas as contas: Pumangol123');
  for (const row of ok) {
    console.log(`- ${row.email} (${row.perfil})`);
  }
} finally {
  await sql.end();
}
