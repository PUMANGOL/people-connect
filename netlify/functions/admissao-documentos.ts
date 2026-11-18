import { randomBytes } from 'node:crypto';
import type { Config } from './_shared/route-config';
import { sql, jsonResponse, errorResponse, handleCors, publicErrorMessage } from './_shared/db';
import { requireAuth, authErrorResponse, AuthError } from './_shared/auth';
import { aplicarAccao, type EtapaRuntime, type ProcessoRuntime } from '@/src/lib/admissao-fluxo';
import { appBaseUrl } from '@/src/lib/app-url';
import { emailChecklistDocumentos } from './_shared/email-templates';
import { mailHasBanner, sendMail } from './_shared/mail';
import { apagarObjecto, confirmarEnvio, linkEnvio, StorageError, urlLeitura, validarFicheiro } from './_shared/storage';

/**
 * Checklist documental da admissão e portal do candidato.
 *
 *   GET    /api/admissao/:id/documentos
 *   POST   /api/admissao/:id/documentos
 *   POST   /api/admissao/:id/documentos/enviar
 *   PATCH  /api/admissao/:id/documentos/:docId
 *   DELETE /api/admissao/:id/documentos/:docId
 *   GET    /api/admissao/:id/documentos/:docId/ficheiro
 *   POST   /api/admissao/:id/documentos/:docId/avaliar
 *   GET    /api/candidatura/:token
 *   POST   /api/candidatura/:token/envio     — link assinado para o candidato enviar o ficheiro
 *   POST   /api/candidatura/:token/submeter  — { ficheiroId, nome } ou, em legado, o conteúdo em base64
 */

const MAX_BYTES = 8 * 1024 * 1024;

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

interface ProcessoMinimo {
  id: string;
  nome: string;
  email: string | null;
  funcao: string | null;
  estado: ProcessoRuntime['estado'];
  etapa_actual: string;
  semaforo: ProcessoRuntime['semaforo'];
  bloqueado: boolean;
  bloqueio_motivo: string | null;
  motivo_cancelamento: string | null;
  documentos_token: string | null;
  documentos_enviado_em: string | null;
}

function texto(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const limpo = value.trim();
  return limpo ? limpo : null;
}

function fechado(estado: string): boolean {
  return estado === 'cancelado' || estado === 'transferido_onboarding';
}

