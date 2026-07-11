import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import jobCategories from "../constants/jobCategories";

function PostJob() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    experience_level: "Entry Level",
    employment_type: "Full Time",
    deadline: "",
    category: jobCategories[0],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleChange = (e) =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      await api.post("/jobs", formData);
      setSuccess("Job posted successfully! Redirecting...");
      setTimeout(() => navigate("/dashboard/organisation"), 2000);
    } catch (err) {
      setError(
        err.response?.data?.error?.message || "Failed to post job. Try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "w-full border border-line rounded-lg px-4 py-2.5 text-sm text-ink placeholder:text-slate/60 focus:outline-none focus:ring-2 focus:ring-indigo/30 focus:border-indigo transition";
  const labelClass = "block text-sm font-medium text-ink mb-1.5";

  return (
    <div className="min-h-screen bg-mist">
      <nav className="bg-white border-b border-line px-4 sm:px-6 py-3 sm:py-4 flex flex-wrap justify-between items-center gap-3">
        <span className="font-serif text-lg text-ink">ResumeMatch</span>
        <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
          <span className="text-sm text-slate">{user?.name}</span>
          <button
            onClick={() => navigate("/dashboard/organisation")}
            className="text-sm text-slate hover:text-indigo transition"
          >
            Back to dashboard
          </button>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="mb-8">
          <h2 className="font-serif text-2xl text-ink">Post a job</h2>
          <p className="text-slate text-sm mt-1">
            Fill in the details below to reach matched candidates
          </p>
        </div>

        {error && (
          <div className="bg-danger-light text-danger text-sm px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-success-light text-success text-sm px-4 py-3 rounded-lg mb-4">
            {success}
          </div>
        )}

        <div className="bg-white rounded-2xl border border-line shadow-sm p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className={labelClass}>Job title</label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                placeholder="e.g. Junior Python Developer"
                required
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Job description</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Describe the role, responsibilities, and required skills..."
                required
                rows={6}
                className={`${inputClass} resize-none`}
              />
              <p className="text-xs text-slate/70 mt-1.5">
                Include required skills in the description for stronger matching
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Experience level</label>
                <select
                  name="experience_level"
                  value={formData.experience_level}
                  onChange={handleChange}
                  className={inputClass}
                >
                  <option value="Internship">Internship</option>
                  <option value="Entry Level">Entry Level</option>
                  <option value="Mid Level">Mid Level</option>
                  <option value="Senior Level">Senior Level</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Employment type</label>
                <select
                  name="employment_type"
                  value={formData.employment_type}
                  onChange={handleChange}
                  className={inputClass}
                >
                  <option value="Full Time">Full Time</option>
                  <option value="Part Time">Part Time</option>
                  <option value="Contract">Contract</option>
                  <option value="Remote">Remote</option>
                </select>
              </div>
            </div>

            <div>
              <label className={labelClass}>Application deadline</label>
              <input
                type="date"
                name="deadline"
                value={formData.deadline}
                onChange={handleChange}
                required
                min={new Date().toISOString().split("T")[0]}
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Job category</label>
              <select
                name="category"
                value={formData.category}
                onChange={handleChange}
                className={inputClass}
              >
                {jobCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo hover:bg-indigo-dark text-white font-medium py-3 rounded-xl text-sm transition disabled:opacity-50"
            >
              {loading ? "Posting job..." : "Post job"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default PostJob;
