/**
 * Nubra Trade Review — backend data layer (shared by all API routes).
 *
 * Responsibilities:
 *  - Validate API inputs (calendar month, position id, list filters).
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
 *  - The "exit beyond planned stop" check compares the exit fill price
 *    with the stored planned_stop for the trade's direction — reported
 *    as an observable fact, never as a judgement of the decision.
 *  - The trade-review timeline and "What happened" narrative are built
 *    ONLY from stored, observable records (orders, fills, stop, times).
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

function hhmm(v: unknown): string {
  return toIso(v).slice(11, 16);
}

function cap(v: unknown): string {
  const s = String(v);
  return s.charAt(0).toUpperCase() + s.slice(1);
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
    profitCount: wins,
    lossCount: pnls.filter((p) => p < 0).length,
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
  // Backend-computed running total (cumulative P&L) across the sorted days.
  let cumulative = 0;
  return Response.json({
    dataSource: DATA_SOURCE,
    month: range.month,
    days: rows.map((r) => {
      const netPnl = round2(Number(r.net_pnl));
      cumulative = round2(cumulative + netPnl);
      return {
        date: String(r.day),
        netPnl,
        cumulativePnl: cumulative,
        trades: Number(r.trades),
      };
    }),
  });
}

// -------------------------------------------------------------------------
// Endpoint 4 — GET /api/months/[month]/positions?outcome=&q=
// -------------------------------------------------------------------------

/**
 * Validate the optional query filters accepted by GET
 * /api/months/[month]/positions?outcome=…&q=… . Anchored in the backend so
 * the frontend never filters, sorts, or calculates anything.
 */
export type PositionFilters = { outcome: "profit" | "loss" | undefined; search: string | undefined };

export function parsePositionFilters(searchParams: URLSearchParams): PositionFilters | Response {
  const outcomeParam = searchParams.get("outcome") ?? undefined;
  if (outcomeParam !== undefined && outcomeParam !== "profit" && outcomeParam !== "loss") {
    return apiError(
      "Invalid outcome filter. Expected 'profit' or 'loss'.",
      400,
    );
  }
  const qParam = (searchParams.get("q") ?? "").trim() || undefined;
  let searchArg: string | undefined;
  if (qParam !== undefined) {
    // Only instrument names and trade direction are searchable; escape SQL
    // wildcards so user input cannot scan other columns.
    searchArg = qParam.replace(/[^a-zA-Z0-9 .-]/g, "").replace(/[%_]/g, "");
    if (searchArg.length === 0) searchArg = undefined;
  }
  return { outcome: outcomeParam as PositionFilters["outcome"], search: searchArg };
}

