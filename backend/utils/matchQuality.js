/**
 * Descriptive band for a match score.
 *
 * The matched-jobs list used to be filtered by the candidate's predicted
 * category, and that filter was implicitly acting as a quality gate: same
 * category jobs were usually reasonable matches, so nothing obviously poor
 * appeared. When the category became a ranking signal rather than a filter,
 * that gate disappeared and weak matches — a 19% score, for instance — began
 * showing under a heading that promises "jobs matching your profile".
 *
 * Rather than hiding them again, which is what caused misclassified candidates
 * to see nothing at all, every result is returned with an honest label so the
 * interface can present a weak match as weak.
 */

const STRONG = 0.6;
const MODERATE = 0.4;

function matchQuality(score) {
  const value = Number(score);
  if (!Number.isFinite(value)) return "weak";
  if (value >= STRONG) return "strong";
  if (value >= MODERATE) return "moderate";
  return "weak";
}

module.exports = { matchQuality, STRONG, MODERATE };
