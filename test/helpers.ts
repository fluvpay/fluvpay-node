import type { FetchLike } from "../src/client.js";

/** Uma chamada capturada pelo mock de fetch. */
export interface CapturedCall {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

/** Resposta programada que o mock devolve. */
export interface MockResponse {
  status: number;
  body?: unknown;
  headers?: Record<string, string>;
}

/** Resultado de buildMockFetch: a funcao fetch e o registro de chamadas. */
export interface MockFetch {
  fetch: FetchLike;
  calls: CapturedCall[];
}

/**
 * Constroi um fetch mockado deterministico (sem rede). Cada item de
 * `responses` e devolvido em ordem; quando a fila acaba, repete o ultimo.
 */
export function buildMockFetch(responses: MockResponse[]): MockFetch {
  const calls: CapturedCall[] = [];
  let index = 0;

  const fetch: FetchLike = async (url, init) => {
    const headers = normalizeHeaders(init.headers);
    let parsedBody: unknown;
    if (typeof init.body === "string") {
      try {
        parsedBody = JSON.parse(init.body);
      } catch {
        parsedBody = init.body;
      }
    }
    calls.push({
      url,
      method: String(init.method ?? "GET"),
      headers,
      body: parsedBody,
    });

    const spec =
      responses[Math.min(index, responses.length - 1)] ??
      ({ status: 200, body: {} } as MockResponse);
    index += 1;

    const text = spec.body === undefined ? "" : JSON.stringify(spec.body);
    return new Response(text, {
      status: spec.status,
      headers: spec.headers,
    });
  };

  return { fetch, calls };
}

function normalizeHeaders(
  input: RequestInit["headers"],
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!input) return out;
  if (input instanceof Headers) {
    input.forEach((value, key) => {
      out[key] = value;
    });
  } else if (Array.isArray(input)) {
    for (const pair of input) {
      const key = pair[0];
      const value = pair[1];
      if (key !== undefined && value !== undefined) out[key] = value;
    }
  } else {
    Object.assign(out, input);
  }
  return out;
}

/** Espera imediata: usada para neutralizar o backoff nos testes. */
export const noSleep = async (): Promise<void> => {};
