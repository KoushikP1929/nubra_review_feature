import {
  apiError,
  getMonthlyPositions,
  parseMonth,
  parsePositionFilters,
} from "@/lib/position-review";

/** GET /api/months/[month]/positions?outcome=&q= — filtered trade list. */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ month: string }> },
) {
  const { month } = await ctx.params;
  const input = parseMonth(month);
  if (!input.ok) return apiError(input.error, input.status);
  const filters = parsePositionFilters(new URL(req.url).searchParams);
  if (filters instanceof Response) return filters;
  try {
    return await getMonthlyPositions(input.range, filters);
  } catch {
    return apiError("Database error while listing positions.", 500);
  }
}
