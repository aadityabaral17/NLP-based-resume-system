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
        skill_entities TEXT[],
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
        required_skills TEXT[],
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
        missing_skills TEXT[],
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

    // Create otp_verifications table
    // Used by utils/otpService.js for email verification and password resets.
    // It was never created here, so signup verification failed on a fresh
    // database with "relation otp_verifications does not exist".
    await pool.query(`
      CREATE TABLE IF NOT EXISTS otp_verifications (
        otp_id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) NOT NULL,
        otp VARCHAR(10) NOT NULL,
        purpose VARCHAR(20) NOT NULL DEFAULT 'verify',
        verified BOOLEAN DEFAULT FALSE,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 'verify' (signup) and 'reset' (forgotten password) codes must not be
    // interchangeable — otherwise a signup code could be used to take over an
    // existing account's password.
    await pool.query(`
      ALTER TABLE otp_verifications
      ADD COLUMN IF NOT EXISTS purpose VARCHAR(20) NOT NULL DEFAULT 'verify'
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_otp_email_purpose
      ON otp_verifications(email, purpose)
    `);

    // Create applications table
    // The whole apply/match flow depends on this table, but it was never
    // created here — a fresh database would fail on the first application.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS applications (
        application_id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR(36) NOT NULL,
        vacancy_id VARCHAR(36) NOT NULL,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
        FOREIGN KEY (vacancy_id) REFERENCES job_vacancies(vacancy_id) ON DELETE CASCADE
      )
    `);

    // Unique indexes required by the ON CONFLICT clauses in the route code.
    // Creating one fails if the table already holds duplicates, so report the
    // problem and carry on rather than aborting the whole migration — deciding
    // which of someone's rows to delete is not this script's call.
    async function createUniqueIndex(indexName, table, columns, usedBy) {
      try {
        await pool.query(`
          CREATE UNIQUE INDEX IF NOT EXISTS ${indexName}
          ON ${table}(${columns.join(', ')})
        `);
      } catch (indexError) {
        console.warn(
          `\nWARNING: could not create unique index on ${table}(${columns.join(', ')}).`,
          `\nThis means the table already contains duplicate rows.`,
          `\n${usedBy} will fail until they are resolved.`,
          `\nInspect them with:`,
          `\n  SELECT ${columns.join(', ')}, COUNT(*) FROM ${table}`,
          `GROUP BY ${columns.join(', ')} HAVING COUNT(*) > 1;`,
          `\nReason: ${indexError.message}\n`
        );
      }
    }

    // ─── Columns added after the original schema was written ───────────
    // Each one is used by the route code but was missing from the CREATE
    // statements above, so a fresh database did not match the application.

    console.log('Applying column migrations...');

    // These three columns hold lists. The route code calls .map() on them, so
    // they must be TEXT[] — node-postgres hands back a plain string for a TEXT
    // column and .map() is not a function on a string. Older databases were
    // created with TEXT, so convert them in place where needed.
    for (const [table, column] of [
      ['cvs', 'skill_entities'],
      ['job_vacancies', 'required_skills'],
      ['match_results', 'missing_skills'],
    ]) {
      const { rows } = await pool.query(
        `SELECT data_type FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
        [table, column]
      );

      if (rows.length === 0 || rows[0].data_type === 'ARRAY') continue;

      console.log(`  converting ${table}.${column} from TEXT to TEXT[]...`);
      try {
        await pool.query(`
          ALTER TABLE ${table}
          ALTER COLUMN ${column} TYPE TEXT[]
          USING CASE
            WHEN ${column} IS NULL OR ${column} = '' THEN '{}'::TEXT[]
            WHEN ${column} LIKE '{%}' THEN ${column}::TEXT[]
            ELSE string_to_array(${column}, ',')
          END
        `);
      } catch (convertError) {
        console.warn(
          `  WARNING: could not convert ${table}.${column} to TEXT[]:`,
          convertError.message,
          `\n  Reading this column in the app will fail until it is fixed.`
        );
      }
    }

    // users: the job seeker profile fields used by routes/profile.js
    for (const column of [
      'phone VARCHAR(50)',
      'location VARCHAR(255)',
      'bio TEXT',
      'linkedin_url VARCHAR(500)',
      'github_url VARCHAR(500)',
      'portfolio_url VARCHAR(500)',
    ]) {
      await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS ${column}`);
    }

    // cvs: the BERT category and the cached career tips
    await pool.query(`
      ALTER TABLE cvs
      ADD COLUMN IF NOT EXISTS predicted_category VARCHAR(100)
    `);
    await pool.query(`
      ALTER TABLE cvs
      ADD COLUMN IF NOT EXISTS career_tips TEXT
    `);

    // job_vacancies: the category an organisation picks when posting
    await pool.query(`
      ALTER TABLE job_vacancies
      ADD COLUMN IF NOT EXISTS category VARCHAR(100)
    `);

    // match_results: applied / shortlisted / rejected
    await pool.query(`
      ALTER TABLE match_results
      ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'applied'
    `);

    // organisations: eligibility cut-off and the company profile fields
    await pool.query(`
      ALTER TABLE organisations
      ADD COLUMN IF NOT EXISTS eligibility_threshold FLOAT DEFAULT 0.65
    `);
    for (const column of [
      'industry VARCHAR(100)',
      'tagline VARCHAR(255)',
      'about TEXT',
      'headquarters VARCHAR(255)',
      'company_size VARCHAR(50)',
      'founded_year INTEGER',
      'contact_email VARCHAR(255)',
    ]) {
      await pool.query(
        `ALTER TABLE organisations ADD COLUMN IF NOT EXISTS ${column}`
      );
    }

    await createUniqueIndex(
      'idx_applications_user_vacancy',
      'applications',
      ['user_id', 'vacancy_id'],
      'Applying for a job'
    );

    // routes/applications.js:92 upserts the match for an application
    await createUniqueIndex(
      'idx_match_results_user_vacancy',
      'match_results',
      ['user_id', 'vacancy_id'],
      'Applying for a job'
    );

    // routes/cv.js:94 replaces a user's CV with ON CONFLICT (user_id)
    await createUniqueIndex(
      'idx_cvs_user_id_unique',
      'cvs',
      ['user_id'],
      'Uploading a CV'
    );

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
