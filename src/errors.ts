import type { ErrorDetail } from "./types.js";

/**
 * Opcoes comuns a todas as excecoes da FluvPay, extraidas do envelope de erro
 * `{ error: { code, message, details, trace_id } }`.
 */
export interface FluvPayErrorOptions {
  /** Codigo canonico do erro (ex: VALIDATION_ERROR, NOT_FOUND). */
  code?: string;
  /** Lista de detalhes de validacao, quando houver. */
  details?: ErrorDetail[];
  /** ID de correlacao da requisicao nos logs do servidor. */
  traceId?: string;
  /** Status HTTP da resposta. Ausente em erros de conexao. */
  statusCode?: number;
  /** Erro original que causou esta excecao (ex: falha de rede). */
  cause?: unknown;
}

/** Excecao base de todas as falhas levantadas pelo SDK. */
export class FluvPayError extends Error {
  /** Codigo canonico do erro retornado pela API. */
  readonly code?: string;
  /** Detalhes de validacao, quando a API os fornece. */
  readonly details?: ErrorDetail[];
  /** ID de correlacao para suporte. */
  readonly traceId?: string;
  /** Status HTTP, quando a falha veio de uma resposta. */
  readonly statusCode?: number;

  constructor(message: string, options: FluvPayErrorOptions = {}) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = new.target.name;
    this.code = options.code;
    this.details = options.details;
    this.traceId = options.traceId;
    this.statusCode = options.statusCode;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** 400/422: dados invalidos ou estado impeditivo (ex: INSUFFICIENT_BALANCE). */
export class FluvPayValidationError extends FluvPayError {}

/** 401: autenticacao obrigatoria ou chave invalida. */
export class FluvPayAuthenticationError extends FluvPayError {}

/** 403: escopo insuficiente ou operacao nao permitida (inclui sandbox). */
export class FluvPayPermissionError extends FluvPayError {}

/** 404: recurso nao encontrado. */
export class FluvPayNotFoundError extends FluvPayError {}

/** 409: conflito (inclui IDEMPOTENCY_CONFLICT). */
export class FluvPayConflictError extends FluvPayError {}

/** 429: limite de requisicoes excedido. */
export class FluvPayRateLimitError extends FluvPayError {
  /** Segundos a aguardar antes de tentar de novo, do header Retry-After. */
  readonly retryAfter?: number;

  constructor(
    message: string,
    options: FluvPayErrorOptions & { retryAfter?: number } = {},
  ) {
    super(message, options);
    this.retryAfter = options.retryAfter;
  }
}

/** 5xx: erro interno do servidor. */
export class FluvPayServerError extends FluvPayError {}

/** Falha de rede, timeout ou interrupcao antes de obter uma resposta. */
export class FluvPayConnectionError extends FluvPayError {}

/** Falha na verificacao de assinatura de webhook. */
export class FluvPaySignatureVerificationError extends FluvPayError {}

/** Forma do envelope de erro retornado pela API. */
interface ErrorEnvelope {
  error?: {
    code?: string;
    message?: string;
    details?: ErrorDetail[] | null;
    trace_id?: string | null;
  };
}

/**
 * Mapeia um status HTTP e o corpo do erro para a excecao tipada correta.
 *
 * Le o envelope `{ error: { code, message, details, trace_id } }` quando
 * presente; caso contrario usa um fallback legivel pelo status.
 */
export function errorFromResponse(
  statusCode: number,
  body: unknown,
  retryAfter?: number,
): FluvPayError {
  const envelope = (body ?? {}) as ErrorEnvelope;
  const err = envelope.error ?? {};
  const code = err.code;
  const message =
    err.message ?? `Requisicao falhou com status HTTP ${statusCode}`;
  const details = err.details ?? undefined;
  const traceId = err.trace_id ?? undefined;

  const base: FluvPayErrorOptions = {
    code,
    details: details ?? undefined,
    traceId,
    statusCode,
  };

  if (statusCode === 400 || statusCode === 422) {
    return new FluvPayValidationError(message, base);
  }
  if (statusCode === 401) {
    return new FluvPayAuthenticationError(message, base);
  }
  if (statusCode === 403) {
    return new FluvPayPermissionError(message, base);
  }
  if (statusCode === 404) {
    return new FluvPayNotFoundError(message, base);
  }
  if (statusCode === 409) {
    return new FluvPayConflictError(message, base);
  }
  if (statusCode === 429) {
    return new FluvPayRateLimitError(message, { ...base, retryAfter });
  }
  if (statusCode >= 500) {
    return new FluvPayServerError(message, base);
  }
  return new FluvPayError(message, base);
}
