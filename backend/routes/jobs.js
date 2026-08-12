const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const auth = require("../middleware/auth");
const pool = require("../config/database");
const axios = require("axios");
const { sendMatchNotification } = require("../utils/emailService");
const { buildDashboardStats } = require("../utils/dashboardStats");
const {
  normalizePositionsAvailable,
  validateDeadline,
  ensureJobVacanciesPositionsColumn,
} = require("../utils/jobPosting");
const {
  normaliseCategory,
  isRecommended,
  scoreJob,
} = require("../utils/jobRanking");
const { matchQuality } = require("../utils/matchQuality");

// POST /api/jobs
router.post("/", auth, async (req, res) => {
  try {
    const { id: org_id, user_type } = req.user;

    if (user_type !== "organisation") {
      return res.status(403).json({
        error: {
          message: "Only organisations can post jobs",
          status: 403,
        },
      });
    }

    const {
      title,
      description,
      experience_level,
      employment_type,
      deadline,
      category,
      positions_available,
    } = req.body;

    await ensureJobVacanciesPositionsColumn(pool);

    const normalizedPositions =
      normalizePositionsAvailable(positions_available);

    if (!title || !description) {
      return res.status(400).json({
        error: {
          message: "Title and description are required",
          status: 400,
        },
      });
    }

    const deadlineCheck = validateDeadline(deadline);
    if (!deadlineCheck.ok) {
      return res.status(400).json({
        error: { message: deadlineCheck.message, status: 400 },
      });
    }
    const normalizedDeadline = deadlineCheck.value;

    const pythonServiceUrl =
      process.env.PYTHON_SERVICE_URL || "http://localhost:8000";
    const response = await axios.post(`${pythonServiceUrl}/api/parse/job`, {
      title,
      company_name: req.user.name,
      description,
    });

    const parsedData = response.data;

    const query = `
      INSERT INTO job_vacancies (org_id, title, description, required_skills, experience_level, employment_type, category, deadline, positions_available)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING vacancy_id, org_id, title, description, required_skills, experience_level, employment_type, category, deadline, positions_available, created_at
    `;

    const result = await pool.query(query, [
      org_id,
      title,
      description,
      parsedData.required_skills,
      experience_level || parsedData.experience_level,
      employment_type,
      category,
      normalizedDeadline,
      normalizedPositions,
    ]);

    const job = result.rows[0];

    const [orgVacanciesResult, globalVacanciesResult] = await Promise.all([
      pool.query(
        "SELECT COALESCE(SUM(COALESCE(positions_available, 1))::int, 0) AS org_vacancies FROM job_vacancies WHERE org_id = $1 AND deadline >= CURRENT_DATE",
        [org_id],
      ),
      pool.query(
        "SELECT COALESCE(SUM(COALESCE(positions_available, 1))::int, 0) AS total_vacancies FROM job_vacancies WHERE deadline >= CURRENT_DATE",
      ),
    ]);

    res.status(201).json({
      message: "Job posted successfully",
      job: {
        vacancy_id: job.vacancy_id,
        org_id: job.org_id,
        title: job.title,
        description: job.description,
        required_skills: parsedData.required_skills,
        experience_level: job.experience_level,
        employment_type: job.employment_type,
        category: job.category,
        deadline: job.deadline,
        positions_available: job.positions_available || 1,
        created_at: job.created_at,
      },
      org_vacancies: Number(orgVacanciesResult.rows[0].org_vacancies || 0),
      total_vacancies: Number(
        globalVacanciesResult.rows[0].total_vacancies || 0,
      ),
    });
  } catch (error) {
    console.error("Job posting error:", error);
    res.status(500).json({
      error: {
        message: "Error posting job",
        status: 500,
      },
    });
  }
});

