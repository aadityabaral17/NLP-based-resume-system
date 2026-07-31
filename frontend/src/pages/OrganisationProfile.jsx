import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";

const COMPANY_SIZE_OPTIONS = ["1-10", "11-50", "51-200", "201-500", "500+"];

function OrganisationProfile() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [formData, setFormData] = useState({
    company_name: "",
    tagline: "",
    company_size: "",
    founded_year: "",
    headquarters: "",
    about: "",
    contact_email: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState("");

  const getMissingFields = () => {
    if (!profile) return [];
    const missing = [];
    if (!profile.tagline) missing.push("Tagline");
    if (!profile.company_size) missing.push("Company size");
    if (!profile.founded_year) missing.push("Founded year");
    if (!profile.headquarters) missing.push("Headquarters");
    if (!profile.about) missing.push("About");
    if (!profile.contact_email) missing.push("Contact email");
    return missing;
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await api.get("/organisations/profile");
      setProfile(res.data.profile);
      setFormData({
        company_name: res.data.profile.company_name || "",
        tagline: res.data.profile.tagline || "",
        company_size: res.data.profile.company_size || "",
        founded_year: res.data.profile.founded_year || "",
        headquarters: res.data.profile.headquarters || "",
        about: res.data.profile.about || "",
        contact_email: res.data.profile.contact_email || "",
      });
    } catch (err) {
      console.error("Error fetching organisation profile:", err);
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
      const res = await api.put("/organisations/profile", formData);
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
          onClick={() => navigate("/dashboard/organisation")}
          className="text-sm text-slate hover:text-indigo transition"
        >
          Back to dashboard
        </button>
      </nav>

      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-6 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
          <div>
            <h2 className="font-serif text-2xl text-ink">
              Organisation profile
            </h2>
            <p className="text-slate text-sm mt-1">
              Manage how job seekers see your organisation
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
              Complete your organisation profile
            </p>
            <p className="text-xs text-amber/80 mt-1">
              Missing: {getMissingFields().join(", ")}
            </p>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-line p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-full bg-indigo-light flex items-center justify-center">
              <span className="font-serif text-2xl text-indigo">
                {profile?.company_name?.charAt(0).toUpperCase() || "?"}
              </span>
            </div>
            <div>
              <p className="font-medium text-ink text-lg">
                {profile?.company_name}
              </p>
              <p className="text-sm text-slate">{user?.email}</p>
            </div>
          </div>

          {!editing ? (
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate/70 mb-1">Tagline</p>
                <p className="text-sm text-ink">{profile?.tagline || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-slate/70 mb-1">Company size</p>
                <p className="text-sm text-ink">
                  {profile?.company_size
                    ? `${profile.company_size} employees`
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate/70 mb-1">Founded year</p>
                <p className="text-sm text-ink">
                  {profile?.founded_year || "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate/70 mb-1">Headquarters</p>
                <p className="text-sm text-ink">
                  {profile?.headquarters || "—"}
                </p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-xs text-slate/70 mb-1">About</p>
                <p className="text-sm text-ink whitespace-pre-wrap">
                  {profile?.about || "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate/70 mb-1">Contact email</p>
                <p className="text-sm text-ink">
                  {profile?.contact_email || "—"}
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className={labelClass}>Company name</label>
                <input
                  type="text"
                  name="company_name"
                  value={formData.company_name}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>One-line tagline</label>
                <input
                  type="text"
                  name="tagline"
                  value={formData.tagline}
                  onChange={handleChange}
                  placeholder="What your company does, in one sentence"
                  className={inputClass}
                />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Company size</label>
                  <select
                    name="company_size"
                    value={formData.company_size}
                    onChange={handleChange}
                    className={inputClass}
                  >
                    <option value="">Select size</option>
                    {COMPANY_SIZE_OPTIONS.map((size) => (
                      <option key={size} value={size}>
                        {size} employees
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Founded year</label>
                  <input
                    type="number"
                    name="founded_year"
                    min="1800"
                    max={new Date().getFullYear()}
                    placeholder="e.g. 2019"
                    value={formData.founded_year}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </div>
              </div>
              <div>
                <label className={labelClass}>Headquarters location</label>
                <input
                  type="text"
                  name="headquarters"
                  placeholder="City, Country"
                  value={formData.headquarters}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>About</label>
                <textarea
                  name="about"
                  rows={4}
                  value={formData.about}
                  onChange={handleChange}
                  placeholder="Tell job seekers about your organisation..."
                  className={`${inputClass} resize-none`}
                />
              </div>
              <div>
                <label className={labelClass}>Contact email</label>
                <input
                  type="email"
                  name="contact_email"
                  placeholder="hiring@yourcompany.com"
                  value={formData.contact_email}
                  onChange={handleChange}
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
      </div>
    </div>
  );
}

export default OrganisationProfile;
