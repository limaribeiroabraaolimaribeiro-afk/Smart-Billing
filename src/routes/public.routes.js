const express = require('express');
const router = express.Router();
const publicController = require('../controllers/publicController');

// Todas as rotas aqui sao publicas (sem autenticacao), usadas pela
// pagina do cliente (/pagar/:chargeId e /recibo/:chargeId).
router.get('/charges/:chargeId', publicController.getPublicCharge);
router.get('/receipts/:chargeId', publicController.getPublicReceipt);
router.get('/receipts/:chargeId/pdf', publicController.downloadReceiptPdf);

module.exports = router;
