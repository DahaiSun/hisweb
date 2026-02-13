import { badRequest, notFound, ok, requireAdmin, serverError } from "@/lib/api";
import { isValidUuid, publishEvent } from "@/lib/events";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = requireAdmin(req);
    if (auth) return auth;

    const { id } = await params;
    if (!isValidUuid(id)) return badRequest("id must be a UUID");

    const event = await publishEvent(id);
    if (!event) return notFound("Event not found");
    return ok(event);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return serverError(message);
  }
}