function runtimeDe(processo: ProcessoMinimo, etapas: EtapaRow[]): ProcessoRuntime {
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

async function gravarAccao(
  id: string,
  userId: string | null,
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
      const fechouEtapa = etapa.estado === 'concluida' || etapa.estado === 'rejeitada';
      const concluidaEm = fechouEtapa ? (antes?.concluida_em ?? new Date().toISOString()) : null;
      const concluidaPor = fechouEtapa ? (antes?.concluida_por ?? userId) : null;
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

async function processoPorId(id: string): Promise<ProcessoMinimo | null> {
  const rows = await sql<ProcessoMinimo[]>`
    SELECT id, nome, email, funcao, estado, etapa_actual, semaforo, bloqueado, bloqueio_motivo,
           motivo_cancelamento, documentos_token, documentos_enviado_em
    FROM processos_admissao WHERE id = ${id} LIMIT 1
  `;
  return rows[0] ?? null;
}

async function etapasDe(id: string): Promise<EtapaRow[]> {
  const rows = await sql<EtapaRow[]>`
    SELECT id, codigo, ordem, estado, resultado, observacao, concluida_em, concluida_por
    FROM etapas_admissao WHERE processo_id = ${id} ORDER BY ordem
  `;
  return rows;
}

interface ItemRow {
  id: string;
  documento_exigido_id: string;
  nome: string;
  descricao: string | null;
  categoria: string | null;
  obrigatorio: boolean;
  ordem: number;
  submissao_estado: string | null;
  ficheiro_nome: string | null;
  motivo: string | null;
  submetido_em: string | null;
  avaliado_em: string | null;
}

function itemPublico(row: ItemRow) {
  return {
    id: row.id,
    documento_exigido_id: row.documento_exigido_id,
    nome: row.nome,
    descricao: row.descricao,
    categoria: row.categoria,
    obrigatorio: row.obrigatorio,
    ordem: row.ordem,
    submissao: row.submissao_estado
      ? {
        estado: row.submissao_estado,
        ficheiro_nome: row.ficheiro_nome,
        motivo: row.motivo,
        submetido_em: row.submetido_em,
        avaliado_em: row.avaliado_em,
      }
      : null,
  };
}

async function itensDe(processoId: string) {
  const rows = await sql<ItemRow[]>`
    SELECT d.id, d.documento_exigido_id, e.nome, e.descricao, e.categoria, d.obrigatorio, d.ordem,
           s.estado AS submissao_estado, s.ficheiro_nome, s.motivo, s.submetido_em, s.avaliado_em
    FROM admissao_documentos d
    JOIN documentos_exigidos e ON e.id = d.documento_exigido_id
    LEFT JOIN admissao_submissoes s ON s.admissao_documento_id = d.id
    WHERE d.processo_id = ${processoId}
    ORDER BY d.ordem, e.nome
  `;
  return rows.map(itemPublico);
}

function linkDe(token: string | null): string | null {
  return token ? `${appBaseUrl()}/candidatura/${token}` : null;
}

async function checklistDe(processo: ProcessoMinimo) {
  return {
    enviado_em: processo.documentos_enviado_em,
    link: linkDe(processo.documentos_token),
    itens: await itensDe(processo.id),
  };
}

function anexoCandidato(base64: unknown, nome: unknown, tipo: unknown): { buffer: Buffer; nome: string; tipo: string } | null {
  if (typeof base64 !== 'string' || typeof nome !== 'string' || typeof tipo !== 'string') return null;
  const declarado = tipo.toLowerCase();
  const limpo = base64.replace(/\s/g, '');
  if (!limpo || limpo.length > 12_000_000 || !/^[A-Za-z0-9+/]+=*$/.test(limpo)) return null;
  const buffer = Buffer.from(limpo, 'base64');
  if (buffer.length < 12 || buffer.length > MAX_BYTES) return null;
  const pdf = buffer.subarray(0, 5).toString('latin1') === '%PDF-';
  const jpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const png = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
  const webp = buffer.subarray(0, 4).toString('latin1') === 'RIFF' && buffer.subarray(8, 12).toString('latin1') === 'WEBP';
  const detectado = pdf ? 'application/pdf' : jpeg ? 'image/jpeg' : png ? 'image/png' : webp ? 'image/webp' : null;
  if (!detectado || detectado !== declarado) return null;
  const base = nome.split(/[/\\]/).pop()?.trim() ?? '';
  const seguro = base.replace(/[^\w.\- ()áàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ]+/g, '_').slice(0, 120);
  if (!seguro || seguro === '.' || seguro === '..') return null;
  return { buffer, nome: seguro, tipo: detectado };
}

function nomeSeguro(nome: unknown): string | null {
  if (typeof nome !== 'string') return null;
  const base = nome.split(/[/\\]/).pop()?.trim() ?? '';
  const seguro = base.replace(/[^\w.\- ()áàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ]+/g, '_').slice(0, 120);
  if (!seguro || seguro === '.' || seguro === '..') return null;
  return seguro;
}

async function documentoDaChecklist(processoId: string, docId: string) {
  const docs = await sql<{ id: string; estado: string | null }[]>`
    SELECT d.id, s.estado
    FROM admissao_documentos d
    LEFT JOIN admissao_submissoes s ON s.admissao_documento_id = d.id
    WHERE d.id = ${docId} AND d.processo_id = ${processoId}
    LIMIT 1
  `;
  return docs[0] ?? null;
}

async function tentarConcluirSubmissao(processo: ProcessoMinimo) {
  if (processo.etapa_actual !== 'ADM-007' || fechado(processo.estado)) return;
  const linhas = await sql<{ obrigatorio: boolean; estado: string | null }[]>`
    SELECT d.obrigatorio, s.estado
    FROM admissao_documentos d
    LEFT JOIN admissao_submissoes s ON s.admissao_documento_id = d.id
    WHERE d.processo_id = ${processo.id}
  `;
  if (!linhas.length) return;
  const obrigatorios = linhas.filter((linha) => linha.obrigatorio);
  const alvo = obrigatorios.length ? obrigatorios : linhas;
  const completo = alvo.every((linha) => linha.estado === 'submetido' || linha.estado === 'validado');
  if (!completo) return;
  const etapas = await etapasDe(processo.id);
  const anterior = runtimeDe(processo, etapas);
  const resultado = aplicarAccao(anterior, {
    tipo: 'avancar',
    observacao: 'O candidato entregou os documentos da checklist.',
  });
  if (resultado.ok === false) return;
  await gravarAccao(
    processo.id,
    null,
    anterior,
    resultado.processo,
    etapas,
    resultado.accaoAudit,
    resultado.resumo,
  );
}

async function candidatura(req: Request, parts: string[]): Promise<Response> {
  const token = parts[2] ?? '';
  const sub = parts[3] ?? null;
  if (!token || parts.length > 4 || (sub && sub !== 'submeter' && sub !== 'envio')) return errorResponse('Método não suportado', 405);

  const processos = await sql<ProcessoMinimo[]>`
    SELECT id, nome, email, funcao, estado, etapa_actual, semaforo, bloqueado, bloqueio_motivo,
           motivo_cancelamento, documentos_token, documentos_enviado_em
    FROM processos_admissao WHERE documentos_token = ${token} LIMIT 1
  `;
  const processo = processos[0];
  if (!processo) return errorResponse('Este link já não está activo.', 404);
  if (fechado(processo.estado)) return errorResponse('Este processo de admissão já não aceita documentos.', 410);

  if (req.method === 'GET' && !sub) {
    return jsonResponse({
      data: {
        nome: processo.nome,
        funcao: processo.funcao,
        itens: await itensDe(processo.id),
      },
    });
  }

  if (req.method === 'POST' && sub === 'envio') {
    const body = await req.json().catch(() => null) as Record<string, unknown> | null;
    const docId = texto(body?.admissao_documento_id);
    if (!docId) return errorResponse('Indique o documento.', 400);
    validarFicheiro('admissao', typeof body?.tipo === 'string' ? body.tipo : '', Number(body?.tamanho));
    const docs = await documentoDaChecklist(processo.id, docId);
    if (!docs) return errorResponse('Documento não encontrado nesta checklist.', 404);
    if (docs.estado === 'validado') return errorResponse('Este documento já foi validado e não pode ser substituído.', 409);
    const link = await linkEnvio(`admissao/${processo.id}/${docId}`, processo.id, 'PRIVATE');
    return jsonResponse({ data: link });
  }

  if (req.method === 'POST' && sub === 'submeter') {
    const body = await req.json().catch(() => null) as Record<string, unknown> | null;
    const docId = texto(body?.admissao_documento_id);
    if (!docId) return errorResponse('Indique o documento.', 400);
    const docs = await documentoDaChecklist(processo.id, docId);
    if (!docs) return errorResponse('Documento não encontrado nesta checklist.', 404);
    if (docs.estado === 'validado') return errorResponse('Este documento já foi validado e não pode ser substituído.', 409);

    const ficheiroId = typeof body?.ficheiroId === 'string' ? body.ficheiroId : '';
    if (ficheiroId) {
      const nome = nomeSeguro(body?.nome);
      if (!nome) return errorResponse('Indique o nome do ficheiro.', 400);
      const meta = await confirmarEnvio('admissao', ficheiroId, `admissao/${processo.id}/${docId}`, processo.id);
      const anterior = await sql<{ ficheiro_id: string | null }[]>`
        SELECT ficheiro_id FROM admissao_submissoes WHERE admissao_documento_id = ${docId}
      `;
      await sql`
        INSERT INTO admissao_submissoes (
          admissao_documento_id, estado, ficheiro_nome, ficheiro_tipo, ficheiro, ficheiro_id, motivo, submetido_em, avaliado_em
        ) VALUES (
          ${docId}, 'submetido', ${nome}, ${meta.tipo}, NULL, ${ficheiroId}, NULL, NOW(), NULL
        )
        ON CONFLICT (admissao_documento_id) DO UPDATE SET
          estado = 'submetido',
          ficheiro_nome = EXCLUDED.ficheiro_nome,
          ficheiro_tipo = EXCLUDED.ficheiro_tipo,
          ficheiro = NULL,
          ficheiro_id = EXCLUDED.ficheiro_id,
          motivo = NULL,
          submetido_em = NOW(),
          avaliado_em = NULL
      `;
      const antigo = anterior[0]?.ficheiro_id;
      if (antigo && antigo !== ficheiroId) await apagarObjecto(antigo);
      await tentarConcluirSubmissao(processo);
      return jsonResponse({ data: { itens: await itensDe(processo.id) } });
    }

    const anexo = anexoCandidato(body?.conteudo, body?.nome, body?.tipo);
    if (!anexo) return errorResponse('Envie um PDF, JPG, PNG ou WEBP até 8 MB.', 400);

    const anterior = await sql<{ ficheiro_id: string | null }[]>`
      SELECT ficheiro_id FROM admissao_submissoes WHERE admissao_documento_id = ${docId}
    `;
    await sql`
      INSERT INTO admissao_submissoes (
        admissao_documento_id, estado, ficheiro_nome, ficheiro_tipo, ficheiro, motivo, submetido_em, avaliado_em
      ) VALUES (
        ${docId}, 'submetido', ${anexo.nome}, ${anexo.tipo}, ${anexo.buffer}, NULL, NOW(), NULL
      )
      ON CONFLICT (admissao_documento_id) DO UPDATE SET
        estado = 'submetido',
        ficheiro_nome = EXCLUDED.ficheiro_nome,
        ficheiro_tipo = EXCLUDED.ficheiro_tipo,
        ficheiro = EXCLUDED.ficheiro,
        ficheiro_id = NULL,
        motivo = NULL,
        submetido_em = NOW(),
        avaliado_em = NULL
    `;
    if (anterior[0]?.ficheiro_id) await apagarObjecto(anterior[0].ficheiro_id);
    await tentarConcluirSubmissao(processo);
    return jsonResponse({ data: { itens: await itensDe(processo.id) } });
  }

  return errorResponse('Método não suportado', 405);
}

async function admin(req: Request): Promise<Response> {
  const user = await requireAuth(req);
  if (user.role !== 'rh_admin') throw new AuthError('Sem permissão para gerir admissões.', 403);

  const url = new URL(req.url);
  const parts = url.pathname.split('/').filter(Boolean);
  const id = parts[2] ?? '';
  const docId = parts[4] && parts[4] !== 'enviar' ? parts[4] : null;
  const acao = parts[4] === 'enviar' ? 'enviar' : (parts[5] ?? null);
  const method = req.method;

  const processo = await processoPorId(id);
  if (!processo) return errorResponse('Processo de admissão não encontrado.', 404);

  if (method === 'GET' && !docId && !acao) {
    return jsonResponse({ data: await checklistDe(processo) });
  }

  if (method === 'GET' && docId && acao === 'ficheiro') {
    const rows = await sql<{ ficheiro: Buffer | null; ficheiro_id: string | null; ficheiro_nome: string; ficheiro_tipo: string }[]>`
      SELECT s.ficheiro, s.ficheiro_id, s.ficheiro_nome, s.ficheiro_tipo
      FROM admissao_submissoes s
      JOIN admissao_documentos d ON d.id = s.admissao_documento_id
      WHERE d.id = ${docId} AND d.processo_id = ${id}
      LIMIT 1
    `;
    const ficheiro = rows[0];
    if (!ficheiro) return errorResponse('Ainda não há ficheiro neste documento.', 404);
    if (ficheiro.ficheiro_id) {
      const destino = await urlLeitura(ficheiro.ficheiro_id, { descarregar: true });
      return jsonResponse({ data: { url: destino } });
    }
    if (!ficheiro.ficheiro) return errorResponse('Ainda não há ficheiro neste documento.', 404);
    const nome = ficheiro.ficheiro_nome.replace(/["\r\n]/g, '').slice(0, 120) || 'documento';
    const bytes = Buffer.isBuffer(ficheiro.ficheiro) ? ficheiro.ficheiro : Buffer.from(ficheiro.ficheiro);
    return new Response(new Uint8Array(bytes), {
      status: 200,
      headers: {
        'Content-Type': ficheiro.ficheiro_tipo,
        'Content-Disposition': `attachment; filename="${nome}"; filename*=UTF-8''${encodeURIComponent(nome)}`,
        'Cache-Control': 'private, no-store',
      },
    });
  }

  if (fechado(processo.estado) && method !== 'GET') {
    return errorResponse('Este processo já não aceita alterações à checklist.', 409);
  }

  if (method === 'POST' && !docId && !acao) {
    const body = await req.json().catch(() => null) as Record<string, unknown> | null;
    const exigidoId = texto(body?.documento_exigido_id);
    if (!exigidoId) return errorResponse('Escolha um documento do catálogo.', 400);
    const catalogo = await sql<{ id: string; obrigatorio: boolean; ordem: number; activo: boolean }[]>`
      SELECT id, obrigatorio, ordem, activo FROM documentos_exigidos WHERE id = ${exigidoId} LIMIT 1
    `;
    const doc = catalogo[0];
    if (!doc || !doc.activo) return errorResponse('Esse documento não está activo no catálogo.', 400);
    const obrigatorio = typeof body?.obrigatorio === 'boolean' ? body.obrigatorio : doc.obrigatorio;
    try {
      await sql`
        INSERT INTO admissao_documentos (processo_id, documento_exigido_id, obrigatorio, ordem)
        VALUES (${id}, ${exigidoId}, ${obrigatorio}, ${doc.ordem})
      `;
    } catch (err) {
      if ((err as { code?: string }).code === '23505') {
        return errorResponse('Esse documento já está na checklist.', 409);
      }
      throw err;
    }
    await sql`
      INSERT INTO audit_log (utilizador_id, accao, entidade, entidade_id, dados_novos)
      VALUES (${user.id}, 'admissao_documento_adicionado', 'processo_admissao', ${id}, ${JSON.stringify({ documento_exigido_id: exigidoId, obrigatorio })}::text::jsonb)
    `;
    return jsonResponse({ data: await checklistDe(processo) }, 201);
  }

  if (method === 'POST' && acao === 'enviar') {
    if (!processo.email?.includes('@')) return errorResponse('Indique o e-mail do candidato antes de enviar a checklist.', 400);
    const itens = await itensDe(id);
    if (!itens.length) return errorResponse('Adicione pelo menos um documento à checklist.', 400);
    const token = processo.documentos_token ?? randomBytes(24).toString('hex');
    if (!processo.documentos_token) {
      await sql`UPDATE processos_admissao SET documentos_token = ${token}, updated_at = NOW() WHERE id = ${id}`;
    }
    const href = `${appBaseUrl()}/candidatura/${token}`;
    const mensagem = emailChecklistDocumentos({
      nome: processo.nome,
      documentos: itens.map((item) => ({ nome: item.nome, obrigatorio: item.obrigatorio })),
      href,
      hasBanner: await mailHasBanner(),
    });
    await sendMail({
      to: processo.email,
      subject: mensagem.subject,
      html: mensagem.html,
      text: mensagem.text,
      contexto: 'admissao-checklist',
    });
    await sql`
      UPDATE processos_admissao SET documentos_enviado_em = NOW(), updated_at = NOW() WHERE id = ${id}
    `;
    if (processo.etapa_actual === 'ADM-006') {
      const etapas = await etapasDe(id);
      const anterior = runtimeDe({ ...processo, documentos_token: token }, etapas);
      const resultado = aplicarAccao(anterior, { tipo: 'avancar' });
      if (resultado.ok === false) return errorResponse(resultado.erro, 400);
      await gravarAccao(
        id,
        user.id,
        anterior,
        resultado.processo,
        etapas,
        'admissao_checklist_enviada',
        `Checklist enviada para ${processo.email}. ${resultado.resumo}`,
      );
    } else {
      await sql`
        INSERT INTO audit_log (utilizador_id, accao, entidade, entidade_id, dados_novos)
        VALUES (
          ${user.id},
          'admissao_checklist_reenviada',
          'processo_admissao',
          ${id},
          ${JSON.stringify({ resumo: `Link da checklist reenviado para ${processo.email}.` })}::text::jsonb
        )
      `;
    }
    processo.documentos_token = token;
    processo.documentos_enviado_em = new Date().toISOString();
    return jsonResponse({ data: await checklistDe(processo) });
  }

  if (!docId) return errorResponse('Método não suportado', 405);

  if (method === 'PATCH' && !acao) {
    const body = await req.json().catch(() => null) as Record<string, unknown> | null;
    if (typeof body?.obrigatorio !== 'boolean') return errorResponse('Indique se o documento é obrigatório.', 400);
    const updated = await sql`
      UPDATE admissao_documentos SET obrigatorio = ${body.obrigatorio}
      WHERE id = ${docId} AND processo_id = ${id}
      RETURNING id
    `;
    if (!updated.length) return errorResponse('Documento não encontrado nesta checklist.', 404);
    return jsonResponse({ data: await checklistDe(processo) });
  }

  if (method === 'DELETE' && !acao) {
    const comFicheiro = await sql`
      SELECT s.id FROM admissao_submissoes s
      JOIN admissao_documentos d ON d.id = s.admissao_documento_id
      WHERE d.id = ${docId} AND d.processo_id = ${id}
      LIMIT 1
    `;
    if (comFicheiro.length) return errorResponse('Este documento já tem um ficheiro e não pode sair da checklist.', 409);
    const removed = await sql`
      DELETE FROM admissao_documentos WHERE id = ${docId} AND processo_id = ${id} RETURNING id
    `;
    if (!removed.length) return errorResponse('Documento não encontrado nesta checklist.', 404);
    await sql`
      INSERT INTO audit_log (utilizador_id, accao, entidade, entidade_id, dados_novos)
      VALUES (${user.id}, 'admissao_documento_removido', 'processo_admissao', ${id}, ${JSON.stringify({ admissao_documento_id: docId })}::text::jsonb)
    `;
    return jsonResponse({ data: await checklistDe(processo) });
  }

  if (method === 'POST' && acao === 'avaliar') {
    const body = await req.json().catch(() => null) as Record<string, unknown> | null;
    const decisao = body?.accao === 'validado' || body?.accao === 'rejeitado' ? body.accao : null;
    if (!decisao) return errorResponse('Indique se o documento fica validado ou rejeitado.', 400);
    const motivo = texto(body?.motivo);
    if (decisao === 'rejeitado' && !motivo) return errorResponse('Indique o motivo da rejeição.', 400);
    const updated = await sql`
      UPDATE admissao_submissoes s SET
        estado = ${decisao},
        motivo = ${decisao === 'rejeitado' ? motivo : null},
        avaliado_em = NOW()
      FROM admissao_documentos d
      WHERE s.admissao_documento_id = d.id AND d.id = ${docId} AND d.processo_id = ${id}
      RETURNING s.id
    `;
    if (!updated.length) return errorResponse('Ainda não há ficheiro para avaliar.', 404);
    await sql`
      INSERT INTO audit_log (utilizador_id, accao, entidade, entidade_id, dados_novos)
      VALUES (
        ${user.id},
        'admissao_documento_avaliado',
        'processo_admissao',
        ${id},
        ${JSON.stringify({ admissao_documento_id: docId, estado: decisao, motivo })}::text::jsonb
      )
    `;
    return jsonResponse({ data: await checklistDe(processo) });
  }

  return errorResponse('Método não suportado', 405);
}

export default async (req: Request): Promise<Response> => {
  const cors = handleCors(req);
  if (cors) return cors;
  const parts = new URL(req.url).pathname.split('/').filter(Boolean);
  try {
    if (parts[1] === 'candidatura') return await candidatura(req, parts);
    return await admin(req);
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err);
    if (err instanceof StorageError) return errorResponse(err.message, err.status);
    console.error('[admissao-documentos]', err);
    return errorResponse(publicErrorMessage(err, 'Erro interno'));
  }
};

export const config: Config = {
  path: [
    '/api/admissao/:id/documentos',
    '/api/admissao/:id/documentos/enviar',
    '/api/admissao/:id/documentos/:docId',
    '/api/admissao/:id/documentos/:docId/ficheiro',
    '/api/admissao/:id/documentos/:docId/avaliar',
    '/api/candidatura/:token',
    '/api/candidatura/:token/envio',
    '/api/candidatura/:token/submeter',
  ],
};
