import Link from "next/link";

import { AppHeader } from "@/components/AppHeader";
import { MonthSelect } from "@/components/MonthSelect";
import {
  backendErrorMessage,
  money,
  monthLabel,
  pnlColorClass,
  reviewApi,
  signedMoney,
  type AnalyticsResponse,
  type DailyPnlResponse,
  type MonthsResponse,
} from "@/lib/review-api-client";

/**
 * Screen 1 — Monthly Trade Review Dashboard ("Monthly overview").
 *
 * A server component that calls the backend API routes. Everything rendered
 * below comes from those responses; this file computes no analytics.
 */

type HomeProps = { searchParams: Promise<{ month?: string }> };

// This screen renders live, per-request backend data (headers, searchParams,
// uncached fetch) — it must not be prerendered.
export const instant = false;

const winRateClass = "text-slate-900";

export default async function Home({ searchParams }: HomeProps) {
  const { month: requestedMonth } = await searchParams;

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

  // Fall back to the newest available month if the requested one has no data.
  const month = months.includes(requestedMonth ?? "")
    ? (requestedMonth as string)
    : months[0];

  const [analyticsRes, dailyRes] = await Promise.all([
    reviewApi<AnalyticsResponse>(`/api/months/${month}/analytics`),
    reviewApi<DailyPnlResponse>(`/api/months/${month}/daily-pnl`),
  ]);

  if (analyticsRes.status !== 200 || dailyRes.status !== 200) {
    return (
      <>
        <AppHeader active="dashboard" />
        <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {backendErrorMessage(analyticsRes.status, `/api/months/${month}/*`)}
          </div>
        </main>
      </>
    );
  }

  const a = analyticsRes.data as AnalyticsResponse;
  const days = (dailyRes.data as DailyPnlResponse).days;

  // ---- Cumulative P&L chart geometry (viewBox 700x280, plot area 36..690 x 16..232)
  const cumValues = days.map((d) => d.cumulativePnl);
  const hasCum = cumValues.length > 0;
  const cumMin = hasCum ? Math.min(...cumValues, 0) : 0;
  const cumMax = hasCum ? Math.max(...cumValues, 0) : 1;
  const pad = Math.max(1, (cumMax - cumMin) * 0.08);
  const lo = cumMin - pad;
  const hi = cumMax + pad;
  const cumY = (v: number) => 16 + ((hi - v) / (hi - lo)) * 216;
  const stepX = cumValues.length > 1 ? 654 / (cumValues.length - 1) : 0;
  const cumX = (i: number) => 36 + i * stepX;
  const path = hasCum
    ? cumValues
        .map((v, i) => [cumX(i), cumY(v)] as const)
        .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`)
        .join(" ")
    : "";
  const tickLabels = [hi, hi - (hi - lo) / 4 * 1, hi - (hi - lo) / 4 * 2, hi - (hi - lo) / 4 * 3, lo];
  const fmtTick = (v: number) => {
    if (Math.abs(v) >= 1000) {
      const k = v / 1000;
      const s = (Math.round(k * 10) / 10).toString().replace(/\.0$/, "");
      return `${s}k`;
    }
    return Math.round(v).toString();
  };

  // ---- Daily P&L baseline-bar geometry
  const maxAbsDaily = Math.max(1, ...days.map((d) => Math.abs(d.netPnl)));
  const labelEvery = Math.max(1, Math.ceil(days.length / 14));

  return (
    <>
      <AppHeader active="dashboard" />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
        {/* Title row */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-slate-900">
              Monthly overview
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {monthLabel(month)} · computed from {a.completedPositions} sample
              trades
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500">Month</span>
            <MonthSelect months={months} value={month} basePath="/" />
          </div>
        </div>

        {/* KPI cards */}
        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Net P&amp;L
            </p>
            <p className={`mt-2 text-[27px] font-bold leading-8 ${pnlColorClass(a.netPnl)}`}>
              {signedMoney(a.netPnl)}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {a.netPnl > 0 ? "Net gain" : a.netPnl < 0 ? "Net loss" : "Break-even"}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Win rate
            </p>
            <p className={`mt-2 text-[27px] font-bold leading-8 ${winRateClass}`}>
              {a.winRate == null ? "—" : `${a.winRate}%`}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {a.profitCount} profitable · {a.lossCount} losing
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Trades
            </p>
            <p className="mt-2 text-[27px] font-bold leading-8 text-slate-900">
              {a.completedPositions}
            </p>
            <p className="mt-1 text-xs text-slate-400">Closed positions</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Avg P&amp;L / trade
            </p>
            <p
              className={`mt-2 text-[27px] font-bold leading-8 ${
                a.avgPnlPerTrade == null ? "text-slate-900" : pnlColorClass(a.avgPnlPerTrade)
              }`}
            >
              {a.avgPnlPerTrade == null ? "—" : signedMoney(a.avgPnlPerTrade)}
            </p>
            <p className="mt-1 text-xs text-slate-400">Net P&amp;L ÷ trades</p>
          </div>
        </div>

        {/* Charts */}
        <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-5">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-3">
            <h2 className="text-lg font-bold text-slate-900">Cumulative P&amp;L</h2>
            <p className="mt-0.5 text-xs text-slate-400">
              Running total by trading day (₹)
            </p>
            {hasCum ? (
              <svg
                viewBox="0 0 700 280"
                preserveAspectRatio="none"
                className="mt-4 h-72 w-full"
                role="img"
                aria-label="Cumulative P&L by day"
              >
                {tickLabels.map((v, i) => (
                  <g key={i}>
                    <line
                      x1={36}
                      x2={690}
                      y1={16 + i * 54}
                      y2={16 + i * 54}
                      stroke="#f1f5f9"
                      strokeWidth={1}
                    />
                    <text
                      x={30}
                      y={20 + i * 54}
                      textAnchor="end"
                      className="fill-slate-400"
                      fontSize={11}
                    >
                      {fmtTick(v)}
                    </text>
                  </g>
                ))}
                <path
                  d={path}
                  fill="none"
                  stroke="#1e3a5f"
                  strokeWidth={2.5}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                {days.map((d, i) => (
                  <g key={d.date}>
                    <circle cx={cumX(i)} cy={cumY(d.cumulativePnl)} r={2} fill="#1e3a5f" />
                    <rect
                      x={cumX(i) - stepX / 2}
                      y={0}
                      width={Math.max(stepX, 24)}
                      height={280}
                      fill="transparent"
                    >
                      <title>{`Day ${d.date.slice(8)} · daily ${signedMoney(d.netPnl)} · cumulative ${money(d.cumulativePnl)}`}</title>
                    </rect>
                    {(i % labelEvery === 0 || i === days.length - 1) && (
                      <text
                        x={cumX(i)}
                        y={258}
                        textAnchor="middle"
                        className="fill-slate-400"
                        fontSize={11}
                      >
                        {d.date.slice(8)}
                      </text>
                    )}
                  </g>
                ))}
              </svg>
            ) : (
              <p className="mt-4 h-72 pt-20 text-center text-sm text-slate-400">
                No completed trades this month.
              </p>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
            <h2 className="text-lg font-bold text-slate-900">Daily P&amp;L</h2>
            <p className="mt-0.5 text-xs text-slate-400">
              Green = net gain day, red = net loss day
            </p>
            <div className="relative mt-4 h-60">
              <div className="absolute left-0 right-0 top-1/2 border-t border-slate-200" />
              <div className="flex h-full items-stretch gap-1.5 overflow-hidden">
                {days.map((d) => {
                  const positive = d.netPnl >= 0;
                  const h = `${Math.max(2, (Math.abs(d.netPnl) / maxAbsDaily) * 46)}%`;
                  return (
                    <div
                      key={d.date}
                      className="relative min-w-2 flex-1"
                      title={`Day ${d.date.slice(8)} · ${signedMoney(d.netPnl)} from ${d.trades} trade(s)`}
                    >
                      <div
                        className={`absolute left-0 right-0 ${
                          positive ? "bg-emerald-600" : "bg-red-500"
                        }`}
                        style={
                          positive
                            ? { bottom: "50%", height: h }
                            : { top: "50%", height: h }
                        }
                      />
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="mt-2 flex items-stretch gap-1.5">
              {days.map((d) => (
                <span
                  key={d.date}
                  className="min-w-2 flex-1 text-center text-[10px] text-slate-400"
                >
                  {Number(d.date.slice(8)) % labelEvery === 0 ? d.date.slice(8) : ""}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Link to the monthly trade list */}
        <div className="mt-8 flex items-center justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Monthly trade history
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">
              Browse, filter and search every completed position of{" "}
              {monthLabel(month)}.
            </p>
          </div>
          <Link
            href="/trades"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            View trades →
          </Link>
        </div>
      </main>
    </>
  );
}
