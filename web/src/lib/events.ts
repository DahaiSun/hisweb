import { getDbPool } from "@/lib/db";
import { getDemoDataset } from "@/lib/demo-store";
import { hasDatabaseConfig, isDatabaseUnavailableError } from "@/lib/runtime";

type EventSort = "date_desc" | "date_asc" | "importance_desc";
type EventStatus = "draft" | "review" | "published" | "archived";

export type ListEventsFilters = {
  date?: string | null;
  from?: string | null;
  to?: string | null;
  category?: string | null;
  region?: string | null;
  tag?: string | null;
  importanceMin?: number | null;
  q?: string | null;
  page: number;
  pageSize: number;
  sort: EventSort;
};

export type EventListItem = {
  id: string;
  slug: string;
  title: string;
  event_date: string;
  region: string;
  category: string;
  summary: string;
  importance_score: number;
  confidence_score: number;
  source_count: number;
  tags: string[];
};

export type EventListResult = {
  items: EventListItem[];
  pagination: {
    page: number;
    page_size: number;
    total: number;
    total_pages: number;
  };
};

export type EventSource = {
  id: string;
  source_name: string;
  source_url: string;
  source_type: string;
  publisher: string | null;
  publication_or_snapshot_date: string | null;
  access_date: string | null;
  rights_note: string | null;
  notes_on_reliability: string | null;
  quote_excerpt: string | null;
  citation_note: string | null;
  relevance_rank: number;
};

export type EventTimeline = {
  id: string;
  title: string;
  slug: string;
  sequence_no: number;
};

export type EventDetail = {
  id: string;
  slug: string;
  title: string;
  event_date: string;
  region: string;
  category: string;
  summary: string;
  impact: string;
  importance_score: number;
  confidence_score: number;
  published_at: string | null;
  tags: string[];
  sources: EventSource[];
  timelines: EventTimeline[];
};

export type AdminEventRecord = {
  id: string;
  slug: string;
  title: string;
  event_date: string;
  region: string;
  category: string;
  summary: string;
  impact: string;
  importance_score: number;
  confidence_score: number;
  status: EventStatus;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateEventInput = {
  slug?: string;
  title: string;
  event_date: string;
  region: string;
  category: string;
  summary: string;
  impact: string;
  importance_score: number;
  confidence_score?: number;
};

export type UpdateEventInput = Partial<{
  slug: string;
  title: string;
  event_date: string;
  region: string;
  category: string;
  summary: string;
  impact: string;
  importance_score: number;
  confidence_score: number;
}>;

const EVENT_STATUS_SET = new Set<EventStatus>(["draft", "review", "published", "archived"]);

function isValidDate(date: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date);
}

export function isValidUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

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

function normalizeTags(rawTags: unknown): string[] {
  if (!Array.isArray(rawTags)) return [];
  return rawTags.filter((t): t is string => typeof t === "string");
}

function matchesKeyword(haystack: string, query: string) {
  return haystack.toLowerCase().includes(query.toLowerCase());
}

function applyEventSort(items: EventListItem[], sort: EventSort) {
  const copy = [...items];
  if (sort === "date_asc") {
    copy.sort((a, b) => a.event_date.localeCompare(b.event_date));
    return copy;
  }
  if (sort === "importance_desc") {
    copy.sort((a, b) => {
      if (b.importance_score !== a.importance_score) return b.importance_score - a.importance_score;
      return b.event_date.localeCompare(a.event_date);
    });
    return copy;
  }
  copy.sort((a, b) => b.event_date.localeCompare(a.event_date));
  return copy;
}

