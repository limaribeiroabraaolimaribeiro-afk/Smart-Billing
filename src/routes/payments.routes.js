const express = require('express');
const router = express.Router();
const paymentsController = require('../controllers/paymentsController');

// Rota publica: o proprio cliente final aciona a criacao da preferencia
// ao clicar em "Pagar agora" na pagina /pagar/:chargeId.
router.post('/create-preference/:chargeId', paymentsController.createPreference);

module.exports = router;
