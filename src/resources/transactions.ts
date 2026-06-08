import type { FluvPay } from "../client.js";
import type {
  Transaction,
  TransactionListPage,
  TransactionListParams,
} from "../types.js";

/** Recurso do extrato financeiro consolidado. */
export class TransactionsResource {
  constructor(private readonly client: FluvPay) {}

  /**
   * Lista lancamentos do extrato. GET /transactions/
   *
   * Requer escopo `payments.read` OU `transfers.read` OU `withdrawals.read`.
   * Paginacao por page/per_page. Nao suportado em sandbox (403).
   */
  list(params: TransactionListParams = {}): Promise<TransactionListPage> {
    return this.client.request<TransactionListPage>({
      method: "GET",
      path: "/transactions/",
      query: {
        page: params.page,
        per_page: params.per_page,
        sort: params.sort,
      },
    });
  }

  /**
   * Recupera um lancamento por ID. GET /transactions/{tx_id}
   *
   * Requer escopo `payments.read` OU `transfers.read` OU `withdrawals.read`.
   */
  retrieve(txId: string): Promise<Transaction> {
    return this.client.request<Transaction>({
      method: "GET",
      path: `/transactions/${encodeURIComponent(txId)}`,
    });
  }
}
