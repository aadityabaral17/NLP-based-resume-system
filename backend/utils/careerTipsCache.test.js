const {
  buildTipsCacheKey,
  serialiseTips,
  readCachedTips,
} = require('./careerTipsCache');

const TIPS = [{ title: 'Skill Development', bullets: ['Learn Kubernetes'] }];

describe('buildTipsCacheKey', () => {
  it('is stable for the same inputs', () => {
    const input = { category: 'Data Science', cvSkills: ['python'] };
    expect(buildTipsCacheKey(input)).toBe(buildTipsCacheKey(input));
  });

  it('ignores ordering, case and duplicates in skill lists', () => {
    const a = buildTipsCacheKey({ category: 'X', cvSkills: ['python', 'sql'] });
    const b = buildTipsCacheKey({ category: 'X', cvSkills: ['SQL', 'Python', 'sql'] });
    expect(a).toBe(b);
  });

  it('changes when the category changes', () => {
    expect(buildTipsCacheKey({ category: 'Data Science' })).not.toBe(
      buildTipsCacheKey({ category: 'DevOps' })
    );
  });

  it('changes when the candidate gains a skill', () => {
    const before = buildTipsCacheKey({ category: 'X', cvSkills: ['python'] });
    const after = buildTipsCacheKey({ category: 'X', cvSkills: ['python', 'docker'] });
    expect(before).not.toBe(after);
  });

  it('changes when the missing skills change', () => {
    const before = buildTipsCacheKey({ category: 'X', missingSkills: ['aws'] });
    const after = buildTipsCacheKey({ category: 'X', missingSkills: ['gcp'] });
    expect(before).not.toBe(after);
  });

  it('changes when the matched job titles change', () => {
    const before = buildTipsCacheKey({ category: 'X', topMatches: [{ job_title: 'Dev' }] });
    const after = buildTipsCacheKey({ category: 'X', topMatches: [{ job_title: 'Analyst' }] });
    expect(before).not.toBe(after);
  });

  it('copes with missing or empty input', () => {
    expect(typeof buildTipsCacheKey()).toBe('string');
    expect(typeof buildTipsCacheKey({})).toBe('string');
  });
});

describe('readCachedTips', () => {
  it('returns the tips when the fingerprint matches', () => {
    const key = buildTipsCacheKey({ category: 'X', cvSkills: ['python'] });
    expect(readCachedTips(serialiseTips(key, TIPS), key)).toEqual(TIPS);
  });

  it('misses when the inputs have changed', () => {
    const oldKey = buildTipsCacheKey({ category: 'X', cvSkills: ['python'] });
    const newKey = buildTipsCacheKey({ category: 'X', cvSkills: ['python', 'docker'] });
    expect(readCachedTips(serialiseTips(oldKey, TIPS), newKey)).toBeNull();
  });

  it('misses on legacy free-text content instead of throwing', () => {
    expect(readCachedTips('Learn more Python!', 'anykey')).toBeNull();
    expect(readCachedTips('{broken json', 'anykey')).toBeNull();
  });

  it('misses on empty, null or non-string values', () => {
    expect(readCachedTips(null, 'k')).toBeNull();
    expect(readCachedTips('', 'k')).toBeNull();
    expect(readCachedTips({ tips: TIPS }, 'k')).toBeNull();
  });

  it('misses when the stored tips are empty', () => {
    const key = 'k';
    expect(readCachedTips(serialiseTips(key, []), key)).toBeNull();
  });
});

describe('serialiseTips', () => {
  it('records when the tips were generated', () => {
    const stored = JSON.parse(serialiseTips('k', TIPS));
    expect(stored.cache_key).toBe('k');
    expect(stored.tips).toEqual(TIPS);
    expect(Date.parse(stored.generated_at)).not.toBeNaN();
  });
});
