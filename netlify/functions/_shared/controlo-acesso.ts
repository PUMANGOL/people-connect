import { PAGINAS } from '@/lib/paginas';
import { AuthError } from './auth';
import { sql } from './db';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class ErroAcesso extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = 'ErroAcesso';
    this.status = status;
  }
}

export interface PaginaSessao {
  rota: string;
  visivel: boolean;
}

export interface MembroGrupo {
  id: string;
  nome: string;
  email: string;
  perfil: string;
}

export interface GrupoPainel {
  id: string;
  nome: string;
  chave: string;
  descricao: string | null;
  sistema: boolean;
  membros: MembroGrupo[];
  acesso_ids: string[];
}

export interface AcessoPainel {
  id: string;
  chave: string;
  nome: string;
  rota: string;
  modulo: string;
  perfis: string[];
  ordem: number;
  restrito: boolean;
  sistema: boolean;
}

export interface PainelAcessos {
  eu_id: string;
  grupos: GrupoPainel[];
  acessos: AcessoPainel[];
  utilizadores: MembroGrupo[];
}

/**
 * Páginas que já faziam parte do menu. Uma página nova no catálogo não entra
 * nesta lista: fica sem grupos, logo invisível, até ser marcada em Acessos.
 */
const CHAVES_MENU_INICIAL = [
  'inicio', 'eventos', 'reconhecimento', 'meu-perfil', 'dashboard',
  'recrutamento-semanal', 'candidatos', 'admissao',
  'onboarding', 'fichas', 'trilhos', 'catalogos', 'quiz', 'videos', 'evolucao', 'documentos-empresa', 'documentos-exigidos',
  'mentores', 'centro-avaliacoes', 'comparacao-360', 'assistente',
  'mentor', 'mentor-mentorados', 'mentor-avaliacoes', 'mentor-notificacoes',
  'meu-trilho', 'minha-ficha', 'timeline', 'comentarios-mentor', 'feedback', 'meus-documentos', 'submissoes',
  'utilizadores', 'audit', 'definicoes',
];

let sincronizacao: Promise<void> | null = null;

