import { getDbPool } from "@/lib/db";
import { type PoolClient } from "pg";

type JobStatus = "queued" | "running" | "succeeded" | "failed";
type SourceType = "archive" | "official" | "news" | "research" | "dataset" | "other";
type EventStatus = "draft" | "review" | "published" | "archived";

const JOB_STATUS_SET = new Set<JobStatus>(["queued", "running", "succeeded", "failed"]);
const SOURCE_TYPE_SET = new Set<SourceType>([
  "archive",
  "official",
  "news",
  "research",
  "dataset",
  "other",
]);
const EVENT_STATUS_SET = new Set<EventStatus>(["draft", "review", "published", "archived"]);

export type IngestionJobRecord = {
  id: string;
  source_name: string;
  job_type: string;
  status: JobStatus;
  started_at: string | null;
  finished_at: string | null;
  records_in: number;
  records_out: number;
  error_message: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type CreateIngestionJobInput = {
  source_name: string;
  job_type: string;
  metadata?: Record<string, unknown>;
};

export type UpdateIngestionJobInput = Partial<{
  status: JobStatus;
  started_at: string;
  finished_at: string;
  records_in: number;
  records_out: number;
  error_message: string;
  metadata: Record<string, unknown>;
}>;

type ImportSourceItem = {
  source_name: string;
  source_url: string;
  source_type: SourceType;
  publisher?: string;
  publication_or_snapshot_date?: string;
  access_date?: string;
  rights_note?: string;
  notes_on_reliability?: string;
};

type ImportEventItem = {
  slug?: string;
  title: string;
  event_date: string;
  region: string;
  category: string;
  summary: string;
  impact: string;
  importance_score: number;
  confidence_score?: number;
  status?: EventStatus;
};

type ImportEventSourceItem = {
  event_slug: string;
  source_url: string;
  relevance_rank?: number;
  quote_excerpt?: string;
  citation_note?: string;
};

export type IngestionImportPayload = {
  sources?: ImportSourceItem[];
  events?: ImportEventItem[];
  event_sources?: ImportEventSourceItem[];
};

export type IngestionImportResult = {
  sources_upserted: number;
  events_upserted: number;
  event_source_links_upserted: number;
  errors: string[];
};

function asObject(input: unknown): Record<string, unknown> | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  return input as Record<string, unknown>;
}

function asTrimmedString(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const value = input.trim();
  return value.length > 0 ? value : null;
}

function asOptionalTrimmedString(input: unknown): string | undefined {
  if (input === undefined) return undefined;
  return asTrimmedString(input) ?? undefined;
}

function asObjectRecord(input: unknown): Record<string, unknown> | null {
  if (input === undefined) return {};
  const body = asObject(input);
  return body;
}

function asIntInRange(input: unknown, min: number, max: number): number | null {
  if (typeof input !== "number" || !Number.isInteger(input)) return null;
  if (input < min || input > max) return null;
  return input;
}

function asNonNegativeInt(input: unknown): number | null {
  if (typeof input !== "number" || !Number.isInteger(input) || input < 0) return null;
  return input;
}

function isValidDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function normalizeIsoTimestamp(value: string): string | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function slugify(input: string): string {
  const normalized = input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
  return normalized || "event";
}

function isValidSlug(input: string) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input);
}

function isSourceType(input: string): input is SourceType {
  return SOURCE_TYPE_SET.has(input as SourceType);
}

function isEventStatus(input: string): input is EventStatus {
  return EVENT_STATUS_SET.has(input as EventStatus);
}

export function validateCreateIngestionJobInput(input: unknown): {
  value?: CreateIngestionJobInput;
  error?: string;
} {
  const body = asObject(input);
  if (!body) return { error: "request body must be a JSON object" };

  const sourceName = asTrimmedString(body.source_name);
  const jobType = asTrimmedString(body.job_type);
  const metadata = asObjectRecord(body.metadata);

  if (!sourceName) return { error: "source_name is required" };
  if (!jobType) return { error: "job_type is required" };
  if (!metadata) return { error: "metadata must be an object" };

  return {
    value: {
      source_name: sourceName,
      job_type: jobType,
      metadata,
    },
  };
}

