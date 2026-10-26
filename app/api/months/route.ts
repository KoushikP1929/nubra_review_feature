import { apiError, listAvailableMonths } from "@/lib/position-review";

/** GET /api/months — months that contain completed positions. */
export async function GET() {
  try {
    return await listAvailableMonths();
  } catch {
    return apiError("Database error while listing months.", 500);
  }
}
