import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import jobCategories from "../constants/jobCategories";
import ScoreDial from "../components/ScoreDial";
import StatusBadge from "../components/StatusBadge";

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
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const jobsPerPage = 10;
  const [candidateCategory, setCandidateCategory] = useState(null);
  const [showRecommended, setShowRecommended] = useState(false);
  const [expandedJobId, setExpandedJobId] = useState(null);
  const [hasCV, setHasCV] = useState(true);

  const categories = ["All", ...jobCategories];

  useEffect(() => {
    fetchData();
  }, [selectedCategory, currentPage, showRecommended]);

  const fetchData = async () => {
    try {
      let jobsRes;
      if (showRecommended) {
        jobsRes = await api.get("/jobs/recommended/for-me");
        setJobs(jobsRes.data.jobs || []);
        setCandidateCategory(jobsRes.data.candidate_category || null);
        setTotalPages(1);
      } else {
        const categoryParam =
          selectedCategory !== "All" ? `&category=${selectedCategory}` : "";
        jobsRes = await api.get(
          `/jobs?page=${currentPage}&limit=${jobsPerPage}${categoryParam}`,
        );
        setJobs(jobsRes.data.jobs || []);
        setTotalPages(jobsRes.data.totalPages || 1);
      }

      const matchRes = await api.get("/match/user");
      setMatches(matchRes.data.matches || []);

      const appRes = await api.get("/applications/my");
      setApplications(appRes.data.applications || []);

      const recRes = await api.get(`/recommendations/${user?.id}`);
      setRecommendations(recRes.data.recommendations);
      try {
        const profileRes = await api.get("/profile");
        setHasCV(!!profileRes.data.cv);
      } catch (err) {
        setHasCV(true); // fail silently, don't block dashboard
      }
    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  };

  const toggleJobDescription = (vacancy_id) => {
    setExpandedJobId(expandedJobId === vacancy_id ? null : vacancy_id);
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

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-mist flex items-center justify-center">
        <p className="text-slate">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-mist">
      {/* Navbar */}
      <nav className="bg-white border-b border-line px-4 sm:px-6 py-3 sm:py-4 flex flex-wrap justify-between items-center gap-3">
        <span className="font-serif text-lg text-ink">ResumeMatch</span>
        <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
          <span className="text-sm text-slate hidden sm:inline">
            Hello, {user?.name}
          </span>
          <button
            onClick={() => navigate("/profile")}
            className="text-sm text-slate hover:text-indigo transition"
          >
            My Profile
          </button>
          <button
            onClick={handleLogout}
            className="text-sm text-slate hover:text-danger transition"
          >
            Logout
          </button>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Welcome banner */}
        <div className="bg-ink text-white rounded-2xl p-6 mb-8">
          <h2 className="font-serif text-xl">Welcome back, {user?.name}</h2>
          <p className="text-white/70 text-sm mt-1">
            {applications.length > 0
              ? `You have applied to ${applications.length} job${applications.length > 1 ? "s" : ""}`
              : "Browse jobs below and apply to get matched"}
          </p>
        </div>

        {/* CV upload nudge */}
        {!hasCV && (
          <div className="bg-amber-light border border-amber/30 rounded-2xl p-5 mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="font-medium text-amber">
                Upload your CV to get started
              </p>
              <p className="text-sm text-amber/80 mt-1">
                We'll extract your skills and match you against open roles
              </p>
            </div>
            <button
              onClick={() => navigate("/cv/upload")}
              className="text-sm bg-amber text-white px-4 py-2 rounded-lg hover:opacity-90 transition shrink-0"
            >
              Upload CV
            </button>
          </div>
        )}

        {/* Message banner */}
        {message && (
          <div
            className={`rounded-xl p-4 mb-6 text-sm font-medium ${
              message.includes("success") || message.includes("Applied")
                ? "bg-success-light text-success"
                : "bg-danger-light text-danger"
            }`}
          >
            {message}
          </div>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-8">
          <div className="bg-white rounded-xl p-5 border border-line text-center">
            <p className="font-serif text-3xl text-indigo">{jobs.length}</p>
            <p className="text-sm text-slate mt-1">Available jobs</p>
          </div>
          <div className="bg-white rounded-xl p-5 border border-line text-center">
            <p className="font-serif text-3xl text-ink">
              {applications.length}
            </p>
            <p className="text-sm text-slate mt-1">Applied jobs</p>
          </div>
          <div className="bg-white rounded-xl p-5 border border-line text-center">
            <p className="font-serif text-3xl text-amber">
              {matches.filter((m) => m.is_eligible).length}
            </p>
            <p className="text-sm text-slate mt-1">Eligible matches</p>
          </div>
        </div>

        {/* My Applications */}
        {applications.length > 0 && (
          <div className="mb-8">
            <h3 className="font-serif text-lg text-ink mb-4">
              My applications
            </h3>
            <div className="space-y-3">
              {applications.map((app) => (
                <div
                  key={app.application_id}
                  className="bg-white rounded-xl p-5 border border-line"
                >
                  <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-ink">{app.title}</p>
                        <StatusBadge status={app.status} />
                      </div>
                      <p className="text-sm text-slate">{app.company_name}</p>
                      <p className="text-xs text-slate/70 mt-1">
                        Applied: {new Date(app.applied_at).toLocaleDateString()}
                        {app.can_cancel && app.status !== "rejected" && (
                          <span className="ml-2 text-success">
                            · Can cancel within 24hrs
                          </span>
                        )}
                      </p>
                      {app.missing_skills?.length > 0 && (
                        <div className="flex gap-2 mt-2 flex-wrap">
                          {app.missing_skills.slice(0, 3).map((skill, i) => (
                            <span
                              key={i}
                              className="text-xs bg-danger-light text-danger px-2 py-1 rounded-full"
                            >
                              Missing: {skill}
                            </span>
                          ))}
                          <button
                            onClick={() => toggleJobDescription(app.vacancy_id)}
                            className="text-xs text-indigo hover:underline mt-2"
                          >
                            {expandedJobId === app.vacancy_id
                              ? "Hide description ▲"
                              : "View full description ▼"}
                          </button>

                          {expandedJobId === app.vacancy_id && (
                            <div className="bg-mist rounded-lg p-4 mt-2">
                              <p className="text-sm text-ink whitespace-pre-wrap">
                                {app.description}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      {app.composite_score && (
                        <ScoreDial score={app.composite_score * 100} />
                      )}
                      {app.can_cancel &&
                        app.status !== "rejected" &&
                        app.status !== "shortlisted" && (
                          <button
                            onClick={() => handleCancel(app.vacancy_id)}
                            disabled={cancellingId === app.vacancy_id}
                            className="text-xs bg-danger-light text-danger hover:opacity-80 px-3 py-2 rounded-lg transition disabled:opacity-50"
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

        {/* Category & Recommended Filter */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <button
            onClick={() => {
              setShowRecommended(!showRecommended);
              setCurrentPage(1);
            }}
            className={`text-sm px-4 py-2 rounded-lg border transition font-medium ${
              showRecommended
                ? "bg-amber text-white border-amber"
                : "bg-white text-amber border-amber/40 hover:bg-amber-light"
            }`}
          >
            ✨ Recommended for you
          </button>

          {!showRecommended && (
            <>
              <label className="text-sm font-medium text-ink">
                Filter by category:
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value);
                  setCurrentPage(1);
                }}
                className="border border-line rounded-lg px-4 py-2 text-sm bg-white text-ink focus:outline-none focus:ring-2 focus:ring-indigo/30 focus:border-indigo w-full sm:w-55"
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
                  className="text-xs text-indigo hover:underline"
                >
                  Clear filter
                </button>
              )}
            </>
          )}
        </div>

        {/* All Available Jobs */}
        <div>
          <div className="mb-4">
            <h3 className="font-serif text-lg text-ink">
              {showRecommended ? "Recommended jobs for you" : "Available jobs"}
              {showRecommended && candidateCategory && (
                <span className="ml-2 text-sm text-amber font-sans font-normal">
                  · Based on your {candidateCategory} profile
                </span>
              )}
              {!showRecommended && selectedCategory !== "All" && (
                <span className="ml-2 text-sm text-indigo font-sans font-normal">
                  · {selectedCategory}
                </span>
              )}
            </h3>
            {showRecommended && (
              <p className="text-xs text-slate/70 mt-1">
                Curated based on your profile. Apply to see your full match
                score.
              </p>
            )}
          </div>
          {jobs.length === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center border border-line">
              <p className="text-slate">
                {showRecommended
                  ? "No recommended jobs found. Try uploading or updating your CV."
                  : "No jobs found in this category"}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {jobs.map((job) => (
                <div
                  key={job.vacancy_id}
                  className="bg-white rounded-xl p-5 border border-line"
                >
                  <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-ink">{job.title}</p>
                        {job.category && (
                          <span className="text-xs bg-indigo-light text-indigo px-2 py-0.5 rounded-full">
                            {job.category}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate">{job.company_name}</p>
                      <p className="text-sm text-slate/80 mt-1">
                        {job.employment_type} · {job.experience_level}
                      </p>
                      {job.required_skills?.length > 0 && (
                        <div className="flex gap-2 mt-2 flex-wrap">
                          {job.required_skills.slice(0, 4).map((skill, i) => (
                            <span
                              key={i}
                              className="text-xs bg-indigo-light text-indigo px-2 py-1 rounded-full"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                      )}
                      <p className="text-xs text-slate/70 mt-2">
                        Deadline: {new Date(job.deadline).toLocaleDateString()}
                      </p>

                      <button
                        onClick={() => toggleJobDescription(job.vacancy_id)}
                        className="text-xs text-indigo hover:underline mt-2"
                      >
                        {expandedJobId === job.vacancy_id
                          ? "Hide description ▲"
                          : "View full description ▼"}
                      </button>

                      {expandedJobId === job.vacancy_id && (
                        <div className="bg-mist rounded-lg p-4 mt-2">
                          <p className="text-sm text-ink whitespace-pre-wrap">
                            {job.description}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="sm:ml-4 shrink-0 flex sm:block">
                      {isApplied(job.vacancy_id) ? (
                        <div className="flex flex-col items-end gap-2">
                          <span className="text-xs bg-success-light text-success px-3 py-2 rounded-lg font-medium">
                            ✓ Applied
                          </span>
                          {canCancel(job.vacancy_id) && (
                            <button
                              onClick={() => handleCancel(job.vacancy_id)}
                              disabled={cancellingId === job.vacancy_id}
                              className="text-xs bg-danger-light text-danger hover:opacity-80 px-3 py-2 rounded-lg transition disabled:opacity-50"
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
                          className="text-sm bg-indigo hover:bg-indigo-dark text-white px-4 py-2 rounded-lg transition disabled:opacity-50"
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

          {!showRecommended && totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 mt-6">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="text-sm px-3 py-2 rounded-lg border border-line text-slate hover:bg-indigo-light disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                ← Previous
              </button>
              <span className="text-sm text-slate px-3">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={currentPage === totalPages}
                className="text-sm px-3 py-2 rounded-lg border border-line text-slate hover:bg-indigo-light disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                Next →
              </button>
            </div>
          )}
        </div>

        {/* Recommendations Panel */}
        {recommendations && (
          <div className="mt-8">
            <h3 className="font-serif text-lg text-ink mb-4">
              Career recommendations
            </h3>
            {recommendations.top_matches?.length > 0 && (
              <div className="bg-white rounded-xl p-5 border border-line mb-4">
                <h4 className="font-medium text-ink mb-3">
                  Your top job matches
                </h4>
                <div className="space-y-2">
                  {recommendations.top_matches.map((match, i) => (
                    <div
                      key={i}
                      className="flex justify-between items-center py-2 border-b border-line last:border-0"
                    >
                      <div>
                        <p className="text-sm font-medium text-ink">
                          {match.job_title}
                        </p>
                        <p className="text-xs text-slate">{match.company}</p>
                      </div>
                      <span className="text-sm font-bold text-amber">
                        {Math.round(match.match_score * 100)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {recommendations.career_tips?.map((category, i) => (
              <div
                key={i}
                className="bg-white rounded-xl p-5 border border-line mb-4"
              >
                <h4 className="font-medium text-ink mb-3">
                  {category.category === "Skill Development" && "📚 "}
                  {category.category === "Job Search Strategy" && "🎯 "}
                  {category.category === "Career Growth" && "🚀 "}
                  {category.category}
                </h4>
                <ul className="space-y-2">
                  {category.tips.map((tip, j) => (
                    <li key={j} className="text-sm text-slate flex gap-2">
                      <span className="text-indigo mt-0.5">→</span>
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
