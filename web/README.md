# Century of Finance Web

This app is the user-facing and API layer for the "100 years of financial history" project.

Reference architecture docs:
- `project/architecture/architecture.md`
- `project/architecture/schema.sql`
- `project/architecture/api-routes.md`

## 1. Product Scope

### 1.1 Core Goal
- Publish daily financial history events with source-backed evidence.
- Provide browsing by date, event, timeline, and source.
- Support editorial workflows: draft, review, publish, archive.

### 1.2 Current Stage
- Working Next.js app with public pages and API routes.
- Postgres-backed core data model.
- Demo fallback mode when database is not configured.
- Minimal admin workbench for bootstrap operations.

## 2. Stack and Architecture

### 2.1 Technology
- Framework: `Next.js 15` (`App Router`)
- Language: `TypeScript` (`strict`)
- Database: `PostgreSQL`
- DB driver: `pg`

### 2.2 Design Rules
- Keep route handlers thin.
- Put business/domain logic in `src/lib/*`.
- Use parameterized SQL only.
- Return consistent API shapes:
  - success: `{ "data": ... }`
  - error: `{ "error": { "code": "...", "message": "...", "details": {} } }`

## 3. Running the App

### 3.1 Requirements
- `Node.js >= 20`
- `npm >= 10`

### 3.2 Local Start
```bash
cd project/web
npm install
npm run dev
```

App URL:
- `http://localhost:3000`

### 3.3 With Database
1. Create `.env.local` from `.env.example`
2. Set `DATABASE_URL` and `SERVICE_TOKEN`
3. Apply schema from `project/architecture/schema.sql`

### 3.4 Quality Checks
```bash
npm run typecheck
npm run build
```

## 4. Demo Fallback Mode

When `DATABASE_URL` is missing, or the database is temporarily unreachable, public read functions
fall back to seed data.

This prevents hard 500 errors for:
- `/`
- `/events/[slug]`
- `/calendar/[monthDay]`
- `/timelines`
- `/timelines/[slug]`
- `/sources/[id]`
- read APIs under `/api/v1/events`, `/api/v1/calendar`, `/api/v1/timelines`, `/api/v1/sources`

Notes:
- Admin/internal write operations still need a real database.
- DB-unavailable failures on write routes are returned as `503 SERVICE_UNAVAILABLE`.

## 5. Seed Data Workflow and Curation Standards

### 5.1 Seed Files and Shape
- Main seed: `seeds/financial-history.seed.json`
- Optional year pack: `seeds/financial-history-2025.seed.json`
- Required top-level arrays:
  - `sources`
  - `events`
  - `event_sources`

### 5.2 Required Fields
- `sources` item:
  - `source_name`, `source_url`, `source_type`
  - recommended: `publisher`, `access_date`
- `events` item:
  - `slug`, `title`, `event_date`, `region`, `category`, `summary`, `impact`
  - `importance_score` in `1..5`
  - `confidence_score` in `1..5`
  - `status` in `draft|review|published|archived`
- `event_sources` item:
  - `event_slug`, `source_url`
  - optional: `relevance_rank`, `quote_excerpt`, `citation_note`

### 5.3 Event Inclusion Criteria
- Include events that clearly changed pricing, liquidity, risk premia, or policy expectations.
- Use concrete event dates (`YYYY-MM-DD`), not vague periods.
- Prefer policy actions, sanctions, market-structure breaks, banking stress, and geopolitical shocks with observable market impact.
- Do not add pure opinion pieces as standalone events.

### 5.4 Source Quality Standards
- Use at least one primary source whenever possible:
  - `official` (central bank, treasury, regulator, government)
  - `dataset` (FRED, official statistics portals)
- News-only events should include at least one high-quality wire/source and one market data reference when impact claims are numeric.
- Keep `source_type` accurate:
  - `official`, `dataset`, `news`, `research`, `archive`, `other`

### 5.5 Writing Standards for Event Text
- `summary`: objective fact of what happened on that date.
- `impact`: concise market effect statement.
- If `impact` includes interpretation, treat it as inference from cited sources and avoid certainty language.
- Keep language neutral and specific; avoid hype words.

### 5.6 De-duplication and Idempotency Rules
- `events.slug` must be unique.
- `sources.source_url` must be unique.
- `event_sources` unique key is (`event_slug`, `source_url`).
- Re-import behavior:
  - same slug/source URL updates existing records
  - same event-source pair updates citation fields

