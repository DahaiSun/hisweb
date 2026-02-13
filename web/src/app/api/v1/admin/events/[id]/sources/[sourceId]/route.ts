import { badRequest, notFound, ok, requireAdmin, serverError } from "@/lib/api";
import { isValidUuid } from "@/lib/events";
import { attachSourceToEvent, detachSourceFromEvent, validateAttachSourceInput } from "@/lib/sources";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; sourceId: string }> },
) {
  try {
    const auth = requireAdmin(req);
    if (auth) return auth;

    const { id, sourceId } = await params;
    if (!isValidUuid(id)) return badRequest("id must be a UUID");
    if (!isValidUuid(sourceId)) return badRequest("sourceId must be a UUID");

    const body = await req.json().catch(() => undefined);
    const validation = validateAttachSourceInput(body);
    if (validation.error || !validation.value) {
      return badRequest(validation.error ?? "invalid request");
    }

    const relation = await attachSourceToEvent(id, sourceId, validation.value);
    return ok(relation);
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "23503") return notFound("Event or source not found");
    const message = error instanceof Error ? error.message : "Unknown error";
    return serverError(message);
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; sourceId: string }> },
) {
  try {
    const auth = requireAdmin(req);
    if (auth) return auth;

    const { id, sourceId } = await params;
    if (!isValidUuid(id)) return badRequest("id must be a UUID");
    if (!isValidUuid(sourceId)) return badRequest("sourceId must be a UUID");

    const relation = await detachSourceFromEvent(id, sourceId);
    if (!relation) return notFound("Event/source link not found");
    return ok(relation);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return serverError(message);
  }
}