export function validateUpdateIngestionJobInput(input: unknown): {
  value?: UpdateIngestionJobInput;
  error?: string;
} {
  const body = asObject(input);
  if (!body) return { error: "request body must be a JSON object" };

  const out: UpdateIngestionJobInput = {};

  if ("status" in body) {
    const status = asTrimmedString(body.status);
    if (!status || !JOB_STATUS_SET.has(status as JobStatus)) {
      return { error: "status must be one of: queued, running, succeeded, failed" };
    }
    out.status = status as JobStatus;
  }
  if ("started_at" in body) {
    const value = asOptionalTrimmedString(body.started_at);
    if (value !== undefined) {
      const parsed = normalizeIsoTimestamp(value);
      if (!parsed) return { error: "started_at must be a valid datetime" };
      out.started_at = parsed;
    }
  }
  if ("finished_at" in body) {
    const value = asOptionalTrimmedString(body.finished_at);
    if (value !== undefined) {
      const parsed = normalizeIsoTimestamp(value);
      if (!parsed) return { error: "finished_at must be a valid datetime" };
      out.finished_at = parsed;
    }
  }
  if ("records_in" in body) {
    const value = asNonNegativeInt(body.records_in);
    if (value === null) return { error: "records_in must be an integer >= 0" };
    out.records_in = value;
  }
  if ("records_out" in body) {
    const value = asNonNegativeInt(body.records_out);
    if (value === null) return { error: "records_out must be an integer >= 0" };
    out.records_out = value;
  }
  if ("error_message" in body) {
    const value = asOptionalTrimmedString(body.error_message);
    out.error_message = value ?? "";
  }
  if ("metadata" in body) {
    const value = asObjectRecord(body.metadata);
    if (!value) return { error: "metadata must be an object" };
    out.metadata = value;
  }

  if (Object.keys(out).length === 0) return { error: "no updatable fields provided" };

  return { value: out };
}

function validateImportSource(item: unknown): { value?: ImportSourceItem; error?: string } {
  const body = asObject(item);
  if (!body) return { error: "source item must be an object" };

  const sourceName = asTrimmedString(body.source_name);
  const sourceUrl = asTrimmedString(body.source_url);
  const sourceTypeRaw = asOptionalTrimmedString(body.source_type) ?? "other";
  if (!sourceName) return { error: "source_name is required" };
  if (!sourceUrl) return { error: "source_url is required" };
  if (!isSourceType(sourceTypeRaw)) {
    return { error: "source_type must be archive|official|news|research|dataset|other" };
  }

  const publicationRaw = asOptionalTrimmedString(body.publication_or_snapshot_date);
  const accessDate = asOptionalTrimmedString(body.access_date);
  const publication = publicationRaw ? normalizeIsoTimestamp(publicationRaw) : undefined;
  if (publicationRaw && !publication) {
    return { error: "publication_or_snapshot_date must be a valid datetime" };
  }
  if (accessDate && !isValidDate(accessDate)) return { error: "access_date must be YYYY-MM-DD" };

  return {
    value: {
      source_name: sourceName,
      source_url: sourceUrl,
      source_type: sourceTypeRaw,
      publisher: asOptionalTrimmedString(body.publisher),
      publication_or_snapshot_date: publication ?? undefined,
      access_date: accessDate,
      rights_note: asOptionalTrimmedString(body.rights_note),
      notes_on_reliability: asOptionalTrimmedString(body.notes_on_reliability),
    },
  };
}

function validateImportEvent(item: unknown): { value?: ImportEventItem; error?: string } {
  const body = asObject(item);
  if (!body) return { error: "event item must be an object" };

  const title = asTrimmedString(body.title);
  const eventDate = asTrimmedString(body.event_date);
  const region = asTrimmedString(body.region);
  const category = asTrimmedString(body.category);
  const summary = asTrimmedString(body.summary);
  const impact = asTrimmedString(body.impact);
  const importance = asIntInRange(body.importance_score, 1, 5);
  const confidence =
    body.confidence_score === undefined ? 3 : asIntInRange(body.confidence_score, 1, 5);
  const slugRaw = asOptionalTrimmedString(body.slug);
  const statusRaw = asOptionalTrimmedString(body.status) ?? "draft";

  if (!title) return { error: "title is required" };
  if (!eventDate || !isValidDate(eventDate)) return { error: "event_date must be YYYY-MM-DD" };
  if (!region) return { error: "region is required" };
  if (!category) return { error: "category is required" };
  if (!summary) return { error: "summary is required" };
  if (!impact) return { error: "impact is required" };
  if (importance === null) return { error: "importance_score must be an integer 1-5" };
  if (confidence === null) return { error: "confidence_score must be an integer 1-5" };
  if (!isEventStatus(statusRaw)) return { error: "status must be draft|review|published|archived" };

  const normalizedSlug = slugify(slugRaw ?? title);
  if (!isValidSlug(normalizedSlug)) return { error: "slug is invalid" };

  return {
    value: {
      slug: normalizedSlug,
      title,
      event_date: eventDate,
      region,
      category,
      summary,
      impact,
      importance_score: importance,
      confidence_score: confidence,
      status: statusRaw,
    },
  };
}

