# FluvPay SDK para Node.js

SDK oficial da FluvPay para Node.js e TypeScript. Cobre cobranças PIX, saques,
transferências internas, extrato e verificação de webhooks, com tipagem forte e
zero dependência de runtime (usa o `fetch` nativo do Node 18+). A superfície é
estável e previsível, adequada tanto a integrações construídas por
desenvolvedores quanto a agentes que consomem esta documentação para integrar.

## Instalação

Requisito: Node.js 18 ou superior.

### A partir do GitHub

Instale direto do repositório. O `package.json` define um script `prepare` que
compila o pacote (ESM, CJS e tipos) após o download, de modo que o diretório
`dist/` é gerado localmente.

```bash
npm install github:fluvpay/fluvpay-node
```

### npm (em breve)

A publicação no registry público do npm está pendente. Quando concluída, a
instalação passará a ser `npm install fluvpay`; até lá esse comando retorna 404.

O import é idêntico nos dois casos:

```ts
import { FluvPay } from "fluvpay";
```

## Início rápido

```ts
import { FluvPay } from "fluvpay";

const fluvpay = new FluvPay({
  apiKey: process.env.FLUVPAY_API_KEY!,
});

const charge = await fluvpay.charges.create({
  amount_cents: 2500,
  description: "Pedido #1042",
  customer: { name: "Cliente Exemplo", email: "cliente@exemplo.com" },
});

console.log(charge.pix_copy_paste);
```

## Autenticação

A autenticação usa a API Key no header `Authorization`. O ambiente é determinado
pelo prefixo da chave: `fluv_live_` opera em produção e `fluv_test_` opera no
sandbox. O método `isTestKey()` indica qual ambiente está em uso.

```ts
import { FluvPay } from "fluvpay";

const fluvpay = new FluvPay({
  apiKey: process.env.FLUVPAY_API_KEY!,
  // baseUrl: "https://api.fluvpay.com/api/v1", // padrão
  // timeout: 30000,                            // ms, padrão
  // maxRetries: 2,                             // padrão (0 desliga)
});

fluvpay.isTestKey(); // true quando a chave é fluv_test_
```

Opções do construtor:

| Opção | Tipo | Padrão | Descrição |
| --- | --- | --- | --- |
| `apiKey` | `string` | obrigatório | API Key com prefixo `fluv_live_` ou `fluv_test_`. |
| `baseUrl` | `string` | `https://api.fluvpay.com/api/v1` | Base URL da API. |
| `timeout` | `number` | `30000` | Tempo limite por requisição, em milissegundos. |
| `maxRetries` | `number` | `2` | Número máximo de retentativas. `0` desliga. |
| `fetch` | `FetchLike` | `fetch` global | Implementação de `fetch`. |
| `sleep` | `SleepFn` | `setTimeout` | Função de espera, útil para testes. |

## Cobranças

### Criar

A criação aceita apenas os campos do contrato. Os campos `currency` e `method`
não são enviados: a moeda e o método (PIX) são implícitos, e a API rejeita
campos extras com erro de validação. O valor `amount_cents` varia entre `100` e
`100000`.

```ts
const charge = await fluvpay.charges.create({
  amount_cents: 2500, // R$ 25,00
  description: "Pedido #1042",
  customer: { name: "Cliente Exemplo", email: "cliente@exemplo.com" },
  pass_fee_to_payer: true,
  metadata: { pedido_id: "1042" },
});

charge.id;
charge.status;          // pending | paid | expired | cancelled | refunded
charge.pix_copy_paste;  // código copia-e-cola
charge.pix_qr_code;     // imagem do QR em base64
```

A `Idempotency-Key` é gerada automaticamente (UUIDv4) quando não informada. Para
definir a chave explicitamente, passe-a no segundo argumento:

```ts
const charge = await fluvpay.charges.create(
  { amount_cents: 2500 },
  { idempotencyKey: "pedido-1042-tentativa-1" },
);
```

### Recuperar e listar

A listagem de cobranças usa paginação por `page` e `per_page`. O campo
`has_next` indica a existência de uma página seguinte.

```ts
const charge = await fluvpay.charges.retrieve("chg_...");

const page = await fluvpay.charges.list({
  status: "paid",
  page: 1,
  per_page: 20,
  sort: "-created_at",
});

page.data;      // ChargeListItem[]
page.has_next;  // boolean
```

## Saques e transferências internas

Estas operações são exclusivas de produção. Chaves `fluv_test_` recebem `403`.

A listagem de saques usa paginação por `limit` e `offset`, e expõe o total em
`total`. A transferência interna identifica o destinatário por
`recipient_email` ou por `recipient_merchant_id`.