async function sincronizar(): Promise<void> {
  await sql`
    INSERT INTO grupo (nome, chave, descricao, sistema)
    VALUES
      ('DEV', 'dev', 'Contas de desenvolvimento. Gerem os acessos e podem ver páginas em teste.', true),
      ('Administradores', 'administradores', 'Páginas que o administrador DPC já via no menu.', true),
      ('Mentores', 'mentores', 'Quem tem um novo colaborador atribuído. Vê o portal de mentor, além do acesso de colaborador.', true),
      ('Colaboradores', 'colaboradores', 'Colaboradores. Os novos têm o mesmo acesso dos restantes.', true)
    ON CONFLICT (chave) DO NOTHING
  `;

  for (const pagina of PAGINAS) {
    await sql`
      INSERT INTO acesso (chave, nome, rota, modulo, perfis, ordem, sistema, restrito)
      VALUES (
        ${pagina.chave},
        ${pagina.nome},
        ${pagina.rota},
        ${pagina.modulo},
        ${sql.array([...pagina.perfis])}::text[],
        ${pagina.ordem},
        ${pagina.sistema === true},
        ${pagina.sistema === true}
      )
      ON CONFLICT (chave) DO UPDATE SET
        nome = EXCLUDED.nome,
        rota = EXCLUDED.rota,
        modulo = EXCLUDED.modulo,
        perfis = EXCLUDED.perfis,
        ordem = EXCLUDED.ordem,
        sistema = EXCLUDED.sistema,
        restrito = CASE WHEN EXCLUDED.sistema THEN true ELSE acesso.restrito END
    `;
  }

  await sql`
    INSERT INTO grupo_acesso (grupo_id, acesso_id)
    SELECT g.id, a.id
      FROM grupo g
      JOIN acesso a ON a.sistema = true
     WHERE g.chave = 'dev'
    ON CONFLICT DO NOTHING
  `;

  const chaves = sql.array(CHAVES_MENU_INICIAL);
  await sql`
    INSERT INTO grupo_acesso (grupo_id, acesso_id)
    SELECT g.id, a.id
      FROM acesso a
      JOIN grupo g ON g.chave IN ('administradores', 'mentores', 'colaboradores')
     WHERE a.concessao_inicial = false
       AND a.sistema = false
       AND a.chave = ANY(${chaves}::text[])
       AND 'rh_admin' = ANY(a.perfis)
       AND 'mentor' = ANY(a.perfis)
       AND 'novo_colaborador' = ANY(a.perfis)
    ON CONFLICT DO NOTHING
  `;
  await sql`
    INSERT INTO grupo_acesso (grupo_id, acesso_id)
    SELECT g.id, a.id
      FROM acesso a
      JOIN grupo g ON g.chave = 'administradores'
     WHERE a.concessao_inicial = false
       AND a.sistema = false
       AND a.chave = ANY(${chaves}::text[])
       AND 'rh_admin' = ANY(a.perfis)
       AND NOT ('mentor' = ANY(a.perfis))
       AND NOT ('novo_colaborador' = ANY(a.perfis))
    ON CONFLICT DO NOTHING
  `;
  await sql`
    INSERT INTO grupo_acesso (grupo_id, acesso_id)
    SELECT g.id, a.id
      FROM acesso a
      JOIN grupo g ON g.chave = 'mentores'
     WHERE a.concessao_inicial = false
       AND a.sistema = false
       AND a.chave = ANY(${chaves}::text[])
       AND 'mentor' = ANY(a.perfis)
       AND NOT ('novo_colaborador' = ANY(a.perfis))
    ON CONFLICT DO NOTHING
  `;
  await sql`
    INSERT INTO grupo_acesso (grupo_id, acesso_id)
    SELECT g.id, a.id
      FROM acesso a
      JOIN grupo g ON g.chave = 'colaboradores'
     WHERE a.concessao_inicial = false
       AND a.sistema = false
       AND a.chave = ANY(${chaves}::text[])
       AND 'novo_colaborador' = ANY(a.perfis)
       AND NOT ('mentor' = ANY(a.perfis))
    ON CONFLICT DO NOTHING
  `;
  await sql`
    UPDATE acesso
       SET concessao_inicial = true
     WHERE concessao_inicial = false
       AND chave = ANY(${chaves}::text[])
  `;
}

/** Cria o grupo DEV e faz o upsert do catálogo de páginas. Uma vez por processo. */
export function garantirControloAcesso(): Promise<void> {
  if (!sincronizacao) {
    sincronizacao = sincronizar().catch((err) => {
      sincronizacao = null;
      throw err;
    });
  }
  return sincronizacao;
}

function comoLista(valor: unknown): string[] {
  if (Array.isArray(valor)) return valor.map(String);
  if (typeof valor === 'string' && valor.startsWith('{')) {
    return valor.slice(1, -1).split(',').map((parte) => parte.replace(/^"|"$/g, '')).filter(Boolean);
  }
  return [];
}

function idsValidos(valor: unknown): string[] | null {
  if (!Array.isArray(valor)) return null;
  if (valor.some((id) => typeof id !== 'string' || !UUID.test(id))) return null;
  return [...new Set(valor as string[])];
}

function chaveDe(nome: string): string {
  const base = nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  if (!base || base === 'dev') return base === 'dev' ? 'dev-equipa' : 'grupo';
  return base;
}

async function estadoDe(utilizadorId: string, role: string): Promise<{ isDev: boolean; acessoIds: Set<string> }> {
  const [membros, concedidos] = await Promise.all([
    sql`
      SELECT gu.utilizador_id
        FROM grupo g
        JOIN grupo_utilizador gu ON gu.grupo_id = g.id
       WHERE g.chave = 'dev'
    `,
    sql`
      SELECT ga.acesso_id
        FROM grupo_acesso ga
        JOIN grupo_utilizador gu ON gu.grupo_id = ga.grupo_id
       WHERE gu.utilizador_id = ${utilizadorId}
    `,
  ]);
  const devs = new Set(membros.map((linha) => String(linha.utilizador_id)));
  return {
    // Enquanto ninguém estiver no grupo, um administrador abre a página para se adicionar.
    isDev: devs.has(utilizadorId) || (devs.size === 0 && role === 'rh_admin'),
    acessoIds: new Set(concedidos.map((linha) => String(linha.acesso_id))),
  };
}

