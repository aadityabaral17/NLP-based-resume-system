## Feature: Organisation Threshold, Profiles, Recommendations, Landing Page

### What's included
- Configurable eligibility threshold per organisation (Settings panel)
- Automatic recalculation of `is_eligible` when threshold changes
- Automatic recalculation of match scores when a job seeker updates their CV
- Email notification when a candidate is manually shortlisted (in addition to auto-eligible emails)
- Job seeker profile page — editable phone, location, bio, LinkedIn/GitHub/portfolio links, CV viewer
- Organisation can view a candidate's full profile (only for candidates who applied to their jobs)
- "Recommended for you" filter for job seekers — shows jobs matching their CV's predicted category with ≥70% skill overlap
- Public landing page at `/` with project overview, sign in / sign up CTAs, and academic project disclaimer

### Requirements

**Database migrations (run in Supabase SQL Editor before pulling this branch):**
```sql
-- Organisation configurable threshold
ALTER TABLE organisations 
ADD COLUMN eligibility_threshold FLOAT DEFAULT 0.65;

-- Job seeker profile fields
ALTER TABLE users 
ADD COLUMN phone VARCHAR(20),
ADD COLUMN location VARCHAR(150),
ADD COLUMN bio TEXT,
ADD COLUMN linkedin_url VARCHAR(255),
ADD COLUMN github_url VARCHAR(255),
ADD COLUMN portfolio_url VARCHAR(255);

-- Predicted category storage for recommended jobs matching
ALTER TABLE cvs 
ADD COLUMN predicted_category VARCHAR(100);
```

### Backend Routes Updates

| File                          | Route(s)                                      | Type     | Description                                                                 |
|-------------------------------|-----------------------------------------------|----------|-----------------------------------------------------------------------------|
| backend/routes/settings.js    | GET /api/settings<br>PUT /api/settings        | New      | Manage application settings (fetch and update).                             |
| backend/routes/profile.js     | GET /api/profile<br>PUT /api/profile<br>GET /api/profile/:user_id | New      | User profile management (self and by user ID).                              |
| backend/routes/jobs.js        | GET /api/jobs/recommended/for-me              | Updated  | Recommendation endpoint refined for personalized job listings.              |
| backend/routes/applications.js| —                                             | Updated  | Uses organization threshold instead of hardcoded 0.65 for application logic.|
| backend/routes/match.js       | —                                             | Updated  | Shortlist status now triggers email notification.                           |
| backend/routes/cv.js          | —                                             | Updated  | Saves `predicted_category` and recalculates match scores for applied jobs.  |
| backend/utils/emailService.js | —                                             | Updated  | Adds `sendShortlistNotification()` for shortlist email alerts.              |


Register in `backend/server.js`:
```javascript
app.use("/api/settings", require("./routes/settings"));
app.use("/api/profile", require("./routes/profile"));
```

### Frontend Pages Updates

| File                                      | Path / Route(s)                          | Type     | Description                                                                 |
|-------------------------------------------|------------------------------------------|----------|-----------------------------------------------------------------------------|
| frontend/src/pages/Profile.jsx            | /profile                                 | New      | Job seeker profile page.                                                    |
| frontend/src/pages/CandidateProfile.jsx   | /candidates/:user_id                     | New      | Organisation’s view of a candidate profile.                                 |
| frontend/src/pages/Landing.jsx            | /                                        | New      | Public homepage rendered at root path.                                      |
| frontend/src/pages/JobSeekerDashboard.jsx | /jobseeker-dashboard (internal routing)  | Updated  | Added recommended filter and CV upload nudge.                               |
| frontend/src/pages/OrganisationDashboard.jsx | /organisation-dashboard (internal routing) | Updated  | Added settings panel and eligible badge.                                    |
| frontend/src/App.jsx                      | /, /profile, /candidates/:user_id        | Updated  | Root path now renders Landing; new routes for Profile and CandidateProfile. |

**No new npm/pip packages required** — this feature set uses only existing dependencies.

### Testing checklist
- [ ] Organisation can open Settings and change eligibility threshold
- [ ] Changing threshold updates is_eligible on existing match_results immediately
- [ ] Re-uploading a CV recalculates scores for all jobs already applied to
- [ ] Manually shortlisting a candidate sends them an email
- [ ] Job seeker can edit and save their profile
- [ ] Job seeker can view their own CV file from Profile page
- [ ] Organisation can click a candidate's name to view their full profile + CV
- [ ] Organisation cannot view a profile of someone who hasn't applied to their jobs (403)
- [ ] "Recommended for you" only shows jobs in the candidate's predicted category, ≥60% skill overlap
- [ ] Landing page loads at "/" with disclaimer banner, Sign in / Get started buttons