async function listPublishedEventsFromDemo(filters: ListEventsFilters): Promise<EventListResult> {
  const dataset = await getDemoDataset();

  const tagsByEventId = new Map<string, string[]>();
  for (const eventTag of dataset.eventTags) {
    const tag = dataset.tags.find((entry) => entry.id === eventTag.tag_id);
    if (!tag) continue;
    const existing = tagsByEventId.get(eventTag.event_id) ?? [];
    existing.push(tag.slug);
    tagsByEventId.set(eventTag.event_id, existing);
  }

  const sourceCountByEventId = new Map<string, number>();
  for (const link of dataset.eventSources) {
    sourceCountByEventId.set(link.event_id, (sourceCountByEventId.get(link.event_id) ?? 0) + 1);
  }

  let items: EventListItem[] = dataset.events
    .filter((event) => event.status === "published")
    .map((event) => ({
      id: event.id,
      slug: event.slug,
      title: event.title,
      event_date: event.event_date,
      region: event.region,
      category: event.category,
      summary: event.summary,
      importance_score: event.importance_score,
      confidence_score: event.confidence_score,
      source_count: sourceCountByEventId.get(event.id) ?? 0,
      tags: [...(tagsByEventId.get(event.id) ?? [])].sort(),
    }));

  if (filters.date) {
    items = items.filter((item) => item.event_date === filters.date);
  }
  if (filters.from) {
    items = items.filter((item) => item.event_date >= filters.from!);
  }
  if (filters.to) {
    items = items.filter((item) => item.event_date <= filters.to!);
  }
  if (filters.category) {
    items = items.filter((item) => item.category === filters.category);
  }
  if (filters.region) {
    items = items.filter((item) => item.region === filters.region);
  }
  if (filters.tag) {
    items = items.filter((item) => item.tags.includes(filters.tag!));
  }
  if (typeof filters.importanceMin === "number") {
    items = items.filter((item) => item.importance_score >= filters.importanceMin!);
  }
  if (filters.q) {
    const q = filters.q;
    items = items.filter((item) =>
      matchesKeyword(`${item.title} ${item.summary} ${item.category} ${item.region}`, q),
    );
  }

  items = applyEventSort(items, filters.sort);

  const total = items.length;
  const offset = (filters.page - 1) * filters.pageSize;
  const paged = items.slice(offset, offset + filters.pageSize);

  return {
    items: paged,
    pagination: {
      page: filters.page,
      page_size: filters.pageSize,
      total,
      total_pages: total === 0 ? 0 : Math.ceil(total / filters.pageSize),
    },
  };
}

async function getPublishedEventBySlugFromDemo(slug: string): Promise<EventDetail | null> {
  const dataset = await getDemoDataset();
  const event = dataset.events.find((entry) => entry.slug === slug && entry.status === "published");
  if (!event) return null;

  const tagIds = dataset.eventTags.filter((entry) => entry.event_id === event.id).map((entry) => entry.tag_id);
  const tags = dataset.tags
    .filter((entry) => tagIds.includes(entry.id))
    .map((entry) => entry.slug)
    .sort();

  const sourceLinks = dataset.eventSources
    .filter((entry) => entry.event_id === event.id)
    .sort((a, b) => a.relevance_rank - b.relevance_rank);

  const sources: EventSource[] = [];
  for (const link of sourceLinks) {
    const source = dataset.sources.find((entry) => entry.id === link.source_id);
    if (!source) continue;
    sources.push({
      id: source.id,
      source_name: source.source_name,
      source_url: source.source_url,
      source_type: source.source_type,
      publisher: source.publisher,
      publication_or_snapshot_date: source.publication_or_snapshot_date,
      access_date: source.access_date,
      rights_note: source.rights_note,
      notes_on_reliability: source.notes_on_reliability,
      quote_excerpt: link.quote_excerpt,
      citation_note: link.citation_note,
      relevance_rank: link.relevance_rank,
    });
  }

  const timelineLinks = dataset.timelineEvents
    .filter((entry) => entry.event_id === event.id)
    .sort((a, b) => a.sequence_no - b.sequence_no);

  const timelines: EventTimeline[] = timelineLinks
    .map((link) => {
      const timeline = dataset.timelines.find((entry) => entry.id === link.timeline_id);
      if (!timeline) return null;
      return {
        id: timeline.id,
        title: timeline.title,
        slug: timeline.slug,
        sequence_no: link.sequence_no,
      };
    })
    .filter((entry): entry is EventTimeline => entry !== null);

  return {
    id: event.id,
    slug: event.slug,
    title: event.title,
    event_date: event.event_date,
    region: event.region,
    category: event.category,
    summary: event.summary,
    impact: event.impact,
    importance_score: event.importance_score,
    confidence_score: event.confidence_score,
    published_at: event.published_at,
    tags,
    sources,
    timelines,
  };
}

async function listPublishedEventsByMonthDayFromDemo(monthDay: string) {
  const result = await listPublishedEventsFromDemo({
    page: 1,
    pageSize: 5000,
    sort: "date_desc",
    date: null,
    from: null,
    to: null,
    category: null,
    region: null,
    tag: null,
    importanceMin: null,
    q: null,
  });

  return result.items.filter((item) => item.event_date.slice(5) === monthDay);
}

