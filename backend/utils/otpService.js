const nodemailer = require("nodemailer");
const pool = require("../config/database");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Generate 6 digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Send OTP email
const sendOTPEmail = async (email, otp) => {
  const mailOptions = {
    from: process.env.SMTP_USER,
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

// Save OTP to database
const saveOTP = async (email, otp) => {
  // Delete any existing OTP for this email
  await pool.query("DELETE FROM otp_verifications WHERE email = $1", [email]);

  // Save new OTP with 10 minute expiry
  await pool.query(
    `INSERT INTO otp_verifications (email, otp, expires_at)
     VALUES ($1, $2, NOW() + INTERVAL '10 minutes')`,
    [email, otp],
  );
};

// Verify OTP
const verifyOTP = async (email, otp) => {
  const result = await pool.query(
    `SELECT * FROM otp_verifications
     WHERE email = $1 AND otp = $2
     AND expires_at > NOW()
     AND verified = FALSE`,
    [email, otp],
  );

  if (result.rows.length === 0) {
    return { success: false, message: "Invalid or expired OTP" };
  }

  // Mark as verified
  await pool.query(
    "UPDATE otp_verifications SET verified = TRUE WHERE email = $1",
    [email],
  );

  return { success: true };
};

module.exports = { generateOTP, sendOTPEmail, saveOTP, verifyOTP };
