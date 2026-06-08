import { describe, it, expect } from "vitest";
import { FluvPay } from "../src/index.js";
import { buildMockFetch } from "./helpers.js";

describe("envelopes de paginacao distintos", () => {
  it("transactions.list usa page/per_page/has_next/has_prev", async () => {
    const mock = buildMockFetch([
      {
        status: 200,
        body: {
          data: [
            {
              id: "tx_1",
              merchant_id: "m",
              type: "charge",
              direction: "credit",
              amount_cents: 2500,
              fee_cents: 13,
              net_amount_cents: 2487,
              status: "completed",
              metadata: {},
              created_at: "2026-06-08T00:00:00Z",
            },
          ],
          page: 1,
          per_page: 20,
          total: 1,
          has_next: false,
          has_prev: false,
        },
      },
    ]);
    const client = new FluvPay({ apiKey: "fluv_live_x", fetch: mock.fetch });

    const page = await client.transactions.list({ page: 1, per_page: 20 });

    expect(mock.calls[0]!.url).toContain("page=1");
    expect(mock.calls[0]!.url).toContain("per_page=20");
    expect(page.page).toBe(1);
    expect(page.per_page).toBe(20);
    expect(page.has_next).toBe(false);
    expect(page.data[0]!.type).toBe("charge");
  });

  it("withdrawals.list usa limit/offset/total", async () => {
    const mock = buildMockFetch([
      {
        status: 200,
        body: {
          data: [
            {
              id: "wd_1",
              status: "completed",
              amount_cents: 5000,
              fee_cents: 50,
              net_cents: 4950,
              pix_key: "chave@exemplo.com",
              pix_key_type: "email",
              created_at: "2026-06-08T00:00:00Z",
              metadata: {},
            },
          ],
          limit: 10,
          offset: 20,
          total: 35,
        },
      },
    ]);
    const client = new FluvPay({ apiKey: "fluv_live_x", fetch: mock.fetch });

    const page = await client.withdrawals.list({ limit: 10, offset: 20 });

    expect(mock.calls[0]!.url).toContain("limit=10");
    expect(mock.calls[0]!.url).toContain("offset=20");
    expect(page).not.toHaveProperty("page");
    expect(page.limit).toBe(10);
    expect(page.offset).toBe(20);
    expect(page.total).toBe(35);
    expect(page.data[0]!.pix_key_type).toBe("email");
  });

  it("internalTransfers.list usa limit/offset/total e aceita direction", async () => {
    const mock = buildMockFetch([
      {
        status: 200,
        body: {
          data: [
            {
              id: "itr_1",
              from_merchant_id: "m1",
              to_merchant_id: "m2",
              amount_cents: 1000,
              status: "completed",
              created_at: "2026-06-08T00:00:00Z",
            },
          ],
          limit: 20,
          offset: 0,
          total: 1,
        },
      },
    ]);
    const client = new FluvPay({ apiKey: "fluv_live_x", fetch: mock.fetch });

    const page = await client.internalTransfers.list({ direction: "received" });

    expect(mock.calls[0]!.url).toContain("direction=received");
    expect(page.limit).toBe(20);
    expect(page.offset).toBe(0);
    expect(page.data[0]!.status).toBe("completed");
  });
});
