import { badRequest, ok, requireServiceToken, serverError } from "@/lib/api";
import { runIngestionImport, validateIngestionImportPayload } from "@/lib/ingestion";

export async function POST(req: Request) {
  try {
    const auth = requireServiceToken(req);
    if (auth) return auth;

    const body = await req.json().catch(() => null);
    const validation = validateIngestionImportPayload(body);
    if (validation.error || !validation.value) {
      return badRequest(validation.error ?? "invalid request");
    }

    const result = await runIngestionImport(validation.value);
    return ok(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return serverError(message);
  }
}
