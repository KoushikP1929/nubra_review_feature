import Link from "next/link";

import { AppHeader } from "@/components/AppHeader";
import {
  backendErrorMessage,
  money,
  pnlColorClass,
  reviewApi,
  shortDateTime,
  signedMoney,
  type PositionDetailResponse,
} from "@/lib/review-api-client";

/**
 * Screen 2 — Individual Trade Review.
 *
 * Renders what GET /api/positions/[id] returns: position facts, entry and
 * exit details, raw orders and executions, evidence-backed observations,
 * and neutral improvement prompts. No analytics are computed here.
 */

type PositionPageProps = { params: Promise<{ id: string }> };

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
        <AppHeader />
        <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
          <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
            {res.status === 404
              ? "Position not found. Completed positions are listed on the monthly review dashboard."
              : backendErrorMessage(res.status, `/api/positions/${id}`)}
          </div>
          <p className="mt-4">
            <Link
              href="/"
              className="text-sm font-medium text-zinc-900 underline dark:text-zinc-100"
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
  const isPositive = p.realizedPnl > 0;

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
        <p>
          <Link
            href={`/?month=${p.closedAt.slice(0, 7)}`}
            className="text-sm font-medium text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            ← Back to monthly review
          </Link>
        </p>

        {/* Position information */}
        <section className="mt-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <h1 className="text-2xl font-semibold tracking-tight">
              {p.instrument} — {p.side} position
            </h1>
            <span className="inline-flex w-fit rounded-full border border-zinc-300 px-2 py-0.5 text-xs text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
              {p.status}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
            {/* Entry */}
            <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
              <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                Entry ({d.entry?.side ?? "—"})
              </p>
              <p className="mt-2 text-xl font-semibold">
                {d.entry ? money(d.entry.price) : "—"}
              </p>
              <dl className="mt-3 space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
                <div className="flex justify-between">
                  <dt>Quantity</dt>
                  <dd>{d.entry?.quantity ?? "—"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Order type</dt>
                  <dd>{d.entry?.orderType ?? "—"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Executed</dt>
                  <dd>
                    {d.entry ? shortDateTime(d.entry.executedAt) : "—"}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt>Fees</dt>
                  <dd>{d.entry ? money(d.entry.fees) : "—"}</dd>
                </div>
              </dl>
              <p className="mt-2 text-[11px] text-zinc-400">
                Order {d.entry?.orderId ?? "—"} · Execution{" "}
                {d.entry?.executionId ?? "—"}
              </p>
            </div>

            {/* Exit */}
            <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
              <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                Exit ({d.exit?.side ?? "—"})
              </p>
              <p className="mt-2 text-xl font-semibold">
                {d.exit ? money(d.exit.price) : "—"}
              </p>
              <dl className="mt-3 space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
                <div className="flex justify-between">
                  <dt>Quantity</dt>
                  <dd>{d.exit?.quantity ?? "—"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Order type</dt>
                  <dd>{d.exit?.orderType ?? "—"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Executed</dt>
                  <dd>{d.exit ? shortDateTime(d.exit.executedAt) : "—"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Fees</dt>
                  <dd>{d.exit ? money(d.exit.fees) : "—"}</dd>
                </div>
              </dl>
              <p className="mt-2 text-[11px] text-zinc-400">
                Order {d.exit?.orderId ?? "—"} · Execution{" "}
                {d.exit?.executionId ?? "—"}
              </p>
            </div>

            {/* Outcome */}
            <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
              <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                Realized P&amp;L
              </p>
              <p
                className={`mt-2 text-3xl font-semibold ${pnlColorClass(p.realizedPnl)}`}
              >
                {signedMoney(p.realizedPnl)} USD
              </p>
              <p
                className={`mt-1 text-sm ${pnlColorClass(p.realizedPnl)}`}
              >
                {isPositive
                  ? "Profitable outcome"
                  : p.realizedPnl < 0
                    ? "Losing outcome"
                    : "Break-even outcome"}
              </p>
              <dl className="mt-3 space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
                <div className="flex justify-between">
                  <dt>Opened</dt>
                  <dd>{shortDateTime(p.openedAt)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Closed</dt>
                  <dd>{shortDateTime(p.closedAt)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Hold duration</dt>
                  <dd>{p.holdDurationMinutes} min</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Total fees</dt>
                  <dd>{money(p.feesTotal)}</dd>
                </div>
              </dl>
            </div>
          </div>
        </section>

        {/* Orders */}
        <section aria-labelledby="orders-heading" className="mt-10">
          <h2
            id="orders-heading"
            className="text-lg font-semibold tracking-tight"
          >
            Orders
          </h2>
          <div className="mt-4 overflow-x-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                  <th className="px-4 py-2 font-medium">Order ID</th>
                  <th className="px-4 py-2 font-medium">Side</th>
                  <th className="px-4 py-2 font-medium">Type</th>
                  <th className="px-4 py-2 font-medium">Quantity</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {d.orders.map((o) => (
                  <tr key={o.id}>
                    <td className="px-4 py-2 font-mono text-xs">{o.id}</td>
                    <td className="px-4 py-2 capitalize">{o.side}</td>
                    <td className="px-4 py-2">{o.orderType}</td>
                    <td className="px-4 py-2">{o.quantity}</td>
                    <td className="px-4 py-2">{o.status}</td>
                    <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">
                      {shortDateTime(o.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Executions */}
        <section aria-labelledby="executions-heading" className="mt-10">
          <h2
            id="executions-heading"
            className="text-lg font-semibold tracking-tight"
          >
            Executions
          </h2>
          <div className="mt-4 overflow-x-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
            <table className="w-full min-w-[620px] text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                  <th className="px-4 py-2 font-medium">Execution ID</th>
                  <th className="px-4 py-2 font-medium">Order</th>
                  <th className="px-4 py-2 font-medium">Side</th>
                  <th className="px-4 py-2 font-medium">Quantity</th>
                  <th className="px-4 py-2 font-medium">Price</th>
                  <th className="px-4 py-2 font-medium">Fees</th>
                  <th className="px-4 py-2 font-medium">Executed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {d.executions.map((e) => (
                  <tr key={e.id}>
                    <td className="px-4 py-2 font-mono text-xs">{e.id}</td>
                    <td className="px-4 py-2 font-mono text-xs">{e.orderId}</td>
                    <td className="px-4 py-2 capitalize">{e.side}</td>
                    <td className="px-4 py-2">{e.quantity}</td>
                    <td className="px-4 py-2">{money(e.price)}</td>
                    <td className="px-4 py-2">{money(e.fees)}</td>
                    <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">
                      {shortDateTime(e.executedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Evidence-backed observations */}
        <section aria-labelledby="observations-heading" className="mt-10">
          <h2
            id="observations-heading"
            className="text-lg font-semibold tracking-tight"
          >
            Observations
          </h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {d.observations.note}
          </p>
          <ul className="mt-4 space-y-3">
            {d.observations.facts.map((f) => (
              <li
                key={f.fact}
                className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
              >
                <p className="text-sm">
                  <span className="font-medium">{f.fact}:</span>{" "}
                  {f.value}
                </p>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">
                  Evidence: {f.evidence}
                </p>
              </li>
            ))}
          </ul>
        </section>

        {/* Improvement prompts */}
        <section aria-labelledby="prompts-heading" className="mt-10">
          <h2
            id="prompts-heading"
            className="text-lg font-semibold tracking-tight"
          >
            Improvement prompts
          </h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {d.improvementPrompts.note}
          </p>
          <ol className="mt-4 list-decimal space-y-3 rounded-lg border border-zinc-200 bg-white p-6 pl-10 text-sm dark:border-zinc-800 dark:bg-zinc-950 dark:marker:text-zinc-500">
            {d.improvementPrompts.prompts.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ol>
        </section>
      </main>
    </>
  );
}
