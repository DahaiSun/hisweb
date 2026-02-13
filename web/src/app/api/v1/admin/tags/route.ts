import { badRequest, conflict, created, requireAdmin, serverError } from "@/lib/api";
import { createTag, validateCreateTagInput } from "@/lib/tags";

export async function POST(req: Request) {
  try {
    const auth = requireAdmin(req);
    if (auth) return auth;

    const body = await req.json().catch(() => null);
    const validation = validateCreateTagInput(body);
    if (validation.error || !validation.value) {
      return badRequest(validation.error ?? "invalid request");
    }

    const tag = await createTag(validation.value);
    return created(tag);
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "23505") return conflict("tag name or slug already exists");
    const message = error instanceof Error ? error.message : "Unknown error";
    return serverError(message);
  }
}
