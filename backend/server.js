require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const app = express();

// Security middleware
app.use(helmet());
app.use(cors());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});
app.use(limiter);

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
app.use("/api/auth", require("./routes/auth"));
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
