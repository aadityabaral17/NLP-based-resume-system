const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../config/database");
const {
  generateOTP,
  sendOTPEmail,
  sendPasswordResetEmail,
  saveOTP,
  verifyOTP,
} = require("../utils/otpService");

// An email belongs to either a job seeker or an organisation. Find which,
// so password reset works for both without asking the user to pick.
async function findAccountByEmail(email) {
  const user = await pool.query(
    "SELECT user_id AS id, email FROM users WHERE email = $1",
    [email],
  );
  if (user.rows.length > 0) {
    return { ...user.rows[0], table: "users", idColumn: "user_id" };
  }

  const org = await pool.query(
    "SELECT org_id AS id, email FROM organisations WHERE email = $1",
    [email],
  );
  if (org.rows.length > 0) {
    return { ...org.rows[0], table: "organisations", idColumn: "org_id" };
  }

  return null;
}

// POST /api/auth/register
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, user_type } = req.body;

    // Validation
    if (!name || !email || !password || !user_type) {
      return res.status(400).json({
        error: {
          message: "All fields are required",
          status: 400,
        },
      });
    }

    if (user_type !== "user" && user_type !== "organisation") {
      return res.status(400).json({
        error: {
          message: 'Invalid user type. Must be "user" or "organisation"',
          status: 400,
        },
      });
    }

    // An email must be unique across BOTH tables, not just the one being
    // written to. Checking only `users` let an organisation's email be
    // re-registered as a job seeker; findAccountByEmail looks in `users`
    // first, so that organisation could then never reset its password.
    const existing = await findAccountByEmail(email);

    if (existing) {
      return res.status(409).json({
        error: {
          message: "Email already registered",
          status: 409,
        },
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Insert user or organisation
    let query, params;
    if (user_type === "user") {
      query =
        "INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING user_id, name, email, created_at";
      params = [name, email, hashedPassword];
    } else {
      query =
        "INSERT INTO organisations (company_name, email, password) VALUES ($1, $2, $3) RETURNING org_id, company_name, email, created_at";
      params = [name, email, hashedPassword];
    }

    const result = await pool.query(query, params);
    const user = result.rows[0];

    // Generate JWT token
    const token = jwt.sign(
      {
        id: user_type === "user" ? user.user_id : user.org_id,
        user_type: user_type,
        email: user.email,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "24h" },
    );

    res.status(201).json({
      message: "Registration successful",
      token,
      user: {
        id: user_type === "user" ? user.user_id : user.org_id,
        name: user_type === "user" ? user.name : user.company_name,
        email: user.email,
        user_type,
      },
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({
      error: {
        message: "Internal server error",
        status: 500,
      },
    });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        error: {
          message: "Email and password are required",
          status: 400,
        },
      });
    }

    // Try user first
    let userResult = await pool.query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);

    let user_type = "user";
    let user;

    if (userResult.rows.length === 0) {
      // Try organisation
      userResult = await pool.query(
        "SELECT * FROM organisations WHERE email = $1",
        [email],
      );
      user_type = "organisation";
    }

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        error: {
          message: "Invalid email or password",
          status: 401,
        },
      });
    }

    user = userResult.rows[0];

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({
        error: {
          message: "Invalid email or password",
          status: 401,
        },
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        id: user_type === "user" ? user.user_id : user.org_id,
        user_type: user_type,
        email: user.email,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "24h" },
    );

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user_type === "user" ? user.user_id : user.org_id,
        name: user_type === "user" ? user.name : user.company_name,
        email: user.email,
        user_type,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      error: {
        message: "Internal server error",
        status: 500,
      },
    });
  }
});

// POST /api/auth/send-otp
router.post("/send-otp", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        error: { message: "Email is required", status: 400 },
      });
    }

    // Check if email already registered
    const existingUser = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email],
    );
    const existingOrg = await pool.query(
      "SELECT * FROM organisations WHERE email = $1",
      [email],
    );

    if (existingUser.rows.length > 0 || existingOrg.rows.length > 0) {
      return res.status(409).json({
        error: { message: "Email already registered", status: 409 },
      });
    }

    const otp = generateOTP();
    await saveOTP(email, otp);
    await sendOTPEmail(email, otp);

    res.json({ message: "OTP sent successfully" });
  } catch (error) {
    console.error("Send OTP error:", error);
    res.status(500).json({
      error: { message: "Failed to send OTP", status: 500 },
    });
  }
});

// POST /api/auth/verify-otp
router.post("/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        error: { message: "Email and OTP are required", status: 400 },
      });
    }

    const result = await verifyOTP(email, otp);

    if (!result.success) {
      return res.status(400).json({
        error: { message: result.message, status: 400 },
      });
    }

    res.json({ message: "OTP verified successfully", verified: true });
  } catch (error) {
    console.error("Verify OTP error:", error);
    res.status(500).json({
      error: { message: "Failed to verify OTP", status: 500 },
    });
  }
});

// POST /api/auth/forgot-password
// Emails a reset code. Always replies with the same success message, whether
// or not the address exists — otherwise this endpoint tells an attacker which
// email addresses are registered.
router.post("/forgot-password", async (req, res) => {
  const genericResponse = {
    message:
      "If that email is registered, a reset code has been sent to it.",
  };

  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        error: { message: "Email is required", status: 400 },
      });
    }

    const account = await findAccountByEmail(email);
    if (!account) {
      return res.json(genericResponse);
    }

    const otp = generateOTP();
    await saveOTP(email, otp, "reset");

    try {
      await sendPasswordResetEmail(email, otp);
    } catch (mailError) {
      // The code is saved but could not be delivered. Say so plainly rather
      // than leaving someone waiting for an email that will never arrive.
      console.error("Password reset email failed:", mailError.message);
      return res.status(502).json({
        error: {
          message: "Could not send the reset email. Please try again later.",
          status: 502,
        },
      });
    }

    res.json(genericResponse);
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({
      error: { message: "Failed to start password reset", status: 500 },
    });
  }
});

// POST /api/auth/reset-password
router.post("/reset-password", async (req, res) => {
  try {
    const { email, otp, new_password } = req.body;

    if (!email || !otp || !new_password) {
      return res.status(400).json({
        error: {
          message: "Email, code and new password are required",
          status: 400,
        },
      });
    }

    if (String(new_password).length < 6) {
      return res.status(400).json({
        error: {
          message: "Password must be at least 6 characters",
          status: 400,
        },
      });
    }

    const account = await findAccountByEmail(email);
    if (!account) {
      // The code could never be valid for an unknown address; the same
      // message as a wrong code keeps registered emails private.
      return res.status(400).json({
        error: { message: "Invalid or expired code", status: 400 },
      });
    }

    const result = await verifyOTP(email, otp, "reset");
    if (!result.success) {
      return res.status(400).json({
        error: { message: "Invalid or expired code", status: 400 },
      });
    }

    const hashedPassword = await bcrypt.hash(new_password, 10);
    await pool.query(
      `UPDATE ${account.table} SET password = $1 WHERE ${account.idColumn} = $2`,
      [hashedPassword, account.id],
    );

    res.json({ message: "Password reset successfully. You can now log in." });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({
      error: { message: "Failed to reset password", status: 500 },
    });
  }
});

module.exports = router;
