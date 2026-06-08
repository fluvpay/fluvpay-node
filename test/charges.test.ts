import { describe, it, expect } from "vitest";
import { FluvPay } from "../src/index.js";
import { buildMockFetch } from "./helpers.js";

const chargeBody = {
  id: "chg_01HZX3K8M9N2P4Q6R8S0T2V4W6",
  merchant_id: "mrc_01HZX0000000000000000000",
  amount_cents: 2500,
  currency: "BRL",
  status: "pending",
  payment_method: "pix",
  pix_copy_paste: "00020126...",
  fee_processor_cents: 0,
  fee_platform_cents: 13,
  metadata: {},
  created_at: "2026-06-08T00:00:00Z",
  updated_at: "2026-06-08T00:00:00Z",
};

describe("charges.create", () => {
  it("envia o body correto, Authorization e Idempotency-Key, e parseia o Charge", async () => {
    const mock = buildMockFetch([{ status: 201, body: chargeBody }]);
    const client = new FluvPay({
      apiKey: "fluv_test_abc123",
      fetch: mock.fetch,
    });

    const charge = await client.charges.create({
      amount_cents: 2500,
      description: "Pedido 42",
    });

    expect(mock.calls).toHaveLength(1);
    const call = mock.calls[0]!;
    expect(call.method).toBe("POST");
    expect(call.url).toBe("https://api.fluvpay.com/api/v1/charges/");
    expect(call.headers["Authorization"]).toBe("Bearer fluv_test_abc123");
    expect(call.headers["User-Agent"]).toMatch(/^fluvpay-node\//);
    expect(call.headers["Idempotency-Key"]).toMatch(
      /^[0-9a-f-]{36}$/,
    );

    expect(call.body).toEqual({ amount_cents: 2500, description: "Pedido 42" });
    expect(call.body).not.toHaveProperty("currency");
    expect(call.body).not.toHaveProperty("method");

    expect(charge.id).toBe("chg_01HZX3K8M9N2P4Q6R8S0T2V4W6");
    expect(charge.status).toBe("pending");
    expect(charge.payment_method).toBe("pix");
  });

  it("usa a Idempotency-Key fornecida pelo caller", async () => {
    const mock = buildMockFetch([{ status: 201, body: chargeBody }]);
    const client = new FluvPay({ apiKey: "fluv_test_x", fetch: mock.fetch });

    await client.charges.create(
      { amount_cents: 100 },
      { idempotencyKey: "minha-chave-fixa" },
    );

    expect(mock.calls[0]!.headers["Idempotency-Key"]).toBe("minha-chave-fixa");
  });
});

describe("charges.list", () => {
  it("parseia o envelope page/per_page/has_next e monta a query", async () => {
    const mock = buildMockFetch([
      {
        status: 200,
        body: {
          data: [
            {
              id: "chg_1",
              amount_cents: 2500,
              currency: "BRL",
              status: "paid",
              created_at: "2026-06-08T00:00:00Z",
            },
          ],
          page: 2,
          per_page: 50,
          total: 73,
          has_next: false,
          has_prev: true,
        },
      },
    ]);
    const client = new FluvPay({ apiKey: "fluv_test_x", fetch: mock.fetch });

    const page = await client.charges.list({
      page: 2,
      per_page: 50,
      status: "paid",
    });

    const call = mock.calls[0]!;
    expect(call.method).toBe("GET");
    expect(call.url).toContain("page=2");
    expect(call.url).toContain("per_page=50");
    expect(call.url).toContain("status=paid");
    expect(call.headers).not.toHaveProperty("Idempotency-Key");

    expect(page.page).toBe(2);
    expect(page.per_page).toBe(50);
    expect(page.has_next).toBe(false);
    expect(page.has_prev).toBe(true);
    expect(page.data[0]!.id).toBe("chg_1");
  });
});

describe("charges.retrieve", () => {
  it("faz GET no path com id encodado", async () => {
    const mock = buildMockFetch([{ status: 200, body: chargeBody }]);
    const client = new FluvPay({ apiKey: "fluv_test_x", fetch: mock.fetch });

    await client.charges.retrieve("chg_01HZX3K8M9N2P4Q6R8S0T2V4W6");

    expect(mock.calls[0]!.url).toBe(
      "https://api.fluvpay.com/api/v1/charges/chg_01HZX3K8M9N2P4Q6R8S0T2V4W6",
    );
    expect(mock.calls[0]!.method).toBe("GET");
  });
});