function buildEventWhere(filters: Omit<ListEventsFilters, "page" | "pageSize" | "sort">) {
  const values: Array<string | number> = [];
  const where: string[] = ["e.status = 'published'"];

  const param = (value: string | number) => {
    values.push(value);
    return `$${values.length}`;
  };

  if (filters.date) {
    where.push(`e.event_date = ${param(filters.date)}::date`);
  }
  if (filters.from) {
    where.push(`e.event_date >= ${param(filters.from)}::date`);
  }
  if (filters.to) {
    where.push(`e.event_date <= ${param(filters.to)}::date`);
  }
  if (filters.category) {
    where.push(`e.category = ${param(filters.category)}`);
  }
  if (filters.region) {
    where.push(`e.region = ${param(filters.region)}`);
  }
  if (filters.tag) {
    where.push(
      `EXISTS (
        SELECT 1
        FROM event_tags etf
        JOIN tags tf ON tf.id = etf.tag_id
        WHERE etf.event_id = e.id AND tf.slug = ${param(filters.tag)}
      )`,
    );
  }
  if (typeof filters.importanceMin === "number") {
    where.push(`e.importance_score >= ${param(filters.importanceMin)}`);
  }
  if (filters.q) {
    where.push(
      `to_tsvector('simple', coalesce(e.title, '') || ' ' || coalesce(e.summary, '') || ' ' || coalesce(e.impact, ''))
       @@ plainto_tsquery('simple', ${param(filters.q)})`,
    );
  }

  return {
    whereSql: where.join(" AND "),
    values,
  };
}

function resolveSort(sort: EventSort) {
  if (sort === "date_asc") return "e.event_date ASC";
  if (sort === "importance_desc") {
    return "e.importance_score DESC, e.event_date DESC";
  }
  return "e.event_date DESC";
}

export function validateListFilters(filters: {
  date?: string | null;
  from?: string | null;
  to?: string | null;
  importanceMin?: number | null;
}) {
  if (filters.date && !isValidDate(filters.date)) {
    return "date must be YYYY-MM-DD";
  }
  if (filters.from && !isValidDate(filters.from)) {
    return "from must be YYYY-MM-DD";
  }
  if (filters.to && !isValidDate(filters.to)) {
    return "to must be YYYY-MM-DD";
  }
  if (
    typeof filters.importanceMin === "number" &&
    (filters.importanceMin < 1 || filters.importanceMin > 5)
  ) {
    return "importance_min must be between 1 and 5";
  }
  return null;
}

export function validateCreateEventInput(input: unknown): {
  value?: CreateEventInput;
  error?: string;
} {
  const body = asObject(input);
  if (!body) return { error: "request body must be a JSON object" };

  const title = asTrimmedString(body.title);
  const eventDate = asTrimmedString(body.event_date);
  const region = asTrimmedString(body.region);
  const category = asTrimmedString(body.category);
  const summary = asTrimmedString(body.summary);
  const impact = asTrimmedString(body.impact);
  const importanceScore = asIntInRange(body.importance_score, 1, 5);
  const confidenceScore =
    body.confidence_score === undefined ? 3 : asIntInRange(body.confidence_score, 1, 5);
  const slugInput = asOptionalTrimmedString(body.slug);

  if (!title) return { error: "title is required" };
  if (!eventDate || !isValidDate(eventDate)) return { error: "event_date must be YYYY-MM-DD" };
  if (!region) return { error: "region is required" };
  if (!category) return { error: "category is required" };
  if (!summary) return { error: "summary is required" };
  if (!impact) return { error: "impact is required" };
  if (importanceScore === null) return { error: "importance_score must be an integer 1-5" };
  if (confidenceScore === null) return { error: "confidence_score must be an integer 1-5" };
  if (slugInput && !isValidSlug(slugify(slugInput))) {
    return { error: "slug contains no valid characters" };
  }

  return {
    value: {
      slug: slugInput ? slugify(slugInput) : undefined,
      title,
      event_date: eventDate,
      region,
      category,
      summary,
      impact,
      importance_score: importanceScore,
      confidence_score: confidenceScore,
    },
  };
}

