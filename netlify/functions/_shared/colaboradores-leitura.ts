import { sql } from './db';

export interface FiltroColaboradores {
  pagina: number;
  tamanho: number;
  q: string;
  direccao: string;
  funcao: string;
  categoria: string;
  estado: string;
}

export interface ResumoColaboradores {
  em_onboarding: number;
  concluidos: number;
  progresso_medio: number;
  atrasados: number;
  funcoes: string[];
  direccoes: string[];
  categorias: string[];
}

function contas() {
  return sql`
    SELECT colaborador_id,
           COUNT(*) FILTER (WHERE estado = 'concluida') AS feitas,
           COUNT(*) AS total,
           COUNT(*) FILTER (
             WHERE estado NOT IN ('concluida', 'cancelada')
               AND (
                 estado = 'atrasada'
                 OR (data_prevista IS NOT NULL AND data_prevista < CURRENT_DATE)
               )
           ) AS atrasadas
    FROM progresso_onboarding
    GROUP BY colaborador_id
  `;
}

function filtroSql(filtro: FiltroColaboradores) {
  const busca = `%${filtro.q}%`;
  return sql`
    (${filtro.q} = '' OR c.nome ILIKE ${busca})
    AND (${filtro.direccao} = '' OR c.direccao = ${filtro.direccao})
    AND (${filtro.funcao} = '' OR c.funcao = ${filtro.funcao})
    AND (${filtro.categoria} = '' OR c.categoria = ${filtro.categoria})
    AND (${filtro.estado} = '' OR c.estado_onboarding::text = ${filtro.estado})
  `;
}

function selectLista() {
  return sql`
    c.*,
    COALESCE(p.feitas, 0) AS etapas_concluidas,
    COALESCE(p.total, 0) AS etapas_total,
    COALESCE(p.atrasadas, 0) AS etapas_atrasadas
  `;
}

export function lerFiltroColaboradores(url: URL): FiltroColaboradores {
  const numero = (nome: string, omissao: number, max: number) => {
    const valor = Number(url.searchParams.get(nome));
    if (!Number.isFinite(valor)) return omissao;
    return Math.min(max, Math.max(0, Math.floor(valor)));
  };
  return {
    pagina: numero('pagina', 0, 10_000),
    tamanho: Math.max(1, numero('tamanho', 8, 50)),
    q: (url.searchParams.get('q') ?? '').trim().slice(0, 80),
    direccao: (url.searchParams.get('direccao') ?? '').trim().slice(0, 120),
    funcao: (url.searchParams.get('funcao') ?? '').trim().slice(0, 120),
    categoria: (url.searchParams.get('categoria') ?? '').trim().slice(0, 40),
    estado: (url.searchParams.get('estado') ?? '').trim().slice(0, 40),
  };
}

export function chaveFiltroColaboradores(filtro: FiltroColaboradores): string {
  return [
    filtro.pagina,
    filtro.tamanho,
    filtro.q,
    filtro.direccao,
    filtro.funcao,
    filtro.categoria,
    filtro.estado,
  ].join('\u001f');
}

export async function lerTodosColaboradores() {
  return sql`
    SELECT ${selectLista()}
    FROM colaboradores c
    LEFT JOIN (${contas()}) p ON p.colaborador_id = c.id
    ORDER BY c.data_admissao DESC NULLS LAST, c.nome
    LIMIT 200
  `;
}

export async function lerPaginaColaboradores(filtro: FiltroColaboradores) {
  const where = filtroSql(filtro);
  const totalRows = await sql`
    SELECT COUNT(*)::int AS n
    FROM colaboradores c
    WHERE ${where}
  `;
  const items = await sql`
    SELECT ${selectLista()}
    FROM colaboradores c
    LEFT JOIN (${contas()}) p ON p.colaborador_id = c.id
    WHERE ${where}
    ORDER BY c.data_admissao DESC NULLS LAST, c.nome
    LIMIT ${filtro.tamanho} OFFSET ${filtro.pagina * filtro.tamanho}
  `;
  return {
    items,
    total: Number(totalRows[0]?.n ?? 0),
    pagina: filtro.pagina,
    tamanho: filtro.tamanho,
  };
}

export async function lerResumoColaboradores(): Promise<ResumoColaboradores> {
  const [resumo, funcoes, direccoes, categorias] = await Promise.all([
    sql`
      SELECT
        COUNT(*) FILTER (WHERE c.estado_onboarding <> 'concluido')::int AS em_onboarding,
        COUNT(*) FILTER (WHERE c.estado_onboarding = 'concluido')::int AS concluidos,
        COALESCE(ROUND(AVG(
          CASE
            WHEN COALESCE(p.total, 0) > 0 THEN ROUND((p.feitas::numeric / p.total) * 100)
            ELSE 0
          END
        )), 0)::int AS progresso_medio,
        COUNT(*) FILTER (
          WHERE c.estado_onboarding <> 'concluido' AND COALESCE(p.atrasadas, 0) > 0
        )::int AS atrasados
      FROM colaboradores c
      LEFT JOIN (${contas()}) p ON p.colaborador_id = c.id
    `,
    sql`SELECT DISTINCT funcao AS valor FROM colaboradores WHERE funcao IS NOT NULL AND btrim(funcao) <> '' ORDER BY 1`,
    sql`SELECT DISTINCT direccao AS valor FROM colaboradores WHERE direccao IS NOT NULL AND btrim(direccao) <> '' ORDER BY 1`,
    sql`SELECT DISTINCT categoria AS valor FROM colaboradores WHERE categoria IS NOT NULL AND btrim(categoria) <> '' ORDER BY 1`,
  ]);
  const nomes = (rows: ReadonlyArray<{ valor?: unknown }>) =>
    rows.map((row) => (typeof row.valor === 'string' ? row.valor : '')).filter(Boolean);
  const linha = resumo[0] ?? {};
  const comoValor = (rows: unknown) => nomes(rows as Array<{ valor?: unknown }>);
  return {
    em_onboarding: Number(linha.em_onboarding ?? 0),
    concluidos: Number(linha.concluidos ?? 0),
    progresso_medio: Number(linha.progresso_medio ?? 0),
    atrasados: Number(linha.atrasados ?? 0),
    funcoes: comoValor(funcoes),
    direccoes: comoValor(direccoes),
    categorias: comoValor(categorias),
  };
}

export async function lerDetalheColaborador(id: string) {
  const colab = await sql`SELECT * FROM colaboradores WHERE id = ${id}`;
  if (!colab.length) return null;
  const progresso = await sql`
    SELECT p.*, e.nome AS etapa_nome, e.tipo AS etapa_tipo, e.duracao_dias, e.descricao, e.ordem,
           COALESCE(e.documentos_pedidos, '[]'::jsonb) AS documentos_pedidos
    FROM progresso_onboarding p
    LEFT JOIN etapas_trilho e ON e.id = p.etapa_id
    WHERE p.colaborador_id = ${id}
    ORDER BY e.ordem ASC
  `;
  return { colaborador: colab[0], progresso };
}
