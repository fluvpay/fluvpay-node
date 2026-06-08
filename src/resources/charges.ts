import type { FluvPay } from "../client.js";
import type {
  Charge,
  ChargeCreateParams,
  ChargeListPage,
  ChargeListParams,
} from "../types.js";

/** Opcoes por chamada para operacoes de escrita. */
export interface RequestPerCallOptions {
  /** Chave de idempotencia. Se omitida, o SDK gera um UUIDv4. */
  idempotencyKey?: string;
}

/** Recurso de cobrancas PIX. */
export class ChargesResource {
  constructor(private readonly client: FluvPay) {}

  /**
   * Cria uma cobranca PIX. POST /charges/
   *
   * Requer escopo `payments.create`. O header Idempotency-Key e enviado
   * sempre: se nao for informado, o SDK gera um UUIDv4 automaticamente.
   */
  create(
    params: ChargeCreateParams,
    options: RequestPerCallOptions = {},
  ): Promise<Charge> {
    const idempotencyKey =
      options.idempotencyKey ?? this.client.generateIdempotencyKey();
    return this.client.request<Charge>({
      method: "POST",
      path: "/charges/",
      body: params,
      idempotencyKey,
    });
  }

  /**
   * Recupera uma cobranca por ID. GET /charges/{charge_id}
   *
   * Requer escopo `payments.read`.
   */
  retrieve(chargeId: string): Promise<Charge> {
    return this.client.request<Charge>({
      method: "GET",
      path: `/charges/${encodeURIComponent(chargeId)}`,
    });
  }

  /**
   * Lista cobrancas. GET /charges/
   *
   * Requer escopo `payments.read`. Paginacao por page/per_page.
   */
  list(params: ChargeListParams = {}): Promise<ChargeListPage> {
    return this.client.request<ChargeListPage>({
      method: "GET",
      path: "/charges/",
      query: {
        status: params.status,
        page: params.page,
        per_page: params.per_page,
        sort: params.sort,
      },
    });
  }
}
