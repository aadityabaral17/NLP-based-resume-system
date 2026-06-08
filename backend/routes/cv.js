const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const auth = require("../middleware/auth");
const pool = require("../config/database");
const axios = require("axios");

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = process.env.UPLOAD_DIR || "./uploads";
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
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5242880, // 5MB default
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [".pdf", ".docx", ".txt"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Invalid file type. Only PDF, DOCX, and TXT files are allowed.",
        ),
      );
    }
  },
});

// POST /api/cv/upload
router.post("/upload", auth, upload.single("cv_file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: {
          message: "No file uploaded",
          status: 400,
        },
      });
    }

    const { id: user_id, user_type } = req.user;

    // Only users (job seekers) can upload CVs
    if (user_type !== "user") {
      // Delete uploaded file
      fs.unlinkSync(req.file.path);
      return res.status(403).json({
        error: {
          message: "Only job seekers can upload CVs",
          status: 403,
        },
      });
    }

    // Call Python microservice to parse CV
    const FormData = require("form-data");
    const formDataToSend = new FormData();
    formDataToSend.append("file", fs.createReadStream(req.file.path), {
      filename: req.file.originalname,
      contentType: req.file.mimetype,
    });
    const pythonServiceUrl =
      process.env.PYTHON_SERVICE_URL || "http://localhost:8000";
    const response = await axios.post(
      `${pythonServiceUrl}/api/parse/cv`,
      formDataToSend,
      {
        headers: formDataToSend.getHeaders(),
      },
    );

    const parsedData = response.data;

    // Save CV to database
    const query = `
      INSERT INTO cvs (user_id, file_path, extracted_text, skill_entities, uploaded_at)
      VALUES ($1, $2, $3, $4, NOW())
      RETURNING cv_id, user_id, file_path, extracted_text, uploaded_at
    `;

    const result = await pool.query(query, [
      user_id,
      req.file.path,
      parsedData.raw_text,
      parsedData.skills,
    ]);

    const cv = result.rows[0];

    res.status(201).json({
      message: "CV uploaded and parsed successfully",
      cv: {
        cv_id: cv.cv_id,
        user_id: cv.user_id,
        file_path: cv.file_path,
        extracted_text: cv.extracted_text,
        skills: parsedData.skills,
        uploaded_at: cv.uploaded_at,
      },
    });
  } catch (error) {
    console.error("CV upload error:", error);

    // Delete uploaded file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      error: {
        message: "Error processing CV",
        status: 500,
      },
    });
  }
});

module.exports = router;
