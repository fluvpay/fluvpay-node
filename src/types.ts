/**
 * Tipos do contrato da FluvPay, derivados de openapi/openapi.yaml.
 *
 * Nada aqui pode divergir do contrato: campos, status e formatos vem
 * diretamente do OpenAPI 3.1 gerado a partir do codigo real do gateway.
 */

/** Metadados livres anexados a um recurso. */
export type Metadata = Record<string, unknown>;

/** Status possiveis de uma cobranca. Nao existe "failed". */
export type ChargeStatus =
  | "pending"
  | "paid"
  | "expired"
  | "cancelled"
  | "refunded";

/** Status possiveis de um saque. */
export type WithdrawalStatus = "pending" | "processing" | "completed" | "failed";

/** Status possiveis de uma transferencia interna. */
export type InternalTransferStatus = "completed" | "failed" | "reversed";

/** Status possiveis de um lancamento do extrato. */
export type TransactionStatus = "pending" | "completed" | "failed";

/** Tipo de um lancamento do extrato. */
export type TransactionType =
  | "charge"
  | "refund"
  | "payout"
  | "fee"
  | "adjustment"
  | "transfer_internal"
  | "crypto_payout";

/** Direcao de um lancamento do extrato. */
export type TransactionDirection = "credit" | "debit";

/** Tipo de chave PIX aceito em saques. */
export type PixKeyType = "cpf" | "cnpj" | "email" | "phone" | "evp";

/** Dados do cliente associados a uma cobranca. */
export interface ChargeCustomer {
  name?: string | null;
  email?: string | null;
  document?: string | null;
  phone?: string | null;
}

/**
 * Parametros para criar uma cobranca PIX.
 *
 * Atencao: a API rejeita campos extras com 422. Em especial, NAO existem
 * `currency` nem `method` no corpo: a moeda e o metodo (PIX) sao implicitos.
 */
export interface ChargeCreateParams {
  /** Valor em centavos. Min 100 (R$ 1,00), max 100000 (R$ 1.000,00). */
  amount_cents: number;
  /** Descricao opcional, ate 500 caracteres. */
  description?: string | null;
  /** Dados opcionais do cliente. */
  customer?: ChargeCustomer | null;
  /** Tempo de expiracao em segundos. Entre 60 e 604800. Padrao do processador se omitido. */
  expires_in_seconds?: number | null;
  /** Codigo de afiliado opcional (4 a 24 caracteres). */
  affiliate_code?: string | null;
  /** ID de uma regra de split do merchant (20 a 32 caracteres). */
  split_rule_id?: string | null;
  /** Repassar a taxa ao pagador (soma no QR/PIX). Padrao true. */
  pass_fee_to_payer?: boolean;
  /** Metadados livres. */
  metadata?: Metadata;
}

/** Cobranca completa (create/retrieve). */
export interface Charge {
  id: string;
  merchant_id: string;
  amount_cents: number;
  currency: string;
  description?: string | null;
  customer?: ChargeCustomer | null;
  status: ChargeStatus;
  payment_method: "pix";
  expires_at?: string | null;
  paid_at?: string | null;
  /** Imagem do QR Code em base64. */
  pix_qr_code?: string | null;
  /** Codigo copia-e-cola PIX. */
  pix_copy_paste?: string | null;
  fee_processor_cents: number;
  fee_platform_cents: number;
  net_amount_cents?: number | null;
  metadata: Metadata;
  created_at: string;
  updated_at: string;
}

/** Versao enxuta da cobranca usada em listagens. */
export interface ChargeListItem {
  id: string;
  amount_cents: number;
  currency: string;
  status: ChargeStatus;
  description?: string | null;
  paid_at?: string | null;
  created_at: string;
}

/** Parametros de listagem de cobrancas (paginacao page/per_page). */
export interface ChargeListParams {
  /** Filtra por status. */
  status?: ChargeStatus;
  /** Pagina (1-based). Max 10000. */
  page?: number;
  /** Itens por pagina. Max 100. */
  per_page?: number;
  /** Campo de ordenacao. Ex: "-created_at". */
  sort?: string;
}

/** Pagina de cobrancas (envelope page/per_page/has_next/has_prev). */
export interface ChargeListPage {
  data: ChargeListItem[];
  page: number;
  per_page: number;
  total: number;
  has_next: boolean;
  has_prev: boolean;
}

/** Lancamento do extrato financeiro. */
export interface Transaction {
  id: string;
  merchant_id: string;
  charge_id?: string | null;
  type: TransactionType;
  direction: TransactionDirection;
  amount_cents: number;
  fee_cents: number;
  net_amount_cents: number;
  status: TransactionStatus;
  description?: string | null;
  metadata: Metadata;
  created_at: string;
  counterparty_name?: string | null;
  counterparty_document_masked?: string | null;
  counterparty_pix_key?: string | null;
}