export function validateUpdateEventInput(input: unknown): {
  value?: UpdateEventInput;
  error?: string;
} {
  const body = asObject(input);
  if (!body) return { error: "request body must be a JSON object" };

  const out: UpdateEventInput = {};

  if ("slug" in body) {
    const raw = asTrimmedString(body.slug);
    if (!raw) return { error: "slug cannot be empty" };
    const normalized = slugify(raw);
    if (!isValidSlug(normalized)) return { error: "slug is invalid" };
    out.slug = normalized;
  }
  if ("title" in body) {
    const value = asTrimmedString(body.title);
    if (!value) return { error: "title cannot be empty" };
    out.title = value;
  }
  if ("event_date" in body) {
    const value = asTrimmedString(body.event_date);
    if (!value || !isValidDate(value)) return { error: "event_date must be YYYY-MM-DD" };
    out.event_date = value;
  }
  if ("region" in body) {
    const value = asTrimmedString(body.region);
    if (!value) return { error: "region cannot be empty" };
    out.region = value;
  }
  if ("category" in body) {
    const value = asTrimmedString(body.category);
    if (!value) return { error: "category cannot be empty" };
    out.category = value;
  }
  if ("summary" in body) {
    const value = asTrimmedString(body.summary);
    if (!value) return { error: "summary cannot be empty" };
    out.summary = value;
  }
  if ("impact" in body) {
    const value = asTrimmedString(body.impact);
    if (!value) return { error: "impact cannot be empty" };
    out.impact = value;
  }
  if ("importance_score" in body) {
    const value = asIntInRange(body.importance_score, 1, 5);
    if (value === null) return { error: "importance_score must be an integer 1-5" };
    out.importance_score = value;
  }
  if ("confidence_score" in body) {
    const value = asIntInRange(body.confidence_score, 1, 5);
    if (value === null) return { error: "confidence_score must be an integer 1-5" };
    out.confidence_score = value;
  }

  if (Object.keys(out).length === 0) {
    return { error: "no updatable fields provided" };
  }

  return { value: out };
}

export async function listPublishedEvents(filters: ListEventsFilters): Promise<EventListResult> {
  if (!hasDatabaseConfig()) {
    return listPublishedEventsFromDemo(filters);
  }

  try {
    const pool = getDbPool();
    const baseFilters = {
      date: filters.date,
      from: filters.from,
      to: filters.to,
      category: filters.category,
      region: filters.region,
      tag: filters.tag,
      importanceMin: filters.importanceMin,
      q: filters.q,
    };

    const { whereSql, values } = buildEventWhere(baseFilters);
    const sortSql = resolveSort(filters.sort);
    const offset = (filters.page - 1) * filters.pageSize;

    const countSql = `
      SELECT COUNT(*)::int AS total
      FROM events e
      WHERE ${whereSql}
    `;
    const countResult = await pool.query<{ total: number }>(countSql, values);
    const total = countResult.rows[0]?.total ?? 0;

    const listSql = `
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
        COALESCE(src.source_count, 0) AS source_count,
        COALESCE(tagset.tags, '[]'::json) AS tags
      FROM events e
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS source_count
        FROM event_sources es
        WHERE es.event_id = e.id
      ) src ON TRUE
      LEFT JOIN LATERAL (
        SELECT json_agg(t.slug ORDER BY t.slug) AS tags
        FROM event_tags et
        JOIN tags t ON t.id = et.tag_id
        WHERE et.event_id = e.id
      ) tagset ON TRUE
      WHERE ${whereSql}
      ORDER BY ${sortSql}
      LIMIT $${values.length + 1}
      OFFSET $${values.length + 2}
    `;

    const listValues = [...values, filters.pageSize, offset];
    const listResult = await pool.query<
      Omit<EventListItem, "tags"> & { tags: unknown; source_count: number }
    >(listSql, listValues);

    return {
      items: listResult.rows.map((row) => ({
        id: row.id,
        slug: row.slug,
        title: row.title,
        event_date: row.event_date,
        region: row.region,
        category: row.category,
        summary: row.summary,
        importance_score: row.importance_score,
        confidence_score: row.confidence_score,
        source_count: row.source_count,
        tags: normalizeTags(row.tags),
      })),
      pagination: {
        page: filters.page,
        page_size: filters.pageSize,
        total,
        total_pages: total === 0 ? 0 : Math.ceil(total / filters.pageSize),
      },
    };
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      return listPublishedEventsFromDemo(filters);
    }
    throw error;
  }
}