### 5.7 Data Add Procedure (Recommended)
1. Add or update sources in seed.
2. Add events with `status` (`review` for editorial flow, `published` for curated demo data).
3. Link each event to sources in `event_sources`.
4. Run structural validation:
   - `npm run seed:check`
   - `npm run seed:check -- --file seeds/financial-history-2025.seed.json` (if using a year pack)
   - `npm run seed:coverage:2025` (verify every month has at least one published event)
5. Run smoke test:
   - `npm run test:api`
6. Import:
   - full seed: `npm run seed:import`
   - year pack: `npm run seed:import -- --file seeds/financial-history-2025.seed.json`

If `DATABASE_URL` is unavailable and import API returns `503`, the importer applies demo fallback:
- importing the main seed logs a no-op success (data already in demo seed source)
- importing a non-main seed pack merges it into `seeds/financial-history.seed.json` using dedupe keys:
  - `sources.source_url`
  - `events.slug`
  - `event_sources (event_slug, source_url)`

### 5.8 Import Runtime Options
- `SEED_API_BASE_URL` (default `http://localhost:3000`)
- `SERVICE_TOKEN` (default `local-dev-seed`)

Example:
```bash
npm run seed:check
npm run seed:check -- --file seeds/financial-history-2025.seed.json
npm run seed:coverage:2025
SEED_API_BASE_URL=http://localhost:3000 SERVICE_TOKEN=dev-token npm run seed:import -- --file seeds/financial-history-2025.seed.json
```

## 6. Admin Workbench

Page:
- `/admin`

Current actions:
- Create draft event
- Create source
- Attach source to event
- Publish event

Current auth stub:
- request header `x-role: admin|editor`

## 7. Routes

### 7.1 Public Pages
- `/`
- `/events/[slug]`
- `/calendar/[monthDay]`
- `/timelines`
- `/timelines/[slug]`
- `/sources/[id]`

### 7.2 API Base
- `/api/v1`

### 7.3 Implemented Public APIs
- `GET /api/v1/events`
- `GET /api/v1/events/:slug`
- `GET /api/v1/calendar/:monthDay`
- `GET /api/v1/timelines`
- `GET /api/v1/timelines/:slug`
- `GET /api/v1/sources/:id`

### 7.4 Implemented Admin APIs
- `POST /api/v1/admin/events`
- `PATCH /api/v1/admin/events/:id`
- `POST /api/v1/admin/events/:id/publish`
- `POST /api/v1/admin/events/:id/archive`
- `POST /api/v1/admin/sources`
- `POST /api/v1/admin/tags`
- `POST /api/v1/admin/timelines`
- `POST/DELETE /api/v1/admin/events/:id/sources/:sourceId`
- `POST/DELETE /api/v1/admin/events/:id/tags/:tagId`
- `POST/PATCH/DELETE /api/v1/admin/timelines/:id/events/:eventId`

### 7.5 Implemented Internal APIs
- `POST /api/v1/internal/ingestion/jobs`
- `PATCH /api/v1/internal/ingestion/jobs/:id`
- `POST /api/v1/internal/ingestion/import`

Current internal auth stub:
- request header `x-service-token: <token>` and token value must equal `SERVICE_TOKEN`

## 8. Directory Standards

```text
src/
  app/
    api/v1/                    API routes
    layout.tsx                 root layout
    globals.css                global style system
    page.tsx                   home page
    admin/                     minimal editor UI
    events/[slug]/page.tsx
    calendar/[monthDay]/page.tsx
    timelines/page.tsx
    timelines/[slug]/page.tsx
    sources/[id]/page.tsx
  lib/
    api.ts                     shared responses + auth stubs
    db.ts                      PG pool
    runtime.ts                 runtime/db detection helpers
    demo-store.ts              no-DB fallback dataset
    events.ts                  event domain logic
    sources.ts                 source domain logic
    tags.ts                    tag domain logic
    timelines.ts               timeline domain logic
    ingestion.ts               ingestion domain logic
scripts/
  import-seed.mjs              seed importer
seeds/
  financial-history.seed.json  bootstrap dataset
```

## 9. Coding Standards

### 9.1 TypeScript
- Keep `strict` green.
- Avoid `any`.
- Validate all external input (`req.json()`, query params).

### 9.2 SQL and Data Access
- No raw string interpolation of user input.
- Keep SQL in `src/lib/*`.
- Keep route handlers orchestration-only.

