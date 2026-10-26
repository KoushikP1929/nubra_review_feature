import Link from "next/link";

/**
 * Shared app header: dark demo-data banner + logo + brand + Dashboard/Trades
 * tabs. Passing the active tab highlights it, matching the approved design.
 */
export function AppHeader({ active }: { active: "dashboard" | "trades" | "none" }) {
  return (
    <>
      <div className="bg-slate-900 px-6 py-3 text-center text-sm text-zinc-100">
        🧪 Demo data — not connected to Nubra. All trades are illustrative
        samples.
      </div>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-lg font-bold text-white">
              N
            </span>
            <span className="text-lg">
              <span className="font-bold text-slate-900">Nubra</span>
              <span className="text-slate-700"> Trade Review</span>
            </span>
          </Link>
          <nav className="flex items-center gap-2">
            <Link
              href="/"
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium ${
                active === "dashboard"
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                <rect x="1" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
                <rect x="9" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
                <rect x="1" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
                <rect x="9" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
              </svg>
              Dashboard
            </Link>
            <Link
              href="/trades"
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium ${
                active === "trades"
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                <line x1="5" y1="2" x2="5" y2="14" stroke="currentColor" strokeWidth="1.5" />
                <line x1="10" y1="2" x2="10" y2="14" stroke="currentColor" strokeWidth="1.5" />
                <line x1="15" y1="2" x2="15" y2="14" stroke="currentColor" strokeWidth="1.5" />
              </svg>
              Trades
            </Link>
          </nav>
        </div>
      </header>
    </>
  );
}
