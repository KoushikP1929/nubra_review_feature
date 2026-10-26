import { apiError, parsePositionId, getPositionDetail } from "@/lib/position-review";

/** GET /api/positions/[id] — full review detail for one position. */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const input = parsePositionId(id);
  if (!input.ok) return apiError(input.error, input.status);
  try {
    return await getPositionDetail(input.id);
  } catch {
    return apiError("Database error while loading the position.", 500);
  }
}