// GET /api/jobs
router.get("/", async (req, res) => {
  try {
    const { category, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT j.*, o.company_name 
      FROM job_vacancies j
      JOIN organisations o ON j.org_id = o.org_id
      WHERE j.deadline >= CURRENT_DATE
    `;
    let countQuery = `
      SELECT COUNT(*) 
      FROM job_vacancies j
      WHERE j.deadline >= CURRENT_DATE
    `;

    const params = [];
    const countParams = [];

    if (category && category !== "All") {
      params.push(category);
      countParams.push(category);
      query += ` AND j.category = $${params.length}`;
      countQuery += ` AND j.category = $${countParams.length}`;
    }

    query += ` ORDER BY j.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    const countResult = await pool.query(countQuery, countParams);
    const totalCount = parseInt(countResult.rows[0].count);

    const jobs = result.rows.map((job) => ({
      vacancy_id: job.vacancy_id,
      org_id: job.org_id,
      company_name: job.company_name,
      title: job.title,
      description: job.description,
      required_skills: job.required_skills || [],
      experience_level: job.experience_level,
      employment_type: job.employment_type,
      deadline: job.deadline,
      category: job.category,
      positions_available: job.positions_available || 1,
      created_at: job.created_at,
    }));

    res.json({
      jobs,
      count: jobs.length,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: parseInt(page),
    });
  } catch (error) {
    console.error("Error fetching jobs:", error);
    res.status(500).json({
      error: { message: "Error fetching jobs", status: 500 },
    });
  }
});

router.get("/stats", async (req, res) => {
  try {
    const authHeader = req.header("Authorization");
    const token = authHeader?.replace("Bearer ", "");
    let user = null;

    if (token) {
      try {
        user = jwt.verify(token, process.env.JWT_SECRET);
      } catch (error) {
        if (error.name !== "TokenExpiredError") {
          console.warn("Invalid dashboard stats token:", error.message);
        }
      }
    }

    const isOrgScope = req.query.scope === "org" || req.query.org === "true";

    if (isOrgScope && user?.user_type === "organisation") {
      const [
        postedJobsResult,
        openVacanciesResult,
        applicationsResult,
        totalVacanciesResult,
      ] = await Promise.all([
        pool.query(
          "SELECT COUNT(*)::int AS posted_jobs FROM job_vacancies WHERE org_id = $1 AND deadline >= CURRENT_DATE",
          [user.id],
        ),
        pool.query(
          "SELECT COALESCE(SUM(COALESCE(positions_available, 1))::int, 0) AS open_vacancies FROM job_vacancies WHERE org_id = $1 AND deadline >= CURRENT_DATE",
          [user.id],
        ),
        // Only count applications against currently-live postings so this
        // number can never read non-zero while posted_jobs/open_vacancies
        // read zero. Previously this had no deadline filter, so it kept
        // counting applications to jobs whose deadline had already passed.
        pool.query(
          `SELECT COUNT(*)::int AS total_applications
             FROM applications a
             JOIN job_vacancies j ON a.vacancy_id = j.vacancy_id
             WHERE j.org_id = $1 AND j.deadline >= CURRENT_DATE`,
          [user.id],
        ),
        pool.query(
          "SELECT COUNT(*)::int AS total_vacancies FROM job_vacancies WHERE deadline >= CURRENT_DATE",
        ),
      ]);

      const stats = buildDashboardStats({
        orgPostedJobs: Number(postedJobsResult.rows[0].posted_jobs || 0),
        orgOpenVacancies: Number(
          openVacanciesResult.rows[0].open_vacancies || 0,
        ),
        orgApplications: Number(
          applicationsResult.rows[0].total_applications || 0,
        ),
        isOrganisation: true,
      });

      stats.total_vacancies = Number(
        totalVacanciesResult.rows[0].total_vacancies || 0,
      );

      return res.json(stats);
    }

    const jobsResult = await pool.query(
      "SELECT COUNT(*)::int AS live_jobs, COALESCE(SUM(COALESCE(positions_available, 1))::int, 0) AS open_vacancies FROM job_vacancies WHERE deadline >= CURRENT_DATE",
    );
    const organisationsResult = await pool.query(
      "SELECT COUNT(*)::int AS organisation_count FROM organisations",
    );

    const stats = buildDashboardStats({
      globalLiveJobs: Number(jobsResult.rows[0].live_jobs || 0),
      globalVacancies: Number(jobsResult.rows[0].open_vacancies || 0),
      organisationCount: Number(
        organisationsResult.rows[0].organisation_count || 0,
      ),
    });

    res.json(stats);
  } catch (error) {
    console.error("Error fetching job stats:", error);
    res.status(500).json({
      error: { message: "Error fetching job stats", status: 500 },
    });
  }
});

router.get("/recommended/for-me", auth, async (req, res) => {
  try {
    const { id: user_id, user_type } = req.user;

    if (user_type !== "user") {
      return res.status(403).json({
        error: {
          message: "Only job seekers can view recommended jobs",
          status: 403,
        },
      });
    }

    // Get candidate's latest CV skills and predicted category
    const cvResult = await pool.query(
      "SELECT skill_entities, predicted_category FROM cvs WHERE user_id = $1 ORDER BY uploaded_at DESC LIMIT 1",
      [user_id],
    );

    if (cvResult.rows.length === 0) {
      return res.json({
        jobs: [],
        count: 0,
        message: "Upload a CV to get recommendations",
      });
    }

    const candidateSkills = (cvResult.rows[0].skill_entities || []).map((s) =>
      s.toLowerCase(),
    );
    const candidateCategory = cvResult.rows[0].predicted_category;

    // The predicted category is used to RANK, not to filter.
    //
    // BERT decides this category, and its recall is far from perfect: measured
    // on the test split it is 0.56 for React Developer and 0.69 for Management
    // (see nlp-service/BERT_REPORT.md). Filtering on it meant ~44% of React
    // developers were shown no React jobs at all — not ranked low, absent.
    // Ranking keeps the signal without letting one wrong prediction hide
    // everything relevant.
    const query = `
      SELECT j.*, o.company_name
      FROM job_vacancies j
      JOIN organisations o ON j.org_id = o.org_id
      WHERE j.deadline >= CURRENT_DATE
      AND j.vacancy_id NOT IN (
        SELECT vacancy_id FROM applications WHERE user_id = $1
      )
      ORDER BY j.created_at DESC
    `;
    const jobsResult = await pool.query(query, [user_id]);

    const candidateCategoryKey = normaliseCategory(candidateCategory);

    const scoredJobs = jobsResult.rows.map((job) => {
      const { overlap, categoryMatch, rankScore } = scoreJob(
        job,
        candidateSkills,
        candidateCategoryKey,
      );

      return {
        vacancy_id: job.vacancy_id,
        org_id: job.org_id,
        company_name: job.company_name,
        title: job.title,
        description: job.description,
        required_skills: job.required_skills || [],
        experience_level: job.experience_level,
        employment_type: job.employment_type,
        deadline: job.deadline,
        category: job.category,
        positions_available: job.positions_available || 1,
        created_at: job.created_at,
        preview_score: overlap,
        category_match: categoryMatch,
        rank_score: rankScore,
      };
    });

    const recommended = scoredJobs
      .filter((job) => isRecommended(job.preview_score, job.category_match))
      .sort((a, b) => b.rank_score - a.rank_score)
      .slice(0, 20);

    res.json({
      jobs: recommended,
      count: recommended.length,
      candidate_category: candidateCategory,
    });
  } catch (error) {
    console.error("Error fetching recommended jobs:", error);
    res.status(500).json({
      error: { message: "Error fetching recommended jobs", status: 500 },
    });
  }
});

// GET /api/jobs/matched/for-me — Real NLP-scored jobs in candidate's category
router.get("/matched/for-me", auth, async (req, res) => {
  try {
    const { id: user_id, user_type } = req.user;

    if (user_type !== "user") {
      return res.status(403).json({
        error: {
          message: "Only job seekers can view matched jobs",
          status: 403,
        },
      });
    }

    const cvResult = await pool.query(
      "SELECT extracted_text, skill_entities, predicted_category FROM cvs WHERE user_id = $1 ORDER BY uploaded_at DESC LIMIT 1",
      [user_id],
    );

    if (cvResult.rows.length === 0) {
      return res.json({
        jobs: [],
        count: 0,
        message: "Upload a CV to see matched jobs",
      });
    }

    const cv = cvResult.rows[0];
    const candidateCategory = cv.predicted_category;

    // Same reasoning as /recommended: the category ranks, it does not filter.
    // A missing or wrong category no longer means an empty page — it just
    // removes one ranking signal.
    const allJobsResult = await pool.query(
      `SELECT j.*, o.company_name
       FROM job_vacancies j
       JOIN organisations o ON j.org_id = o.org_id
       WHERE j.deadline >= CURRENT_DATE
       AND j.vacancy_id NOT IN (
         SELECT vacancy_id FROM applications WHERE user_id = $1
       )
       ORDER BY j.created_at DESC`,
      [user_id],
    );

    // Every open vacancy is scored, not a shortlist.
    //
    // Scoring used to run one request per vacancy, which re-encoded the CV and
    // reclassified it every time, so only the ten best on a cheap pre-rank could
    // be afforded. That cheap rank does not agree with the full score — it has
    // no semantic similarity term — so a vacancy the full model would have
    // ranked highly could be dropped before it was ever scored.
    //
    // /api/match/bulk encodes the CV once and each description once, which is
    // fast enough to score everything and removes that failure mode. The cap
    // below is only a safety valve for an unexpectedly large board.
    const MAX_SCORED = 100;
    const candidateCategoryKey = normaliseCategory(candidateCategory);
    const candidateSkills = (cv.skill_entities || []).map((s) =>
      s.toLowerCase(),
    );

    let shortlist = allJobsResult.rows;
    if (shortlist.length > MAX_SCORED) {
      shortlist = shortlist
        .map((job) => ({
          job,
          rank: scoreJob(job, candidateSkills, candidateCategoryKey).rankScore,
        }))
        .sort((a, b) => b.rank - a.rank)
        .slice(0, MAX_SCORED)
        .map((entry) => entry.job);
    }

    const pythonServiceUrl =
      process.env.PYTHON_SERVICE_URL || "http://localhost:8000";
    let scoredJobs = [];

    try {
      // one request for the whole board; passing the stored category saves the
      // NLP service reclassifying a CV it has already classified
      const bulkResponse = await axios.post(
        `${pythonServiceUrl}/api/match/bulk`,
        {
          cv_text: cv.extracted_text,
          skills: cv.skill_entities,
          cv_category: candidateCategory || undefined,
          jobs: shortlist.map((job) => ({
            vacancy_id: job.vacancy_id,
            description: job.description,
            required_skills: job.required_skills || [],
          })),
        },
        { timeout: 120000 },
      );

      const byId = new Map(
        (bulkResponse.data.results || []).map((r) => [r.vacancy_id, r]),
      );

      scoredJobs = shortlist
        .filter((job) => byId.has(job.vacancy_id))
        .map((job) => {
          const m = byId.get(job.vacancy_id);
          return {
            vacancy_id: job.vacancy_id,
            org_id: job.org_id,
            company_name: job.company_name,
            title: job.title,
            description: job.description,
            required_skills: job.required_skills || [],
            experience_level: job.experience_level,
            employment_type: job.employment_type,
            deadline: job.deadline,
            category: job.category,
            created_at: job.created_at,
            match_score: m.final_score,
            // the list is ranked rather than filtered, so a weak match can
            // legitimately appear; label it rather than hiding it
            match_quality: matchQuality(m.final_score),
            missing_skills: m.missing_skills,
            is_eligible: m.is_eligible,
          };
        });
    } catch (matchError) {
      // The NLP service being down must not empty the page. Fall back to the
      // vacancies themselves, ordered by the cheap skill overlap, with no
      // score shown rather than a misleading one.
      console.error("Bulk match failed, returning unscored:", matchError.message);
      scoredJobs = shortlist
        .map((job) => ({
          job,
          rank: scoreJob(job, candidateSkills, candidateCategoryKey).rankScore,
        }))
        .sort((a, b) => b.rank - a.rank)
        .slice(0, 20)
        .map(({ job }) => ({
          vacancy_id: job.vacancy_id,
          org_id: job.org_id,
          company_name: job.company_name,
          title: job.title,
          description: job.description,
          required_skills: job.required_skills || [],
          experience_level: job.experience_level,
          employment_type: job.employment_type,
          deadline: job.deadline,
          category: job.category,
          created_at: job.created_at,
          match_score: undefined,
          match_quality: undefined,
          missing_skills: [],
          is_eligible: false,
        }));
    }

    scoredJobs.sort((a, b) => (b.match_score ?? -1) - (a.match_score ?? -1));

    res.json({
      jobs: scoredJobs,
      count: scoredJobs.length,
      candidate_category: candidateCategory,
    });
  } catch (error) {
    console.error("Error fetching matched jobs:", error);
    res.status(500).json({
      error: { message: "Error fetching matched jobs", status: 500 },
    });
  }
});

// GET /api/jobs/:id - fetch single job
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const query = `
      SELECT j.*, o.company_name
      FROM job_vacancies j
      JOIN organisations o ON j.org_id = o.org_id
      WHERE j.vacancy_id = $1
    `;

    const result = await pool.query(query, [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({
        error: { message: "Job not found", status: 404 },
      });
    }

    const job = result.rows[0];

    res.json({
      job: {
        vacancy_id: job.vacancy_id,
        org_id: job.org_id,
        company_name: job.company_name,
        title: job.title,
        description: job.description,
        required_skills: job.required_skills || [],
        experience_level: job.experience_level,
        employment_type: job.employment_type,
        deadline: job.deadline,
        category: job.category,
        positions_available: job.positions_available || 1,
        created_at: job.created_at,
      },
    });
  } catch (error) {
    console.error("Error fetching job:", error);
    res.status(500).json({
      error: { message: "Error fetching job", status: 500 },
    });
  }
});

