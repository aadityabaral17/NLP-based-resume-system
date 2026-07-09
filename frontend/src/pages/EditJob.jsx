import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import jobCategories from "../constants/jobCategories";

function EditJob() {
  const { id } = useParams();
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const fetchJob = async () => {
      try {
        const res = await api.get(`/jobs/${id}`);
        const job = res.data.job;
        setFormData({
          title: job.title || "",
          description: job.description || "",
          experience_level: job.experience_level || "Entry Level",
          employment_type: job.employment_type || "Full Time",
          deadline: job.deadline ? job.deadline.split("T")[0] : "",
          category: job.category || "Information Technology",
        });
      } catch (err) {
        setError(err.response?.data?.error?.message || "Failed to load job.");
      } finally {
        setLoading(false);
      }
    };
    fetchJob();
  }, [id]);

  const handleChange = (e) =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      await api.put(`/jobs/${id}`, formData);
      setSuccess("Job updated successfully! Redirecting...");
      setTimeout(() => navigate("/dashboard/organisation"), 1500);
    } catch (err) {
      setError(err.response?.data?.error?.message || "Failed to update job.");
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "w-full border border-line rounded-lg px-4 py-2.5 text-sm text-ink placeholder:text-slate/60 focus:outline-none focus:ring-2 focus:ring-indigo/30 focus:border-indigo transition";
  const labelClass = "block text-sm font-medium text-ink mb-1.5";

  if (loading) {
    return (
      <div className="min-h-screen bg-mist flex items-center justify-center">
        <p className="text-slate">Loading job...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-mist">
      <nav className="bg-white border-b border-line px-6 py-4 flex justify-between items-center">
        <span className="font-serif text-lg text-ink">ResumeMatch</span>
        <div className="flex items-center gap-4">
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
          <h2 className="font-serif text-2xl text-ink">Edit job</h2>
          <p className="text-slate text-sm mt-1">
            Update the details of this posting
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
                required
                rows={6}
                className={`${inputClass} resize-none`}
              />
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
              disabled={saving}
              className="w-full bg-indigo hover:bg-indigo-dark text-white font-medium py-3 rounded-xl text-sm transition disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save changes"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default EditJob;
