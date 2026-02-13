import { badRequest, conflict, notFound, ok, requireAdmin, serverError } from "@/lib/api";
import { isValidUuid } from "@/lib/events";
import {
  attachEventToTimeline,
  detachEventFromTimeline,
  updateTimelineEventSequence,
  validateSequenceInput,
} from "@/lib/timelines";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; eventId: string }> },
) {
  try {
    const auth = requireAdmin(req);
    if (auth) return auth;

    const { id, eventId } = await params;
    if (!isValidUuid(id)) return badRequest("id must be a UUID");
    if (!isValidUuid(eventId)) return badRequest("eventId must be a UUID");

    const body = await req.json().catch(() => null);
    const validation = validateSequenceInput(body);
    if (validation.error || validation.value === undefined) {
      return badRequest(validation.error ?? "invalid request");
    }

    const relation = await attachEventToTimeline(id, eventId, validation.value);
    return ok(relation);
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "23503") return notFound("Timeline or event not found");
    if (code === "23505") return conflict("sequence_no already used in this timeline");
    const message = error instanceof Error ? error.message : "Unknown error";
    return serverError(message);
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; eventId: string }> },
) {
  try {
    const auth = requireAdmin(req);
    if (auth) return auth;

    const { id, eventId } = await params;
    if (!isValidUuid(id)) return badRequest("id must be a UUID");
    if (!isValidUuid(eventId)) return badRequest("eventId must be a UUID");

    const body = await req.json().catch(() => null);
    const validation = validateSequenceInput(body);
    if (validation.error || validation.value === undefined) {
      return badRequest(validation.error ?? "invalid request");
    }

    const relation = await updateTimelineEventSequence(id, eventId, validation.value);
    if (!relation) return notFound("Timeline-event link not found");
    return ok(relation);
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "23505") return conflict("sequence_no already used in this timeline");
    const message = error instanceof Error ? error.message : "Unknown error";
    return serverError(message);
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; eventId: string }> },
) {
  try {
    const auth = requireAdmin(req);
    if (auth) return auth;

    const { id, eventId } = await params;
    if (!isValidUuid(id)) return badRequest("id must be a UUID");
    if (!isValidUuid(eventId)) return badRequest("eventId must be a UUID");

    const relation = await detachEventFromTimeline(id, eventId);
    if (!relation) return notFound("Timeline-event link not found");
    return ok(relation);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return serverError(message);
  }
}
