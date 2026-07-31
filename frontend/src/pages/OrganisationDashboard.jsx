import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import ScoreDial from "../components/ScoreDial";
import StatusBadge from "../components/StatusBadge";
import DashboardSidebar, {
  GridIcon,
  BriefcaseIcon,
  BarChartIcon,
  SettingsIcon,
} from "../components/DashboardSidebar";

const NAV_ITEMS = [
  { key: "overview", label: "Overview", icon: <GridIcon /> },
  { key: "postings", label: "Job Postings", icon: <BriefcaseIcon /> },
  { key: "batch", label: "Batch Ranking", icon: <BarChartIcon /> },
  { key: "settings", label: "Settings", icon: <SettingsIcon /> },
];

const VIEW_TITLES = {
  overview: "Overview",
  postings: "Job Postings",
  batch: "Batch Ranking",
  settings: "Settings",
};

function OrganisationDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeView, setActiveView] = useState("overview");
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [candidatePage, setCandidatePage] = useState(1);
  const [candidateTotalPages, setCandidateTotalPages] = useState(1);
  const [bulkShortlisting, setBulkShortlisting] = useState(false);
  const [threshold, setThreshold] = useState(65);
  const [savingThreshold, setSavingThreshold] = useState(false);
  const [batchFiles, setBatchFiles] = useState([]);
  const [batchJobDescription, setBatchJobDescription] = useState("");
  const [batchDragging, setBatchDragging] = useState(false);
  const [batchProcessing, setBatchProcessing] = useState(false);
  const [batchResults, setBatchResults] = useState(null);
  const [batchError, setBatchError] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();
  const [orgStats, setOrgStats] = useState({
    posted_jobs: 0,
    vacancies: 0,
    total_applications: 0,
  });
  const [companyProfile, setCompanyProfile] = useState({
    companyName: user?.name || "Your organisation",
    tagline: "",
  });

  useEffect(() => {
    fetchJobs();
    fetchSettings();
    fetchDashboardStats();
    fetchCompanyProfile();
  }, []);

  const fetchCompanyProfile = async () => {
    try {
      const res = await api.get("/organisations/profile");
      setCompanyProfile({
        companyName:
          res.data.profile.company_name || user?.name || "Your organisation",
        tagline: res.data.profile.tagline || "",
      });
    } catch (err) {
      console.error("Error fetching organisation profile:", err);
    }
  };

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const handleShortlistAllEligible = async () => {
    const toShortlist = candidates.filter(
      (c) => c.is_eligible && c.status !== "shortlisted",
    );
    if (toShortlist.length === 0) return;
    if (
      !window.confirm(
        `Shortlist all ${toShortlist.length} eligible candidate${toShortlist.length > 1 ? "s" : ""}?`,
      )
    )
      return;

    setBulkShortlisting(true);
    try {
      await Promise.all(
        toShortlist.map((c) =>
          api.patch(`/match/candidates/${c.match_id}/status`, {
            status: "shortlisted",
          }),
        ),
      );
      fetchCandidates(selectedJob, candidatePage);
    } catch (err) {
      console.error("Error bulk-shortlisting candidates:", err);
    } finally {
      setBulkShortlisting(false);
    }
  };

  const validateAndAddBatchFiles = (fileList) => {
    setBatchError("");
    const allowedTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    const validFiles = [];
    for (const file of Array.from(fileList)) {
      if (!allowedTypes.includes(file.type)) {
        setBatchError(`${file.name} is not a PDF or DOCX file`);
        continue;
      }
      if (file.size > 5 * 1024 * 1024) {
        setBatchError(`${file.name} exceeds 5MB`);
        continue;
      }
      validFiles.push(file);
    }
    setBatchFiles((prev) => [...prev, ...validFiles].slice(0, 20));
  };

  const handleBatchFileChange = (e) => validateAndAddBatchFiles(e.target.files);
  const handleBatchDrop = (e) => {
    e.preventDefault();
    setBatchDragging(false);
    validateAndAddBatchFiles(e.dataTransfer.files);
  };
  const handleBatchDragOver = (e) => {
    e.preventDefault();
    setBatchDragging(true);
  };
  const handleBatchDragLeave = () => setBatchDragging(false);

  const removeBatchFile = (index) => {
    setBatchFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleBatchRank = async () => {
    if (batchFiles.length === 0) {
      setBatchError("Please add at least one CV");
      return;
    }
    if (!batchJobDescription.trim()) {
      setBatchError("Please enter a job description");
      return;
    }

    setBatchProcessing(true);
    setBatchError("");
    setBatchResults(null);
    try {
      const formData = new FormData();
      batchFiles.forEach((file) => formData.append("cv_files", file));
      formData.append("job_description", batchJobDescription);

      const res = await api.post("/batch/rank", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setBatchResults(res.data.results || []);
    } catch (err) {
      setBatchError(
        err.response?.data?.error?.message || "Failed to process batch ranking",
      );
    } finally {
      setBatchProcessing(false);
    }
  };

  const resetBatchRanking = () => {
    setBatchFiles([]);
    setBatchJobDescription("");
    setBatchResults(null);
    setBatchError("");
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const initials = (companyProfile.companyName || "?")
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

  const jobPostingCard = (job, { showActions = true } = {}) => (
    <div
      key={job.vacancy_id}
      onClick={() => {
        fetchCandidates(job.vacancy_id);
        setActiveView("postings");
      }}
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
        {job.positions_available || 1} position
        {(job.positions_available || 1) === 1 ? "" : "s"} available
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
      {showActions && (
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
      )}
    </div>
  );

  const candidatesPanel = (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 min-h-9">
        <h3 className="font-serif text-lg text-ink">
          {selectedJob
            ? "Ranked candidates"
            : "Select a job to view candidates"}
        </h3>
        {selectedJob && candidates.length > 0 && (
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => handleExportCSV(selectedJob)}
              className="text-sm bg-success text-white hover:opacity-90 px-4 py-2 rounded-lg transition"
            >
              Export CSV
            </button>
            {candidates.some(
              (c) => c.is_eligible && c.status !== "shortlisted",
            ) && (
              <button
                onClick={handleShortlistAllEligible}
                disabled={bulkShortlisting}
                className="text-sm bg-indigo text-white hover:bg-indigo-dark px-4 py-2 rounded-lg transition disabled:opacity-50"
              >
                {bulkShortlisting
                  ? "Shortlisting..."
                  : "★ Shortlist all Eligible"}
              </button>
            )}
          </div>
        )}
      </div>
      {loadingCandidates ? (
        <div className="bg-white rounded-xl p-8 text-center border border-line">
          <p className="text-slate">Loading candidates...</p>
        </div>
      ) : !selectedJob ? (
        <div className="bg-white rounded-xl p-8 text-center border border-dashed border-line">
          <p className="text-slate">
            Pick a job from the list to start reviewing applications, ranked and
            sorted by AI fit.
          </p>
        </div>
      ) : candidates.length === 0 ? (
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
                    <span className="text-xs text-slate/60">#{index + 1}</span>
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
                          handleUpdateStatus(candidate.match_id, "shortlisted")
                        }
                        className="text-xs bg-success-light text-success hover:opacity-80 px-3 py-1.5 rounded-lg transition"
                      >
                        ★ Shortlist
                      </button>
                    )}
                    {candidate.status !== "rejected" && (
                      <button
                        onClick={() =>
                          handleUpdateStatus(candidate.match_id, "rejected")
                        }
                        className="text-xs bg-danger-light text-danger hover:opacity-80 px-3 py-1.5 rounded-lg transition"
                      >
                        ✕ Reject
                      </button>
                    )}
                    {candidate.status !== "applied" && (
                      <button
                        onClick={() =>
                          handleUpdateStatus(candidate.match_id, "applied")
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
                  fetchCandidates(selectedJob, Math.max(1, candidatePage - 1))
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
  );

  return (
    <div className="min-h-screen bg-mist flex">
      <DashboardSidebar
        logoSubtitle="Hiring command center"
        initials={initials}
        name={companyProfile.companyName}
        roleLabel="Employer workspace"
        items={NAV_ITEMS}
        activeKey={activeView}
        onSelect={setActiveView}
        footerLabel="Update Profile"
        onFooterClick={() => navigate("/organisation/profile")}
      />

      <div className="flex-1 min-w-0">
        {/* Top header */}
        <div className="hidden lg:flex bg-white/95 backdrop-blur border-b border-line px-6 py-4 items-center justify-between">
          <h1 className="font-serif text-xl text-ink">
            {activeView !== "overview" ? VIEW_TITLES[activeView] : ""}
          </h1>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/organisation/profile")}
              className="text-sm font-medium text-ink hover:text-indigo transition"
            >
              {companyProfile.companyName}
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
          {activeView === "overview" && (
            <>
              <div className="bg-ink text-white rounded-2xl p-6 mb-8">
                <h2 className="font-serif text-xl">Welcome, {user?.name}</h2>
                <p className="text-white/70 text-sm mt-1">
                  {jobs.length > 0
                    ? `You have ${jobs.length} active job posting${jobs.length > 1 ? "s" : ""}`
                    : "Post your first job to start receiving candidates"}
                </p>
              </div>

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

              <div className="mb-8">
                <div className="bg-white rounded-2xl border border-line shadow-sm p-8 text-center">
                  <h3 className="font-serif text-lg text-ink mb-2">
                    Job Postings
                  </h3>
                  <p className="text-sm text-slate max-w-md mx-auto mb-6">
                    Post a role to start receiving candidates, ranked
                    automatically by AI fit as soon as they apply.
                  </p>
                  <button
                    onClick={() => navigate("/jobs/post")}
                    className="text-sm bg-indigo text-white px-5 py-2.5 rounded-lg hover:bg-indigo-dark transition"
                  >
                    Post a job
                  </button>
                </div>
              </div>

              <div>
                <div className="bg-white rounded-2xl border border-line shadow-sm p-8 text-center">
                  <h3 className="font-serif text-lg text-ink mb-2">
                    Batch CV ranking
                  </h3>
                  <p className="text-sm text-slate max-w-md mx-auto mb-6">
                    Upload a zip of candidate CVs and rank them against a job
                    description without leaving the dashboard.
                  </p>
                  <button
                    onClick={() => setActiveView("batch")}
                    className="text-sm bg-indigo text-white px-5 py-2.5 rounded-lg hover:bg-indigo-dark transition"
                  >
                    Open batch ranking
                  </button>
                </div>
              </div>
            </>
          )}

          {activeView === "postings" && (
            <div>
              <div className="flex items-center justify-between gap-3 mb-6">
                <h3 className="font-serif text-lg text-ink">Job Postings</h3>
                <button
                  onClick={() => navigate("/jobs/post")}
                  className="text-sm bg-indigo text-white px-4 py-2 rounded-lg hover:bg-indigo-dark transition"
                >
                  Post a job
                </button>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <div className="flex items-center mb-4 min-h-9">
                    <h3 className="font-serif text-lg text-ink">
                      Your job postings
                    </h3>
                  </div>
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
                      {jobs.map((job) => jobPostingCard(job))}
                    </div>
                  )}
                </div>

                {candidatesPanel}
              </div>
            </div>
          )}

          {activeView === "batch" && (
            <div>
              <div className="mb-2">
                <h3 className="font-serif text-lg text-ink">
                  Batch CV ranking
                </h3>
                <p className="text-slate text-sm mt-1">
                  Upload CVs you already have and paste a job description to
                  rank them instantly.
                </p>
              </div>

              <div className="bg-indigo-light rounded-xl p-3 my-4">
                <p className="text-xs text-indigo-dark">
                  This is a standalone ranking tool — it does not create a job
                  posting, does not notify candidates, and is separate from
                  Apply for Job.
                </p>
              </div>

              {batchError && (
                <div className="bg-danger-light text-danger text-sm px-4 py-3 rounded-lg mb-4">
                  {batchError}
                </div>
              )}

              {!batchResults && (
                <div className="bg-white rounded-2xl border border-line p-6 sm:p-8">
                  <label className="block text-sm font-medium text-ink mb-1.5">
                    Job description
                  </label>
                  <textarea
                    value={batchJobDescription}
                    onChange={(e) => setBatchJobDescription(e.target.value)}
                    placeholder="Paste or write the job description here..."
                    rows={5}
                    className="w-full border border-line rounded-lg px-3.5 py-2 text-sm leading-5 text-ink placeholder:text-slate/60 focus:outline-none focus:ring-2 focus:ring-indigo/30 focus:border-indigo transition resize-none mb-6"
                  />

                  <label className="block text-sm font-medium text-ink mb-1.5">
                    Candidate CVs
                  </label>
                  <div
                    onDrop={handleBatchDrop}
                    onDragOver={handleBatchDragOver}
                    onDragLeave={handleBatchDragLeave}
                    onClick={() =>
                      document.getElementById("batch-cv-input").click()
                    }
                    className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition ${
                      batchDragging
                        ? "border-indigo bg-indigo-light"
                        : "border-line hover:border-indigo/50"
                    }`}
                  >
                    <input
                      id="batch-cv-input"
                      type="file"
                      accept=".pdf,.docx"
                      multiple
                      onChange={handleBatchFileChange}
                      className="hidden"
                    />
                    <div className="text-3xl mb-2">📁</div>
                    <p className="text-sm text-ink font-medium">
                      Drag and drop CVs here, or click to browse
                    </p>
                    <p className="text-xs text-slate mt-1">
                      Up to 20 files · PDF or DOCX · Max 5MB each
                    </p>
                  </div>

                  {batchFiles.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <p className="text-xs text-slate/70">
                        {batchFiles.length} file(s) selected
                      </p>
                      {batchFiles.map((file, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between bg-mist rounded-lg px-3 py-2"
                        >
                          <span className="text-sm text-ink truncate">
                            {file.name}
                          </span>
                          <button
                            onClick={() => removeBatchFile(i)}
                            className="text-xs text-danger hover:underline ml-2 shrink-0"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <button
                    onClick={handleBatchRank}
                    disabled={batchProcessing}
                    className="w-full mt-6 bg-indigo hover:bg-indigo-dark text-white font-medium py-3 rounded-xl text-sm transition disabled:opacity-50"
                  >
                    {batchProcessing
                      ? "Ranking candidates..."
                      : `Rank ${batchFiles.length || ""} candidate${batchFiles.length !== 1 ? "s" : ""}`}
                  </button>
                </div>
              )}

              {batchResults && (
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-serif text-lg text-ink">
                      Ranked results
                    </h3>
                    <button
                      onClick={resetBatchRanking}
                      className="text-sm text-indigo hover:underline"
                    >
                      Start new ranking
                    </button>
                  </div>

                  <div className="space-y-3">
                    {batchResults.map((result, index) => (
                      <div
                        key={index}
                        className="bg-white rounded-xl p-4 border border-line"
                      >
                        {result.error ? (
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="font-medium text-ink">
                                {result.filename}
                              </p>
                              <p className="text-xs text-danger mt-1">
                                {result.error}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="flex justify-between items-start gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs text-slate/60">
                                  #{index + 1}
                                </span>
                                <p className="font-medium text-ink">
                                  {result.filename}
                                </p>
                                {result.predicted_category && (
                                  <span className="text-xs bg-indigo-light text-indigo px-2 py-0.5 rounded-full">
                                    {result.predicted_category}
                                  </span>
                                )}
                              </div>
                              {result.skills?.length > 0 && (
                                <div className="flex gap-1 mt-2 flex-wrap">
                                  {result.skills.slice(0, 6).map((skill, i) => (
                                    <span
                                      key={i}
                                      className="text-xs bg-indigo-light text-indigo px-2 py-1 rounded-full"
                                    >
                                      {skill}
                                    </span>
                                  ))}
                                </div>
                              )}
                              {result.missing_skills?.length > 0 && (
                                <div className="flex gap-1 mt-2 flex-wrap">
                                  {result.missing_skills
                                    .slice(0, 3)
                                    .map((skill, i) => (
                                      <span
                                        key={i}
                                        className="text-xs bg-danger-light text-danger px-2 py-1 rounded-full"
                                      >
                                        Missing: {skill}
                                      </span>
                                    ))}
                                </div>
                              )}
                            </div>
                            <ScoreDial score={result.final_score * 100} />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeView === "settings" && (
            <div className="bg-white rounded-2xl border border-line p-6 max-w-xl">
              <h3 className="font-serif text-lg text-ink mb-2">
                Eligibility threshold
              </h3>
              <p className="text-sm text-slate mb-4">
                Candidates scoring at or above this threshold are marked
                eligible and receive an instant email notification.
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
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default OrganisationDashboard;
