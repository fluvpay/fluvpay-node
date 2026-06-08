import { describe, it, expect } from "vitest";
import {
  FluvPay,
  FluvPayValidationError,
  FluvPayAuthenticationError,
  FluvPayPermissionError,
  FluvPayNotFoundError,
  FluvPayConflictError,
  FluvPayRateLimitError,
  FluvPayServerError,
} from "../src/index.js";
import { buildMockFetch, noSleep } from "./helpers.js";

function makeClient(responses: Parameters<typeof buildMockFetch>[0]) {
  const mock = buildMockFetch(responses);
  const client = new FluvPay({
    apiKey: "fluv_test_x",
    fetch: mock.fetch,
    sleep: noSleep,
    maxRetries: 0,
  });
  return { client, mock };
}

describe("mapeamento de erro pelo envelope", () => {
  it("422 vira FluvPayValidationError com details e trace_id", async () => {
    const { client } = makeClient([
      {
        status: 422,
        body: {
          error: {
            code: "VALIDATION_ERROR",
            message: "Dados invalidos",
            details: [
              {
                field: "amount_cents",
                message: "Input should be greater than or equal to 100",
                type: "greater_than_equal",
              },
            ],
            trace_id: "01J0000000000000000000",
          },
        },
      },
    ]);

    await expect(client.charges.create({ amount_cents: 1 })).rejects.toThrow(
      FluvPayValidationError,
    );

    try {
      await client.charges.create({ amount_cents: 1 });
    } catch (err) {
      const e = err as FluvPayValidationError;
      expect(e.code).toBe("VALIDATION_ERROR");
      expect(e.statusCode).toBe(422);
      expect(e.traceId).toBe("01J0000000000000000000");
      expect(e.details).toHaveLength(1);
      expect(e.details![0]!.field).toBe("amount_cents");
    }
  });

  it("401 vira FluvPayAuthenticationError", async () => {
    const { client } = makeClient([
      { status: 401, body: { error: { code: "AUTHENTICATION_REQUIRED", message: "x" } } },
    ]);
    await expect(client.charges.list()).rejects.toThrow(
      FluvPayAuthenticationError,
    );
  });

  it("403 vira FluvPayPermissionError", async () => {
    const { client } = makeClient([
      { status: 403, body: { error: { code: "PERMISSION_DENIED", message: "x" } } },
    ]);
    await expect(client.withdrawals.list()).rejects.toThrow(
      FluvPayPermissionError,
    );
  });

  it("404 vira FluvPayNotFoundError", async () => {
    const { client } = makeClient([
      { status: 404, body: { error: { code: "NOT_FOUND", message: "x" } } },
    ]);
    await expect(client.charges.retrieve("nope")).rejects.toThrow(
      FluvPayNotFoundError,
    );
  });

  it("409 vira FluvPayConflictError (IDEMPOTENCY_CONFLICT)", async () => {
    const { client } = makeClient([
      {
        status: 409,
        body: { error: { code: "IDEMPOTENCY_CONFLICT", message: "x" } },
      },
    ]);
    try {
      await client.charges.create({ amount_cents: 100 });
      throw new Error("deveria ter lancado");
    } catch (err) {
      expect(err).toBeInstanceOf(FluvPayConflictError);
      expect((err as FluvPayConflictError).code).toBe("IDEMPOTENCY_CONFLICT");
    }
  });

  it("429 vira FluvPayRateLimitError com retryAfter do header", async () => {
    const { client } = makeClient([
      {
        status: 429,
        body: { error: { code: "RATE_LIMITED", message: "x" } },
        headers: { "Retry-After": "7" },
      },
    ]);
    try {
      await client.charges.list();
      throw new Error("deveria ter lancado");
    } catch (err) {
      expect(err).toBeInstanceOf(FluvPayRateLimitError);
      expect((err as FluvPayRateLimitError).retryAfter).toBe(7);
    }
  });

  it("500 vira FluvPayServerError", async () => {
    const { client } = makeClient([
      { status: 500, body: { error: { code: "INTERNAL", message: "x" } } },
    ]);
    await expect(client.charges.list()).rejects.toThrow(FluvPayServerError);
  });
});
