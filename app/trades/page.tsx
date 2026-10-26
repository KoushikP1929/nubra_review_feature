import Link from "next/link";

import { AppHeader } from "@/components/AppHeader";
import { MonthSelect } from "@/components/MonthSelect";
import {
  backendErrorMessage,
  monthLabel,
  pnlColorClass,
  reviewApi,
  signedMoney,
  type AnalyticsResponse,
  type MonthsResponse,
  type PositionSummary,
} from "@/lib/review-api-client";

/**
 * Trades screen — the monthly trade list as its own page, with server-side
 * outcome tabs and instrument/direction search. Filtering happens in the
 * backend API (?outcome=…&q=…); this page renders the response only.
 */

type TradesProps = {
  searchParams: Promise<{ month?: string; outcome?: string; q?: string }>;
};

// Renders live, per-request backend data — must not be prerendered.
export const instant = false;

type Outcome = "profit" | "loss" | undefined;

export default async function Trades({ searchParams }: TradesProps) {
  const { month: requestedMonth, outcome, q } = await searchParams;

  const monthsRes = await reviewApi<MonthsResponse>("/api/months");
  const months =
    monthsRes.status === 200 ? (monthsRes.data?.months ?? []) : [];

  if (months.length === 0) {
    return (
      <>
        <AppHeader active="none" />
        <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {backendErrorMessage(monthsRes.status, "/api/months")}
          </div>
        </main>
      </>
    );
  }

  const month = months.includes(requestedMonth ?? "")
    ? (requestedMonth as string)
    : months[0];
  const activeOutcome: Outcome =
    outcome === "profit" || outcome === "loss" ? outcome : undefined;

  // Search input is passed through to the backend unchanged (the backend
  // validates and escapes it); it is only echoed back for the input value.
  const searchEcho = (q ?? "").slice(0, 40);

  if (!monthsRes.data) return null;

  const [analyticsRes, positionsRes] = await Promise.all([
    reviewApi<AnalyticsResponse>(`/api/months/${month}/analytics`),
    reviewApi<{ dataSource: string; month: string; positions: PositionSummary[] }>(
      `/api/months/${month}/positions` +
        (activeOutcome || q
          ? `?${new URLSearchParams({
              ...(activeOutcome ? { outcome: activeOutcome } : {}),
              ...(q ? { q } : {}),
            }).toString()}`
          : ""),
    ),
  ]);

  if (analyticsRes.status !== 200 || positionsRes.status !== 200) {
    return (
      <>
        <AppHeader active="trades" />
        <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {backendErrorMessage(analyticsRes.status, `/api/months/${month}/positions`)}
          </div>
        </main>
      </>
    );
  }

  const a = analyticsRes.data as AnalyticsResponse;
  const positions = positionsRes.data?.positions ?? [];

  const tabHref = (o: Outcome, search: string) => {
    const p = new URLSearchParams();
    p.set("month", month);
    if (o) p.set("outcome", o);
    if (search) p.set("q", search);
    return `/trades?${p.toString()}`;
  };
  const searchHref = (search: string) =>
    tabHref(activeOutcome, search);

  return (
    <>
      <AppHeader active="trades" />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
        {/* Title row */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-slate-900">
              Trades
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {monthLabel(month)} ·{" "}
              <span className={pnlColorClass(a.netPnl)}>
                Net {signedMoney(a.netPnl)}
              </span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500">Month</span>
            <MonthSelect months={months} value={month} basePath="/trades" />
          </div>
        </div>

        {/* Outcome tabs */}
        <div className="mt-6 inline-flex items-center gap-1 rounded-xl bg-slate-100 p-1">
          <Link
            href={tabHref(undefined, q ?? "")}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              activeOutcome === undefined
                ? "bg-slate-900 text-white"
                : "text-slate-700 hover:bg-white"
            }`}
          >
            All ({a.completedPositions})
          </Link>
          <Link
            href={tabHref("profit", q ?? "")}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              activeOutcome === "profit"
                ? "bg-slate-900 text-white"
                : "text-slate-700 hover:bg-white"
            }`}
          >
            Profit ({a.profitCount})
          </Link>
          <Link
            href={tabHref("loss", q ?? "")}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              activeOutcome === "loss"
                ? "bg-slate-900 text-white"
                : "text-slate-700 hover:bg-white"
            }`}
          >
            Loss ({a.lossCount})
          </Link>
        </div>

        {/* Search (submitted to the backend, never filtered in the browser) */}
        <div className="mt-6 flex justify-end">
          <form method="get" action="/trades" className="relative">
            <input type="hidden" name="month" value={month} />
            {activeOutcome ? (
              <input type="hidden" name="outcome" value={activeOutcome} />
            ) : null}
            <svg
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden
            >
              <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" />
              <line x1="11" y1="11" x2="14.5" y2="14.5" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            <input
              type="search"
              name="q"
              defaultValue={searchEcho}
              placeholder="Search instrument, direction..."
              className="w-72 rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
            />
          </form>
        </div>

        {/* Trade list */}
        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="hidden grid-cols-[8.5rem_1fr_6rem_4.5rem_7rem_7.5rem] gap-2 border-b border-slate-200 bg-slate-50/60 px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500 sm:grid">
            <span>Date</span>
            <span>Instrument</span>
            <span>Side</span>
            <span className="text-right">Qty</span>
            <span className="text-center">Outcome</span>
            <span className="text-right">P&amp;L</span>
          </div>
          {positions.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-slate-400">
              No trades match the selected filters for this month.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {positions.map((p) => {
                const profit = p.realizedPnl > 0;
                return (
                  <Link
                    key={p.id}
                    href={`/positions/${p.id}`}
                    className={`grid grid-cols-2 gap-2 border-l-4 px-5 py-3.5 text-sm hover:bg-slate-50 ${
                      profit ? "border-l-emerald-600" : p.realizedPnl < 0 ? "border-l-red-500" : "border-l-slate-300"
                    } sm:grid-cols-[8.5rem_1fr_6rem_4.5rem_7rem_7.5rem]`}
                  >
                    <span className="text-slate-700">{shortDate(p.closedAt)}</span>
                    <span>
                      <span className="block font-semibold text-slate-900">
                        {p.instrument}
                      </span>
                      <span className="block text-xs text-slate-400">
                        {p.instrumentType}
                      </span>
                    </span>
                    <span className="capitalize text-slate-700">{p.side}</span>
                    <span className="text-right text-slate-700">{p.quantity}</span>
                    <span className="flex justify-center">
                      {profit ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
                          ▲ Profit
                        </span>
                      ) : p.realizedPnl < 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-600">
                          ▼ Loss
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-2 py-1 text-xs font-medium text-slate-500">
                          Break-even
                        </span>
                      )}
                    </span>
                    <span
                      className={`text-right font-semibold ${pnlColorClass(p.realizedPnl)}`}
                    >
                      {signedMoney(p.realizedPnl)}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </>
  );
}

/** Display-only date formatting for the trade list (no logic). */
function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}
