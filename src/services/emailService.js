const nodemailer = require('nodemailer');

/**
 * Strips surrounding single/double quotes and whitespace from env strings
 */
const cleanEnv = (val) => {
  if (!val) return '';
  let str = val.toString().trim();
  if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
    str = str.slice(1, -1).trim();
  }
  return str;
};

/**
 * Creates and returns a Nodemailer transporter based on .env config.
 */
const getTransporter = () => {
  const host = cleanEnv(process.env.SMTP_HOST);
  const user = cleanEnv(process.env.SMTP_USER);
  const pass = cleanEnv(process.env.SMTP_PASS);
  const port = Number(cleanEnv(process.env.SMTP_PORT)) || 465;

  if (host && user && pass) {
    return nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        user,
        pass,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });
  }
  return null;
};

/**
 * Sends a branded 6-digit OTP verification email to the user.
 * @param {string} email - Destination email address
 * @param {string} otp - 6-digit OTP string
 * @param {string} [name] - Attendee name (optional)
 */
const sendOtpEmail = async (email, otp, name = 'Attendee') => {
  const transporter = getTransporter();

  console.log(`\n==================================================`);
  console.log(`🔑 [MVCON 2027 OTP] Code for ${email}: ${otp}`);
  console.log(`==================================================\n`);

  if (!transporter) {
    console.warn(`ℹ️ SMTP not fully configured in .env. OTP logged to console for testing.`);
    return {
      success: true,
      mode: 'console',
      message: 'OTP logged to server console (SMTP not configured)',
    };
  }

  const user = cleanEnv(process.env.SMTP_USER) || 'admin@mvcon.in';

  const mailOptions = {
    from: {
      name: 'MVCON 2027',
      address: user,
    },
    envelope: {
      from: user,
      to: email,
    },
    to: email,
    subject: `Your MVCON 2027 Verification Code: ${otp}`,
    html: `
      <div style="font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0;">
        <div style="background-color: #0b1623; padding: 32px 24px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: 1px;">MVCON 2027</h1>
          <p style="color: #94a3b8; margin: 6px 0 0 0; font-size: 14px;">Annual Medical Conference & Exhibition</p>
        </div>
        <div style="padding: 32px 24px; color: #1e293b;">
          <h2 style="font-size: 20px; font-weight: 700; margin-top: 0;">Registration Verification</h2>
          <p style="font-size: 15px; line-height: 1.6; color: #475569;">
            Hello <strong>${name}</strong>,<br/>
            Thank you for registering for MVCON 2027. Please use the verification code below to verify your email address and complete your conference registration:
          </p>
          <div style="margin: 28px 0; text-align: center;">
            <span style="display: inline-block; background-color: #f1f5f9; border: 2px dashed #1F83C6; color: #1F83C6; font-size: 32px; font-weight: 800; letter-spacing: 8px; padding: 14px 28px; border-radius: 12px; font-family: monospace;">
              ${otp}
            </span>
          </div>
          <p style="font-size: 13px; color: #64748b; line-height: 1.5;">
            ⏳ This code is valid for <strong>10 minutes</strong>. If you did not initiate this registration, please disregard this email.
          </p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
          <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0;">
            MVCON 2027 Organizing Committee • All Rights Reserved
          </p>
        </div>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`✉️ OTP email sent to ${email}: ${info.messageId}`);
    return {
      success: true,
      mode: 'smtp',
      messageId: info.messageId,
    };
  } catch (error) {
    console.error(`❌ Failed to send OTP email: ${error.message}`);
    // Still return success in development so flow is not interrupted
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Sends an official registration confirmation email with Registration ID.
 */
const sendRegistrationConfirmationEmail = async (attendee) => {
  const transporter = getTransporter();
  if (!transporter) return;

  // Build attachments list
  const attachments = [];
  let qrCodeHtmlSection = '';

  if (attendee.qrCode) {
    // Extract raw base64 data from data:image/png;base64,...
    const base64Data = attendee.qrCode.replace(/^data:image\/[a-zA-Z]+;base64,/, '');
    attachments.push({
      filename: `MVCON2027_${attendee.registrationId}_Pass.png`,
      content: base64Data,
      encoding: 'base64',
      cid: 'attendee-pass-qrcode',
    });

    qrCodeHtmlSection = `
      <div style="margin: 24px 0; text-align: center; background-color: #f8fafc; border: 2px dashed #0369a1; border-radius: 12px; padding: 20px;">
        <div style="font-size: 12px; text-transform: uppercase; color: #0369a1; font-weight: 800; letter-spacing: 0.8px; margin-bottom: 6px;">
          🎟️ Official Conference Entry QR Code
        </div>
        <p style="font-size: 13px; color: #475569; margin: 0 0 14px 0;">
          Scan this QR pass at the MVCON 2027 reception desk for instant check-in & delegate badge printing.
        </p>
        <div style="background-color: #ffffff; padding: 12px; border-radius: 12px; display: inline-block; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          <img src="cid:attendee-pass-qrcode" alt="Entry QR Pass" width="190" height="190" style="display: block; margin: 0 auto; border-radius: 6px;" />
        </div>
        <div style="font-family: monospace; font-size: 13px; font-weight: 800; color: #0b1623; margin-top: 10px; letter-spacing: 1px;">
          ${attendee.registrationId}
        </div>
      </div>
    `;
  }

  const user = cleanEnv(process.env.SMTP_USER) || 'admin@mvcon.in';

  const mailOptions = {
    from: {
      name: 'MVCON 2027',
      address: user,
    },
    envelope: {
      from: user,
      to: attendee.email,
    },
    to: attendee.email,
    subject: `Registration Confirmed: MVCON 2027 Pass ID ${attendee.registrationId}`,
    attachments,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0;">
        <div style="background-color: #0b1623; padding: 32px 24px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 800;">MVCON 2027</h1>
          <p style="color: #94a3b8; margin: 6px 0 0 0; font-size: 14px;">Annual Medical Conference & Exhibition</p>
        </div>
        <div style="padding: 32px 24px; color: #1e293b;">
          <h2 style="font-size: 20px; font-weight: 700; color: #15803d; margin-top: 0;">🎉 Registration Confirmed!</h2>
          <p style="font-size: 15px; line-height: 1.6; color: #475569;">
            Dear <strong>${attendee.fullName}</strong>,<br/>
            Your registration for <strong>MVCON 2027</strong> has been successfully verified and confirmed!
          </p>
          <div style="background-color: #0b1623; border-radius: 12px; padding: 20px; color: #ffffff; margin: 24px 0;">
            <div style="font-size: 11px; text-transform: uppercase; color: #38bdf8; font-weight: bold; letter-spacing: 1px;">Official Registration ID</div>
            <div style="font-size: 24px; font-family: monospace; font-weight: 800; color: #f97316; margin: 6px 0 16px 0;">${attendee.registrationId}</div>
            <div style="font-size: 13px; color: #cbd5e1; line-height: 1.8;">
              <div><strong>Institution:</strong> ${attendee.institution}</div>
              <div><strong>Profession:</strong> ${attendee.profession} (${attendee.designation})</div>
              <div><strong>Location:</strong> ${attendee.city}, ${attendee.state}</div>
              <div><strong>Registration Fee:</strong> <span style="color: #4ade80;">₹${attendee.paymentAmount || 1}.00 Paid</span> ${attendee.razorpayPaymentId ? `(${attendee.razorpayPaymentId})` : ''}</div>
              <div><strong>Status:</strong> <span style="color: #4ade80;">Verified • Active</span></div>
            </div>
          </div>

          ${qrCodeHtmlSection}

          ${attendee.rawPassword ? `
          <!-- Login Credentials Card -->
          <div style="background-color: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 12px; padding: 20px; margin: 24px 0;">
            <div style="font-size: 12px; text-transform: uppercase; color: #0369a1; font-weight: 800; letter-spacing: 0.5px; margin-bottom: 6px;">
              🔐 Attendee Portal Login Credentials
            </div>
            <p style="font-size: 13px; color: #475569; margin: 0 0 12px 0;">
              You can use these credentials to log in to your MVCON 2027 account:
            </p>
            <div style="background: #ffffff; border-radius: 8px; padding: 12px 16px; font-size: 14px; border: 1px solid #e2e8f0;">
              <div style="margin-bottom: 8px;">
                <span style="color: #64748b; font-size: 12px; display: block;">Login Email:</span>
                <strong style="color: #0f172a; font-family: monospace;">${attendee.email}</strong>
              </div>
              <div>
                <span style="color: #64748b; font-size: 12px; display: block;">Your Password:</span>
                <strong style="color: #1F83C6; font-family: monospace; font-size: 16px; background: #e0f2fe; padding: 3px 10px; border-radius: 6px; display: inline-block;">${attendee.rawPassword}</strong>
              </div>
            </div>
          </div>
          ` : ''}

          <p style="font-size: 13px; color: #64748b; line-height: 1.5;">
            Please present your Registration ID and QR Code pass at the conference reception for attendee kit collection and badge printing.
          </p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
          <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0;">
            MVCON 2027 Organizing Committee • All Rights Reserved
          </p>
        </div>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✉️ Confirmation email with QR Code sent to ${attendee.email}`);
  } catch (err) {
    console.error(`⚠️ Failed to send confirmation email: ${err.message}`);
  }
};

module.exports = {
  sendOtpEmail,
  sendRegistrationConfirmationEmail,
};