export async function getPublishedEventBySlug(slug: string): Promise<EventDetail | null> {
  if (!hasDatabaseConfig()) {
    return getPublishedEventBySlugFromDemo(slug);
  }

  try {
    const pool = getDbPool();

    const eventSql = `
      SELECT
        e.id,
        e.slug,
        e.title,
        e.event_date::text AS event_date,
        e.region,
        e.category,
        e.summary,
        e.impact,
        e.importance_score,
        e.confidence_score,
        e.published_at::text AS published_at,
        COALESCE(tagset.tags, '[]'::json) AS tags
      FROM events e
      LEFT JOIN LATERAL (
        SELECT json_agg(t.slug ORDER BY t.slug) AS tags
        FROM event_tags et
        JOIN tags t ON t.id = et.tag_id
        WHERE et.event_id = e.id
      ) tagset ON TRUE
      WHERE e.slug = $1
        AND e.status = 'published'
      LIMIT 1
    `;

    const eventResult = await pool.query<
      Omit<EventDetail, "sources" | "timelines" | "tags"> & { tags: unknown }
    >(eventSql, [slug]);
    const eventRow = eventResult.rows[0];
    if (!eventRow) return null;

    const sourcesSql = `
      SELECT
        s.id,
        s.source_name,
        s.source_url,
        s.source_type::text AS source_type,
        s.publisher,
        s.publication_or_snapshot_date::text AS publication_or_snapshot_date,
        s.access_date::text AS access_date,
        s.rights_note,
        s.notes_on_reliability,
        es.quote_excerpt,
        es.citation_note,
        es.relevance_rank
      FROM event_sources es
      JOIN sources s ON s.id = es.source_id
      WHERE es.event_id = $1
      ORDER BY es.relevance_rank ASC, s.publication_or_snapshot_date DESC NULLS LAST
    `;
    const sourcesResult = await pool.query<EventSource>(sourcesSql, [eventRow.id]);

    const timelinesSql = `
      SELECT
        t.id,
        t.title,
        t.slug,
        te.sequence_no
      FROM timeline_events te
      JOIN timelines t ON t.id = te.timeline_id
      WHERE te.event_id = $1
      ORDER BY te.sequence_no ASC
    `;
    const timelinesResult = await pool.query<EventTimeline>(timelinesSql, [eventRow.id]);

    return {
      id: eventRow.id,
      slug: eventRow.slug,
      title: eventRow.title,
      event_date: eventRow.event_date,
      region: eventRow.region,
      category: eventRow.category,
      summary: eventRow.summary,
      impact: eventRow.impact,
      importance_score: eventRow.importance_score,
      confidence_score: eventRow.confidence_score,
      published_at: eventRow.published_at,
      tags: normalizeTags(eventRow.tags),
      sources: sourcesResult.rows,
      timelines: timelinesResult.rows,
    };
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      return getPublishedEventBySlugFromDemo(slug);
    }
    throw error;
  }
}

async function getNextAvailableSlug(baseSlug: string) {
  const pool = getDbPool();
  const normalized = slugify(baseSlug);
  const likePattern = `${normalized}-%`;
  const sql = `
    SELECT slug
    FROM events
    WHERE slug = $1 OR slug LIKE $2
  `;
  const result = await pool.query<{ slug: string }>(sql, [normalized, likePattern]);
  const existing = new Set(result.rows.map((r) => r.slug));
  if (!existing.has(normalized)) return normalized;

  let suffix = 2;
  while (existing.has(`${normalized}-${suffix}`)) {
    suffix += 1;
  }
  return `${normalized}-${suffix}`;
}

