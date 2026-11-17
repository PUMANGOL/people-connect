import { sql } from './db';
import { urlFicheiro } from './storage';

export type PessoaEstrutura = { id: string; nome: string; funcao: string | null; foto_url: string | null };

export type Estrutura = {
  direccao: string | null;
  /** null quando a unidade do directório é a própria direcção. */
  unidade: string | null;
  cargo: string | null;
  local_trabalho: string | null;
  cidade: string | null;
  /** Quem tem cargo de Director(a) na mesma direcção. */
  lideranca: PessoaEstrutura[];
  colegas: { ambito: 'unidade' | 'direccao'; total: number; pessoas: PessoaEstrutura[] };
};

const CARGO_DIRECTOR = '^dire(c)?tor(a)?\\M';
const MAX_COLEGAS = 6;

/**
 * Uma linha por utilizador com cargo, direcção, unidade e local. A BD (colaboradores, mentores)
 * tem prioridade; o directório Entra (estrutura_organica) completa o que falta e traz a unidade.
 */
export const pessoasOrg = () => sql`
  SELECT u.id, u.nome, u.email, u.estado, u.perfil::text AS perfil,
         COALESCE(NULLIF(btrim(c.funcao), ''), NULLIF(btrim(m.funcao), ''), eo.cargo) AS funcao,
         COALESCE(NULLIF(btrim(c.direccao), ''), NULLIF(btrim(m.departamento), ''),
                  NULLIF(btrim(u.departamento), ''), eo.direccao) AS direccao,
         eo.unidade,
         COALESCE(NULLIF(btrim(m.area), ''), eo.local_trabalho) AS local_trabalho,
         eo.cidade,
         pu.foto_key
    FROM utilizadores u
    LEFT JOIN LATERAL (
      SELECT funcao, direccao FROM colaboradores WHERE utilizador_id = u.id ORDER BY created_at DESC LIMIT 1
    ) c ON true
    LEFT JOIN mentors m ON m.utilizador_id = u.id
    LEFT JOIN LATERAL (
      SELECT cargo, direccao, unidade, local_trabalho, cidade
        FROM estrutura_organica WHERE emails @> ARRAY[lower(u.email)] LIMIT 1
    ) eo ON true
    LEFT JOIN perfis_utilizador pu ON pu.utilizador_id = u.id
`;

function chave(valor: string): string {
  return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** "Direcção Comercial" dentro de "Direcção Comercial (Lubrificantes, …)" não é uma unidade à parte. */
function unidadeDistinta(unidade: string | null, direccao: string | null): string | null {
  if (!unidade || !direccao) return unidade;
  const u = chave(unidade);
  const d = chave(direccao);
  return d.startsWith(u) || u.startsWith(d) ? null : unidade;
}

function resumo(r: Record<string, unknown>): PessoaEstrutura {
  return {
    id: r.id as string,
    nome: r.nome as string,
    funcao: (r.funcao as string | null) ?? null,
    foto_url: urlFicheiro(r.foto_key as string | null),
  };
}

/** Directores activos da direcção da pessoa, sem ela própria. */
export async function directoresDe(utilizadorId: string) {
  return sql<{ id: string; perfil: string }[]>`
    SELECT d.id, d.perfil FROM (${pessoasOrg()}) d
     WHERE d.estado = 'activo' AND d.id <> ${utilizadorId} AND d.funcao ~* ${CARGO_DIRECTOR}
       AND d.direccao = (SELECT p.direccao FROM (${pessoasOrg()}) p WHERE p.id = ${utilizadorId})
  `;
}

export async function lerEstrutura(utilizadorId: string): Promise<Estrutura> {
  const [eu] = await sql`SELECT * FROM (${pessoasOrg()}) p WHERE p.id = ${utilizadorId}`;
  const direccao = (eu?.direccao as string | null) ?? null;
  const unidadeOriginal = (eu?.unidade as string | null) ?? null;
  const unidade = unidadeDistinta(unidadeOriginal, direccao);

  const filtroColegas = unidade
    ? sql`p.unidade = ${unidadeOriginal} AND p.direccao IS NOT DISTINCT FROM ${direccao}`
    : direccao
      ? sql`p.direccao = ${direccao}`
      : null;

  const [lideranca, colegas, contagem] = await Promise.all([
    direccao
      ? sql`
          SELECT id, nome, funcao, foto_key FROM (${pessoasOrg()}) p
           WHERE p.estado = 'activo' AND p.id <> ${utilizadorId}
             AND p.direccao = ${direccao} AND p.funcao ~* ${CARGO_DIRECTOR}
           ORDER BY p.nome LIMIT 2
        `
      : Promise.resolve([]),
    filtroColegas
      ? sql`
          SELECT id, nome, funcao, foto_key FROM (${pessoasOrg()}) p
           WHERE p.estado = 'activo' AND p.id <> ${utilizadorId} AND ${filtroColegas}
           ORDER BY p.nome LIMIT ${MAX_COLEGAS}
        `
      : Promise.resolve([]),
    filtroColegas
      ? sql`
          SELECT COUNT(*)::int AS total FROM (${pessoasOrg()}) p
           WHERE p.estado = 'activo' AND p.id <> ${utilizadorId} AND ${filtroColegas}
        `
      : Promise.resolve([{ total: 0 }]),
  ]);

  return {
    direccao,
    unidade,
    cargo: (eu?.funcao as string | null) ?? null,
    local_trabalho: (eu?.local_trabalho as string | null) ?? null,
    cidade: (eu?.cidade as string | null) ?? null,
    lideranca: lideranca.map(resumo),
    colegas: {
      ambito: unidade ? 'unidade' : 'direccao',
      total: (contagem[0]?.total as number) ?? 0,
      pessoas: colegas.map(resumo),
    },
  };
}
