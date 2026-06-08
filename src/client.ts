import { randomUUID, webcrypto } from "node:crypto";
import {
  FluvPayConnectionError,
  FluvPayRateLimitError,
  FluvPayServerError,
  errorFromResponse,
} from "./errors.js";
import { ChargesResource } from "./resources/charges.js";
import { TransactionsResource } from "./resources/transactions.js";
import { WithdrawalsResource } from "./resources/withdrawals.js";
import { InternalTransfersResource } from "./resources/internalTransfers.js";
import { SandboxResource } from "./resources/sandbox.js";

/** Versao do pacote, embutida no User-Agent. */
export const VERSION = "1.0.0";

const DEFAULT_BASE_URL = "https://api.fluvpay.com/api/v1";

/** Funcao compativel com `fetch` global (Node 18+ ou polyfill). */
export type FetchLike = (
  input: string,
  init: RequestInit,
) => Promise<Response>;

/** Funcao de espera (injetavel para testes deterministicos). */
export type SleepFn = (ms: number) => Promise<void>;

/** Opcoes de construcao do cliente FluvPay. */
export interface FluvPayOptions {
  /** API Key. Prefixo `fluv_live_` (producao) ou `fluv_test_` (sandbox). */
  apiKey: string;
  /** Base URL da API. Padrao https://api.fluvpay.com/api/v1. */
  baseUrl?: string;
  /** Timeout por requisicao em milissegundos. Padrao 30000. */
  timeout?: number;
  /** Numero maximo de retentativas. Padrao 2. Use 0 para desligar. */
  maxRetries?: number;
  /** Implementacao de fetch. Padrao: fetch global. */
  fetch?: FetchLike;
  /** Funcao de espera, util para testes. Padrao: setTimeout. */
  sleep?: SleepFn;
}

/** Metodos HTTP suportados internamente. */
type HttpMethod = "GET" | "POST";

/** Opcoes de uma requisicao interna. */
export interface RequestOptions {
  method: HttpMethod;
  path: string;
  query?: Record<string, unknown>;
  body?: unknown;
  /** Chave de idempotencia (apenas POSTs de escrita). */
  idempotencyKey?: string;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Cliente HTTP da FluvPay.
 *
 * Cuida de autenticacao, serializacao, idempotencia, mapeamento de erros e
 * retentativas. Os recursos (`charges`, `withdrawals`, ...) delegam aqui.
 */
export class FluvPay {
  readonly charges: ChargesResource;
  readonly transactions: TransactionsResource;
  readonly withdrawals: WithdrawalsResource;
  readonly internalTransfers: InternalTransfersResource;
  readonly sandbox: SandboxResource;

  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly maxRetries: number;
  private readonly fetchFn: FetchLike;
  private readonly sleepFn: SleepFn;

  constructor(options: FluvPayOptions) {
    if (!options || !options.apiKey) {
      throw new Error("FluvPay: apiKey e obrigatorio.");
    }

    const fetchImpl = options.fetch ?? (globalThis.fetch as FetchLike | undefined);
    if (!fetchImpl) {
      throw new Error(
        "FluvPay: fetch nao esta disponivel. Use Node 18+ ou forneca a opcao `fetch`.",
      );
    }

    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.timeout = options.timeout ?? 30_000;
    this.maxRetries = options.maxRetries ?? 2;
    this.fetchFn = fetchImpl;
    this.sleepFn = options.sleep ?? defaultSleep;

    this.charges = new ChargesResource(this);
    this.transactions = new TransactionsResource(this);
    this.withdrawals = new WithdrawalsResource(this);
    this.internalTransfers = new InternalTransfersResource(this);
    this.sandbox = new SandboxResource(this);
  }

  /** Indica se a chave em uso e de sandbox (`fluv_test_`). */
  isTestKey(): boolean {
    return this.apiKey.startsWith("fluv_test_");
  }

  /** Gera uma chave de idempotencia (UUIDv4). */
  generateIdempotencyKey(): string {
    return randomUUID();
  }

