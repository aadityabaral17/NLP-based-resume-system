import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";

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
        `/match/candidates/${vacancy_id}?page=${page}&limit=5`,
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

  const getStatusBadge = (status) => {
    if (status === "shortlisted") return "bg-green-100 text-green-700";
    if (status === "rejected") return "bg-red-100 text-red-700";
    return "bg-gray-100 text-gray-600";
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const getScoreColor = (score) => {
    if (score >= 70) return "text-green-600 bg-green-50";
    if (score >= 50) return "text-yellow-600 bg-yellow-50";
    return "text-red-600 bg-red-50";
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
          <span className="text-sm text-gray-600">{user?.name}</span>
          <button
            onClick={() => navigate("/jobs/post")}
            className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Post a Job
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
          <h2 className="text-xl font-bold">Welcome, {user?.name}!</h2>
          <p className="text-blue-100 text-sm mt-1">
            {jobs.length > 0
              ? `You have ${jobs.length} active job posting${jobs.length > 1 ? "s" : ""}`
              : "Post your first job to start receiving candidates"}
          </p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-xl p-5 shadow-sm text-center">
            <p className="text-3xl font-bold text-blue-600">{jobs.length}</p>
            <p className="text-sm text-gray-500 mt-1">Job Postings</p>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm text-center">
            <p className="text-3xl font-bold text-green-600">
              {candidates.filter((c) => c.is_eligible).length}
            </p>
            <p className="text-sm text-gray-500 mt-1">Eligible Candidates</p>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm text-center">
            <p className="text-3xl font-bold text-purple-600">
              {candidates.length}
            </p>
            <p className="text-sm text-gray-500 mt-1">Total Applicants</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Jobs list */}
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              Your Job Postings
            </h3>
            {jobs.length === 0 ? (
              <div className="bg-white rounded-xl p-8 text-center shadow-sm">
                <p className="text-gray-400 mb-4">No jobs posted yet</p>
                <button
                  onClick={() => navigate("/jobs/post")}
                  className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
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
                    className={`relative group bg-white rounded-xl p-4 shadow-sm cursor-pointer border-2 transition ${
                      selectedJob === job.vacancy_id
                        ? "border-blue-500"
                        : "border-transparent hover:border-blue-200"
                    }`}
                  >
                    <p className="font-medium text-gray-800">{job.title}</p>
                    <p className="text-sm text-gray-400 mt-1">
                      {job.employment_type} · {job.experience_level}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Deadline: {new Date(job.deadline).toLocaleDateString()}
                    </p>
                    {job.required_skills?.length > 0 && (
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {job.required_skills.slice(0, 3).map((skill, i) => (
                          <span
                            key={i}
                            className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded-full"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="absolute top-3 right-3 flex gap-2 opacity-0 transform translate-y-1 transition-all duration-150 group-hover:opacity-100 group-hover:translate-y-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/jobs/${job.vacancy_id}/edit`);
                        }}
                        aria-label="Edit job"
                        title="Edit job"
                        className="text-xs bg-yellow-100 text-yellow-800 px-3 py-1 rounded-md shadow-sm hover:bg-yellow-200"
                      >
                        Edit
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleExportCSV(job.vacancy_id);
                        }}
                        aria-label="Export candidates CSV"
                        title="Export candidates CSV"
                        className="text-xs bg-green-100 text-green-800 px-3 py-1 rounded-md shadow-sm hover:bg-green-200"
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
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              {selectedJob
                ? "Ranked Candidates"
                : "Select a job to view candidates"}
            </h3>
            {selectedJob && candidates.length > 0 && (
              <button
                onClick={() => handleExportCSV(selectedJob)}
                className="text-sm bg-green-600 hover:bg-green-700 text-white px-4 py-2 mb-4 rounded-lg transition"
              >
                Export CSV
              </button>
            )}
            {loadingCandidates ? (
              <div className="bg-white rounded-xl p-8 text-center shadow-sm">
                <p className="text-gray-400">Loading candidates...</p>
              </div>
            ) : candidates.length === 0 && selectedJob ? (
              <div className="bg-white rounded-xl p-8 text-center shadow-sm">
                <p className="text-gray-400">No candidates matched yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {candidates.map((candidate, index) => (
                  <div
                    key={candidate.match_id}
                    className={`bg-white rounded-xl p-4 shadow-sm ${
                      candidate.status === "rejected" ? "opacity-60" : ""
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-gray-400">
                            #{index + 1}
                          </span>
                          <p className="font-medium text-gray-800">
                            {candidate.name}
                          </p>
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full font-medium ${getStatusBadge(candidate.status)}`}
                          >
                            {candidate.status === "shortlisted" &&
                              "★ Shortlisted"}
                            {candidate.status === "rejected" && "✕ Rejected"}
                            {candidate.status === "applied" && "Applied"}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500">
                          {candidate.email}
                        </p>
                        {candidate.missing_skills?.length > 0 && (
                          <div className="flex gap-1 mt-2 flex-wrap">
                            {candidate.missing_skills
                              .slice(0, 3)
                              .map((skill, i) => (
                                <span
                                  key={i}
                                  className="text-xs bg-red-50 text-red-500 px-2 py-1 rounded-full"
                                >
                                  Missing: {skill}
                                </span>
                              ))}
                          </div>
                        )}

                        {/* Action buttons */}
                        <div className="flex gap-2 mt-3">
                          {candidate.status !== "shortlisted" && (
                            <button
                              onClick={() =>
                                handleUpdateStatus(
                                  candidate.match_id,
                                  "shortlisted",
                                )
                              }
                              className="text-xs bg-green-50 text-green-700 hover:bg-green-100 px-3 py-1.5 rounded-lg transition"
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
                              className="text-xs bg-red-50 text-red-700 hover:bg-red-100 px-3 py-1.5 rounded-lg transition"
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
                              className="text-xs bg-gray-50 text-gray-600 hover:bg-gray-100 px-3 py-1.5 rounded-lg transition"
                            >
                              Reset
                            </button>
                          )}
                        </div>
                      </div>
                      <div
                        className={`text-sm font-bold px-3 py-1 rounded-xl ${getScoreColor(candidate.composite_score * 100)}`}
                      >
                        {Math.round(candidate.composite_score * 100)}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Pagination controls — MOVE HERE, inside this div */}
            {candidateTotalPages > 1 && (
              <div className="flex justify-center items-center gap-2 mt-4">
                <button
                  onClick={() =>
                    fetchCandidates(selectedJob, Math.max(1, candidatePage - 1))
                  }
                  disabled={candidatePage === 1}
                  className="text-sm px-3 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  ← Previous
                </button>
                <span className="text-sm text-gray-500 px-3">
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
                  className="text-sm px-3 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next →
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default OrganisationDashboard;
