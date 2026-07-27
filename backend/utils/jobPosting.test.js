const { normalizePositionsAvailable, ensureJobVacanciesPositionsColumn } = require('./jobPosting');

describe('normalizePositionsAvailable', () => {
  it('defaults to one position when no value is provided', () => {
    expect(normalizePositionsAvailable()).toBe(1);
  });

  it('accepts numeric strings and keeps them positive', () => {
    expect(normalizePositionsAvailable('3')).toBe(3);
    expect(normalizePositionsAvailable('0')).toBe(1);
  });

  it('uses the provided positive integer', () => {
    expect(normalizePositionsAvailable(5)).toBe(5);
  });
});

describe('ensureJobVacanciesPositionsColumn', () => {
  it('runs the schema migration when the database client is available', async () => {
    const pool = {
      query: jest.fn().mockResolvedValue({}),
    };

    await expect(ensureJobVacanciesPositionsColumn(pool)).resolves.toBeUndefined();
    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('positions_available'));
  });
});
