const pool = require("../backend/config/database");

// --- USERS --- 

// Get user by ID
const getUserById = async (user_id) => {
  const result = await pool.query(
    "SELECT user_id, name, email, email_verified, created_at FROM users WHERE user_id = $1",
    [user_id],
  );
  return result.rows[0];
};

// Get user by email
const getUserByEmail = async (email) => {
  const result = await pool.query("SELECT * FROM users WHERE email = $1", [
    email,
  ]);
  return result.rows[0];
};

// --- ORGANISATIONS ---

// Get organisation by ID
const getOrgById = async (org_id) => {
  const result = await pool.query(
    "SELECT org_id, company_name, email, industry, created_at FROM organisations WHERE org_id = $1",
    [org_id],
  );
  return result.rows[0];
};

// --- CVs ---

// Insert a new CV
const insertCV = async (user_id, file_path, extracted_text, skill_entities) => {
  const result = await pool.query(
    `INSERT INTO cvs (user_id, file_path, extracted_text, skill_entities)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [user_id, file_path, extracted_text, skill_entities],
  );
  return result.rows[0];
};

// Get all CVs for a user
const getUserCVs = async (user_id) => {
  const result = await pool.query(
    `SELECT cv_id, file_path, skill_entities, uploaded_at
     FROM cvs
     WHERE user_id = $1
     ORDER BY uploaded_at DESC`,
    [user_id],
  );
  return result.rows;
};

// Get latest CV for a user
const getLatestCV = async (user_id) => {
  const result = await pool.query(
    `SELECT * FROM cvs
     WHERE user_id = $1
     ORDER BY uploaded_at DESC
     LIMIT 1`,
    [user_id],
  );
  return result.rows[0];
};

// --- JOB VACANCIES ---

// Insert a new job vacancy
const insertJobVacancy = async (
  org_id,
  title,
  description,
  required_skills,
  experience_level,
  employment_type,
  deadline,
) => {
  const result = await pool.query(
    `INSERT INTO job_vacancies (org_id, title, description, required_skills, experience_level, employment_type, deadline)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      org_id,
      title,
      description,
      required_skills,
      experience_level,
      employment_type,
      deadline,
    ],
  );
  return result.rows[0];
};

// Get all job vacancies
const getAllJobs = async () => {
  const result = await pool.query(
    `SELECT j.*, o.company_name, o.industry
     FROM job_vacancies j
     JOIN organisations o ON j.org_id = o.org_id
     ORDER BY j.created_at DESC`,
  );
  return result.rows;
};

// Get jobs by organisation
const getJobsByOrg = async (org_id) => {
  const result = await pool.query(
    `SELECT * FROM job_vacancies
     WHERE org_id = $1
     ORDER BY created_at DESC`,
    [org_id],
  );
  return result.rows;
};

// --- MATCH RESULTS ---

// Insert match result
const insertMatchResult = async (
  user_id,
  vacancy_id,
  cosine_score,
  composite_score,
  missing_skills,
  is_eligible,
) => {
  const result = await pool.query(
    `INSERT INTO match_results (user_id, vacancy_id, cosine_score, composite_score, missing_skills, is_eligible)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      user_id,
      vacancy_id,
      cosine_score,
      composite_score,
      missing_skills,
      is_eligible,
    ],
  );
  return result.rows[0];
};

// Get match results for a user
const getMatchResultsByUser = async (user_id) => {
  const result = await pool.query(
    `SELECT m.*, j.title, j.employment_type, o.company_name
     FROM match_results m
     JOIN job_vacancies j ON m.vacancy_id = j.vacancy_id
     JOIN organisations o ON j.org_id = o.org_id
     WHERE m.user_id = $1
     ORDER BY m.composite_score DESC`,
    [user_id],
  );
  return result.rows;
};

// Get ranked candidates for a job vacancy
const getRankedCandidates = async (vacancy_id) => {
  const result = await pool.query(
    `SELECT m.*, u.name, u.email
     FROM match_results m
     JOIN users u ON m.user_id = u.user_id
     WHERE m.vacancy_id = $1
     ORDER BY m.composite_score DESC`,
    [vacancy_id],
  );
  return result.rows;
};

// --- RECOMMENDATIONS ---

// Insert recommendation
const insertRecommendation = async (user_id, skill_name) => {
  const result = await pool.query(
    `INSERT INTO recommendations (user_id, skill_name, gap_frequency)
     VALUES ($1, $2, 1)
     ON CONFLICT (user_id, skill_name)
     DO UPDATE SET gap_frequency = recommendations.gap_frequency + 1
     RETURNING *`,
    [user_id, skill_name],
  );
  return result.rows[0];
};

// Get recommendations for a user
const getRecommendationsByUser = async (user_id) => {
  const result = await pool.query(
    `SELECT skill_name, gap_frequency
     FROM recommendations
     WHERE user_id = $1
     ORDER BY gap_frequency DESC`,
    [user_id],
  );
  return result.rows;
};

// --- NOTIFICATIONS ---

// Insert notification
const insertNotification = async (match_id, recipient_email) => {
  const result = await pool.query(
    `INSERT INTO notifications (match_id, recipient_email, status)
     VALUES ($1, $2, 'pending')
     RETURNING *`,
    [match_id, recipient_email],
  );
  return result.rows[0];
};

// Mark notification as sent
const markNotificationSent = async (notif_id) => {
  const result = await pool.query(
    `UPDATE notifications
     SET status = 'sent', sent_at = NOW()
     WHERE notif_id = $1
     RETURNING *`,
    [notif_id],
  );
  return result.rows[0];
};

module.exports = {
  getUserById,
  getUserByEmail,
  getOrgById,
  insertCV,
  getUserCVs,
  getLatestCV,
  insertJobVacancy,
  getAllJobs,
  getJobsByOrg,
  insertMatchResult,
  getMatchResultsByUser,
  getRankedCandidates,
  insertRecommendation,
  getRecommendationsByUser,
  insertNotification,
  markNotificationSent,
};
