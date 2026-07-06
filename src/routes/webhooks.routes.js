const express = require('express');
const router = express.Router();
const webhooksController = require('../controllers/webhooksController');

// Rota publica chamada pelo Mercado Pago (notification_url).
router.post('/mercadopago', webhooksController.handleMercadoPagoWebhook);
// O Mercado Pago as vezes tambem chama via GET, dependendo da configuracao.
router.get('/mercadopago', webhooksController.handleMercadoPagoWebhook);

module.exports = router;
