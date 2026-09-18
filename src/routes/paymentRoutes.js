const express = require('express');
const router = express.Router();
const { createOrder } = require('../controllers/paymentController');

// Route: POST /api/payment/create-order
router.post('/create-order', createOrder);

module.exports = router;
