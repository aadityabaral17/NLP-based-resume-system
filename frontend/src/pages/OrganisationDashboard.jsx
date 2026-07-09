import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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

  useEffect(() => {
    fetchJobs();
  }, []);

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

  const fetchCandidates = async (vacancy_id, page = 1) => {
    setLoadingCandidates(true);
    setSelectedJob(vacancy_id);
    setCandidatePage(page);
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
      <nav className="bg-white border-b border-line px-6 py-4 flex justify-between items-center">
        <span className="font-serif text-lg text-ink">ResumeMatch</span>
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate">{user?.name}</span>
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
      </nav>

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
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-xl p-5 border border-line text-center">
            <p className="font-serif text-3xl text-indigo">{jobs.length}</p>
            <p className="text-sm text-slate mt-1">Job postings</p>
          </div>
          <div className="bg-white rounded-xl p-5 border border-line text-center">
            <p className="font-serif text-3xl text-success">
              {candidates.filter((c) => c.is_eligible).length}
            </p>
            <p className="text-sm text-slate mt-1">Eligible candidates</p>
          </div>
          <div className="bg-white rounded-xl p-5 border border-line text-center">
            <p className="font-serif text-3xl text-amber">
              {candidates.length}
            </p>
            <p className="text-sm text-slate mt-1">Total applicants</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
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
                    <p className="text-xs text-slate/70 mt-1">
                      Deadline: {new Date(job.deadline).toLocaleDateString()}
                    </p>
                    {job.required_skills?.length > 0 && (
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {job.required_skills.slice(0, 3).map((skill, i) => (
                          <span
                            key={i}
                            className="text-xs bg-indigo-light text-indigo px-2 py-1 rounded-full"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="absolute top-3 right-3 flex gap-2 opacity-0 translate-y-1 transition-all duration-150 group-hover:opacity-100 group-hover:translate-y-0">
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
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-slate/60">
                            #{index + 1}
                          </span>
                          <p className="font-medium text-ink">
                            {candidate.name}
                          </p>
                          <StatusBadge status={candidate.status} />
                        </div>
                        <p className="text-sm text-slate">{candidate.email}</p>
                        {candidate.missing_skills?.length > 0 && (
                          <div className="flex gap-1 mt-2 flex-wrap">
                            {candidate.missing_skills
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
