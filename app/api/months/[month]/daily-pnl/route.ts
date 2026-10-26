import { apiError, getDailyPnl, parseMonth } from "@/lib/position-review";

/** GET /api/months/[month]/daily-pnl — per-day net P&L for `month`. */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ month: string }> },
) {
  const { month } = await ctx.params;
  const input = parseMonth(month);
  if (!input.ok) return apiError(input.error, input.status);
  try {
    return await getDailyPnl(input.range);
  } catch {
    return apiError("Database error while calculating daily P&L.", 500);
  }
}
