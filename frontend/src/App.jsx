import { Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import JobSeekerDashboard from "./pages/JobSeekerDashboard";
import OrganisationDashboard from "./pages/OrganisationDashboard";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/dashboard/jobseeker" element={<JobSeekerDashboard />} />
      <Route
        path="/dashboard/organisation"
        element={<OrganisationDashboard />}
      />
    </Routes>
  );
}

export default App;
