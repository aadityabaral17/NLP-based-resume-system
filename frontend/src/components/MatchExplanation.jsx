import { useState } from "react";
import api from "../api/axios";

/**
 * "Why this match?" for one candidate.
 *
 * Loaded on click rather than with the candidate list: each explanation costs
 * a second or two of local LLM time, and a recruiter only reads a few of them.
 *
 * The strengths and gaps shown here come from the stored match result, not from
 * the language model — only the summary sentence is generated.
 */
function MatchExplanation({ matchId }) {
  const [explanation, setExplanation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);

  const handleToggle = async () => {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);

    if (explanation || loading) return;

    setLoading(true);
    setFailed(false);
    try {
      const res = await api.get(`/match/candidates/${matchId}/explanation`);
      setExplanation(res.data.explanation);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={handleToggle}
        className="text-sm text-indigo hover:underline"
      >
        {open ? "Hide reasoning" : "Why this match?"}
      </button>

      {open && (
        <div className="mt-2 bg-mist rounded-lg p-4 border border-line">
          {loading && (
            <p className="text-sm text-slate">Analysing this match...</p>
          )}

          {failed && (
            <p className="text-sm text-slate">
              Could not generate an explanation. The match score above is
              unaffected.
            </p>
          )}

          {explanation && (
            <>
              <p className="text-sm text-ink">{explanation.summary}</p>

              {explanation.strengths?.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-medium text-slate mb-1.5">
                    Required skills the candidate has
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {explanation.strengths.map((skill) => (
                      <span
                        key={skill}
                        className="text-xs bg-white text-ink px-2 py-1 rounded border border-line"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {explanation.gaps?.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-medium text-slate mb-1.5">
                    Required skills not found
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {explanation.gaps.map((skill) => (
                      <span
                        key={skill}
                        className="text-xs bg-amber-light text-amber px-2 py-1 rounded"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default MatchExplanation;
