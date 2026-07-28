import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import ScoreDial from "../components/ScoreDial";
import StatusBadge from "../components/StatusBadge";

function OrganisationDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [candidatePage, setCandidatePage] = useState(1);
  const [candidateTotalPages, setCandidateTotalPages] = useState(1);
  const [threshold, setThreshold] = useState(65);
  const [showSettings, setShowSettings] = useState(false);
  const [savingThreshold, setSavingThreshold] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [orgStats, setOrgStats] = useState({
    posted_jobs: 0,
    vacancies: 0,
    total_applications: 0,
  });
  const [showCompanyEditor, setShowCompanyEditor] = useState(false);
  const [companyProfile, setCompanyProfile] = useState({
    companyName: user?.name || "Your organisation",
    companyDescription: "Building thoughtful hiring experiences with ResumeMatch.",
  });
  const [companyForm, setCompanyForm] = useState({
    companyName: user?.name || "Your organisation",
    companyDescription: "Building thoughtful hiring experiences with ResumeMatch.",
  });

  useEffect(() => {
    fetchJobs();
    fetchSettings();
    fetchDashboardStats();
  }, []);

  useEffect(() => {
    if (!user?.id) return;

    const savedProfile = localStorage.getItem(`org-profile-${user.id}`);
    if (savedProfile) {
      try {
        const parsed = JSON.parse(savedProfile);
        const nextProfile = {
          companyName: parsed.companyName || user.name || "Your organisation",
          companyDescription:
            parsed.companyDescription ||
            "Building thoughtful hiring experiences with ResumeMatch.",
        };
        setCompanyProfile(nextProfile);
        setCompanyForm(nextProfile);
      } catch (err) {
        console.error("Error reading saved company profile:", err);
      }
    } else {
      const initialProfile = {
        companyName: user.name || "Your organisation",
        companyDescription: "Building thoughtful hiring experiences with ResumeMatch.",
      };
      setCompanyProfile(initialProfile);
      setCompanyForm(initialProfile);
    }
  }, [user?.id, user?.name]);

  const fetchSettings = async () => {
    try {
      const res = await api.get("/settings");
      setThreshold(Math.round(res.data.eligibility_threshold * 100));
    } catch (err) {
      console.error("Error fetching settings:", err);
    }
  };

  const handleSaveThreshold = async () => {
    setSavingThreshold(true);
    try {
      await api.put("/settings", { eligibility_threshold: threshold / 100 });
      setShowSettings(false);
    } catch (err) {
      console.error("Error saving threshold:", err);
    } finally {
      setSavingThreshold(false);
    }
  };

  const fetchJobs = async () => {
    try {
      const res = await api.get("/jobs");
      const orgJobs = res.data.jobs.filter((job) => job.org_id === user?.id);
      setJobs(orgJobs);
    } catch (err) {
      console.error("Error fetching jobs:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDashboardStats = async () => {
    try {
      const res = await api.get("/jobs/stats?scope=org");
      setOrgStats(res.data || {});
    } catch (err) {
      console.error("Error fetching dashboard stats:", err);
    }
  };

  const fetchCandidates = async (vacancy_id, page = 1) => {
    setLoadingCandidates(true);
    setSelectedJob(vacancy_id);
    setCandidatePage(page);
    setSearchParams({ job: vacancy_id });
    try {
      const res = await api.get(
        `/match/candidates/${vacancy_id}?page=${page}&limit=10`,
      );
      setCandidates(res.data.candidates || []);
      setCandidateTotalPages(res.data.totalPages || 1);
    } catch (err) {
      console.error("Error fetching candidates:", err);
    } finally {
      setLoadingCandidates(false);
    }
  };

  useEffect(() => {
    const jobFromUrl = searchParams.get("job");
    if (jobFromUrl && jobs.length > 0 && !selectedJob) {
      fetchCandidates(jobFromUrl, 1);
    }
  }, [jobs]);

  const handleExportCSV = async (vacancy_id) => {
    try {
      const res = await api.get(`/recommendations/export/${vacancy_id}`, {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `candidates_${vacancy_id}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export error:", err);
    }
  };

  const handleUpdateStatus = async (match_id, status) => {
    try {
      await api.patch(`/match/candidates/${match_id}/status`, { status });
      fetchCandidates(selectedJob, candidatePage);
    } catch (err) {
      console.error("Error updating status:", err);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const openCompanyEditor = () => {
    setCompanyForm(companyProfile);
    setShowCompanyEditor(true);
  };

  const saveCompanyProfile = (e) => {
    e.preventDefault();
    const nextProfile = {
      companyName: companyForm.companyName.trim() || "Your organisation",
      companyDescription:
        companyForm.companyDescription.trim() ||
        "Building thoughtful hiring experiences with ResumeMatch.",
    };

    setCompanyProfile(nextProfile);
    if (user?.id) {
      localStorage.setItem(`org-profile-${user.id}`, JSON.stringify(nextProfile));
    }
    setShowCompanyEditor(false);
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
      <nav className="bg-white/95 backdrop-blur border-b border-line px-4 sm:px-6 py-3 sm:py-4">
        <div className="max-w-5xl mx-auto flex flex-wrap justify-between items-center gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo to-violet-600 flex items-center justify-center text-white font-serif text-lg shadow-sm">
              R
            </div>
            <div>
              <p className="font-serif text-lg text-ink">ResumeMatch</p>
              <p className="text-xs text-slate">Hiring command center</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <button
              onClick={openCompanyEditor}
              className="text-sm font-medium text-ink hover:text-indigo transition"
            >
              {companyProfile.companyName}
            </button>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="text-sm text-slate hover:text-indigo transition"
            >
              ⚙ Settings
            </button>
            <button
              onClick={() => navigate("/jobs/post")}
              className="text-sm bg-indigo text-white px-4 py-2 rounded-lg hover:bg-indigo-dark transition"
            >
              Post a job
            </button>
            <button
              onClick={handleLogout}
              className="text-sm text-slate hover:text-danger transition"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      {showCompanyEditor && (
        <div className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm px-4 flex items-center justify-center">
          <div className="w-full max-w-lg rounded-3xl border border-line bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-indigo">Company profile</p>
                <h3 className="font-serif text-xl text-ink mt-1">Polish your organisation presence</h3>
              </div>
              <button
                onClick={() => setShowCompanyEditor(false)}
                className="text-sm text-slate hover:text-danger transition"
              >
                Close
              </button>
            </div>
            <form onSubmit={saveCompanyProfile} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-ink mb-2">
                  Organisation name
                </label>
                <input
                  type="text"
                  value={companyForm.companyName}
                  onChange={(e) =>
                    setCompanyForm({ ...companyForm, companyName: e.target.value })
                  }
                  className="w-full rounded-xl border border-line bg-mist px-3 py-2 text-sm outline-none focus:border-indigo"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink mb-2">
                  Company overview
                </label>
                <textarea
                  rows="4"
                  value={companyForm.companyDescription}
                  onChange={(e) =>
                    setCompanyForm({
                      ...companyForm,
                      companyDescription: e.target.value,
                    })
                  }
                  className="w-full rounded-xl border border-line bg-mist px-3 py-2 text-sm outline-none focus:border-indigo"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCompanyEditor(false)}
                  className="text-sm text-slate hover:text-ink transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="text-sm bg-indigo text-white px-4 py-2 rounded-lg hover:bg-indigo-dark transition"
                >
                  Save profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showSettings && (
        <div className="max-w-5xl mx-auto px-4 pt-6">
          <div className="bg-white rounded-2xl border border-line p-6">
            <h3 className="font-serif text-lg text-ink mb-2">
              Eligibility threshold
            </h3>
            <p className="text-sm text-slate mb-4">
              Candidates scoring at or above this threshold are marked eligible
              and receive an instant email notification.
            </p>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="0"
                max="100"
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                className="flex-1 accent-indigo"
              />
              <span className="font-serif text-2xl text-indigo w-16 text-right">
                {threshold}%
              </span>
            </div>
            <div className="flex gap-3 mt-4">
              <button
                onClick={handleSaveThreshold}
                disabled={savingThreshold}
                className="text-sm bg-indigo text-white px-4 py-2 rounded-lg hover:bg-indigo-dark transition disabled:opacity-50"
              >
                {savingThreshold ? "Saving..." : "Save threshold"}
              </button>
              <button
                onClick={() => setShowSettings(false)}
                className="text-sm text-slate hover:text-ink px-4 py-2"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Welcome banner */}
        <div className="bg-ink text-white rounded-2xl p-6 mb-8">
          <h2 className="font-serif text-xl">Welcome, {user?.name}</h2>
          <p className="text-white/70 text-sm mt-1">
            {jobs.length > 0
              ? `You have ${jobs.length} active job posting${jobs.length > 1 ? "s" : ""}`
              : "Post your first job to start receiving candidates"}
          </p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-8">
          <div className="bg-white rounded-xl p-5 border border-line text-center">
            <p className="font-serif text-3xl text-indigo">
              {orgStats.posted_jobs}
            </p>
            <p className="text-sm text-slate mt-1">Posted jobs</p>
          </div>
          <div className="bg-white rounded-xl p-5 border border-line text-center">
            <p className="font-serif text-3xl text-success">
              {orgStats.vacancies}
            </p>
            <p className="text-sm text-slate mt-1">Total vacancies</p>
          </div>
          <div className="bg-white rounded-xl p-5 border border-line text-center">
            <p className="font-serif text-3xl text-amber">
              {orgStats.total_applications}
            </p>
            <p className="text-sm text-slate mt-1">Total applications</p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-indigo to-indigo-dark text-white rounded-2xl p-6 mb-8">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
            <div className="max-w-2xl">
              <p className="text-sm uppercase tracking-[0.2em] text-white/70">
                Hiring insight
              </p>
              <h3 className="font-serif text-xl mt-2">
                Let ResumeMatch help you find talent that actually fits your role
              </h3>
              <p className="text-sm text-white/80 mt-2">
                Our NLP engine reads CVs semantically, ranks candidates by role fit, and keeps your hiring decisions focused on real potential rather than keyword matches.
              </p>
            </div>
            <div className="rounded-xl bg-white/15 p-4 min-w-[220px]">
              <p className="text-sm text-white/80">Current focus</p>
              <p className="font-medium mt-1">
                {jobs.length > 0
                  ? "Review your top-ranked applicants and shortlist faster"
                  : "Post your first role to start receiving AI-ranked candidates"}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl border border-line shadow-sm p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h3 className="font-serif text-lg text-ink">Batch CV ranking</h3>
                  <p className="text-sm text-slate mt-1">
                    Upload a zip of candidate CVs and rank them against a job description without leaving the dashboard.
                  </p>
                </div>
                <button
                  onClick={() => navigate("/batch-ranking")}
                  className="text-sm bg-indigo text-white px-4 py-2 rounded-lg hover:bg-indigo-dark transition"
                >
                  Open batch ranking
                </button>
              </div>
            </div>
          </div>

          {/* Jobs list */}
          <div>
            <h3 className="font-serif text-lg text-ink mb-4">
              Your job postings
            </h3>
            {jobs.length === 0 ? (
              <div className="bg-white rounded-xl p-8 text-center border border-line">
                <p className="text-slate mb-4">No jobs posted yet</p>
                <button
                  onClick={() => navigate("/jobs/post")}
                  className="text-sm bg-indigo text-white px-4 py-2 rounded-lg hover:bg-indigo-dark transition"
                >
                  Post your first job
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {jobs.map((job) => (
                  <div
                    key={job.vacancy_id}
                    onClick={() => fetchCandidates(job.vacancy_id)}
                    className={`relative group bg-white rounded-xl p-4 border-2 cursor-pointer transition ${
                      selectedJob === job.vacancy_id
                        ? "border-indigo"
                        : "border-line hover:border-indigo/40"
                    }`}
                  >
                    <p className="font-medium text-ink">{job.title}</p>
                    <p className="text-sm text-slate/80 mt-1">
                      {job.employment_type} · {job.experience_level}
                    </p>
                    <p className="text-xs text-amber mt-1">
                      {job.positions_available || 1} position{(job.positions_available || 1) === 1 ? "" : "s"} available
                    </p>
                    <p className="text-xs text-slate/70 mt-1">
                      Deadline: {new Date(job.deadline).toLocaleDateString()}
                    </p>
                    {job.required_skills?.length > 0 && (
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {job.required_skills.map((skill, i) => (
                          <span
                            key={i}
                            className="text-xs bg-indigo-light text-indigo px-2 py-1 rounded-full"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="absolute top-3 right-3 flex gap-2 opacity-100 sm:opacity-0 sm:translate-y-1 transition-all duration-150 sm:group-hover:opacity-100 sm:group-hover:translate-y-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/jobs/${job.vacancy_id}/edit`);
                        }}
                        title="Edit job"
                        className="text-xs bg-amber-light text-amber px-3 py-1 rounded-md shadow-sm hover:opacity-80"
                      >
                        Edit
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleExportCSV(job.vacancy_id);
                        }}
                        title="Export candidates CSV"
                        className="text-xs bg-success-light text-success px-3 py-1 rounded-md shadow-sm hover:opacity-80"
                      >
                        Export CSV
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Candidates list */}
          <div>
            <h3 className="font-serif text-lg text-ink mb-4">
              {selectedJob
                ? "Ranked candidates"
                : "Select a job to view candidates"}
            </h3>
            {selectedJob && candidates.length > 0 && (
              <button
                onClick={() => handleExportCSV(selectedJob)}
                className="text-sm bg-success text-white hover:opacity-90 px-4 py-2 mb-4 rounded-lg transition"
              >
                Export CSV
              </button>
            )}
            {loadingCandidates ? (
              <div className="bg-white rounded-xl p-8 text-center border border-line">
                <p className="text-slate">Loading candidates...</p>
              </div>
            ) : candidates.length === 0 && selectedJob ? (
              <div className="bg-white rounded-xl p-8 text-center border border-line">
                <p className="text-slate">No candidates matched yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {candidates.map((candidate, index) => (
                  <div
                    key={candidate.match_id}
                    className={`bg-white rounded-xl p-4 border border-line ${candidate.status === "rejected" ? "opacity-60" : ""}`}
                  >
                    <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-slate/60">
                            #{index + 1}
                          </span>
                          <div className="flex items-center gap-2 flex-wrap">
                            <button
                              onClick={() =>
                                navigate(`/candidates/${candidate.user_id}`)
                              }
                              className="font-medium text-ink hover:text-indigo hover:underline text-left"
                            >
                              {candidate.name}
                            </button>
                            <StatusBadge status={candidate.status} />
                            {candidate.is_eligible && (
                              <span className="text-xs bg-success-light text-success px-2 py-0.5 rounded-full font-medium">
                                ✓ Eligible
                              </span>
                            )}
                          </div>
                        </div>
                        <p className="text-sm text-slate">{candidate.email}</p>
                        {candidate.missing_skills?.length > 0 && (
                          <div className="flex gap-1 mt-2 flex-wrap">
                            {candidate.missing_skills.map((skill, i) => (
                              <span
                                key={i}
                                className="text-xs bg-danger-light text-danger px-2 py-1 rounded-full"
                              >
                                Missing: {skill}
                              </span>
                            ))}
                          </div>
                        )}

                        <div className="flex gap-2 mt-3">
                          {candidate.status !== "shortlisted" && (
                            <button
                              onClick={() =>
                                handleUpdateStatus(
                                  candidate.match_id,
                                  "shortlisted",
                                )
                              }
                              className="text-xs bg-success-light text-success hover:opacity-80 px-3 py-1.5 rounded-lg transition"
                            >
                              ★ Shortlist
                            </button>
                          )}
                          {candidate.status !== "rejected" && (
                            <button
                              onClick={() =>
                                handleUpdateStatus(
                                  candidate.match_id,
                                  "rejected",
                                )
                              }
                              className="text-xs bg-danger-light text-danger hover:opacity-80 px-3 py-1.5 rounded-lg transition"
                            >
                              ✕ Reject
                            </button>
                          )}
                          {candidate.status !== "applied" && (
                            <button
                              onClick={() =>
                                handleUpdateStatus(
                                  candidate.match_id,
                                  "applied",
                                )
                              }
                              className="text-xs bg-indigo-light text-indigo hover:opacity-80 px-3 py-1.5 rounded-lg transition"
                            >
                              Reset
                            </button>
                          )}
                        </div>
                      </div>
                      <ScoreDial score={candidate.composite_score * 100} />
                    </div>
                  </div>
                ))}

                {candidateTotalPages > 1 && (
                  <div className="flex justify-center items-center gap-2 mt-4">
                    <button
                      onClick={() =>
                        fetchCandidates(
                          selectedJob,
                          Math.max(1, candidatePage - 1),
                        )
                      }
                      disabled={candidatePage === 1}
                      className="text-sm px-3 py-2 rounded-lg border border-line text-slate hover:bg-indigo-light disabled:opacity-40 disabled:cursor-not-allowed transition"
                    >
                      ← Previous
                    </button>
                    <span className="text-sm text-slate px-3">
                      Page {candidatePage} of {candidateTotalPages}
                    </span>
                    <button
                      onClick={() =>
                        fetchCandidates(
                          selectedJob,
                          Math.min(candidateTotalPages, candidatePage + 1),
                        )
                      }
                      disabled={candidatePage === candidateTotalPages}
                      className="text-sm px-3 py-2 rounded-lg border border-line text-slate hover:bg-indigo-light disabled:opacity-40 disabled:cursor-not-allowed transition"
                    >
                      Next →
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default OrganisationDashboard;
