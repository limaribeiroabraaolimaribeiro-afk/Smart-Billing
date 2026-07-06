const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');

const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;

if (!accessToken) {
  console.warn(
    '[Smart Billing] Atencao: MERCADOPAGO_ACCESS_TOKEN nao configurado no .env'
  );
}

// Instancia unica do client do Mercado Pago.
// O Access Token so existe aqui, no backend. Nunca envie para o frontend.
const mpClient = new MercadoPagoConfig({
  accessToken,
  options: { timeout: 10000 },
});

const preferenceClient = new Preference(mpClient);
const paymentClient = new Payment(mpClient);

module.exports = {
  mpClient,
  preferenceClient,
  paymentClient,
};
