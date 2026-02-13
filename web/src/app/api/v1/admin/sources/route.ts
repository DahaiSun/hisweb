import { badRequest, conflict, created, requireAdmin, serverError } from "@/lib/api";
import { createSource, validateCreateSourceInput } from "@/lib/sources";

export async function POST(req: Request) {
  try {
    const auth = requireAdmin(req);
    if (auth) return auth;

    const body = await req.json().catch(() => null);
    const validation = validateCreateSourceInput(body);
    if (validation.error || !validation.value) {
      return badRequest(validation.error ?? "invalid request");
    }

    const source = await createSource(validation.value);
    return created(source);
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "23505") return conflict("source_url already exists");
    const message = error instanceof Error ? error.message : "Unknown error";
    return serverError(message);
  }
}
