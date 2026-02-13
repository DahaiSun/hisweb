import { badRequest, ok, serverError } from "@/lib/api";
import { listPublishedEventsByMonthDay } from "@/lib/events";

const MONTH_DAY_RE = /^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ monthDay: string }> },
) {
  try {
    const { monthDay } = await params;
    if (!MONTH_DAY_RE.test(monthDay)) {
      return badRequest("monthDay must be MM-DD format");
    }

    const items = await listPublishedEventsByMonthDay(monthDay);
    return ok({
      month_day: monthDay,
      total: items.length,
      items,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return serverError(message);
  }
}