// PUT /api/jobs/:id - update an existing job (organisation only)
router.put("/:id", auth, async (req, res) => {
  try {
    const { id: org_id, user_type } = req.user;
    if (user_type !== "organisation") {
      return res.status(403).json({
        error: { message: "Only organisations can edit jobs", status: 403 },
      });
    }

    const vacancy_id = req.params.id;

    // verify job exists and belongs to organisation
    const existing = await pool.query(
      `SELECT * FROM job_vacancies WHERE vacancy_id = $1`,
      [vacancy_id],
    );

    if (existing.rowCount === 0) {
      return res.status(404).json({
        error: { message: "Job not found", status: 404 },
      });
    }

    if (existing.rows[0].org_id !== org_id) {
      return res.status(403).json({
        error: { message: "Not allowed to edit this job", status: 403 },
      });
    }

    const {
      title,
      description,
      experience_level,
      employment_type,
      deadline,
      category,
      positions_available,
    } = req.body;

    await ensureJobVacanciesPositionsColumn(pool);

    const hasPositionsAvailable = Object.prototype.hasOwnProperty.call(
      req.body,
      "positions_available",
    );

    // If title or description changed (or provided), re-run parsing to get required_skills
    let parsedData = {};
    if (title || description) {
      const pythonServiceUrl =
        process.env.PYTHON_SERVICE_URL || "http://localhost:8000";
      try {
        const response = await axios.post(`${pythonServiceUrl}/api/parse/job`, {
          title: title || existing.rows[0].title,
          company_name: req.user.name,
          description: description || existing.rows[0].description,
        });
        parsedData = response.data || {};
      } catch (err) {
        // parsing failure shouldn't block update; log and continue
        console.warn(
          "Parsing service error during job update:",
          err.message || err,
        );
      }
    }

    const fields = [];
    const values = [];
    let idx = 1;

    if (title) {
      fields.push(`title = $${idx++}`);
      values.push(title);
    }
    if (description) {
      fields.push(`description = $${idx++}`);
      values.push(description);
    }
    if (experience_level) {
      fields.push(`experience_level = $${idx++}`);
      values.push(experience_level);
    }
    if (employment_type) {
      fields.push(`employment_type = $${idx++}`);
      values.push(employment_type);
    }
    if (deadline) {
      const editDeadlineCheck = validateDeadline(deadline);
      if (!editDeadlineCheck.ok) {
        return res.status(400).json({
          error: { message: editDeadlineCheck.message, status: 400 },
        });
      }
      fields.push(`deadline = $${idx++}`);
      values.push(editDeadlineCheck.value);
    }
    if (hasPositionsAvailable) {
      fields.push(`positions_available = $${idx++}`);
      values.push(normalizePositionsAvailable(positions_available));
    }
    if (category) {
      fields.push(`category = $${idx++}`);
      values.push(category);
    }
    if (parsedData.required_skills) {
      fields.push(`required_skills = $${idx++}`);
      values.push(parsedData.required_skills);
    }
    // if parser returned an experience level and none provided explicitly, update it
    if (parsedData.experience_level && !experience_level) {
      fields.push(`experience_level = $${idx++}`);
      values.push(parsedData.experience_level);
    }

    if (fields.length === 0) {
      return res.status(400).json({
        error: { message: "No updatable fields provided", status: 400 },
      });
    }

    const query = `UPDATE job_vacancies SET ${fields.join(", ")} WHERE vacancy_id = $${idx} RETURNING *`;
    values.push(vacancy_id);

    const result = await pool.query(query, values);
    if (result.rowCount === 0) {
      return res.status(404).json({
        error: { message: "Job not found", status: 404 },
      });
    }

    const job = result.rows[0];

    res.json({
      message: "Job updated successfully",
      job: {
        vacancy_id: job.vacancy_id,
        org_id: job.org_id,
        title: job.title,
        description: job.description,
        required_skills: job.required_skills || [],
        experience_level: job.experience_level,
        employment_type: job.employment_type,
        category: job.category,
        deadline: job.deadline,
        positions_available: job.positions_available || 1,
        created_at: job.created_at,
      },
    });
  } catch (error) {
    console.error("Error updating job:", error);
    res.status(500).json({
      error: { message: "Error updating job", status: 500 },
    });
  }
});

module.exports = router;
