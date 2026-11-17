import type { Config } from './_shared/route-config';
import sanitizeHtml from 'sanitize-html';
import { sql, jsonResponse, errorResponse, handleCors, publicErrorMessage } from './_shared/db';
import { requireAuth, authErrorResponse, AuthError } from './_shared/auth';
import {
  aplicarAccao,
  etapaPorCodigo,
  estadoInicial,
  type AccaoAdmissao,
  type EtapaRuntime,
  type ProcessoRuntime,
} from '@/src/lib/admissao-fluxo';
import { emailCartaOferta } from './_shared/email-templates';
import { mailHasBanner, sendMail } from './_shared/mail';
import { activarOnboarding, ActivacaoErro } from './_shared/activar-onboarding';

/**
 * Processo de admissão (corte 1 — motor interno da DPC).
 *
 *   GET    /api/admissao
 *   POST   /api/admissao
 *   GET    /api/admissao/:id
 *   PATCH  /api/admissao/:id
 *   POST   /api/admissao/:id/accao
 *   POST   /api/admissao/:id/carta
 */

interface EtapaRow {
  id: string;
  codigo: string;
  ordem: number;
  estado: EtapaRuntime['estado'];
  resultado: EtapaRuntime['resultado'];
  observacao: string | null;
  concluida_em: string | null;
  concluida_por: string | null;
}

interface ProcessoRow {
  id: string;
  estado: ProcessoRuntime['estado'];
  etapa_actual: string;
  semaforo: ProcessoRuntime['semaforo'];
  bloqueado: boolean;
  bloqueio_motivo: string | null;
  motivo_cancelamento: string | null;
  [key: string]: unknown;
}

function dataIso(value: unknown): string | null {
  if (value == null || value === '') return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value !== 'string') return null;
  const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

function texto(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const limpo = value.trim();
  return limpo ? limpo : null;
}

const HTML_EMAIL: sanitizeHtml.IOptions = {
  allowedTags: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'h2', 'h3', 'ul', 'ol', 'li', 'blockquote', 'a', 'hr'],
  allowedAttributes: { a: ['href', 'target', 'rel'] },
  allowedSchemes: ['http', 'https', 'mailto'],
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { target: '_blank', rel: 'noopener noreferrer' }),
    p: sanitizeHtml.simpleTransform('p', { style: 'margin:0 0 14px;font-size:15px;line-height:1.6;color:#1A1A2E;' }),
    h2: sanitizeHtml.simpleTransform('h2', { style: 'margin:18px 0 8px;font-size:18px;line-height:1.3;color:#0C2A1B;' }),
    h3: sanitizeHtml.simpleTransform('h3', { style: 'margin:16px 0 8px;font-size:16px;line-height:1.3;color:#0C2A1B;' }),
    ul: sanitizeHtml.simpleTransform('ul', { style: 'margin:0 0 14px;padding-left:22px;font-size:15px;line-height:1.6;color:#1A1A2E;' }),
    ol: sanitizeHtml.simpleTransform('ol', { style: 'margin:0 0 14px;padding-left:22px;font-size:15px;line-height:1.6;color:#1A1A2E;' }),
    blockquote: sanitizeHtml.simpleTransform('blockquote', { style: 'margin:0 0 14px;padding-left:12px;border-left:3px solid #17B85F;color:#133D27;' }),
  },
};

function corpoEmail(value: unknown): { html: string; texto: string } | null {
  if (typeof value !== 'string') return null;
  const html = sanitizeHtml(value, HTML_EMAIL).trim();
  const plano = sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} })
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
  if (!plano || plano.length > 8000 || html.length > 50_000) return null;
  return { html, texto: plano };
}

