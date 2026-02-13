import { getDbPool } from "@/lib/db";
import { getDemoDataset } from "@/lib/demo-store";
import { hasDatabaseConfig, isDatabaseUnavailableError } from "@/lib/runtime";

export type TimelineRecord = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateTimelineInput = {
  title: string;
  slug?: string;
  description?: string;
};

export type TimelineListItem = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  event_count: number;
  first_event_date: string | null;
  last_event_date: string | null;
};

export type TimelineEventItem = {
  id: string;
  slug: string;
  title: string;
  event_date: string;
  region: string;
  category: string;
  summary: string;
  importance_score: number;
  confidence_score: number;
  sequence_no: number;
};

export type TimelineDetail = TimelineRecord & {
  events: TimelineEventItem[];
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

function asInt(input: unknown): number | null {
  if (typeof input !== "number" || !Number.isInteger(input)) return null;
  return input;
}

function slugify(input: string): string {
  const normalized = input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
  return normalized || "timeline";
}

function isValidSlug(input: string) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input);
}

export function validateCreateTimelineInput(input: unknown): {
  value?: CreateTimelineInput;
  error?: string;
} {
  const body = asObject(input);
  if (!body) return { error: "request body must be a JSON object" };

  const title = asTrimmedString(body.title);
  if (!title) return { error: "title is required" };

  const description = asTrimmedString(body.description) ?? undefined;
  const slugInput = asTrimmedString(body.slug);
  const slug = slugify(slugInput ?? title);
  if (!isValidSlug(slug)) return { error: "slug is invalid" };

  return {
    value: {
      title,
      slug,
      description,
    },
  };
}

export function validateSequenceInput(input: unknown): {
  value?: number;
  error?: string;
} {
  const body = asObject(input);
  if (!body) return { error: "request body must be a JSON object" };

  const sequenceNo = asInt(body.sequence_no);
  if (sequenceNo === null || sequenceNo < 1) {
    return { error: "sequence_no must be an integer >= 1" };
  }

  return { value: sequenceNo };
}

export async function createTimeline(input: CreateTimelineInput): Promise<TimelineRecord> {
  const pool = getDbPool();
  const slug = slugify(input.slug ?? input.title);

  const sql = `
    INSERT INTO timelines (title, slug, description)
    VALUES ($1, $2, $3)
    RETURNING
      id,
      title,
      slug,
      description,
      created_at::text AS created_at,
      updated_at::text AS updated_at
  `;
  const result = await pool.query<TimelineRecord>(sql, [input.title, slug, input.description ?? null]);
  return result.rows[0];
}

export async function listTimelinesPublic(): Promise<TimelineListItem[]> {
  if (!hasDatabaseConfig()) {
    const dataset = await getDemoDataset();
    const publishedEventById = new Map(
      dataset.events.filter((event) => event.status === "published").map((event) => [event.id, event]),
    );

    return dataset.timelines
      .map((timeline) => {
        const members = dataset.timelineEvents
          .filter((entry) => entry.timeline_id === timeline.id)
          .map((entry) => publishedEventById.get(entry.event_id))
          .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

        const dates = members.map((entry) => entry.event_date).sort();
        return {
          id: timeline.id,
          title: timeline.title,
          slug: timeline.slug,
          description: timeline.description,
          event_count: members.length,
          first_event_date: dates[0] ?? null,
          last_event_date: dates.length > 0 ? dates[dates.length - 1] : null,
        };
      })
      .sort((a, b) => a.title.localeCompare(b.title));
  }

  try {
    const pool = getDbPool();
    const sql = `
      SELECT
        t.id,
        t.title,
        t.slug,
        t.description,
        COUNT(e.id)::int AS event_count,
        MIN(e.event_date)::text AS first_event_date,
        MAX(e.event_date)::text AS last_event_date
      FROM timelines t
      LEFT JOIN timeline_events te ON te.timeline_id = t.id
      LEFT JOIN events e ON e.id = te.event_id AND e.status = 'published'
      GROUP BY t.id, t.title, t.slug, t.description
      ORDER BY t.title ASC
    `;
    const result = await pool.query<TimelineListItem>(sql);
    return result.rows;
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      const dataset = await getDemoDataset();
      const publishedEventById = new Map(
        dataset.events
          .filter((event) => event.status === "published")
          .map((event) => [event.id, event]),
      );

      return dataset.timelines
        .map((timeline) => {
          const members = dataset.timelineEvents
            .filter((entry) => entry.timeline_id === timeline.id)
            .map((entry) => publishedEventById.get(entry.event_id))
            .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

          const dates = members.map((entry) => entry.event_date).sort();
          return {
            id: timeline.id,
            title: timeline.title,
            slug: timeline.slug,
            description: timeline.description,
            event_count: members.length,
            first_event_date: dates[0] ?? null,
            last_event_date: dates.length > 0 ? dates[dates.length - 1] : null,
          };
        })
        .sort((a, b) => a.title.localeCompare(b.title));
    }
    throw error;
  }
}

