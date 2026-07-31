const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

pool.on("error", (err) => {
  console.error("Unexpected error on idle client", err);
  process.exit(-1);
  const { Pool } = require("pg");

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false,
    },
    // Explicit tuning so a bad/stuck connection fails fast and visibly instead
    // of hanging a request forever (the pg defaults leave connectionTimeoutMillis
    // at 0, meaning "wait indefinitely" — that's what turns a dropped Supabase
    // pooler connection into a silent hang instead of a quick, loggable error).
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

  // A dropped/errored IDLE client is routine housekeeping — Supabase's pooler
  // recycles idle connections in the background, and `pg.Pool` automatically
  // discards the bad client and opens a fresh one on the next checkout. This
  // should only ever be logged, never used to crash the process: exiting here
  // takes down the entire server on a completely normal, recoverable event,
  // which is what was causing the silent full-outages requiring manual restarts.
  pool.on("error", (err) => {
    console.error("Unexpected error on idle Postgres client:", err.message);
  });

  module.exports = pool;
});

module.exports = pool;
