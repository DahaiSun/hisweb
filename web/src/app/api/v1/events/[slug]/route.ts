import { badRequest, notFound, ok, serverError } from "@/lib/api";
import { getPublishedEventBySlug } from "@/lib/events";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    if (!slug) return badRequest("slug is required");

    const event = await getPublishedEventBySlug(slug);
    if (!event) return notFound("Event not found");
    return ok(event);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return serverError(message);
  }
}
