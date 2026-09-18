const fs = require('fs');
const path = require('path');
const Abstract = require('../models/Abstract');

/**
 * Generate unique Abstract Submission ID
 * Format: MVCON-ABS-2027-XXXX
 */
const generateSubmissionId = async () => {
  let isUnique = false;
  let submissionId = '';
  while (!isUnique) {
    const randomCode = Math.floor(1000 + Math.random() * 9000);
    submissionId = `MVCON-ABS-2027-${randomCode}`;
    const existing = await Abstract.findOne({ submissionId });
    if (!existing) {
      isUnique = true;
    }
  }
  return submissionId;
};

/**
 * @desc    Submit a new scientific abstract
 * @route   POST /api/abstracts
 * @access  Public
 */
const submitAbstract = async (req, res, next) => {
  try {
    const {
      registrationId,
      presentingAuthor,
      email,
      phone,
      institution,
      department,
    } = req.body;

    // Validate required fields
    if (!registrationId || !presentingAuthor || !email || !phone || !institution) {
      return res.status(400).json({
        success: false,
        message: 'Please fill in all mandatory fields (Registration ID, Author Name, Email, Phone, and Institution)',
      });
    }

    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please upload an abstract document file (.pdf, .doc, or .docx)',
      });
    }

    const submissionId = await generateSubmissionId();
    const fileUrl = `/uploads/abstracts/${req.file.filename}`;

    const newAbstract = await Abstract.create({
      submissionId,
      registrationId: registrationId.trim().toUpperCase(),
      presentingAuthor: presentingAuthor.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      institution: institution.trim(),
      department: (department || '').trim(),
      fileUrl,
      fileName: req.file.filename,
      originalFileName: req.file.originalname,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      status: 'submitted',
    });

    res.status(201).json({
      success: true,
      message: 'Abstract submitted successfully!',
      submissionId: newAbstract.submissionId,
      data: newAbstract,
    });
  } catch (error) {
    // If database insertion fails and file was uploaded, clean up file
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkErr) {
        console.warn('Failed to remove uploaded file on error:', unlinkErr);
      }
    }
    next(error);
  }
};

/**
 * @desc    Get all abstract submissions (Admin)
 * @route   GET /api/abstracts
 * @access  Admin / Public
 */
const getAllAbstracts = async (req, res, next) => {
  try {
    const abstracts = await Abstract.find().sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: abstracts.length,
      data: abstracts,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single abstract by ID or submissionId
 * @route   GET /api/abstracts/:id
 * @access  Admin / Public
 */
const getAbstractById = async (req, res, next) => {
  try {
    const { id } = req.params;
    let abstract = null;

    if (id.startsWith('MVCON-ABS')) {
      abstract = await Abstract.findOne({ submissionId: id });
    } else {
      abstract = await Abstract.findById(id);
    }

    if (!abstract) {
      return res.status(404).json({
        success: false,
        message: 'Abstract submission not found',
      });
    }

    res.status(200).json({
      success: true,
      data: abstract,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete an abstract submission (Admin)
 * @route   DELETE /api/abstracts/:id
 * @access  Admin
 */
const deleteAbstract = async (req, res, next) => {
  try {
    const { id } = req.params;
    const abstract = await Abstract.findById(id);

    if (!abstract) {
      return res.status(404).json({
        success: false,
        message: 'Abstract submission not found',
      });
    }

    // Delete stored document from disk
    const filePath = path.join(__dirname, '../../uploads/abstracts', abstract.fileName);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (err) {
        console.warn('Could not delete physical file:', err);
      }
    }

    await abstract.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Abstract submission deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  submitAbstract,
  getAllAbstracts,
  getAbstractById,
  deleteAbstract,
};
