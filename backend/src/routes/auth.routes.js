const express = require('express');
const authController = require('../controllers/auth.controller');
const authenticateRequest = require('../middlewares/auth.middleware');

const router = express.Router();

router.post('/login', authController.login);
router.get('/me', authenticateRequest, authController.me);
router.post('/logout', authenticateRequest, authController.logout);

module.exports = router;
