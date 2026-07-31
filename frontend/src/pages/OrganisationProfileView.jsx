import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../api/axios";

function OrganisationProfileView() {
  const { org_id } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [activePostings, setActivePostings] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org_id]);

  const fetchProfile = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get(`/organisations/${org_id}`);
      setProfile(res.data.profile);
      setActivePostings(res.data.active_postings || 0);
    } catch (err) {
      setError(
        err.response?.data?.error?.message ||
          "Could not load this organisation",
      );
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-mist flex items-center justify-center">
        <p className="text-slate">Loading organisation...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-mist">
      <nav className="bg-white border-b border-line px-4 sm:px-6 py-3 sm:py-4 flex flex-wrap justify-between items-center gap-3">
        <span className="font-serif text-lg text-ink">ResumeMatch</span>
        <button
          onClick={() => navigate(-1)}
          className="text-sm text-slate hover:text-indigo transition"
        >
          ← Back
        </button>
      </nav>

      <div className="max-w-3xl mx-auto px-4 py-8">
        {error ? (
          <div className="bg-white rounded-2xl border border-line p-8 text-center">
            <p className="text-slate">{error}</p>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <h2 className="font-serif text-2xl text-ink">
                About this organisation
              </h2>
              <p className="text-slate text-sm mt-1">
                What job seekers see before applying
              </p>
            </div>

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
                  {profile?.tagline && (
                    <p className="text-sm text-slate">{profile.tagline}</p>
                  )}
                </div>
              </div>

              <div className="grid sm:grid-cols-3 gap-4 mb-6">
                <div className="bg-mist rounded-xl p-4 text-center">
                  <p className="font-serif text-xl text-indigo">
                    {profile?.company_size || "—"}
                  </p>
                  <p className="text-xs text-slate mt-1">Company size</p>
                </div>
                <div className="bg-mist rounded-xl p-4 text-center">
                  <p className="font-serif text-xl text-ink">
                    {profile?.founded_year || "—"}
                  </p>
                  <p className="text-xs text-slate mt-1">Founded</p>
                </div>
                <div className="bg-mist rounded-xl p-4 text-center">
                  <p className="font-serif text-xl text-amber">
                    {activePostings}
                  </p>
                  <p className="text-xs text-slate mt-1">Active postings</p>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate/70 mb-1">Headquarters</p>
                  <p className="text-sm text-ink">
                    {profile?.headquarters || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate/70 mb-1">Contact email</p>
                  <p className="text-sm text-ink">
                    {profile?.contact_email || "—"}
                  </p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-xs text-slate/70 mb-1">About</p>
                  <p className="text-sm text-ink whitespace-pre-wrap">
                    {profile?.about || "—"}
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default OrganisationProfileView;
