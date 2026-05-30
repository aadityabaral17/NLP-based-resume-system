# Database Setup

1. Install PostgreSQL 18 from https://www.postgresql.org/download/windows/
2. Start PostgreSQL service
3. Run:
   psql -U postgres
   CREATE DATABASE resume_db;
   \q
4. Run schema:
   psql -U postgres -d resume_db -f database/schema.sql
5. Add to your backend/.env:
   DB_URL=postgresql://postgres:YOURPASSWORD@localhost:5432/resume_db