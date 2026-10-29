export interface LlmMessage {
  role: 'system' | 'user';
  content: string;
}

export interface OpenRouterRequest {
  model: string;
  apiKey: string;
  messages: readonly LlmMessage[];
}

class ProviderError extends Error {}

function object(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ProviderError('OpenRouter returned an invalid response. Try another model.');
  }
  return value as Record<string, unknown>;
}

async function boundedBody(response: Response): Promise<string> {
  if (Number(response.headers.get('content-length')) > 131072 || response.body === null) {
    throw new ProviderError('OpenRouter returned an empty or oversized response.');
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > 131072) {
        await reader.cancel();
        throw new ProviderError('OpenRouter returned an oversized response.');
      }
      chunks.push(part.value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks).toString('utf8');
}

/** Bounded text-only completions. Callers own consent and per-request approval. */
export class OpenRouterClient {
  constructor(
    private readonly fetcher: typeof fetch = globalThis.fetch,
    private readonly timeoutMs = 30000,
  ) {}

  async complete(request: OpenRouterRequest): Promise<unknown> {
    if (!/^[A-Za-z0-9][A-Za-z0-9_./:@~+-]{0,199}$/.test(request.model)) {
      throw new ProviderError('Choose a valid OpenRouter model identifier.');
    }
    if (!/^[\x21-\x7e]{1,4096}$/.test(request.apiKey)) {
      throw new ProviderError('Save a valid OpenRouter API key first.');
    }
    const body = JSON.stringify({
      model: request.model,
      messages: request.messages,
      max_tokens: 2048,
      stream: false,
    });
    if (Buffer.byteLength(body, 'utf8') > 64000) {
      throw new ProviderError('The selected text is too large. Choose fewer recordings.');
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetcher('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        redirect: 'error',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${request.apiKey}`,
          'Content-Type': 'application/json',
        },
        body,
      });
      if (!response.ok) {
        const reason =
          response.status === 401 || response.status === 403
            ? 'Check your API key and model access.'
            : response.status === 402
              ? 'Check your OpenRouter credits.'
              : response.status === 429
                ? 'The request was rate limited. Try again later.'
                : 'The provider could not complete this request. Try again later.';
        throw new ProviderError(
          `OpenRouter request failed (${String(response.status)}). ${reason}`,
        );
      }
      let envelope: Record<string, unknown>;
      try {
        envelope = object(JSON.parse(await boundedBody(response)) as unknown);
      } catch (error) {
        if (error instanceof ProviderError) throw error;
        throw new ProviderError('OpenRouter returned invalid JSON. Try another model.');
      }
      if (!Array.isArray(envelope.choices) || envelope.choices.length === 0) {
        throw new ProviderError('OpenRouter returned no completion. Try another model.');
      }
      const choice = object(envelope.choices[0]);
      const message = object(choice.message);
      if (typeof message.content !== 'string' || message.content.trim() === '') {
        throw new ProviderError('OpenRouter returned no text. Try another model.');
      }
      try {
        return JSON.parse(message.content) as unknown;
      } catch {
        throw new ProviderError(
          'OpenRouter returned an invalid draft. Choose a model that follows JSON instructions.',
        );
      }
    } catch (error) {
      if (controller.signal.aborted) {
        throw new ProviderError('OpenRouter timed out. Nothing was saved. Try again later.');
      }
      if (error instanceof ProviderError) throw error;
      throw new ProviderError(
        'OpenRouter could not be reached. Check your connection and try again.',
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}
