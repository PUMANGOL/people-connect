import type { Config } from './_shared/route-config';
import { sql, jsonResponse, errorResponse, handleCors, publicErrorMessage } from './_shared/db';
import { requireAuth, authErrorResponse, AuthError, type AuthUser } from './_shared/auth';
import {
  fichaVazia,
  normalizarFicha,
  validarFicha,
  type EstadoFicha,
  type FichaTrabalhador,
  type FichaTrabalhadorDados,
} from '@/lib/ficha-trabalhador';

/**
 * Ficha do Trabalhador (modelo "FICHA DO NOVO TRABALHADOR Pumangol").
 *
 * Colaborador (a própria ficha — resolvida por colaboradores.utilizador_id = sessão):
 *   GET   /api/ficha-trabalhador               — ficha (ou pré-preenchida com os dados do registo)
 *   PATCH /api/ficha-trabalhador               — { ficha, submeter } guarda rascunho ou submete
 *
 * RH Admin:
 *   GET   /api/fichas-trabalhador              — todos os colaboradores com o estado da ficha
 *   GET   /api/fichas-trabalhador/:colaboradorId
 *   PATCH /api/fichas-trabalhador/:colaboradorId — { ficha, submeter }
 *
 * A exportação para Excel é feita no browser (lib/ficha-trabalhador.ts). Sem envio por email, por agora.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;


interface ColaboradorBase {
  id: string;
  nome: string;
  funcao: string | null;
  direccao: string | null;
  data_admissao: string | null;
  email: string | null;
  estado_onboarding: string;
}

// Datas como texto: o driver devolve `date` como Date (fuso horário) e o formulário usa "AAAA-MM-DD".
const fichaCols = () => sql`
  f.nome AS f_nome, f.data_inicio::text AS f_data_inicio, f.numero_bi AS f_numero_bi,
  f.funcao AS f_funcao, f.sexo AS f_sexo, f.data_nascimento::text AS f_data_nascimento,
  f.local_nascimento AS f_local_nascimento, f.estado_civil AS f_estado_civil, f.morada AS f_morada,
  f.provincia AS f_provincia, f.telefone AS f_telefone, f.telemovel AS f_telemovel, f.email AS f_email,
  f.conjuge AS f_conjuge, f.filhos AS f_filhos, f.contactos_emergencia AS f_contactos_emergencia,
  f.estado AS f_estado, f.submetida_em AS f_submetida_em, f.updated_at AS f_updated_at,
  (f.id IS NOT NULL) AS f_existe
`;

const colabCols = () => sql`
  c.id, c.nome, c.funcao, c.direccao, c.data_admissao::text AS data_admissao,
  COALESCE(NULLIF(btrim(c.email), ''), u.email) AS email, c.estado_onboarding::text AS estado_onboarding
`;

/**
 * jsonb lido da BD. Fichas gravadas antes da correcção têm a lista como string jsonb
 * (JSON.stringify + ::jsonb era codificado duas vezes pelo driver): aceita os dois formatos.
 */
function jsonb(v: unknown, depth = 0): unknown {
  if (typeof v === 'string' && depth < 2) {
    try {
      return jsonb(JSON.parse(v), depth + 1);
    } catch {
      return null;
    }
  }
  return v;
}

function iso(v: unknown): string | null {
  if (!v) return null;
  return v instanceof Date ? v.toISOString() : String(v);
}

/** Linha da BD → ficha. Sem registo, pré-preenche nome, função e data de início (o email fica para o colaborador). */
function montarFicha(row: Record<string, unknown>): FichaTrabalhador {
  const c = row as unknown as ColaboradorBase;
  if (!row.f_existe) {
    return {
      ...fichaVazia(),
      nome: c.nome ?? '',
      funcao: c.funcao ?? '',
      data_inicio: c.data_admissao ?? '',
      colaborador_id: c.id,
      estado: 'por_preencher',
      submetida_em: null,
      updated_at: null,
    };
  }
  const dados = normalizarFicha({
    nome: row.f_nome, data_inicio: row.f_data_inicio, numero_bi: row.f_numero_bi, funcao: row.f_funcao,
    sexo: row.f_sexo, data_nascimento: row.f_data_nascimento, local_nascimento: row.f_local_nascimento,
    estado_civil: row.f_estado_civil, morada: row.f_morada, provincia: row.f_provincia,
    telefone: row.f_telefone, telemovel: row.f_telemovel, email: row.f_email, conjuge: jsonb(row.f_conjuge),
    filhos: jsonb(row.f_filhos), contactos_emergencia: jsonb(row.f_contactos_emergencia),
  });
  return {
    ...dados,
    // O formulário mostra sempre os dois blocos de contacto de emergência.
    contactos_emergencia: [...dados.contactos_emergencia, ...fichaVazia().contactos_emergencia].slice(0, 2),
    colaborador_id: c.id,
    estado: (row.f_estado as EstadoFicha) ?? 'rascunho',
    submetida_em: iso(row.f_submetida_em),
    updated_at: iso(row.f_updated_at),
  };
}