```ts
const withdrawal = await fluvpay.withdrawals.create({
  amount_cents: 5000,
  pix_key: "chave@exemplo.com",
  pix_key_type: "email", // cpf | cnpj | email | phone | evp
});

const wPage = await fluvpay.withdrawals.list({ limit: 20, offset: 0 });
wPage.total;

const transfer = await fluvpay.internalTransfers.create({
  amount_cents: 1000,
  recipient_email: "destino@exemplo.com",
});
```

## Extrato

O extrato (`transactions`) usa paginação por `page` e `per_page`.

```ts
const txPage = await fluvpay.transactions.list({ page: 1, per_page: 50 });
const tx = await fluvpay.transactions.retrieve("tx_...");
```

## Sandbox

Os utilitários de sandbox estão disponíveis apenas com chave `fluv_test_`.

```ts
const scenarios = await fluvpay.sandbox.scenarios();
const reset = await fluvpay.sandbox.reset();
```

## Webhooks

Cada entrega de webhook é assinada. A verificação usa o corpo cru da requisição;
o JSON não deve ser re-serializado, pois isso altera os bytes e invalida a
assinatura. A assinatura é calculada como
`HMAC_SHA256(secret, timestamp + "." + rawBody)` em hexadecimal, e o header
`X-FluvPay-Signature` segue o formato `v1=<hex>`. O parâmetro
`toleranceSeconds` define a janela de tolerância de horário aceita.

```ts
import express from "express";
import { FluvPay, FluvPaySignatureVerificationError } from "fluvpay";

const app = express();

app.post(
  "/webhooks/fluvpay",
  express.raw({ type: "application/json" }),
  (req, res) => {
    try {
      const event = FluvPay.webhooks.verifySignature({
        payload: req.body, // Buffer cru, de express.raw
        signatureHeader: req.header("X-FluvPay-Signature")!,
        timestamp: req.header("X-FluvPay-Timestamp")!,
        secret: process.env.FLUVPAY_WEBHOOK_SECRET!, // whsec_...
        toleranceSeconds: 300,
      });

      switch (event.type) {
        case "charge.paid":
          break;
        case "payout.completed":
          break;
      }

      res.sendStatus(200);
    } catch (err) {
      if (err instanceof FluvPaySignatureVerificationError) {
        res.sendStatus(400);
        return;
      }
      throw err;
    }
  },
);
```

Eventos emitidos: `charge.created`, `charge.paid`, `charge.expired`,
`charge.cancelled`, `charge.refunded`, `payout.created`, `payout.completed` e
`payout.failed`.

## Erros

Cada falha é lançada como uma exceção tipada. Todas herdam de `FluvPayError` e
expõem `code`, `message`, `details`, `traceId` e `statusCode`.

```ts
import {
  FluvPayValidationError,
  FluvPayAuthenticationError,
  FluvPayPermissionError,
  FluvPayNotFoundError,
  FluvPayConflictError,
  FluvPayRateLimitError,
  FluvPayServerError,
  FluvPayConnectionError,
} from "fluvpay";

try {
  await fluvpay.charges.create({ amount_cents: 1 });
} catch (err) {
  if (err instanceof FluvPayValidationError) {
    console.error(err.code, err.details);
  } else if (err instanceof FluvPayRateLimitError) {
    console.error("aguardar", err.retryAfter, "segundos");
  }
}
```

Mapeamento de status HTTP para exceção:

| Status | Exceção | Observação |
| --- | --- | --- |
| 400, 422 | `FluvPayValidationError` | Erro de validação dos campos. |
| 401 | `FluvPayAuthenticationError` | Chave ausente ou inválida. |
| 403 | `FluvPayPermissionError` | Operação não permitida para a chave. |
| 404 | `FluvPayNotFoundError` | Recurso inexistente. |
| 409 | `FluvPayConflictError` | Inclui `IDEMPOTENCY_CONFLICT`. |
| 429 | `FluvPayRateLimitError` | Lê `Retry-After` em `retryAfter`. |
| 5xx | `FluvPayServerError` | Erro do servidor. |
| rede, timeout | `FluvPayConnectionError` | Falha de conexão ou tempo limite. |

## Retentativas

O SDK aplica retentativas automáticas com backoff exponencial e jitter (padrão
de 2 tentativas). A retentativa ocorre apenas em situações seguras: requisições
GET e POSTs que carregam `Idempotency-Key`, restritas aos casos de `429`, `5xx`
e falha de conexão. O header `Retry-After` é respeitado. Defina `maxRetries: 0`
para desativar.

## Desenvolvimento

```bash
npm install
npm run build      # compila ESM, CJS e tipos
npm test           # unit e webhook (sem rede)
```

O smoke no sandbox é executado somente quando a variável `FLUVPAY_TEST_KEY`
(prefixo `fluv_test_`) está presente. Na ausência dela, o passo é ignorado.

## Licença

MIT.