function anexoPdf(base64: unknown, nome: unknown): { buffer: Buffer; nome: string } | null {
  if (typeof base64 !== 'string' || typeof nome !== 'string') return null;
  const limpo = base64.replace(/\s/g, '');
  if (!limpo || limpo.length > 12_000_000 || !/^[A-Za-z0-9+/]+=*$/.test(limpo)) return null;
  const buffer = Buffer.from(limpo, 'base64');
  if (buffer.length < 5 || buffer.length > 8 * 1024 * 1024) return null;
  if (buffer.subarray(0, 5).toString('latin1') !== '%PDF-') return null;
  const base = nome.split(/[/\\]/).pop()?.trim() ?? '';
  const seguro = base.replace(/[^\w.\- ()áàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ]+/g, '_').slice(0, 120);
  if (!seguro.toLowerCase().endsWith('.pdf')) return null;
  return { buffer, nome: seguro };
}

function runtimeDe(processo: ProcessoRow, etapas: EtapaRow[]): ProcessoRuntime {
  return {
    estado: processo.estado,
    etapaActual: processo.etapa_actual,
    semaforo: processo.semaforo,
    bloqueado: processo.bloqueado,
    bloqueioMotivo: processo.bloqueio_motivo,
    motivoCancelamento: processo.motivo_cancelamento,
    etapas: etapas.map((etapa) => ({
      codigo: etapa.codigo,
      estado: etapa.estado,
      resultado: etapa.resultado,
      observacao: etapa.observacao,
    })),
  };
}

function etapaPublica(etapa: EtapaRow) {
  const def = etapaPorCodigo(etapa.codigo);
  return {
    ...etapa,
    nome: def.nome,
    fase: def.fase,
    responsavel: def.responsavel,
    descricao: def.descricao,
    decisao: def.decisao,
    sim_etiqueta: def.simEtiqueta,
    nao_etiqueta: def.naoEtiqueta,
  };
}

function comEtapa(row: Record<string, unknown>) {
  const def = etapaPorCodigo(String(row.etapa_actual));
  return { ...row, etapa_nome: def.nome, fase: def.fase };
}

async function carregar(id: string) {
  const processos = await sql`
    SELECT id, candidato_ref, nome, email, telefone, funcao, direccao, empresa, gestor,
           local_trabalho, categoria, tipo_contrato, data_prevista_entrada,
           estado, etapa_actual, semaforo, bloqueado, bloqueio_motivo, motivo_cancelamento,
           oferta_validade, oferta_condicoes, oferta_enviada_em, oferta_destinatario,
           colaborador_id, criado_por, created_at, updated_at
    FROM processos_admissao WHERE id = ${id} LIMIT 1
  `;
  if (!processos.length) return null;
  const etapas = await sql<EtapaRow[]>`
    SELECT id, codigo, ordem, estado, resultado, observacao, concluida_em, concluida_por
    FROM etapas_admissao
    WHERE processo_id = ${id}
    ORDER BY ordem
  `;
  const auditoria = await sql`
    SELECT a.id, a.accao, a.dados_anteriores, a.dados_novos, a.timestamp, u.nome AS utilizador_nome
    FROM audit_log a
    LEFT JOIN utilizadores u ON u.id = a.utilizador_id
    WHERE a.entidade = 'processo_admissao' AND a.entidade_id = ${id}
    ORDER BY a.timestamp DESC
    LIMIT 50
  `;
  const processo = processos[0] as ProcessoRow;
  return {
    processo: comEtapa(processo),
    etapas: (etapas as unknown as EtapaRow[]).map(etapaPublica),
    auditoria,
    runtime: runtimeDe(processo, etapas as unknown as EtapaRow[]),
    etapasRows: etapas as unknown as EtapaRow[],
  };
}

