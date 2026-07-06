const express = require('express');
const router = express.Router();
const clientsController = require('../controllers/clientsController');
const adminAuth = require('../middleware/adminAuth');

router.use(adminAuth);

router.get('/', clientsController.listClients);
router.get('/:id', clientsController.getClient);
router.post('/', clientsController.createClient);
router.put('/:id', clientsController.updateClient);
router.delete('/:id', clientsController.deleteClient);

module.exports = router;
