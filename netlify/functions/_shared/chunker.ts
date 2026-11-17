import { NVIDIA_CONFIG } from './nvidia-client';

/**
 * Divide texto em chunks de ~500 tokens com overlap de 50 tokens.
 * Aproximação: 1 token ≈ 4 caracteres (heurística para PT).
 *
 * Estratégia: corta em fronteiras semânticas (parágrafo → frase → palavra)
 * para preservar contexto.
 */

const AVG_CHARS_PER_TOKEN = 4;

export interface Chunk {
  ordem: number;
  conteudo: string;
  tokens: number;
  metadata: { pagina?: number; secao?: string };
}

export function chunkText(text: string, opts?: { pagina?: number }): Chunk[] {
  const chunkSize = NVIDIA_CONFIG.chunkSize * AVG_CHARS_PER_TOKEN;
  const overlap = NVIDIA_CONFIG.chunkOverlap * AVG_CHARS_PER_TOKEN;
  const chunks: Chunk[] = [];

  const normalized = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (normalized.length < 50) return [];

  let start = 0;
  let ordem = 0;

  while (start < normalized.length) {
    let end = Math.min(start + chunkSize, normalized.length);

    // Ajustar para fronteira semântica se não estamos no fim
    if (end < normalized.length) {
      // Preferir corte em fim de parágrafo, depois frase, depois espaço
      const searchArea = normalized.substring(start, end);
      const lastParagraph = searchArea.lastIndexOf('\n\n');
      const lastSentence = Math.max(
        searchArea.lastIndexOf('. '),
        searchArea.lastIndexOf('? '),
        searchArea.lastIndexOf('! '),
      );
      const lastSpace = searchArea.lastIndexOf(' ');

      let cutOffset = -1;
      if (lastParagraph > chunkSize * 0.5) cutOffset = lastParagraph + 2;
      else if (lastSentence > chunkSize * 0.5) cutOffset = lastSentence + 2;
      else if (lastSpace > chunkSize * 0.5) cutOffset = lastSpace + 1;

      if (cutOffset > 0) end = start + cutOffset;
    }

    const conteudo = normalized.substring(start, end).trim();

    if (conteudo.length >= 50) {
      chunks.push({
        ordem: ordem++,
        conteudo,
        tokens: Math.ceil(conteudo.length / AVG_CHARS_PER_TOKEN),
        metadata: { pagina: opts?.pagina },
      });
    }

    if (end >= normalized.length) break;
    start = Math.max(end - overlap, start + 1);
  }

  return chunks;
}
