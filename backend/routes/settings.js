const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const pool = require("../config/database");

// GET /api/settings — Get organisation settings
router.get("/", auth, async (req, res) => {
  try {
    const { id: org_id, user_type } = req.user;

    if (user_type !== "organisation") {
      return res.status(403).json({
        error: { message: "Only organisations have settings", status: 403 },
      });
    }

    const result = await pool.query(
      "SELECT eligibility_threshold FROM organisations WHERE org_id = $1",
      [org_id],
    );

    res.json({
      eligibility_threshold: result.rows[0]?.eligibility_threshold ?? 0.65,
    });
  } catch (error) {
    console.error("Error fetching settings:", error);
    res.status(500).json({
      error: { message: "Error fetching settings", status: 500 },
    });
  }
});

// PUT /api/settings — Update organisation settings
router.put("/", auth, async (req, res) => {
  try {
    const { id: org_id, user_type } = req.user;

    if (user_type !== "organisation") {
      return res.status(403).json({
        error: { message: "Only organisations have settings", status: 403 },
      });
    }

    const { eligibility_threshold } = req.body;

    if (
      eligibility_threshold === undefined ||
      eligibility_threshold < 0 ||
      eligibility_threshold > 1
    ) {
      return res.status(400).json({
        error: { message: "Threshold must be between 0 and 1", status: 400 },
      });
    }

    const result = await pool.query(
      `UPDATE organisations 
       SET eligibility_threshold = $1 
       WHERE org_id = $2
       RETURNING eligibility_threshold`,
      [eligibility_threshold, org_id],
    );

    // Recalculate is_eligible for all existing match_results under this org's jobs
    const recalcResult = await pool.query(
      `UPDATE match_results mr
       SET is_eligible = (mr.composite_score >= $1)
       FROM job_vacancies j
       WHERE mr.vacancy_id = j.vacancy_id
       AND j.org_id = $2
       RETURNING mr.match_id, mr.is_eligible`,
      [eligibility_threshold, org_id],
    );

    res.json({
      message: "Settings updated successfully",
      eligibility_threshold: result.rows[0].eligibility_threshold,
      recalculated_matches: recalcResult.rows.length,
    });
  } catch (error) {
    console.error("Error updating settings:", error);
    res.status(500).json({
      error: { message: "Error updating settings", status: 500 },
    });
  }
});

module.exports = router;
