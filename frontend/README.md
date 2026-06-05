# Frontend

Built with React 18, Vite, Tailwind CSS, and Axios.

## Current Progress
- [x] React project setup with Vite
- [x] Tailwind CSS configured
- [x] Axios instance with JWT interceptor
- [x] AuthContext for login state management
- [x] Login page connected to backend
- [x] Register page connected to backend
- [ ] Job seeker dashboard
- [ ] Organisation dashboard
- [ ] CV upload page
- [ ] Job vacancy posting page
- [ ] Match score display
- [ ] Skills recommendation panel

---

## How to Run

### Step 1 — Install dependencies
```bash
cd frontend
npm install
```

### Step 2 — Create .env file inside frontend/
VITE_API_URL=http://localhost:3000/api

### Step 3 — Run
```bash
npm run dev
```
Open http://localhost:5173

---

## Pages
| Page | Route | Status |
|------|-------|--------|
| Login | /login | Done |
| Register | /register | Done |
| Job Seeker Dashboard | /dashboard/jobseeker | In progress |
| Organisation Dashboard | /dashboard/organisation | In progress |
| CV Upload | /cv/upload | Pending |
| Job Posting | /jobs/post | Pending |

---

## Folder Structure
frontend/
src/
api/          ← axios instance and API call functions
components/   ← reusable UI components
context/      ← AuthContext for login state
hooks/        ← custom React hooks
pages/        ← full page components
App.jsx       ← routes defined here
main.jsx      ← entry point
.env            ← local environment variables (never push to GitHub)
vite.config.js  ← Vite + Tailwind configuration

---

## Note
Backend must be running on port 3000 before testing.
See backend/README.md for backend setup instructions.