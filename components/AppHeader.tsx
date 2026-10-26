/** Shared header + the standing sample-data notice shown on every screen. */
export function AppHeader() {
  return (
    <header className="border-b border-zinc-200 dark:border-zinc-800">
      <div className="mx-auto w-full max-w-6xl px-6 py-6">
        <p className="text-lg font-semibold tracking-tight">Nubra Trade Review</p>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Post-trade review of completed positions and recurring trading
          behavior.
        </p>
        <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/40 dark:text-amber-200">
          <strong>Illustrative sample data.</strong> All trades shown are
          clearly marked placeholder data, not sourced from any live broker or
          exchange.
        </div>
      </div>
    </header>
  );
}
