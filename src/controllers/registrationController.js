const crypto = require('crypto');
const QRCode = require('qrcode');
const Registration = require('../models/Registration');
const Otp = require('../models/Otp');
const ScanLog = require('../models/ScanLog');
const { sendOtpEmail, sendRegistrationConfirmationEmail } = require('../services/emailService');
const jwt = require('jsonwebtoken');

// Helper to normalize phone numbers to last 10 digits
const normalizePhone = (phone) => {
  if (!phone) return '';
  const digits = phone.toString().replace(/\D/g, '');
  if (digits.length >= 10) {
    return digits.slice(-10);
  }
  return digits;
};

// Helper to generate JWT token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'mvcon2027_secret_default', {
    expiresIn: process.env.JWT_EXPIRE || '7d',
  });
};

/**
 * @desc    Generate and send 6-digit OTP to attendee email
 * @route   POST /api/register/send-otp
 * @access  Public
 */
const sendOtp = async (req, res, next) => {
  try {
    const { email, fullName, phone } = req.body;

    if (!email || !email.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address.',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if email format is valid
    const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address format.',
      });
    }

    // Check if email is already registered in MVCON 2027
    const existingAttendee = await Registration.findOne({ email: normalizedEmail });
    if (existingAttendee) {
      return res.status(409).json({
        success: false,
        message: `An attendee is already registered with email: ${normalizedEmail}. Please sign in instead.`,
      });
    }

    // Check if phone number is provided and already registered
    if (phone && phone.toString().trim()) {
      const normalizedPhone = normalizePhone(phone);
      if (normalizedPhone.length < 10) {
        return res.status(400).json({
          success: false,
          message: 'Please provide a valid 10-digit mobile number.',
        });
      }

      const existingAttendeePhone = await Registration.findOne({
        $or: [
          { phone: normalizedPhone },
          { phone: { $regex: new RegExp(`${normalizedPhone}$`) } },
        ],
      });

      if (existingAttendeePhone) {
        return res.status(409).json({
          success: false,
          message: `The mobile number ${phone.toString().trim()} is already registered with another attendee. Each attendee must have a unique mobile number.`,
        });
      }
    }

    // Generate secure 6-digit OTP
    const otp = crypto.randomInt(100000, 1000000).toString();

    // Upsert OTP in database with 10-minute expiry
    await Otp.findOneAndUpdate(
      { email: normalizedEmail },
      {
        otp,
        verified: false,
        createdAt: new Date(),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Send email or log to console
    const emailResult = await sendOtpEmail(normalizedEmail, otp, fullName || 'Attendee');

    if (emailResult && !emailResult.success) {
      return res.status(500).json({
        success: false,
        message: `Failed to send verification email: ${emailResult.error || 'SMTP delivery failed'}. Please verify email settings or try again.`,
      });
    }

    res.status(200).json({
      success: true,
      message: `Verification code sent to ${normalizedEmail}`,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Verify 6-digit OTP for email
 * @route   POST /api/register/verify-otp
 * @access  Public
 */
const verifyOtp = async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both email and verification code.',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const cleanOtp = otp.toString().trim();

    const otpRecord = await Otp.findOne({ email: normalizedEmail });

    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        message: 'No verification code found or the code has expired. Please request a new OTP.',
      });
    }

    if (otpRecord.otp !== cleanOtp) {
      return res.status(400).json({
        success: false,
        message: 'Invalid verification code. Please check your code and try again.',
      });
    }

    // Mark as verified
    otpRecord.verified = true;
    await otpRecord.save();

    res.status(200).json({
      success: true,
      message: 'Email verified successfully! You may now complete your registration.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Register a new attendee for MVCON 2027 (Guarded by OTP verification)
 * @route   POST /api/register
 * @access  Public
 */
const registerAttendee = async (req, res, next) => {
  try {
    const {
      fullName,
      institution,
      email,
      phone,
      password,
      profession,
      designation,
      stateMedicalCouncilNumber,
      city,
      state,
      couponCode,
      otp,
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    } = req.body;

    // Validate essential required fields
    if (!fullName || !institution || !email || !phone || !profession || !designation || !stateMedicalCouncilNumber || !city || !state) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields across the registration steps.',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Enforce OTP verification check
    const otpRecord = await Otp.findOne({ email: normalizedEmail });
    const isOtpValid = otpRecord && (
      otpRecord.verified === true ||
      (otp && otpRecord.otp === otp.toString().trim())
    );

    if (!isOtpValid) {
      return res.status(400).json({
        success: false,
        message: 'Email verification required. Please verify the 6-digit OTP sent to your email before completing registration.',
      });
    }

    // Enforce Razorpay payment verification if payment details supplied
    let paymentStatus = 'completed';
    const feeInr = Number(process.env.REGISTRATION_FEE_INR) || 1;

    if (razorpayOrderId && razorpayPaymentId && razorpaySignature) {
      const generatedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest('hex');

      if (generatedSignature !== razorpaySignature) {
        return res.status(400).json({
          success: false,
          message: 'Razorpay payment verification failed: Invalid transaction signature.',
        });
      }
    }

    // Check if email already registered
    const existingAttendee = await Registration.findOne({ email: normalizedEmail });
    if (existingAttendee) {
      return res.status(409).json({
        success: false,
        message: `An attendee is already registered with email: ${normalizedEmail}.`,
      });
    }

    // Check if phone number is already registered
    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone || normalizedPhone.length < 10) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid 10-digit mobile number.',
      });
    }

    const existingAttendeePhone = await Registration.findOne({
      $or: [
        { phone: normalizedPhone },
        { phone: { $regex: new RegExp(`${normalizedPhone}$`) } },
      ],
    });

    if (existingAttendeePhone) {
      return res.status(409).json({
        success: false,
        message: `The mobile number ${phone.toString().trim()} is already registered with another attendee. Each attendee must have a unique mobile number.`,
      });
    }

    // Determine profile photo source (uploaded file or URL)
    let profilePhotoUrl = '';
    if (req.file) {
      profilePhotoUrl = `/uploads/${req.file.filename}`;
    } else if (req.body.profilePhoto) {
      profilePhotoUrl = req.body.profilePhoto;
    }

    // Generate unique registration ID for attendee
    const randomSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
    const timestamp = Date.now().toString().slice(-4);
    const registrationId = `MVC27-${timestamp}${randomSuffix}`;

    // Generate unique QR code containing attendee verification details
    const qrPayload = JSON.stringify({
      conference: 'MVCON 2027',
      regId: registrationId,
      name: fullName,
      email: normalizedEmail,
      profession,
      designation,
      institution,
      councilNumber: stateMedicalCouncilNumber,
      verified: true,
      paid: true,
    });

    const qrCode = await QRCode.toDataURL(qrPayload, {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      margin: 2,
      width: 320,
      color: {
        dark: '#0b1623',
        light: '#ffffff',
      },
    });

    // Generate a secure random password for attendee login (e.g. MVC27#A4B9C2)
    const generatedPassword = password || `MVC27#${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    // Create registration record
    const registration = await Registration.create({
      registrationId,
      fullName,
      institution,
      email: normalizedEmail,
      phone: normalizedPhone,
      password: generatedPassword,
      profession,
      designation,
      stateMedicalCouncilNumber,
      city,
      state,
      couponCode: couponCode || '',
      profilePhoto: profilePhotoUrl,
      qrCode,
      paymentAmount: feeInr,
      paymentStatus,
      razorpayOrderId: razorpayOrderId || '',
      razorpayPaymentId: razorpayPaymentId || '',
      razorpaySignature: razorpaySignature || '',
      registrationStatus: 'confirmed',
    });

    // Delete used OTP record to prevent replay
    await Otp.deleteMany({ email: normalizedEmail });

    // Send registration confirmation email with generated password, QR code, and payment reference asynchronously
    sendRegistrationConfirmationEmail({
      ...registration.toObject(),
      rawPassword: generatedPassword,
      qrCode,
      paymentAmount: feeInr,
      razorpayPaymentId: razorpayPaymentId || '',
    }).catch((err) =>
      console.error('Failed to send confirmation email:', err.message)
    );

    // Generate auth token
    const token = generateToken(registration._id);

    // Prepare response object
    const responseData = {
      _id: registration._id,
      registrationId: registration.registrationId,
      fullName: registration.fullName,
      email: registration.email,
      phone: registration.phone,
      institution: registration.institution,
      profession: registration.profession,
      designation: registration.designation,
      stateMedicalCouncilNumber: registration.stateMedicalCouncilNumber,
      city: registration.city,
      state: registration.state,
      couponCode: registration.couponCode,
      profilePhoto: registration.profilePhoto,
      qrCode: registration.qrCode,
      paymentAmount: registration.paymentAmount,
      paymentStatus: registration.paymentStatus,
      razorpayPaymentId: registration.razorpayPaymentId,
      registrationStatus: registration.registrationStatus,
      createdAt: registration.createdAt,
    };

    res.status(201).json({
      success: true,
      message: 'Registration successful! Welcome to MVCON 2027.',
      registrationId: registration.registrationId,
      qrCode: registration.qrCode,
      data: responseData,
      token,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all registrations (with optional search query)
 * @route   GET /api/register
 * @access  Public / Admin
 */
const getAllRegistrations = async (req, res, next) => {
  try {
    const { search, profession, status } = req.query;
    const query = {};

    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { registrationId: { $regex: search, $options: 'i' } },
        { institution: { $regex: search, $options: 'i' } },
      ];
    }

    if (profession) {
      query.profession = profession;
    }

    if (status) {
      query.registrationStatus = status;
    }

    let registrations = await Registration.find(query).sort({ createdAt: -1 });

    // Ensure any previously registered attendee without qrCode gets one generated
    const updatedRegistrations = await Promise.all(
      registrations.map(async (reg) => {
        if (!reg.qrCode && reg.registrationId) {
          try {
            const qrPayload = JSON.stringify({
              conference: 'MVCON 2027',
              regId: reg.registrationId,
              name: reg.fullName,
              email: reg.email,
              profession: reg.profession,
              designation: reg.designation,
              institution: reg.institution,
              councilNumber: reg.stateMedicalCouncilNumber,
              verified: true,
            });
            reg.qrCode = await QRCode.toDataURL(qrPayload, {
              errorCorrectionLevel: 'M',
              type: 'image/png',
              margin: 2,
              width: 320,
              color: { dark: '#0b1623', light: '#ffffff' },
            });
            await Registration.updateOne({ _id: reg._id }, { $set: { qrCode: reg.qrCode } });
          } catch (e) {
            // Ignore error in loop
          }
        }
        return reg;
      })
    );

    res.status(200).json({
      success: true,
      count: updatedRegistrations.length,
      data: updatedRegistrations,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single registration by ID or registrationId
 * @route   GET /api/register/:id
 * @access  Public
 */
const getRegistrationById = async (req, res, next) => {
  try {
    const { id } = req.params;
    let registration;

    // Check if ID is a valid Mongo ObjectId or registrationId
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      registration = await Registration.findById(id);
    } else {
      registration = await Registration.findOne({ registrationId: id });
    }

    if (!registration) {
      return res.status(404).json({
        success: false,
        message: `Registration not found with ID ${id}`,
      });
    }

    // If QR code is missing for this attendee, generate and save it
    if (!registration.qrCode && registration.registrationId) {
      const qrPayload = JSON.stringify({
        conference: 'MVCON 2027',
        regId: registration.registrationId,
        name: registration.fullName,
        email: registration.email,
        profession: registration.profession,
        designation: registration.designation,
        institution: registration.institution,
        councilNumber: registration.stateMedicalCouncilNumber,
        verified: true,
      });
      registration.qrCode = await QRCode.toDataURL(qrPayload, {
        errorCorrectionLevel: 'M',
        type: 'image/png',
        margin: 2,
        width: 320,
        color: { dark: '#0b1623', light: '#ffffff' },
      });
      await Registration.updateOne({ _id: registration._id }, { $set: { qrCode: registration.qrCode } });
    }

    res.status(200).json({
      success: true,
      data: registration,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Verify scanned QR code pass (valid vs invalid)
 * @route   POST /api/register/verify-qr
 * @access  Public / Admin
 */
const verifyQrPass = async (req, res, next) => {
  try {
    const { qrData } = req.body;

    if (!qrData) {
      return res.status(400).json({
        success: false,
        isValid: false,
        message: 'No QR code data provided for verification.',
      });
    }

    let parsedPayload = null;
    let regIdToLookup = '';
    let emailToLookup = '';

    // 1. Check if qrData is JSON string
    if (typeof qrData === 'string') {
      const trimmed = qrData.trim();
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        try {
          parsedPayload = JSON.parse(trimmed);
          regIdToLookup = parsedPayload.regId || parsedPayload.registrationId || '';
          emailToLookup = parsedPayload.email || '';
        } catch {
          // not valid JSON
        }
      } else {
        // Plain string (e.g. "MVC27-1234ABCDE")
        regIdToLookup = trimmed;
      }
    } else if (typeof qrData === 'object') {
      parsedPayload = qrData;
      regIdToLookup = parsedPayload.regId || parsedPayload.registrationId || '';
      emailToLookup = parsedPayload.email || '';
    }

    // 2. Query MongoDB for attendee
    let attendee = null;
    if (regIdToLookup) {
      attendee = await Registration.findOne({
        registrationId: { $regex: new RegExp(`^${regIdToLookup.trim()}$`, 'i') },
      });
    }

    if (!attendee && emailToLookup) {
      attendee = await Registration.findOne({
        email: emailToLookup.toLowerCase().trim(),
      });
    }

    // 3. If attendee not found in database
    if (!attendee) {
      return res.status(200).json({
        success: true,
        isValid: false,
        reason: 'NOT_FOUND',
        message: 'Invalid Pass: No matching registration record found in database.',
        scannedData: parsedPayload || qrData,
      });
    }

    // 4. If payload specified conference and it doesn't match
    if (parsedPayload && parsedPayload.conference && !parsedPayload.conference.includes('MVCON')) {
      return res.status(200).json({
        success: true,
        isValid: false,
        reason: 'CONFERENCE_MISMATCH',
        message: 'Invalid Pass: This QR code belongs to a different conference.',
        scannedData: parsedPayload,
      });
    }

    // 5. Valid attendee pass found
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const todayDateStr = `${year}-${month}-${day}`;

    // Check if this attendee was already scanned today (to deduplicate in a single day)
    const existingScanToday = await ScanLog.findOne({
      registrationId: attendee.registrationId,
      scanDate: todayDateStr,
    });

    const isFirstScanToday = !existingScanToday;

    // Record the scan in ScanLog
    await ScanLog.create({
      attendeeId: attendee._id,
      registrationId: attendee.registrationId,
      fullName: attendee.fullName,
      profession: attendee.profession || 'Delegate',
      scannedAt: now,
      scanDate: todayDateStr,
    });

    // Mark checkedIn on registration
    attendee.checkedIn = true;
    attendee.checkInTime = attendee.checkInTime || now;
    await attendee.save();

    return res.status(200).json({
      success: true,
      isValid: true,
      message: 'Verified Official MVCON 2027 Entry Pass',
      isFirstScanToday,
      scanDate: todayDateStr,
      scannedAt: now,
      alreadyScannedAt: existingScanToday ? existingScanToday.scannedAt : null,
      attendee: {
        _id: attendee._id,
        registrationId: attendee.registrationId,
        fullName: attendee.fullName,
        email: attendee.email,
        phone: attendee.phone,
        institution: attendee.institution,
        profession: attendee.profession,
        designation: attendee.designation,
        stateMedicalCouncilNumber: attendee.stateMedicalCouncilNumber,
        city: attendee.city,
        state: attendee.state,
        paymentStatus: attendee.paymentStatus,
        paymentAmount: attendee.paymentAmount,
        razorpayPaymentId: attendee.razorpayPaymentId,
        registrationStatus: attendee.registrationStatus,
        checkedIn: true,
        checkInTime: attendee.checkInTime,
        createdAt: attendee.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Check-in / admit attendee at reception counter
 * @route   POST /api/register/check-in
 * @access  Public / Admin
 */
const checkInAttendee = async (req, res, next) => {
  try {
    const { id, registrationId } = req.body;

    let attendee = null;
    if (id) {
      attendee = await Registration.findById(id);
    } else if (registrationId) {
      attendee = await Registration.findOne({ registrationId: registrationId.trim() });
    }

    if (!attendee) {
      return res.status(404).json({
        success: false,
        message: 'Attendee not found.',
      });
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const todayDateStr = `${year}-${month}-${day}`;

    // Record scan in ScanLog as well
    await ScanLog.create({
      attendeeId: attendee._id,
      registrationId: attendee.registrationId,
      fullName: attendee.fullName,
      profession: attendee.profession || 'Delegate',
      scannedAt: now,
      scanDate: todayDateStr,
    });

    attendee.checkedIn = true;
    attendee.checkInTime = attendee.checkInTime || now;
    await attendee.save();

    return res.status(200).json({
      success: true,
      message: `Attendee ${attendee.fullName} admitted & checked in successfully.`,
      checkedIn: true,
      checkInTime: attendee.checkInTime,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get overall and date-wise scan statistics (deduplicated per day)
 * @route   GET /api/register/scan-stats
 * @access  Public / Admin
 */
const getScanAnalytics = async (req, res, next) => {
  try {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const todayDateStr = `${year}-${month}-${day}`;

    // 1. Overall unique attendees scanned across all dates
    const uniqueAttendeesOverall = await ScanLog.distinct('registrationId');
    const totalOverallUniqueScans = uniqueAttendeesOverall.length;
    const totalRawScans = await ScanLog.countDocuments();

    // 2. Date-wise aggregation with daily deduplication
    // First $group deduplicates multiple scans of the same person on the same date
    // Second $group computes uniqueAttendees, pgCount, delegateCount, totalRawScans
    const dateWiseAggregation = await ScanLog.aggregate([
      {
        $group: {
          _id: { scanDate: '$scanDate', registrationId: '$registrationId' },
          attendeeId: { $first: '$attendeeId' },
          fullName: { $first: '$fullName' },
          profession: { $first: '$profession' },
          firstScanAt: { $min: '$scannedAt' },
          lastScanAt: { $max: '$scannedAt' },
          dayScanCount: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: '$_id.scanDate',
          uniqueAttendees: { $sum: 1 },
          pgCount: {
            $sum: { $cond: [{ $eq: ['$profession', 'PG'] }, 1, 0] },
          },
          delegateCount: {
            $sum: { $cond: [{ $ne: ['$profession', 'PG'] }, 1, 0] },
          },
          totalRawScans: { $sum: '$dayScanCount' },
        },
      },
      {
        $sort: { _id: -1 },
      },
      {
        $project: {
          _id: 0,
          date: '$_id',
          uniqueAttendees: 1,
          pgCount: 1,
          delegateCount: 1,
          totalRawScans: 1,
          duplicatesFiltered: { $subtract: ['$totalRawScans', '$uniqueAttendees'] },
        },
      },
    ]);

    // 3. Extract today's stats from the aggregation
    const todayStat = dateWiseAggregation.find((d) => d.date === todayDateStr);
    const todayUniqueScans = todayStat ? todayStat.uniqueAttendees : 0;
    const todayRawScans = todayStat ? todayStat.totalRawScans : 0;
    const todayDuplicatesFiltered = todayStat ? todayStat.duplicatesFiltered : 0;

    // 4. Total registered attendees in DB for attendance rate %
    const totalRegistered = await Registration.countDocuments();

    res.status(200).json({
      success: true,
      stats: {
        totalRegistered,
        totalOverallUniqueScans,
        totalRawScans,
        todayDate: todayDateStr,
        todayUniqueScans,
        todayRawScans,
        todayDuplicatesFiltered,
        overallScanPercentage: totalRegistered > 0 ? Math.round((totalOverallUniqueScans / totalRegistered) * 100) : 0,
        dateWise: dateWiseAggregation,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  sendOtp,
  verifyOtp,
  registerAttendee,
  getAllRegistrations,
  getRegistrationById,
  verifyQrPass,
  checkInAttendee,
  getScanAnalytics,
};