export async function getMonthlyPositions(range: MonthRange, filters: PositionFilters): Promise<Response> {
  const clauses = [
    "closed_at >= $1",
    "closed_at < $2",
    "status = 'closed'",
  ];
  const params: unknown[] = [range.startIso, range.endIso];
  if (filters.outcome === "profit") clauses.push("realized_pnl > 0");
  if (filters.outcome === "loss") clauses.push("realized_pnl < 0");
  if (filters.search) {
    const idx = params.length + 1;
    clauses.push(`(instrument ILIKE $${idx} OR side ILIKE $${idx})`);
    params.push(`%${filters.search}%`);
  }
  const rows = (await sql.query(
    `SELECT id, instrument, instrument_type, side, quantity, opened_at, closed_at, realized_pnl, fees_total, status
     FROM positions
     WHERE ${clauses.join(" AND ")}
     ORDER BY closed_at DESC`,
    params,
  )) as Row[];
  return Response.json({
    dataSource: DATA_SOURCE,
    month: range.month,
    positions: rows.map((r) => ({
      id: String(r.id),
      instrument: String(r.instrument),
      instrumentType: String(r.instrument_type),
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
 * Evidence-backed observations and the "What happened" narrative are
 * computed ONLY from stored, observable facts (orders, fills, planned stop,
 * times). They do not claim to explain trader intent. The reflection
 * prompt is a general review question — the backend cannot and does not
 * infer intent.
 */
export async function getPositionDetail(id: string): Promise<Response> {
  const positionRows = (await sql.query(
    "SELECT id, instrument, instrument_type, side, quantity, status, opened_at, closed_at, planned_stop, realized_pnl, fees_total FROM positions WHERE id = $1",
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

  const side = String(p.side);
  const entrySide = side === "long" ? "buy" : "sell";
  const exitSide = side === "long" ? "sell" : "buy";

  const entryOrders = orders.filter((o) => o.side === entrySide);
  const exitOrder = orders.find((o) => o.side === exitSide) ?? orders[orders.length - 1];
  const entryExecs = executions.filter((e) => e.side === entrySide);
  const exitExec = executions.find((e) => e.order_id === exitOrder?.id);

  const firstEntryOrder = entryOrders[0];
  const firstEntryExec = entryExecs[0];
  const entryPrice =
    firstEntryExec != null ? Number(firstEntryExec.price) : null;

  const openedAt = toIso(p.opened_at);
  const closedAt = toIso(p.closed_at);
  const holdMinutes = Math.round(
    (new Date(closedAt).getTime() - new Date(openedAt).getTime()) / 60000,
  );
  const realizedPnl = round2(Number(p.realized_pnl));
  const feesTotal = round2(Number(p.fees_total));

  const plannedStop =
    p.planned_stop == null ? null : round2(Number(p.planned_stop));
  const exitPrice = exitExec != null ? Number(exitExec.price) : null;

  // Observable fact: exit beyond the recorded planned stop.
  const stopBreached =
    plannedStop != null &&
    exitPrice != null &&
    (side === "long" ? exitPrice < plannedStop : exitPrice > plannedStop);

  // Observable fact: % price move entry → exit (not flipped to the P&L sign).
  const priceMovePct =
    exitPrice != null && entryPrice != null && entryPrice !== 0
      ? round2(((exitPrice - entryPrice) / entryPrice) * 100)
      : null;

  const additionCount = entryOrders.length - 1;

  // ---- Execution timeline (chronological, from stored records only) -------
  type TimelineItem = { time: string; title: string; lines: string[] };
  const timeline: TimelineItem[] = [];
  if (plannedStop != null) {
    timeline.push({
      time: openedAt,
      title: "Planned stop recorded",
      lines: [`Planned stop noted at ₹${plannedStop.toFixed(2)}`],
    });
  }
  for (const o of orders) {
    const isEntryAddition = o.side === entrySide && String(o.id) !== String(firstEntryOrder?.id);
    const placedTitle = o.side === exitSide ? "Exit placed" : "Order placed";
    const fillTitle = o.side === exitSide
      ? "Exit filled"
      : isEntryAddition
        ? "Position added"
        : "Order filled";
    const fill = executions.find((e) => e.order_id === o.id);
    timeline.push({
      time: toIso(o.created_at),
      title: placedTitle,
      lines: [
        `${cap(o.side)} ${String(o.order_type)} order for ${Number(o.quantity)} @ ₹${fill != null ? Number(fill.price).toFixed(2) : "—"}`,
      ],
    });
    if (fill) {
      timeline.push({
        time: toIso(fill.executed_at),
        title: fillTitle,
        lines: [
          `${Number(fill.quantity)} units filled @ ₹${Number(fill.price).toFixed(2)}`,
          ...(isEntryAddition
            ? [`Total position now ${Number(p.quantity)} units`]
            : []),
        ],
      });
    }
  }
  timeline.sort(
    (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime(),
  );

  // ---- "What happened" narrative (facts only) -----------------------------
  const sentence1 =
    `${cap(side)} position in ${String(p.instrument)} opened at ${hhmm(p.opened_at)} and closed at ${hhmm(p.closed_at)} after ${holdMinutes} minutes.`;
  const sentence2 =
    priceMovePct == null
      ? `The recorded exit price is not available; realized P&L for the review period is ₹${realizedPnl.toFixed(2)}.`
      : `Price moved ${priceMovePct > 0 ? "+" : ""}${priceMovePct}% from entry, resulting in a ${realizedPnl >= 0 ? "profit" : "loss"} of ₹${Math.abs(realizedPnl).toFixed(2)} after ₹${feesTotal.toFixed(2)} fees.`;
  const sentence3 =
    additionCount > 0
      ? `Size was increased ${additionCount === 1 ? "once" : `${additionCount} times`} during the trade${additionCount === 1 ? "" : "s"}.`
      : null;
  const narrative = [sentence1, sentence2, ...(sentence3 ? [sentence3] : [])];

  // ---- Evidence bullets (each traceable to stored data) -------------------
  const evidence: string[] = [];
  if (entryPrice != null && exitPrice != null) {
    evidence.push(
      `Entry ₹${entryPrice.toFixed(2)} → exit ₹${exitPrice.toFixed(2)} (${priceMovePct != null ? (priceMovePct > 0 ? "+" : "") + priceMovePct + "%" : "n/a"})`,
    );
  }
  evidence.push(`Holding time: ${holdMinutes} min`);
  if (plannedStop != null) {
    evidence.push(
      stopBreached
        ? `Planned stop ₹${plannedStop.toFixed(2)} — exit occurred beyond the recorded stop`
        : `Planned stop ₹${plannedStop.toFixed(2)} — exit stayed within the recorded stop`,
    );
  }
  if (additionCount > 0) {
    evidence.push(
      `Position scaled from ${Number(firstEntryOrder?.quantity)} to ${Number(p.quantity)} units`,
    );
  }

  // ---- Reflection prompt --------------------------------------------------
  const GENERIC_PROMPTS = [
    "What was your exit plan when you opened this position, and how will you check it before entering the next trade?",
    "Was the position size consistent with the risk you intended to take on this trade?",
    "Based on the hold duration shown above, did the actual timeframe match what you planned for this trade?",
  ];
  const reflectionPrompt = stopBreached
    ? "What happened between the stop level being reached and the exit fill? Was the plan updated, and if so, was that intentional?"
    : GENERIC_PROMPTS[0];

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
      instrumentType: String(p.instrument_type),
      side,
      quantity: Number(p.quantity),
      status: String(p.status),
      openedAt,
      closedAt,
      plannedStop,
      realizedPnl,
      feesTotal: feesTotal,
      holdDurationMinutes: holdMinutes,
    },
    entry: leg(firstEntryOrder, firstEntryExec),
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
    priceMovePct,
    stopBreached,
    narrative,
    evidence,
    timeline,
    reflectionPrompt,
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
          value: feesTotal.toFixed(2),
          evidence: "Sum of the stored execution fees (entry, additions and exit).",
        },
        ...(plannedStop == null
          ? []
          : [
              {
                fact: "Planned stop",
                value: stopBreached
                  ? `₹${plannedStop.toFixed(2)} (exit occurred beyond it)`
                  : `₹${plannedStop.toFixed(2)} (exit stayed within it)`,
                evidence:
                  "The stop stored with the position compared with the recorded exit fill price.",
              },
            ]),
      ],
    },
    improvementPrompts: {
      note: "General review questions, not data-derived conclusions.",
      prompts: GENERIC_PROMPTS,
    },
  });
}
