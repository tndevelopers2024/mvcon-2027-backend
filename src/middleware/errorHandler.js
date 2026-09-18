const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error for developers
  console.error('❌ Error caught:', err);

  // Mongoose duplicate key (e.g. unique email or unique phone)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    const val = err.keyValue ? err.keyValue[field] : '';
    const fieldLabel = field === 'phone' ? 'mobile number' : field === 'email' ? 'email address' : field;
    const message = `An attendee is already registered with this ${fieldLabel}: ${val}. Each attendee must have a unique ${fieldLabel}.`;
    return res.status(409).json({
      success: false,
      message,
      field,
    });
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((val) => val.message);
    return res.status(400).json({
      success: false,
      message: messages.join(', '),
      errors: messages,
    });
  }

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    return res.status(404).json({
      success: false,
      message: `Resource not found with id of ${err.value}`,
    });
  }

  // Multer errors (e.g. file too large)
  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File too large. Profile photo must be less than 2MB.',
      });
    }
    return res.status(400).json({
      success: false,
      message: `Upload error: ${err.message}`,
    });
  }

  // Default server error
  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || 'Internal Server Error',
  });
};

module.exports = errorHandler;