export async function createEvent(input: CreateEventInput): Promise<AdminEventRecord> {
  const pool = getDbPool();
  const desiredSlug = input.slug ?? input.title;
  const slug = await getNextAvailableSlug(desiredSlug);

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
      status
    )
    VALUES ($1, $2, $3::date, $4, $5, $6, $7, $8, $9, 'draft')
    RETURNING
      id,
      slug,
      title,
      event_date::text AS event_date,
      region,
      category,
      summary,
      impact,
      importance_score,
      confidence_score,
      status::text AS status,
      published_at::text AS published_at,
      created_at::text AS created_at,
      updated_at::text AS updated_at
  `;
  const values = [
    slug,
    input.title,
    input.event_date,
    input.region,
    input.category,
    input.summary,
    input.impact,
    input.importance_score,
    input.confidence_score ?? 3,
  ];

  const result = await pool.query<AdminEventRecord>(sql, values);
  return result.rows[0];
}

export async function updateEvent(
  eventId: string,
  input: UpdateEventInput,
): Promise<AdminEventRecord | null> {
  const pool = getDbPool();
  const values: Array<string | number> = [eventId];
  const updates: string[] = [];

  const assign = (column: string, value: string | number, cast = "") => {
    values.push(value);
    const index = values.length;
    updates.push(`${column} = $${index}${cast}`);
  };

  if (input.slug !== undefined) assign("slug", input.slug);
  if (input.title !== undefined) assign("title", input.title);
  if (input.event_date !== undefined) assign("event_date", input.event_date, "::date");
  if (input.region !== undefined) assign("region", input.region);
  if (input.category !== undefined) assign("category", input.category);
  if (input.summary !== undefined) assign("summary", input.summary);
  if (input.impact !== undefined) assign("impact", input.impact);
  if (input.importance_score !== undefined) assign("importance_score", input.importance_score);
  if (input.confidence_score !== undefined) assign("confidence_score", input.confidence_score);

  if (updates.length === 0) return null;

  updates.push("updated_at = NOW()");

  const sql = `
    UPDATE events
    SET ${updates.join(", ")}
    WHERE id = $1
    RETURNING
      id,
      slug,
      title,
      event_date::text AS event_date,
      region,
      category,
      summary,
      impact,
      importance_score,
      confidence_score,
      status::text AS status,
      published_at::text AS published_at,
      created_at::text AS created_at,
      updated_at::text AS updated_at
  `;

  const result = await pool.query<AdminEventRecord>(sql, values);
  return result.rows[0] ?? null;
}

export async function publishEvent(eventId: string): Promise<AdminEventRecord | null> {
  const pool = getDbPool();
  const sql = `
    UPDATE events
    SET
      status = 'published',
      published_at = COALESCE(published_at, NOW()),
      updated_at = NOW()
    WHERE id = $1
    RETURNING
      id,
      slug,
      title,
      event_date::text AS event_date,
      region,
      category,
      summary,
      impact,
      importance_score,
      confidence_score,
      status::text AS status,
      published_at::text AS published_at,
      created_at::text AS created_at,
      updated_at::text AS updated_at
  `;

  const result = await pool.query<AdminEventRecord>(sql, [eventId]);
  return result.rows[0] ?? null;
}

export async function archiveEvent(eventId: string): Promise<AdminEventRecord | null> {
  const pool = getDbPool();
  const sql = `
    UPDATE events
    SET
      status = 'archived',
      updated_at = NOW()
    WHERE id = $1
    RETURNING
      id,
      slug,
      title,
      event_date::text AS event_date,
      region,
      category,
      summary,
      impact,
      importance_score,
      confidence_score,
      status::text AS status,
      published_at::text AS published_at,
      created_at::text AS created_at,
      updated_at::text AS updated_at
  `;

  const result = await pool.query<AdminEventRecord>(sql, [eventId]);
  return result.rows[0] ?? null;
}

export async function listPublishedEventsByMonthDay(monthDay: string) {
  if (!hasDatabaseConfig()) {
    return listPublishedEventsByMonthDayFromDemo(monthDay);
  }

  try {
    const pool = getDbPool();
    const sql = `
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
        COALESCE(src.source_count, 0) AS source_count,
        COALESCE(tagset.tags, '[]'::json) AS tags
      FROM events e
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS source_count
        FROM event_sources es
        WHERE es.event_id = e.id
      ) src ON TRUE
      LEFT JOIN LATERAL (
        SELECT json_agg(t.slug ORDER BY t.slug) AS tags
        FROM event_tags et
        JOIN tags t ON t.id = et.tag_id
        WHERE et.event_id = e.id
      ) tagset ON TRUE
      WHERE e.status = 'published'
        AND to_char(e.event_date, 'MM-DD') = $1
      ORDER BY e.event_date DESC, e.importance_score DESC
    `;

    const result = await pool.query<
      Omit<EventListItem, "tags"> & { tags: unknown; source_count: number }
    >(sql, [monthDay]);

    return result.rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      event_date: row.event_date,
      region: row.region,
      category: row.category,
      summary: row.summary,
      importance_score: row.importance_score,
      confidence_score: row.confidence_score,
      source_count: row.source_count,
      tags: normalizeTags(row.tags),
    }));
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      return listPublishedEventsByMonthDayFromDemo(monthDay);
    }
    throw error;
  }
}

export function isEventStatus(value: string): value is EventStatus {
  return EVENT_STATUS_SET.has(value as EventStatus);
}