### 9.3 Error Handling
- Validation errors: `400`
- Not found: `404`
- Conflict: `409`
- DB unavailable: `503`
- Unknown internal error: `500`

## 10. Tests and CI

### 10.1 Local Checks
```bash
npm run typecheck
npm run build
npm run test:api
```

### 10.2 API Smoke Test
- Script: `scripts/test-api.mjs`
- Starts app on a test port and validates key public APIs.

### 10.3 CI Workflow
- File: `.github/workflows/ci.yml`
- Runs: install, typecheck, build, API smoke test.

## 11. Definition of Done (DoD)

A change is done only if:
- README/docs updated when behavior changes.
- `typecheck` passes.
- `build` passes.
- No broken route contracts.
- No leftover debug artifacts.

## 12. Next Priorities
- Replace auth stubs with real authentication and RBAC.
- Add full integration tests for admin and ingestion writes.
- Add editorial review UI and workflow states.
- Add production monitoring and alerting.

## 13. Project Progress (as of 2026-02-12)

### 13.1 Delivered in this cycle
- Expanded curated seed coverage to `221` sources, `297` events, `321` event-source links (`all published`).
- Added and integrated a complete U.S.-Soviet Cold War timeline dataset (`36` events) for `1946-1991`.
- Added and integrated a post-1900 China-U.S. relations timeline dataset (`20` events) for `1900-2022`.
- Added and integrated a second China-U.S. classic milestones pack (`20` events) for `1954-2024`, lifting the China-U.S. timeline to `40` published events.
- Added and integrated a China-U.S. leaders' reciprocal visits pack (`8` events) for `1984-2023`, lifting the China-U.S. timeline to `48` published events.
- Added and integrated a China-Soviet relations timeline dataset (`14` events) for `1949-1991`.
- Added and integrated a post-1900 wars-involving-China timeline dataset (`12` events) for `1901-1988`.
- Extended the World War II timeline with key pre-1939 background milestones (`+9` events), lifting it to `29` published events for `1919-1945`.
- Added a China-focused WWII expansion pack (`+5` events: Xi'an, Nanjing, China's formal declaration of war, Cairo Conference, Potsdam Declaration), lifting the WWII timeline to `34` published events.
- Added a Japan/Germany interwar-dilemma background pack (`+6` events: Great Depression shock, London Naval constraints, Weimar emergency rule, Geneva disarmament deadlock, Germany League/disarmament withdrawal, February 26 Incident), lifting the WWII timeline to `40` published events.
- Added a U.S. WWII influence pack (`+7` events: Lend-Lease Act, Atlantic Charter, War Production Board, Chicago Pile-1, Casablanca outcomes, Bretton Woods opening, Operation Meetinghouse), lifting the WWII timeline to `47` published events.
- Added and integrated a U.S.-involved wars timeline dataset (`12` events) for `1917-2021`, exposed under `us-wars-since-1900`.
- Added a U.S.-wars completion pack (`+12` events: WWII Europe declaration, Japanese surrender, Inchon, Korean armistice, Tet, Fall of Saigon, Grenada, Desert Shield, 1991 ceasefire, AUMF, Iraq withdrawal completion, anti-ISIS opening strikes), lifting `us-wars-since-1900` to `24` published events.
- Added and integrated a CPC-centered timeline dataset (`20` events) for `1921-2022`, exposed under `ccp-history-since-1921`.
- Added a CPC timeline completion pack (`+12` events: 2nd-6th congress milestones, Chinese Soviet Republic, 10th/11th/13th/17th congresses, 1981 historical resolution, 2021 sixth plenum), lifting `ccp-history-since-1921` to `32` published events.
- Added a CPC key-plenum expansion pack (`+7` events: 12th/14th/16th/17th/18th/19th/20th Central Committee third plenums), lifting `ccp-history-since-1921` to `39` published events.
- Added a Mao-era completion pack (`+11` events: Autumn Harvest Uprising, Long March opening, Chongqing talks, Moscow visit, 1950 Sino-Soviet treaty, Great Leap/Lushan/1962 cadre conference checkpoints, Lin Biao incident, Nixon-Mao meeting, Mao's death), lifting `ccp-history-since-1921` to `50` published events.
- Hardened internal ingestion auth from header-presence check to strict `SERVICE_TOKEN` value matching (`x-service-token` must equal runtime secret).
- Added containerized runtime assets for Cloud Run deployment (`web/Dockerfile`, `web/.dockerignore`).
- Added GitHub Actions continuous deployment workflow for Cloud Run (`.github/workflows/deploy-gcp-cloud-run.yml`) with optional post-deploy seed import trigger.
- Extended demo timeline generation with a dedicated `china-us-since-1900` timeline slug (in addition to existing global/crisis/cold-war timelines).
- Extended demo timeline generation with a dedicated `china-wars-since-1900` timeline slug.
- Extended demo timeline generation with a dedicated `us-wars-since-1900` timeline slug.
- Extended demo timeline generation with a dedicated `ccp-history-since-1921` timeline slug.
- Extended demo timeline generation with a dedicated `world-war-ii` timeline slug.
- Hardened seed import behavior when DB is unavailable: importer now auto-falls back to demo merge logic instead of exiting with hard failure for this case.
- Completed real database import path with PostgreSQL schema applied and seed written into DB tables.

### 13.2 Current data and timeline state
- Seed date range: `1900-07-03` to `2025-12-19`.
- Demo/API timeline inventory currently includes `9` curated timelines:
  - `global-financial-turning-points`
  - `crisis-and-stabilization`
  - `us-soviet-cold-war`
  - `china-us-since-1900`
  - `china-soviet-relations`
  - `china-wars-since-1900`
  - `us-wars-since-1900`
  - `ccp-history-since-1921`
  - `world-war-ii`
- Database snapshot after import:
  - `events=297`
  - `sources=221`
  - `event_sources=321`
  - `timelines=9`
  - `timeline_events=452`
  - `world-war-ii events=47`
  - `us-wars-since-1900 events=24`
  - `ccp-history-since-1921 events=50`

### 13.3 Validation completed
- `npm run seed:check`
- `npm run test:api`
- `npm run seed:import`
- `npm run typecheck`
- `npm run build`
- direct PostgreSQL upsert import for `seeds/china-us-classics-2.seed.json` (equivalent write path applied successfully)
- timeline rebuild for `global-financial-turning-points`, `crisis-and-stabilization`, `us-soviet-cold-war`, `china-us-since-1900`, `china-soviet-relations`, `world-war-ii`, `us-wars-since-1900`, `ccp-history-since-1921`

## 14. Google Cloud One-Click Deploy (GitHub)

Workflow file:
- `.github/workflows/deploy-gcp-cloud-run.yml`

What it does on `main` push:
1. Build container from `web/Dockerfile` with Cloud Build.
2. Push image to Artifact Registry.
3. Deploy to Cloud Run.
4. Bind Cloud SQL instance and inject secrets (`DATABASE_URL`, `SERVICE_TOKEN`).

Optional manual action:
- `workflow_dispatch` supports `import_seed=true` to call `npm run seed:import` against the deployed service.

### 14.1 One-Time GCP Setup
Required services:
- `run.googleapis.com`
- `cloudbuild.googleapis.com`
- `artifactregistry.googleapis.com`
- `sqladmin.googleapis.com`
- `secretmanager.googleapis.com`

Create and configure:
1. Cloud SQL PostgreSQL instance and database.
2. Schema import from `project/architecture/schema.sql`.
3. Secret Manager secrets:
   - secret name for `DATABASE_URL`
   - secret name for `SERVICE_TOKEN`
4. Workload Identity Federation for GitHub Actions.
5. Grant deploy service account roles:
   - `roles/run.admin`
   - `roles/cloudbuild.builds.editor`
   - `roles/artifactregistry.writer`
   - `roles/secretmanager.secretAccessor`
   - `roles/cloudsql.client`
   - `roles/iam.serviceAccountUser` (for Cloud Run runtime service account if customized)

### 14.2 GitHub Repository Variables
Set repo variables:
- `GCP_PROJECT_ID`
- `GCP_REGION`
- `GCP_CLOUD_RUN_SERVICE`
- `GCP_ARTIFACT_REPOSITORY`
- `GCP_CLOUD_SQL_CONNECTION` (`project:region:instance`)
- `GCP_DB_SECRET_NAME`
- `GCP_SERVICE_TOKEN_SECRET_NAME`

### 14.3 GitHub Repository Secrets
Set repo secrets:
- `GCP_WORKLOAD_IDENTITY_PROVIDER`
- `GCP_SERVICE_ACCOUNT`
- `SERVICE_TOKEN` (only needed when using `import_seed=true`; must match deployed `SERVICE_TOKEN`)
