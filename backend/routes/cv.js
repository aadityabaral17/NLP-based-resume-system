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
    INSERT INTO cvs (user_id, file_path, extracted_text, skill_entities, predicted_category, uploaded_at)
    VALUES ($1, $2, $3, $4, $5, NOW())
    ON CONFLICT (user_id) 
    DO UPDATE SET 
      file_path = EXCLUDED.file_path,
      extracted_text = EXCLUDED.extracted_text,
      skill_entities = EXCLUDED.skill_entities,
      predicted_category = EXCLUDED.predicted_category,
      uploaded_at = NOW()
    RETURNING cv_id, user_id, file_path, extracted_text, predicted_category, uploaded_at
    `;

    const result = await pool.query(query, [
      user_id,
      req.file.path,
      parsedData.raw_text,
      parsedData.skills,
      parsedData.predicted_category,
    ]);

    const cv = result.rows[0];

    // Generate career tips once at upload time (not on every profile visit)
    try {
      const pythonServiceUrl =
        process.env.PYTHON_SERVICE_URL || "http://localhost:8000";

      // Get any existing eligible matches to inform the tips (may be empty for first upload)
      const matchResult = await pool.query(
        `SELECT mr.*, j.title, o.company_name 
     FROM match_results mr
     JOIN job_vacancies j ON mr.vacancy_id = j.vacancy_id
     JOIN organisations o ON j.org_id = o.org_id
     WHERE mr.user_id = $1 AND mr.is_eligible = true
     ORDER BY mr.composite_score DESC
     LIMIT 5`,
        [user_id],
      );

      const allMissingSkills = new Set();
      matchResult.rows.forEach((match) => {
        (match.missing_skills || []).forEach((skill) =>
          allMissingSkills.add(skill),
        );
      });

      const topMatches = matchResult.rows.map((match) => ({
        job_title: match.title,
        company: match.company_name,
        match_score: match.composite_score,
      }));

      const tipsResponse = await axios.post(
        `${pythonServiceUrl}/api/career-tips`,
        {
          category: parsedData.predicted_category || "General",
          cv_text: parsedData.raw_text || "",
          top_matches: topMatches,
        },
      );

      await pool.query("UPDATE cvs SET career_tips = $1 WHERE cv_id = $2", [
        JSON.stringify({
          top_matches: topMatches,
          ai_tips: tipsResponse.data.ai_tips,
        }),
        cv.cv_id,
      ]);
    } catch (tipsError) {
      console.error("Error generating career tips at upload:", tipsError);
    }

    // Recalculate match scores for all jobs this user has already applied to
    try {
      const appliedJobsResult = await pool.query(
        `SELECT a.vacancy_id, j.description, j.required_skills, o.eligibility_threshold
     FROM applications a
     JOIN job_vacancies j ON a.vacancy_id = j.vacancy_id
     JOIN organisations o ON j.org_id = o.org_id
     WHERE a.user_id = $1`,
        [user_id],
      );

      const pythonServiceUrl =
        process.env.PYTHON_SERVICE_URL || "http://localhost:8000";

      for (const job of appliedJobsResult.rows) {
        try {
          const matchResponse = await axios.post(
            `${pythonServiceUrl}/api/match`,
            {
              cv_text: parsedData.raw_text,
              skills: parsedData.skills,
              job_description: job.description,
              required_skills: job.required_skills || [],
            },
          );

          const matchResult = matchResponse.data;
          const orgThreshold = job.eligibility_threshold ?? 0.65;
          const isEligible = matchResult.final_score >= orgThreshold;

          await pool.query(
            `UPDATE match_results 
         SET cosine_score = $1, composite_score = $2, missing_skills = $3, is_eligible = $4
         WHERE user_id = $5 AND vacancy_id = $6`,
            [
              matchResult.cosine_similarity,
              matchResult.final_score,
              matchResult.missing_skills,
              isEligible,
              user_id,
              job.vacancy_id,
            ],
          );
        } catch (matchError) {
          console.error(
            `Error recalculating match for vacancy ${job.vacancy_id}:`,
            matchError,
          );
        }
      }
    } catch (recalcError) {
      console.error(
        "Error recalculating matches after CV update:",
        recalcError,
      );
    }

    res.status(201).json({
      message: "CV uploaded and parsed successfully",
      cv: {
        cv_id: cv.cv_id,
        user_id: cv.user_id,
        file_path: cv.file_path,
        extracted_text: cv.extracted_text,
        skills: parsedData.skills,
        predicted_category: cv.predicted_category,
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

// GET /api/cv/file/:user_id — Serve the actual CV file for viewing
router.get("/file/:user_id", auth, async (req, res) => {
  try {
    const { id: requester_id, user_type } = req.user;
    const { user_id } = req.params;

    // Job seekers can only view their own file
    if (user_type === "user" && requester_id !== user_id) {
      return res.status(403).json({
        error: { message: "Access denied", status: 403 },
      });
    }

    // Organisations can only view files of candidates who applied to their jobs
    if (user_type === "organisation") {
      const verifyResult = await pool.query(
        `SELECT a.application_id 
         FROM applications a
         JOIN job_vacancies j ON a.vacancy_id = j.vacancy_id
         WHERE a.user_id = $1 AND j.org_id = $2
         LIMIT 1`,
        [user_id, requester_id],
      );

      if (verifyResult.rows.length === 0) {
        return res.status(403).json({
          error: {
            message: "This candidate has not applied to any of your jobs",
            status: 403,
          },
        });
      }
    }

    const cvResult = await pool.query(
      "SELECT file_path FROM cvs WHERE user_id = $1 ORDER BY uploaded_at DESC LIMIT 1",
      [user_id],
    );

    if (cvResult.rows.length === 0) {
      return res.status(404).json({
        error: { message: "No CV found for this user", status: 404 },
      });
    }

    const filePath = cvResult.rows[0].file_path;

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        error: { message: "CV file not found on server", status: 404 },
      });
    }

    res.sendFile(filePath, { root: "." });
  } catch (error) {
    console.error("Error serving CV file:", error);
    res.status(500).json({
      error: { message: "Error serving CV file", status: 500 },
    });
  }
});

module.exports = router;