/** Mentor de verdade: tem pelo menos um novo colaborador atribuído e activo. */
async function temAtribuicaoActiva(utilizadorId: string): Promise<boolean> {
  const linhas = await sql`
    SELECT 1
      FROM mentors m
      JOIN mentor_assignments ma ON ma.mentor_id = m.id AND ma.activo = true
     WHERE m.utilizador_id = ${utilizadorId}
     LIMIT 1
  `;
  return linhas.length > 0;
}

/**
 * Actualiza o grupo Mentores da conta ligada a esta ficha.
 * Entra com uma atribuição activa e sai quando já não tem nenhuma.
 */
export async function reflectirGrupoDoMentor(mentorId: string): Promise<void> {
  await garantirControloAcesso();
  const linhas = await sql`
    SELECT m.utilizador_id AS uid,
           EXISTS (
             SELECT 1 FROM mentor_assignments ma
              WHERE ma.mentor_id = m.id AND ma.activo = true
           ) AS activo
      FROM mentors m
     WHERE m.id = ${mentorId}
  `;
  const uid = linhas[0]?.uid as string | null | undefined;
  if (!uid) return;
  if (linhas[0].activo) {
    await sql`
      INSERT INTO grupo_utilizador (grupo_id, utilizador_id)
      SELECT id, ${uid} FROM grupo WHERE chave = 'mentores'
      ON CONFLICT DO NOTHING
    `;
    return;
  }
  await sql`
    DELETE FROM grupo_utilizador gu
     USING grupo g
     WHERE gu.grupo_id = g.id
       AND g.chave = 'mentores'
       AND gu.utilizador_id = ${uid}
  `;
}

/** Conta nova, ainda sem grupos: colaboradores (antigos e novos) partilham o mesmo grupo. Mentor só com atribuição activa. */
async function garantirGrupoSeVazio(utilizadorId: string, role: string): Promise<void> {
  const actual = await sql`SELECT COUNT(*)::int AS n FROM grupo_utilizador WHERE utilizador_id = ${utilizadorId}`;
  if ((actual[0].n as number) > 0) return;
  const chaves: string[] = [];
  if (role === 'rh_admin') chaves.push('administradores');
  if (role === 'mentor' || role === 'novo_colaborador') chaves.push('colaboradores');
  if (await temAtribuicaoActiva(utilizadorId)) chaves.push('mentores');
  for (const chave of chaves) {
    await sql`
      INSERT INTO grupo_utilizador (grupo_id, utilizador_id)
      SELECT id, ${utilizadorId} FROM grupo WHERE chave = ${chave}
      ON CONFLICT DO NOTHING
    `;
  }
}

export async function paginasDaSessao(
  utilizadorId: string,
  role: string,
): Promise<{ is_dev: boolean; paginas: PaginaSessao[] }> {
  await garantirControloAcesso();
  await garantirGrupoSeVazio(utilizadorId, role);
  const estado = await estadoDe(utilizadorId, role);
  const linhas = await sql`SELECT id, rota, sistema FROM acesso`;
  return {
    is_dev: estado.isDev,
    paginas: linhas.map((linha) => ({
      rota: String(linha.rota),
      visivel: linha.sistema === true
        ? estado.isDev
        : estado.acessoIds.has(String(linha.id)),
    })),
  };
}

export async function assertDev(utilizadorId: string, role: string): Promise<void> {
  await garantirControloAcesso();
  const estado = await estadoDe(utilizadorId, role);
  if (!estado.isDev) throw new AuthError('Só a conta DEV gere os acessos.', 403);
}

