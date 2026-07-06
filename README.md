# Smart Billing

Sistema simples de cobranca para clientes: cadastro de clientes, criacao de cobrancas com vencimento, pagina publica de pagamento com redirecionamento para o **Checkout Pro do Mercado Pago**, geracao automatica de **recibo em PDF** apos pagamento aprovado, e estrutura pronta para **cobranca automatica via WhatsApp**.

## Stack

- **Frontend:** HTML, CSS e JavaScript puro (responsivo), servido como arquivos estaticos pelo proprio backend.
- **Backend:** Node.js + Express.
- **Banco de dados:** Supabase (PostgreSQL).
- **Pagamentos:** Mercado Pago Checkout Pro.
- **PDF:** pdfkit.
- **WhatsApp:** estrutura pronta para envio automatico (link `wa.me` funcional hoje; integracao com provedor real e um TODO documentado no codigo).

## Estrutura do projeto

```
smart-billing/
├── database/
│   └── schema.sql              # Script para criar as tabelas no Supabase
├── public/                     # Frontend (servido como estatico pelo Express)
│   ├── admin/                  # Painel administrativo (login + dashboard)
│   ├── pagar/                  # Pagina publica de pagamento (/pagar/:chargeId)
│   ├── recibo/                 # Pagina publica de recibo (/recibo/:chargeId)
│   ├── css/style.css
│   └── js/                     # api.js, login.js, dashboard.js, pagar.js, recibo.js
├── scripts/
│   └── gerar-hash-senha.js     # Gera o hash bcrypt da senha do admin
├── src/
│   ├── config/                 # Clientes do Supabase e do Mercado Pago
│   ├── controllers/            # Regras de negocio de cada recurso
│   ├── middleware/              # Autenticacao do admin (JWT)
│   ├── routes/                 # Definicao das rotas Express
│   ├── services/                # Recibo (PDF), WhatsApp, agendador de lembretes
│   ├── utils/                   # Helpers (status, formatacao, mensagens)
│   └── app.js                   # Configuracao do Express
├── server.js                    # Ponto de entrada da aplicacao
├── package.json
├── .env.example
└── .gitignore
```

## 1. Pre-requisitos

