# FluvPay SDK para Node.js

SDK oficial da FluvPay para Node.js e TypeScript. Cobranças PIX, saques,
transferências internas e verificação de webhooks, com tipagem forte e zero
dependência de runtime (usa o `fetch` nativo do Node 18+).

## Instalação

Requisitos: Node.js 18 ou superior.

### A partir do GitHub (funciona hoje)

O SDK ainda não está publicado no registry público do npm. Por enquanto, instale
direto do repositório no GitHub. O `package.json` tem um script `prepare` que
compila o pacote (ESM + CJS + tipos) logo após o download, então o `dist/` é
gerado automaticamente na sua máquina.

Fixando uma versão (recomendado, instala a tag `v1.0.0`):

```bash
npm install github:fluvpay/fluvpay-node#v1.0.0
```

Sempre a partir do código mais recente da branch padrão:

```bash
npm install github:fluvpay/fluvpay-node
```

Depois disso, o import funciona igual ao de um pacote publicado:

```ts
import { FluvPay } from "fluvpay";
```

### A partir do npm (em breve, quando publicado no npm)

Quando o pacote estiver disponível no registry público do npm, a instalação
passará a ser este comando. Ainda não funciona, vai retornar erro 404 até a
publicação:

```bash
npm install fluvpay
```

## Configuração

A API Key define o modo de operação pelo prefixo: `fluv_live_` para produção e
`fluv_test_` para o sandbox. Você só precisa passar a chave; o SDK cuida do
resto.

```ts
import { FluvPay } from "fluvpay";

const fluvpay = new FluvPay({
  apiKey: process.env.FLUVPAY_API_KEY!,
  // baseUrl: "https://api.fluvpay.com/api/v1", // padrão
  // timeout: 30000,                            // ms, padrão
  // maxRetries: 2,                             // padrão (0 desliga)
});

console.log(fluvpay.isTestKey()); // true se a chave for fluv_test_
```

## Criar uma cobrança PIX

A criação de cobrança aceita apenas os campos do contrato. Não envie `currency`
nem `method`: a moeda e o método (PIX) são implícitos, e a API rejeita campos
extras com erro de validação.

```ts
const charge = await fluvpay.charges.create({
  amount_cents: 2500, // R$ 25,00 (mín 100, máx 100000)
  description: "Pedido #1042",
  customer: { name: "Cliente Exemplo", email: "cliente@exemplo.com" },
  pass_fee_to_payer: true,
  metadata: { pedido_id: "1042" },
});

console.log(charge.id);
console.log(charge.status);          // pending | paid | expired | cancelled | refunded
console.log(charge.pix_copy_paste);  // código copia-e-cola
console.log(charge.pix_qr_code);     // imagem do QR em base64
```

A `Idempotency-Key` é gerada automaticamente (UUIDv4) se você não informar uma.
Para controlar a chave (por exemplo, reusar entre tentativas do seu lado), passe
pelo segundo argumento:

```ts
const charge = await fluvpay.charges.create(
  { amount_cents: 2500 },
  { idempotencyKey: "pedido-1042-tentativa-1" },
);
```

## Recuperar e listar

```ts
const charge = await fluvpay.charges.retrieve("chg_...");

const page = await fluvpay.charges.list({
  status: "paid",
  page: 1,
  per_page: 20,
  sort: "-created_at",
});

console.log(page.data);      // ChargeListItem[]
console.log(page.has_next);  // paginação por page/per_page
```

## Saques e transferências internas

Estas operações são live-only: chaves `fluv_test_` recebem 403.

```ts
const withdrawal = await fluvpay.withdrawals.create({
  amount_cents: 5000,
  pix_key: "chave@exemplo.com",
  pix_key_type: "email", // cpf | cnpj | email | phone | evp
});

const wPage = await fluvpay.withdrawals.list({ limit: 20, offset: 0 });
console.log(wPage.total); // paginação por limit/offset

const transfer = await fluvpay.internalTransfers.create({
  amount_cents: 1000,
  recipient_email: "destino@exemplo.com", // ou recipient_merchant_id
});
```

## Extrato (transactions)

```ts
const txPage = await fluvpay.transactions.list({ page: 1, per_page: 50 });
const tx = await fluvpay.transactions.retrieve("tx_...");
```

## Sandbox

Disponível apenas com chave `fluv_test_`.

```ts
const scenarios = await fluvpay.sandbox.scenarios();
const reset = await fluvpay.sandbox.reset();
```

## Verificação de webhooks

A FluvPay assina cada entrega. Verifique a assinatura usando o corpo CRU da
requisição (nunca re-serialize o JSON, pois isso muda os bytes e invalida a
assinatura). O cálculo é `HMAC_SHA256(secret, timestamp + "." + rawBody)` em
hex, e o header `X-FluvPay-Signature` vem no formato `v1=<hex>`.

Exemplo com Express, lendo o corpo cru:

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
        payload: req.body, // Buffer cru, do express.raw
        signatureHeader: req.header("X-FluvPay-Signature")!,
        timestamp: req.header("X-FluvPay-Timestamp")!,
        secret: process.env.FLUVPAY_WEBHOOK_SECRET!, // whsec_...
        toleranceSeconds: 300,
      });

      switch (event.type) {
        case "charge.paid":
          // processar pagamento confirmado
          break;
        case "payout.completed":
          // processar saque concluído
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

Eventos disponíveis: `charge.created`, `charge.paid`, `charge.expired`,
`charge.cancelled`, `charge.refunded`, `payout.created`, `payout.completed` e
`payout.failed`.

## Tratamento de erros

Cada falha vira uma exceção tipada. Todas herdam de `FluvPayError` e carregam
`code`, `message`, `details`, `traceId` e `statusCode`.

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

Mapeamento: 400/422 para `FluvPayValidationError`, 401 para
`FluvPayAuthenticationError`, 403 para `FluvPayPermissionError`, 404 para
`FluvPayNotFoundError`, 409 para `FluvPayConflictError` (inclui
`IDEMPOTENCY_CONFLICT`), 429 para `FluvPayRateLimitError` (lê `Retry-After`),
5xx para `FluvPayServerError`, e falha de rede ou timeout para
`FluvPayConnectionError`.

## Retentativas

O SDK retenta automaticamente (padrão 2 tentativas, backoff exponencial com
jitter) apenas em situações seguras: requisições GET e POSTs que carregam
`Idempotency-Key`, nos casos de 429 e 5xx ou falha de conexão. O header
`Retry-After` é respeitado. Para desligar, passe `maxRetries: 0`.

## Desenvolvimento

```bash
npm install
npm run build      # compila ESM + CJS + tipos
npm test           # unit + webhook (sem rede)
```

O smoke no sandbox roda somente se a variável `FLUVPAY_TEST_KEY` (prefixo
`fluv_test_`) estiver presente; caso contrário, é ignorado.

## Licença

MIT.
