import { createHmac, timingSafeEqual } from "node:crypto";
import { FluvPaySignatureVerificationError } from "./errors.js";
import type { WebhookEvent } from "./types.js";

/** Parametros para verificar a assinatura de um webhook. */
export interface VerifySignatureParams {
  /**
   * Corpo CRU da requisicao, exatamente como recebido (string ou Buffer).
   * Nao re-serialize o JSON: a assinatura e calculada sobre os bytes crus.
   */
  payload: string | Buffer | Uint8Array;
  /** Valor do header `X-FluvPay-Signature` (formato `v1=<hex>`). */
  signatureHeader: string;
  /** Valor do header `X-FluvPay-Timestamp`. */
  timestamp: string;
  /** O segredo do webhook (`whsec_...`) exibido na criacao. */
  secret: string;
  /**
   * Tolerancia, em segundos, entre o timestamp e o momento atual.
   * Se informado e o timestamp for numerico, rejeita eventos velhos demais.
   */
  toleranceSeconds?: number;
}

/**
 * Verifica a assinatura de um webhook da FluvPay.
 *
 * Algoritmo (exato): `HMAC_SHA256(secret, timestamp + "." + payload)`, em
 * hex. O header tem o formato `v1=<hex>`. A comparacao e feita em tempo
 * constante. Use o corpo cru da requisicao, NUNCA re-serializado.
 *
 * Retorna o evento parseado ou lanca FluvPaySignatureVerificationError.
 */
export function verifySignature(params: VerifySignatureParams): WebhookEvent {
  const { signatureHeader, timestamp, secret, toleranceSeconds } = params;

  if (!signatureHeader) {
    throw new FluvPaySignatureVerificationError(
      "Assinatura de webhook ausente.",
    );
  }
  if (!timestamp) {
    throw new FluvPaySignatureVerificationError(
      "Timestamp de webhook ausente.",
    );
  }
  if (!secret) {
    throw new FluvPaySignatureVerificationError(
      "Segredo do webhook ausente.",
    );
  }

  const provided = extractV1(signatureHeader);
  if (!provided) {
    throw new FluvPaySignatureVerificationError(
      "Formato de assinatura invalido: esperado 'v1=<hex>'.",
    );
  }

  const rawBody = toBuffer(params.payload);
  const signedPayload = Buffer.concat([
    Buffer.from(`${timestamp}.`, "utf8"),
    rawBody,
  ]);
  const expected = createHmac("sha256", secret)
    .update(signedPayload)
    .digest("hex");

  if (!constantTimeEqualHex(provided, expected)) {
    throw new FluvPaySignatureVerificationError(
      "Assinatura de webhook invalida.",
    );
  }

  if (toleranceSeconds !== undefined) {
    const ts = Number(timestamp);
    if (Number.isFinite(ts)) {
      const ageSeconds = Math.abs(Date.now() / 1000 - ts);
      if (ageSeconds > toleranceSeconds) {
        throw new FluvPaySignatureVerificationError(
          "Timestamp do webhook fora da tolerancia permitida.",
        );
      }
    }
  }

  return parseEvent(rawBody);
}

/** Extrai o hex apos `v1=` do header de assinatura. */
function extractV1(header: string): string | undefined {
  for (const part of header.split(",")) {
    const [scheme, value] = part.trim().split("=", 2);
    if (scheme === "v1" && value) return value.trim();
  }
  return undefined;
}

function toBuffer(payload: string | Buffer | Uint8Array): Buffer {
  if (typeof payload === "string") return Buffer.from(payload, "utf8");
  if (Buffer.isBuffer(payload)) return payload;
  return Buffer.from(payload);
}

/** Comparacao de duas strings hex em tempo constante. */
function constantTimeEqualHex(a: string, b: string): boolean {
  let bufA: Buffer;
  let bufB: Buffer;
  try {
    bufA = Buffer.from(a, "hex");
    bufB = Buffer.from(b, "hex");
  } catch {
    return false;
  }
  if (bufA.length !== bufB.length || bufA.length === 0) return false;
  return timingSafeEqual(bufA, bufB);
}

function parseEvent(rawBody: Buffer): WebhookEvent {
  const text = rawBody.toString("utf8");
  try {
    return JSON.parse(text) as WebhookEvent;
  } catch (cause) {
    throw new FluvPaySignatureVerificationError(
      "Corpo do webhook nao e um JSON valido.",
      { cause },
    );
  }
}

/** Namespace de webhooks exposto no SDK como `FluvPay.webhooks`. */
export const webhooks = { verifySignature };
