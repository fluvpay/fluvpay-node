import { describe, it, expect } from "vitest";
import { FluvPay, FluvPayRateLimitError } from "../src/index.js";
import { buildMockFetch, noSleep } from "./helpers.js";

describe("retentativas", () => {
  it("429 seguido de 200 resulta em sucesso (GET)", async () => {
    const mock = buildMockFetch([
      {
        status: 429,
        body: { error: { code: "RATE_LIMITED", message: "calma" } },
        headers: { "Retry-After": "1" },
      },
      {
        status: 200,
        body: { data: [], page: 1, per_page: 20, total: 0, has_next: false, has_prev: false },
      },
    ]);
    const client = new FluvPay({
      apiKey: "fluv_test_x",
      fetch: mock.fetch,
      sleep: noSleep,
    });

    const page = await client.charges.list();

    expect(mock.calls).toHaveLength(2);
    expect(page.total).toBe(0);
  });

  it("retenta POST com Idempotency-Key e reusa a mesma chave", async () => {
    const mock = buildMockFetch([
      { status: 503, body: { error: { code: "UNAVAILABLE", message: "x" } } },
      {
        status: 201,
        body: {
          id: "chg_1",
          merchant_id: "m",
          amount_cents: 100,
          currency: "BRL",
          status: "pending",
          payment_method: "pix",
          fee_processor_cents: 0,
          fee_platform_cents: 0,
          metadata: {},
          created_at: "2026-06-08T00:00:00Z",
          updated_at: "2026-06-08T00:00:00Z",
        },
      },
    ]);
    const client = new FluvPay({
      apiKey: "fluv_test_x",
      fetch: mock.fetch,
      sleep: noSleep,
    });

    const charge = await client.charges.create({ amount_cents: 100 });

    expect(mock.calls).toHaveLength(2);
    const key1 = mock.calls[0]!.headers["Idempotency-Key"];
    const key2 = mock.calls[1]!.headers["Idempotency-Key"];
    expect(key1).toBeTruthy();
    expect(key1).toBe(key2);
    expect(charge.id).toBe("chg_1");
  });

  it("nao retenta alem do maxRetries e lanca o ultimo erro", async () => {
    const mock = buildMockFetch([
      {
        status: 429,
        body: { error: { code: "RATE_LIMITED", message: "x" } },
        headers: { "Retry-After": "0" },
      },
    ]);
    const client = new FluvPay({
      apiKey: "fluv_test_x",
      fetch: mock.fetch,
      sleep: noSleep,
      maxRetries: 2,
    });

    await expect(client.charges.list()).rejects.toThrow(FluvPayRateLimitError);
    expect(mock.calls).toHaveLength(3);
  });
});
