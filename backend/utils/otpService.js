const { transporter, FROM } = require("./mailer");
const pool = require("../config/database");

// Generate 6 digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Send OTP email
const sendOTPEmail = async (email, otp) => {
  const mailOptions = {
    from: FROM,
    to: email,
    subject: "ResumeMatch AI — Email Verification Code",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
        <div style="background: #1A2B5F; padding: 24px; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 22px;">ResumeMatch AI</h1>
        </div>
        <div style="padding: 24px; border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
          <h2 style="color: #1f2937;">Verify Your Email</h2>
          <p style="color: #4b5563;">Use the verification code below to complete your registration:</p>
          <div style="background: #EFF6FF; border: 2px solid #2563EB; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
            <p style="font-size: 36px; font-weight: bold; color: #1A2B5F; letter-spacing: 8px; margin: 0;">
              ${otp}
            </p>
          </div>
          <p style="color: #4b5563;">This code expires in <strong>10 minutes</strong>.</p>
          <p style="color: #9ca3af; font-size: 12px;">If you did not register on ResumeMatch AI, please ignore this email.</p>
        </div>
      </div>
    `,
  };
  await transporter.sendMail(mailOptions);
};

// Send password reset code
const sendPasswordResetEmail = async (email, otp) => {
  const mailOptions = {
    from: FROM,
    to: email,
    subject: "ResumeMatch AI — Password Reset Code",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
        <div style="background: #1A2B5F; padding: 24px; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 22px;">ResumeMatch AI</h1>
        </div>
        <div style="padding: 24px; border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
          <h2 style="color: #1f2937;">Reset Your Password</h2>
          <p style="color: #4b5563;">Use the code below to set a new password:</p>
          <div style="background: #EFF6FF; border: 2px solid #2563EB; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
            <p style="font-size: 36px; font-weight: bold; color: #1A2B5F; letter-spacing: 8px; margin: 0;">
              ${otp}
            </p>
          </div>
          <p style="color: #4b5563;">This code expires in <strong>10 minutes</strong>.</p>
          <p style="color: #9ca3af; font-size: 12px;">If you did not ask to reset your password, ignore this email — your password has not changed.</p>
        </div>
      </div>
    `,
  };
  await transporter.sendMail(mailOptions);
};

// Save OTP to database.
// `purpose` separates signup verification from password resets so a code
// issued for one cannot be used for the other.
const saveOTP = async (email, otp, purpose = "verify") => {
  // Delete any existing OTP for this email and purpose
  await pool.query(
    "DELETE FROM otp_verifications WHERE email = $1 AND purpose = $2",
    [email, purpose],
  );

  // Save new OTP with 10 minute expiry
  await pool.query(
    `INSERT INTO otp_verifications (email, otp, purpose, expires_at)
     VALUES ($1, $2, $3, NOW() + INTERVAL '10 minutes')`,
    [email, otp, purpose],
  );
};

// Verify OTP
const verifyOTP = async (email, otp, purpose = "verify") => {
  const result = await pool.query(
    `SELECT * FROM otp_verifications
     WHERE email = $1 AND otp = $2 AND purpose = $3
     AND expires_at > NOW()
     AND verified = FALSE`,
    [email, otp, purpose],
  );

  if (result.rows.length === 0) {
    return { success: false, message: "Invalid or expired OTP" };
  }

  // A reset code must be single-use: delete it so the same code cannot set a
  // new password twice. Verification codes are kept, marked as used, because
  // registration reads them back.
  if (purpose === "reset") {
    await pool.query(
      "DELETE FROM otp_verifications WHERE email = $1 AND purpose = $2",
      [email, purpose],
    );
  } else {
    await pool.query(
      "UPDATE otp_verifications SET verified = TRUE WHERE email = $1 AND purpose = $2",
      [email, purpose],
    );
  }

  return { success: true };
};

module.exports = {
  generateOTP,
  sendOTPEmail,
  sendPasswordResetEmail,
  saveOTP,
  verifyOTP,
};
