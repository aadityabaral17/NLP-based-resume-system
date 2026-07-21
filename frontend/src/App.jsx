import { Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Landing from "./pages/Landing";
import JobSeekerDashboard from "./pages/JobSeekerDashboard";
import OrganisationDashboard from "./pages/OrganisationDashboard";
import CVUpload from "./pages/CVUpload";
import PostJob from "./pages/PostJob";
import EditJob from "./pages/EditJob";
import ProtectedRoute from "./components/ProtectedRoute";
import Profile from "./pages/Profile";
import CandidateProfile from "./pages/CandidateProfile";
import BatchRanking from "./pages/BatchRanking";

function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Job seeker only routes */}
      <Route
        path="/dashboard/jobseeker"
        element={
          <ProtectedRoute allowedRole="user">
            <JobSeekerDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/cv/upload"
        element={
          <ProtectedRoute allowedRole="user">
            <CVUpload />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute allowedRole="user">
            <Profile />
          </ProtectedRoute>
        }
      />

      {/* Organisation only routes */}
      <Route
        path="/dashboard/organisation"
        element={
          <ProtectedRoute allowedRole="organisation">
            <OrganisationDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/jobs/post"
        element={
          <ProtectedRoute allowedRole="organisation">
            <PostJob />
          </ProtectedRoute>
        }
      />
      <Route
        path="/jobs/:id/edit"
        element={
          <ProtectedRoute allowedRole="organisation">
            <EditJob />
          </ProtectedRoute>
        }
      />
      <Route
        path="/candidates/:user_id"
        element={
          <ProtectedRoute allowedRole="organisation">
            <CandidateProfile />
          </ProtectedRoute>
        }
      />
      <Route
        path="/batch-ranking"
        element={
          <ProtectedRoute allowedRole="organisation">
            <BatchRanking />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default App;
