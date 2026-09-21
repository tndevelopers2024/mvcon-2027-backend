const QRCode = require('qrcode');
const { generateQrCodeFile } = require('../services/qrService');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const Registration = require('../models/Registration');
const Admin = require('../models/Admin');

// Generate JWT token helper
const generateToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET || 'mvcon2027_secret_default', {
    expiresIn: process.env.JWT_EXPIRE || '7d',
  });
};

/**
 * @desc    Login user or admin (verified against database)
 * @route   POST /api/auth/login
 * @access  Public
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both email and password.',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // 1. Check if Administrator exists in MongoDB database
    const admin = await Admin.findOne({ email: normalizedEmail, isActive: true }).select('+password');
    if (admin) {
      const isMatch = await admin.matchPassword(password);
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password.',
        });
      }

      const token = generateToken({
        id: admin._id.toString(),
        email: admin.email,
        role: 'admin',
        fullName: admin.fullName,
      });

      return res.status(200).json({
        success: true,
        message: 'Welcome back, Administrator!',
        token,
        user: {
          id: admin._id.toString(),
          email: admin.email,
          fullName: admin.fullName,
          role: 'admin',
        },
      });
    }

    // 2. Check if registered attendee with password matches in MongoDB database
    const attendee = await Registration.findOne({ email: normalizedEmail }).select('+password');
    if (attendee && attendee.password) {
      const isMatch = await attendee.matchPassword(password);
      if (isMatch) {
        // Ensure QR code exists and is saved as upload file
        if ((!attendee.qrCode || attendee.qrCode.startsWith('data:')) && attendee.registrationId) {
          try {
            const qrPayload = JSON.stringify({
              conference: 'MVCON 2027',
              regId: attendee.registrationId,
              name: attendee.fullName,
              email: attendee.email,
              profession: attendee.profession,
              designation: attendee.designation,
              institution: attendee.institution,
              councilNumber: attendee.stateMedicalCouncilNumber,
              verified: true,
            });
            attendee.qrCode = await generateQrCodeFile(attendee.registrationId, qrPayload);
            await Registration.updateOne({ _id: attendee._id }, { $set: { qrCode: attendee.qrCode } });
          } catch (e) {
            // non-fatal
          }
        }

        const token = generateToken({
          id: attendee._id,
          email: attendee.email,
          role: 'attendee',
          fullName: attendee.fullName,
        });

        return res.status(200).json({
          success: true,
          message: 'Login successful!',
          token,
          user: {
            id: attendee._id,
            email: attendee.email,
            fullName: attendee.fullName,
            registrationId: attendee.registrationId,
            profession: attendee.profession,
            designation: attendee.designation,
            institution: attendee.institution,
            phone: attendee.phone,
            city: attendee.city,
            state: attendee.state,
            stateMedicalCouncilNumber: attendee.stateMedicalCouncilNumber,
            couponCode: attendee.couponCode,
            profilePhoto: attendee.profilePhoto,
            qrCode: attendee.qrCode,
            paymentStatus: attendee.paymentStatus,
            registrationStatus: attendee.registrationStatus,
            role: 'attendee',
            createdAt: attendee.createdAt,
          },
        });
      }
    }

    // Invalid credentials
    return res.status(401).json({
      success: false,
      message: 'Invalid email or password. Please check your credentials and try again.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get current logged in user profile
 * @route   GET /api/auth/me
 * @access  Public/Protected
 */
const getMe = async (req, res, next) => {
  try {
    let userId;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      const token = req.headers.authorization.split(' ')[1];
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'mvcon2027_secret_default');
        userId = decoded.id;
      } catch (err) {
        // Token invalid
      }
    }

    if (!userId && req.query.id) {
      userId = req.query.id;
    }

    if (!userId && req.query.email) {
      const normalizedQueryEmail = req.query.email.toLowerCase().trim();
      const adminRecord = await Admin.findOne({ email: normalizedQueryEmail });
      if (adminRecord) {
        userId = adminRecord._id;
      } else {
        const att = await Registration.findOne({ email: normalizedQueryEmail });
        if (att) userId = att._id;
      }
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized or no user identifier provided.',
      });
    }

    // 1. Check if user is an Administrator in database
    const adminUser = await Admin.findById(userId);
    if (adminUser) {
      return res.status(200).json({
        success: true,
        user: {
          id: adminUser._id.toString(),
          email: adminUser.email,
          fullName: adminUser.fullName,
          role: 'admin',
        },
      });
    }

    // 2. Otherwise find attendee in database
    const attendee = await Registration.findById(userId);
    if (!attendee) {
      return res.status(404).json({
        success: false,
        message: 'User account not found.',
      });
    }

    // Ensure QR code is present as upload file
    if ((!attendee.qrCode || attendee.qrCode.startsWith('data:')) && attendee.registrationId) {
      const qrPayload = JSON.stringify({
        conference: 'MVCON 2027',
        regId: attendee.registrationId,
        name: attendee.fullName,
        email: attendee.email,
        profession: attendee.profession,
        designation: attendee.designation,
        institution: attendee.institution,
        councilNumber: attendee.stateMedicalCouncilNumber,
        verified: true,
      });
      attendee.qrCode = await generateQrCodeFile(attendee.registrationId, qrPayload);
      await Registration.updateOne({ _id: attendee._id }, { $set: { qrCode: attendee.qrCode } });
    }

    res.status(200).json({
      success: true,
      user: {
        id: attendee._id,
        email: attendee.email,
        fullName: attendee.fullName,
        registrationId: attendee.registrationId,
        profession: attendee.profession,
        designation: attendee.designation,
        institution: attendee.institution,
        phone: attendee.phone,
        city: attendee.city,
        state: attendee.state,
        stateMedicalCouncilNumber: attendee.stateMedicalCouncilNumber,
        couponCode: attendee.couponCode,
        profilePhoto: attendee.profilePhoto,
        qrCode: attendee.qrCode,
        paymentStatus: attendee.paymentStatus,
        registrationStatus: attendee.registrationStatus,
        role: 'attendee',
        createdAt: attendee.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update password (admin or attendee)
 * @route   PUT /api/auth/update-password
 * @access  Private
 */
const updatePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword, email } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both current and new password.',
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters long.',
      });
    }

    let account;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      const token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'mvcon2027_secret_default');
      // Check Admin collection first, then Registration collection
      account = await Admin.findById(decoded.id).select('+password');
      if (!account) {
        account = await Registration.findById(decoded.id).select('+password');
      }
    } else if (email) {
      const normalizedEmail = email.toLowerCase().trim();
      account = await Admin.findOne({ email: normalizedEmail }).select('+password');
      if (!account) {
        account = await Registration.findOne({ email: normalizedEmail }).select('+password');
      }
    }

    if (!account) {
      return res.status(404).json({
        success: false,
        message: 'User account not found.',
      });
    }

    const isMatch = await account.matchPassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Current password does not match.',
      });
    }

    account.password = newPassword;
    await account.save();

    res.status(200).json({
      success: true,
      message: 'Password updated successfully!',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get admin statistics and analytics
 * @route   GET /api/auth/stats
 * @access  Public / Admin
 */
const getAdminStats = async (req, res, next) => {
  try {
    const totalRegistrations = await Registration.countDocuments();
    const pgs = await Registration.countDocuments({ profession: 'PG' });
    const delegates = await Registration.countDocuments({
      profession: { $in: ['Delegates', 'Consultant', 'Student', 'Other'] },
    });

    res.status(200).json({
      success: true,
      stats: {
        total: totalRegistrations,
        pgs,
        delegates,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  login,
  getMe,
  updatePassword,
  getAdminStats,
};