export async function getTimelineBySlug(slug: string): Promise<TimelineDetail | null> {
  if (!hasDatabaseConfig()) {
    const dataset = await getDemoDataset();
    const timeline = dataset.timelines.find((entry) => entry.slug === slug);
    if (!timeline) return null;

    const events: TimelineEventItem[] = dataset.timelineEvents
      .filter((entry) => entry.timeline_id === timeline.id)
      .sort((a, b) => a.sequence_no - b.sequence_no)
      .map((entry) => {
        const event = dataset.events.find(
          (candidate) => candidate.id === entry.event_id && candidate.status === "published",
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
          importance_score: event.importance_score,
          confidence_score: event.confidence_score,
          sequence_no: entry.sequence_no,
        };
      })
      .filter((entry): entry is TimelineEventItem => entry !== null);

    return {
      id: timeline.id,
      title: timeline.title,
      slug: timeline.slug,
      description: timeline.description,
      created_at: timeline.created_at,
      updated_at: timeline.updated_at,
      events,
    };
  }

  try {
    const pool = getDbPool();
    const timelineSql = `
      SELECT
        id,
        title,
        slug,
        description,
        created_at::text AS created_at,
        updated_at::text AS updated_at
      FROM timelines
      WHERE slug = $1
      LIMIT 1
    `;
    const timelineResult = await pool.query<TimelineRecord>(timelineSql, [slug]);
    const timeline = timelineResult.rows[0];
    if (!timeline) return null;

    const eventsSql = `
      SELECT
        e.id,
        e.slug,
        e.title,
        e.event_date::text AS event_date,
        e.region,
        e.category,
        e.summary,
        e.importance_score,
        e.confidence_score,
        te.sequence_no
      FROM timeline_events te
      JOIN events e ON e.id = te.event_id
      WHERE te.timeline_id = $1
        AND e.status = 'published'
      ORDER BY te.sequence_no ASC, e.event_date DESC
    `;
    const eventsResult = await pool.query<TimelineEventItem>(eventsSql, [timeline.id]);

    return {
      ...timeline,
      events: eventsResult.rows,
    };
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      const dataset = await getDemoDataset();
      const timeline = dataset.timelines.find((entry) => entry.slug === slug);
      if (!timeline) return null;

      const events: TimelineEventItem[] = dataset.timelineEvents
        .filter((entry) => entry.timeline_id === timeline.id)
        .sort((a, b) => a.sequence_no - b.sequence_no)
        .map((entry) => {
          const event = dataset.events.find(
            (candidate) => candidate.id === entry.event_id && candidate.status === "published",
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
            importance_score: event.importance_score,
            confidence_score: event.confidence_score,
            sequence_no: entry.sequence_no,
          };
        })
        .filter((entry): entry is TimelineEventItem => entry !== null);

      return {
        id: timeline.id,
        title: timeline.title,
        slug: timeline.slug,
        description: timeline.description,
        created_at: timeline.created_at,
        updated_at: timeline.updated_at,
        events,
      };
    }
    throw error;
  }
}

export async function attachEventToTimeline(
  timelineId: string,
  eventId: string,
  sequenceNo: number,
) {
  const pool = getDbPool();
  const sql = `
    INSERT INTO timeline_events (timeline_id, event_id, sequence_no)
    VALUES ($1, $2, $3)
    ON CONFLICT (timeline_id, event_id)
    DO UPDATE SET sequence_no = EXCLUDED.sequence_no
    RETURNING
      timeline_id::text AS timeline_id,
      event_id::text AS event_id,
      sequence_no
  `;
  const result = await pool.query<{
    timeline_id: string;
    event_id: string;
    sequence_no: number;
  }>(sql, [timelineId, eventId, sequenceNo]);
  return result.rows[0];
}

export async function updateTimelineEventSequence(
  timelineId: string,
  eventId: string,
  sequenceNo: number,
) {
  const pool = getDbPool();
  const sql = `
    UPDATE timeline_events
    SET sequence_no = $3
    WHERE timeline_id = $1
      AND event_id = $2
    RETURNING
      timeline_id::text AS timeline_id,
      event_id::text AS event_id,
      sequence_no
  `;
  const result = await pool.query<{
    timeline_id: string;
    event_id: string;
    sequence_no: number;
  }>(sql, [timelineId, eventId, sequenceNo]);
  return result.rows[0] ?? null;
}

export async function detachEventFromTimeline(timelineId: string, eventId: string) {
  const pool = getDbPool();
  const sql = `
    DELETE FROM timeline_events
    WHERE timeline_id = $1
      AND event_id = $2
    RETURNING
      timeline_id::text AS timeline_id,
      event_id::text AS event_id
  `;
  const result = await pool.query<{ timeline_id: string; event_id: string }>(sql, [
    timelineId,
    eventId,
  ]);
  return result.rows[0] ?? null;
}
