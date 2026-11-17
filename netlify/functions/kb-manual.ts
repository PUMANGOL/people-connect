import type { Config } from './_shared/route-config';
import { sql, jsonResponse, errorResponse, handleCors, isDatabaseConfigured, publicErrorMessage } from './_shared/db';
import { requireAuth, authErrorResponse, AuthError } from './_shared/auth';
import { chunkText } from './_shared/chunker';
import { embedPassages, toVectorLiteral } from './_shared/embeddings';
import { isNvidiaReady } from './_shared/nvidia-client';

/**
 * POST /api/kb-manual
 * Indexa texto colado (política, FAQ longa, procedimento) sem ficheiro.
 */

const BATCH_SIZE = 16;
const MAX_CHARS = 200_000;

export default async (req: Request): Promise<Response> => {
  const cors = handleCors(req);
  if (cors) return cors;
  if (req.method !== 'POST') return errorResponse('Método não suportado', 405);

  try {
    const user = await requireAuth(req);
    if (user.role !== 'rh_admin') return errorResponse('Sem permissão', 403);

    if (!isNvidiaReady()) {
      return errorResponse('NVIDIA_API_KEY não configurada — necessário para embeddings', 503);
    }
    if (!isDatabaseConfigured()) {
      return errorResponse('DATABASE_URL não configurada', 503);
    }

    const body = await req.json();
    const titulo = String(body.titulo ?? '').trim();
    const texto = String(body.texto ?? '').trim();
    const categoria = String(body.categoria ?? 'processos');
    const direccao = String(body.direccao ?? 'DPC');
    const descricao = body.descricao ? String(body.descricao).trim() : null;

    if (!titulo) return errorResponse('Título obrigatório', 400);
    if (!texto || texto.length < 40) {
      return errorResponse('Texto demasiado curto (mín. 40 caracteres)', 400);
    }
    if (texto.length > MAX_CHARS) {
      return errorResponse(`Texto excede ${MAX_CHARS} caracteres`, 400);
    }

    const inserted = await sql`
      INSERT INTO kb_documentos (
        titulo, descricao, categoria, direccao, tipo_ficheiro,
        tamanho_bytes, criado_por, estado, embedding_model, texto_fonte
      )
      VALUES (
        ${titulo},
        ${descricao},
        ${categoria}::categoria_faq,
        ${direccao},
        'manual',
        ${Buffer.byteLength(texto, 'utf8')},
        ${user.id},
        'processando',
        'baai/bge-m3',
        ${texto}
      )
      RETURNING id
    `;
    const documentoId = inserted[0].id as string;

    try {
      const chunks = chunkText(texto);
      if (chunks.length === 0) throw new Error('Não foi possível segmentar o texto');

      for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
        const batch = chunks.slice(i, i + BATCH_SIZE);
        const embeddings = await embedPassages(batch.map((c) => c.conteudo));
        for (let j = 0; j < batch.length; j++) {
          const c = batch[j];
          const embLiteral = toVectorLiteral(embeddings[j]);
          await sql`
            INSERT INTO kb_chunks (documento_id, ordem, conteudo, tokens, embedding, metadata)
            VALUES (
              ${documentoId}, ${c.ordem}, ${c.conteudo}, ${c.tokens},
              ${embLiteral}::vector, ${JSON.stringify(c.metadata ?? {})}::text::jsonb
            )
          `;
        }
      }

      await sql`
        UPDATE kb_documentos
        SET estado = 'indexado', chunks_total = ${chunks.length}, updated_at = NOW()
        WHERE id = ${documentoId}
      `;

      return jsonResponse(
        {
          data: {
            id: documentoId,
            titulo,
            chunks: chunks.length,
            estado: 'indexado',
          },
        },
        201
      );
    } catch (procErr) {
      const msg = publicErrorMessage(procErr, 'Erro no processamento');
      await sql`
        UPDATE kb_documentos SET estado = 'falha', erro_processamento = ${msg}
        WHERE id = ${documentoId}
      `;
      return errorResponse(msg, 500);
    }
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err);
    console.error('[kb-manual]', err);
    return errorResponse(publicErrorMessage(err, 'Erro interno'));
  }
};

export const config: Config = {
  path: '/api/kb-manual',
};
