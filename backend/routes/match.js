const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const pool = require("../config/database");
const axios = require("axios");
const {
  sendMatchNotification,
  sendShortlistNotification,
} = require("../utils/emailService");

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
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    if (user_type !== "organisation") {
      return res.status(403).json({
        error: {
          message: "Only organisations can view candidates",
          status: 403,
        },
      });
    }

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

    const countQuery = `
      SELECT COUNT(*) FROM match_results mr
      JOIN applications a ON a.user_id = mr.user_id AND a.vacancy_id = mr.vacancy_id
      WHERE mr.vacancy_id = $1
    `;
    const countResult = await pool.query(countQuery, [jobId]);
    const totalCount = parseInt(countResult.rows[0].count);

    const matchQuery = `
      SELECT mr.*, u.name, u.email, a.applied_at 
      FROM match_results mr
      JOIN users u ON mr.user_id = u.user_id
      JOIN applications a ON a.user_id = mr.user_id AND a.vacancy_id = mr.vacancy_id
      WHERE mr.vacancy_id = $1
      ORDER BY 
        CASE mr.status 
          WHEN 'shortlisted' THEN 1 
          WHEN 'applied' THEN 2 
          WHEN 'rejected' THEN 3 
        END,
        mr.composite_score DESC
      LIMIT $2 OFFSET $3
    `;

    const matchResult = await pool.query(matchQuery, [jobId, limit, offset]);
    const candidates = matchResult.rows.map((match) => ({
      match_id: match.match_id,
      user_id: match.user_id,
      name: match.name,
      email: match.email,
      cosine_score: match.cosine_score,
      composite_score: match.composite_score,
      missing_skills: match.missing_skills || [],
      is_eligible: match.is_eligible,
      status: match.status || "applied",
      applied_at: match.applied_at,
      created_at: match.created_at,
    }));

    res.json({
      job_id: jobId,
      candidates,
      count: candidates.length,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: parseInt(page),
    });
  } catch (error) {
    console.error("Error fetching candidates:", error);
    res.status(500).json({
      error: { message: "Error fetching candidates", status: 500 },
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

// GET /api/match/candidates/:match_id/explanation
// Plain-language reason for a match score, for the hiring team. Generated on
// demand rather than with the candidate list, because it costs a second or two
// per candidate and most rows are never expanded.
router.get("/candidates/:match_id/explanation", auth, async (req, res) => {
  try {
    const { id: org_id, user_type } = req.user;
    const { match_id } = req.params;

    if (user_type !== "organisation") {
      return res.status(403).json({
        error: {
          message: "Only organisations can view match explanations",
          status: 403,
        },
      });
    }

    // the job must belong to this organisation
    const detailsQuery = `
      SELECT mr.composite_score, mr.missing_skills,
             j.title, j.required_skills,
             c.skill_entities
      FROM match_results mr
      JOIN job_vacancies j ON mr.vacancy_id = j.vacancy_id
      LEFT JOIN cvs c ON c.user_id = mr.user_id
      WHERE mr.match_id = $1 AND j.org_id = $2
    `;
    const result = await pool.query(detailsQuery, [match_id, org_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: { message: "Match not found or access denied", status: 404 },
      });
    }

    const row = result.rows[0];
    const requiredSkills = (row.required_skills || []).map((s) =>
      String(s).toLowerCase(),
    );
    const candidateSkills = new Set(
      (row.skill_entities || []).map((s) => String(s).toLowerCase()),
    );
    const matchedSkills = requiredSkills.filter((s) => candidateSkills.has(s));

    const pythonServiceUrl =
      process.env.PYTHON_SERVICE_URL || "http://localhost:8000";
    const response = await axios.post(`${pythonServiceUrl}/api/explain-match`, {
      job_title: row.title,
      score: row.composite_score || 0,
      matched_skills: matchedSkills,
      missing_skills: row.missing_skills || [],
    });

    res.json({
      explanation: response.data.explanation,
      source: response.data.source,
    });
  } catch (error) {
    console.error("Error explaining match:", error.message);
    res.status(500).json({
      error: { message: "Error generating explanation", status: 500 },
    });
  }
});

// PATCH /api/match/candidates/:match_id/status
router.patch("/candidates/:match_id/status", auth, async (req, res) => {
  try {
    const { id: org_id, user_type } = req.user;
    const { match_id } = req.params;
    const { status } = req.body;

    if (user_type !== "organisation") {
      return res.status(403).json({
        error: {
          message: "Only organisations can update candidate status",
          status: 403,
        },
      });
    }

    if (!["shortlisted", "rejected", "applied"].includes(status)) {
      return res.status(400).json({
        error: { message: "Invalid status value", status: 400 },
      });
    }

    // Verify this match belongs to a job owned by this organisation
    const verifyQuery = `
      SELECT mr.match_id, mr.status AS previous_status
      FROM match_results mr
      JOIN job_vacancies jv ON mr.vacancy_id = jv.vacancy_id
      WHERE mr.match_id = $1 AND jv.org_id = $2
    `;
    const verifyResult = await pool.query(verifyQuery, [match_id, org_id]);

    if (verifyResult.rows.length === 0) {
      return res.status(404).json({
        error: { message: "Candidate not found or access denied", status: 404 },
      });
    }

    const result = await pool.query(
      `UPDATE match_results SET status = $1 WHERE match_id = $2 RETURNING *`,
      [status, match_id],
    );

    const match = result.rows[0];

    // Only notify on the transition into "shortlisted". Without this check,
    // shortlisting an already-shortlisted candidate — which "Shortlist all
    // eligible" does on every press — emails them again and writes another
    // notifications row.
    const previousStatus = verifyResult.rows[0].previous_status;
    if (status === "shortlisted" && previousStatus !== "shortlisted") {
      try {
        const detailsQuery = `
      SELECT u.name, u.email, j.title, o.company_name
      FROM match_results mr
      JOIN users u ON mr.user_id = u.user_id
      JOIN job_vacancies j ON mr.vacancy_id = j.vacancy_id
      JOIN organisations o ON j.org_id = o.org_id
      WHERE mr.match_id = $1
    `;
        const detailsResult = await pool.query(detailsQuery, [match_id]);
        const details = detailsResult.rows[0];

        if (details) {
          await sendShortlistNotification(
            details.email,
            details.name,
            details.title,
            details.company_name,
          );

          await pool.query(
            `INSERT INTO notifications (match_id, recipient_email, status, sent_at)
            VALUES ($1, $2, 'sent', NOW())`,
            [match_id, details.email],
          );
        }
      } catch (emailError) {
        console.error("Shortlist email error:", emailError);
      }
    }

    res.json({
      message: `Candidate ${status} successfully`,
      match,
    });
  } catch (error) {
    console.error("Error updating candidate status:", error);
    res.status(500).json({
      error: { message: "Error updating candidate status", status: 500 },
    });
  }
});

module.exports = router;
