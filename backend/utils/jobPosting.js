function normalizePositionsAvailable(value) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }

  return Math.floor(parsed);
}

// A vacancy is only listed while `deadline >= CURRENT_DATE`, so a typo in the
// year silently creates a posting that never expires. One got stored with the
// year 71231 during testing. Reject anything that is not a real date inside a
// sensible hiring window instead of passing it straight to the INSERT.
const MAX_DEADLINE_YEARS_AHEAD = 2;

function validateDeadline(value) {
  if (value === undefined || value === null || value === "") {
    return { ok: true, value: null };
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return { ok: false, message: "Deadline is not a valid date" };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (parsed < today) {
    return { ok: false, message: "Deadline must not be in the past" };
  }

  const latest = new Date(today);
  latest.setFullYear(latest.getFullYear() + MAX_DEADLINE_YEARS_AHEAD);
  if (parsed > latest) {
    return {
      ok: false,
      message: `Deadline must be within ${MAX_DEADLINE_YEARS_AHEAD} years`,
    };
  }

  return { ok: true, value: parsed.toISOString().slice(0, 10) };
}

async function ensureJobVacanciesPositionsColumn(pool) {
  try {
    await pool.query(`
      ALTER TABLE job_vacancies
      ADD COLUMN IF NOT EXISTS positions_available INTEGER NOT NULL DEFAULT 1
    `);
  } catch (error) {
    if (error?.message && error.message.includes("does not exist")) {
      return;
    }
    throw error;
  }
}

module.exports = {
  normalizePositionsAvailable,
  validateDeadline,
  ensureJobVacanciesPositionsColumn,
};
