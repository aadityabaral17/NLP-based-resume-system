/**
 * Caching for LLM-generated career tips.
 *
 * Generating tips costs a few seconds of local LLM time. The answer only
 * changes when the inputs change — the candidate's category, their skills, the
 * skills they keep missing, or the jobs they match. So the tips are stored in
 * cvs.career_tips together with a fingerprint of those inputs, and regenerated
 * only when the fingerprint no longer matches.
 *
 * The column is TEXT and previously held free-form content, so readCachedTips
 * treats anything it cannot recognise as "no cache" rather than throwing.
 */

const crypto = require('crypto');

/**
 * Fingerprint of everything the tips depend on.
 * Skill lists are sorted so that a reordered array is still a cache hit.
 */
function buildTipsCacheKey({
  category,
  cvSkills = [],
  missingSkills = [],
  topMatches = [],
} = {}) {
  const normalise = (list) =>
    [...new Set((list || []).map((s) => String(s).toLowerCase().trim()))]
      .filter(Boolean)
      .sort();

  const payload = JSON.stringify({
    category: String(category || '').toLowerCase(),
    cvSkills: normalise(cvSkills),
    missingSkills: normalise(missingSkills),
    jobTitles: normalise((topMatches || []).map((m) => m && m.job_title)),
  });

  return crypto.createHash('sha256').update(payload).digest('hex').slice(0, 32);
}

/** Shape stored in the cvs.career_tips column. */
function serialiseTips(cacheKey, tips) {
  return JSON.stringify({
    cache_key: cacheKey,
    generated_at: new Date().toISOString(),
    tips,
  });
}

/**
 * Return the cached tips when they were generated from the same inputs,
 * otherwise null. Never throws: bad or legacy content just misses the cache.
 */
function readCachedTips(rawColumnValue, cacheKey) {
  if (!rawColumnValue || typeof rawColumnValue !== 'string') return null;

  let parsed;
  try {
    parsed = JSON.parse(rawColumnValue);
  } catch {
    return null; // legacy free-text content
  }

  if (!parsed || typeof parsed !== 'object') return null;
  if (parsed.cache_key !== cacheKey) return null;
  if (!Array.isArray(parsed.tips) || parsed.tips.length === 0) return null;

  return parsed.tips;
}

module.exports = {
  buildTipsCacheKey,
  serialiseTips,
  readCachedTips,
};
