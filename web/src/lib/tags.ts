import { getDbPool } from "@/lib/db";

export type TagRecord = {
  id: string;
  name: string;
  slug: string;
  created_at: string;
};

export type CreateTagInput = {
  name: string;
  slug?: string;
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

function slugify(input: string): string {
  const normalized = input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
  return normalized || "tag";
}

function isValidSlug(input: string) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input);
}

export function validateCreateTagInput(input: unknown): {
  value?: CreateTagInput;
  error?: string;
} {
  const body = asObject(input);
  if (!body) return { error: "request body must be a JSON object" };

  const name = asTrimmedString(body.name);
  if (!name) return { error: "name is required" };

  const slugInput = asTrimmedString(body.slug);
  const slug = slugInput ? slugify(slugInput) : slugify(name);
  if (!isValidSlug(slug)) return { error: "slug is invalid" };

  return {
    value: {
      name,
      slug,
    },
  };
}

export async function createTag(input: CreateTagInput): Promise<TagRecord> {
  const pool = getDbPool();
  const slug = slugify(input.slug ?? input.name);

  const sql = `
    INSERT INTO tags (name, slug)
    VALUES ($1, $2)
    RETURNING
      id,
      name,
      slug,
      created_at::text AS created_at
  `;
  const result = await pool.query<TagRecord>(sql, [input.name, slug]);
  return result.rows[0];
}

export async function attachTagToEvent(eventId: string, tagId: string) {
  const pool = getDbPool();
  const sql = `
    INSERT INTO event_tags (event_id, tag_id)
    VALUES ($1, $2)
    ON CONFLICT (event_id, tag_id) DO NOTHING
    RETURNING event_id::text AS event_id, tag_id::text AS tag_id
  `;
  const result = await pool.query<{ event_id: string; tag_id: string }>(sql, [eventId, tagId]);
  if (result.rows[0]) return result.rows[0];

  const existingSql = `
    SELECT event_id::text AS event_id, tag_id::text AS tag_id
    FROM event_tags
    WHERE event_id = $1
      AND tag_id = $2
    LIMIT 1
  `;
  const existing = await pool.query<{ event_id: string; tag_id: string }>(existingSql, [
    eventId,
    tagId,
  ]);
  return existing.rows[0] ?? null;
}

export async function detachTagFromEvent(eventId: string, tagId: string) {
  const pool = getDbPool();
  const sql = `
    DELETE FROM event_tags
    WHERE event_id = $1
      AND tag_id = $2
    RETURNING event_id::text AS event_id, tag_id::text AS tag_id
  `;
  const result = await pool.query<{ event_id: string; tag_id: string }>(sql, [eventId, tagId]);
  return result.rows[0] ?? null;
}
