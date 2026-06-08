import type { FluvPay } from "../client.js";
import type {
  InternalTransfer,
  InternalTransferCreateParams,
  InternalTransferListPage,
  InternalTransferListParams,
} from "../types.js";
import type { RequestPerCallOptions } from "./charges.js";

/** Recurso de transferencias internas FluvPay para FluvPay. */
export class InternalTransfersResource {
  constructor(private readonly client: FluvPay) {}

  /**
   * Cria uma transferencia interna. POST /internal-transfers/
   *
   * Requer escopo `withdrawals.create`. Exige exatamente um entre
   * recipient_email e recipient_merchant_id. Nao suportado em sandbox:
   * chaves `fluv_test_` recebem 403 SANDBOX_NOT_SUPPORTED_FOR_TRANSFERS.
   * O header Idempotency-Key e enviado sempre (UUIDv4 gerado se omitido).
   */
  create(
    params: InternalTransferCreateParams,
    options: RequestPerCallOptions = {},
  ): Promise<InternalTransfer> {
    const idempotencyKey =
      options.idempotencyKey ?? this.client.generateIdempotencyKey();
    return this.client.request<InternalTransfer>({
      method: "POST",
      path: "/internal-transfers/",
      body: params,
      idempotencyKey,
    });
  }

  /**
   * Lista transferencias internas. GET /internal-transfers/
   *
   * Requer escopo `transfers.read`. Paginacao por limit/offset.
   */
  list(
    params: InternalTransferListParams = {},
  ): Promise<InternalTransferListPage> {
    return this.client.request<InternalTransferListPage>({
      method: "GET",
      path: "/internal-transfers/",
      query: {
        direction: params.direction,
        limit: params.limit,
        offset: params.offset,
      },
    });
  }

  /**
   * Recupera uma transferencia interna por ID. GET /internal-transfers/{transfer_id}
   *
   * Requer escopo `transfers.read`.
   */
  retrieve(transferId: string): Promise<InternalTransfer> {
    return this.client.request<InternalTransfer>({
      method: "GET",
      path: `/internal-transfers/${encodeURIComponent(transferId)}`,
    });
  }
}
