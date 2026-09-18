const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const registrationSchema = new mongoose.Schema(
  {
    registrationId: {
      type: String,
      unique: true,
      index: true,
    },
    // Step 1: Personal Details
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
    },
    institution: {
      type: String,
      required: [true, 'Institution is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        'Please provide a valid email address',
      ],
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      unique: true,
      index: true,
      trim: true,
    },
    profilePhoto: {
      type: String,
      default: '',
    },
    qrCode: {
      type: String,
      default: '',
    },
    password: {
      type: String,
      minlength: [6, 'Password must be at least 6 characters'],
      select: false, // Don't return password by default
    },

    // Step 2: Professional Profile
    profession: {
      type: String,
      required: [true, 'Profession is required'],
      enum: {
        values: ['PG', 'Delegates', 'Consultant', 'Student', 'Other'],
        message: '{VALUE} is not a valid profession option',
      },
    },
    designation: {
      type: String,
      required: [true, 'Designation is required'],
      trim: true,
    },
    stateMedicalCouncilNumber: {
      type: String,
      required: [true, 'State Medical Council Number is required'],
      trim: true,
    },

    // Step 3: Location & Billing
    city: {
      type: String,
      required: [true, 'City is required'],
      trim: true,
    },
    state: {
      type: String,
      required: [true, 'State is required'],
      trim: true,
    },
    couponCode: {
      type: String,
      trim: true,
      default: '',
    },

    // Administrative / Payment state
    paymentAmount: {
      type: Number,
      default: 1,
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'completed', 'waived', 'failed'],
      default: 'completed',
    },
    razorpayOrderId: {
      type: String,
      default: '',
    },
    razorpayPaymentId: {
      type: String,
      default: '',
    },
    razorpaySignature: {
      type: String,
      default: '',
    },
    registrationStatus: {
      type: String,
      enum: ['pending', 'confirmed', 'cancelled'],
      default: 'confirmed',
    },
    checkedIn: {
      type: Boolean,
      default: false,
    },
    checkInTime: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Auto-generate human-readable registration ID before saving if not present
registrationSchema.pre('save', async function () {
  if (!this.registrationId) {
    const randomSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
    const timestamp = Date.now().toString().slice(-4);
    this.registrationId = `MVC27-${timestamp}${randomSuffix}`;
  }

  // Hash password if modified or newly provided
  if (this.isModified('password') && this.password) {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  }
});

// Method to compare entered password with hashed password
registrationSchema.methods.matchPassword = async function (enteredPassword) {
  if (!this.password) return false;
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('Registration', registrationSchema);
