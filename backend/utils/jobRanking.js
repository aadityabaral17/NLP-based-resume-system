/**
 * Ranking rules for showing vacancies to a job seeker.
 *
 * The CV's predicted_category comes from the fine-tuned BERT classifier. It is
 * a useful signal but not a reliable one: measured on the held-out test split
 * its recall is 0.56 for React Developer and 0.69 for Management
 * (nlp-service/BERT_REPORT.md). Treating it as a filter meant a misclassified
 * candidate saw none of the jobs they were actually suited to.
 *
 * So the category ranks rather than filters, and skill overlap can carry a job
 * to the top on its own when the classifier gets the category wrong.
 */

/** Categories are compared ignoring case, spaces and hyphens. */
function normaliseCategory(value) {
  return (value || "").toUpperCase().replace(/[-\s]/g, "");
}

/** Fraction of the job's required skills the candidate has (0 when none listed). */
function skillOverlap(requiredSkills, candidateSkills) {
  const required = (requiredSkills || []).map((s) => String(s).toLowerCase());
  if (required.length === 0) return 0;

  const owned = new Set((candidateSkills || []).map((s) => String(s).toLowerCase()));
  const matched = required.filter((s) => owned.has(s));
  return matched.length / required.length;
}

/**
 * Combined ranking score. Skill overlap dominates; being in the predicted
 * category is worth a fixed bonus.
 */
function rankScore(overlap, categoryMatch) {
  return overlap * 0.7 + (categoryMatch ? 0.3 : 0);
}

/**
 * Should this vacancy appear in the recommended list?
 *
 * Deliberately a superset of the old rule (`categoryMatch && overlap >= 0.6`),
 * so switching to it can only add vacancies, never remove one that used to
 * show. A strong skill match now surfaces regardless of category.
 */
function isRecommended(overlap, categoryMatch) {
  if (overlap >= 0.6) return true;
  return categoryMatch && overlap >= 0.4;
}

/** Score one vacancy against one candidate. */
function scoreJob(job, candidateSkills, candidateCategoryKey) {
  const overlap = skillOverlap(job.required_skills, candidateSkills);
  const categoryMatch =
    Boolean(candidateCategoryKey) &&
    normaliseCategory(job.category) === candidateCategoryKey;

  return {
    overlap,
    categoryMatch,
    rankScore: rankScore(overlap, categoryMatch),
  };
}

module.exports = {
  normaliseCategory,
  skillOverlap,
  rankScore,
  isRecommended,
  scoreJob,
};
