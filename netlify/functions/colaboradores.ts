import type { Config } from './_shared/route-config';
import { sql, jsonResponse, errorResponse, handleCors, publicErrorMessage } from './_shared/db';
import { requireAuth, authErrorResponse, AuthError } from './_shared/auth';
import { notificarMentorAtribuido } from './_shared/mentor-access';
import { reflectirGrupoDoMentor } from './_shared/controlo-acesso';
import { formatarAnexo, lerDocumentosPedidos } from './_shared/anexos';
import { emCache, invalidarColaboradores, invalidarMentores } from './_shared/cache-leitura';
import {
  chaveFiltroColaboradores,
  lerDetalheColaborador,
  lerFiltroColaboradores,
  lerPaginaColaboradores,
  lerResumoColaboradores,
  lerTodosColaboradores,
} from './_shared/colaboradores-leitura';
import { EMAIL_DOMINIO } from '@/lib/constants';

/**
 * Colaboradores + motor de instância de trilho (EPICs 5.1, 5.2, 3.2).
 *
 * Admin:
 *   GET    /api/colaboradores                     — lista
 *   GET    /api/colaboradores/:id                 — detalhe + progresso
 *   POST   /api/colaboradores                     — cria colaborador + conta de login
 *   PATCH  /api/colaboradores/:id                 — edita dados
 *   DELETE /api/colaboradores/:id                 — remove
 *   POST   /api/colaboradores/:id/atribuir-trilho — instancia um template e gera progresso
 *
 * Colaborador (self, resolvido por utilizador_id):
 *   GET    /api/colaboradores/meu-trilho          — trilho + etapas + progresso
 *   PATCH  /api/colaboradores/etapa/:id/concluir  — conclui uma etapa e desbloqueia a seguinte
 */

function slugEmail(nome: string): string {
  const base = nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z\s]/g, '')
    .split(/\s+/)
    .filter(Boolean);
  const local = base.length >= 2 ? `${base[0]}.${base[base.length - 1]}` : base[0] || 'colaborador';
  return `${local}@${EMAIL_DOMINIO}`;
}

