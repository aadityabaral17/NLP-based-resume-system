import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import PasswordInput from "../components/PasswordInput";

function Login() {
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // e.g. "Password reset. Please sign in." after a successful reset
  const notice = location.state?.message;

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.post("/auth/login", formData);
      login(res.data.user, res.data.token);
      if (res.data.user.user_type === "user") {
        navigate("/dashboard/jobseeker");
      } else {
        navigate("/dashboard/organisation");
      }
    } catch (err) {
      setError(
        err.response?.data?.error?.message || "Login failed. Try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-mist flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Brand mark */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="w-9 h-9 rounded-lg bg-indigo flex items-center justify-center">
              <span className="text-white font-serif text-lg">R</span>
            </div>
            <span className="font-serif text-xl text-ink">ResumeMatch</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-line shadow-sm p-8">
          <h1 className="font-serif text-2xl text-ink mb-1">Welcome back</h1>
          <p className="text-slate text-sm mb-6">
            Sign in to continue to your dashboard
          </p>

          {notice && !error && (
            <div className="bg-mist text-slate text-sm px-4 py-3 rounded-lg mb-5 border border-line">
              {notice}
            </div>
          )}

          {error && (
            <div className="bg-danger-light text-danger text-sm px-4 py-3 rounded-lg mb-5">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <div>
                <label className="block text-sm font-medium text-ink mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="you@email.com"
                  required
                  className="w-full border border-line rounded-lg px-3.5 py-2 text-sm leading-5 text-ink placeholder:text-slate/60 focus:outline-none focus:ring-2 focus:ring-indigo/30 focus:border-indigo transition"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-ink">
                  Password
                </label>
                <Link
                  to="/forgot-password"
                  className="text-sm text-indigo hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <PasswordInput
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="••••••••"
                required
                className="w-full border border-line rounded-lg px-4 py-2.5 text-sm text-ink placeholder:text-slate/60 focus:outline-none focus:ring-2 focus:ring-indigo/30 focus:border-indigo transition"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo hover:bg-indigo-dark text-white font-medium py-2.5 rounded-lg text-sm transition disabled:opacity-50"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <p className="text-center text-sm text-slate mt-6">
            Don't have an account?{" "}
            <Link
              to="/register"
              className="text-indigo hover:underline font-medium"
            >
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;
