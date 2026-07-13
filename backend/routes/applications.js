const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const pool = require("../config/database");
const axios = require("axios");
const { sendMatchNotification } = require("../utils/emailService");

// POST /api/applications/:vacancy_id — Apply for job
router.post("/:vacancy_id", auth, async (req, res) => {
  try {
    const { id: user_id, user_type } = req.user;
    const { vacancy_id } = req.params;

    if (user_type !== "user") {
      return res.status(403).json({
        error: { message: "Only job seekers can apply", status: 403 },
      });
    }

    // Check job exists and deadline not passed
    const jobResult = await pool.query(
      `SELECT j.*, o.company_name, o.eligibility_threshold 
      FROM job_vacancies j
      JOIN organisations o ON j.org_id = o.org_id
      WHERE j.vacancy_id = $1 AND j.deadline >= CURRENT_DATE`,
      [vacancy_id],
    );

    if (jobResult.rows.length === 0) {
      return res.status(404).json({
        error: { message: "Job not found or deadline has passed", status: 404 },
      });
    }

    const job = jobResult.rows[0];

    // Check already applied
    const existingApp = await pool.query(
      "SELECT * FROM applications WHERE user_id = $1 AND vacancy_id = $2",
      [user_id, vacancy_id],
    );

    if (existingApp.rows.length > 0) {
      return res.status(409).json({
        error: { message: "Already applied for this job", status: 409 },
      });
    }

    // Get user CV
    const cvResult = await pool.query(
      "SELECT * FROM cvs WHERE user_id = $1 ORDER BY uploaded_at DESC LIMIT 1",
      [user_id],
    );

    if (cvResult.rows.length === 0) {
      return res.status(400).json({
        error: {
          message: "Please upload your CV before applying",
          status: 400,
        },
      });
    }

    const cv = cvResult.rows[0];

    // Save application
    await pool.query(
      "INSERT INTO applications (user_id, vacancy_id) VALUES ($1, $2)",
      [user_id, vacancy_id],
    );

    // Trigger NLP matching
    const pythonServiceUrl =
      process.env.PYTHON_SERVICE_URL || "http://localhost:8000";

    const matchResponse = await axios.post(`${pythonServiceUrl}/api/match`, {
      cv_text: cv.extracted_text,
      skills: cv.skill_entities,
      job_description: job.description,
      required_skills: job.required_skills || [],
    });

    const matchResult = matchResponse.data;
    const orgThreshold = job.eligibility_threshold ?? 0.65;
    const isEligible = matchResult.final_score >= orgThreshold;

    // Save match result
    const savedMatch = await pool.query(
      `INSERT INTO match_results 
      (user_id, vacancy_id, cosine_score, composite_score, missing_skills, is_eligible)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (user_id, vacancy_id) 
      DO UPDATE SET 
        cosine_score = EXCLUDED.cosine_score,
        composite_score = EXCLUDED.composite_score,   
        missing_skills = EXCLUDED.missing_skills,
        is_eligible = EXCLUDED.is_eligible
      RETURNING match_id`,
      [
        user_id,
        vacancy_id,
        matchResult.cosine_similarity,
        matchResult.final_score,
        matchResult.missing_skills,
        isEligible,
      ],
    );

    // Send email if eligible
    if (isEligible) {
      try {
        const userResult = await pool.query(
          "SELECT name, email FROM users WHERE user_id = $1",
          [user_id],
        );
        const user = userResult.rows[0];
        if (user) {
          await sendMatchNotification(
            user.email,
            user.name,
            job.title,
            job.company_name,
            matchResult.final_score,
            matchResult.missing_skills,
          );
          await pool.query(
            `INSERT INTO notifications (match_id, recipient_email, status, sent_at)
             VALUES ($1, $2, 'sent', NOW())`,
            [savedMatch.rows[0].match_id, user.email],
          );
        }
      } catch (emailError) {
        console.error("Email error:", emailError);
      }
    }

    res.status(201).json({
      message: "Application submitted successfully",
      match_score: Math.round(matchResult.final_score * 100),
      is_eligible: matchResult.is_eligible,
      missing_skills: matchResult.missing_skills,
    });
  } catch (error) {
    console.error("Application error:", error);
    res.status(500).json({
      error: { message: "Error submitting application", status: 500 },
    });
  }
});

// DELETE /api/applications/:vacancy_id — Cancel application within 24hrs
router.delete("/:vacancy_id", auth, async (req, res) => {
  try {
    const { id: user_id } = req.user;
    const { vacancy_id } = req.params;

    // Check application exists and within 24 hours
    const appResult = await pool.query(
      `SELECT * FROM applications 
       WHERE user_id = $1 AND vacancy_id = $2
       AND applied_at > NOW() - INTERVAL '24 hours'`,
      [user_id, vacancy_id],
    );

    if (appResult.rows.length === 0) {
      return res.status(400).json({
        error: {
          message:
            "Application not found or cancellation window has passed (24 hours)",
          status: 400,
        },
      });
    }

    // Delete application and match result
    await pool.query(
      "DELETE FROM applications WHERE user_id = $1 AND vacancy_id = $2",
      [user_id, vacancy_id],
    );

    await pool.query(
      "DELETE FROM match_results WHERE user_id = $1 AND vacancy_id = $2",
      [user_id, vacancy_id],
    );

    res.json({ message: "Application cancelled successfully" });
  } catch (error) {
    console.error("Cancel application error:", error);
    res.status(500).json({
      error: { message: "Error cancelling application", status: 500 },
    });
  }
});

// GET /api/applications/my — Get user's applications
router.get("/my", auth, async (req, res) => {
  try {
    const { id: user_id } = req.user;

    const result = await pool.query(
      `SELECT a.*, j.title, j.description, j.required_skills, 
              j.experience_level, j.employment_type, j.deadline, j.category,
              o.company_name,
              m.composite_score, m.missing_skills, m.is_eligible,m.status, 
              a.applied_at,
              CASE WHEN a.applied_at > NOW() - INTERVAL '24 hours' 
                   THEN true ELSE false END as can_cancel
       FROM applications a
       JOIN job_vacancies j ON a.vacancy_id = j.vacancy_id
       JOIN organisations o ON j.org_id = o.org_id
       LEFT JOIN match_results m ON m.user_id = a.user_id AND m.vacancy_id = a.vacancy_id
       WHERE a.user_id = $1
       ORDER BY a.applied_at DESC`,
      [user_id],
    );

    res.json({ applications: result.rows });
  } catch (error) {
    console.error("Error fetching applications:", error);
    res.status(500).json({
      error: { message: "Error fetching applications", status: 500 },
    });
  }
});

module.exports = router;
