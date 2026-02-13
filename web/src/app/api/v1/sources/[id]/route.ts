import { badRequest, notFound, ok, serverError } from "@/lib/api";
import { isValidUuid } from "@/lib/events";
import { getSourceById } from "@/lib/sources";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!isValidUuid(id)) return badRequest("id must be a UUID");

    const source = await getSourceById(id);
    if (!source) return notFound("Source not found");
    return ok(source);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return serverError(message);
  }
}
