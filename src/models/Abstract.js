const mongoose = require('mongoose');

const AbstractSchema = new mongoose.Schema(
  {
    submissionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    registrationId: {
      type: String,
      required: [true, 'MVCON 2027 Registration ID is required'],
      trim: true,
      index: true,
    },
    presentingAuthor: {
      type: String,
      required: [true, 'Presenting author name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email address is required'],
      trim: true,
      lowercase: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        'Please provide a valid email address',
      ],
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
    },
    institution: {
      type: String,
      required: [true, 'Institution / Hospital is required'],
      trim: true,
    },
    city: {
      type: String,
      default: '',
      trim: true,
    },
    department: {
      type: String,
      default: '',
      trim: true,
    },
    fileUrl: {
      type: String,
      required: [true, 'Abstract document file is required'],
    },
    fileName: {
      type: String,
      required: true,
    },
    originalFileName: {
      type: String,
      required: true,
    },
    fileSize: {
      type: Number,
      default: 0,
    },
    mimeType: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['submitted', 'under_review', 'accepted', 'rejected'],
      default: 'submitted',
    },
  },
  {
    timestamps: true,
  }
);

// Helpful text search indexing
AbstractSchema.index({
  submissionId: 'text',
  presentingAuthor: 'text',
  institution: 'text',
  city: 'text',
  registrationId: 'text',
  email: 'text',
});

module.exports = mongoose.model('Abstract', AbstractSchema);
