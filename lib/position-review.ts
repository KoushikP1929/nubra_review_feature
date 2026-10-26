/**
 * Nubra Trade Review — backend data layer (shared by all API routes).
 *
 * Responsibilities:
 *  - Validate API inputs (calendar month, position id).
 *  - Run parameterized raw SQL against the Neon PostgreSQL database
 *    (@neondatabase/serverless HTTP driver — no ORM).
 *  - Compute ALL review analytics from stored facts at request time.
 *    No monthly aggregate (net P&L, win rate, average P&L) is stored in
 *    the database; nothing is ever calculated on the frontend.
 *
 * Calculation rules agreed with the product owner:
 *  - A "winner" is a position with realized P&L strictly greater than 0.
 *    Break-even positions (P&L = 0) count as neither win nor loss.
 *  - Monetary figures and win rate are rounded to 2 decimals.
 *  - Daily P&L groups positions by the UTC calendar day of `closed_at`.
 *
 * Typing note: in this driver version `sql.query()` has no row-type generic
 * — it returns rows as Record<string, any>[]. Each function therefore
 * receives rows untyped and immediately maps them into explicitly shaped
 * response objects with Number()/new Date() conversions.
 */

import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL ?? "");

type Row = Record<string, unknown>;

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const POSITION_ID_PATTERN = /^pos_2\d{5}_\d{2}$/;

export const DATA_SOURCE = "sample";

