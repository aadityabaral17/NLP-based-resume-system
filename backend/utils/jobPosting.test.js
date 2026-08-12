const {
  normalizePositionsAvailable,
  validateDeadline,
  ensureJobVacanciesPositionsColumn,
} = require('./jobPosting');

describe('validateDeadline', () => {
  const daysFromNow = (n) => {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  };

  it('treats a missing deadline as no deadline', () => {
    expect(validateDeadline(undefined)).toEqual({ ok: true, value: null });
    expect(validateDeadline('')).toEqual({ ok: true, value: null });
  });

  it('accepts a date inside the hiring window', () => {
    const result = validateDeadline(daysFromNow(30));
    expect(result.ok).toBe(true);
    expect(result.value).toBe(daysFromNow(30));
  });

  it('accepts today, so a same-day deadline still lists the vacancy', () => {
    expect(validateDeadline(daysFromNow(0)).ok).toBe(true);
  });

  it('rejects a date that is not parseable', () => {
    expect(validateDeadline('not a date').ok).toBe(false);
  });

  it('rejects a deadline in the past', () => {
    const result = validateDeadline(daysFromNow(-1));
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/past/i);
  });

  // a mistyped year created a vacancy that never expired, because listings are
  // filtered with `deadline >= CURRENT_DATE`
  it('rejects an absurd year far in the future', () => {
    const result = validateDeadline('71231-02-20');
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/within/i);
  });

  it('rejects a date beyond the two year window', () => {
    expect(validateDeadline(daysFromNow(365 * 3)).ok).toBe(false);
  });
});

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