async function gravarAccao(
  id: string,
  userId: string,
  anterior: ProcessoRuntime,
  seguinte: ProcessoRuntime,
  rows: EtapaRow[],
  accaoAudit: string,
  resumo: string,
) {
  await sql.begin(async (tx) => {
    await tx`
      UPDATE processos_admissao SET
        estado = ${seguinte.estado}::estado_admissao,
        etapa_actual = ${seguinte.etapaActual},
        semaforo = ${seguinte.semaforo}::semaforo_admissao,
        bloqueado = ${seguinte.bloqueado},
        bloqueio_motivo = ${seguinte.bloqueioMotivo},
        motivo_cancelamento = ${seguinte.motivoCancelamento},
        updated_at = NOW()
      WHERE id = ${id}
    `;
    for (const etapa of seguinte.etapas) {
      const antes = rows.find((row) => row.codigo === etapa.codigo);
      const mudou = !antes
        || antes.estado !== etapa.estado
        || antes.resultado !== etapa.resultado
        || antes.observacao !== etapa.observacao;
      if (!mudou) continue;
      const fechou = etapa.estado === 'concluida' || etapa.estado === 'rejeitada';
      const concluidaEm = fechou ? (antes?.concluida_em ?? new Date().toISOString()) : null;
      const concluidaPor = fechou ? (antes?.concluida_por ?? userId) : null;
      await tx`
        UPDATE etapas_admissao SET
          estado = ${etapa.estado}::estado_etapa_admissao,
          resultado = ${etapa.resultado},
          observacao = ${etapa.observacao},
          concluida_em = ${concluidaEm},
          concluida_por = ${concluidaPor}
        WHERE processo_id = ${id} AND codigo = ${etapa.codigo}
      `;
    }
    await tx`
      INSERT INTO audit_log (utilizador_id, accao, entidade, entidade_id, dados_anteriores, dados_novos)
      VALUES (
        ${userId},
        ${accaoAudit},
        'processo_admissao',
        ${id},
        ${JSON.stringify({ estado: anterior.estado, etapa: anterior.etapaActual, semaforo: anterior.semaforo })}::text::jsonb,
        ${JSON.stringify({ estado: seguinte.estado, etapa: seguinte.etapaActual, semaforo: seguinte.semaforo, resumo })}::text::jsonb
      )
    `;
  });
}

