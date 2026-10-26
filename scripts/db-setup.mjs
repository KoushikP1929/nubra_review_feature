/**
 * Nubra Trade Review — sample database setup.
 *
 * Run with: npm run db:setup
 *
 * Creates the positions / orders / executions schema in the Neon PostgreSQL
 * database and fills it with a clearly illustrative sample dataset
 * (cross-referenced months: Aug / Sep / Oct 2026, 6 positions per month).
 *
 * Every position follows the agreed sample-data shape:
 *   - exactly one entry order (status: filled) with one execution (the fill)
 *   - exactly one exit order (status: filled) with one execution (the fill)
 *   - status: closed (fully closed, no partial exits or re-entries)
 *
 * Realized P&L and fees are INGESTED FACTS computed here from raw entry/exit
 * prices at data-creation time, exactly as a broker would report them.
 * Monthly aggregates (net P&L, win rate, average P&L) are NOT stored —
 * the application backend calculates those from the raw rows.
 */

import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

const ENTRY_FEE = 1.0;
const EXIT_FEE = 1.0;

/**
 * E.g. { month: "202608", seq: 1, instrument, dir: "long" | "short", qty,
 *        entryPrice, exitPrice, entryAt, exitAt }
 * Timestamps are ISO strings in UTC (US market hours, business days).
 */
const RAW = [
  // ---------------- August 2026 ----------------
  { month: "202608", seq: 1, instrument: "AAPL", dir: "long",  qty: 100, entryPrice: 231.40, exitPrice: 236.85, entry: "2026-08-03T14:32:41Z", exit: "2026-08-03T19:48:12Z" },
  { month: "202608", seq: 2, instrument: "NVDA", dir: "long",  qty: 50,  entryPrice: 182.30, exitPrice: 176.10, entry: "2026-08-05T14:15:03Z", exit: "2026-08-05T17:22:56Z" },
  { month: "202608", seq: 3, instrument: "MSFT", dir: "long",  qty: 30,  entryPrice: 505.00, exitPrice: 517.60, entry: "2026-08-10T13:41:27Z", exit: "2026-08-10T18:05:44Z" },
  { month: "202608", seq: 4, instrument: "TSLA", dir: "short", qty: 25,  entryPrice: 342.10, exitPrice: 331.75, entry: "2026-08-12T14:03:19Z", exit: "2026-08-12T20:14:02Z" },
  { month: "202608", seq: 5, instrument: "AMZN", dir: "long",  qty: 40,  entryPrice: 221.60, exitPrice: 219.45, entry: "2026-08-18T14:55:38Z", exit: "2026-08-18T16:31:09Z" },
  { month: "202608", seq: 6, instrument: "SPY",  dir: "long",  qty: 10,  entryPrice: 645.20, exitPrice: 648.90, entry: "2026-08-21T13:36:50Z", exit: "2026-08-21T15:57:23Z" },
  // ---------------- September 2026 ----------------
  { month: "202609", seq: 1, instrument: "META", dir: "long",  qty: 15,  entryPrice: 712.30, exitPrice: 730.20, entry: "2026-09-02T14:22:15Z", exit: "2026-09-02T19:36:48Z" },
  { month: "202609", seq: 2, instrument: "AMD",  dir: "long",  qty: 120, entryPrice: 158.45, exitPrice: 144.90, entry: "2026-09-09T13:47:02Z", exit: "2026-09-09T18:29:31Z" },
  { month: "202609", seq: 3, instrument: "NFLX", dir: "long",  qty: 20,  entryPrice: 1085.60, exitPrice: 1112.30, entry: "2026-09-14T15:10:44Z", exit: "2026-09-14T17:41:20Z" },
  { month: "202609", seq: 4, instrument: "NVDA", dir: "long",  qty: 80,  entryPrice: 167.85, exitPrice: 190.40, entry: "2026-09-18T13:38:26Z", exit: "2026-09-18T20:08:13Z" },
  { month: "202609", seq: 5, instrument: "GOOGL", dir: "short", qty: 30,  entryPrice: 228.90, exitPrice: 233.15, entry: "2026-09-23T14:29:57Z", exit: "2026-09-23T16:52:35Z" },
  { month: "202609", seq: 6, instrument: "MSFT", dir: "long",  qty: 25,  entryPrice: 522.40, exitPrice: 520.10, entry: "2026-09-29T13:52:11Z", exit: "2026-09-29T15:24:58Z" },
  // ---------------- October 2026 ----------------
  { month: "202610", seq: 1, instrument: "AAPL", dir: "long",  qty: 60,  entryPrice: 244.90, exitPrice: 251.35, entry: "2026-10-01T14:04:33Z", exit: "2026-10-01T18:44:09Z" },
  { month: "202610", seq: 2, instrument: "TSLA", dir: "long",  qty: 35,  entryPrice: 331.20, exitPrice: 322.60, entry: "2026-10-07T14:18:52Z", exit: "2026-10-07T17:03:47Z" },
  { month: "202610", seq: 3, instrument: "NVDA", dir: "long",  qty: 45,  entryPrice: 178.75, exitPrice: 185.10, entry: "2026-10-13T13:44:18Z", exit: "2026-10-13T19:21:36Z" },
  { month: "202610", seq: 4, instrument: "AMZN", dir: "long",  qty: 55,  entryPrice: 208.15, exitPrice: 214.80, entry: "2026-10-19T14:36:05Z", exit: "2026-10-19T18:59:22Z" },
  { month: "202610", seq: 5, instrument: "META", dir: "short", qty: 10,  entryPrice: 741.60, exitPrice: 736.90, entry: "2026-10-26T14:11:29Z", exit: "2026-10-26T16:18:54Z" },
  { month: "202610", seq: 6, instrument: "COIN", dir: "long",  qty: 18,  entryPrice: 289.40, exitPrice: 275.10, entry: "2026-10-27T14:47:16Z", exit: "2026-10-27T17:35:41Z" },
];

