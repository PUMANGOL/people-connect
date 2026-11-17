import type { FAQ } from '@/lib/types';

export interface FAQContext {
  pergunta: string;
  resposta: string;
  direccao: string;
  categoria: string;
}

export interface AIResponse {
  resposta: string;
  fonte_documento?: string;
  score_relevancia?: number;
}

export interface AIProvider {
  name: string;
  model: string;
  generateResponse(prompt: string, context: FAQContext[]): Promise<AIResponse>;
}

const SYSTEM_PROMPT = `Sou o assistente virtual da Pumangol, Direcção de Pessoas e Culturas (DPC).
Respondo em português angolano, com tom profissional mas acessível.
Apenas respondo com base no contexto oficial fornecido — nunca invento informação.
Não dou conselhos legais, financeiros, médicos ou de RH individual.
Não tenho acesso a dados pessoais como salários ou contratos.
Quando não tenho informação suficiente, digo-o e sugiro contactar a DPC em dpc@pumangol.ao.`;

class MockAIProvider implements AIProvider {
  name = 'mock';
  model = 'mock-v1';

  async generateResponse(prompt: string, context: FAQContext[]): Promise<AIResponse> {
    await new Promise((r) => setTimeout(r, 800 + Math.random() * 700));

    if (context.length === 0) {
      return {
        resposta: 'Não consegui encontrar informação sobre esse tema na nossa base de conhecimento. Sugiro que contactes directamente a equipa da DPC em dpc@pumangol.ao para obter uma resposta mais precisa.',
        score_relevancia: 0,
      };
    }

    const best = context[0];
    return {
      resposta: best.resposta,
      fonte_documento: `${best.direccao} — ${best.categoria}`,
      score_relevancia: 0.85,
    };
  }
}

class RestAIProvider implements AIProvider {
  name: string;
  model: string;
  private apiUrl: string;
  private apiKey: string;

  constructor(name: string, model: string, apiUrl: string, apiKey: string) {
    this.name = name;
    this.model = model;
    this.apiUrl = apiUrl;
    this.apiKey = apiKey;
  }

  async generateResponse(prompt: string, context: FAQContext[]): Promise<AIResponse> {
    const contextText = context.map((c) =>
      `[FAQ | Direcção: ${c.direccao} | Categoria: ${c.categoria}]\nPergunta: ${c.pergunta}\nResposta: ${c.resposta}`
    ).join('\n---\n');

    const fullPrompt = `${SYSTEM_PROMPT}\n\nContexto oficial:\n---\n${contextText}\n---\n\nPergunta do utilizador: ${prompt}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      const res = await fetch(this.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.apiKey}` },
        body: JSON.stringify({ prompt: fullPrompt, model: this.model }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const data = await res.json();
      return { resposta: data.resposta ?? data.text ?? data.content ?? 'Sem resposta.', score_relevancia: data.score };
    } catch {
      clearTimeout(timeout);
      return { resposta: 'De momento não consigo responder. Por favor contacta a DPC em dpc@pumangol.ao.', score_relevancia: 0 };
    }
  }
}

/**
 * Copilot Studio (Microsoft) — fala com um bot pré-configurado no Copilot Studio
 * via a Direct Line API (channel Web). Requer que o bot esteja publicado e o secret
 * seja convertido para token via /api/copilot-token (Netlify Function).
 *
 * Ver docs/architecture/ADR-005-assistente-virtual-microsoft.md
 */
class CopilotStudioProvider implements AIProvider {
  name = 'copilot_studio';
  model: string;
  private botEndpoint: string;
  private conversationId: string | null = null;
  private watermark: string | null = null;
  private token: string | null = null;

  constructor(botEndpoint: string, model = 'copilot-studio') {
    this.botEndpoint = botEndpoint; // ex: https://directline.botframework.com/v3/directline
    this.model = model;
  }

