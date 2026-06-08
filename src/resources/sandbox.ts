import type { FluvPay } from "../client.js";
import type {
  SandboxResetResult,
  SandboxScenariosResult,
} from "../types.js";

/** Utilitarios do sandbox. Disponiveis apenas com chave `fluv_test_`. */
export class SandboxResource {
  constructor(private readonly client: FluvPay) {}

  /**
   * Apaga todos os dados do sandbox. POST /test/reset
   *
   * Disponivel apenas com chave de teste (`fluv_test_`).
   */
  reset(): Promise<SandboxResetResult> {
    return this.client.request<SandboxResetResult>({
      method: "POST",
      path: "/test/reset",
    });
  }

  /**
   * Lista os valores magicos do sandbox. GET /test/scenarios
   *
   * Disponivel apenas com chave de teste (`fluv_test_`).
   */
  scenarios(): Promise<SandboxScenariosResult> {
    return this.client.request<SandboxScenariosResult>({
      method: "GET",
      path: "/test/scenarios",
    });
  }
}
