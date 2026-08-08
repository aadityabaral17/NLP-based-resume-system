const { Pool } = require("pg");

const connectionString = process.env.DATABASE_URL || "";

// Hosted Postgres (Supabase, Neon, RDS) requires TLS; a local or containerised
// Postgres refuses it outright with "The server does not support SSL
// connections". Decide from the connection string, and allow an explicit
// override via DATABASE_SSL=true|false.
function shouldUseSsl() {
  const override = (process.env.DATABASE_SSL || "").toLowerCase();
  if (override === "true") return true;
  if (override === "false") return false;

  if (/sslmode=disable/i.test(connectionString)) return false;

  const isLocal = /@(localhost|127\.0\.0\.1|\[::1\]|host\.docker\.internal)[:/]/i.test(
    connectionString
  );
  return !isLocal;
}

const pool = new Pool({
  connectionString,
  ssl: shouldUseSsl() ? { rejectUnauthorized: false } : false,

  // Explicit tuning so a bad or stuck connection fails fast and visibly instead
  // of hanging a request forever. The pg default leaves connectionTimeoutMillis
  // at 0, meaning "wait indefinitely", which turns a dropped pooler connection
  // into a silent hang rather than a quick, loggable error.
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// A dropped or errored IDLE client is routine housekeeping: hosted poolers
// recycle idle connections in the background, and pg.Pool discards the bad
// client and opens a fresh one on the next checkout. This must only ever be
// logged. Calling process.exit() here takes the whole server down on a
// completely normal, recoverable event.
pool.on("error", (err) => {
  console.error("Unexpected error on idle Postgres client:", err.message);
});

module.exports = pool;
