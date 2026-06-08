import { FluvPay as FluvPayClient } from "./client.js";
import { webhooks } from "./webhooks.js";

/**
 * Cliente oficial da FluvPay.
 *
 * Expoe os recursos `charges`, `transactions`, `withdrawals`,
 * `internalTransfers` e `sandbox`, alem do helper estatico
 * `FluvPay.webhooks.verifySignature`.
 *
 * @example
 * import { FluvPay } from "fluvpay";
 * const fluvpay = new FluvPay({ apiKey: process.env.FLUVPAY_API_KEY! });
 * const charge = await fluvpay.charges.create({ amount_cents: 2500 });
 */
export class FluvPay extends FluvPayClient {
  /** Helpers de webhook (verificacao de assinatura). */
  static readonly webhooks = webhooks;
}

export { VERSION } from "./client.js";
export type {
  FluvPayOptions,
  FetchLike,
  SleepFn,
  RequestOptions,
} from "./client.js";

export { webhooks, verifySignature } from "./webhooks.js";
export type { VerifySignatureParams } from "./webhooks.js";

export type { RequestPerCallOptions } from "./resources/charges.js";
export { ChargesResource } from "./resources/charges.js";
export { TransactionsResource } from "./resources/transactions.js";
export { WithdrawalsResource } from "./resources/withdrawals.js";
export { InternalTransfersResource } from "./resources/internalTransfers.js";
export { SandboxResource } from "./resources/sandbox.js";

export {
  FluvPayError,
  FluvPayValidationError,
  FluvPayAuthenticationError,
  FluvPayPermissionError,
  FluvPayNotFoundError,
  FluvPayConflictError,
  FluvPayRateLimitError,
  FluvPayServerError,
  FluvPayConnectionError,
  FluvPaySignatureVerificationError,
  errorFromResponse,
} from "./errors.js";
export type { FluvPayErrorOptions } from "./errors.js";

export type {
  Metadata,
  ChargeStatus,
  WithdrawalStatus,
  InternalTransferStatus,
  TransactionStatus,
  TransactionType,
  TransactionDirection,
  PixKeyType,
  ChargeCustomer,
  ChargeCreateParams,
  Charge,
  ChargeListItem,
  ChargeListParams,
  ChargeListPage,
  Transaction,
  TransactionListParams,
  TransactionListPage,
  WithdrawalCreateParams,
  Withdrawal,
  WithdrawalListParams,
  WithdrawalListPage,
  InternalTransferCreateParams,
  InternalTransfer,
  InternalTransferDirection,
  InternalTransferListParams,
  InternalTransferListPage,
  SandboxResetResult,
  SandboxScenariosResult,
  WebhookEventType,
  WebhookEvent,
  ErrorDetail,
} from "./types.js";

export default FluvPay;
