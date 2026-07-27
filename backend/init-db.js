const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function initializeDatabase() {
  try {
    console.log('Connecting to database...');
    await pool.connect();

    console.log('Creating tables...');

    // Create users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        user_id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        email_verified BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create organisations table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS organisations (
        org_id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
        company_name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        email_verified BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create cvs table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS cvs (
        cv_id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR(36) NOT NULL,
        file_path VARCHAR(500) NOT NULL,
        extracted_text TEXT,
        skill_entities TEXT,
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
      )
    `);

    // Create job_vacancies table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS job_vacancies (
        vacancy_id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id VARCHAR(36) NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        required_skills TEXT,
        experience_level VARCHAR(100),
        employment_type VARCHAR(100),
        deadline DATE,
        positions_available INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (org_id) REFERENCES organisations(org_id) ON DELETE CASCADE
      )
    `);

    await pool.query(`
      ALTER TABLE job_vacancies
      ADD COLUMN IF NOT EXISTS positions_available INTEGER NOT NULL DEFAULT 1
    `);

    // Create match_results table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS match_results (
        match_id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR(36) NOT NULL,
        vacancy_id VARCHAR(36) NOT NULL,
        cosine_score FLOAT,
        composite_score FLOAT,
        missing_skills TEXT,
        is_eligible BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
        FOREIGN KEY (vacancy_id) REFERENCES job_vacancies(vacancy_id) ON DELETE CASCADE
      )
    `);

    // Create recommendations table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS recommendations (
        recommendation_id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR(36) NOT NULL,
        vacancy_id VARCHAR(36),
        score FLOAT,
        reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
        FOREIGN KEY (vacancy_id) REFERENCES job_vacancies(vacancy_id) ON DELETE CASCADE
      )
    `);

    // Create notifications table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        notification_id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
        match_id VARCHAR(36),
        recipient_email VARCHAR(255),
        status VARCHAR(50),
        sent_at TIMESTAMP,
        FOREIGN KEY (match_id) REFERENCES match_results(match_id) ON DELETE CASCADE
      )
    `);

    // Create indexes for performance
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_organisations_email ON organisations(email)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_organisations_created_at ON organisations(created_at)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_cvs_user_id ON cvs(user_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_cvs_uploaded_at ON cvs(uploaded_at)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_job_vacancies_org_id ON job_vacancies(org_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_job_vacancies_created_at ON job_vacancies(created_at)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_match_results_user_id ON match_results(user_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_match_results_vacancy_id ON match_results(vacancy_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_match_results_is_eligible ON match_results(is_eligible)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_match_results_created_at ON match_results(created_at)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_recommendations_user_id ON recommendations(user_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_recommendations_created_at ON recommendations(created_at)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_notifications_match_id ON notifications(match_id)`);

    console.log('Database initialized successfully!');
  } catch (error) {
    console.error('Error initializing database:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

initializeDatabase();
