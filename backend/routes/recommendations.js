const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const pool = require("../config/database");
const axios = require("axios");
const {
  buildTipsCacheKey,
  serialiseTips,
  readCachedTips,
} = require("../utils/careerTipsCache");
const { buildFallbackTips } = require("../utils/careerTipsFallback");

// GET /api/recommendations/career-tips — AI-generated tips for logged in job seeker
router.get("/career-tips", auth, async (req, res) => {
  try {
    const { id: user_id, user_type } = req.user;

    if (user_type !== "user") {
      return res.status(403).json({
        error: { message: "Only job seekers have career tips", status: 403 },
      });
    }

    const cvResult = await pool.query(
      `SELECT cv_id, predicted_category, skill_entities, career_tips
       FROM cvs WHERE user_id = $1 ORDER BY uploaded_at DESC LIMIT 1`,
      [user_id],
    );

    if (cvResult.rows.length === 0) {
      return res.json({ top_matches: [], ai_tips: [] });
    }

    const cv = cvResult.rows[0];
    const category = cv.predicted_category || "General";
    const cvSkills = cv.skill_entities || [];

    const matchQuery = `
      SELECT mr.*, j.title, o.company_name 
      FROM match_results mr
      JOIN job_vacancies j ON mr.vacancy_id = j.vacancy_id
      JOIN organisations o ON j.org_id = o.org_id
      WHERE mr.user_id = $1 AND mr.is_eligible = true
      ORDER BY mr.composite_score DESC
      LIMIT 5
    `;
    const matchResult = await pool.query(matchQuery, [user_id]);
    const matches = matchResult.rows;

    const allMissingSkills = new Set();
    matches.forEach((match) => {
      (match.missing_skills || []).forEach((skill) =>
        allMissingSkills.add(skill),
      );
    });

    const topMatches = matches.map((match) => ({
      job_title: match.title,
      company: match.company_name,
      match_score: match.composite_score,
    }));

    const missingSkills = Array.from(allMissingSkills);

    // Generating tips costs several seconds of local LLM time, and the answer
    // only changes when these inputs change. Serve the stored copy whenever the
    // fingerprint still matches.
    const cacheKey = buildTipsCacheKey({
      category,
      cvSkills,
      missingSkills,
      topMatches,
    });

    const cachedTips = readCachedTips(cv.career_tips, cacheKey);
    if (cachedTips) {
      return res.json({
        top_matches: topMatches,
        ai_tips: cachedTips,
        cached: true,
      });
    }

    const pythonServiceUrl =
      process.env.PYTHON_SERVICE_URL || "http://localhost:8000";

    // The NLP service being unreachable must not cost the candidate their
    // guidance. Anything that goes wrong here falls back to tips built from
    // data we already hold, so this endpoint always answers with something
    // useful instead of an error the page has to render as "unavailable".
    let aiTips = null;
    let source = "fallback";

    try {
      const tipsResponse = await axios.post(
        `${pythonServiceUrl}/api/career-tips`,
        {
          category,
          cv_skills: cvSkills,
          missing_skills: missingSkills,
          top_matches: topMatches,
        },
        { timeout: 60000 },
      );

      if (Array.isArray(tipsResponse.data.ai_tips) && tipsResponse.data.ai_tips.length) {
        aiTips = tipsResponse.data.ai_tips;
        source = tipsResponse.data.source || "llm";
      }
    } catch (serviceError) {
      console.error(
        "Career tips service unavailable, using fallback:",
        serviceError.message,
      );
    }

    if (!aiTips) {
      aiTips = buildFallbackTips({
        category,
        cvSkills,
        missingSkills,
        topMatches,
      });
      source = "fallback";
    }

    // Only cache real LLM output. Caching a fallback would leave the candidate
    // looking at generic advice long after the model came back.
    if (source === "llm") {
      try {
        await pool.query(
          "UPDATE cvs SET career_tips = $1 WHERE cv_id = $2",
          [serialiseTips(cacheKey, aiTips), cv.cv_id],
        );
      } catch (cacheError) {
        // a failed cache write must not fail the request
        console.error("Could not cache career tips:", cacheError.message);
      }
    }

    res.json({
      top_matches: topMatches,
      ai_tips: aiTips,
      cached: false,
      source,
    });
  } catch (error) {
    console.error("Error generating career tips:", error);
    res.status(500).json({
      error: { message: "Error generating career tips", status: 500 },
    });
  }
});

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

    // Only export candidates who are eligible OR manually shortlisted
    const matchQuery = `
      SELECT mr.*, u.name, u.email, c.skill_entities
      FROM match_results mr
      JOIN users u ON mr.user_id = u.user_id
      LEFT JOIN cvs c ON c.user_id = mr.user_id
      WHERE mr.vacancy_id = $1
      AND (mr.is_eligible = true OR mr.status = 'shortlisted')
      ORDER BY mr.composite_score DESC
    `;

    const matchResult = await pool.query(matchQuery, [jobId]);
    const candidates = matchResult.rows;

    const csvHeaders = [
      "Name",
      "Email",
      "Match Score (%)",
      "Skills",
      "Missing Skills",
    ];
    const csvRows = candidates.map((candidate) => [
      candidate.name,
      candidate.email,
      Math.round((candidate.composite_score || 0) * 100),
      (candidate.skill_entities || []).join(", "),
      (candidate.missing_skills || []).join(", "),
    ]);

    const csvContent = [
      csvHeaders.join(","),
      ...csvRows.map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
      ),
    ].join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=eligible_candidates_${jobId}.csv`,
    );
    res.send(csvContent);
  } catch (error) {
    console.error("Error exporting candidates:", error);
    res.status(500).json({
      error: { message: "Error exporting candidates", status: 500 },
    });
  }
});

module.exports = router;