export async function carregarPainel(euId: string): Promise<PainelAcessos> {
  await garantirControloAcesso();
  const [grupos, membros, paginas, ligacoes, pessoas] = await Promise.all([
    sql`SELECT id, nome, chave, descricao, sistema FROM grupo ORDER BY sistema DESC, nome`,
    sql`
      SELECT gu.grupo_id, u.id, u.nome, u.email, u.perfil::text AS perfil
        FROM grupo_utilizador gu
        JOIN utilizadores u ON u.id = gu.utilizador_id
       ORDER BY u.nome
    `,
    sql`
      SELECT id, chave, nome, rota, modulo, perfis, ordem, restrito, sistema
        FROM acesso
       ORDER BY ordem, nome
    `,
    sql`SELECT grupo_id, acesso_id FROM grupo_acesso`,
    sql`
      SELECT id, nome, email, perfil::text AS perfil
        FROM utilizadores
       WHERE estado = 'activo'
       ORDER BY nome
    `,
  ]);

  const membrosPorGrupo = new Map<string, MembroGrupo[]>();
  for (const linha of membros) {
    const grupoId = String(linha.grupo_id);
    const lista = membrosPorGrupo.get(grupoId) ?? [];
    lista.push({
      id: String(linha.id),
      nome: String(linha.nome),
      email: String(linha.email),
      perfil: String(linha.perfil),
    });
    membrosPorGrupo.set(grupoId, lista);
  }

  const acessosPorGrupo = new Map<string, string[]>();
  for (const linha of ligacoes) {
    const grupoId = String(linha.grupo_id);
    const lista = acessosPorGrupo.get(grupoId) ?? [];
    lista.push(String(linha.acesso_id));
    acessosPorGrupo.set(grupoId, lista);
  }

  return {
    eu_id: euId,
    grupos: grupos.map((linha) => ({
      id: String(linha.id),
      nome: String(linha.nome),
      chave: String(linha.chave),
      descricao: (linha.descricao as string | null) ?? null,
      sistema: linha.sistema === true,
      membros: membrosPorGrupo.get(String(linha.id)) ?? [],
      acesso_ids: acessosPorGrupo.get(String(linha.id)) ?? [],
    })),
    acessos: paginas.map((linha) => ({
      id: String(linha.id),
      chave: String(linha.chave),
      nome: String(linha.nome),
      rota: String(linha.rota),
      modulo: String(linha.modulo),
      perfis: comoLista(linha.perfis),
      ordem: Number(linha.ordem) || 0,
      restrito: linha.restrito === true,
      sistema: linha.sistema === true,
    })),
    utilizadores: pessoas.map((linha) => ({
      id: String(linha.id),
      nome: String(linha.nome),
      email: String(linha.email),
      perfil: String(linha.perfil),
    })),
  };
}

export async function criarGrupo(nomeRaw: unknown, descricaoRaw: unknown): Promise<void> {
  const nome = typeof nomeRaw === 'string' ? nomeRaw.trim() : '';
  if (nome.length < 2 || nome.length > 80) {
    throw new ErroAcesso('O nome do grupo precisa de 2 a 80 caracteres.');
  }
  const descricao = typeof descricaoRaw === 'string' ? descricaoRaw.trim().slice(0, 280) : '';
  const chave = chaveDe(nome);
  for (let tentativa = 0; tentativa < 6; tentativa++) {
    const candidato = tentativa === 0 ? chave : `${chave.slice(0, 36)}-${tentativa + 1}`;
    try {
      await sql`
        INSERT INTO grupo (nome, chave, descricao, sistema)
        VALUES (${nome}, ${candidato}, ${descricao || null}, false)
      `;
      return;
    } catch (err) {
      if ((err as { code?: string }).code !== '23505') throw err;
    }
  }
  throw new ErroAcesso('Já existe um grupo com esse nome.', 409);
}