function validateImportEventSource(item: unknown): {
  value?: ImportEventSourceItem;
  error?: string;
} {
  const body = asObject(item);
  if (!body) return { error: "event_source item must be an object" };

  const eventSlug = asTrimmedString(body.event_slug);
  const sourceUrl = asTrimmedString(body.source_url);
  const relevance =
    body.relevance_rank === undefined ? 1 : asIntInRange(body.relevance_rank, 1, 10);

  if (!eventSlug) return { error: "event_slug is required" };
  if (!sourceUrl) return { error: "source_url is required" };
  if (relevance === null) return { error: "relevance_rank must be an integer 1-10" };

  return {
    value: {
      event_slug: slugify(eventSlug),
      source_url: sourceUrl,
      relevance_rank: relevance,
      quote_excerpt: asOptionalTrimmedString(body.quote_excerpt),
      citation_note: asOptionalTrimmedString(body.citation_note),
    },
  };
}

export function validateIngestionImportPayload(input: unknown): {
  value?: IngestionImportPayload;
  error?: string;
} {
  const body = asObject(input);
  if (!body) return { error: "request body must be a JSON object" };

  const out: IngestionImportPayload = {};

  if ("sources" in body) {
    if (!Array.isArray(body.sources)) return { error: "sources must be an array" };
    const sources: ImportSourceItem[] = [];
    for (let i = 0; i < body.sources.length; i += 1) {
      const validated = validateImportSource(body.sources[i]);
      if (validated.error || !validated.value) return { error: `sources[${i}]: ${validated.error}` };
      sources.push(validated.value);
    }
    out.sources = sources;
  }

  if ("events" in body) {
    if (!Array.isArray(body.events)) return { error: "events must be an array" };
    const events: ImportEventItem[] = [];
    for (let i = 0; i < body.events.length; i += 1) {
      const validated = validateImportEvent(body.events[i]);
      if (validated.error || !validated.value) return { error: `events[${i}]: ${validated.error}` };
      events.push(validated.value);
    }
    out.events = events;
  }

  if ("event_sources" in body) {
    if (!Array.isArray(body.event_sources)) return { error: "event_sources must be an array" };
    const links: ImportEventSourceItem[] = [];
    for (let i = 0; i < body.event_sources.length; i += 1) {
      const validated = validateImportEventSource(body.event_sources[i]);
      if (validated.error || !validated.value) {
        return { error: `event_sources[${i}]: ${validated.error}` };
      }
      links.push(validated.value);
    }
    out.event_sources = links;
  }

  if (!out.sources && !out.events && !out.event_sources) {
    return { error: "at least one of sources, events, event_sources is required" };
  }

  return { value: out };
}

export async function createIngestionJob(input: CreateIngestionJobInput): Promise<IngestionJobRecord> {
  const pool = getDbPool();
  const sql = `
    INSERT INTO ingestion_jobs (source_name, job_type, status, metadata)
    VALUES ($1, $2, 'queued', $3::jsonb)
    RETURNING
      id,
      source_name,
      job_type,
      status::text AS status,
      started_at::text AS started_at,
      finished_at::text AS finished_at,
      records_in,
      records_out,
      error_message,
      metadata,
      created_at::text AS created_at
  `;
  const result = await pool.query<IngestionJobRecord>(sql, [
    input.source_name,
    input.job_type,
    JSON.stringify(input.metadata ?? {}),
  ]);
  return result.rows[0];
}

export async function updateIngestionJob(
  jobId: string,
  input: UpdateIngestionJobInput,
): Promise<IngestionJobRecord | null> {
  const pool = getDbPool();
  const values: Array<string | number> = [jobId];
  const updates: string[] = [];

  const assign = (sql: string, value: string | number) => {
    values.push(value);
    updates.push(sql.replace("?", `$${values.length}`));
  };

  if (input.status !== undefined) assign("status = ?::job_status", input.status);
  if (input.started_at !== undefined) assign("started_at = ?::timestamptz", input.started_at);
  if (input.finished_at !== undefined) assign("finished_at = ?::timestamptz", input.finished_at);
  if (input.records_in !== undefined) assign("records_in = ?", input.records_in);
  if (input.records_out !== undefined) assign("records_out = ?", input.records_out);
  if (input.error_message !== undefined) assign("error_message = ?", input.error_message);
  if (input.metadata !== undefined) assign("metadata = ?::jsonb", JSON.stringify(input.metadata));

  if (updates.length === 0) return null;

  const sql = `
    UPDATE ingestion_jobs
    SET ${updates.join(", ")}
    WHERE id = $1
    RETURNING
      id,
      source_name,
      job_type,
      status::text AS status,
      started_at::text AS started_at,
      finished_at::text AS finished_at,
      records_in,
      records_out,
      error_message,
      metadata,
      created_at::text AS created_at
  `;
  const result = await pool.query<IngestionJobRecord>(sql, values);
  return result.rows[0] ?? null;
}

