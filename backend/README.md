# ResumeMatch AI - Express.js Backend

REST API backend for ResumeMatch AI following the project roadmap phases.

## Features

### Phase 1: Project Setup & Foundations
- ✅ Express.js backend service
- ✅ /health endpoint for testing
- ✅ JWT authentication boilerplate
- ✅ PostgreSQL database connection

### Phase 2: Auth, CV Upload & Parsing
- ✅ POST /api/auth/register - User/Organisation registration
- ✅ POST /api/auth/login - JWT token generation
- ✅ Auth middleware for protected routes
- ✅ POST /api/cv/upload - CV file upload via multer
- ✅ Python microservice integration for CV parsing

### Phase 3: NLP Matching Engine & Job Posting
- ✅ POST /api/jobs - Create job vacancy with auto-matching
- ✅ GET /api/jobs - List all job vacancies
- ✅ POST /api/match/trigger - Manual match trigger
- ✅ GET /api/candidates/:jobId - Ranked candidate list
- ✅ Match results saved to database

### Phase 4: Dashboards, Evaluation & Polish
- ✅ GET /api/recommendations/:userid - Career tips and recommendations
- ✅ CSV export endpoint for candidate shortlist
- ✅ Comprehensive error handling
- ⏳ End-to-end testing
- ⏳ Render deployment

## Installation

1. Install dependencies:
```bash
cd backend-express
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. Initialize database:
```bash
node init-db.js
```

4. Start the server:
```bash
npm start
# or for development
npm run dev
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user or organisation
- `POST /api/auth/login` - Login and receive JWT token

### CV Management
- `POST /api/cv/upload` - Upload and parse CV (requires auth)

### Jobs
- `POST /api/jobs` - Create new job vacancy (requires auth)
- `GET /api/jobs` - List all job vacancies

### Matching
- `POST /api/match/trigger` - Trigger matching for a job (requires auth)
- `GET /api/match/candidates/:jobId` - Get ranked candidates for a job (requires auth)

### Recommendations
- `GET /api/recommendations/:userid` - Get career recommendations (requires auth)
- `GET /api/recommendations/export/:jobId` - Export candidates as CSV (requires auth)

### Health
- `GET /health` - Health check endpoint

## Environment Variables

```
PORT=3000
NODE_ENV=development
DATABASE_URL=postgresql://username:password@localhost:5432/resumematch
JWT_SECRET=your-jwt-secret-key
JWT_EXPIRES_IN=24h
PYTHON_SERVICE_URL=http://localhost:5001
MAX_FILE_SIZE=5242880
UPLOAD_DIR=./uploads
```

## Python Microservice

The backend requires a Python microservice for NLP processing. See `../nlp-microservice/` for setup instructions.

## Database Schema

The backend uses PostgreSQL with the following tables:
- users
- organisations
- cvs
- job_vacancies
- match_results
- recommendations
- notifications

## Security Features

- JWT authentication
- Password hashing with bcrypt
- Rate limiting
- CORS protection
- Helmet security headers
- File upload validation
- SQL injection prevention (parameterized queries)

## Testing

```bash
npm test
```

## Connecting with Other Services

### Database Connection

The backend connects to PostgreSQL using the `pg` library. Configure the connection in `.env`:

```
DATABASE_URL=postgresql://username:password@localhost:5432/resumematch
```

**Connection Configuration** (in `config/database.js`):
```javascript
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
```

**Database Initialization:**
```bash
node init-db.js
```

This creates all tables and indexes. See `../database/` for schema details.

### Python Microservice Connection

The backend communicates with the Python NLP microservice via HTTP requests.

**Environment Variable:**
```
PYTHON_SERVICE_URL=http://localhost:5001
```

**Microservice Endpoints Called:**
- `POST {PYTHON_SERVICE_URL}/api/parse/cv` - Parse uploaded CV files
- `POST {PYTHON_SERVICE_URL}/api/parse/job` - Parse job descriptions
- `POST {PYTHON_SERVICE_URL}/api/match` - Calculate match scores

**Starting the Microservice:**
```bash
cd ../nlp-microservice
pip install -r requirements.txt
python app.py
```

The microservice runs on port 5001 by default.

### Frontend Connection

The frontend communicates with the backend via REST API endpoints. No direct database connection is needed.

**API Base URL (development):**
```
http://localhost:3000
```

**Example API Calls:**
```javascript
// Login
POST /api/auth/login
{
  "email": "user@example.com",
  "password": "password123"
}

// Upload CV (requires JWT token)
POST /api/cv/upload
Headers: Authorization: Bearer <JWT_TOKEN>
Content-Type: multipart/form-data
```

### Service Architecture

```
Frontend (React/Vue/HTML)
    ↓ HTTP requests
Express Backend (Port 3000)
    ↓ HTTP requests
Python Microservice (Port 5001)
    ↓
NLP Processing (CV parsing, matching)

Express Backend
    ↓ PostgreSQL connection
Database (PostgreSQL)
```

## Deployment

Deploy to Render free tier (pending)
