import { badRequest, notFound, ok, requireAdmin, serverError } from "@/lib/api";
import { isValidUuid } from "@/lib/events";
import { attachTagToEvent, detachTagFromEvent } from "@/lib/tags";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; tagId: string }> },
) {
  try {
    const auth = requireAdmin(req);
    if (auth) return auth;

    const { id, tagId } = await params;
    if (!isValidUuid(id)) return badRequest("id must be a UUID");
    if (!isValidUuid(tagId)) return badRequest("tagId must be a UUID");

    const link = await attachTagToEvent(id, tagId);
    if (!link) return notFound("Event or tag not found");
    return ok(link);
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "23503") return notFound("Event or tag not found");
    const message = error instanceof Error ? error.message : "Unknown error";
    return serverError(message);
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; tagId: string }> },
) {
  try {
    const auth = requireAdmin(req);
    if (auth) return auth;

    const { id, tagId } = await params;
    if (!isValidUuid(id)) return badRequest("id must be a UUID");
    if (!isValidUuid(tagId)) return badRequest("tagId must be a UUID");

    const link = await detachTagFromEvent(id, tagId);
    if (!link) return notFound("Event/tag link not found");
    return ok(link);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return serverError(message);
  }
}
