const {
  normaliseCategory,
  skillOverlap,
  rankScore,
  isRecommended,
  scoreJob,
} = require('./jobRanking');

describe('normaliseCategory', () => {
  it('ignores case, spaces and hyphens', () => {
    expect(normaliseCategory('React Developer')).toBe('REACTDEVELOPER');
    expect(normaliseCategory('react-developer')).toBe('REACTDEVELOPER');
  });

  it('handles a missing category', () => {
    expect(normaliseCategory(null)).toBe('');
    expect(normaliseCategory(undefined)).toBe('');
  });
});

describe('skillOverlap', () => {
  it('is the fraction of required skills the candidate has', () => {
    expect(skillOverlap(['react', 'javascript'], ['react', 'javascript'])).toBe(1);
    expect(skillOverlap(['react', 'javascript'], ['react'])).toBe(0.5);
    expect(skillOverlap(['react'], ['python'])).toBe(0);
  });

  it('compares case-insensitively', () => {
    expect(skillOverlap(['React'], ['react'])).toBe(1);
  });

  it('is zero when the job lists no required skills', () => {
    expect(skillOverlap([], ['react'])).toBe(0);
    expect(skillOverlap(undefined, ['react'])).toBe(0);
  });
});

describe('rankScore', () => {
  it('weights skill overlap above the category bonus', () => {
    // a perfect skill match outside the category beats a weak match inside it
    expect(rankScore(1, false)).toBeGreaterThan(rankScore(0.4, true));
  });

  it('adds the bonus when the category matches', () => {
    expect(rankScore(0.5, true)).toBeCloseTo(0.65);
    expect(rankScore(0.5, false)).toBeCloseTo(0.35);
  });
});

describe('isRecommended', () => {
  it('accepts a strong skill match in any category', () => {
    expect(isRecommended(0.6, false)).toBe(true);
    expect(isRecommended(0.9, false)).toBe(true);
  });

  it('accepts a weaker match inside the predicted category', () => {
    expect(isRecommended(0.4, true)).toBe(true);
  });

  it('rejects a weak match outside the predicted category', () => {
    expect(isRecommended(0.4, false)).toBe(false);
  });

  it('never hides what the old category-filter rule would have shown', () => {
    // old rule was: categoryMatch && overlap >= 0.6
    for (const overlap of [0.6, 0.7, 0.8, 0.9, 1]) {
      expect(isRecommended(overlap, true)).toBe(true);
    }
  });
});

describe('misclassified candidate (regression)', () => {
  // BERT recall for React Developer is 0.56, so roughly 44% of React
  // developers are given some other category. Under the old hard filter those
  // candidates saw no React jobs at all.
  const reactJob = {
    category: 'React Developer',
    required_skills: ['react', 'javascript', 'html', 'css'],
  };
  const candidateSkills = ['react', 'javascript', 'html', 'css', 'redux'];
  const wrongCategoryKey = normaliseCategory('Web Designing');

  it('still recommends the job when the category was predicted wrongly', () => {
    const { overlap, categoryMatch } = scoreJob(
      reactJob,
      candidateSkills,
      wrongCategoryKey,
    );

    expect(categoryMatch).toBe(false);
    expect(overlap).toBe(1);
    expect(isRecommended(overlap, categoryMatch)).toBe(true);
  });

  it('ranks the correct category higher when the prediction is right', () => {
    const right = scoreJob(reactJob, candidateSkills, normaliseCategory('React Developer'));
    const wrong = scoreJob(reactJob, candidateSkills, wrongCategoryKey);

    expect(right.rankScore).toBeGreaterThan(wrong.rankScore);
  });

  it('still hides an unrelated job from the same misclassified candidate', () => {
    const nursingJob = {
      category: 'Health and Fitness',
      required_skills: ['patient care', 'medication administration'],
    };
    const { overlap, categoryMatch } = scoreJob(
      nursingJob,
      candidateSkills,
      wrongCategoryKey,
    );

    expect(isRecommended(overlap, categoryMatch)).toBe(false);
  });
});

describe('candidate with no predicted category', () => {
  it('can still be recommended jobs on skills alone', () => {
    const job = { category: 'Data Science', required_skills: ['python', 'pandas'] };
    const { overlap, categoryMatch } = scoreJob(job, ['python', 'pandas'], '');

    expect(categoryMatch).toBe(false);
    expect(isRecommended(overlap, categoryMatch)).toBe(true);
  });
});
