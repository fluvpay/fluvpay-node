import type { FluvPay } from "../client.js";
import type {
  Withdrawal,
  WithdrawalCreateParams,
  WithdrawalListPage,
  WithdrawalListParams,
} from "../types.js";
import type { RequestPerCallOptions } from "./charges.js";

/** Recurso de saques PIX. */
export class WithdrawalsResource {
  constructor(private readonly client: FluvPay) {}

  /**
   * Cria um saque PIX. POST /withdrawals/
   *
   * Requer escopo `withdrawals.create`. Nao suportado em sandbox: chaves
   * `fluv_test_` recebem 403 SANDBOX_NOT_SUPPORTED_FOR_WITHDRAWALS.
   * O header Idempotency-Key e enviado sempre (UUIDv4 gerado se omitido).
   */
  create(
    params: WithdrawalCreateParams,
    options: RequestPerCallOptions = {},
  ): Promise<Withdrawal> {
    const idempotencyKey =
      options.idempotencyKey ?? this.client.generateIdempotencyKey();
    return this.client.request<Withdrawal>({
      method: "POST",
      path: "/withdrawals/",
      body: params,
      idempotencyKey,
    });
  }

  /**
   * Lista saques. GET /withdrawals/
   *
   * Requer escopo `withdrawals.read`. Paginacao por limit/offset.
   */
  list(params: WithdrawalListParams = {}): Promise<WithdrawalListPage> {
    return this.client.request<WithdrawalListPage>({
      method: "GET",
      path: "/withdrawals/",
      query: {
        limit: params.limit,
        offset: params.offset,
        status: params.status,
      },
    });
  }

  /**
   * Recupera um saque por ID. GET /withdrawals/{withdrawal_id}
   *
   * Requer escopo `withdrawals.read`.
   */
  retrieve(withdrawalId: string): Promise<Withdrawal> {
    return this.client.request<Withdrawal>({
      method: "GET",
      path: `/withdrawals/${encodeURIComponent(withdrawalId)}`,
    });
  }
}