export async function actualizarGrupo(grupoId: string, body: Record<string, unknown>): Promise<void> {
  if (!UUID.test(grupoId)) throw new ErroAcesso('Grupo inválido.');
  const linhas = await sql`SELECT id, chave, sistema FROM grupo WHERE id = ${grupoId}`;
  if (!linhas.length) throw new ErroAcesso('Grupo não encontrado.', 404);
  const grupo = linhas[0];

  if (typeof body.nome === 'string') {
    const nome = body.nome.trim();
    if (nome.length < 2 || nome.length > 80) {
      throw new ErroAcesso('O nome do grupo precisa de 2 a 80 caracteres.');
    }
    await sql`UPDATE grupo SET nome = ${nome} WHERE id = ${grupoId}`;
  }
  if (typeof body.descricao === 'string') {
    const descricao = body.descricao.trim().slice(0, 280);
    await sql`UPDATE grupo SET descricao = ${descricao || null} WHERE id = ${grupoId}`;
  }

  if (body.utilizador_ids !== undefined) {
    const ids = idsValidos(body.utilizador_ids);
    if (!ids) throw new ErroAcesso('Lista de utilizadores inválida.');
    if (String(grupo.chave) === 'dev' && ids.length === 0) {
      const actual = await sql`SELECT COUNT(*)::int AS n FROM grupo_utilizador WHERE grupo_id = ${grupoId}`;
      if ((actual[0].n as number) > 0) {
        throw new ErroAcesso('O grupo DEV tem de ficar com pelo menos uma conta.', 409);
      }
    }
    await sql.begin(async (tx) => {
      await tx`DELETE FROM grupo_utilizador WHERE grupo_id = ${grupoId}`;
      for (const id of ids) {
        await tx`
          INSERT INTO grupo_utilizador (grupo_id, utilizador_id)
          SELECT ${grupoId}, id FROM utilizadores WHERE id = ${id}
          ON CONFLICT DO NOTHING
        `;
      }
    });
  }

  if (body.acesso_ids !== undefined) {
    const ids = idsValidos(body.acesso_ids);
    if (!ids) throw new ErroAcesso('Lista de páginas inválida.');
    const sistema = await sql`SELECT id FROM acesso WHERE sistema = true`;
    const sistemaIds = sistema.map((linha) => String(linha.id));
    const finais = String(grupo.chave) === 'dev'
      ? [...new Set([...ids, ...sistemaIds])]
      : ids.filter((id) => !sistemaIds.includes(id));
    await sql.begin(async (tx) => {
      await tx`DELETE FROM grupo_acesso WHERE grupo_id = ${grupoId}`;
      for (const id of finais) {
        await tx`
          INSERT INTO grupo_acesso (grupo_id, acesso_id)
          SELECT ${grupoId}, id FROM acesso WHERE id = ${id}
          ON CONFLICT DO NOTHING
        `;
      }
    });
  }
}

export async function apagarGrupo(grupoId: string): Promise<void> {
  if (!UUID.test(grupoId)) throw new ErroAcesso('Grupo inválido.');
  const linhas = await sql`SELECT sistema FROM grupo WHERE id = ${grupoId}`;
  if (!linhas.length) throw new ErroAcesso('Grupo não encontrado.', 404);
  if (linhas[0].sistema === true) throw new ErroAcesso('O grupo DEV não pode ser eliminado.', 409);
  await sql`DELETE FROM grupo WHERE id = ${grupoId}`;
}

export async function definirRestrito(acessoId: string, restrito: boolean): Promise<void> {
  if (!UUID.test(acessoId)) throw new ErroAcesso('Página inválida.');
  const linhas = await sql`SELECT sistema FROM acesso WHERE id = ${acessoId}`;
  if (!linhas.length) throw new ErroAcesso('Página não encontrada.', 404);
  if (linhas[0].sistema === true && !restrito) {
    throw new ErroAcesso('A página de acessos fica sempre reservada ao grupo DEV.', 409);
  }
  await sql`UPDATE acesso SET restrito = ${restrito} WHERE id = ${acessoId}`;
}
