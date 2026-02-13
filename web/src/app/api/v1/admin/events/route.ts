import { badRequest, conflict, created, requireAdmin, serverError } from "@/lib/api";
import { createEvent, validateCreateEventInput } from "@/lib/events";

export async function POST(req: Request) {
  try {
    const auth = requireAdmin(req);
    if (auth) return auth;

    const body = await req.json().catch(() => null);
    const validation = validateCreateEventInput(body);
    if (validation.error || !validation.value) {
      return badRequest(validation.error ?? "invalid request");
    }

    const event = await createEvent(validation.value);
    return created(event);
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "23505") return conflict("event slug already exists");
    const message = error instanceof Error ? error.message : "Unknown error";
    return serverError(message);
  }
}
