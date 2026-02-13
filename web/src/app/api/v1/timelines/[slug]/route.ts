import { badRequest, notFound, ok, serverError } from "@/lib/api";
import { getTimelineBySlug } from "@/lib/timelines";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    if (!slug) return badRequest("slug is required");

    const timeline = await getTimelineBySlug(slug);
    if (!timeline) return notFound("Timeline not found");
    return ok(timeline);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return serverError(message);
  }
}
