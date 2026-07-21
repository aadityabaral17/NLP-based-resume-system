const express = require("express");
const router = express.Router();
const multer = require("multer");
const FormData = require("form-data");
const fs = require("fs");
const path = require("path");
const auth = require("../middleware/auth");
const axios = require("axios");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = "./uploads/batch";
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [".pdf", ".docx"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error("Only PDF and DOCX files are allowed"));
  },
});

// POST /api/batch/rank — Upload multiple CVs + a JD, get ranked results
router.post("/rank", auth, upload.array("cv_files", 20), async (req, res) => {
  const uploadedFiles = req.files || [];

  try {
    const { user_type } = req.user;

    if (user_type !== "organisation") {
      return res.status(403).json({
        error: {
          message: "Only organisations can use batch ranking",
          status: 403,
        },
      });
    }

    const { job_description } = req.body;

    if (!job_description || !job_description.trim()) {
      return res.status(400).json({
        error: { message: "Job description is required", status: 400 },
      });
    }

    if (uploadedFiles.length === 0) {
      return res.status(400).json({
        error: { message: "At least one CV file is required", status: 400 },
      });
    }

    const pythonServiceUrl =
      process.env.PYTHON_SERVICE_URL || "http://localhost:8000";

    const formData = new FormData();
    uploadedFiles.forEach((file) => {
      formData.append("files", fs.createReadStream(file.path), {
        filename: file.originalname,
        contentType: file.mimetype,
      });
    });
    formData.append("job_description", job_description);

    const response = await axios.post(
      `${pythonServiceUrl}/api/match/batch`,
      formData,
      {
        headers: formData.getHeaders(),
      },
    );

    // Clean up uploaded files after processing
    uploadedFiles.forEach((file) => {
      fs.unlink(file.path, () => {});
    });

    res.json(response.data);
  } catch (error) {
    console.error("Batch ranking error:", error);
    // Clean up on error too
    uploadedFiles.forEach((file) => {
      if (fs.existsSync(file.path)) fs.unlink(file.path, () => {});
    });
    res.status(500).json({
      error: { message: "Error processing batch ranking", status: 500 },
    });
  }
});

module.exports = router;
