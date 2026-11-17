import { sql } from './db';
import { embedPassages, toVectorLiteral } from './embeddings';
import { isNvidiaReady } from './nvidia-client';

/** Texto a embedar para uma FAQ (pergunta + variantes + resposta). */
export function faqEmbedText(faq: {
  pergunta: string;
  resposta: string;
  variantes?: string[] | null;
  palavras_chave?: string[] | null;
}): string {
  const variantes = Array.isArray(faq.variantes) ? faq.variantes.join(' ') : '';
  const kws = Array.isArray(faq.palavras_chave) ? faq.palavras_chave.join(' ') : '';
  return [faq.pergunta, variantes, faq.resposta, kws].filter(Boolean).join('\n').slice(0, 8000);
}

/** Actualiza embedding de uma FAQ se NVIDIA estiver disponível. */
export async function embedFaqById(id: string): Promise<boolean> {
  if (!isNvidiaReady()) return false;
  const rows = await sql`
    SELECT id, pergunta, resposta, variantes, palavras_chave, estado
    FROM faqs WHERE id = ${id} LIMIT 1
  `;
  if (rows.length === 0) return false;
  const faq = rows[0] as {
    id: string;
    pergunta: string;
    resposta: string;
    variantes: string[] | null;
    palavras_chave: string[] | null;
    estado: string;
  };
  if (faq.estado !== 'publicada') {
    // limpar embedding se já não está publicada
    await sql`
      UPDATE faqs SET embedding = NULL, embedding_actualizado_em = NULL WHERE id = ${id}
    `;
    return false;
  }

  const [emb] = await embedPassages([faqEmbedText(faq)]);
  const lit = toVectorLiteral(emb);
  await sql`
    UPDATE faqs
    SET embedding = ${lit}::vector, embedding_actualizado_em = NOW()
    WHERE id = ${id}
  `;
  return true;
}

/** Reindex em batch de FAQs publicadas. */
export async function reindexPublishedFaqs(limit = 200): Promise<{ processed: number; errors: number }> {
  if (!isNvidiaReady()) {
    throw new Error('NVIDIA_API_KEY não configurada — impossível gerar embeddings');
  }

  const rows = await sql`
    SELECT id, pergunta, resposta, variantes, palavras_chave
    FROM faqs
    WHERE estado = 'publicada'
    ORDER BY data_actualizacao DESC
    LIMIT ${limit}
  `;

  let processed = 0;
  let errors = 0;
  const BATCH = 8;

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH) as {
      id: string;
      pergunta: string;
      resposta: string;
      variantes: string[] | null;
      palavras_chave: string[] | null;
    }[];
    try {
      const texts = batch.map(faqEmbedText);
      const embeddings = await embedPassages(texts);
      for (let j = 0; j < batch.length; j++) {
        const lit = toVectorLiteral(embeddings[j]);
        await sql`
          UPDATE faqs
          SET embedding = ${lit}::vector, embedding_actualizado_em = NOW()
          WHERE id = ${batch[j].id}
        `;
        processed += 1;
      }
    } catch (err) {
      console.error('[faq-embeddings] batch error', err);
      errors += batch.length;
    }
  }

  return { processed, errors };
}
