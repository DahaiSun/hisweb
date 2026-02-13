import { getDbPool } from "@/lib/db";
import { getDemoDataset } from "@/lib/demo-store";
import { hasDatabaseConfig, isDatabaseUnavailableError } from "@/lib/runtime";

type SourceType = "archive" | "official" | "news" | "research" | "dataset" | "other";

const SOURCE_TYPE_SET = new Set<SourceType>([
  "archive",
  "official",
  "news",
  "research",
  "dataset",
  "other",
]);

export type SourceRecord = {
  id: string;
  source_name: string;
  source_url: string;
  source_type: SourceType;
  publisher: string | null;
  publication_or_snapshot_date: string | null;
  access_date: string | null;
  rights_note: string | null;
  notes_on_reliability: string | null;
  created_at: string;
  updated_at: string;
};

export type SourceLinkedEvent = {
  id: string;
  slug: string;
  title: string;
  event_date: string;
  region: string;
  category: string;
  summary: string;
  relevance_rank: number;
  quote_excerpt: string | null;
  citation_note: string | null;
};

export type SourceDetail = SourceRecord & {
  linked_events: SourceLinkedEvent[];
};

export type CreateSourceInput = {
  source_name: string;
  source_url: string;
  source_type: SourceType;
  publisher?: string;
  publication_or_snapshot_date?: string;
  access_date?: string;
  rights_note?: string;
  notes_on_reliability?: string;
};

