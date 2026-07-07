# Smart Billing

Sistema simples de cobranca para clientes: cadastro de clientes, criacao de cobrancas com vencimento, pagina publica de pagamento com redirecionamento para o **Checkout Pro do Mercado Pago**, recibo apos pagamento aprovado, e cobranca automatica via WhatsApp.

> **Arquitetura 100% Supabase.** Nao ha backend Node/Express nem servidor
> ligado 24h: toda a logica roda em **Supabase Edge Functions**, o banco e
> **Supabase Postgres**, e o agendamento da cobranca automatica usa o
> **Supabase Cron** (pg_cron + pg_net). O frontend e um conjunto de arquivos
> estaticos (HTML/CSS/JS puro) que pode ser hospedado em qualquer lugar
> (Supabase Storage, Edge Function, Vercel, Netlify...).
> Este README e apenas documentacao — ele **nunca** e a pagina inicial do
> sistema. A pagina inicial real e [`public/index.html`](public/index.html).

## Stack

- **Frontend:** HTML, CSS e JavaScript puro (responsivo), 100% estatico.
- **Backend:** Supabase Edge Functions (Deno).
- **Banco de dados:** Supabase Postgres.
- **Agendamento:** Supabase Cron (pg_cron + pg_net) chamando a Edge Function `whatsapp-cron`.
- **Pagamentos:** Mercado Pago Checkout Pro (via API REST, chamada direto pelas Edge Functions).
- **Recibo:** pagina HTML imprimivel (botao "Imprimir / Salvar PDF" usa o `window.print()` do navegador).
- **WhatsApp:** estrutura pronta para envio automatico (link `wa.me` funcional hoje; integracao com provedor real e um TODO documentado no codigo).

## Estrutura do projeto

```
smart-billing/
├── database/
│   ├── schema.sql               # Tabelas do Supabase (clients, charges, ...)
│   └── cron.sql                 # Agendamento do whatsapp-cron (Supabase Cron)
├── public/                      # Frontend estatico (nao precisa de servidor)
│   ├── index.html                # Landing page do Smart Billing
│   ├── admin/                    # Painel administrativo (login + dashboard)
│   ├── pagar/                    # Pagina publica de pagamento (?id=chargeId)
│   ├── recibo/                   # Pagina publica de recibo (?id=chargeId)
│   ├── css/style.css
│   └── js/                       # config.js, api.js, login.js, dashboard.js, pagar.js, recibo.js
├── scripts/
│   └── gerar-hash-senha.js       # Gera o hash bcrypt da senha do admin
├── supabase/
│   ├── config.toml               # verify_jwt=false por function (auth propria via JWT)
│   ├── .env.example              # Referencia dos secrets usados pelas functions
│   └── functions/
│       ├── _shared/              # Codigo compartilhado (cors, auth, supabase, MP, WhatsApp...)
│       ├── admin-login/           # Login do admin -> emite JWT
│       ├── clients/               # CRUD de clientes (protegido)
│       ├── charges/               # CRUD de cobrancas + cancel + whatsapp-message (protegido)
│       ├── public-charge/         # Dados publicos da cobranca (pagina /pagar)
│       ├── create-preference/     # Cria preferencia no Mercado Pago
│       ├── mercadopago-webhook/   # Recebe e valida notificacoes do Mercado Pago
│       ├── receipt/               # Dados do recibo (so libera se pago)
│       └── whatsapp-cron/         # Chamada pelo Supabase Cron 1x/dia
├── package.json                  # Usado so pelo script local gerar-hash-senha.js
└── .gitignore
```

## 1. Pre-requisitos

