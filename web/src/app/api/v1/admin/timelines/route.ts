import { badRequest, conflict, created, requireAdmin, serverError } from "@/lib/api";
import { createTimeline, validateCreateTimelineInput } from "@/lib/timelines";

export async function POST(req: Request) {
  try {
    const auth = requireAdmin(req);
    if (auth) return auth;

    const body = await req.json().catch(() => null);
    const validation = validateCreateTimelineInput(body);
    if (validation.error || !validation.value) {
      return badRequest(validation.error ?? "invalid request");
    }

    const timeline = await createTimeline(validation.value);
    return created(timeline);
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "23505") return conflict("timeline slug already exists");
    const message = error instanceof Error ? error.message : "Unknown error";
    return serverError(message);
  }
}
