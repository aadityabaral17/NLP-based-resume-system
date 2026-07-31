const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const pool = require("../config/database");

// The `organisations` table originally only had the columns needed for auth
// and job posting. These extra profile fields are added lazily (mirrors the
// ensureJobVacanciesPositionsColumn pattern already used in jobs.js) so no
// separate manual migration step is required.
let columnsEnsured = false;
async function ensureOrganisationProfileColumns(pool) {
  if (columnsEnsured) return;
  await pool.query(`
    ALTER TABLE organisations
      ADD COLUMN IF NOT EXISTS tagline TEXT,
      ADD COLUMN IF NOT EXISTS company_size VARCHAR(20),
      ADD COLUMN IF NOT EXISTS founded_year INTEGER,
      ADD COLUMN IF NOT EXISTS headquarters VARCHAR(255),
      ADD COLUMN IF NOT EXISTS about TEXT,
      ADD COLUMN IF NOT EXISTS contact_email VARCHAR(255)
  `);
  columnsEnsured = true;
}

const PROFILE_COLUMNS =
  "org_id, company_name, tagline, company_size, founded_year, headquarters, about, contact_email";

// GET /api/organisations/profile — the logged-in organisation's own profile.
// Registered before the "/:org_id" route below so "profile" is never treated
// as an org_id.
router.get("/profile", auth, async (req, res) => {
  try {
    const { id: org_id, user_type } = req.user;
    if (user_type !== "organisation") {
      return res.status(403).json({
        error: { message: "Only organisations can access this", status: 403 },
      });
    }

    await ensureOrganisationProfileColumns(pool);

    const result = await pool.query(
      `SELECT ${PROFILE_COLUMNS} FROM organisations WHERE org_id = $1`,
      [org_id],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        error: { message: "Organisation not found", status: 404 },
      });
    }

    res.json({ profile: result.rows[0] });
  } catch (error) {
    console.error("Error fetching organisation profile:", error);
    res.status(500).json({
      error: { message: "Error fetching organisation profile", status: 500 },
    });
  }
});

// PUT /api/organisations/profile — update the logged-in organisation's profile
router.put("/profile", auth, async (req, res) => {
  try {
    const { id: org_id, user_type } = req.user;
    if (user_type !== "organisation") {
      return res.status(403).json({
        error: { message: "Only organisations can update this", status: 403 },
      });
    }

    await ensureOrganisationProfileColumns(pool);

    const {
      company_name,
      tagline,
      company_size,
      founded_year,
      headquarters,
      about,
      contact_email,
    } = req.body;

    const query = `
      UPDATE organisations
      SET company_name = COALESCE(NULLIF($1, ''), company_name),
          tagline = $2,
          company_size = $3,
          founded_year = $4,
          headquarters = $5,
          about = $6,
          contact_email = $7
      WHERE org_id = $8
      RETURNING ${PROFILE_COLUMNS}
    `;

    const result = await pool.query(query, [
      company_name,
      tagline || null,
      company_size || null,
      founded_year ? parseInt(founded_year, 10) : null,
      headquarters || null,
      about || null,
      contact_email || null,
      org_id,
    ]);

    if (result.rowCount === 0) {
      return res.status(404).json({
        error: { message: "Organisation not found", status: 404 },
      });
    }

    res.json({
      message: "Profile updated successfully",
      profile: result.rows[0],
    });
  } catch (error) {
    console.error("Error updating organisation profile:", error);
    res.status(500).json({
      error: { message: "Error updating organisation profile", status: 500 },
    });
  }
});

// GET /api/organisations/:org_id — public profile, viewable by job seekers
// (and anyone else) before they apply. No auth required.
router.get("/:org_id", async (req, res) => {
  try {
    await ensureOrganisationProfileColumns(pool);
    const { org_id } = req.params;

    const result = await pool.query(
      `SELECT ${PROFILE_COLUMNS} FROM organisations WHERE org_id = $1`,
      [org_id],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        error: { message: "Organisation not found", status: 404 },
      });
    }

    const postingsResult = await pool.query(
      `SELECT COUNT(*)::int AS active_postings
       FROM job_vacancies
       WHERE org_id = $1 AND deadline >= CURRENT_DATE`,
      [org_id],
    );

    res.json({
      profile: result.rows[0],
      active_postings: Number(postingsResult.rows[0].active_postings || 0),
    });
  } catch (error) {
    console.error("Error fetching public organisation profile:", error);
    res.status(500).json({
      error: { message: "Error fetching organisation profile", status: 500 },
    });
  }
});

module.exports = router;
