require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const app = express();

// Security middleware
app.use(helmet());
app.use(cors());

// Behind a reverse proxy (Vercel, nginx, Render) every request arrives from
// the proxy's address, so without this the rate limiter buckets all users
// together and the whole site locks out after one user's quota.
if (process.env.TRUST_PROXY) {
  app.set("trust proxy", Number(process.env.TRUST_PROXY) || 1);
}

// Rate limiting. A single dashboard load is ~5 API calls, so the old global
// limit of 100 per 15 minutes locked real users out after roughly twenty page
// views. Keep a generous ceiling for ordinary traffic and put a tight limit on
// the auth routes, which is where brute force actually matters.
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20, // login, register, OTP and password reset attempts per IP
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // only failed attempts count towards the limit
  message: {
    error: {
      message: "Too many attempts. Please try again in a few minutes.",
      status: 429,
    },
  },
});

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    service: "ResumeMatch AI Backend",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
  });
});

// Routes
app.use("/api/auth", authLimiter, require("./routes/auth"));
app.use("/api/cv", require("./routes/cv"));
app.use("/api/organisations", require("./routes/organisations"));
app.use("/api/jobs", require("./routes/jobs"));
app.use("/api/match", require("./routes/match"));
app.use("/api/recommendations", require("./routes/recommendations"));
app.use("/api/applications", require("./routes/applications"));
app.use("/api/profile", require("./routes/profile"));
app.use("/api/settings", require("./routes/settings"));
app.use("/api/batch", require("./routes/batch"));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);

  // multer signals upload problems (file too large, too many files) with a
  // LIMIT_* code and no status; these are bad requests, not server faults
  const status =
    err.status || (typeof err.code === "string" && err.code.startsWith("LIMIT_") ? 400 : 500);

  res.status(status).json({
    error: {
      message: err.message || "Internal Server Error",
      status,
    },
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: {
      message: "Route not found",
      status: 404,
    },
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
