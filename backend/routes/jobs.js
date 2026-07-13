const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const pool = require("../config/database");
const axios = require("axios");
const { sendMatchNotification } = require("../utils/emailService");

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
    } = req.body;

    if (!title || !description) {
      return res.status(400).json({
        error: {
          message: "Title and description are required",
          status: 400,
        },
      });
    }

    const pythonServiceUrl =
      process.env.PYTHON_SERVICE_URL || "http://localhost:8000";
    const response = await axios.post(`${pythonServiceUrl}/api/parse/job`, {
      title,
      company_name: req.user.name,
      description,
    });

    const parsedData = response.data;

    const query = `
      INSERT INTO job_vacancies (org_id, title, description, required_skills, experience_level, employment_type, category, deadline)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING vacancy_id, org_id, title, description, required_skills, experience_level, employment_type, category, deadline, created_at
    `;

    const result = await pool.query(query, [
      org_id,
      title,
      description,
      parsedData.required_skills,
      experience_level || parsedData.experience_level,
      employment_type,
      category,
      deadline,
    ]);

    const job = result.rows[0];

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
        created_at: job.created_at,
      },
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

    // Build query — filter by predicted category first to reduce comparison scope
    let query = `
      SELECT j.*, o.company_name
      FROM job_vacancies j
      JOIN organisations o ON j.org_id = o.org_id
      WHERE j.deadline >= CURRENT_DATE
      AND j.vacancy_id NOT IN (
        SELECT vacancy_id FROM applications WHERE user_id = $1
      )
    `;
    const params = [user_id];

    if (candidateCategory) {
      params.push(candidateCategory);
      query += ` AND j.category = $${params.length}`;
    }

    query += ` ORDER BY j.created_at DESC`;

    const jobsResult = await pool.query(query, params);

    // Compute quick skill-overlap score for ranking within the category
    const scoredJobs = jobsResult.rows.map((job) => {
      const requiredSkills = (job.required_skills || []).map((s) =>
        s.toLowerCase(),
      );
      let overlapScore = 0;

      if (requiredSkills.length > 0) {
        const matched = requiredSkills.filter((s) =>
          candidateSkills.includes(s),
        );
        overlapScore = matched.length / requiredSkills.length;
      }

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
        preview_score: overlapScore,
      };
    });

    const recommended = scoredJobs
      .filter((job) => job.preview_score >= 0.6)
      .sort((a, b) => b.preview_score - a.preview_score)
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
    } = req.body;

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
      fields.push(`deadline = $${idx++}`);
      values.push(deadline);
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
