import { apiError, getMonthlyPositions, parseMonth } from "@/lib/position-review";

/** GET /api/months/[month]/positions — completed positions for `month`. */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ month: string }> },
) {
  const { month } = await ctx.params;
  const input = parseMonth(month);
  if (!input.ok) return apiError(input.error, input.status);
  try {
    return await getMonthlyPositions(input.range);
  } catch {
    return apiError("Database error while listing positions.", 500);
  }
}
