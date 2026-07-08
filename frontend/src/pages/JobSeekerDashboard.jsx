import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import jobCategories from "../constants/jobCategories";

function JobSeekerDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [matches, setMatches] = useState([]);
  const [applications, setApplications] = useState([]);
  const [recommendations, setRecommendations] = useState(null);
  const [loading, setLoading] = useState(true);
  const [applyingId, setApplyingId] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [message, setMessage] = useState("");

  const categories = ["All", ...jobCategories];

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const jobsPerPage = 10;

  useEffect(() => {
    fetchData();
  }, [selectedCategory, currentPage]);

  const fetchData = async () => {
    try {
      const categoryParam =
        selectedCategory !== "All" ? `&category=${selectedCategory}` : "";
      const jobsRes = await api.get(
        `/jobs?page=${currentPage}&limit=${jobsPerPage}${categoryParam}`,
      );
      setJobs(jobsRes.data.jobs || []);
      setTotalPages(jobsRes.data.totalPages || 1);

      const matchRes = await api.get("/match/user");
      setMatches(matchRes.data.matches || []);

      const appRes = await api.get("/applications/my");
      setApplications(appRes.data.applications || []);

      const recRes = await api.get(`/recommendations/${user?.id}`);
      setRecommendations(recRes.data.recommendations);
    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async (vacancy_id) => {
    setApplyingId(vacancy_id);
    setMessage("");
    try {
      const res = await api.post(`/applications/${vacancy_id}`);
      setMessage(
        `Applied successfully! Your match score is ${res.data.match_score}%`,
      );
      fetchData();
    } catch (err) {
      setMessage(
        err.response?.data?.error?.message || "Failed to apply. Try again.",
      );
    } finally {
      setApplyingId(null);
    }
  };

  const handleCancel = async (vacancy_id) => {
    if (!window.confirm("Are you sure you want to cancel this application?"))
      return;
    setCancellingId(vacancy_id);
    setMessage("");
    try {
      await api.delete(`/applications/${vacancy_id}`);
      setMessage("Application cancelled successfully.");
      fetchData();
    } catch (err) {
      setMessage(
        err.response?.data?.error?.message || "Failed to cancel application.",
      );
    } finally {
      setCancellingId(null);
    }
  };

  const isApplied = (vacancy_id) =>
    applications.some((a) => a.vacancy_id === vacancy_id);
  const canCancel = (vacancy_id) =>
    applications.find((a) => a.vacancy_id === vacancy_id)?.can_cancel;

  const getScoreColor = (score) => {
    if (score >= 70) return "text-green-600 bg-green-50";
    if (score >= 50) return "text-yellow-600 bg-yellow-50";
    return "text-red-600 bg-red-50";
  };

  const getApplicationStatusBadge = (status) => {
    if (status === "shortlisted")
      return { text: "★ Shortlisted", color: "bg-green-100 text-green-700" };
    if (status === "rejected")
      return { text: "✕ Not Selected", color: "bg-red-100 text-red-700" };
    return { text: "⏳ Under Review", color: "bg-yellow-100 text-yellow-700" };
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <nav className="bg-white shadow-sm px-6 py-4 flex justify-between items-center">
        <h1 className="text-lg font-bold text-blue-600">ResumeMatch AI</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">Hello, {user?.name}</span>
          <button
            onClick={() => navigate("/cv/upload")}
            className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Upload CV
          </button>
          <button
            onClick={handleLogout}
            className="text-sm text-gray-500 hover:text-red-500"
          >
            Logout
          </button>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Welcome banner */}
        <div className="bg-blue-600 text-white rounded-2xl p-6 mb-8">
          <h2 className="text-xl font-bold">Welcome back, {user?.name}!</h2>
          <p className="text-blue-100 text-sm mt-1">
            {applications.length > 0
              ? `You have applied to ${applications.length} job${applications.length > 1 ? "s" : ""}`
              : "Browse jobs below and apply to get matched"}
          </p>
        </div>

        {/* Message banner */}
        {message && (
          <div
            className={`rounded-xl p-4 mb-6 text-sm font-medium ${
              message.includes("success") || message.includes("Applied")
                ? "bg-green-50 text-green-700"
                : "bg-red-50 text-red-700"
            }`}
          >
            {message}
          </div>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-xl p-5 shadow-sm text-center">
            <p className="text-3xl font-bold text-blue-600">{jobs.length}</p>
            <p className="text-sm text-gray-500 mt-1">Available Jobs</p>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm text-center">
            <p className="text-3xl font-bold text-green-600">
              {applications.length}
            </p>
            <p className="text-sm text-gray-500 mt-1">Applied Jobs</p>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm text-center">
            <p className="text-3xl font-bold text-purple-600">
              {matches.filter((m) => m.is_eligible).length}
            </p>
            <p className="text-sm text-gray-500 mt-1">Eligible Matches</p>
          </div>
        </div>

        {/* My Applications with match scores */}
        {applications.length > 0 && (
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              My Applications
            </h3>
            <div className="space-y-3">
              {applications.map((app) => (
                <div
                  key={app.application_id}
                  className="bg-white rounded-xl p-5 shadow-sm"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-gray-800">{app.title}</p>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${getApplicationStatusBadge(app.status).color}`}
                        >
                          {getApplicationStatusBadge(app.status).text}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500">
                        {app.company_name}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        Applied: {new Date(app.applied_at).toLocaleDateString()}
                        {app.can_cancel && app.status !== "rejected" && (
                          <span className="ml-2 text-green-600">
                            · Can cancel within 24hrs
                          </span>
                        )}
                      </p>
                      {app.missing_skills?.length > 0 && (
                        <div className="flex gap-2 mt-2 flex-wrap">
                          {app.missing_skills.slice(0, 3).map((skill, i) => (
                            <span
                              key={i}
                              className="text-xs bg-red-50 text-red-500 px-2 py-1 rounded-full"
                            >
                              Missing: {skill}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      {app.composite_score && (
                        <div
                          className={`text-lg font-bold px-4 py-2 rounded-xl ${getScoreColor(app.composite_score * 100)}`}
                        >
                          {Math.round(app.composite_score * 100)}%
                        </div>
                      )}
                      {app.can_cancel &&
                        app.status !== "rejected" &&
                        app.status !== "shortlisted" && (
                          <button
                            onClick={() => handleCancel(app.vacancy_id)}
                            disabled={cancellingId === app.vacancy_id}
                            className="text-xs bg-red-50 text-red-600 hover:bg-red-100 px-3 py-2 rounded-lg transition disabled:opacity-50"
                          >
                            {cancellingId === app.vacancy_id
                              ? "Cancelling..."
                              : "Cancel"}
                          </button>
                        )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Category Filter */}
        <div className="mb-6 flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700">
            Filter by category:
          </label>
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setCurrentPage(1);
            }}
            className="border border-gray-300 rounded-lg px-4 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-55"
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          {selectedCategory !== "All" && (
            <button
              onClick={() => {
                setSelectedCategory("All");
                setCurrentPage(1);
              }}
              className="text-xs text-blue-600 hover:underline"
            >
              Clear filter
            </button>
          )}
        </div>

        {/* All Available Jobs */}
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            Available Jobs
            {selectedCategory !== "All" && (
              <span className="ml-2 text-sm text-blue-600 font-normal">
                · {selectedCategory}
              </span>
            )}
          </h3>
          {jobs.length === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center shadow-sm">
              <p className="text-gray-400">No jobs found in this category</p>
            </div>
          ) : (
            <div className="space-y-3">
              {jobs.map((job) => (
                <div
                  key={job.vacancy_id}
                  className="bg-white rounded-xl p-5 shadow-sm"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-gray-800">{job.title}</p>
                        {job.category && (
                          <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
                            {job.category}
                          </span>
                        )}
                      </div>

                      <p className="text-sm text-gray-500">
                        {job.company_name}
                      </p>
                      <p className="text-sm text-gray-400 mt-1">
                        {job.employment_type} · {job.experience_level}
                      </p>
                      {job.required_skills?.length > 0 && (
                        <div className="flex gap-2 mt-2 flex-wrap">
                          {job.required_skills.slice(0, 4).map((skill, i) => (
                            <span
                              key={i}
                              className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded-full"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                      )}
                      <p className="text-xs text-gray-400 mt-2">
                        Deadline: {new Date(job.deadline).toLocaleDateString()}
                      </p>
                    </div>

                    {/* Apply / Applied buttons */}
                    <div className="ml-4 shrink-0">
                      {isApplied(job.vacancy_id) ? (
                        <div className="flex flex-col items-end gap-2">
                          <span className="text-xs bg-green-50 text-green-600 px-3 py-2 rounded-lg font-medium">
                            ✓ Applied
                          </span>
                          {canCancel(job.vacancy_id) && (
                            <button
                              onClick={() => handleCancel(job.vacancy_id)}
                              disabled={cancellingId === job.vacancy_id}
                              className="text-xs bg-red-50 text-red-600 hover:bg-red-100 px-3 py-2 rounded-lg transition disabled:opacity-50"
                            >
                              {cancellingId === job.vacancy_id
                                ? "Cancelling..."
                                : "Cancel"}
                            </button>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={() => handleApply(job.vacancy_id)}
                          disabled={applyingId === job.vacancy_id}
                          className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition disabled:opacity-50"
                        >
                          {applyingId === job.vacancy_id
                            ? "Applying..."
                            : "Apply"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {/* Pagination controls */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 mt-6">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="text-sm px-3 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ← Previous
              </button>

              <span className="text-sm text-gray-500 px-3">
                Page {currentPage} of {totalPages}
              </span>

              <button
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={currentPage === totalPages}
                className="text-sm px-3 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next →
              </button>
            </div>
          )}
        </div>

        {/* Recommendations Panel */}
        {recommendations && (
          <div className="mt-8">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              Career Recommendations
            </h3>
            {recommendations.top_matches?.length > 0 && (
              <div className="bg-white rounded-xl p-5 shadow-sm mb-4">
                <h4 className="font-medium text-gray-700 mb-3">
                  Your Top Job Matches
                </h4>
                <div className="space-y-2">
                  {recommendations.top_matches.map((match, i) => (
                    <div
                      key={i}
                      className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-800">
                          {match.job_title}
                        </p>
                        <p className="text-xs text-gray-500">{match.company}</p>
                      </div>
                      <span className="text-sm font-bold text-green-600">
                        {Math.round(match.match_score * 100)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {recommendations.career_tips?.map((category, i) => (
              <div key={i} className="bg-white rounded-xl p-5 shadow-sm mb-4">
                <h4 className="font-medium text-gray-700 mb-3">
                  {category.category === "Skill Development" && "📚 "}
                  {category.category === "Job Search Strategy" && "🎯 "}
                  {category.category === "Career Growth" && "🚀 "}
                  {category.category}
                </h4>
                <ul className="space-y-2">
                  {category.tips.map((tip, j) => (
                    <li key={j} className="text-sm text-gray-600 flex gap-2">
                      <span className="text-blue-500 mt-0.5">→</span>
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default JobSeekerDashboard;
