import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";

function Profile() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [cv, setCv] = useState(null);
  const [formData, setFormData] = useState({
    phone: "",
    location: "",
    bio: "",
    linkedin_url: "",
    github_url: "",
    portfolio_url: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState("");

  const getMissingFields = () => {
    if (!profile) return [];
    const missing = [];
    if (!profile.phone) missing.push("Phone");
    if (!profile.location) missing.push("Location");
    if (!profile.bio) missing.push("Bio");
    if (!profile.linkedin_url && !profile.github_url && !profile.portfolio_url)
      missing.push("At least one link (LinkedIn/GitHub/Portfolio)");
    if (!cv) missing.push("CV");
    return missing;
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await api.get("/profile");
      setProfile(res.data.profile);
      setCv(res.data.cv);
      setFormData({
        phone: res.data.profile.phone || "",
        location: res.data.profile.location || "",
        bio: res.data.profile.bio || "",
        linkedin_url: res.data.profile.linkedin_url || "",
        github_url: res.data.profile.github_url || "",
        portfolio_url: res.data.profile.portfolio_url || "",
      });
    } catch (err) {
      console.error("Error fetching profile:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const res = await api.put("/profile", formData);
      setProfile(res.data.profile);
      setMessage("Profile updated successfully");
      setEditing(false);
    } catch (err) {
      setMessage(
        err.response?.data?.error?.message || "Failed to update profile",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleViewCV = async () => {
    try {
      const res = await api.get(`/cv/file/${user?.id}`, {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(res.data);
      window.open(url, "_blank");
    } catch (err) {
      console.error("Error viewing CV:", err);
    }
  };

  const inputClass =
    "w-full border border-line rounded-lg px-3.5 py-2 text-sm leading-5 text-ink placeholder:text-slate/60 focus:outline-none focus:ring-2 focus:ring-indigo/30 focus:border-indigo transition";
  const labelClass = "block text-sm font-medium text-ink mb-1.5";

  if (loading) {
    return (
      <div className="min-h-screen bg-mist flex items-center justify-center">
        <p className="text-slate">Loading profile...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-mist">
      <nav className="bg-white border-b border-line px-4 sm:px-6 py-3 sm:py-4 flex flex-wrap justify-between items-center gap-3">
        <span className="font-serif text-lg text-ink">ResumeMatch</span>
        <button
          onClick={() => navigate("/dashboard/jobseeker")}
          className="text-sm text-slate hover:text-indigo transition"
        >
          Back to dashboard
        </button>
      </nav>

      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-6 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
          <div>
            <h2 className="font-serif text-2xl text-ink">My profile</h2>
            <p className="text-slate text-sm mt-1">
              Manage your personal details and CV
            </p>
          </div>
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="text-sm bg-indigo text-white px-4 py-2 rounded-lg hover:bg-indigo-dark transition self-start sm:self-auto"
            >
              Edit profile
            </button>
          )}
        </div>

        {message && (
          <div
            className={`rounded-lg p-3 mb-4 text-sm font-medium ${
              message.includes("success")
                ? "bg-success-light text-success"
                : "bg-danger-light text-danger"
            }`}
          >
            {message}
          </div>
        )}
        {getMissingFields().length > 0 && (
          <div className="bg-amber-light border border-amber/30 rounded-xl p-4 mb-6">
            <p className="text-sm font-medium text-amber">
              Complete your profile
            </p>
            <p className="text-xs text-amber/80 mt-1">
              Missing: {getMissingFields().join(", ")}
            </p>
          </div>
        )}

        {/* Basic info card */}
        <div className="bg-white rounded-2xl border border-line p-6 mb-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-full bg-indigo-light flex items-center justify-center">
              <span className="font-serif text-2xl text-indigo">
                {profile?.name?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <p className="font-medium text-ink text-lg">{profile?.name}</p>
              <p className="text-sm text-slate">{profile?.email}</p>
            </div>
          </div>

          {!editing ? (
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate/70 mb-1">Phone</p>
                <p className="text-sm text-ink">{profile?.phone || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-slate/70 mb-1">Location</p>
                <p className="text-sm text-ink">{profile?.location || "—"}</p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-xs text-slate/70 mb-1">Bio</p>
                <p className="text-sm text-ink">{profile?.bio || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-slate/70 mb-1">LinkedIn</p>
                {profile?.linkedin_url ? (
                  <a
                    href={profile.linkedin_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-indigo hover:underline break-all"
                  >
                    {profile.linkedin_url}
                  </a>
                ) : (
                  <p className="text-sm text-ink">—</p>
                )}
              </div>
              <div>
                <p className="text-xs text-slate/70 mb-1">GitHub</p>
                {profile?.github_url ? (
                  <a
                    href={profile.github_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-indigo hover:underline break-all"
                  >
                    {profile.github_url}
                  </a>
                ) : (
                  <p className="text-sm text-ink">—</p>
                )}
              </div>
              <div>
                <p className="text-xs text-slate/70 mb-1">Portfolio</p>
                {profile?.portfolio_url ? (
                  <a
                    href={profile.portfolio_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-indigo hover:underline break-all"
                  >
                    {profile.portfolio_url}
                  </a>
                ) : (
                  <p className="text-sm text-ink">—</p>
                )}
              </div>
            </div>
          ) : (
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Phone</label>
                  <input
                    type="text"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="+977 98XXXXXXXX"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Location</label>
                  <input
                    type="text"
                    name="location"
                    value={formData.location}
                    onChange={handleChange}
                    placeholder="Kathmandu, Nepal"
                    className={inputClass}
                  />
                </div>
              </div>
              <div>
                <label className={labelClass}>Bio</label>
                <textarea
                  name="bio"
                  value={formData.bio}
                  onChange={handleChange}
                  rows={3}
                  placeholder="A short summary about yourself..."
                  className={`${inputClass} resize-none`}
                />
              </div>
              <div>
                <label className={labelClass}>LinkedIn URL</label>
                <input
                  type="url"
                  name="linkedin_url"
                  value={formData.linkedin_url}
                  onChange={handleChange}
                  placeholder="https://linkedin.com/in/yourname"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>GitHub URL</label>
                <input
                  type="url"
                  name="github_url"
                  value={formData.github_url}
                  onChange={handleChange}
                  placeholder="https://github.com/yourname"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Portfolio URL</label>
                <input
                  type="url"
                  name="portfolio_url"
                  value={formData.portfolio_url}
                  onChange={handleChange}
                  placeholder="https://yourportfolio.com"
                  className={inputClass}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-indigo hover:bg-indigo-dark text-white font-medium px-5 py-2.5 rounded-lg text-sm transition disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save changes"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="text-slate hover:text-ink text-sm px-5 py-2.5"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>

        {/* CV card */}
        <div className="bg-white rounded-2xl border border-line p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-serif text-lg text-ink">My CV</h3>
            <button
              onClick={() => navigate("/cv/upload")}
              className="text-sm text-indigo hover:underline"
            >
              {cv ? "Update CV" : "Upload CV"}
            </button>
          </div>

          {cv ? (
            <div>
              <p className="text-xs text-slate/70 mb-3">
                Uploaded: {new Date(cv.uploaded_at).toLocaleDateString()}
              </p>

              {cv.predicted_category && (
                <div className="mb-4">
                  <p className="text-xs text-slate/70 mb-2">Detected field</p>
                  <span className="text-sm bg-mist text-ink px-3 py-1.5 rounded-lg border border-line">
                    {cv.predicted_category}
                  </span>
                  <p className="text-xs text-slate/70 mt-2">
                    Used to rank the jobs we show you
                  </p>
                </div>
              )}

              {cv.skill_entities?.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs text-slate/70 mb-2">
                    Extracted skills ({cv.skill_entities.length})
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    {cv.skill_entities.map((skill, i) => (
                      <span
                        key={i}
                        className="text-xs bg-indigo-light text-indigo px-2.5 py-1 rounded-full"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3 mb-4">
                <button
                  onClick={handleViewCV}
                  className="text-sm bg-indigo text-white px-4 py-2 rounded-lg hover:bg-indigo-dark transition inline-flex items-center gap-1.5"
                >
                  📄 View CV
                </button>
              </div>
              <details className="group">
                <summary className="text-xs text-indigo hover:underline cursor-pointer list-none">
                  Show extracted text (used for matching)
                </summary>
                <div className="bg-mist rounded-lg p-4 max-h-64 overflow-y-auto mt-2">
                  <p className="text-sm text-slate whitespace-pre-wrap">
                    {cv.extracted_text}
                  </p>
                </div>
              </details>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-slate text-sm mb-4">
                You haven't uploaded a CV yet
              </p>
              <button
                onClick={() => navigate("/cv/upload")}
                className="text-sm bg-indigo text-white px-4 py-2 rounded-lg hover:bg-indigo-dark transition"
              >
                Upload CV
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Profile;