  /**
   * Executa uma requisicao e devolve o corpo ja parseado.
   *
   * Aplica retentativas com backoff exponencial e jitter para falhas
   * transientes (429 e 5xx/conexao), respeitando o header Retry-After.
   * Retentativa so ocorre em GETs e em POSTs que carregam Idempotency-Key.
   */
  async request<T>(options: RequestOptions): Promise<T> {
    const url = this.buildUrl(options.path, options.query);
    const headers = this.buildHeaders(options);
    const init: RequestInit = { method: options.method, headers };

    if (options.body !== undefined && options.method !== "GET") {
      init.body = JSON.stringify(options.body);
    }

    const retryable = this.isRetryable(options);

    let attempt = 0;
    for (;;) {
      let response: Response;
      try {
        response = await this.doFetch(url, init);
      } catch (cause) {
        const connErr = new FluvPayConnectionError(
          `Falha de conexao com a FluvPay: ${describeCause(cause)}`,
          { cause },
        );
        if (retryable && attempt < this.maxRetries) {
          await this.backoff(attempt, undefined);
          attempt += 1;
          continue;
        }
        throw connErr;
      }

      if (response.ok) {
        return (await this.parseBody(response)) as T;
      }

      const status = response.status;
      const retryAfter = parseRetryAfter(response.headers.get("retry-after"));
      const body = await this.parseBody(response);
      const error = errorFromResponse(status, body, retryAfter);

      const isTransient =
        error instanceof FluvPayRateLimitError ||
        error instanceof FluvPayServerError;
      if (retryable && isTransient && attempt < this.maxRetries) {
        await this.backoff(attempt, retryAfter);
        attempt += 1;
        continue;
      }

      throw error;
    }
  }

  private isRetryable(options: RequestOptions): boolean {
    if (this.maxRetries <= 0) return false;
    if (options.method === "GET") return true;
    return options.method === "POST" && Boolean(options.idempotencyKey);
  }

  private buildUrl(path: string, query?: Record<string, unknown>): string {
    let url = `${this.baseUrl}${path}`;
    if (query) {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(query)) {
        if (value === undefined || value === null) continue;
        params.append(key, String(value));
      }
      const qs = params.toString();
      if (qs) url += `?${qs}`;
    }
    return url;
  }

  private buildHeaders(options: RequestOptions): Record<string, string> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      Accept: "application/json",
      "User-Agent": `fluvpay-node/${VERSION}`,
    };
    if (options.body !== undefined && options.method !== "GET") {
      headers["Content-Type"] = "application/json";
    }
    if (options.idempotencyKey) {
      headers["Idempotency-Key"] = options.idempotencyKey;
    }
    return headers;
  }

  private async doFetch(url: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);
    try {
      return await this.fetchFn(url, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  private async parseBody(response: Response): Promise<unknown> {
    const text = await response.text();
    if (!text) return undefined;
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  private async backoff(attempt: number, retryAfter?: number): Promise<void> {
    if (retryAfter !== undefined) {
      await this.sleepFn(retryAfter * 1000);
      return;
    }
    const base = 250 * 2 ** attempt;
    const jitter = randomFraction() * base;
    await this.sleepFn(Math.round(base + jitter));
  }
}

/** Fracao aleatoria em [0, 1) usando crypto quando disponivel. */
function randomFraction(): number {
  try {
    const buf = new Uint32Array(1);
    webcrypto.getRandomValues(buf);
    return (buf[0] ?? 0) / 0xffffffff;
  } catch {
    return Math.random();
  }
}

/** Le o header Retry-After (segundos ou data HTTP) e devolve segundos. */
function parseRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined;
  const asInt = Number(value);
  if (Number.isFinite(asInt)) return Math.max(0, asInt);
  const asDate = Date.parse(value);
  if (Number.isFinite(asDate)) {
    return Math.max(0, Math.ceil((asDate - Date.now()) / 1000));
  }
  return undefined;
}

function describeCause(cause: unknown): string {
  if (cause instanceof Error) {
    if (cause.name === "AbortError") return "tempo limite excedido";
    return cause.message;
  }
  return String(cause);
}
