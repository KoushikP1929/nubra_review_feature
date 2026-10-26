import Link from "next/link";

import { AppHeader } from "@/components/AppHeader";
import {
  backendErrorMessage,
  money,
  monthLabel,
  pnlColorClass,
  reviewApi,
  shortDateTime,
  signedMoney,
  type AnalyticsResponse,
  type DailyPnlResponse,
  type MonthsResponse,
  type PositionsResponse,
} from "@/lib/review-api-client";

/**
 * Screen 1 — Monthly Trade Review Dashboard.
 *
 * A server component that calls the backend API routes. Everything rendered
 * below comes from those responses; this file computes no analytics.
 */

type HomeProps = { searchParams: Promise<{ month?: string }> };

// This screen renders live, per-request backend data (headers, searchParams,
// uncached fetch) — it must not be prerendered.
export const instant = false;

export default async function Home({ searchParams }: HomeProps) {
  const { month: requestedMonth } = await searchParams;

  const monthsRes = await reviewApi<MonthsResponse>(
    "/api/months",
  );
  const months =
    monthsRes.status === 200 ? (monthsRes.data?.months ?? []) : [];

  if (months.length === 0) {
    return (
      <>
        <AppHeader />
        <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
          <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
            {backendErrorMessage(monthsRes.status, "/api/months")}
          </div>
        </main>
      </>
    );
  }

  // Fall back to the newest available month if the requested one has no data.
  const month = months.includes(requestedMonth ?? "")
    ? (requestedMonth as string)
    : months[0];

  const [analyticsRes, dailyRes, positionsRes] = await Promise.all([
    reviewApi<AnalyticsResponse>(
      `/api/months/${month}/analytics`,
    ),
    reviewApi<DailyPnlResponse>(
      `/api/months/${month}/daily-pnl`,
    ),
    reviewApi<PositionsResponse>(
      `/api/months/${month}/positions`,
    ),
  ]);

  const failed = [analyticsRes, dailyRes, positionsRes].some(
    (r) => r.status !== 200,
  );

  if (failed) {
    return (
      <>
        <AppHeader />
        <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
          <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
            {backendErrorMessage(analyticsRes.status, `/api/months/${month}/*`)}
          </div>
          <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
            The backend reported: {String(JSON.stringify(analyticsRes.data))}
          </p>
        </main>
      </>
    );
  }

  const analytics = analyticsRes.data as AnalyticsResponse;
  const daily = dailyRes.data as DailyPnlResponse;
  const positions = (positionsRes.data as PositionsResponse).positions;

  // Purely visual scaling for the bar chart (largest absolute daily value).
  const maxAbsDaily = Math.max(
    1,
    ...daily.days.map((d) => Math.abs(d.netPnl)),
  );

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              Monthly Trade Review — {monthLabel(month)}
            </h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Review the month's completed positions. Selecting a trade opens
              its detailed review.
            </p>
          </div>

          {/* Month selection — plain form, no JavaScript or state library */}
          <form method="get" action="/" className="flex items-end gap-2">
            <label className="text-sm text-zinc-600 dark:text-zinc-400">
              Month
              <select
                name="month"
                defaultValue={month}
                className="mt-1 block w-48 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              >
                {months.map((m) => (
                  <option key={m} value={m}>
                    {monthLabel(m)}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              Show month
            </button>
          </form>
        </div>

        {/* Monthly analytics */}
        <section aria-labelledby="analytics-heading" className="mt-8">
          <h2
            id="analytics-heading"
            className="text-lg font-semibold tracking-tight"
          >
            Monthly analytics
          </h2>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Net P&L</p>
              <p
                className={`mt-2 text-2xl font-semibold ${pnlColorClass(analytics.netPnl)}`}
              >
                {signedMoney(analytics.netPnl)} USD
              </p>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Win rate
              </p>
              <p className="mt-2 text-2xl font-semibold">
                {analytics.winRate == null ? "—" : `${analytics.winRate}%`}
              </p>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Completed positions
              </p>
              <p className="mt-2 text-2xl font-semibold">
                {analytics.completedPositions}
              </p>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Average P&L per trade
              </p>
              <p
                className={`mt-2 text-2xl font-semibold ${
                  analytics.avgPnlPerTrade == null
                    ? ""
                    : pnlColorClass(analytics.avgPnlPerTrade)
                }`}
              >
                {analytics.avgPnlPerTrade == null
                  ? "—"
                  : `${signedMoney(analytics.avgPnlPerTrade)} USD`}
              </p>
            </div>
          </div>
        </section>

        {/* Daily P&L visualization (pure CSS bars) */}
        <section aria-labelledby="daily-pnl-heading" className="mt-10">
          <h2
            id="daily-pnl-heading"
            className="text-lg font-semibold tracking-tight"
          >
            Daily P&L
          </h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            One bar per day with completed trades (UTC). Green = profitable
            day, red = losing day. Hover a bar for details.
          </p>
          <div className="mt-4 overflow-x-auto rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex h-44 min-w-[640px] items-end gap-3">
              {daily.days.map((d) => {
                const positive = d.netPnl >= 0;
                return (
                  <div
                    key={d.date}
                    className="flex h-full min-w-[3rem] flex-1 flex-col items-center justify-end"
                    title={`${d.date}: ${signedMoney(d.netPnl)} USD from ${d.trades} trade(s)`}
                  >
                    <span
                      className={`mb-1 text-[11px] font-medium ${pnlColorClass(d.netPnl)}`}
                    >
                      {signedMoney(d.netPnl)}
                    </span>
                    <div
                      className={`w-full max-w-[3.5rem] rounded-t ${
                        positive
                          ? "bg-emerald-500"
                          : "bg-red-500"
                      }`}
                      style={{
                        height: `${Math.max(2, (Math.abs(d.netPnl) / maxAbsDaily) * 100)}%`,
                      }}
                    />
                    <span className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                      {d.date.slice(5)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Monthly trade history */}
        <section aria-labelledby="history-heading" className="mt-10">
          <h2
            id="history-heading"
            className="text-lg font-semibold tracking-tight"
          >
            Monthly trade history
          </h2>
          <div className="mt-4 rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
            <div className="hidden grid-cols-[9.5rem_1fr_7rem_7.5rem_6.5rem] gap-2 border-b border-zinc-200 px-4 py-2 text-xs font-medium text-zinc-500 sm:grid dark:border-zinc-800 dark:text-zinc-400">
              <span>Date &amp; time</span>
              <span>Instrument</span>
              <span>Trade type</span>
              <span>P&amp;L</span>
              <span>Status</span>
            </div>
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {positions.map((p) => (
                <Link
                  key={p.id}
                  href={`/positions/${p.id}`}
                  className="grid grid-cols-2 gap-2 px-4 py-3 text-sm hover:bg-zinc-50 sm:grid-cols-[9.5rem_1fr_7rem_7.5rem_6.5rem] dark:hover:bg-zinc-900"
                >
                  <span className="text-zinc-600 dark:text-zinc-400">
                    {shortDateTime(p.closedAt)}
                  </span>
                  <span className="font-medium">
                    {p.instrument}
                    <span className="ml-2 text-zinc-400">{`(${money(p.quantity)} sh)`}</span>
                  </span>
                  <span className="text-zinc-600 capitalize dark:text-zinc-400">
                    {p.side}
                  </span>
                  <span
                    className={`font-medium ${pnlColorClass(p.realizedPnl)}`}
                  >
                    {signedMoney(p.realizedPnl)}
                  </span>
                  <span className="inline-flex w-fit rounded-full border border-zinc-300 px-2 py-0.5 text-xs text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
                    {p.status}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