/** A position's realized P&L, as a broker would report it (fees included). */
function realizedPnl(row) {
  const gross =
    row.dir === "long"
      ? row.qty * (row.exitPrice - row.entryPrice)
      : row.qty * (row.entryPrice - row.exitPrice);
  return Number((gross - ENTRY_FEE - EXIT_FEE).toFixed(2));
}

const pad = (n) => String(n).padStart(2, "0");
const idPrefix = (row) => `${row.month}_${pad(row.seq)}`;

async function main() {
  console.log("== Nubra Trade Review: sample database setup ==");
  console.log("Database:", process.env.DATABASE_URL.split("@")[1] || "(unknown)");
  console.log("");

  // -- Schema (recreated from scratch so re-runs start clean) --------------
  console.log("Recreating schema...");
  await sql`DROP TABLE IF EXISTS executions CASCADE`;
  await sql`DROP TABLE IF EXISTS orders CASCADE`;
  await sql`DROP TABLE IF EXISTS positions CASCADE`;

  await sql`
    CREATE TABLE positions (
      id            TEXT PRIMARY KEY,
      instrument    TEXT NOT NULL,
      side          TEXT NOT NULL CHECK (side IN ('long', 'short')),
      quantity      DOUBLE PRECISION NOT NULL CHECK (quantity > 0),
      status        TEXT NOT NULL CHECK (status IN ('closed')),
      opened_at     TIMESTAMPTZ NOT NULL,
      closed_at     TIMESTAMPTZ NOT NULL,
      realized_pnl  DOUBLE PRECISION NOT NULL,
      fees_total    DOUBLE PRECISION NOT NULL
    )
  `;
  await sql`
    CREATE TABLE orders (
      id          TEXT PRIMARY KEY,
      position_id TEXT NOT NULL REFERENCES positions (id) ON DELETE CASCADE,
      instrument  TEXT NOT NULL,
      side        TEXT NOT NULL CHECK (side IN ('buy', 'sell')),
      order_type  TEXT NOT NULL CHECK (order_type IN ('market', 'limit')),
      quantity    DOUBLE PRECISION NOT NULL CHECK (quantity > 0),
      status      TEXT NOT NULL CHECK (status IN ('filled')),
      created_at  TIMESTAMPTZ NOT NULL
    )
  `;
  await sql`
    CREATE TABLE executions (
      id          TEXT PRIMARY KEY,
      order_id    TEXT NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
      position_id TEXT NOT NULL REFERENCES positions (id) ON DELETE CASCADE,
      instrument  TEXT NOT NULL,
      side        TEXT NOT NULL CHECK (side IN ('buy', 'sell')),
      quantity    DOUBLE PRECISION NOT NULL CHECK (quantity > 0),
      price       DOUBLE PRECISION NOT NULL CHECK (price > 0),
      fees        DOUBLE PRECISION NOT NULL,
      executed_at TIMESTAMPTZ NOT NULL
    )
  `;
  await sql`CREATE INDEX idx_positions_closed_at ON positions (closed_at)`;
  await sql`CREATE INDEX idx_orders_position_id ON orders (position_id)`;
  await sql`CREATE INDEX idx_executions_position_id ON executions (position_id)`;
  console.log("Schema created: positions, orders, executions (+3 lookup indexes)");

  // -- Sample data ---------------------------------------------------------
  console.log(`Inserting ${RAW.length} illustrative positions...`);
  for (const row of RAW) {
    const pfx = idPrefix(row);
    const posId = `pos_${pfx}`;
    const entryOrderId = `ord_${pfx}_entry`;
    const exitOrderId = `ord_${pfx}_exit`;
    const entrySide = row.dir === "long" ? "buy" : "sell";
    const exitSide = row.dir === "long" ? "sell" : "buy";
    const pnl = realizedPnl(row);

    await sql`
      INSERT INTO positions (id, instrument, side, quantity, status, opened_at, closed_at, realized_pnl, fees_total)
      VALUES (${posId}, ${row.instrument}, ${row.dir}, ${row.qty}, 'closed', ${row.entry}, ${row.exit}, ${pnl}, ${ENTRY_FEE + EXIT_FEE})
    `;
    await sql`
      INSERT INTO orders (id, position_id, instrument, side, order_type, quantity, status, created_at)
      VALUES
        (${entryOrderId}, ${posId}, ${row.instrument}, ${entrySide}, 'market', ${row.qty}, 'filled', ${row.entry}),
        (${exitOrderId},  ${posId}, ${row.instrument}, ${exitSide}, 'market', ${row.qty}, 'filled', ${row.exit})
    `;
    await sql`
      INSERT INTO executions (id, order_id, position_id, instrument, side, quantity, price, fees, executed_at)
      VALUES
        (${`exec_${pfx}_entry`}, ${entryOrderId}, ${posId}, ${row.instrument}, ${entrySide}, ${row.qty}, ${row.entryPrice}, ${ENTRY_FEE}, ${row.entry}),
        (${`exec_${pfx}_exit`},  ${exitOrderId},  ${posId}, ${row.instrument}, ${exitSide},  ${row.qty}, ${row.exitPrice},  ${EXIT_FEE},  ${row.exit})
    `;
  }
  console.log("Sample data inserted.\n");

  // -- Verification printout (plain SELECTs only — no app analytics logic) --
  const counts = await sql`
    SELECT
      (SELECT count(*) FROM positions)  AS positions,
      (SELECT count(*) FROM orders)     AS orders,
      (SELECT count(*) FROM executions) AS executions
  `;
  console.log("Row counts:", counts[0]);

  const sample = await sql`
    SELECT p.instrument, p.side, p.quantity, p.status,
           p.opened_at, p.closed_at, p.realized_pnl, p.fees_total,
           (SELECT count(*) FROM orders o WHERE o.position_id = p.id) AS order_count,
           (SELECT count(*) FROM executions e WHERE e.position_id = p.id) AS execution_count
    FROM positions p
    ORDER BY p.closed_at
    LIMIT 6
  `;
  console.log("");
  console.log("Sample positions (first 6 of 18):");
  console.table(sample.map((r) => ({
    instrument: r.instrument,
    side: r.side,
    qty: r.quantity,
    "opened (UTC)": new Date(r.opened_at).toISOString().slice(0, 16).replace("T", " "),
    "closed (UTC)": new Date(r.closed_at).toISOString().slice(0, 16).replace("T", " "),
    "realized P&L (USD)": r.realized_pnl,
    fees: r.fees_total,
    orders: r.order_count,
    executions: r.execution_count,
    status: r.status,
  })));

  console.log("Setup complete. Sample data is clearly illustrative (Aug/Sep/Oct 2026).");
}

main().catch((err) => {
  console.error("db:setup FAILED:", err.message || err);
  process.exit(1);
});
