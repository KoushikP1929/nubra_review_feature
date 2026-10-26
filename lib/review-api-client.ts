/**
 * Nubra Trade Review — frontend API client.
 *
 * The ONLY way the UI obtains data: fetch over HTTP from the Next.js API
 * routes (the backend). The UI never connects to the database and never
 * calculates P&L, win rate, average P&L, or ordering — it renders what the
 * backend returns and formats values for display only.
 */

import { headers } from "next/headers";

// ---------------------------------------------------------------------------
// Response types (mirrors of the backend contract)
// ---------------------------------------------------------------------------

export type ApiResult<T> = { status: number; data: T | null };

export type ApiErrorResponse = { error: string };

export type MonthsResponse = { dataSource: string; months: string[] };

export type AnalyticsResponse = {
  dataSource: string;
  month: string;
  netPnl: number;
  winRate: number | null;
  completedPositions: number;
  profitCount: number;
  lossCount: number;
  avgPnlPerTrade: number | null;
};

export type DailyPnlResponse = {
  dataSource: string;
  month: string;
  days: { date: string; netPnl: number; cumulativePnl: number; trades: number }[];
};

export type PositionSummary = {
  id: string;
  instrument: string;
  instrumentType: string;
  side: "long" | "short" | string;
  quantity: number;
  openedAt: string;
  closedAt: string;
  realizedPnl: number;
  feesTotal: number;
  status: string;
};

export type PositionsResponse = {
  dataSource: string;
  month: string;
  positions: PositionSummary[];
};

export type TradeLeg = {
  orderId: string;
  executionId: string;
  side: string;
  orderType: string;
  quantity: number;
  price: number;
  fees: number;
  orderedAt: string;
  executedAt: string;
};

export type OrderRow = {
  id: string;
  instrument: string;
  side: string;
  orderType: string;
  quantity: number;
  status: string;
  createdAt: string;
};

export type ExecutionRow = {
  id: string;
  orderId: string;
  instrument: string;
  side: string;
  quantity: number;
  price: number;
  fees: number;
  executedAt: string;
};

export type PositionDetailResponse = {
  dataSource: string;
  position: {
    id: string;
    instrument: string;
    instrumentType: string;
    side: "long" | "short" | string;
    quantity: number;
    status: string;
    openedAt: string;
    closedAt: string;
    plannedStop: number | null;
    realizedPnl: number;
    feesTotal: number;
    holdDurationMinutes: number;
  };
  entry: TradeLeg | null;
  exit: TradeLeg | null;
  orders: OrderRow[];
  executions: ExecutionRow[];
  priceMovePct: number | null;
  stopBreached: boolean;
  narrative: string[];
  evidence: string[];
  timeline: { time: string; title: string; lines: string[] }[];
  reflectionPrompt: string;
  observations: {
    note: string;
    facts: { fact: string; value: string; evidence: string }[];
  };
  improvementPrompts: { note: string; prompts: string[] };
};

// ---------------------------------------------------------------------------
// Fetch helper — resolves this request's own host so the backend API is
// reached the same way in dev (localhost) and production (Vercel).
// ---------------------------------------------------------------------------

export async function reviewApi<T>(path: string): Promise<ApiResult<T>> {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto =
    host.startsWith("localhost:") || host.startsWith("127.0.0.1:")
      ? "http"
      : "https";
  try {
    const res = await fetch(`${proto}://${host}${path}`, { cache: "no-store" });
    const data = res.ok ? ((await res.json()) as T) : null;
    return { status: res.status, data };
  } catch {
    return { status: 0, data: null };
  }
}

/**
 * Error text to render when the backend could not serve a screen.
 * Kept in the frontend layer because displaying an error is a UI matter.
 */
export function backendErrorMessage(status: number, path: string): string {
  if (status === 0) {
    return "Could not reach the backend API. Check whether the app and its database connection are running.";
  }
  if (status === 404) {
    return "The requested review data was not found.";
  }
  return `The backend API returned an unexpected error (${status}) for ${path}.`;
}

// ---------------------------------------------------------------------------
// Display-only formatting helpers (no analytics: they never compute P&L,
// win rate, averages, or change any order/sort).
// ---------------------------------------------------------------------------

export function money(n: number): string {
  return "₹" + n.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function signedMoney(n: number): string {
  return (n > 0 ? "+" : "") + money(n);
}

export function pnlColorClass(n: number): string {
  return n > 0
    ? "text-emerald-600 dark:text-emerald-400"
    : n < 0
      ? "text-red-600 dark:text-red-400"
      : "text-zinc-600 dark:text-zinc-400";
}

export function monthLabel(ym: string): string {
  return new Date(`${ym}-01T00:00:00Z`).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function shortDateTime(iso: string): string {
  return (
    new Date(iso).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "UTC",
    }) + " UTC"
  );
}