export type AttachSourceInput = {
  quote_excerpt?: string;
  citation_note?: string;
  relevance_rank: number;
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

function asIntInRange(input: unknown, min: number, max: number): number | null {
  if (typeof input !== "number" || !Number.isInteger(input)) return null;
  if (input < min || input > max) return null;
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

export function isSourceType(input: string): input is SourceType {
  return SOURCE_TYPE_SET.has(input as SourceType);
}

export function validateCreateSourceInput(input: unknown): {
  value?: CreateSourceInput;
  error?: string;
} {
  const body = asObject(input);
  if (!body) return { error: "request body must be a JSON object" };

  const sourceName = asTrimmedString(body.source_name);
  const sourceUrl = asTrimmedString(body.source_url);
  const sourceTypeRaw = asOptionalTrimmedString(body.source_type) ?? "other";
  const publisher = asOptionalTrimmedString(body.publisher);
  const publicationRaw = asOptionalTrimmedString(body.publication_or_snapshot_date);
  const accessDate = asOptionalTrimmedString(body.access_date);
  const rightsNote = asOptionalTrimmedString(body.rights_note);
  const reliability = asOptionalTrimmedString(body.notes_on_reliability);

  if (!sourceName) return { error: "source_name is required" };
  if (!sourceUrl) return { error: "source_url is required" };
  if (!isSourceType(sourceTypeRaw)) {
    return { error: "source_type must be one of: archive, official, news, research, dataset, other" };
  }

  let publicationOrSnapshotDate: string | undefined;
  if (publicationRaw) {
    const parsed = normalizeIsoTimestamp(publicationRaw);
    if (!parsed) {
      return { error: "publication_or_snapshot_date must be a valid datetime" };
    }
    publicationOrSnapshotDate = parsed;
  }

  if (accessDate && !isValidDate(accessDate)) {
    return { error: "access_date must be YYYY-MM-DD" };
  }

  return {
    value: {
      source_name: sourceName,
      source_url: sourceUrl,
      source_type: sourceTypeRaw,
      publisher,
      publication_or_snapshot_date: publicationOrSnapshotDate,
      access_date: accessDate,
      rights_note: rightsNote,
      notes_on_reliability: reliability,
    },
  };
}

export function validateAttachSourceInput(input: unknown): {
  value?: AttachSourceInput;
  error?: string;
} {
  if (input === undefined || input === null) {
    return { value: { relevance_rank: 1 } };
  }

  const body = asObject(input);
  if (!body) return { error: "request body must be a JSON object" };

  const quote = asOptionalTrimmedString(body.quote_excerpt);
  const citation = asOptionalTrimmedString(body.citation_note);
  const relevance =
    body.relevance_rank === undefined ? 1 : asIntInRange(body.relevance_rank, 1, 10);
  if (relevance === null) return { error: "relevance_rank must be an integer 1-10" };

  return {
    value: {
      quote_excerpt: quote,
      citation_note: citation,
      relevance_rank: relevance,
    },
  };
}

export async function createSource(input: CreateSourceInput): Promise<SourceRecord> {
  const pool = getDbPool();
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
    RETURNING
      id,
      source_name,
      source_url,
      source_type::text AS source_type,
      publisher,
      publication_or_snapshot_date::text AS publication_or_snapshot_date,
      access_date::text AS access_date,
      rights_note,
      notes_on_reliability,
      created_at::text AS created_at,
      updated_at::text AS updated_at
  `;
  const values = [
    input.source_name,
    input.source_url,
    input.source_type,
    input.publisher ?? null,
    input.publication_or_snapshot_date ?? null,
    input.access_date ?? null,
    input.rights_note ?? null,
    input.notes_on_reliability ?? null,
  ];
  const result = await pool.query<SourceRecord>(sql, values);
  return result.rows[0];
}

export async function getSourceById(sourceId: string): Promise<SourceDetail | null> {
  if (!hasDatabaseConfig()) {
    const dataset = await getDemoDataset();
    const source = dataset.sources.find((entry) => entry.id === sourceId);
    if (!source) return null;

    const links = dataset.eventSources
      .filter((entry) => entry.source_id === sourceId)
      .sort((a, b) => b.relevance_rank - a.relevance_rank);

    const linkedEvents: SourceLinkedEvent[] = links
      .map((link) => {
        const event = dataset.events.find(
          (entry) => entry.id === link.event_id && entry.status === "published",
        );
        if (!event) return null;
        return {
          id: event.id,
          slug: event.slug,
          title: event.title,
          event_date: event.event_date,
          region: event.region,
          category: event.category,
          summary: event.summary,
          relevance_rank: link.relevance_rank,
          quote_excerpt: link.quote_excerpt,
          citation_note: link.citation_note,
        };
      })
      .filter((entry): entry is SourceLinkedEvent => entry !== null)
      .sort((a, b) => b.event_date.localeCompare(a.event_date));

    return {
      id: source.id,
      source_name: source.source_name,
      source_url: source.source_url,
      source_type: source.source_type,
      publisher: source.publisher,
      publication_or_snapshot_date: source.publication_or_snapshot_date,
      access_date: source.access_date,
      rights_note: source.rights_note,
      notes_on_reliability: source.notes_on_reliability,
      created_at: source.created_at,
      updated_at: source.updated_at,
      linked_events: linkedEvents,
    };
  }

  try {
    const pool = getDbPool();
    const sourceSql = `
      SELECT
        id,
        source_name,
        source_url,
        source_type::text AS source_type,
        publisher,
        publication_or_snapshot_date::text AS publication_or_snapshot_date,
        access_date::text AS access_date,
        rights_note,
        notes_on_reliability,
        created_at::text AS created_at,
        updated_at::text AS updated_at
      FROM sources
      WHERE id = $1
      LIMIT 1
    `;
    const sourceResult = await pool.query<SourceRecord>(sourceSql, [sourceId]);
    const source = sourceResult.rows[0];
    if (!source) return null;

    const eventsSql = `
      SELECT
        e.id,
        e.slug,
        e.title,
        e.event_date::text AS event_date,
        e.region,
        e.category,
        e.summary,
        es.relevance_rank,
        es.quote_excerpt,
        es.citation_note
      FROM event_sources es
      JOIN events e ON e.id = es.event_id
      WHERE es.source_id = $1
        AND e.status = 'published'
      ORDER BY e.event_date DESC, es.relevance_rank ASC
    `;
    const eventsResult = await pool.query<SourceLinkedEvent>(eventsSql, [sourceId]);

    return {
      ...source,
      linked_events: eventsResult.rows,
    };
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      const dataset = await getDemoDataset();
      const source = dataset.sources.find((entry) => entry.id === sourceId);
      if (!source) return null;

      const links = dataset.eventSources
        .filter((entry) => entry.source_id === sourceId)
        .sort((a, b) => b.relevance_rank - a.relevance_rank);

      const linkedEvents: SourceLinkedEvent[] = links
        .map((link) => {
          const event = dataset.events.find(
            (entry) => entry.id === link.event_id && entry.status === "published",
          );
          if (!event) return null;
          return {
            id: event.id,
            slug: event.slug,
            title: event.title,
            event_date: event.event_date,
            region: event.region,
            category: event.category,
            summary: event.summary,
            relevance_rank: link.relevance_rank,
            quote_excerpt: link.quote_excerpt,
            citation_note: link.citation_note,
          };
        })
        .filter((entry): entry is SourceLinkedEvent => entry !== null)
        .sort((a, b) => b.event_date.localeCompare(a.event_date));

      return {
        id: source.id,
        source_name: source.source_name,
        source_url: source.source_url,
        source_type: source.source_type,
        publisher: source.publisher,
        publication_or_snapshot_date: source.publication_or_snapshot_date,
        access_date: source.access_date,
        rights_note: source.rights_note,
        notes_on_reliability: source.notes_on_reliability,
        created_at: source.created_at,
        updated_at: source.updated_at,
        linked_events: linkedEvents,
      };
    }
    throw error;
  }
}

export async function attachSourceToEvent(
  eventId: string,
  sourceId: string,
  input: AttachSourceInput,
) {
  const pool = getDbPool();
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
    RETURNING
      event_id::text AS event_id,
      source_id::text AS source_id,
      quote_excerpt,
      citation_note,
      relevance_rank
  `;
  const values = [
    eventId,
    sourceId,
    input.quote_excerpt ?? null,
    input.citation_note ?? null,
    input.relevance_rank,
  ];
  const result = await pool.query<{
    event_id: string;
    source_id: string;
    quote_excerpt: string | null;
    citation_note: string | null;
    relevance_rank: number;
  }>(sql, values);
  return result.rows[0];
}

export async function detachSourceFromEvent(eventId: string, sourceId: string) {
  const pool = getDbPool();
  const sql = `
    DELETE FROM event_sources
    WHERE event_id = $1
      AND source_id = $2
    RETURNING event_id::text AS event_id, source_id::text AS source_id
  `;
  const result = await pool.query<{ event_id: string; source_id: string }>(sql, [eventId, sourceId]);
  return result.rows[0] ?? null;
}
