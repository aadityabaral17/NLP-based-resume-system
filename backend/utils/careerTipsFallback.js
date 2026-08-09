/**
 * Career tips built from data the backend already has, with no LLM involved.
 *
 * The NLP service has its own fallback for when the language model is off, but
 * that only helps while the Python service itself is reachable. If it is down,
 * restarting, or slow, the backend used to return a 500 and the candidate saw
 * "Career guidance is unavailable" — the useful advice was sitting behind the
 * very service that had failed.
 *
 * These tips are worse than the generated ones, but they are specific enough to
 * be worth reading and they always work.
 */

function list(items, limit, fallbackText) {
  const cleaned = (items || [])
    .map((s) => String(s).trim())
    .filter(Boolean)
    .slice(0, limit);
  return cleaned.length ? cleaned.join(", ") : fallbackText;
}

function buildFallbackTips({
  category = "your field",
  cvSkills = [],
  missingSkills = [],
  topMatches = [],
} = {}) {
  const missingSummary = list(missingSkills, 5, "none identified yet");
  const skillsSummary = list(cvSkills, 5, "the skills on your CV");
  const titles = (topMatches || [])
    .map((m) => m && m.job_title)
    .filter(Boolean);
  const matchesSummary = list(titles, 3, `roles in ${category}`);

  return [
    {
      title: "Skill Development",
      bullets: [
        `Focus on the skills you are missing most often: ${missingSummary}`,
        `Build one small project that combines them with ${skillsSummary}`,
      ],
    },
    {
      title: "Job Search Strategy",
      bullets: [
        `Target roles similar to: ${matchesSummary}`,
        "Put your strongest matching skills in the top third of your CV",
      ],
    },
    {
      title: "Career Growth",
      bullets: [
        "Set a three month goal to close your largest skill gap",
        `Follow companies hiring in ${category} to see which skills keep appearing`,
      ],
    },
  ];
}

module.exports = { buildFallbackTips };
