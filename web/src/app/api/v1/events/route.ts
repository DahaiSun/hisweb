import { badRequest, ok, serverError } from "@/lib/api";
import { listPublishedEvents, validateListFilters } from "@/lib/events";

const SORT_VALUES = new Set(["date_desc", "date_asc", "importance_desc"]);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const page = Number(searchParams.get("page") ?? "1");
    const pageSize = Number(searchParams.get("page_size") ?? "20");
    const importanceMinRaw = searchParams.get("importance_min");
    const importanceMin =
      importanceMinRaw === null ? null : Number.parseInt(importanceMinRaw, 10);
    const sort = searchParams.get("sort") ?? "date_desc";

    if (!Number.isFinite(page) || page < 1) return badRequest("page must be >= 1");
    if (!Number.isFinite(pageSize) || pageSize < 1 || pageSize > 100) {
      return badRequest("page_size must be between 1 and 100");
    }
    if (
      importanceMinRaw !== null &&
      (!Number.isFinite(importanceMin) || !Number.isInteger(importanceMin))
    ) {
      return badRequest("importance_min must be an integer");
    }
    if (!SORT_VALUES.has(sort)) {
      return badRequest("sort must be one of: date_desc, date_asc, importance_desc");
    }

    const date = searchParams.get("date");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const dateError = validateListFilters({
      date,
      from,
      to,
      importanceMin,
    });
    if (dateError) return badRequest(dateError);

    const result = await listPublishedEvents({
      date,
      from,
      to,
      category: searchParams.get("category"),
      region: searchParams.get("region"),
      tag: searchParams.get("tag"),
      importanceMin,
      q: searchParams.get("q"),
      page,
      pageSize,
      sort: sort as "date_desc" | "date_asc" | "importance_desc",
    });

    return ok(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return serverError(message);
  }
}
