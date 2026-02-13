import { badRequest, created, requireServiceToken, serverError } from "@/lib/api";
import { createIngestionJob, validateCreateIngestionJobInput } from "@/lib/ingestion";

export async function POST(req: Request) {
  try {
    const auth = requireServiceToken(req);
    if (auth) return auth;

    const body = await req.json().catch(() => null);
    const validation = validateCreateIngestionJobInput(body);
    if (validation.error || !validation.value) {
      return badRequest(validation.error ?? "invalid request");
    }

    const job = await createIngestionJob(validation.value);
    return created(job);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return serverError(message);
  }
}