async function resolveEventIdBySlug(
  client: PoolClient,
  slug: string,
) {
  const result = await client.query<{ id: string }>("SELECT id FROM events WHERE slug = $1 LIMIT 1", [slug]);
  return result.rows[0]?.id ?? null;
}

async function resolveSourceIdByUrl(
  client: PoolClient,
  sourceUrl: string,
) {
  const result = await client.query<{ id: string }>(
    "SELECT id FROM sources WHERE source_url = $1 LIMIT 1",
    [sourceUrl],
  );
  return result.rows[0]?.id ?? null;
}

export async function runIngestionImport(
  payload: IngestionImportPayload,
): Promise<IngestionImportResult> {
  const pool = getDbPool();
  const client = await pool.connect();
  const result: IngestionImportResult = {
    sources_upserted: 0,
    events_upserted: 0,
    event_source_links_upserted: 0,
    errors: [],
  };

  try {
    await client.query("BEGIN");

    for (const source of payload.sources ?? []) {
      const sql = `
        INSERT INTO sources (
          source_name,
          source_url,
          source_type,
          publisher,
          publication_or_snapshot_date,
          access_date,
          rights_note,
          notes_on_reliability
        )
        VALUES ($1, $2, $3::source_type, $4, $5::timestamptz, $6::date, $7, $8)
        ON CONFLICT (source_url)
        DO UPDATE SET
          source_name = EXCLUDED.source_name,
          source_type = EXCLUDED.source_type,
          publisher = EXCLUDED.publisher,
          publication_or_snapshot_date = EXCLUDED.publication_or_snapshot_date,
          access_date = EXCLUDED.access_date,
          rights_note = EXCLUDED.rights_note,
          notes_on_reliability = EXCLUDED.notes_on_reliability,
          updated_at = NOW()
      `;
      await client.query(sql, [
        source.source_name,
        source.source_url,
        source.source_type,
        source.publisher ?? null,
        source.publication_or_snapshot_date ?? null,
        source.access_date ?? null,
        source.rights_note ?? null,
        source.notes_on_reliability ?? null,
      ]);
      result.sources_upserted += 1;
    }

    for (const event of payload.events ?? []) {
      const sql = `
        INSERT INTO events (
          slug,
          title,
          event_date,
          region,
          category,
          summary,
          impact,
          importance_score,
          confidence_score,
          status,
          published_at
        )
        VALUES (
          $1,
          $2,
          $3::date,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10::event_status,
          CASE WHEN $10::event_status = 'published' THEN NOW() ELSE NULL END
        )
        ON CONFLICT (slug)
        DO UPDATE SET
          title = EXCLUDED.title,
          event_date = EXCLUDED.event_date,
          region = EXCLUDED.region,
          category = EXCLUDED.category,
          summary = EXCLUDED.summary,
          impact = EXCLUDED.impact,
          importance_score = EXCLUDED.importance_score,
          confidence_score = EXCLUDED.confidence_score,
          status = EXCLUDED.status,
          published_at = CASE
            WHEN EXCLUDED.status = 'published' THEN COALESCE(events.published_at, NOW())
            ELSE events.published_at
          END,
          updated_at = NOW()
      `;
      await client.query(sql, [
        event.slug ?? slugify(event.title),
        event.title,
        event.event_date,
        event.region,
        event.category,
        event.summary,
        event.impact,
        event.importance_score,
        event.confidence_score ?? 3,
        event.status ?? "draft",
      ]);
      result.events_upserted += 1;
    }

    for (const link of payload.event_sources ?? []) {
      const eventId = await resolveEventIdBySlug(client, link.event_slug);
      const sourceId = await resolveSourceIdByUrl(client, link.source_url);
      if (!eventId || !sourceId) {
        result.errors.push(
          `event_sources link skipped: event_slug=${link.event_slug}, source_url=${link.source_url}`,
        );
        continue;
      }

      const sql = `
        INSERT INTO event_sources (
          event_id,
          source_id,
          quote_excerpt,
          citation_note,
          relevance_rank
        )
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (event_id, source_id)
        DO UPDATE SET
          quote_excerpt = EXCLUDED.quote_excerpt,
          citation_note = EXCLUDED.citation_note,
          relevance_rank = EXCLUDED.relevance_rank
      `;
      await client.query(sql, [
        eventId,
        sourceId,
        link.quote_excerpt ?? null,
        link.citation_note ?? null,
        link.relevance_rank ?? 1,
      ]);
      result.event_source_links_upserted += 1;
    }

    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    const message = error instanceof Error ? error.message : "Unknown error";
    result.errors.push(message);
    return result;
  } finally {
    client.release();
  }
}
