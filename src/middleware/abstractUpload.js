const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads/abstracts directory exists
const abstractUploadDir = path.join(__dirname, '../../uploads/abstracts');
if (!fs.existsSync(abstractUploadDir)) {
  fs.mkdirSync(abstractUploadDir, { recursive: true });
}

// Storage strategy for abstract files
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, abstractUploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    // Sanitize extension
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `abstract-${uniqueSuffix}${ext}`);
  },
});

// File filter (accept PDF and Word documents)
const fileFilter = (req, file, cb) => {
  const allowedExtensions = ['.pdf', '.doc', '.docx'];
  const ext = path.extname(file.originalname).toLowerCase();

  const allowedMimeTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/octet-stream', // sometimes sent by browsers for docx
  ];

  if (allowedExtensions.includes(ext) || allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only document files (.pdf, .doc, .docx) are allowed for abstract submission'), false);
  }
};

const abstractUpload = multer({
  storage: storage,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB limit
  },
  fileFilter: fileFilter,
});

module.exports = abstractUpload;
