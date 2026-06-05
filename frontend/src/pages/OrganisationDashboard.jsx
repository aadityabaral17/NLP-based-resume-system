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

  const fetchCandidates = async (vacancy_id) => {
    setLoadingCandidates(true);
    setSelectedJob(vacancy_id);
    try {
      const res = await api.get(`/match/candidates/${vacancy_id}`);
      setCandidates(res.data.candidates || []);
    } catch (err) {
      console.error("Error fetching candidates:", err);
    } finally {
      setLoadingCandidates(false);
    }
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
                    className={`bg-white rounded-xl p-4 shadow-sm cursor-pointer border-2 transition ${
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
                    className="bg-white rounded-xl p-4 shadow-sm"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400">
                            #{index + 1}
                          </span>
                          <p className="font-medium text-gray-800">
                            {candidate.name}
                          </p>
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
          </div>
        </div>
      </div>
    </div>
  );
}

export default OrganisationDashboard;
