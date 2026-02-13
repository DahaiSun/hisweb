import { badRequest, notFound, ok, requireServiceToken, serverError } from "@/lib/api";
import { isValidUuid } from "@/lib/events";
import { updateIngestionJob, validateUpdateIngestionJobInput } from "@/lib/ingestion";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = requireServiceToken(req);
    if (auth) return auth;

    const { id } = await params;
    if (!isValidUuid(id)) return badRequest("id must be a UUID");

    const body = await req.json().catch(() => null);
    const validation = validateUpdateIngestionJobInput(body);
    if (validation.error || !validation.value) {
      return badRequest(validation.error ?? "invalid request");
    }

    const job = await updateIngestionJob(id, validation.value);
    if (!job) return notFound("Ingestion job not found");
    return ok(job);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return serverError(message);
  }
}