  private async ensureConversation(): Promise<void> {
    if (this.conversationId && this.token) return;

    // O token deve ser obtido via backend (Netlify Function) para não expor o Direct Line secret
    const tokenRes = await fetch('/api/copilot-token', { method: 'POST' });
    if (!tokenRes.ok) throw new Error('Falha ao obter Direct Line token');
    const tokenData = await tokenRes.json();
    this.token = tokenData.token;
    this.conversationId = tokenData.conversationId ?? null;

    if (!this.conversationId) {
      const convRes = await fetch(`${this.botEndpoint}/conversations`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${this.token}`, 'Content-Type': 'application/json' },
      });
      const convData = await convRes.json();
      this.conversationId = convData.conversationId;
    }
  }

  async generateResponse(prompt: string, context: FAQContext[]): Promise<AIResponse> {
    try {
      await this.ensureConversation();

      // 1. Enviar mensagem
      await fetch(`${this.botEndpoint}/conversations/${this.conversationId}/activities`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${this.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'message',
          from: { id: 'user' },
          text: prompt,
        }),
      });

      // 2. Aguardar resposta (poll simples — em produção usar WebSocket streaming)
      await new Promise((r) => setTimeout(r, 1500));

      const activitiesUrl = `${this.botEndpoint}/conversations/${this.conversationId}/activities${this.watermark ? `?watermark=${this.watermark}` : ''}`;
      const res = await fetch(activitiesUrl, {
        headers: { 'Authorization': `Bearer ${this.token}` },
      });
      const data = await res.json();
      this.watermark = data.watermark ?? this.watermark;

      const botMessages = (data.activities ?? []).filter((a: { from?: { id?: string }; text?: string }) => a.from?.id !== 'user' && a.text);
      const lastBotMsg = botMessages[botMessages.length - 1];

      if (!lastBotMsg?.text) {
        return { resposta: 'O assistente não devolveu resposta. Tenta reformular a pergunta.', score_relevancia: 0 };
      }

      return {
        resposta: lastBotMsg.text,
        fonte_documento: 'Copilot Studio · Pumangol',
        score_relevancia: 0.85,
      };
    } catch (err) {
      console.error('CopilotStudio error:', err);
      // Fallback para contexto local
      if (context.length > 0) {
        return {
          resposta: context[0].resposta,
          fonte_documento: `${context[0].direccao} — ${context[0].categoria}`,
          score_relevancia: 0.7,
        };
      }
      return {
        resposta: 'De momento não consigo aceder ao assistente Microsoft. Podes contactar a DPC em dpc@pumangol.ao.',
        score_relevancia: 0,
      };
    }
  }
}

/**
 * Azure OpenAI Service — usa GPT-4 hosted na Azure Pumangol com system prompt DPC
 * e contexto de FAQs (RAG simples via injecção no prompt).
 */
class AzureOpenAIProvider implements AIProvider {
  name = 'azure_openai';
  model: string;
  private endpoint: string;

  constructor(endpoint: string, model: string) {
    this.endpoint = endpoint;
    this.model = model;
  }

  async generateResponse(prompt: string, context: FAQContext[]): Promise<AIResponse> {
    const contextText = context.map((c) =>
      `[FAQ | Direcção: ${c.direccao} | Categoria: ${c.categoria}]\nPergunta: ${c.pergunta}\nResposta: ${c.resposta}`
    ).join('\n---\n');

    try {
      // A auth Azure OpenAI usa a key no header — o proxy (Netlify Function) deve injectar
      const res = await fetch('/api/azure-openai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: SYSTEM_PROMPT + (contextText ? '\n\nContexto oficial:\n' + contextText : '') },
            { role: 'user', content: prompt },
          ],
          temperature: 0.3,
          max_tokens: 500,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const content = data.choices?.[0]?.message?.content ?? 'Sem resposta.';
      return {
        resposta: content,
        fonte_documento: context.length > 0 ? `${context[0].direccao} — ${context[0].categoria}` : undefined,
        score_relevancia: context.length > 0 ? 0.85 : 0.6,
      };
    } catch (err) {
      console.error('AzureOpenAI error:', err);
      return { resposta: 'De momento não consigo responder. Contacta a DPC em dpc@pumangol.ao.', score_relevancia: 0 };
    }
  }
}

export function createAIProvider(): AIProvider {
  const provider = process.env.NEXT_PUBLIC_AI_PROVIDER;
  const apiKey = process.env.NEXT_PUBLIC_AI_API_KEY;
  const model = process.env.NEXT_PUBLIC_AI_MODEL;
  const apiUrl = process.env.NEXT_PUBLIC_AI_API_URL;
  const copilotBotEndpoint = process.env.NEXT_PUBLIC_COPILOT_BOT_ENDPOINT;

  if (provider === 'copilot_studio' && copilotBotEndpoint) {
    return new CopilotStudioProvider(copilotBotEndpoint, model ?? 'copilot-studio');
  }

  if (provider === 'azure_openai' && apiUrl) {
    return new AzureOpenAIProvider(apiUrl, model ?? 'gpt-4');
  }

  if (provider === 'rest' && apiUrl && apiKey) {
    return new RestAIProvider(provider, model ?? 'default', apiUrl, apiKey);
  }

  return new MockAIProvider();
}