async function carregarPorColaborador(colaboradorId: string) {
  const rows = await sql`
    SELECT ${colabCols()}, ${fichaCols()}
    FROM colaboradores c
    LEFT JOIN utilizadores u ON u.id = c.utilizador_id
    LEFT JOIN fichas_trabalhador f ON f.colaborador_id = c.id
    WHERE c.id = ${colaboradorId}::uuid
    LIMIT 1
  `;
  return rows[0] as Record<string, unknown> | undefined;
}

async function colaboradorDaSessao(utilizadorId: string): Promise<string | null> {
  const rows = await sql`
    SELECT id FROM colaboradores WHERE utilizador_id = ${utilizadorId}
    ORDER BY created_at DESC LIMIT 1
  `;
  return (rows[0]?.id as string | undefined) ?? null;
}

async function guardar(colaboradorId: string, dados: FichaTrabalhadorDados, submeter: boolean, user: AuthUser) {
  const conjuge = dados.conjuge ? JSON.stringify(dados.conjuge) : null;
  const estado = submeter ? 'submetida' : 'rascunho';
  await sql`
    INSERT INTO fichas_trabalhador (
      colaborador_id, nome, data_inicio, numero_bi, funcao, sexo, data_nascimento, local_nascimento,
      estado_civil, morada, provincia, telefone, telemovel, email, conjuge, filhos, contactos_emergencia,
      estado, submetida_em, actualizado_por
    ) VALUES (
      ${colaboradorId}, ${dados.nome || null}, ${dados.data_inicio || null}, ${dados.numero_bi || null},
      ${dados.funcao || null}, ${dados.sexo || null}, ${dados.data_nascimento || null},
      ${dados.local_nascimento || null}, ${dados.estado_civil || null}, ${dados.morada || null},
      ${dados.provincia || null}, ${dados.telefone || null}, ${dados.telemovel || null}, ${dados.email || null},
      -- ::text antes de ::jsonb: o parâmetro vai como texto e o Postgres converte-o uma vez
      -- (só com ::jsonb o driver voltava a codificar o JSON e gravava uma string).
      ${conjuge}::text::jsonb, ${JSON.stringify(dados.filhos)}::text::jsonb,
      ${JSON.stringify(dados.contactos_emergencia)}::text::jsonb,
      ${estado}, ${submeter ? sql`NOW()` : null}, ${user.id}
    )
    ON CONFLICT (colaborador_id) DO UPDATE SET
      nome = EXCLUDED.nome, data_inicio = EXCLUDED.data_inicio, numero_bi = EXCLUDED.numero_bi,
      funcao = EXCLUDED.funcao, sexo = EXCLUDED.sexo, data_nascimento = EXCLUDED.data_nascimento,
      local_nascimento = EXCLUDED.local_nascimento, estado_civil = EXCLUDED.estado_civil,
      morada = EXCLUDED.morada, provincia = EXCLUDED.provincia, telefone = EXCLUDED.telefone,
      telemovel = EXCLUDED.telemovel, email = EXCLUDED.email, conjuge = EXCLUDED.conjuge,
      filhos = EXCLUDED.filhos, contactos_emergencia = EXCLUDED.contactos_emergencia,
      -- Uma ficha submetida não volta a rascunho por uma edição posterior do admin.
      estado = CASE WHEN fichas_trabalhador.estado = 'submetida' THEN 'submetida' ELSE EXCLUDED.estado END,
      submetida_em = CASE WHEN ${submeter}::boolean THEN NOW() ELSE fichas_trabalhador.submetida_em END,
      actualizado_por = EXCLUDED.actualizado_por, updated_at = NOW()
  `;
}

/** Lê o body, normaliza e valida (só na submissão). Devolve Response em caso de erro. */
async function lerPedido(req: Request): Promise<{ dados: FichaTrabalhadorDados; submeter: boolean } | Response> {
  const body = await req.json().catch(() => ({}));
  const dados = normalizarFicha(body?.ficha);
  const submeter = body?.submeter === true;
  if (submeter) {
    const erros = validarFicha(dados);
    if (Object.keys(erros).length > 0) {
      return jsonResponse({ error: 'Preencha os campos obrigatórios da ficha.', erros }, 422);
    }
  }
  return { dados, submeter };
}


