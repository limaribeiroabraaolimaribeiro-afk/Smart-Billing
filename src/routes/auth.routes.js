const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const adminAuth = require('../middleware/adminAuth');

router.post('/login', authController.login);
router.get('/me', adminAuth, authController.me);

module.exports = router;
