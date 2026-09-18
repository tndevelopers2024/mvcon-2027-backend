const Razorpay = require('razorpay');
require('dotenv').config();

// Helper to initialize Razorpay instance
const getRazorpayInstance = () => {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw new Error('Razorpay credentials not configured in environment.');
  }

  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });
};

/**
 * @desc    Create Razorpay order for ₹1 registration fee
 * @route   POST /api/payment/create-order
 * @access  Public
 */
const createOrder = async (req, res, next) => {
  try {
    const { fullName, email, phone, profession } = req.body;

    const razorpay = getRazorpayInstance();

    // 1 INR = 100 paise
    const feeInr = Number(process.env.REGISTRATION_FEE_INR) || 1;
    const amountInPaise = feeInr * 100;

    const options = {
      amount: amountInPaise,
      currency: 'INR',
      receipt: `rcpt_${Date.now().toString().slice(-8)}`,
      notes: {
        eventName: 'MVCON 2027',
        attendeeName: fullName || 'Attendee',
        attendeeEmail: email || '',
        attendeeProfession: profession || 'Delegates',
      },
    };

    const order = await razorpay.orders.create(options);

    res.status(200).json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error('Razorpay order creation error:', error);
    next(error);
  }
};

module.exports = {
  createOrder,
};
