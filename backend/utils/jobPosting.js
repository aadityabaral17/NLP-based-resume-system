function normalizePositionsAvailable(value) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }

  return Math.floor(parsed);
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
  ensureJobVacanciesPositionsColumn,
};
