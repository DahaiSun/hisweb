# Website Architecture (Financial History, 100 Years)

## Goals
- Track impactful financial events by day over 100 years.
- Keep strong source citations and editorial quality controls.
- Support search, filtering, timelines, and scalable ingestion.

## System Components
1. Frontend
   - Next.js (App Router)
   - Main pages: home, date view, event detail, timeline, search
2. API Layer
   - Next.js Route Handlers or standalone API service
   - Serves public read APIs and admin/editor APIs
3. Database
   - PostgreSQL as source of truth (`schema.sql`)
4. Search
   - Start with PostgreSQL FTS
   - Upgrade to Meilisearch/Typesense for typo tolerance and faceting
5. Ingestion Worker
   - Scheduled fetch from Archive.org / IMF / macro APIs
   - Normalize, deduplicate, score confidence, write to staging/draft
6. Monitoring
   - Sentry for error tracking
   - Structured logs for ingestion and API latency

## Data Flow
1. Fetch source data from registered data sources.
2. Normalize into unified source/event shape.
3. Deduplicate candidates and compute confidence score.
4. Save as draft events + source links.
5. Editors review and publish.
6. Published events are indexed for search and shown publicly.

## Caching and Performance
- Use ISR for high-traffic event pages.
- Cache list endpoints with short TTL.
- Pre-render month/day pages for discovery.
- Add CDN cache headers for static content.

## Security and Governance
- Role-based access: `editor` and `admin`.
- Internal ingestion endpoints protected by service token.
- Keep citation and rights notes for each source record.

## Suggested Deployment
- Frontend/API: Vercel
- PostgreSQL: Supabase or Neon
- Redis/Queue: Upstash + worker runtime
- Storage: S3/R2 for media assets and optional snapshots

## Immediate Next Build Order
1. Apply `schema.sql` to a Postgres instance.
2. Implement public read endpoints first (`/events`, `/events/:slug`).
3. Build admin CRUD for events and sources.
4. Add first ingestion pipeline (Archive.org + IMF Archives metadata).
5. Add search indexer and filtering UI.
