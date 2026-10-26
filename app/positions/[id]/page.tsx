import Link from "next/link";

import { AppHeader } from "@/components/AppHeader";
import { ReflectionNote } from "@/components/ReflectionNote";
import {
  backendErrorMessage,
  money,
  monthLabel,
  pnlColorClass,
  reviewApi,
  signedMoney,
  shortDateTime,
  type PositionDetailResponse,
} from "@/lib/review-api-client";

/**
 * Screen 3 — Individual Trade Review.
 *
 * Renders what GET /api/positions/[id] returns: position facts, entry and
 * exit summary, a chronological execution timeline, an evidence-backed
 * "What happened" narrative, the observable stop-breach finding, and a
 * reflection prompt with a browser-local note box. No analytics are
 * computed here.
 */

type PositionPageProps = { params: Promise<{ id: string }> };

// This screen renders live, per-request backend data (params, uncached
// fetch) — it must not be prerendered.
export const instant = false;

export default async function PositionDetailPage({
  params,
}: PositionPageProps) {
  const { id } = await params;
  const res = await reviewApi<PositionDetailResponse>(
    `/api/positions/${id}`,
  );

  if (res.status !== 200 || !res.data) {
    return (
      <>
        <AppHeader active="none" />
        <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {res.status === 404
              ? "Position not found. Completed trades are listed on the Trades page."
              : backendErrorMessage(res.status, `/api/positions/${id}`)}
          </div>
          <p className="mt-4">
            <Link
              href="/"
              className="text-sm font-medium text-slate-700 underline"
            >
              ← Back to monthly review
            </Link>
          </p>
        </main>
      </>
    );
  }

  const d = res.data;
  const p = d.position;
  const isProfit = p.realizedPnl > 0;
  const stripColor = isProfit
    ? "bg-emerald-600"
    : p.realizedPnl < 0
      ? "bg-red-500"
      : "bg-slate-300";
  const badgeLabel = isProfit ? "▲ Profit" : p.realizedPnl < 0 ? "▼ Loss" : "Break-even";
  const badgeClass = isProfit
    ? "bg-emerald-50 text-emerald-700"
    : p.realizedPnl < 0
      ? "bg-red-50 text-red-600"
      : "bg-slate-50 text-slate-500";
  const labelColor = isProfit
    ? "text-emerald-600"
    : p.realizedPnl < 0
      ? "text-red-500"
      : "text-slate-500";
  const referenceCode = `#${p.id.replace("pos_", "").replace(/_/g, "-")}`;

  return (
    <>
      <AppHeader active="none" />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-6">
        <p>
          <Link
            href={`/trades?month=${p.closedAt.slice(0, 7)}`}
            className="text-sm font-medium text-slate-500 hover:text-slate-800"
          >
            ← Back to {monthLabel(p.closedAt.slice(0, 7))} trades
          </Link>
        </p>

        {/* Review header card */}
        <section className="relative mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white p-6 pl-7 shadow-sm">
          <span className={`absolute left-0 top-0 bottom-0 w-1.5 ${stripColor}`} />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p
                className={`text-[11px] font-semibold uppercase tracking-wider ${labelColor}`}
              >
                Trade review · {referenceCode}
              </p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
                {p.instrument}
              </h1>
              <p className="mt-1 text-sm capitalize text-slate-500">
                {p.instrumentType} · {shortDate(p.closedAt)} · {p.side}
              </p>
            </div>
            <div className="text-left sm:text-right">
              <span
                className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium ${badgeClass}`}
              >
                {badgeLabel}
              </span>
              <p
                className={`mt-1 text-2xl font-bold ${pnlColorClass(p.realizedPnl)}`}
              >
                {signedMoney(p.realizedPnl)}
              </p>
            </div>
          </div>

          {/* Summary strip */}
          <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-slate-100 pt-5 sm:grid-cols-3 lg:grid-cols-6">
            <div>
              <dt className="text-xs text-slate-400">Quantity</dt>
              <dd className="mt-1 text-sm font-semibold text-slate-900">
                {p.quantity}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400">Entry</dt>
              <dd className="mt-1 text-sm font-semibold text-slate-900">
                {d.entry ? `₹${money(d.entry.price).slice(1)}` : "—"}{" "}
                <span className="font-normal text-slate-500">
                  @ {d.entry ? timeOf(d.entry.executedAt) : "—"}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400">Exit</dt>
              <dd className="mt-1 text-sm font-semibold text-slate-900">
                {d.exit ? `₹${money(d.exit.price).slice(1)}` : "—"}{" "}
                <span className="font-normal text-slate-500">
                  @ {d.exit ? timeOf(d.exit.executedAt) : "—"}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400">Planned stop</dt>
              <dd className="mt-1 text-sm font-semibold text-slate-900">
                {p.plannedStop == null ? "—" : money(p.plannedStop)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400">Holding time</dt>
              <dd className="mt-1 text-sm font-semibold text-slate-900">
                {p.holdDurationMinutes} min
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400">Direction</dt>
              <dd className="mt-1 text-sm font-semibold capitalize text-slate-900">
                {p.side}
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-[10px] text-slate-400">
            Times shown in UTC. The planned stop is the exit price recorded with
            the trade; it is not changed after entry.
          </p>
        </section>

        <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* Execution timeline */}
          <section aria-labelledby="timeline-heading">
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2
                id="timeline-heading"
                className="text-lg font-bold text-slate-900"
              >
                Execution timeline
              </h2>
              <ol className="mt-5 space-y-6">
                {d.timeline.map((event, i) => (
                  <li key={`${event.time}-${i}`} className="relative pl-6">
                    <span
                      className="absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full bg-slate-300"
                      aria-hidden
                    />
                    <span
                      className="absolute left-[4.5px] top-5 h-[calc(100%+0.4rem)] w-px bg-slate-200 sm:top-6"
                      aria-hidden
                    />
                    <p className="text-xs font-semibold text-slate-900">
                      {timeOf(event.time)}
                    </p>
                    <p className="mt-0.5 text-sm font-semibold text-slate-800">
                      {event.title}
                    </p>
                    {event.lines.map((line) => (
                      <p key={line} className="text-sm text-slate-500">
                        {line}
                      </p>
                    ))}
                  </li>
                ))}
              </ol>
            </div>
          </section>

          {/* What happened + pattern review + reflection */}
          <section className="flex flex-col gap-5" aria-labelledby="what-happened-heading">
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2
                id="what-happened-heading"
                className="text-lg font-bold text-slate-900"
              >
                What happened
              </h2>
              <div className="mt-3 space-y-3 text-sm leading-relaxed text-slate-600">
                {d.narrative.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
              <p className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Evidence
              </p>
              <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-slate-600">
                {d.evidence.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </div>

            {d.stopBreached ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
                <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <span aria-hidden>💡</span> Potential pattern to review
                </p>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  The exit price was beyond the stop level recorded at entry.
                  This may be worth reviewing alongside other trades to see
                  whether it recurs; it could also reflect fast price movement
                  or slippage.
                </p>
                <p className="mt-3 text-xs text-amber-700/80">
                  Observation based on this trade's recorded data only. Not a
                  judgement of the decision or a recommendation.
                </p>
              </div>
            ) : null}

            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-semibold text-slate-900">
                <span aria-hidden>❓</span> Reflection prompt
              </p>
              <ReflectionNote positionId={p.id} prompt={d.reflectionPrompt} />
            </div>
          </section>
        </div>

        {/* Raw records (transparency) */}
        <section aria-labelledby="orders-heading" className="mt-10">
          <h2
            id="orders-heading"
            className="text-lg font-bold text-slate-900"
          >
            Orders
          </h2>
          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                  <th className="px-4 py-2 font-semibold">Order ID</th>
                  <th className="px-4 py-2 font-semibold">Side</th>
                  <th className="px-4 py-2 font-semibold">Type</th>
                  <th className="px-4 py-2 font-semibold">Quantity</th>
                  <th className="px-4 py-2 font-semibold">Status</th>
                  <th className="px-4 py-2 font-semibold">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {d.orders.map((o) => (
                  <tr key={o.id}>
                    <td className="px-4 py-2 font-mono text-xs">{o.id}</td>
                    <td className="px-4 py-2 capitalize">{o.side}</td>
                    <td className="px-4 py-2">{o.orderType}</td>
                    <td className="px-4 py-2">{o.quantity}</td>
                    <td className="px-4 py-2">{o.status}</td>
                    <td className="px-4 py-2 text-slate-500">
                      {shortDateTime(o.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section aria-labelledby="executions-heading" className="mt-10">
          <h2
            id="executions-heading"
            className="text-lg font-bold text-slate-900"
          >
            Executions
          </h2>
          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full min-w-[620px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                  <th className="px-4 py-2 font-semibold">Execution ID</th>
                  <th className="px-4 py-2 font-semibold">Order</th>
                  <th className="px-4 py-2 font-semibold">Side</th>
                  <th className="px-4 py-2 font-semibold">Quantity</th>
                  <th className="px-4 py-2 font-semibold">Price</th>
                  <th className="px-4 py-2 font-semibold">Fees</th>
                  <th className="px-4 py-2 font-semibold">Executed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {d.executions.map((e) => (
                  <tr key={e.id}>
                    <td className="px-4 py-2 font-mono text-xs">{e.id}</td>
                    <td className="px-4 py-2 font-mono text-xs">{e.orderId}</td>
                    <td className="px-4 py-2 capitalize">{e.side}</td>
                    <td className="px-4 py-2">{e.quantity}</td>
                    <td className="px-4 py-2">{money(e.price)}</td>
                    <td className="px-4 py-2">{money(e.fees)}</td>
                    <td className="px-4 py-2 text-slate-500">
                      {shortDateTime(e.executedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </>
  );
}

/** Display-only helpers (formatting of backend values, no logic). */
function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  });
}