function dataIso(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

/** Datas de início e fim por etapa, na ordem do template. String = mensagem de erro. */
function datasDasEtapas(
  input: unknown,
  etapas: Array<{ nome?: string }>,
): Array<{ data_inicio: string; data_fim: string }> | string {
  if (!etapas.length) return [];
  if (!Array.isArray(input) || input.length !== etapas.length) {
    return 'Indique a data de início e de fim de cada etapa';
  }
  const planos: Array<{ data_inicio: string; data_fim: string }> = [];
  for (let i = 0; i < etapas.length; i++) {
    const item = input[i] as { data_inicio?: unknown; data_fim?: unknown };
    const inicio = dataIso(item?.data_inicio);
    const fim = dataIso(item?.data_fim);
    const nome = etapas[i].nome || `etapa ${i + 1}`;
    if (!inicio || !fim) return `Indique início e fim da etapa «${nome}»`;
    if (fim < inicio) return `Na etapa «${nome}», o fim tem de ser igual ou posterior ao início`;
    planos.push({ data_inicio: inicio, data_fim: fim });
  }
  return planos;
}

function tempPassword(): string {
  return `Pumangol@${Math.floor(1000 + Math.random() * 9000)}`;
}

/** Cria (ou reutiliza) a conta de login do colaborador. Devolve credenciais só se nova. */
async function provisionarConta(nome: string, email: string, departamento: string) {
  const existentes = await sql`SELECT id FROM utilizadores WHERE lower(email) = lower(${email}) LIMIT 1`;
  if (existentes.length) {
    return { utilizadorId: existentes[0].id as string, credenciais: null as null | { email: string; password: string } };
  }
  const password = tempPassword();
  const criado = await sql`
    INSERT INTO utilizadores (nome, email, perfil, departamento, estado, password_hash)
    VALUES (${nome}, ${email}, 'novo_colaborador'::perfil_utilizador, ${departamento}, 'activo', crypt(${password}, gen_salt('bf')))
    RETURNING id
  `;
  return { utilizadorId: criado[0].id as string, credenciais: { email, password } };
}

export default async (req: Request): Promise<Response> => {
  const cors = handleCors(req);
  if (cors) return cors;

  const url = new URL(req.url);
  const parts = url.pathname.split('/').filter(Boolean);
  const method = req.method;
  const last = parts[parts.length - 1];
  const prev = parts[parts.length - 2];

  try {
    const user = await requireAuth(req);

    // ===== Colaborador (self) =====

    // GET /api/colaboradores/meu-trilho
    if (method === 'GET' && last === 'meu-trilho') {
      const colab = await sql`
        SELECT * FROM colaboradores WHERE utilizador_id = ${user.id} ORDER BY created_at DESC LIMIT 1
      `;
      if (!colab.length) return jsonResponse({ data: { colaborador: null, trilho: null, progresso: [] } });
      const c = colab[0];
      let trilho = null;
      if (c.trilho_id) {
        const t = await sql`SELECT * FROM trilhos_onboarding WHERE id = ${c.trilho_id}`;
        trilho = t[0] ?? null;
      }
      const progresso = c.trilho_id
        ? await sql`
            SELECT p.id, p.estado, p.data_inicio, p.data_conclusao, p.data_prevista, p.etapa_id, p.trilho_id, p.colaborador_id,
                   e.nome AS etapa_nome, e.descricao AS etapa_descricao, e.tipo AS etapa_tipo,
                   e.duracao_dias, e.ordem, e.obrigatoria, e.bloqueante, e.documentos_pedidos
            FROM progresso_onboarding p
            JOIN etapas_trilho e ON e.id = p.etapa_id
            WHERE p.colaborador_id = ${c.id}
            ORDER BY e.ordem
          `
        : [];
      const anexos = progresso.length
        ? await sql`
            SELECT a.* FROM etapa_anexos a
              JOIN progresso_onboarding p ON p.id = a.progresso_id
             WHERE p.colaborador_id = ${c.id}
             ORDER BY a.created_at
          `
        : [];
      const progressoComAnexos = progresso.map((p) => ({
        ...p,
        documentos_pedidos: lerDocumentosPedidos(p.documentos_pedidos),
        anexos: anexos.filter((a) => a.progresso_id === p.id).map(formatarAnexo),
      }));
      return jsonResponse({ data: { colaborador: c, trilho, progresso: progressoComAnexos } });
    }

    // PATCH /api/colaboradores/etapa/:id/concluir
    if (method === 'PATCH' && last === 'concluir' && parts.includes('etapa')) {
      const progressoId = prev; // .../etapa/:id/concluir
      // Verifica posse (a etapa pertence a um colaborador desta conta)
      const own = await sql`
        SELECT p.id, p.colaborador_id, e.documentos_pedidos FROM progresso_onboarding p
        JOIN colaboradores c ON c.id = p.colaborador_id
        LEFT JOIN etapas_trilho e ON e.id = p.etapa_id
        WHERE p.id = ${progressoId} AND c.utilizador_id = ${user.id}
        LIMIT 1
      `;
      if (!own.length) return errorResponse('Etapa não encontrada', 404);
      const colaboradorId = own[0].colaborador_id as string;

      const obrigatorios = lerDocumentosPedidos(own[0].documentos_pedidos).filter((d) => d.obrigatorio);
      if (obrigatorios.length) {
        const enviados = await sql`SELECT DISTINCT documento_chave FROM etapa_anexos WHERE progresso_id = ${progressoId}`;
        const chaves = new Set(enviados.map((r) => r.documento_chave as string));
        const emFalta = obrigatorios.filter((d) => !chaves.has(d.chave)).map((d) => d.nome);
        if (emFalta.length) {
          return errorResponse(`Anexa primeiro: ${emFalta.join(', ')}.`, 409);
        }
      }

      await sql`
        UPDATE progresso_onboarding SET estado = 'concluida', data_conclusao = CURRENT_DATE
        WHERE id = ${progressoId}
      `;
      // Desbloqueia a próxima etapa pendente (menor ordem)
      const prox = await sql`
        SELECT p.id FROM progresso_onboarding p
        JOIN etapas_trilho e ON e.id = p.etapa_id
        WHERE p.colaborador_id = ${colaboradorId} AND p.estado = 'pendente'
        ORDER BY e.ordem LIMIT 1
      `;
      if (prox.length) {
        await sql`UPDATE progresso_onboarding SET estado = 'em_curso', data_inicio = COALESCE(data_inicio, CURRENT_DATE) WHERE id = ${prox[0].id}`;
      } else {
        // Sem pendentes — verifica se está tudo concluído
        const restantes = await sql`
          SELECT COUNT(*)::int AS n FROM progresso_onboarding
          WHERE colaborador_id = ${colaboradorId} AND estado <> 'concluida'
        `;
        if ((restantes[0].n as number) === 0) {
          await sql`UPDATE colaboradores SET estado_onboarding = 'concluido', updated_at = NOW() WHERE id = ${colaboradorId}`;
        }
      }
      invalidarColaboradores();
      return jsonResponse({ data: { ok: true } });
    }

    // ===== Admin =====

    // GET lista. Sem ?pagina devolve a lista (outras páginas). Com ?pagina, só um bloco.
    if (method === 'GET' && last === 'colaboradores') {
      if (url.searchParams.has('pagina')) {
        const filtro = lerFiltroColaboradores(url);
        const [resumo, pagina] = await Promise.all([
          emCache(['colaboradores-resumo'], lerResumoColaboradores),
          emCache(['colaboradores-pagina', chaveFiltroColaboradores(filtro)], () => lerPaginaColaboradores(filtro)),
        ]);
        return jsonResponse({ data: { ...pagina, resumo } });
      }
      const rows = await emCache(['colaboradores-todos'], lerTodosColaboradores);
      return jsonResponse({ data: rows });
    }

    // GET detalhe
    if (method === 'GET' && prev === 'colaboradores') {
      const detalhe = await emCache(['colaborador-detalhe', last], () => lerDetalheColaborador(last));
      if (!detalhe) return errorResponse('Colaborador não encontrado', 404);
      return jsonResponse({ data: detalhe });
    }

    if (user.role !== 'rh_admin') return errorResponse('Sem permissão', 403);

    // POST cria colaborador + conta (+ atribuição de mentor opcional)
    if (method === 'POST' && last === 'colaboradores') {
      const body = await req.json();
      const { candidato_id_origem, nome, funcao, direccao, data_admissao, categoria, mentor_id } = body;
      if (!nome || !funcao || !direccao || !data_admissao) {
        return errorResponse('nome, funcao, direccao e data_admissao são obrigatórios', 400);
      }
      const email = (typeof body.email === 'string' && body.email.trim()) ? body.email.trim().toLowerCase() : slugEmail(nome);
      const { utilizadorId, credenciais } = await provisionarConta(nome, email, direccao);

      const rows = await sql`
        INSERT INTO colaboradores (candidato_id_origem, nome, funcao, direccao, data_admissao, categoria, email, utilizador_id, estado_onboarding)
        VALUES (
          ${candidato_id_origem ?? null}, ${nome}, ${funcao}, ${direccao}, ${data_admissao},
          ${categoria ?? 'tecnicos'}, ${email}, ${utilizadorId}, 'nao_iniciado'::estado_onboarding
        )
        RETURNING *
      `;
      const colaboradorId = rows[0].id as string;

      // Timeline: colaborador criado
      await sql`
        INSERT INTO onboarding_timeline (colaborador_id, tipo, actor_id, actor_nome, actor_role, descricao)
        VALUES (${colaboradorId}, 'utilizador_criado', ${user.id}, ${user.email}, ${user.role},
                ${'Colaborador criado: ' + nome})
      `;

      // Atribuição de mentor (se fornecida)
      if (mentor_id) {
        const mentorCheck = await sql`
          SELECT m.id, m.utilizador_id AS mentor_uid,
                 COALESCE(NULLIF(btrim(m.nome), ''), u.nome) AS mentor_nome
          FROM mentors m
          LEFT JOIN utilizadores u ON u.id = m.utilizador_id
          WHERE m.id = ${mentor_id} AND m.activo = true
        `;
        if (mentorCheck.length) {
          await sql`
            INSERT INTO mentor_assignments (colaborador_id, mentor_id, atribuido_por, activo)
            VALUES (${colaboradorId}, ${mentor_id}, ${user.id}, true)
          `;
          await sql`
            INSERT INTO onboarding_timeline (colaborador_id, tipo, actor_id, actor_nome, actor_role, descricao, meta)
            VALUES (${colaboradorId}, 'mentor_atribuido', ${user.id}, ${user.email}, ${user.role},
                    ${'Mentor atribuído: ' + mentorCheck[0].mentor_nome},
                    ${JSON.stringify({ mentor_id, mentor_nome: mentorCheck[0].mentor_nome })}::text::jsonb)
          `;
          invalidarMentores();
          await reflectirGrupoDoMentor(mentor_id);
          await notificarMentorAtribuido({
            mentorId: mentor_id,
            colaboradorId,
            colaboradorNome: nome,
          });
        }
      }

      invalidarColaboradores();
      return jsonResponse({ data: { colaborador: rows[0], credenciais } }, 201);
    }

    // POST /:id/atribuir-trilho
    if (method === 'POST' && last === 'atribuir-trilho') {
      const colaboradorId = prev;
      const body = await req.json();
      const templateId = body.trilho_id;
      if (!templateId) return errorResponse('trilho_id em falta', 400);

      const tpl = await sql`SELECT * FROM trilhos_onboarding WHERE id = ${templateId}`;
      if (!tpl.length) return errorResponse('Trilho não encontrado', 404);
      const t = tpl[0];
      const etapasTpl = await sql`
        SELECT ordem, nome, tipo, duracao_dias, descricao, conteudo_ref, criterio_conclusao, obrigatoria, bloqueante, responsavel_default, documentos_pedidos
        FROM etapas_trilho WHERE trilho_id = ${templateId} ORDER BY ordem
      `;
      const datas = datasDasEtapas(body.etapas, etapasTpl);
      if (typeof datas === 'string') return errorResponse(datas, 400);

      // Reatribuição numa transacção: se algo falhar, o colaborador mantém o trilho anterior.
      const instId = await sql.begin(async (tx) => {
        // Remove instância anterior (reatribuição): progresso + trilho instância.
        // A FK de colaboradores.trilho_id não faz ON DELETE SET NULL nesta base,
        // por isso a referência tem de sair antes de apagar o trilho.
        const anterior = await tx`SELECT trilho_id FROM colaboradores WHERE id = ${colaboradorId}`;
        const trilhoAnterior = anterior[0]?.trilho_id as string | null;
        await tx`DELETE FROM progresso_onboarding WHERE colaborador_id = ${colaboradorId}`;
        if (trilhoAnterior) {
          const instancia = await tx`
            SELECT id FROM trilhos_onboarding
            WHERE id = ${trilhoAnterior} AND is_template = false
          `;
          if (instancia.length) {
            await tx`
              UPDATE colaboradores
                 SET trilho_id = NULL, updated_at = NOW()
               WHERE trilho_id = ${trilhoAnterior}
            `;
            await tx`DELETE FROM progresso_onboarding WHERE trilho_id = ${trilhoAnterior}`;
            await tx`DELETE FROM etapas_trilho WHERE trilho_id = ${trilhoAnterior}`;
            await tx`DELETE FROM trilhos_onboarding WHERE id = ${trilhoAnterior}`;
          }
        }

        // Cria instância imutável (cópia do template)
        const inst = await tx`
          INSERT INTO trilhos_onboarding (funcao, nome, duracao_estimada, versao, activo, categoria, descricao, is_template)
          VALUES (${t.funcao}, ${t.nome}, ${t.duracao_estimada}, ${t.versao}, true, ${t.categoria}, ${t.descricao}, false)
          RETURNING id
        `;
        const novoId = inst[0].id as string;

        // Copia etapas e gera progresso sequencial (1ª em curso, restantes pendentes)
        for (let i = 0; i < etapasTpl.length; i++) {
          const e = etapasTpl[i];
          const novaEtapa = await tx`
            INSERT INTO etapas_trilho (trilho_id, ordem, nome, tipo, duracao_dias, descricao, conteudo_ref, criterio_conclusao, obrigatoria, bloqueante, responsavel_default, documentos_pedidos)
            VALUES (${novoId}, ${e.ordem}, ${e.nome}, ${e.tipo}::tipo_etapa, ${e.duracao_dias}, ${e.descricao}, ${e.conteudo_ref}, ${e.criterio_conclusao}, ${e.obrigatoria}, ${e.bloqueante}, ${e.responsavel_default}, ${tx.json(lerDocumentosPedidos(e.documentos_pedidos))})
            RETURNING id
          `;
          const estado = i === 0 ? 'em_curso' : 'pendente';
          const plano = datas[i];
          await tx`
            INSERT INTO progresso_onboarding (colaborador_id, trilho_id, etapa_id, estado, data_inicio, data_prevista)
            VALUES (
              ${colaboradorId}, ${novoId}, ${novaEtapa[0].id}, ${estado}::estado_etapa,
              ${plano?.data_inicio ?? null}, ${plano?.data_fim ?? null}
            )
          `;
        }

        await tx`
          UPDATE colaboradores SET trilho_id = ${novoId}, estado_onboarding = 'em_curso', updated_at = NOW()
          WHERE id = ${colaboradorId}
        `;
        return novoId;
      });

      invalidarColaboradores();
      return jsonResponse({ data: { ok: true, trilho_id: instId, etapas: etapasTpl.length } });
    }

    // PATCH edita colaborador
    if (method === 'PATCH' && prev === 'colaboradores') {
      const body = await req.json();
      const rows = await sql`
        UPDATE colaboradores SET
          nome = COALESCE(${body.nome ?? null}, nome),
          funcao = COALESCE(${body.funcao ?? null}, funcao),
          direccao = COALESCE(${body.direccao ?? null}, direccao),
          categoria = COALESCE(${body.categoria ?? null}, categoria),
          email = COALESCE(${body.email ?? null}, email),
          estado_onboarding = COALESCE(${body.estado_onboarding ?? null}::estado_onboarding, estado_onboarding),
          updated_at = NOW()
        WHERE id = ${last}
        RETURNING *
      `;
      invalidarColaboradores();
      return jsonResponse({ data: rows[0] });
    }

    // DELETE colaborador
    if (method === 'DELETE' && prev === 'colaboradores') {
      await sql`DELETE FROM colaboradores WHERE id = ${last}`;
      invalidarColaboradores();
      return jsonResponse({ data: { ok: true } });
    }

    return errorResponse('Método não suportado', 405);
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err);
    console.error('[colaboradores]', err);
    return errorResponse(publicErrorMessage(err, 'Erro interno'));
  }
};

export const config: Config = {
  path: [
    '/api/colaboradores',
    '/api/colaboradores/meu-trilho',
    '/api/colaboradores/:id',
    '/api/colaboradores/:id/atribuir-trilho',
    '/api/colaboradores/etapa/:id/concluir',
  ],
};
