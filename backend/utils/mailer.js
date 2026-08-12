const nodemailer = require("nodemailer");

/**
 * One shared mail sender for the whole backend.
 *
 * Why this is not simply an SMTP transport
 * ----------------------------------------
 * Managed hosts block outbound SMTP to stop compromised apps sending spam, and
 * Render is one of them. The symptom is not an authentication error: the TCP
 * connection never completes, so nodemailer waits. Deployed,
 * POST /api/auth/forgot-password took 120.9 seconds and then returned 502,
 * while the identical code sends instantly from a laptop.
 *
 * So the sender prefers an HTTPS email API — an ordinary request to port 443,
 * which no host blocks — and keeps SMTP as the fallback for local development,
 * where Gmail works fine.
 *
 * Environment, first match wins:
 *   BREVO_API_KEY    HTTPS API. Free tier is 300 emails a day and a plain
 *                    Gmail address can be verified as the sender, so no
 *                    domain of your own is needed.
 *   RESEND_API_KEY   HTTPS API. Needs a verified domain before it will send
 *                    to addresses other than your own.
 *   SMTP_USER/PASS   Gmail account plus a 16-character App Password.
 *
 * Used by every transport:
 *   SMTP_USER        the address mail is sent from
 *   SMTP_FROM_NAME   display name beside it, defaults to "ResumeMatch AI"
 *
 * Gmail rewrites the From header to the authenticated account unless the
 * address is a verified alias, so over SMTP the sender really is SMTP_USER.
 */

const FROM_NAME = process.env.SMTP_FROM_NAME || "ResumeMatch AI";

// e.g.  ResumeMatch AI <recruiting@example.com>
const FROM = process.env.SMTP_USER
  ? `"${FROM_NAME}" <${process.env.SMTP_USER}>`
  : undefined;

// A request that cannot succeed should fail quickly and say why, rather than
// holding the connection open until a gateway gives up on it.
const HTTP_TIMEOUT_MS = 15000;

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },

  // Without these nodemailer waits on the operating system default, which is
  // why a blocked port produced a two minute hang instead of a prompt error.
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 15000,
});

/** Which transport will be used. Exposed on /health so misconfiguration is
 *  visible without reading logs. */
function transportName() {
  if (process.env.BREVO_API_KEY) return "brevo";
  if (process.env.RESEND_API_KEY) return "resend";
  if (process.env.SMTP_USER && process.env.SMTP_PASS) return "smtp";
  return "none";
}

async function postJson(url, headers, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`${response.status} ${detail.slice(0, 300)}`);
    }
    return true;
  } finally {
    clearTimeout(timer);
  }
}

function sendViaBrevo({ to, subject, html }) {
  return postJson(
    "https://api.brevo.com/v3/smtp/email",
    { "api-key": process.env.BREVO_API_KEY },
    {
      sender: { name: FROM_NAME, email: process.env.SMTP_USER },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    },
  );
}

function sendViaResend({ to, subject, html }) {
  return postJson(
    "https://api.resend.com/emails",
    { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
    { from: FROM, to: [to], subject, html },
  );
}

/**
 * Send one email. Throws on failure so the caller decides what the user sees.
 * The underlying reason is logged here, because the caller only receives a
 * generic Error and the distinction between "blocked port" and "wrong
 * password" is the entire diagnosis.
 */
async function sendMail({ to, subject, html }) {
  const via = transportName();

  if (via === "none") {
    throw new Error(
      "No email transport configured. Set BREVO_API_KEY, RESEND_API_KEY, " +
        "or both SMTP_USER and SMTP_PASS.",
    );
  }

  try {
    if (via === "brevo") return await sendViaBrevo({ to, subject, html });
    if (via === "resend") return await sendViaResend({ to, subject, html });
    return await transporter.sendMail({ from: FROM, to, subject, html });
  } catch (error) {
    // A blocked SMTP port surfaces as ETIMEDOUT or ESOCKET, not as an
    // authentication failure. Recording the code is what makes the two
    // distinguishable in production logs.
    const code = error.code ? `${error.code} ` : "";
    console.error(`Email send failed via ${via} to ${to}: ${code}${error.message}`);
    throw error;
  }
}

module.exports = { sendMail, transportName, transporter, FROM };
