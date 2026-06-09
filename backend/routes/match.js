const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const pool = require("../config/database");
const axios = require("axios");

// POST /api/match/trigger
router.post("/trigger", auth, async (req, res) => {
  try {
    const { id: user_id, user_type } = req.user;

    // Only organisations can trigger matching
    if (user_type !== "organisation") {
      return res.status(403).json({
        error: {
          message: "Only organisations can trigger matching",
          status: 403,
        },
      });
    }

    const { vacancy_id } = req.body;

    if (!vacancy_id) {
      return res.status(400).json({
        error: {
          message: "Vacancy ID is required",
          status: 400,
        },
      });
    }

    // Get job vacancy
    const jobQuery = "SELECT * FROM job_vacancies WHERE vacancy_id = $1";
    const jobResult = await pool.query(jobQuery, [vacancy_id]);

    if (jobResult.rows.length === 0) {
      return res.status(404).json({
        error: {
          message: "Job vacancy not found",
          status: 404,
        },
      });
    }

    const job = jobResult.rows[0];

    // Get all CVs
    const cvsQuery = "SELECT * FROM cvs";
    const cvsResult = await pool.query(cvsQuery);
    const cvs = cvsResult.rows;

    const pythonServiceUrl =
      process.env.PYTHON_SERVICE_URL || "http://localhost:8000";
    let matchCount = 0;

    for (const cv of cvs) {
      try {
        const matchResponse = await axios.post(
          `${pythonServiceUrl}/api/match`,
          {
            cv_text: cv.extracted_text,
            skills: cv.skill_entities,
            job_description: job.description,
            required_skills: job.required_skills || [],
          },
        );

        const matchResult = matchResponse.data;

        // Check if match already exists
        const existingMatchQuery = `
          SELECT * FROM match_results 
          WHERE user_id = $1 AND vacancy_id = $2
        `;
        const existingMatch = await pool.query(existingMatchQuery, [
          cv.user_id,
          vacancy_id,
        ]);

        if (existingMatch.rows.length === 0) {
          // Insert new match result
          const matchQuery = `
            INSERT INTO match_results (user_id, vacancy_id, cosine_score, composite_score, missing_skills, is_eligible, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, NOW())
            RETURNING match_id
          `;

          await pool.query(matchQuery, [
            cv.user_id,
            vacancy_id,
            matchResult.cosine_similarity,
            matchResult.final_score,
            JSON.stringify(matchResult.skill_gap),
            matchResult.is_eligible,
          ]);
          matchCount++;
        }
      } catch (matchError) {
        console.error("Error matching CV:", matchError);
      }
    }

    res.json({
      message: "Matching completed",
      matches_created: matchCount,
    });
  } catch (error) {
    console.error("Match trigger error:", error);
    res.status(500).json({
      error: {
        message: "Error triggering matching",
        status: 500,
      },
    });
  }
});

// GET /api/candidates/:jobId
router.get("/candidates/:jobId", auth, async (req, res) => {
  try {
    const { id: user_id, user_type } = req.user;
    const { jobId } = req.params;

    // Only organisations can view candidates for their jobs
    if (user_type !== "organisation") {
      return res.status(403).json({
        error: {
          message: "Only organisations can view candidates",
          status: 403,
        },
      });
    }

    // Verify job belongs to the organisation
    const jobQuery =
      "SELECT * FROM job_vacancies WHERE vacancy_id = $1 AND org_id = $2";
    const jobResult = await pool.query(jobQuery, [jobId, user_id]);

    if (jobResult.rows.length === 0) {
      return res.status(404).json({
        error: {
          message: "Job vacancy not found or access denied",
          status: 404,
        },
      });
    }

    // Get match results for this job
    const matchQuery = `
      SELECT mr.*, u.name, u.email 
      FROM match_results mr
      JOIN users u ON mr.user_id = u.user_id
      WHERE mr.vacancy_id = $1
      ORDER BY mr.composite_score DESC
    `;

    const matchResult = await pool.query(matchQuery, [jobId]);
    const candidates = matchResult.rows.map((match) => ({
      match_id: match.match_id,
      user_id: match.user_id,
      name: match.name,
      email: match.email,
      cosine_score: match.cosine_score,
      composite_score: match.composite_score,
      missing_skills: match.missing_skills || [],
      is_eligible: match.is_eligible,
      created_at: match.created_at,
    }));

    res.json({
      job_id: jobId,
      candidates,
      count: candidates.length,
    });
  } catch (error) {
    console.error("Error fetching candidates:", error);
    res.status(500).json({
      error: {
        message: "Error fetching candidates",
        status: 500,
      },
    });
  }
});

// GET /api/match/user
router.get("/user", auth, async (req, res) => {
  try {
    const { id: user_id } = req.user;

    const result = await pool.query(
      `SELECT m.*, j.title, j.employment_type, o.company_name
       FROM match_results m
       JOIN job_vacancies j ON m.vacancy_id = j.vacancy_id
       JOIN organisations o ON j.org_id = o.org_id
       WHERE m.user_id = $1
       ORDER BY m.composite_score DESC`,
      [user_id],
    );

    res.json({
      matches: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    console.error("Error fetching matches:", error);
    res.status(500).json({
      error: {
        message: "Error fetching matches",
        status: 500,
      },
    });
  }
});

module.exports = router;