/** Parametros de listagem do extrato (paginacao page/per_page). */
export interface TransactionListParams {
  /** Pagina (1-based). Max 10000. */
  page?: number;
  /** Itens por pagina. Max 100. */
  per_page?: number;
  /** Campo de ordenacao. Ex: "-created_at". */
  sort?: string;
}

/** Pagina do extrato (envelope page/per_page/has_next/has_prev). */
export interface TransactionListPage {
  data: Transaction[];
  page: number;
  per_page: number;
  total: number;
  has_next: boolean;
  has_prev: boolean;
}

/** Parametros para criar um saque PIX. */
export interface WithdrawalCreateParams {
  /** Valor em centavos. Min 100 (R$ 1,00), max 10000000 (R$ 100.000,00). */
  amount_cents: number;
  /** Chave PIX de destino (1 a 140 caracteres). */
  pix_key: string;
  /** Tipo da chave PIX de destino. */
  pix_key_type: PixKeyType;
  /** Descricao opcional, ate 140 caracteres. */
  description?: string | null;
}

/** Saque PIX (create/retrieve). */
export interface Withdrawal {
  id: string;
  status: WithdrawalStatus;
  amount_cents: number;
  fee_cents: number;
  net_cents: number;
  pix_key: string;
  pix_key_type: PixKeyType;
  description?: string | null;
  created_at: string;
  completed_at?: string | null;
  failure_reason?: string | null;
  metadata: Metadata;
}

/** Parametros de listagem de saques (paginacao limit/offset). */
export interface WithdrawalListParams {
  /** Itens por pagina. Min 1, max 100. */
  limit?: number;
  /** Deslocamento. Min 0. */
  offset?: number;
  /** Filtra por status. */
  status?: WithdrawalStatus;
}

/** Pagina de saques (envelope limit/offset/total). */
export interface WithdrawalListPage {
  data: Withdrawal[];
  limit: number;
  offset: number;
  total: number;
}

/**
 * Parametros para criar uma transferencia interna FluvPay para FluvPay.
 *
 * Exige exatamente um entre `recipient_email` e `recipient_merchant_id`.
 */
export interface InternalTransferCreateParams {
  /** Valor em centavos. Min 100 (R$ 1,00), max 10000000 (R$ 100.000,00). */
  amount_cents: number;
  /** Email do destinatario. Use este OU recipient_merchant_id. */
  recipient_email?: string | null;
  /** ID ULID (26 chars) do merchant destinatario. Use este OU recipient_email. */
  recipient_merchant_id?: string | null;
  /** Descricao opcional, ate 140 caracteres. */
  description?: string | null;
}

/** Transferencia interna (create/retrieve). */
export interface InternalTransfer {
  id: string;
  from_merchant_id: string;
  to_merchant_id: string;
  to_merchant_name?: string | null;
  amount_cents: number;
  description?: string | null;
  status: InternalTransferStatus;
  created_at: string;
}

/** Direcao do filtro de transferencias internas. */
export type InternalTransferDirection = "sent" | "received";

/** Parametros de listagem de transferencias internas (paginacao limit/offset). */
export interface InternalTransferListParams {
  /** "sent" (enviadas pelo merchant) ou "received" (recebidas). Padrao "sent". */
  direction?: InternalTransferDirection;
  /** Itens por pagina. Min 1, max 100. */
  limit?: number;
  /** Deslocamento. Min 0. */
  offset?: number;
}

/** Pagina de transferencias internas (envelope limit/offset/total). */
export interface InternalTransferListPage {
  data: InternalTransfer[];
  limit: number;
  offset: number;
  total: number;
}

/** Resposta de reset do sandbox. */
export interface SandboxResetResult {
  reset: boolean;
  deleted_charges: number;
  merchant_id: string;
}

/** Resposta de cenarios (valores magicos) do sandbox. */
export interface SandboxScenariosResult {
  info: string;
  scenarios: Array<Record<string, unknown>>;
}

/** Tipos de evento de webhook emitidos pela FluvPay. */
export type WebhookEventType =
  | "charge.created"
  | "charge.paid"
  | "charge.expired"
  | "charge.cancelled"
  | "charge.refunded"
  | "payout.created"
  | "payout.completed"
  | "payout.failed";

/**
 * Evento de webhook ja verificado e parseado.
 *
 * O formato do corpo nao e fixado pelo OpenAPI publico; expomos os campos
 * comumente presentes e mantemos o objeto bruto acessivel.
 */
export interface WebhookEvent {
  /** Tipo do evento, quando presente no corpo. */
  type?: WebhookEventType | string;
  /** Identificador do evento, quando presente no corpo. */
  id?: string;
  /** Corpo completo do evento, exatamente como recebido. */
  data?: Record<string, unknown>;
  [key: string]: unknown;
}

/** Detalhe de um erro de validacao retornado pela API. */
export interface ErrorDetail {
  field?: string | null;
  message: string;
  type?: string | null;
}
