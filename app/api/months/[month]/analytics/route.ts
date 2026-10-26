import {
  apiError,
  getMonthlyAnalytics,
  parseMonth,
} from "@/lib/position-review";

/** GET /api/months/[month]/analytics — monthly analytics for `month`. */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ month: string }> },
) {
  const { month } = await ctx.params;
  const input = parseMonth(month);
  if (!input.ok) return apiError(input.error, input.status);
  try {
    return await getMonthlyAnalytics(input.range);
  } catch {
    return apiError("Database error while calculating monthly analytics.", 500);
  }
}
