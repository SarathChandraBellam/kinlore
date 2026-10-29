import { afterEach, describe, expect, it, vi } from 'vitest';
import { OpenRouterClient } from './openrouter.js';

afterEach(() => vi.restoreAllMocks());

const request = {
  model: 'test/model',
  apiKey: 'synthetic-key',
  messages: [{ role: 'user' as const, content: 'A synthetic question' }],
};

function completion(value: unknown): Response {
  return new Response(
    JSON.stringify({ choices: [{ message: { content: JSON.stringify(value) } }] }),
  );
}

describe('OpenRouterClient', () => {
  // TC23 / AC9
  it('uses the fixed endpoint, chosen model, bounded output and a non-redirecting request', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(completion({ questions: ['What next?'] }));
    await expect(new OpenRouterClient(fetcher).complete(request)).resolves.toEqual({
      questions: ['What next?'],
    });
    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher).toHaveBeenCalledWith(
      'https://openrouter.ai/api/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        redirect: 'error',
        signal: expect.any(AbortSignal),
        headers: { Authorization: 'Bearer synthetic-key', 'Content-Type': 'application/json' },
      }),
    );
    const body = JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body)) as Record<string, unknown>;
    expect(body).toMatchObject({
      model: 'test/model',
      max_tokens: 2048,
      messages: request.messages,
    });
    expect(body).not.toHaveProperty('tools');
  });

  // TC22 / AC9
  it.each([401, 402, 429, 500])(
    'returns a safe HTTP %i error without echoing provider contents',
    async (status) => {
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response('synthetic-key private family text', { status }));
      await expect(new OpenRouterClient(fetcher).complete(request)).rejects.toThrow(/OpenRouter/);
      await expect(new OpenRouterClient(fetcher).complete(request)).rejects.not.toThrow(
        /synthetic-key|private family text/,
      );
    },
  );

  it('does not leak transport errors or retry', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new Error('synthetic-key private family text'));
    await expect(new OpenRouterClient(fetcher).complete(request)).rejects.toThrow(
      'OpenRouter could not be reached. Check your connection and try again.',
    );
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('aborts a timed-out request with a safe error', async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('private')), {
            once: true,
          });
        }),
    );
    await expect(new OpenRouterClient(fetcher, 5).complete(request)).rejects.toThrow(/timed out/);
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it.each([
    'invalid json',
    JSON.stringify({ choices: [] }),
    JSON.stringify({ choices: [{ message: { content: 'not JSON' } }] }),
    JSON.stringify({ choices: [{ message: { content: '' } }] }),
    'x'.repeat(131073),
  ])('rejects malformed or oversized responses', async (raw) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(raw));
    await expect(new OpenRouterClient(fetcher).complete(request)).rejects.toThrow(/OpenRouter/);
  });

  it('bounds requests before sending', async () => {
    const fetcher = vi.fn<typeof fetch>();
    await expect(
      new OpenRouterClient(fetcher).complete({
        ...request,
        messages: [{ role: 'user', content: 'x'.repeat(64001) }],
      }),
    ).rejects.toThrow(/too large/);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
