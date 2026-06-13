const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const pool = require("../config/database");

// GET /api/recommendations/:userid
router.get("/:userid", auth, async (req, res) => {
  try {
    const { id: user_id, user_type } = req.user;
    const { userid } = req.params;

    if (user_type !== "user" || user_id !== userid) {
      return res.status(403).json({
        error: {
          message: "Access denied",
          status: 403,
        },
      });
    }

    const matchQuery = `
      SELECT mr.*, j.title, j.description, o.company_name 
      FROM match_results mr
      JOIN job_vacancies j ON mr.vacancy_id = j.vacancy_id
      JOIN organisations o ON j.org_id = o.org_id
      WHERE mr.user_id = $1 AND mr.is_eligible = true
      ORDER BY mr.composite_score DESC
      LIMIT 10
    `;

    const matchResult = await pool.query(matchQuery, [userid]);
    const matches = matchResult.rows;

    // Generate career tips based on missing skills
    const allMissingSkills = new Set();
    matches.forEach((match) => {
      const skills = match.missing_skills || [];
      skills.forEach((skill) => allMissingSkills.add(skill));
    });

    const careerTips = [
      {
        category: "Skill Development",
        tips: Array.from(allMissingSkills)
          .slice(0, 5)
          .map(
            (skill) =>
              `Consider learning ${skill} to improve your job matching potential`,
          ),
      },
      {
        category: "Job Search Strategy",
        tips: [
          "Focus on roles where your current skills are a strong match",
          "Highlight your transferable skills in your CV",
          "Consider certifications for in-demand skills",
        ],
      },
      {
        category: "Career Growth",
        tips: [
          "Set realistic skill development goals",
          "Network with professionals in your target industry",
          "Stay updated with industry trends and requirements",
        ],
      },
    ];

    res.json({
      user_id: userid,
      recommendations: {
        top_matches: matches.map((match) => ({
          job_title: match.title,
          company: match.company_name,
          match_score: match.composite_score,
          missing_skills: match.missing_skills || [],
        })),
        career_tips: careerTips,
      },
    });
  } catch (error) {
    console.error("Error fetching recommendations:", error);
    res.status(500).json({
      error: {
        message: "Error fetching recommendations",
        status: 500,
      },
    });
  }
});

// GET /api/recommendations/export/:jobId
router.get("/export/:jobId", auth, async (req, res) => {
  try {
    const { id: user_id, user_type } = req.user;
    const { jobId } = req.params;

    if (user_type !== "organisation") {
      return res.status(403).json({
        error: {
          message: "Only organisations can export candidate lists",
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

    const matchQuery = `
      SELECT mr.*, u.name, u.email 
      FROM match_results mr
      JOIN users u ON mr.user_id = u.user_id
      WHERE mr.vacancy_id = $1 AND mr.is_eligible = true
      ORDER BY mr.composite_score DESC
    `;

    const matchResult = await pool.query(matchQuery, [jobId]);
    const candidates = matchResult.rows;

    const csvHeaders = [
      "Name",
      "Email",
      "Match Score",
      "Cosine Score",
      "Missing Skills",
      "Status",
    ];
    const csvRows = candidates.map((candidate) => [
      candidate.name,
      candidate.email,
      candidate.composite_score,
      candidate.cosine_score,
      (candidate.missing_skills || []).join(", "),
      candidate.is_eligible ? "Eligible" : "Not Eligible",
    ]);

    const csvContent = [
      csvHeaders.join(","),
      ...csvRows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=candidates_${jobId}.csv`,
    );
    res.send(csvContent);
  } catch (error) {
    console.error("Error exporting candidates:", error);
    res.status(500).json({
      error: {
        message: "Error exporting candidates",
        status: 500,
      },
    });
  }
});

module.exports = router;