export type MonthRange = { month: string; startIso: string; endIso: string };
export type ApiMonthInput = { ok: true; range: MonthRange } | {
  ok: false;
  status: number;
  error: string;
};
export type ApiIdInput = { ok: true; id: string } | {
  ok: false;
  status: number;
  error: string;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function toIso(v: unknown): string {
  return new Date(v as string | number).toISOString();
}

/** Validate and normalize a `YYYY-MM` path segment, or a 400-style error. */
export function parseMonth(value: string): ApiMonthInput {
  if (!MONTH_PATTERN.test(value)) {
    return {
      ok: false,
      status: 400,
      error:
        "Invalid month parameter. Expected a calendar month in YYYY-MM format, for example 2026-10.",
    };
  }
  const firstDay = new Date(`${value}-01T00:00:00Z`);
  const nextMonth = new Date(firstDay);
  nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
  return {
    ok: true,
    range: {
      month: value,
      startIso: firstDay.toISOString(),
      endIso: nextMonth.toISOString(),
    },
  };
}

/** Validate a position id path segment, or a 404-style error. */
export function parsePositionId(value: string): ApiIdInput {
  if (!POSITION_ID_PATTERN.test(value)) {
    return {
      ok: false,
      status: 404,
      error: "Position not found.",
    };
  }
  return { ok: true, id: value };
}

export function apiError(error: string, status: number): Response {
  return Response.json({ error }, { status });
}

// -------------------------------------------------------------------------
// Endpoint 1 — GET /api/months
// -------------------------------------------------------------------------

export async function listAvailableMonths(): Promise<Response> {
  const rows = (await sql.query(
    "SELECT DISTINCT to_char(closed_at, 'YYYY-MM') AS month FROM positions ORDER BY month DESC",
  )) as Row[];
  return Response.json({
    dataSource: DATA_SOURCE,
    months: rows.map((r) => String(r.month)),
  });
}

// -------------------------------------------------------------------------
// Endpoint 2 — GET /api/months/[month]/analytics
// -------------------------------------------------------------------------

export async function getMonthlyAnalytics(range: MonthRange): Promise<Response> {
  const rows = (await sql.query(
    "SELECT realized_pnl FROM positions WHERE closed_at >= $1 AND closed_at < $2 AND status = 'closed'",
    [range.startIso, range.endIso],
  )) as Row[];
  const pnls = rows.map((r) => Number(r.realized_pnl));
  const count = pnls.length;
  const netPnl = round2(pnls.reduce((a, v) => a + v, 0));
  const wins = pnls.filter((p) => p > 0).length;
  return Response.json({
    dataSource: DATA_SOURCE,
    month: range.month,
    netPnl,
    winRate: count === 0 ? null : round2((wins / count) * 100),
    completedPositions: count,
    avgPnlPerTrade: count === 0 ? null : round2(netPnl / count),
  });
}

// -------------------------------------------------------------------------
// Endpoint 3 — GET /api/months/[month]/daily-pnl
// -------------------------------------------------------------------------

export async function getDailyPnl(range: MonthRange): Promise<Response> {
  const rows = (await sql.query(
    `SELECT to_char(closed_at, 'YYYY-MM-DD') AS day,
            SUM(realized_pnl) AS net_pnl,
            COUNT(*)          AS trades
     FROM positions
     WHERE closed_at >= $1 AND closed_at < $2 AND status = 'closed'
     GROUP BY day
     ORDER BY day`,
    [range.startIso, range.endIso],
  )) as Row[];
  return Response.json({
    dataSource: DATA_SOURCE,
    month: range.month,
    days: rows.map((r) => ({
      date: String(r.day),
      netPnl: round2(Number(r.net_pnl)),
      trades: Number(r.trades),
    })),
  });
}

// -------------------------------------------------------------------------
// Endpoint 4 — GET /api/months/[month]/positions
// -------------------------------------------------------------------------

export async function getMonthlyPositions(range: MonthRange): Promise<Response> {
  const rows = (await sql.query(
    `SELECT id, instrument, side, quantity, opened_at, closed_at, realized_pnl, fees_total, status
     FROM positions
     WHERE closed_at >= $1 AND closed_at < $2 AND status = 'closed'
     ORDER BY closed_at DESC`,
    [range.startIso, range.endIso],
  )) as Row[];
  return Response.json({
    dataSource: DATA_SOURCE,
    month: range.month,
    positions: rows.map((r) => ({
      id: String(r.id),
      instrument: String(r.instrument),
      side: String(r.side),
      quantity: Number(r.quantity),
      openedAt: toIso(r.opened_at),
      closedAt: toIso(r.closed_at),
      realizedPnl: round2(Number(r.realized_pnl)),
      feesTotal: round2(Number(r.fees_total)),
      status: String(r.status),
    })),
  });
}

// -------------------------------------------------------------------------
// Endpoint 5 — GET /api/positions/[id]
// -------------------------------------------------------------------------

/**
 * Evidence-backed observations are computed ONLY from stored, observable
 * facts (hold duration, fees, this outcome vs. the month's data). They do
 * not claim to explain trader intent. Improvement prompts are general
 * review questions — the backend cannot and does not infer intent.
 */
const IMPROVEMENT_PROMPTS = [
  "Before opening the next position of this type, what was your exit plan, and how will you check it before entering?",
  "Was the position size consistent with the risk you intended to take on this trade?",
  "Based on the hold duration shown above, did the actual timeframe match what you planned for this trade?",
];

export async function getPositionDetail(id: string): Promise<Response> {
  const positionRows = (await sql.query(
    "SELECT id, instrument, side, quantity, status, opened_at, closed_at, realized_pnl, fees_total FROM positions WHERE id = $1",
    [id],
  )) as Row[];
  if (positionRows.length === 0) {
    return apiError("Position not found.", 404);
  }
  const p = positionRows[0];

  const orders = (await sql.query(
    "SELECT id, position_id, instrument, side, order_type, quantity, status, created_at FROM orders WHERE position_id = $1 ORDER BY created_at",
    [id],
  )) as Row[];
  const executions = (await sql.query(
    "SELECT id, order_id, position_id, instrument, side, quantity, price, fees, executed_at FROM executions WHERE position_id = $1 ORDER BY executed_at",
    [id],
  )) as Row[];

  // The dataset's agreed shape is one entry order + one exit order, each
  // with one execution, in ascending time order.
  const entryOrder = orders[0];
  const exitOrder = orders[orders.length - 1];
  const entryExec = executions.find((e) => e.order_id === entryOrder?.id);
  const exitExec = executions.find((e) => e.order_id === exitOrder?.id);

  const openedAt = toIso(p.opened_at);
  const closedAt = toIso(p.closed_at);
  const holdMinutes = Math.round(
    (new Date(closedAt).getTime() - new Date(openedAt).getTime()) / 60000,
  );
  const realizedPnl = round2(Number(p.realized_pnl));

  const month = closedAt.slice(0, 7);
  const avgRows = (await sql.query(
    "SELECT AVG(realized_pnl) AS avg_pnl FROM positions WHERE closed_at >= $1 AND closed_at < $2 AND status = 'closed'",
    [`${month}-01T00:00:00Z`, nextMonthIso(month)],
  )) as Row[];
  const monthAvg =
    avgRows.length > 0 && avgRows[0].avg_pnl != null
      ? Number(avgRows[0].avg_pnl)
      : null;

  const leg = (o: Row | undefined, e: Row | undefined) =>
    !o || !e
      ? null
      : {
          orderId: String(o.id),
          executionId: String(e.id),
          side: String(e.side),
          orderType: String(o.order_type),
          quantity: Number(e.quantity),
          price: Number(e.price),
          fees: Number(e.fees),
          orderedAt: toIso(o.created_at),
          executedAt: toIso(e.executed_at),
        };

  return Response.json({
    dataSource: DATA_SOURCE,
    position: {
      id: String(p.id),
      instrument: String(p.instrument),
      side: String(p.side),
      quantity: Number(p.quantity),
      status: String(p.status),
      openedAt,
      closedAt,
      realizedPnl,
      feesTotal: round2(Number(p.fees_total)),
      holdDurationMinutes: holdMinutes,
    },
    entry: leg(entryOrder, entryExec),
    exit: leg(exitOrder, exitExec),
    orders: orders.map((o) => ({
      id: String(o.id),
      instrument: String(o.instrument),
      side: String(o.side),
      orderType: String(o.order_type),
      quantity: Number(o.quantity),
      status: String(o.status),
      createdAt: toIso(o.created_at),
    })),
    executions: executions.map((e) => ({
      id: String(e.id),
      orderId: String(e.order_id),
      instrument: String(e.instrument),
      side: String(e.side),
      quantity: Number(e.quantity),
      price: Number(e.price),
      fees: Number(e.fees),
      executedAt: toIso(e.executed_at),
    })),
    observations: {
      note: "Observations are computed only from stored, observable data. They do not explain the trader's intent.",
      facts: [
        {
          fact: "Hold duration",
          value: `${holdMinutes} min`,
          evidence: "closed_at minus opened_at from the stored position record.",
        },
        {
          fact: "Fees paid on this position",
          value: Number(p.fees_total).toFixed(2),
          evidence: "Sum of the stored execution fees (entry + exit).",
        },
        ...(monthAvg == null
          ? []
          : [
              {
                fact: "Outcome vs. average position of its month",
                value: round2(realizedPnl - monthAvg).toFixed(2),
                evidence:
                  "This position's realized P&L minus the average realized P&L of all completed positions in its month.",
              },
            ]),
      ],
    },
    improvementPrompts: {
      note: "General review questions, not data-derived conclusions.",
      prompts: IMPROVEMENT_PROMPTS,
    },
  });
}

function nextMonthIso(month: string): string {
  const first = new Date(`${month}-01T00:00:00Z`);
  const next = new Date(first);
  next.setUTCMonth(next.getUTCMonth() + 1);
  return next.toISOString();
}
