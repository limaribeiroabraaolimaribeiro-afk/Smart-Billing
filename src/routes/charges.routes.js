const express = require('express');
const router = express.Router();
const chargesController = require('../controllers/chargesController');
const whatsappController = require('../controllers/whatsappController');
const adminAuth = require('../middleware/adminAuth');

router.use(adminAuth);

router.get('/', chargesController.listCharges);
router.get('/:id', chargesController.getCharge);
router.post('/', chargesController.createCharge);
router.put('/:id', chargesController.updateCharge);
router.post('/:id/cancel', chargesController.cancelCharge);
router.delete('/:id', chargesController.deleteCharge);

// Monta a mensagem de cobranca (para o botao "Enviar pelo WhatsApp" do painel)
router.post('/:id/whatsapp-message', whatsappController.buildManualMessage);

module.exports = router;
