const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const {
  sendOtp,
  verifyOtp,
  registerAttendee,
  getAllRegistrations,
  getRegistrationById,
  verifyQrPass,
  checkInAttendee,
  getScanAnalytics,
} = require('../controllers/registrationController');

// OTP Routes
router.post('/send-otp', sendOtp);
router.post('/verify-otp', verifyOtp);

// QR Code Verification & Reception Check-in Routes
router.post('/verify-qr', verifyQrPass);
router.post('/check-in', checkInAttendee);
router.get('/scan-stats', getScanAnalytics);

// Registration Collection Route: /api/register
router
  .route('/')
  .post(upload.single('profilePhoto'), registerAttendee)
  .get(getAllRegistrations);

// Registration Document Route: /api/register/:id
router.route('/:id').get(getRegistrationById);

module.exports = router;
