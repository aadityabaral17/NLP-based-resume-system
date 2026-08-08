const nodemailer = require("nodemailer");

/**
 * One shared mail transport and one sender address.
 *
 * emailService.js and otpService.js each used to build their own transporter
 * and repeat `from: process.env.SMTP_USER` in four places, so changing the
 * sending account meant editing several files.
 *
 * Environment:
 *   SMTP_USER       the Gmail account used to authenticate
 *   SMTP_PASS       a 16-character Gmail App Password (not the login password)
 *   SMTP_FROM_NAME  display name recipients see, defaults to "ResumeMatch AI"
 *
 * Gmail rewrites the From header to the authenticated account unless the
 * address is a verified alias, so the sending account really is decided by
 * SMTP_USER — SMTP_FROM_NAME only controls the name shown beside it.
 */
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const FROM_NAME = process.env.SMTP_FROM_NAME || "ResumeMatch AI";

// e.g.  ResumeMatch AI <recruiting@example.com>
const FROM = process.env.SMTP_USER
  ? `"${FROM_NAME}" <${process.env.SMTP_USER}>`
  : undefined;

module.exports = { transporter, FROM };
