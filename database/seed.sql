--- SEED DATA FOR TESTING ---
--- Must run this after schema.sql
--- Password for all test accounts is: test123456

-- Clear existing data (careful in production!)
TRUNCATE TABLE notifications, recommendations, match_results, cvs, job_vacancies, users, organisations CASCADE;

--- TEST USERS (job seekers) ---
INSERT INTO users (name, email, password, email_verified) VALUES
('Ram Sharma', 'ram@test.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', true),
('Sita Thapa', 'sita@test.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', true),
('Hari Adhikari', 'hari@test.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', true);

--- TEST ORGANISATIONS ---
INSERT INTO organisations (company_name, email, password, industry, email_verified) VALUES
('Tech Nepal Pvt Ltd', 'technepал@test.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Information Technology', true),
('Himalayan Software', 'himalayan@test.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Software Development', true);

--- TEST JOB VACANCIES ---
INSERT INTO job_vacancies (org_id, title, description, required_skills, experience_level, employment_type, deadline)
SELECT 
  org_id,
  'Junior Python Developer',
  'We are looking for a Python developer with experience in Django and REST APIs. The candidate should have knowledge of PostgreSQL and Git.',
  ARRAY['Python', 'Django', 'REST API', 'PostgreSQL', 'Git'],
  'Entry Level',
  'Full Time',
  '2026-07-01'
FROM organisations WHERE email = 'himalayan@test.com';

INSERT INTO job_vacancies (org_id, title, description, required_skills, experience_level, employment_type, deadline)
SELECT
  org_id,
  'React Frontend Developer',
  'Looking for a React developer with Tailwind CSS and Node.js experience. Knowledge of REST APIs and Git required.',
  ARRAY['React', 'JavaScript', 'Tailwind CSS', 'Node.js', 'Git'],
  'Mid Level',
  'Full Time',
  '2026-07-15'
FROM organisations WHERE email = 'technepал@test.com';

INSERT INTO job_vacancies (org_id, title, description, required_skills, experience_level, employment_type, deadline)
SELECT
  org_id,
  'Data Analyst Intern',
  'Internship position for data analysis using Python and Excel. Basic SQL knowledge required.',
  ARRAY['Python', 'Excel', 'SQL', 'Data Analysis'],
  'Internship',
  'Part Time',
  '2026-06-30'
FROM organisations WHERE email = 'himalayan@test.com';