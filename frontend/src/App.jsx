import { Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import JobSeekerDashboard from "./pages/JobSeekerDashboard";
import OrganisationDashboard from "./pages/OrganisationDashboard";
import CVUpload from "./pages/CVUpload";
import PostJob from "./pages/PostJob";
import EditJob from "./pages/EditJob";
import ProtectedRoute from "./components/ProtectedRoute";

function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<Login />} />
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
    </Routes>
  );
}

export default App;