export default async (req: Request): Promise<Response> => {
  const cors = handleCors(req);
  if (cors) return cors;

  const url = new URL(req.url);
  const parts = url.pathname.split('/').filter(Boolean);
  const id = parts[2] ?? null;
  const sub = parts[3] ?? null;
  const method = req.method;

  try {
    const user = await requireAuth(req);
    if (user.role !== 'rh_admin') throw new AuthError('Sem permissão para gerir admissões.', 403);

    if (method === 'GET' && !id) {
      const rows = await sql`
        SELECT id, candidato_ref, nome, email, telefone, funcao, direccao, empresa, gestor,
               local_trabalho, data_prevista_entrada, estado, etapa_actual, semaforo,
               bloqueado, bloqueio_motivo, created_at, updated_at
        FROM processos_admissao
        ORDER BY updated_at DESC
        LIMIT 200
      `;
      return jsonResponse({ data: rows.map((row) => comEtapa(row as Record<string, unknown>)) });
    }

    if (method === 'POST' && !id) {
      const body = await req.json().catch(() => null) as Record<string, unknown> | null;
      const nome = texto(body?.nome);
      if (!nome) return errorResponse('Indique o nome do candidato.', 400);
      const candidatoRef = texto(body?.candidato_ref);
      const dataEntrada = body?.data_prevista_entrada == null || body.data_prevista_entrada === ''
        ? null
        : dataIso(body.data_prevista_entrada);
      if (body?.data_prevista_entrada && !dataEntrada) return errorResponse('Data prevista de entrada inválida.', 400);

      if (candidatoRef) {
        const aberto = await sql`
          SELECT id FROM processos_admissao
          WHERE candidato_ref = ${candidatoRef} AND estado <> 'cancelado'
          LIMIT 1
        `;
        if (aberto.length) {
          return jsonResponse({
            error: 'Já existe um processo de admissão aberto para este candidato.',
            processo_id: aberto[0].id,
          }, 409);
        }
      }

      const inicial = estadoInicial();
      const criado = await sql.begin(async (tx) => {
        const rows = await tx`
          INSERT INTO processos_admissao (
            candidato_ref, nome, email, telefone, funcao, direccao, empresa, gestor,
            local_trabalho, categoria, tipo_contrato, data_prevista_entrada,
            estado, etapa_actual, semaforo, criado_por
          ) VALUES (
            ${candidatoRef},
            ${nome},
            ${texto(body?.email)},
            ${texto(body?.telefone)},
            ${texto(body?.funcao)},
            ${texto(body?.direccao)},
            ${texto(body?.empresa)},
            ${texto(body?.gestor)},
            ${texto(body?.local_trabalho)},
            ${texto(body?.categoria)},
            ${texto(body?.tipo_contrato)},
            ${dataEntrada},
            ${inicial.estado}::estado_admissao,
            ${inicial.etapaActual},
            ${inicial.semaforo}::semaforo_admissao,
            ${user.id}
          )
          RETURNING id, candidato_ref, nome, email, telefone, funcao, direccao, empresa, gestor,
                    local_trabalho, categoria, tipo_contrato, data_prevista_entrada,
                    estado, etapa_actual, semaforo, bloqueado, bloqueio_motivo, motivo_cancelamento,
                    oferta_validade, oferta_condicoes, oferta_enviada_em, oferta_destinatario,
                    criado_por, created_at, updated_at
        `;
        const processoId = rows[0].id as string;
        for (const etapa of inicial.etapas) {
          const def = etapaPorCodigo(etapa.codigo);
          await tx`
            INSERT INTO etapas_admissao (processo_id, codigo, ordem, estado)
            VALUES (${processoId}, ${etapa.codigo}, ${def.ordem}, ${etapa.estado}::estado_etapa_admissao)
          `;
        }
        await tx`
          INSERT INTO audit_log (utilizador_id, accao, entidade, entidade_id, dados_novos)
          VALUES (
            ${user.id},
            'admissao_criada',
            'processo_admissao',
            ${processoId},
            ${JSON.stringify({ nome, candidato_ref: candidatoRef, etapa: inicial.etapaActual })}::text::jsonb
          )
        `;
        return rows[0];
      });
      return jsonResponse({ data: comEtapa(criado as Record<string, unknown>) }, 201);
    }

    if (!id) return errorResponse('Método não suportado', 405);

    if (method === 'GET' && !sub) {
      const detalhe = await carregar(id);
      if (!detalhe) return errorResponse('Processo de admissão não encontrado.', 404);
      const { runtime: _runtime, etapasRows: _rows, ...publico } = detalhe;
      return jsonResponse({ data: publico });
    }

    if (method === 'PATCH' && !sub) {
      const body = await req.json().catch(() => null) as Record<string, unknown> | null;
      const actual = await sql`
        SELECT id, candidato_ref, nome, email, telefone, funcao, direccao, empresa, gestor,
               local_trabalho, categoria, tipo_contrato, data_prevista_entrada,
               estado, etapa_actual, semaforo, bloqueado, bloqueio_motivo, motivo_cancelamento,
               oferta_validade, oferta_condicoes, oferta_enviada_em, oferta_destinatario,
               criado_por, created_at, updated_at
        FROM processos_admissao WHERE id = ${id} LIMIT 1
      `;
      if (!actual.length) return errorResponse('Processo de admissão não encontrado.', 404);
      const estado = actual[0].estado as string;
      if (estado === 'cancelado' || estado === 'transferido_onboarding') {
        return errorResponse('Este processo já está encerrado.', 400);
      }
      const dataEntrada = body && 'data_prevista_entrada' in body
        ? (body.data_prevista_entrada == null || body.data_prevista_entrada === '' ? null : dataIso(body.data_prevista_entrada))
        : undefined;
      if (body && 'data_prevista_entrada' in body && body.data_prevista_entrada && dataEntrada == null) {
        return errorResponse('Data prevista de entrada inválida.', 400);
      }
      const campo = (chave: string, coluna: unknown): string | null => (
        body && chave in body ? texto(body[chave]) : texto(coluna)
      );
      const nome = campo('nome', actual[0].nome);
      if (!nome) return errorResponse('Indique o nome do candidato.', 400);
      const dataActual = dataIso(actual[0].data_prevista_entrada)
        ?? (actual[0].data_prevista_entrada instanceof Date ? actual[0].data_prevista_entrada.toISOString().slice(0, 10) : null);
      const dataGravar: string | null = dataEntrada === undefined ? dataActual : dataEntrada;
      const rows = await sql`
        UPDATE processos_admissao SET
          nome = ${nome},
          email = ${campo('email', actual[0].email)},
          telefone = ${campo('telefone', actual[0].telefone)},
          funcao = ${campo('funcao', actual[0].funcao)},
          direccao = ${campo('direccao', actual[0].direccao)},
          empresa = ${campo('empresa', actual[0].empresa)},
          gestor = ${campo('gestor', actual[0].gestor)},
          local_trabalho = ${campo('local_trabalho', actual[0].local_trabalho)},
          categoria = ${campo('categoria', actual[0].categoria)},
          tipo_contrato = ${campo('tipo_contrato', actual[0].tipo_contrato)},
          data_prevista_entrada = ${dataGravar},
          updated_at = NOW()
        WHERE id = ${id}
        RETURNING id, candidato_ref, nome, email, telefone, funcao, direccao, empresa, gestor,
                  local_trabalho, categoria, tipo_contrato, data_prevista_entrada,
                  estado, etapa_actual, semaforo, bloqueado, bloqueio_motivo, motivo_cancelamento,
                  oferta_validade, oferta_condicoes, oferta_enviada_em, oferta_destinatario,
                  criado_por, created_at, updated_at
      `;
      try {
        await sql`
          INSERT INTO audit_log (utilizador_id, accao, entidade, entidade_id, dados_anteriores, dados_novos)
          VALUES (
            ${user.id},
            'admissao_actualizada',
            'processo_admissao',
            ${id},
            ${JSON.stringify({ nome: actual[0].nome, funcao: actual[0].funcao, direccao: actual[0].direccao, data_prevista_entrada: actual[0].data_prevista_entrada })}::text::jsonb,
            ${JSON.stringify({ nome: rows[0].nome, funcao: rows[0].funcao, direccao: rows[0].direccao, data_prevista_entrada: rows[0].data_prevista_entrada })}::text::jsonb
          )
        `;
      } catch {
        /* o processo já ficou gravado */
      }
      return jsonResponse({ data: comEtapa(rows[0] as Record<string, unknown>) });
    }

    if (method === 'POST' && sub === 'accao') {
      const body = await req.json().catch(() => null) as { accao?: string; observacao?: string; motivo?: string } | null;
      const detalhe = await carregar(id);
      if (!detalhe) return errorResponse('Processo de admissão não encontrado.', 404);
      let accao: AccaoAdmissao;
      if (body?.accao === 'avancar') accao = { tipo: 'avancar', observacao: body.observacao };
      else if (body?.accao === 'recusar') accao = { tipo: 'recusar', observacao: body.observacao ?? '' };
      else if (body?.accao === 'cancelar') accao = { tipo: 'cancelar', motivo: body.motivo ?? body.observacao ?? '' };
      else return errorResponse('Acção inválida.', 400);

      const resultado = aplicarAccao(detalhe.runtime, accao);
      if (resultado.ok === false) return errorResponse(resultado.erro, 400);
      let resumo = resultado.resumo;
      if (accao.tipo === 'avancar' && detalhe.runtime.etapaActual === 'ADM-022') {
        try {
          const nota = await activarOnboarding({
            processoId: id,
            actor: { id: user.id, email: user.email, role: user.role },
          });
          resumo = `${resultado.resumo} ${nota}`;
        } catch (err) {
          if (err instanceof ActivacaoErro) return errorResponse(err.message, 400);
          throw err;
        }
      }
      await gravarAccao(id, user.id, detalhe.runtime, resultado.processo, detalhe.etapasRows, resultado.accaoAudit, resumo);
      const actualizado = await carregar(id);
      if (!actualizado) return errorResponse('Processo de admissão não encontrado.', 404);
      const { runtime: _runtime, etapasRows: _rows, ...publico } = actualizado;
      return jsonResponse({ data: publico });
    }

    if (method === 'POST' && sub === 'carta') {
      const body = await req.json().catch(() => null) as {
        validade?: string;
        observacao?: string;
        assunto?: string;
        corpoHtml?: string;
        anexoNome?: string;
        anexoBase64?: string;
      } | null;
      const detalhe = await carregar(id);
      if (!detalhe) return errorResponse('Processo de admissão não encontrado.', 404);
      const processo = detalhe.processo as unknown as ProcessoRow & {
        nome: string;
        email: string | null;
        oferta_enviada_em: unknown;
      };
      if (processo.estado === 'cancelado' || processo.estado === 'transferido_onboarding') {
        return errorResponse('Este processo já está encerrado.', 400);
      }
      if (processo.etapa_actual !== 'ADM-004') {
        return errorResponse('A carta envia-se na etapa de emissão da oferta.', 400);
      }
      if (processo.oferta_enviada_em) return errorResponse('A carta de oferta já foi enviada.', 400);
      const email = typeof processo.email === 'string' ? processo.email.trim() : '';
      if (!email || !email.includes('@')) return errorResponse('Indique o e-mail do candidato antes de enviar a carta.', 400);
      const validade = dataIso(body?.validade);
      if (!validade) return errorResponse('Indique a validade da oferta.', 400);
      const hoje = new Date().toISOString().slice(0, 10);
      if (validade < hoje) return errorResponse('A validade da oferta não pode ser anterior a hoje.', 400);
      const assunto = texto(body?.assunto);
      if (!assunto || assunto.length > 180) return errorResponse('Indique o assunto do email.', 400);
      const corpo = corpoEmail(body?.corpoHtml);
      if (!corpo) return errorResponse('Escreva o corpo do email antes de enviar.', 400);
      const anexo = anexoPdf(body?.anexoBase64, body?.anexoNome);
      if (!anexo) return errorResponse('Carregue a carta em PDF. O ficheiro tem de ser um PDF até 8 MB.', 400);

      const previa = aplicarAccao(detalhe.runtime, { tipo: 'avancar', observacao: texto(body?.observacao) });
      if (previa.ok === false) return errorResponse(previa.erro, 400);

      const mensagem = emailCartaOferta({
        assunto,
        corpoHtml: corpo.html,
        nomeAnexo: anexo.nome,
        hasBanner: await mailHasBanner(),
      });
      try {
        await sendMail({
          to: email,
          subject: mensagem.subject,
          html: mensagem.html,
          text: mensagem.text,
          contexto: 'carta-oferta',
          attachments: [{
            filename: anexo.nome,
            content: anexo.buffer,
            contentType: 'application/pdf',
          }],
        });
      } catch {
        return errorResponse('Não foi possível enviar o email. Confirme o endereço e tente novamente.', 502);
      }

      await sql`
        UPDATE processos_admissao SET
          oferta_validade = ${validade},
          oferta_condicoes = NULL,
          oferta_enviada_em = NOW(),
          oferta_destinatario = ${email},
          updated_at = NOW()
        WHERE id = ${id}
      `;

      const resultado = aplicarAccao(detalhe.runtime, { tipo: 'avancar', observacao: texto(body?.observacao) });
      if (resultado.ok === false) return errorResponse(resultado.erro, 400);
      await gravarAccao(id, user.id, detalhe.runtime, resultado.processo, detalhe.etapasRows, 'admissao_oferta_enviada', `Carta enviada para ${email}. Anexo: ${anexo.nome}.`);

      const actualizado = await carregar(id);
      if (!actualizado) return errorResponse('Processo de admissão não encontrado.', 404);
      const { runtime: _runtimeCarta, etapasRows: _rowsCarta, ...publico } = actualizado;
      return jsonResponse({ data: publico });
    }

    return errorResponse('Método não suportado', 405);
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err);
    const code = (err as { code?: string } | null)?.code;
    if (code === '23505') {
      return jsonResponse({ error: 'Já existe um processo de admissão aberto para este candidato.' }, 409);
    }
    console.error('[admissao]', err);
    return errorResponse(publicErrorMessage(err, 'Erro interno'));
  }
};

export const config: Config = {
  path: ['/api/admissao', '/api/admissao/:id', '/api/admissao/:id/accao', '/api/admissao/:id/carta'],
};
