const express = require('express');
const router = express.Router();
const { login, getMe, updatePassword, getAdminStats } = require('../controllers/authController');

// Route: /api/auth/login
router.post('/login', login);

// Route: /api/auth/me
router.get('/me', getMe);

// Route: /api/auth/update-password
router.put('/update-password', updatePassword);

// Route: /api/auth/stats
router.get('/stats', getAdminStats);

module.exports = router;
