import { describe, it, expect } from "vitest";
import {
  FluvPay,
  verifySignature,
  FluvPaySignatureVerificationError,
} from "../src/index.js";

const SECRET = "whsec_test_3f9a2b7c1d4e5f60718293a4b5c6d7e8";
const TIMESTAMP = "1718000000";
const BODY =
  '{"id":"evt_01HZX3K8M9N2P4Q6R8S0T2V4W6","type":"charge.paid","data":{"id":"chg_01HZX3K8M9N2P4Q6R8S0T2V4W6","status":"paid","amount_cents":2500}}';
const HEX =
  "ba4516ed60e9e89b613b9ce78746f8e65294baf5f2785ef6aee8f05eb15a0f99";

describe("webhooks.verifySignature (vetor deterministico)", () => {
  it("aceita a assinatura correta e retorna o evento parseado", () => {
    const event = verifySignature({
      payload: BODY,
      signatureHeader: `v1=${HEX}`,
      timestamp: TIMESTAMP,
      secret: SECRET,
    });
    expect(event.type).toBe("charge.paid");
    expect(event.id).toBe("evt_01HZX3K8M9N2P4Q6R8S0T2V4W6");
    expect((event.data as { amount_cents: number }).amount_cents).toBe(2500);
  });

  it("aceita o corpo cru como Buffer", () => {
    const event = verifySignature({
      payload: Buffer.from(BODY, "utf8"),
      signatureHeader: `v1=${HEX}`,
      timestamp: TIMESTAMP,
      secret: SECRET,
    });
    expect(event.type).toBe("charge.paid");
  });

  it("e exposto como helper estatico FluvPay.webhooks.verifySignature", () => {
    const event = FluvPay.webhooks.verifySignature({
      payload: BODY,
      signatureHeader: `v1=${HEX}`,
      timestamp: TIMESTAMP,
      secret: SECRET,
    });
    expect(event.id).toBe("evt_01HZX3K8M9N2P4Q6R8S0T2V4W6");
  });

  it("lanca quando a assinatura foi adulterada", () => {
    const tampered = "ba4516ed60e9e89b613b9ce78746f8e65294baf5f2785ef6aee8f05eb15a0f00";
    expect(() =>
      verifySignature({
        payload: BODY,
        signatureHeader: `v1=${tampered}`,
        timestamp: TIMESTAMP,
        secret: SECRET,
      }),
    ).toThrow(FluvPaySignatureVerificationError);
  });

  it("lanca quando o corpo foi alterado (mesma assinatura)", () => {
    expect(() =>
      verifySignature({
        payload: BODY.replace("2500", "9999"),
        signatureHeader: `v1=${HEX}`,
        timestamp: TIMESTAMP,
        secret: SECRET,
      }),
    ).toThrow(FluvPaySignatureVerificationError);
  });

  it("lanca quando o segredo esta errado", () => {
    expect(() =>
      verifySignature({
        payload: BODY,
        signatureHeader: `v1=${HEX}`,
        timestamp: TIMESTAMP,
        secret: "whsec_outro_segredo",
      }),
    ).toThrow(FluvPaySignatureVerificationError);
  });

  it("rejeita formato de header invalido", () => {
    expect(() =>
      verifySignature({
        payload: BODY,
        signatureHeader: HEX,
        timestamp: TIMESTAMP,
        secret: SECRET,
      }),
    ).toThrow(FluvPaySignatureVerificationError);
  });

  it("respeita toleranceSeconds quando o timestamp e velho demais", () => {
    expect(() =>
      verifySignature({
        payload: BODY,
        signatureHeader: `v1=${HEX}`,
        timestamp: TIMESTAMP,
        secret: SECRET,
        toleranceSeconds: 300,
      }),
    ).toThrow(FluvPaySignatureVerificationError);
  });
});
