import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";

function CandidateProfile() {
  const { user_id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [cv, setCv] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchProfile();
  }, [user_id]);

  const fetchProfile = async () => {
    try {
      const res = await api.get(`/profile/${user_id}`);
      setProfile(res.data.profile);
      setCv(res.data.cv);
    } catch (err) {
      setError(err.response?.data?.error?.message || "Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  const handleViewCV = async () => {
    try {
      const res = await api.get(`/cv/file/${user_id}`, {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(res.data);
      window.open(url, "_blank");
    } catch (err) {
      console.error("Error viewing CV:", err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-mist flex items-center justify-center">
        <p className="text-slate">Loading profile...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-mist flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl border border-line p-8 text-center max-w-md">
          <p className="text-danger mb-4">{error}</p>
          <button
            onClick={() => navigate("/dashboard/organisation")}
            className="text-sm text-indigo hover:underline"
          >
            Back to dashboard
          </button>
        </div>
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
        <div className="mb-6">
          <h2 className="font-serif text-2xl text-ink">Candidate profile</h2>
          <p className="text-slate text-sm mt-1">Reviewing applicant details</p>
        </div>

        {/* Basic info card */}
        <div className="bg-white rounded-2xl border border-line p-6 mb-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-full bg-indigo-light flex items-center justify-center shrink-0">
              <span className="font-serif text-2xl text-indigo">
                {profile?.name?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <p className="font-medium text-ink text-lg">{profile?.name}</p>
              <p className="text-sm text-slate">{profile?.email}</p>
            </div>
          </div>

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
        </div>

        {/* CV card */}
        <div className="bg-white rounded-2xl border border-line p-6">
          <h3 className="font-serif text-lg text-ink mb-4">Resume</h3>

          {cv ? (
            <div>
              <p className="text-xs text-slate/70 mb-3">
                Uploaded: {new Date(cv.uploaded_at).toLocaleDateString()}
              </p>

              <button
                onClick={handleViewCV}
                className="text-sm bg-indigo text-white px-4 py-2 rounded-lg hover:bg-indigo-dark transition inline-flex items-center gap-1.5 mb-4"
              >
                📄 View CV
              </button>

              {cv.skill_entities?.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs text-slate/70 mb-2">Extracted skills</p>
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

              <details>
                <summary className="text-xs text-indigo hover:underline cursor-pointer list-none">
                  Show extracted text
                </summary>
                <div className="bg-mist rounded-lg p-4 max-h-64 overflow-y-auto mt-2">
                  <p className="text-sm text-slate whitespace-pre-wrap">
                    {cv.extracted_text}
                  </p>
                </div>
              </details>
            </div>
          ) : (
            <p className="text-slate text-sm">No CV uploaded</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default CandidateProfile;