- Uma conta e um projeto no [Supabase](https://supabase.com)
- [Supabase CLI](https://supabase.com/docs/guides/cli) instalada (`npm install -g supabase` ou via Scoop/Homebrew)
- Node.js (usado apenas para gerar o hash da senha do admin localmente)
- Uma conta no [Mercado Pago Developers](https://www.mercadopago.com.br/developers) com credenciais de producao ou teste

## 2. Banco de dados

1. No [dashboard do Supabase](https://supabase.com/dashboard), abra **SQL Editor** > **New query**.
2. Cole todo o conteudo de [`database/schema.sql`](database/schema.sql) e execute.
   Isso cria as tabelas: `clients`, `charges`, `payment_logs`, `receipt_logs`, `whatsapp_messages` e `settings`.

## 3. Gerar a senha do admin

O login do admin usa um hash bcrypt (nao ha cadastro de usuarios — e um login simples de um unico administrador):

```bash
npm install
node scripts/gerar-hash-senha.js "suasenha"
```

Guarde o hash gerado; ele vai para o secret `ADMIN_PASSWORD_HASH` no passo seguinte.

## 4. Configurar os secrets das Edge Functions

Veja a referencia completa em [`supabase/.env.example`](supabase/.env.example). Faca login e associe a CLI ao seu projeto:

```bash
supabase login
supabase link --project-ref SEU_PROJECT_REF
```

Configure os secrets (nunca commitados no repositorio):

```bash
supabase secrets set ADMIN_EMAIL="admin@smartbilling.com"
supabase secrets set ADMIN_PASSWORD_HASH="hash-gerado-no-passo-3"
supabase secrets set JWT_SECRET="uma-string-longa-e-aleatoria"
supabase secrets set JWT_EXPIRES_IN="8h"
supabase secrets set MERCADO_PAGO_ACCESS_TOKEN="seu-access-token-do-mercado-pago"
supabase secrets set APP_URL="https://onde-o-frontend-estiver-hospedado"
supabase secrets set CRON_SECRET="outra-string-longa-e-aleatoria"
# Opcionais, so quando integrar um provedor real de WhatsApp:
supabase secrets set WHATSAPP_PROVIDER_URL="..."
supabase secrets set WHATSAPP_PROVIDER_TOKEN="..."
```

`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` **nao precisam ser configurados manualmente** — o runtime das Edge Functions injeta essas duas automaticamente.

## 5. Deploy das Edge Functions

```bash
supabase functions deploy admin-login
supabase functions deploy clients
supabase functions deploy charges
supabase functions deploy public-charge
supabase functions deploy create-preference
supabase functions deploy mercadopago-webhook
supabase functions deploy receipt
supabase functions deploy whatsapp-cron
```

(`supabase/config.toml` ja marca `verify_jwt = false` em todas — a autenticacao do admin e feita pelo proprio codigo das functions via JWT assinado em `admin-login`.)

Anote a URL base das suas functions, algo como:

```
https://SEU_PROJECT_REF.supabase.co/functions/v1
```

## 6. Configurar o Mercado Pago

1. Acesse https://www.mercadopago.com.br/developers/panel/app e copie o **Access Token** → secret `MERCADO_PAGO_ACCESS_TOKEN`.
2. Configure o webhook apontando para:
   ```
   https://SEU_PROJECT_REF.supabase.co/functions/v1/mercadopago-webhook
   ```
3. Em ambiente de teste, use contas de teste (comprador/vendedor) para simular pagamentos.

## 7. Supabase Cron (cobranca automatica via WhatsApp)

Substitui o antigo `node-cron` — nao ha processo Node rodando, o proprio Postgres do Supabase agenda a chamada.

1. Abra [`database/cron.sql`](database/cron.sql).
2. Substitua `<PROJECT_REF>` pelo ref do seu projeto e `<CRON_SECRET>` pelo mesmo valor do secret `CRON_SECRET`.
3. Cole e execute no SQL Editor do Supabase (ele habilita as extensions `pg_cron` e `pg_net` e agenda a execucao diaria da function `whatsapp-cron`).

Regras de envio (implementadas em `supabase/functions/whatsapp-cron/index.ts`):

- 3 dias antes do vencimento
- no dia do vencimento
- 2 dias apos o vencimento (atraso)
- nunca envia se a cobranca ja estiver `pago` ou `cancelado`
- evita reenviar a mesma mensagem duas vezes no mesmo dia

As mensagens ficam registradas na tabela `whatsapp_messages` (status `pending`, `sent` ou `failed`). O envio real depende de um provedor (WhatsApp Cloud API, Twilio, Z-API etc.) configurado em `WHATSAPP_PROVIDER_URL`/`WHATSAPP_PROVIDER_TOKEN` e implementado no bloco indicado em `supabase/functions/_shared/whatsapp.ts`. O envio **manual** (botao "WhatsApp" no painel) ja funciona hoje via link `wa.me`.

## 8. Hospedar o frontend

O conteudo de [`public/`](public) e 100% estatico. Antes de publicar, edite [`public/js/config.js`](public/js/config.js) com a URL das suas functions:

```js
window.SMART_BILLING_CONFIG = {
  SUPABASE_FUNCTIONS_URL: "https://SEU_PROJECT_REF.supabase.co/functions/v1",
};
```

### Opcao A — Supabase Storage (recomendada, mais simples)

1. No dashboard, va em **Storage** e crie um bucket **publico** (ex: `smart-billing`).
2. Faca upload de todo o conteudo da pasta `public/` mantendo a mesma estrutura de pastas (`index.html`, `admin/login.html`, `admin/dashboard.html`, `pagar/index.html`, `recibo/index.html`, `css/style.css`, `js/*.js`).
3. Cada arquivo fica acessivel em:
   ```
   https://SEU_PROJECT_REF.supabase.co/storage/v1/object/public/smart-billing/index.html
   https://SEU_PROJECT_REF.supabase.co/storage/v1/object/public/smart-billing/admin/login.html
   https://SEU_PROJECT_REF.supabase.co/storage/v1/object/public/smart-billing/pagar/index.html
   ```
4. Essa e a razao de `/pagar` e `/recibo` usarem **query string** (`?id=chargeId`) em vez de path (`/pagar/:chargeId`): o Storage nao faz reescrita de rotas, entao o id da cobranca precisa vir como parametro (`.../pagar/index.html?id=abc123`). O link copiado no painel e as mensagens de WhatsApp ja usam esse formato.

### Opcao B — Edge Function propria (`app`)

Se preferir URLs "bonitas" (`/pagar/:chargeId` sem `?id=`), voce pode criar uma Edge Function chamada `app` que serve os arquivos de `public/` (empacotados dentro da propria function) e faz o roteamento manualmente (`/admin` → `admin/login.html`, `/pagar/:id` → `pagar/index.html`, etc., repassando o id via um cabecalho ou reescrevendo a query string internamente). Isso exige manter uma copia dos arquivos de `public/` dentro de `supabase/functions/app/public/` (sincronizada a cada deploy do frontend) e um pequeno roteador de arquivos estaticos. Essa opcao nao esta incluida pronta neste repositorio por ser mais complexa de manter; a Opcao A cobre o mesmo objetivo (deploy 100% Supabase) com muito menos risco operacional.

> Como o backend agora e serverless, o frontend estatico tambem pode, se preferir, ser hospedado em qualquer outro servico de arquivos estaticos (Vercel, Netlify, Cloudflare Pages etc.) — o unico requisito e editar `public/js/config.js` apontando para a URL das Edge Functions.

## 9. Fluxo de pagamento

1. O admin cadastra um cliente e cria uma cobranca (a function `charges` gera automaticamente o `payment_link`, no formato `{APP_URL}/pagar/index.html?id={chargeId}`).
2. O admin copia o link ou envia via WhatsApp (botao "WhatsApp" abre o `wa.me` com a mensagem pronta).
3. O cliente abre o link, ve os dados da cobranca e clica em **"Pagar agora"**.
4. O frontend chama `POST {SUPABASE_FUNCTIONS_URL}/create-preference/:chargeId`, que cria a preferencia no Mercado Pago (Access Token nunca sai da Edge Function) e retorna o `init_point`.
5. O cliente e redirecionado ao Checkout Pro do Mercado Pago.
6. Ao aprovar o pagamento, o Mercado Pago chama a function `mercadopago-webhook`. Ela consulta o pagamento diretamente na API do Mercado Pago (nunca confia apenas no payload recebido), confirma o `external_reference` (id da cobranca) e, se `approved`:
   - marca a cobranca como `pago`
   - salva `mercado_pago_payment_id` e `paid_at`
   - gera o `receipt_number`
   - grava em `payment_logs` e `receipt_logs`
   - libera a pagina `/recibo/index.html?id=chargeId` (bloqueada para cobrancas nao pagas, HTTP 403)
7. O cliente pode imprimir/salvar o recibo em PDF pelo botao da pagina de recibo (via `window.print()` do navegador).

## 10. Seguranca

- `MERCADO_PAGO_ACCESS_TOKEN` e a `SUPABASE_SERVICE_ROLE_KEY` existem **somente nas Edge Functions** (secrets do projeto), nunca no frontend.
- Todas as functions administrativas (`clients`, `charges`) exigem um JWT proprio valido (emitido por `admin-login`), validado manualmente em cada function — por isso `verify_jwt = false` em `supabase/config.toml` (nao usamos o Supabase Auth nativo).
- O webhook sempre confirma o pagamento consultando a API oficial do Mercado Pago antes de dar baixa na cobranca (nao confia em dados enviados na notificacao).
- O vinculo entre pagamento e cobranca e feito pelo `external_reference` (id da cobranca).
- A function `receipt` checa o status da cobranca no servidor; sem `status = pago`, o acesso e negado (HTTP 403).
- `whatsapp-cron` exige o header `x-cron-secret` batendo com o secret `CRON_SECRET`, para que so o Supabase Cron (ou quem tiver o segredo) possa dispara-la.
