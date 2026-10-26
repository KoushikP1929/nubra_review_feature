"use client";

import { useRouter } from "next/navigation";

/**
 * Month dropdown that navigates as soon as the value changes. A one-purpose
 * client component — no state library, no Attributes — just locating to the
 * same page with a new ?month= value.
 */
export function MonthSelect({
  months,
  value,
  basePath,
}: {
  months: string[];
  value: string;
  basePath: string;
}) {
  const router = useRouter();
  return (
    <select
      aria-label="Month"
      value={value}
      onChange={(e) => router.push(`${basePath}?month=${e.target.value}`)}
      className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 shadow-sm hover:border-slate-400"
    >
      {months.map((m) => (
        <option key={m} value={m}>
          {monthLabel(m)}
        </option>
      ))}
    </select>
  );
}

function monthLabel(ym: string): string {
  return new Date(`${ym}-01T00:00:00Z`).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
