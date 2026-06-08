const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const pool = require('../config/database');
const axios = require('axios');

// POST /api/jobs
router.post('/', auth, async (req, res) => {
  try {
    const { id: org_id, user_type } = req.user;

    // Only organisations can post jobs
    if (user_type !== 'organisation') {
      return res.status(403).json({
        error: {
          message: 'Only organisations can post jobs',
          status: 403
        }
      });
    }

    const { title, description, experience_level, employment_type, deadline } = req.body;

    // Validation
    if (!title || !description) {
      return res.status(400).json({
        error: {
          message: 'Title and description are required',
          status: 400
        }
      });
    }

    // Call Python microservice to parse job description
    const pythonServiceUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:5001';
    const response = await axios.post(`${pythonServiceUrl}/api/parse/job`, {
      title,
      company_name: req.user.name,
      description
    });

    const parsedData = response.data;

    // Save job vacancy to database
    const query = `
      INSERT INTO job_vacancies (org_id, title, description, required_skills, experience_level, employment_type, deadline, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      RETURNING vacancy_id, org_id, title, description, required_skills, experience_level, employment_type, deadline, created_at
    `;

    const result = await pool.query(query, [
      org_id,
      title,
      description,
      JSON.stringify(parsedData.required_skills),
      experience_level || parsedData.experience_level,
      employment_type,
      deadline
    ]);

    const job = result.rows[0];

    // Trigger matching with existing CVs
    const cvsQuery = 'SELECT * FROM cvs';
    const cvsResult = await pool.query(cvsQuery);
    const cvs = cvsResult.rows;

    for (const cv of cvs) {
      try {
        const matchResponse = await axios.post(`${pythonServiceUrl}/api/parse/job`, {
          cv_text: cv.extracted_text,
          skills: JSON.parse(cv.skill_entities),
          job_description: description,
          required_skills: parsedData.required_skills
        });

        const matchResult = matchResponse.data;

        // Save match result to database
        const matchQuery = `
          INSERT INTO match_results (user_id, vacancy_id, cosine_score, composite_score, missing_skills, is_eligible, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, NOW())
          RETURNING match_id
        `;

        await pool.query(matchQuery, [
          cv.user_id,
          job.vacancy_id,
          matchResult.cosine_similarity,
          matchResult.final_score,
          JSON.stringify(matchResult.skill_gap),
          matchResult.is_eligible
        ]);
      } catch (matchError) {
        console.error('Error matching CV:', matchError);
        // Continue with next CV even if matching fails
      }
    }

    res.status(201).json({
      message: 'Job posted successfully',
      job: {
        vacancy_id: job.vacancy_id,
        org_id: job.org_id,
        title: job.title,
        description: job.description,
        required_skills: parsedData.required_skills,
        experience_level: job.experience_level,
        employment_type: job.employment_type,
        deadline: job.deadline,
        created_at: job.created_at
      }
    });
  } catch (error) {
    console.error('Job posting error:', error);
    res.status(500).json({
      error: {
        message: 'Error posting job',
        status: 500
      }
    });
  }
});

// GET /api/jobs
router.get('/', async (req, res) => {
  try {
    const query = `
      SELECT j.*, o.company_name 
      FROM job_vacancies j
      JOIN organisations o ON j.org_id = o.org_id
      ORDER BY j.created_at DESC
    `;

    const result = await pool.query(query);
    const jobs = result.rows.map(job => ({
      vacancy_id: job.vacancy_id,
      org_id: job.org_id,
      company_name: job.company_name,
      title: job.title,
      description: job.description,
      required_skills: job.required_skills || [],
      experience_level: job.experience_level,
      employment_type: job.employment_type,
      deadline: job.deadline,
      created_at: job.created_at
    }));

    res.json({
      jobs,
      count: jobs.length
    });
  } catch (error) {
    console.error('Error fetching jobs:', error);
    res.status(500).json({
      error: {
        message: 'Error fetching jobs',
        status: 500
      }
    });
  }
});

module.exports = router;
