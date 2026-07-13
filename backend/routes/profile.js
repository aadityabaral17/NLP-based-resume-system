const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const pool = require("../config/database");

// GET /api/profile — Get own profile
router.get("/", auth, async (req, res) => {
  try {
    const { id: user_id, user_type } = req.user;

    if (user_type !== "user") {
      return res.status(403).json({
        error: { message: "Only job seekers have profiles", status: 403 },
      });
    }

    const userResult = await pool.query(
      `SELECT user_id, name, email, phone, location, bio, 
              linkedin_url, github_url, portfolio_url, created_at
       FROM users WHERE user_id = $1`,
      [user_id],
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        error: { message: "User not found", status: 404 },
      });
    }

    const cvResult = await pool.query(
      `SELECT cv_id, file_path, extracted_text, skill_entities, uploaded_at
       FROM cvs WHERE user_id = $1
       ORDER BY uploaded_at DESC LIMIT 1`,
      [user_id],
    );

    res.json({
      profile: userResult.rows[0],
      cv: cvResult.rows[0] || null,
    });
  } catch (error) {
    console.error("Error fetching profile:", error);
    res.status(500).json({
      error: { message: "Error fetching profile", status: 500 },
    });
  }
});

// PUT /api/profile — Update own profile
router.put("/", auth, async (req, res) => {
  try {
    const { id: user_id, user_type } = req.user;

    if (user_type !== "user") {
      return res.status(403).json({
        error: { message: "Only job seekers have profiles", status: 403 },
      });
    }

    const { phone, location, bio, linkedin_url, github_url, portfolio_url } =
      req.body;

    const result = await pool.query(
      `UPDATE users 
       SET phone = $1, location = $2, bio = $3, 
           linkedin_url = $4, github_url = $5, portfolio_url = $6
       WHERE user_id = $7
       RETURNING user_id, name, email, phone, location, bio, 
                 linkedin_url, github_url, portfolio_url`,
      [phone, location, bio, linkedin_url, github_url, portfolio_url, user_id],
    );

    res.json({
      message: "Profile updated successfully",
      profile: result.rows[0],
    });
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({
      error: { message: "Error updating profile", status: 500 },
    });
  }
});

// GET /api/profile/:user_id — Organisation views a candidate's profile
router.get("/:user_id", auth, async (req, res) => {
  try {
    const { user_type, id: org_id } = req.user;
    const { user_id } = req.params;

    if (user_type !== "organisation") {
      return res.status(403).json({
        error: {
          message: "Only organisations can view candidate profiles",
          status: 403,
        },
      });
    }

    // Verify this candidate applied to one of this organisation's jobs
    const verifyResult = await pool.query(
      `SELECT a.application_id 
       FROM applications a
       JOIN job_vacancies j ON a.vacancy_id = j.vacancy_id
       WHERE a.user_id = $1 AND j.org_id = $2
       LIMIT 1`,
      [user_id, org_id],
    );

    if (verifyResult.rows.length === 0) {
      return res.status(403).json({
        error: {
          message: "This candidate has not applied to any of your jobs",
          status: 403,
        },
      });
    }

    const userResult = await pool.query(
      `SELECT user_id, name, email, phone, location, bio, 
              linkedin_url, github_url, portfolio_url, created_at
       FROM users WHERE user_id = $1`,
      [user_id],
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        error: { message: "User not found", status: 404 },
      });
    }

    const cvResult = await pool.query(
      `SELECT cv_id, extracted_text, skill_entities, uploaded_at
       FROM cvs WHERE user_id = $1
       ORDER BY uploaded_at DESC LIMIT 1`,
      [user_id],
    );

    res.json({
      profile: userResult.rows[0],
      cv: cvResult.rows[0] || null,
    });
  } catch (error) {
    console.error("Error fetching candidate profile:", error);
    res.status(500).json({
      error: { message: "Error fetching candidate profile", status: 500 },
    });
  }
});

module.exports = router;
