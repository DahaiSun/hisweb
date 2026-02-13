import { badRequest, conflict, notFound, ok, requireAdmin, serverError } from "@/lib/api";
import { isValidUuid, updateEvent, validateUpdateEventInput } from "@/lib/events";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = requireAdmin(req);
    if (auth) return auth;

    const { id } = await params;
    if (!isValidUuid(id)) return badRequest("id must be a UUID");

    const body = await req.json().catch(() => null);
    const validation = validateUpdateEventInput(body);
    if (validation.error || !validation.value) {
      return badRequest(validation.error ?? "invalid request");
    }

    const event = await updateEvent(id, validation.value);
    if (!event) return notFound("Event not found");
    return ok(event);
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "23505") return conflict("event slug already exists");
    const message = error instanceof Error ? error.message : "Unknown error";
    return serverError(message);
  }
}
