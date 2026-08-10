const { matchQuality, STRONG, MODERATE } = require('./matchQuality');

describe('matchQuality', () => {
  it('labels a high score as strong', () => {
    expect(matchQuality(0.9)).toBe('strong');
    expect(matchQuality(0.64)).toBe('strong');
  });

  it('labels a mid score as moderate', () => {
    expect(matchQuality(0.5)).toBe('moderate');
    expect(matchQuality(0.41)).toBe('moderate');
  });

  it('labels a low score as weak', () => {
    // the 19% match that appeared under "jobs matching your profile"
    expect(matchQuality(0.19)).toBe('weak');
    expect(matchQuality(0)).toBe('weak');
  });

  it('treats the boundaries as inclusive', () => {
    expect(matchQuality(STRONG)).toBe('strong');
    expect(matchQuality(MODERATE)).toBe('moderate');
  });

  it('never throws on missing or malformed input', () => {
    // the label is rendered directly, so it must always be one of the three
    for (const bad of [undefined, null, NaN, 'abc', {}, []]) {
      expect(['strong', 'moderate', 'weak']).toContain(matchQuality(bad));
    }
  });

  it('accepts a numeric string', () => {
    expect(matchQuality('0.85')).toBe('strong');
  });
});
