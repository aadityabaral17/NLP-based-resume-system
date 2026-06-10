import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function ProtectedRoute({ children, allowedRole }) {
  const { user } = useAuth();

  // Not logged in → redirect to login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Wrong role → redirect to their correct dashboard
  if (allowedRole && user.user_type !== allowedRole) {
    if (user.user_type === "user") {
      return <Navigate to="/dashboard/jobseeker" replace />;
    } else {
      return <Navigate to="/dashboard/organisation" replace />;
    }
  }

  return children;
}

export default ProtectedRoute;