/** Após a submissão pelo colaborador: timeline e sino dos admins. */
async function aposSubmissao(colaboradorId: string, user: AuthUser, primeiraVez: boolean) {
  const row = await carregarPorColaborador(colaboradorId);
  if (!row) return;
  const ficha = montarFicha(row);
  const nome = ficha.nome || (row.nome as string);

  try {
    await sql`
      INSERT INTO onboarding_timeline (colaborador_id, tipo, actor_id, actor_nome, actor_role, descricao)
      VALUES (${colaboradorId}, 'ficha_trabalhador_submetida', ${user.id}, ${user.nome}, ${user.role},
              ${primeiraVez ? 'Ficha do trabalhador submetida' : 'Ficha do trabalhador actualizada'})
    `;
    await sql`
      INSERT INTO onboarding_notificacoes (destinatario_id, destinatario_role, colaborador_id, tipo, titulo, mensagem, link_accao)
      SELECT u.id, 'rh_admin', ${colaboradorId}, 'ficha_trabalhador',
             ${primeiraVez ? 'Nova ficha do trabalhador' : 'Ficha do trabalhador actualizada'},
             ${nome + (primeiraVez ? ' submeteu a ficha do trabalhador.' : ' actualizou a ficha do trabalhador.')},
             ${'/onboarding/fichas?colaborador=' + colaboradorId}
        FROM utilizadores u
       WHERE u.perfil = 'rh_admin' AND u.estado = 'activo'
    `;
  } catch (err) {
    console.error('[fichas-trabalhador] timeline/notificação', err);
  }

}

export default async (req: Request): Promise<Response> => {
  const cors = handleCors(req);
  if (cors) return cors;

  const url = new URL(req.url);
  const parts = url.pathname.split('/').filter(Boolean);
  const raiz = parts[1]; // 'ficha-trabalhador' | 'fichas-trabalhador'
  const sub = parts[2];

  try {
    const user = await requireAuth(req);

    // ===== Colaborador: a própria ficha =====
    if (raiz === 'ficha-trabalhador') {
      const colaboradorId = await colaboradorDaSessao(user.id);
      if (!colaboradorId) return errorResponse('Sem registo de colaborador associado a esta conta', 404);

      if (req.method === 'GET') {
        const row = await carregarPorColaborador(colaboradorId);
        if (!row) return errorResponse('Colaborador não encontrado', 404);
        return jsonResponse({ data: montarFicha(row) });
      }

      if (req.method === 'PATCH') {
        const pedido = await lerPedido(req);
        if (pedido instanceof Response) return pedido;
        const antes = await sql`SELECT estado FROM fichas_trabalhador WHERE colaborador_id = ${colaboradorId}`;
        await guardar(colaboradorId, pedido.dados, pedido.submeter, user);
        if (pedido.submeter) await aposSubmissao(colaboradorId, user, antes[0]?.estado !== 'submetida');
        const row = await carregarPorColaborador(colaboradorId);
        return jsonResponse({ data: montarFicha(row!) });
      }

      return errorResponse('Método não suportado', 405);
    }

    // ===== RH Admin =====
    if (user.role !== 'rh_admin') return errorResponse('Sem permissão', 403);

    // GET /api/fichas-trabalhador
    if (!sub) {
      if (req.method !== 'GET') return errorResponse('Método não suportado', 405);
      const rows = await sql`
        SELECT ${colabCols()}, ${fichaCols()}
        FROM colaboradores c
        LEFT JOIN utilizadores u ON u.id = c.utilizador_id
        LEFT JOIN fichas_trabalhador f ON f.colaborador_id = c.id
        ORDER BY f.submetida_em DESC NULLS LAST, c.data_admissao DESC NULLS LAST, c.nome
      `;
      return jsonResponse({
        data: {
          fichas: rows.map((r) => ({
            colaborador: {
              id: r.id, nome: r.nome, funcao: r.funcao, direccao: r.direccao,
              data_admissao: r.data_admissao, email: r.email, estado_onboarding: r.estado_onboarding,
            },
            ficha: montarFicha(r),
          })),
        },
      });
    }

    // /api/fichas-trabalhador/:colaboradorId
    if (!UUID_RE.test(sub)) return errorResponse('Colaborador inválido', 400);
    if (req.method === 'GET') {
      const row = await carregarPorColaborador(sub);
      if (!row) return errorResponse('Colaborador não encontrado', 404);
      return jsonResponse({ data: montarFicha(row) });
    }
    if (req.method === 'PATCH') {
      const row = await carregarPorColaborador(sub);
      if (!row) return errorResponse('Colaborador não encontrado', 404);
      const pedido = await lerPedido(req);
      if (pedido instanceof Response) return pedido;
      await guardar(sub, pedido.dados, pedido.submeter, user);
      return jsonResponse({ data: montarFicha((await carregarPorColaborador(sub))!) });
    }

    return errorResponse('Método não suportado', 405);
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err);
    console.error('[fichas-trabalhador]', err);
    return errorResponse(publicErrorMessage(err, 'Erro ao processar a ficha do trabalhador'));
  }
};

export const config: Config = {
  path: [
    '/api/ficha-trabalhador',
    '/api/fichas-trabalhador',
    '/api/fichas-trabalhador/:colaboradorId',
  ],
};
