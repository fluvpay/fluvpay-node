import { describe, it, expect } from "vitest";
import { FluvPay } from "../src/index.js";

const testKey = process.env.FLUVPAY_TEST_KEY;
const baseUrl = process.env.FLUVPAY_BASE_URL;

const shouldRun = Boolean(testKey && testKey.startsWith("fluv_test_"));
const suite = shouldRun ? describe : describe.skip;

suite("smoke no sandbox (gated por FLUVPAY_TEST_KEY)", () => {
  const client = new FluvPay({
    apiKey: testKey ?? "fluv_test_placeholder",
    ...(baseUrl ? { baseUrl } : {}),
  });

  it("cria, recupera e lista uma cobranca, depois reseta", async () => {
    const created = await client.charges.create({
      amount_cents: 2500,
      description: "smoke test SDK node",
    });
    expect(created.id).toBeTruthy();
    expect(created.payment_method).toBe("pix");

    const fetched = await client.charges.retrieve(created.id);
    expect(fetched.id).toBe(created.id);

    const page = await client.charges.list({ per_page: 5 });
    expect(Array.isArray(page.data)).toBe(true);

    const reset = await client.sandbox.reset();
    expect(reset.reset).toBe(true);
  });

  it("lista os cenarios magicos do sandbox", async () => {
    const result = await client.sandbox.scenarios();
    expect(Array.isArray(result.scenarios)).toBe(true);
  });
});
