import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";

function JobSeekerDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [recommendations, setRecommendations] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const jobsRes = await api.get("/jobs");
      setJobs(jobsRes.data.jobs || []);

      const matchRes = await api.get("/match/user");
      setMatches(matchRes.data.matches || []);

      // Test recommendations
      const recRes = await api.get(`/recommendations/${user?.id}`);
      setRecommendations(recRes.data.recommendations);
    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setLoading(false);
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
            {matches.length > 0
              ? `You have ${matches.filter((m) => m.is_eligible).length} eligible job matches`
              : "Upload your CV to start getting job matches"}
          </p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-xl p-5 shadow-sm text-center">
            <p className="text-3xl font-bold text-blue-600">{jobs.length}</p>
            <p className="text-sm text-gray-500 mt-1">Available Jobs</p>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm text-center">
            <p className="text-3xl font-bold text-green-600">
              {matches.filter((m) => m.is_eligible).length}
            </p>
            <p className="text-sm text-gray-500 mt-1">Eligible Matches</p>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm text-center">
            <p className="text-3xl font-bold text-purple-600">
              {matches.length}
            </p>
            <p className="text-sm text-gray-500 mt-1">Total Matches</p>
          </div>
        </div>

        {/* Match results */}
        {matches.length > 0 && (
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              Your Match Scores
            </h3>
            <div className="space-y-3">
              {matches.map((match) => (
                <div
                  key={match.match_id}
                  className="bg-white rounded-xl p-5 shadow-sm flex justify-between items-center"
                >
                  <div>
                    <p className="font-medium text-gray-800">{match.title}</p>
                    <p className="text-sm text-gray-500">
                      {match.company_name}
                    </p>
                    {match.missing_skills?.length > 0 && (
                      <div className="flex gap-2 mt-2 flex-wrap">
                        {match.missing_skills.slice(0, 3).map((skill, i) => (
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
                    className={`text-lg font-bold px-4 py-2 rounded-xl ${getScoreColor(match.composite_score * 100)}`}
                  >
                    {Math.round(match.composite_score * 100)}%
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* All jobs */}
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            All Available Jobs
          </h3>
          {jobs.length === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center shadow-sm">
              <p className="text-gray-400">No jobs posted yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {jobs.map((job) => (
                <div
                  key={job.vacancy_id}
                  className="bg-white rounded-xl p-5 shadow-sm"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-gray-800">{job.title}</p>
                      <p className="text-sm text-gray-500">
                        {job.company_name}
                      </p>
                      <p className="text-sm text-gray-400 mt-1">
                        {job.employment_type} · {job.experience_level}
                      </p>
                      {job.required_skills?.length > 0 && (
                        <div className="flex gap-2 mt-2 flex-wrap">
                          {job.required_skills.map((skill, i) => (
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
                    <span className="text-xs text-gray-400">
                      Deadline: {new Date(job.deadline).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        {/* Recommendations Panel */}
        {recommendations && (
          <div className="mt-8">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              Career Recommendations
            </h3>

            {/* Top matches */}
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

            {/* Career tips */}
            {recommendations.career_tips?.map((category, i) => (
              <div key={i} className="bg-white rounded-xl p-5 shadow-sm mb-4">
                <h4 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
                  {category.category === "Skill Development" && "📚"}
                  {category.category === "Job Search Strategy" && "🎯"}
                  {category.category === "Career Growth" && "🚀"}
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
