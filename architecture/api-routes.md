# API Routes (MVP)

Base path: `/api/v1`

## Public Read APIs

### GET `/events`
Query params:
- `date=YYYY-MM-DD`
- `from=YYYY-MM-DD`
- `to=YYYY-MM-DD`
- `category=...`
- `region=...`
- `tag=...`
- `importance_min=1..5`
- `q=keyword`
- `page=1`
- `page_size=20`
- `sort=date_desc|date_asc|importance_desc`

Response:
- paginated list of published events
- minimal source count and tags

### GET `/events/:slug`
Response:
- full event details
- related sources (ordered by `relevance_rank`)
- tags
- optional timeline memberships

### GET `/calendar/:monthDay`
Example:
- `/calendar/09-15` for all years on Sep 15

Response:
- all published events matching month/day

### GET `/timelines`
Response:
- timeline list

### GET `/timelines/:slug`
Response:
- timeline metadata
- ordered event list

### GET `/sources/:id`
Response:
- source metadata
- list of linked events

## Admin/Editor APIs

### POST `/admin/events`
- create draft event

### PATCH `/admin/events/:id`
- update event fields

### POST `/admin/events/:id/publish`
- publish event (`status=published`, `published_at=now`)

### POST `/admin/events/:id/archive`
- archive event (`status=archived`)

### POST `/admin/sources`
- create source

### POST `/admin/events/:id/sources/:sourceId`
- attach source to event with citation fields

### DELETE `/admin/events/:id/sources/:sourceId`
- detach source

### POST `/admin/tags`
- create tag

### POST `/admin/events/:id/tags/:tagId`
- attach tag

### DELETE `/admin/events/:id/tags/:tagId`
- detach tag

### POST `/admin/timelines`
- create timeline

### POST `/admin/timelines/:id/events/:eventId`
- attach event to timeline with `sequence_no`

### PATCH `/admin/timelines/:id/events/:eventId`
- update `sequence_no`

### DELETE `/admin/timelines/:id/events/:eventId`
- remove event from timeline

## Ingestion APIs (Internal)

### POST `/internal/ingestion/jobs`
- enqueue ingestion job
- payload: `source_name`, `job_type`, `metadata`

### PATCH `/internal/ingestion/jobs/:id`
- update status and counters

### POST `/internal/ingestion/import`
- bulk upsert sources/events
- requires service auth key

## Auth and Access
- Public endpoints: read-only, published content only.
- Admin endpoints: JWT/session with roles (`editor`, `admin`).
- Internal ingestion endpoints: service token only.

## Suggested Error Shape
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "event_date is required",
    "details": {}
  }
}
```
