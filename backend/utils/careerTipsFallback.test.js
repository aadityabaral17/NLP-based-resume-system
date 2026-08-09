const { buildFallbackTips } = require('./careerTipsFallback');

describe('buildFallbackTips', () => {
  it('always returns three tips with bullets', () => {
    const tips = buildFallbackTips({ category: 'Data Science' });

    expect(tips).toHaveLength(3);
    for (const tip of tips) {
      expect(typeof tip.title).toBe('string');
      expect(tip.title.length).toBeGreaterThan(0);
      expect(tip.bullets.length).toBeGreaterThan(0);
    }
  });

  it('works with no arguments at all', () => {
    // the route calls this when everything else has failed, so it must not throw
    expect(() => buildFallbackTips()).not.toThrow();
    expect(buildFallbackTips()).toHaveLength(3);
  });

  it('names the skills the candidate is missing', () => {
    const text = JSON.stringify(
      buildFallbackTips({ missingSkills: ['kubernetes', 'terraform'] })
    );

    expect(text).toContain('kubernetes');
    expect(text).toContain('terraform');
  });

  it('names the jobs the candidate matched', () => {
    const text = JSON.stringify(
      buildFallbackTips({ topMatches: [{ job_title: 'Data Engineer' }] })
    );

    expect(text).toContain('Data Engineer');
  });

  it('mentions the category when there is nothing else to go on', () => {
    const text = JSON.stringify(buildFallbackTips({ category: 'DevOps' }));

    expect(text).toContain('DevOps');
    expect(text).toContain('none identified yet');
  });

  it('caps long lists so a bullet stays readable', () => {
    const many = Array.from({ length: 30 }, (_, i) => `skill${i}`);
    const text = JSON.stringify(buildFallbackTips({ missingSkills: many }));

    expect(text).toContain('skill0');
    expect(text).not.toContain('skill9'); // only the first five are listed
  });

  it('ignores blank and malformed entries', () => {
    const tips = buildFallbackTips({
      missingSkills: ['', '   ', 'sql'],
      topMatches: [{}, { job_title: '' }, { job_title: 'Analyst' }],
    });
    const text = JSON.stringify(tips);

    expect(text).toContain('sql');
    expect(text).toContain('Analyst');
    expect(text).not.toContain('undefined');
    expect(text).not.toContain('null');
  });
});
