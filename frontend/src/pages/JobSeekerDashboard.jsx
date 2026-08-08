import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import jobCategories from "../constants/jobCategories";
import ScoreDial from "../components/ScoreDial";
import StatusBadge from "../components/StatusBadge";
import CareerTips from "../components/CareerTips";
import DashboardSidebar, {
  GridIcon,
  ClipboardCheckIcon,
  SearchIcon,
  ClockIcon,
} from "../components/DashboardSidebar";

const NAV_ITEMS = [
  { key: "overview", label: "Overview", icon: <GridIcon /> },
  { key: "applied", label: "Applied Jobs", icon: <ClipboardCheckIcon /> },
  { key: "available", label: "Available Jobs", icon: <SearchIcon /> },
  { key: "history", label: "History", icon: <ClockIcon /> },
];

const VIEW_TITLES = {
  overview: "Overview",
  applied: "Applied Jobs",
  available: "Available Jobs",
  history: "History",
};

function JobSeekerDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeView, setActiveView] = useState("overview");
  const [jobs, setJobs] = useState([]);
  const [recommendedJobs, setRecommendedJobs] = useState([]);
  const [matches, setMatches] = useState([]);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [applyingId, setApplyingId] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [message, setMessage] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const jobsPerPage = 10;
  const [candidateCategory, setCandidateCategory] = useState(null);
  const [expandedJobId, setExpandedJobId] = useState(null);
  const [hasCV, setHasCV] = useState(true);
  const [dashboardStats, setDashboardStats] = useState({
    available_jobs: 0,
    vacancies: 0,
    organizations: 0,
  });

  const categories = ["All", ...jobCategories];

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory, currentPage, activeView]);

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

      const statsRes = await api.get("/jobs/stats");
      setDashboardStats(statsRes.data || {});

      const matchedRes = await api.get("/jobs/matched/for-me");
      setRecommendedJobs(matchedRes.data.jobs || []);
      setCandidateCategory(matchedRes.data.candidate_category || null);

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
  const canCancel = (vacancy_id) => {
    const app = applications.find((a) => a.vacancy_id === vacancy_id);
    return (
      app?.can_cancel &&
      app.status !== "rejected" &&
      app.status !== "shortlisted"
    );
  };
  const isEligibleMatch = (vacancy_id) =>
    matches.find((m) => m.vacancy_id === vacancy_id)?.is_eligible;
  const isExpiredApplication = (app) =>
    !!app.deadline && new Date(app.deadline) < new Date();

  const activeApplications = applications.filter(
    (app) => !isExpiredApplication(app),
  );
  const expiredApplicationsCount =
    applications.length - activeApplications.length;

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const initials = (user?.name || "?")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  if (loading) {
    return (
      <div className="min-h-screen bg-mist flex items-center justify-center">
        <p className="text-slate">Loading...</p>
      </div>
    );
  }

  const renderJobCard = (job, { showFit } = {}) => (
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
            {showFit && job.match_score !== undefined && (
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  job.is_eligible
                    ? "bg-success-light text-success"
                    : "bg-amber-light text-amber"
                }`}
              >
                {Math.round(job.match_score * 100)}% match
              </span>
            )}
          </div>
          {job.org_id ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/organisations/${job.org_id}`);
              }}
              className="text-sm text-slate hover:text-indigo hover:underline text-left"
            >
              {job.company_name}
            </button>
          ) : (
            <p className="text-sm text-slate">{job.company_name}</p>
          )}
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
          {job.deadline && (
            <p className="text-xs text-slate/70 mt-2">
              Deadline: {new Date(job.deadline).toLocaleDateString()}
            </p>
          )}
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
                  {cancellingId === job.vacancy_id ? "Cancelling..." : "Cancel"}
                </button>
              )}
            </div>
          ) : (
            <button
              onClick={() => handleApply(job.vacancy_id)}
              disabled={applyingId === job.vacancy_id}
              className="text-sm bg-indigo hover:bg-indigo-dark text-white px-4 py-2 rounded-lg transition disabled:opacity-50"
            >
              {applyingId === job.vacancy_id ? "Applying..." : "Apply"}
            </button>
          )}
        </div>
      </div>
    </div>
  );

  const renderApplicationCard = (app, { showEligibility } = {}) => (
    <div
      key={app.application_id}
      className="bg-white rounded-xl p-5 border border-line"
    >
      <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium text-ink">{app.title}</p>
            <StatusBadge status={app.status} />
            {showEligibility && (
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  isEligibleMatch(app.vacancy_id)
                    ? "bg-success-light text-success"
                    : "bg-amber-light text-amber"
                }`}
              >
                {isEligibleMatch(app.vacancy_id)
                  ? "✓ Eligible match"
                  : "Not an eligible match"}
              </span>
            )}
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
              {app.missing_skills.map((skill, i) => (
                <span
                  key={i}
                  className="text-xs bg-danger-light text-danger px-2 py-1 rounded-full"
                >
                  Missing: {skill}
                </span>
              ))}
            </div>
          )}
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
        <div className="flex items-center gap-3">
          {app.composite_score && (
            <ScoreDial score={app.composite_score * 100} />
          )}
          {!showEligibility &&
            app.can_cancel &&
            app.status !== "rejected" &&
            app.status !== "shortlisted" && (
              <button
                onClick={() => handleCancel(app.vacancy_id)}
                disabled={cancellingId === app.vacancy_id}
                className="text-xs bg-danger-light text-danger hover:opacity-80 px-3 py-2 rounded-lg transition disabled:opacity-50"
              >
                {cancellingId === app.vacancy_id ? "Cancelling..." : "Cancel"}
              </button>
            )}
        </div>
      </div>
    </div>
  );

  // Eligibility is only meaningful in the context of jobs actually applied to
  // — `matches` can include match_results computed for jobs the user merely
  // browsed, so counting straight off `matches` could show more "eligible"
  // than the number of applications, which is what caused the count to look
  // impossible (e.g. more eligible than applied).
  const eligibleCount = applications.filter((app) =>
    isEligibleMatch(app.vacancy_id),
  ).length;

  return (
    <div className="min-h-screen bg-mist flex flex-col lg:flex-row">
      <DashboardSidebar
        logoSubtitle="Career intelligence workspace"
        initials={initials}
        name={user?.name}
        roleLabel="Active Seeker"
        items={NAV_ITEMS}
        activeKey={activeView}
        onSelect={(key) => {
          setActiveView(key);
          setCurrentPage(1);
        }}
        footerLabel="Update Profile"
        onFooterClick={() => navigate("/profile")}
      />

      <div className="flex-1 min-w-0">
        {/* Top header */}
        <div className="hidden lg:flex bg-white/95 backdrop-blur border-b border-line px-6 py-4 items-center justify-between">
          <h1 className="font-serif text-xl text-ink">
            {activeView !== "overview" ? VIEW_TITLES[activeView] : ""}
          </h1>
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/profile")}
              className="text-sm font-medium text-ink hover:text-indigo transition"
            >
              {user?.name}
            </button>
            <button
              onClick={handleLogout}
              className="text-sm text-slate hover:text-danger transition"
            >
              Logout
            </button>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-4 py-8">
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

          {activeView === "overview" && (
            <>
              <div className="bg-ink text-white rounded-2xl p-6 mb-8">
                <h2 className="font-serif text-xl">
                  Welcome back, {user?.name}
                </h2>
                <p className="text-white/70 text-sm mt-1">
                  {applications.length > 0
                    ? `You have applied to ${applications.length} job${applications.length > 1 ? "s" : ""}`
                    : "Browse jobs below and apply to get matched"}
                </p>
              </div>

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

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-8">
                <div className="bg-white rounded-xl p-5 border border-line text-center">
                  <p className="font-serif text-3xl text-indigo">
                    {recommendedJobs.length}
                  </p>
                  <p className="text-sm text-slate mt-1">Matching jobs</p>
                </div>
                <div className="bg-white rounded-xl p-5 border border-line text-center">
                  <p className="font-serif text-3xl text-ink">
                    {applications.length}
                  </p>
                  <p className="text-sm text-slate mt-1">Applied jobs</p>
                </div>
                <div className="bg-white rounded-xl p-5 border border-line text-center">
                  <p className="font-serif text-3xl text-amber">
                    {eligibleCount}
                  </p>
                  <p className="text-sm text-slate mt-1">Eligible matches</p>
                </div>
              </div>

              <div className="mb-8">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <h3 className="font-serif text-lg text-ink">
                    Live platform activity
                  </h3>
                  <span className="text-sm text-slate">
                    Updated from the latest live postings
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                  <div className="bg-white rounded-xl p-5 border border-line text-center">
                    <p className="font-serif text-3xl text-indigo">
                      {dashboardStats.available_jobs ?? 0}
                    </p>
                    <p className="text-sm text-slate mt-1">Live jobs</p>
                  </div>
                  <div className="bg-white rounded-xl p-5 border border-line text-center">
                    <p className="font-serif text-3xl text-ink">
                      {dashboardStats.vacancies ?? 0}
                    </p>
                    <p className="text-sm text-slate mt-1">Open vacancies</p>
                  </div>
                  <div className="bg-white rounded-xl p-5 border border-line text-center">
                    <p className="font-serif text-3xl text-amber">
                      {dashboardStats.organizations ?? 0}
                    </p>
                    <p className="text-sm text-slate mt-1">
                      Partner organizations
                    </p>
                  </div>
                </div>
              </div>

              {hasCV && <CareerTips />}

              <div>
                <div className="flex items-center justify-between gap-3 mb-4">
                  <h3 className="font-serif text-lg text-ink">
                    Jobs matching your profile
                  </h3>
                  {candidateCategory && (
                    <span className="text-sm text-amber">
                      Best fit: {candidateCategory}
                    </span>
                  )}
                </div>
                {recommendedJobs.length === 0 ? (
                  <div className="bg-white rounded-xl p-8 text-center border border-line">
                    <p className="text-slate">
                      {hasCV
                        ? "Your CV is ready. We'll start showing tailored opportunities here as soon as the matching results are refreshed."
                        : "Upload your CV to unlock matching jobs based on your skills and career interests."}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recommendedJobs
                      .slice(0, 3)
                      .map((job) => renderJobCard(job, { showFit: true }))}
                  </div>
                )}
              </div>
            </>
          )}

          {activeView === "applied" && (
            <div>
              <div className="flex items-center justify-between gap-3 mb-4">
                <h3 className="font-serif text-lg text-ink">My applications</h3>
                {expiredApplicationsCount > 0 && (
                  <span className="text-xs text-slate">
                    {expiredApplicationsCount} expired posting
                    {expiredApplicationsCount === 1 ? "" : "s"} moved to{" "}
                    <button
                      onClick={() => setActiveView("history")}
                      className="text-indigo hover:underline"
                    >
                      History
                    </button>
                  </span>
                )}
              </div>
              {activeApplications.length === 0 ? (
                <div className="bg-white rounded-xl p-8 text-center border border-line">
                  <p className="text-slate">
                    You haven't applied to any jobs yet.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activeApplications.map((app) => renderApplicationCard(app))}
                </div>
              )}
            </div>
          )}

          {activeView === "available" && (
            <div>
              <div className="mb-6 flex flex-wrap items-center gap-3">
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
              </div>

              <h3 className="font-serif text-lg text-ink mb-4">
                Available jobs
                {selectedCategory !== "All" && (
                  <span className="ml-2 text-sm text-indigo font-sans font-normal">
                    · {selectedCategory}
                  </span>
                )}
              </h3>

              {jobs.length === 0 ? (
                <div className="bg-white rounded-xl p-8 text-center border border-line">
                  <p className="text-slate">No jobs found in this category</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {jobs.map((job) => renderJobCard(job))}
                </div>
              )}

              {totalPages > 1 && (
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
          )}

          {activeView === "history" && (
            <div>
              <div className="flex items-center justify-between gap-3 mb-4">
                <h3 className="font-serif text-lg text-ink">
                  Application history
                </h3>
                <span className="text-sm text-slate">
                  {eligibleCount} eligible match
                  {eligibleCount === 1 ? "" : "es"} out of {applications.length}{" "}
                  applied
                </span>
              </div>
              {applications.length === 0 ? (
                <div className="bg-white rounded-xl p-8 text-center border border-line">
                  <p className="text-slate">
                    You haven't applied to any jobs yet.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {applications.map((app) =>
                    renderApplicationCard(app, { showEligibility: true }),
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default JobSeekerDashboard;
