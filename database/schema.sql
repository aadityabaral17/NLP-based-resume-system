-- Users (job seekers)
CREATE TABLE users (
  user_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(100) NOT NULL,
  email       VARCHAR(150) UNIQUE NOT NULL,
  password    VARCHAR(255) NOT NULL,
  email_verified BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMP DEFAULT NOW()
);

-- Organisations
CREATE TABLE organisations (
  org_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name VARCHAR(150) NOT NULL,
  email        VARCHAR(150) UNIQUE NOT NULL,
  password     VARCHAR(255) NOT NULL,
  industry     VARCHAR(100),
  email_verified BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMP DEFAULT NOW()
);

-- CVs uploaded by users
CREATE TABLE cvs (
  cv_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID REFERENCES users(user_id) ON DELETE CASCADE,
  file_path      VARCHAR(255),
  extracted_text TEXT,
  skill_entities TEXT[],
  uploaded_at    TIMESTAMP DEFAULT NOW()
);

-- Job vacancies posted by organisations
CREATE TABLE job_vacancies (
  vacancy_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID REFERENCES organisations(org_id) ON DELETE CASCADE,
  title           VARCHAR(150) NOT NULL,
  description     TEXT NOT NULL,
  required_skills TEXT[],
  experience_level VARCHAR(50),
  employment_type  VARCHAR(50),
  deadline        DATE,
  positions_available INT NOT NULL DEFAULT 1,
  created_at      TIMESTAMP DEFAULT NOW()
);

-- NLP match results
CREATE TABLE match_results (
  match_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(user_id),
  vacancy_id      UUID REFERENCES job_vacancies(vacancy_id),
  cosine_score    FLOAT,
  composite_score FLOAT,
  missing_skills  TEXT[],
  is_eligible     BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMP DEFAULT NOW()
);

-- Skill recommendations for job seekers
CREATE TABLE recommendations (
  rec_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(user_id),
  skill_name  VARCHAR(100),
  gap_frequency INT DEFAULT 1,
  created_at  TIMESTAMP DEFAULT NOW()
);

-- Email notifications sent
CREATE TABLE notifications (
  notif_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id        UUID REFERENCES match_results(match_id),
  recipient_email VARCHAR(150),
  status          VARCHAR(20) DEFAULT 'pending',
  sent_at         TIMESTAMP
);