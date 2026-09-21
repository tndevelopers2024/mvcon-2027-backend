const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');

// Ensure uploads/qrcodes directory exists
const qrUploadDir = path.join(__dirname, '../../uploads/qrcodes');
if (!fs.existsSync(qrUploadDir)) {
  fs.mkdirSync(qrUploadDir, { recursive: true });
}

/**
 * Generate QR code and save it as a PNG file in uploads/qrcodes/
 * @param {string} registrationId - Unique registration ID (e.g. MVCON27-1001)
 * @param {object|string} payload - Data to encode into QR code
 * @returns {Promise<string>} Relative URL path e.g. /uploads/qrcodes/qr-MVCON27-1001.png
 */
const generateQrCodeFile = async (registrationId, payload) => {
  if (!registrationId) {
    throw new Error('registrationId is required to generate QR code file');
  }

  // Ensure directory exists on every call in case it was cleaned up
  if (!fs.existsSync(qrUploadDir)) {
    fs.mkdirSync(qrUploadDir, { recursive: true });
  }

  const sanitizedRegId = String(registrationId).replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `qr-${sanitizedRegId}.png`;
  const filePath = path.join(qrUploadDir, fileName);

  const qrText = typeof payload === 'string' ? payload : JSON.stringify(payload);

  await QRCode.toFile(filePath, qrText, {
    errorCorrectionLevel: 'M',
    type: 'image/png',
    margin: 2,
    width: 320,
    color: {
      dark: '#0b1623',
      light: '#ffffff',
    },
  });

  return `/uploads/qrcodes/${fileName}`;
};

/**
 * Get physical disk path of a stored QR code
 * @param {string} qrCodeUrl - Stored relative url e.g. /uploads/qrcodes/qr-xxx.png
 * @returns {string|null} Full filesystem path if file exists, or null
 */
const getQrDiskPath = (qrCodeUrl) => {
  if (!qrCodeUrl || typeof qrCodeUrl !== 'string') return null;
  if (qrCodeUrl.startsWith('data:')) return null;

  // Extract relative path from URL (e.g. /uploads/qrcodes/qr-xxx.png -> qrcodes/qr-xxx.png)
  const cleanPath = qrCodeUrl.replace(/^\/?uploads\//, '');
  const fullPath = path.join(__dirname, '../../uploads', cleanPath);
  if (fs.existsSync(fullPath)) {
    return fullPath;
  }
  return null;
};

module.exports = {
  qrUploadDir,
  generateQrCodeFile,
  getQrDiskPath,
};
