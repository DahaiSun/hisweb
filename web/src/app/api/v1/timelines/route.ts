import { ok, serverError } from "@/lib/api";
import { listTimelinesPublic } from "@/lib/timelines";

export async function GET() {
  try {
    const timelines = await listTimelinesPublic();
    return ok({
      total: timelines.length,
      items: timelines,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return serverError(message);
  }
}
