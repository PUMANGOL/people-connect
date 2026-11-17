import type { Config } from './_shared/route-config';
import { createHash } from 'node:crypto';
import { sql, jsonResponse, errorResponse, handleCors, isDatabaseConfigured, publicErrorMessage } from './_shared/db';
import { chunkText, type Chunk } from './_shared/chunker';
import { embedPassages, toVectorLiteral } from './_shared/embeddings';
import { isNvidiaReady } from './_shared/nvidia-client';

/**
 * POST /api/kb-upload
 * Recebe multipart/form-data com:
 *   - file: PDF ou DOCX (max 10MB)
 *   - titulo, categoria, direccao, criado_por (opcional)
 *
 * Extrai texto (com página real para PDFs) → chunk → embed batch → INSERT kb_chunks
 */

const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const BATCH_SIZE = 16;

// unpdf é serverless-native (funciona em Netlify Functions, Cloudflare Workers, etc.)
// Não requer DOMMatrix nem outros browser globals.
async function extractPdfText(buffer: Buffer): Promise<{ text: string; pages: { num: number; text: string }[] }> {
  const { extractText } = await import('unpdf');
  const uint8 = new Uint8Array(buffer);
  const result = await extractText(uint8, { mergePages: false });
  // result.text é array<string> (uma entrada por página) quando mergePages=false
  const pagesArray = Array.isArray(result.text) ? result.text : [result.text];
  const pages = pagesArray
    .map((pageText, idx) => ({ num: idx + 1, text: pageText ?? '' }))
    .filter((p) => p.text.trim().length > 0);
  const fullText = pages.map((p) => p.text).join('\n\n');
  return { text: fullText, pages };
}

async function extractDocxText(buffer: Buffer): Promise<string> {
  const mammoth = await import('mammoth');
  const extractRawText = (mammoth as { extractRawText?: typeof import('mammoth').extractRawText }).extractRawText
    ?? (mammoth as { default: typeof import('mammoth') }).default.extractRawText;
  const result = await extractRawText({ buffer });
  return result.value;
}

export default async (req: Request): Promise<Response> => {
  const cors = handleCors(req);
  if (cors) return cors;
  if (req.method !== 'POST') return errorResponse('Método não suportado', 405);

  if (!isNvidiaReady()) {
    return errorResponse('NVIDIA_API_KEY não configurada no ambiente', 503);
  }
  if (!isDatabaseConfigured()) {
    return errorResponse('DATABASE_URL não configurada no ambiente', 503);
  }

  let documentoId: string | null = null;

  try {
    const formData = await req.formData();
    const file = formData.get('file');
    const titulo = formData.get('titulo');
    const categoria = (formData.get('categoria') ?? 'processos') as string;
    const direccao = formData.get('direccao') as string;
    const criadoPor = formData.get('criado_por') as string | null;

    if (!(file instanceof File)) return errorResponse('Ficheiro obrigatório', 400);
    if (typeof titulo !== 'string' || !titulo.trim()) return errorResponse('Título obrigatório', 400);
    if (!direccao) return errorResponse('Direcção obrigatória', 400);
    if (file.size > MAX_SIZE) return errorResponse(`Ficheiro excede ${MAX_SIZE / 1024 / 1024}MB`, 400);

    const nameLower = file.name.toLowerCase();
    const tipoFicheiro = nameLower.endsWith('.pdf') ? 'pdf' : nameLower.endsWith('.docx') ? 'docx' : null;
    if (!tipoFicheiro) return errorResponse('Apenas PDF ou DOCX suportados', 400);

    const buffer = Buffer.from(await file.arrayBuffer());
    const hash = createHash('sha256').update(buffer).digest('hex');

    // Dedup — se já existe indexado com o mesmo hash, devolver o existente
    const existing = await sql`
      SELECT id, titulo, chunks_total, estado FROM kb_documentos
      WHERE ficheiro_hash = ${hash} AND estado = 'indexado'
      LIMIT 1
    `;
    if (existing.length > 0) {
      return jsonResponse({
        data: existing[0],
        message: 'Documento já indexado (conteúdo idêntico)',
        deduplicated: true,
      });
    }

    // Criar registo com estado=processando
    const inserted = await sql`
      INSERT INTO kb_documentos (
        titulo, categoria, direccao, tipo_ficheiro,
        tamanho_bytes, ficheiro_hash, criado_por, estado, embedding_model
      )
      VALUES (
        ${titulo.trim()}, ${categoria}::categoria_faq, ${direccao}, ${tipoFicheiro},
        ${buffer.length}, ${hash}, ${criadoPor || null}, 'processando', 'baai/bge-m3'
      )
      RETURNING id
    `;
    documentoId = inserted[0].id as string;

    // Extrair texto — para PDFs, chunking por página (citações com página real)
    let chunks: Chunk[] = [];
    let fullTextForSource = '';
    if (tipoFicheiro === 'pdf') {
      const { text, pages } = await extractPdfText(buffer);
      fullTextForSource = text;
      if (pages.length > 0) {
        for (const page of pages) {
          const pageChunks = chunkText(page.text, { pagina: page.num });
          for (const c of pageChunks) {
            chunks.push({ ...c, ordem: chunks.length });
          }
        }
      }
      if (chunks.length === 0) {
        chunks = chunkText(text);
      }
    } else {
      const text = await extractDocxText(buffer);
      fullTextForSource = text;
      chunks = chunkText(text);
    }

    if (chunks.length === 0) {
      throw new Error('Não foi possível extrair texto útil do documento (vazio ou digitalizado sem OCR)');
    }

    // Guardar texto fonte (para reindex completo sem re-upload do ficheiro)
    // Coluna texto_fonte existe a partir da migração 008 — falha silenciosa se ainda não existir
    if (fullTextForSource.trim()) {
      try {
        await sql`
          UPDATE kb_documentos
          SET texto_fonte = ${fullTextForSource.slice(0, 500_000)}
          WHERE id = ${documentoId}
        `;
      } catch (e) {
        console.warn('[kb-upload] texto_fonte não gravado (corre migração 008?):', e);
      }
    }

    // Embed em batch + inserir
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      const embeddings = await embedPassages(batch.map((c) => c.conteudo));

      for (let j = 0; j < batch.length; j++) {
        const c = batch[j];
        const embLiteral = toVectorLiteral(embeddings[j]);
        await sql`
          INSERT INTO kb_chunks (documento_id, ordem, conteudo, tokens, embedding, metadata)
          VALUES (${documentoId}, ${c.ordem}, ${c.conteudo}, ${c.tokens}, ${embLiteral}::vector, ${JSON.stringify(c.metadata)}::text::jsonb)
        `;
      }
    }

    await sql`
      UPDATE kb_documentos
      SET estado = 'indexado', chunks_total = ${chunks.length}, updated_at = NOW()
      WHERE id = ${documentoId}
    `;

    return jsonResponse({
      data: {
        id: documentoId,
        titulo,
        chunks: chunks.length,
        estado: 'indexado',
      },
    }, 201);
  } catch (err) {
    const msg = publicErrorMessage(err, 'Erro no processamento');
    console.error('[kb-upload]', msg, err);

    if (documentoId) {
      try {
        await sql`
          UPDATE kb_documentos SET estado = 'falha', erro_processamento = ${msg}
          WHERE id = ${documentoId}
        `;
      } catch (dbErr) {
        console.error('[kb-upload] falha ao marcar erro:', dbErr);
      }
    }

    return errorResponse(msg, 500);
  }
};

export const config: Config = {
  path: '/api/kb-upload',
};