- Node.js 18 ou superior
- Uma conta no [Supabase](https://supabase.com)
- Uma conta no [Mercado Pago Developers](https://www.mercadopago.com.br/developers) com credenciais de producao ou teste

## 2. Instalacao

```bash
npm install
```

## 3. Configurar o banco de dados (Supabase)

1. Crie um projeto em https://supabase.com.
2. No painel, abra **SQL Editor** > **New query**.
3. Cole todo o conteudo de [`database/schema.sql`](database/schema.sql) e execute.
   Isso cria as tabelas: `clients`, `charges`, `payment_logs`, `receipt_logs`, `whatsapp_messages` e `settings`.
4. Em **Settings > API**, copie:
   - `Project URL` → `SUPABASE_URL`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (nunca exponha essa chave no frontend)

## 4. Configurar o Mercado Pago

1. Acesse https://www.mercadopago.com.br/developers/panel/app e crie/abra uma aplicacao.
2. Copie o **Access Token** (producao ou teste) → `MERCADOPAGO_ACCESS_TOKEN`.
3. Em ambiente de teste, use contas de teste (comprador/vendedor) para simular pagamentos.
4. Para o **webhook** funcionar em desenvolvimento local, exponha sua porta com uma ferramenta como [ngrok](https://ngrok.com) e use essa URL publica em `BASE_URL` (ex: `https://abcd1234.ngrok.app`). O Mercado Pago precisa conseguir chamar `{BASE_URL}/api/webhooks/mercadopago`.

## 5. Variaveis de ambiente

Copie o arquivo de exemplo:

```bash
cp .env.example .env
```

Preencha o `.env` com seus valores. Campos principais:

| Variavel | Descricao |
|---|---|
| `PORT` | Porta do servidor (padrao 3000) |
| `BASE_URL` | URL publica da aplicacao (usada em links de pagamento, recibo e webhook) |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Credenciais do Supabase |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD_HASH` | Login do painel admin |
| `JWT_SECRET` / `JWT_EXPIRES_IN` | Configuracao do token de sessao do admin |
| `MERCADOPAGO_ACCESS_TOKEN` | Access Token privado do Mercado Pago (somente backend) |
| `WHATSAPP_PROVIDER_URL` / `WHATSAPP_PROVIDER_TOKEN` / `WHATSAPP_SENDER_NUMBER` | Credenciais do provedor de WhatsApp (preencher quando integrar um provedor real) |
| `ENABLE_BILLING_SCHEDULER` / `BILLING_SCHEDULER_CRON` | Liga/desliga e configura o horario do agendador de lembretes automaticos |

### Gerar a senha do admin

O login do admin usa um hash bcrypt salvo em `ADMIN_PASSWORD_HASH` (nao ha cadastro de usuarios, e um login simples de administrador). Gere o hash com:

```bash
node scripts/gerar-hash-senha.js "suasenha"
```

Copie o hash gerado para `ADMIN_PASSWORD_HASH` no `.env`.

## 6. Rodando o projeto

```bash
npm run dev     # com nodemon (recarrega automaticamente)
# ou
npm start
```

Acesse:

- Painel admin: `http://localhost:3000/admin/login.html`
- Pagina publica de pagamento: `http://localhost:3000/pagar/:chargeId`
- Pagina publica de recibo: `http://localhost:3000/recibo/:chargeId`

## 7. Fluxo de pagamento

1. O admin cadastra um cliente e cria uma cobranca (gera automaticamente o link `/pagar/:chargeId`).
2. O admin copia o link ou envia via WhatsApp (botao "WhatsApp" abre o `wa.me` com a mensagem pronta).
3. O cliente abre o link, ve os dados da cobranca e clica em **"Pagar agora"**.
4. O frontend chama `POST /api/payments/create-preference/:chargeId`, que cria a preferencia no Mercado Pago (Access Token nunca sai do backend) e retorna o `init_point`.
5. O cliente e redirecionado ao Checkout Pro do Mercado Pago.
6. Ao aprovar o pagamento, o Mercado Pago chama `POST /api/webhooks/mercadopago`. O backend consulta o pagamento diretamente na API do Mercado Pago (nunca confia apenas no payload recebido), confirma o `external_reference` (id da cobranca) e, se `approved`:
   - marca a cobranca como `pago`
   - salva `mercado_pago_payment_id` e `paid_at`
   - gera o `receipt_number`
   - libera a pagina `/recibo/:chargeId` (bloqueada para cobrancas nao pagas)
7. O cliente pode baixar o recibo em PDF pela pagina de recibo.

## 8. Cobranca automatica via WhatsApp

Regras implementadas em [`src/services/billingScheduler.js`](src/services/billingScheduler.js), executadas diariamente (cron configuravel por `BILLING_SCHEDULER_CRON`, padrao 09:00):

- 3 dias antes do vencimento
- no dia do vencimento
- 2 dias apos o vencimento (atraso)
- nunca envia se a cobranca ja estiver `pago` ou `cancelado`
- evita reenviar a mesma mensagem duas vezes no mesmo dia

Hoje as mensagens sao registradas na tabela `whatsapp_messages` (status `pending`, `sent` ou `failed`). O envio real depende de um provedor de WhatsApp (WhatsApp Cloud API, Twilio, Z-API etc.) ser configurado em `WHATSAPP_PROVIDER_URL`/`WHATSAPP_PROVIDER_TOKEN` e implementado no bloco indicado dentro de `sendAutomaticMessage` em [`src/services/whatsappService.js`](src/services/whatsappService.js). O envio **manual** (botao no painel) ja funciona hoje via link `wa.me`.

## 9. Seguranca

- O Access Token do Mercado Pago e a Service Role Key do Supabase existem **somente no backend** (`.env`), nunca no frontend.
- O webhook sempre confirma o pagamento consultando a API oficial do Mercado Pago antes de dar baixa na cobranca (nao confia em dados enviados na notificacao).
- O vinculo entre pagamento e cobranca e feito pelo `external_reference` (id da cobranca).
- A pagina de recibo e a rota de download do PDF checam o status da cobranca no servidor; sem `status = pago`, o acesso e negado (HTTP 403).
- As rotas administrativas (`/api/clients`, `/api/charges`) exigem um token JWT valido, emitido apenas apos login com as credenciais do `.env`.
