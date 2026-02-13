import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

type SeedSource = {
  source_name: string;
  source_url: string;
  source_type?: "archive" | "official" | "news" | "research" | "dataset" | "other";
  publisher?: string;
  publication_or_snapshot_date?: string;
  access_date?: string;
  rights_note?: string;
  notes_on_reliability?: string;
};

type SeedEvent = {
  slug?: string;
  title: string;
  event_date: string;
  region: string;
  category: string;
  summary: string;
  impact: string;
  importance_score: number;
  confidence_score?: number;
  status?: "draft" | "review" | "published" | "archived";
};

type SeedEventSource = {
  event_slug: string;
  source_url: string;
  relevance_rank?: number;
  quote_excerpt?: string;
  citation_note?: string;
};

type SeedPayload = {
  sources?: SeedSource[];
  events?: SeedEvent[];
  event_sources?: SeedEventSource[];
};

type DemoSourceType = "archive" | "official" | "news" | "research" | "dataset" | "other";
type DemoEventStatus = "draft" | "review" | "published" | "archived";

export type DemoSourceRecord = {
  id: string;
  source_name: string;
  source_url: string;
  source_type: DemoSourceType;
  publisher: string | null;
  publication_or_snapshot_date: string | null;
  access_date: string | null;
  rights_note: string | null;
  notes_on_reliability: string | null;
  created_at: string;
  updated_at: string;
};

export type DemoEventRecord = {
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
  status: DemoEventStatus;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type DemoEventSourceRecord = {
  event_id: string;
  source_id: string;
  quote_excerpt: string | null;
  citation_note: string | null;
  relevance_rank: number;
};

export type DemoTimelineRecord = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type DemoTimelineEventRecord = {
  timeline_id: string;
  event_id: string;
  sequence_no: number;
};

export type DemoTagRecord = {
  id: string;
  slug: string;
  name: string;
};

export type DemoEventTagRecord = {
  event_id: string;
  tag_id: string;
};

export type DemoDataset = {
  sources: DemoSourceRecord[];
  events: DemoEventRecord[];
  eventSources: DemoEventSourceRecord[];
  timelines: DemoTimelineRecord[];
  timelineEvents: DemoTimelineEventRecord[];
  tags: DemoTagRecord[];
  eventTags: DemoEventTagRecord[];
};

let demoDatasetPromise: Promise<DemoDataset> | null = null;

function stableUuid(seed: string) {
  const hex = createHash("sha256").update(seed).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function normalizeSlug(input: string) {
  const normalized = input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
  return normalized || "record";
}

function normalizeSourceType(input?: string): DemoSourceType {
  if (input === "archive") return "archive";
  if (input === "official") return "official";
  if (input === "news") return "news";
  if (input === "research") return "research";
  if (input === "dataset") return "dataset";
  return "other";
}

function toIsoDate(dateString: string) {
  return `${dateString}T00:00:00.000Z`;
}

function sortByEventDateAsc(a: DemoEventRecord, b: DemoEventRecord) {
  if (a.event_date < b.event_date) return -1;
  if (a.event_date > b.event_date) return 1;
  return a.slug.localeCompare(b.slug);
}

async function loadSeedPayload(): Promise<SeedPayload> {
  const filePath = path.resolve(process.cwd(), "seeds/financial-history.seed.json");
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw) as SeedPayload;
}

function buildTimelines(events: DemoEventRecord[]): {
  timelines: DemoTimelineRecord[];
  timelineEvents: DemoTimelineEventRecord[];
} {
  const now = new Date().toISOString();
  const publishedEvents = events.filter((event) => event.status === "published").sort(sortByEventDateAsc);

  const primaryTimeline: DemoTimelineRecord = {
    id: stableUuid("timeline:global-financial-turning-points"),
    title: "Global Financial Turning Points",
    slug: "global-financial-turning-points",
    description: "Major events that reshaped financial markets and policy regimes.",
    created_at: now,
    updated_at: now,
  };

  const crisisTimeline: DemoTimelineRecord = {
    id: stableUuid("timeline:crisis-and-stabilization"),
    title: "Crisis and Stabilization Cycle",
    slug: "crisis-and-stabilization",
    description: "Episodes of stress and the policy responses that followed.",
    created_at: now,
    updated_at: now,
  };

  const coldWarTimeline: DemoTimelineRecord = {
    id: stableUuid("timeline:us-soviet-cold-war"),
    title: "US-Soviet Cold War (1946-1991)",
    slug: "us-soviet-cold-war",
    description: "Key geopolitical, military, and policy milestones in the U.S.-Soviet Cold War.",
    created_at: now,
    updated_at: now,
  };

  const chinaUsTimeline: DemoTimelineRecord = {
    id: stableUuid("timeline:china-us-since-1900"),
    title: "China-U.S. Relations Since 1900",
    slug: "china-us-since-1900",
    description: "Major diplomatic, military, trade, and technology turning points in China-U.S. relations.",
    created_at: now,
    updated_at: now,
  };

  const chinaSovietTimeline: DemoTimelineRecord = {
    id: stableUuid("timeline:china-soviet-relations"),
    title: "China-Soviet Relations (1949-1991)",
    slug: "china-soviet-relations",
    description: "Alliance, split, border crises, and normalization milestones in China-Soviet relations.",
    created_at: now,
    updated_at: now,
  };

  const chinaWarTimeline: DemoTimelineRecord = {
    id: stableUuid("timeline:china-wars-since-1900"),
    title: "Wars Involving China Since 1900",
    slug: "china-wars-since-1900",
    description: "Major interstate and cross-strait conflict milestones involving China after 1900.",
    created_at: now,
    updated_at: now,
  };

  const usWarTimeline: DemoTimelineRecord = {
    id: stableUuid("timeline:us-wars-since-1900"),
    title: "Wars Involving the United States Since 1900",
    slug: "us-wars-since-1900",
    description: "Major war-entry, escalation, intervention, and withdrawal milestones involving the United States.",
    created_at: now,
    updated_at: now,
  };

  const ccpTimeline: DemoTimelineRecord = {
    id: stableUuid("timeline:ccp-history-since-1921"),
    title: "CPC-Centered Timeline Since 1921",
    slug: "ccp-history-since-1921",
    description: "Major organizational, political, and policy milestones centered on the Communist Party of China.",
    created_at: now,
    updated_at: now,
  };

  const worldWarTwoTimeline: DemoTimelineRecord = {
    id: stableUuid("timeline:world-war-ii"),
    title: "World War II Timeline (1939-1945)",
    slug: "world-war-ii",
    description: "Key military, diplomatic, and war-ending milestones in World War II.",
    created_at: now,
    updated_at: now,
  };

  const crisisEvents = publishedEvents.filter((event) => {
    const haystack = `${event.title} ${event.category}`.toLowerCase();
    return /crash|crisis|stress|banking|default|rescue|failure/.test(haystack);
  });

  const coldWarEvents = publishedEvents.filter((event) => event.slug.startsWith("cold-war-"));
  const chinaUsEvents = publishedEvents.filter((event) => event.slug.startsWith("china-us-"));
  const chinaSovietEvents = publishedEvents.filter((event) =>
    event.slug.startsWith("china-soviet-"),
  );
  const chinaWarEvents = publishedEvents.filter((event) => event.slug.startsWith("china-war-"));
  const usWarEvents = publishedEvents.filter((event) => event.slug.startsWith("us-war-"));
  const ccpEvents = publishedEvents.filter((event) => event.slug.startsWith("ccp-"));
  const worldWarTwoEvents = publishedEvents.filter((event) => event.slug.startsWith("wwii-"));

  const timelineEvents: DemoTimelineEventRecord[] = [];

  publishedEvents.forEach((event, index) => {
    timelineEvents.push({
      timeline_id: primaryTimeline.id,
      event_id: event.id,
      sequence_no: index + 1,
    });
  });

  crisisEvents.forEach((event, index) => {
    timelineEvents.push({
      timeline_id: crisisTimeline.id,
      event_id: event.id,
      sequence_no: index + 1,
    });
  });

  coldWarEvents.forEach((event, index) => {
    timelineEvents.push({
      timeline_id: coldWarTimeline.id,
      event_id: event.id,
      sequence_no: index + 1,
    });
  });

  chinaUsEvents.forEach((event, index) => {
    timelineEvents.push({
      timeline_id: chinaUsTimeline.id,
      event_id: event.id,
      sequence_no: index + 1,
    });
  });

  chinaSovietEvents.forEach((event, index) => {
    timelineEvents.push({
      timeline_id: chinaSovietTimeline.id,
      event_id: event.id,
      sequence_no: index + 1,
    });
  });

  chinaWarEvents.forEach((event, index) => {
    timelineEvents.push({
      timeline_id: chinaWarTimeline.id,
      event_id: event.id,
      sequence_no: index + 1,
    });
  });

  usWarEvents.forEach((event, index) => {
    timelineEvents.push({
      timeline_id: usWarTimeline.id,
      event_id: event.id,
      sequence_no: index + 1,
    });
  });

  ccpEvents.forEach((event, index) => {
    timelineEvents.push({
      timeline_id: ccpTimeline.id,
      event_id: event.id,
      sequence_no: index + 1,
    });
  });

  worldWarTwoEvents.forEach((event, index) => {
    timelineEvents.push({
      timeline_id: worldWarTwoTimeline.id,
      event_id: event.id,
      sequence_no: index + 1,
    });
  });

  return {
    timelines: [
      primaryTimeline,
      crisisTimeline,
      coldWarTimeline,
      chinaUsTimeline,
      chinaSovietTimeline,
      chinaWarTimeline,
      usWarTimeline,
      ccpTimeline,
      worldWarTwoTimeline,
    ],
    timelineEvents,
  };
}

function buildTags(events: DemoEventRecord[]): { tags: DemoTagRecord[]; eventTags: DemoEventTagRecord[] } {
  const categoryToTag = new Map<string, DemoTagRecord>();
  const eventTags: DemoEventTagRecord[] = [];

  for (const event of events) {
    const slug = normalizeSlug(event.category);
    if (!categoryToTag.has(slug)) {
      categoryToTag.set(slug, {
        id: stableUuid(`tag:${slug}`),
        slug,
        name: event.category,
      });
    }
    const tag = categoryToTag.get(slug);
    if (tag) {
      eventTags.push({
        event_id: event.id,
        tag_id: tag.id,
      });
    }
  }

  return {
    tags: [...categoryToTag.values()],
    eventTags,
  };
}

async function buildDataset(): Promise<DemoDataset> {
  const payload = await loadSeedPayload();
  const now = new Date().toISOString();

  const sources = (payload.sources ?? []).map((source) => ({
    id: stableUuid(`source:${source.source_url}`),
    source_name: source.source_name,
    source_url: source.source_url,
    source_type: normalizeSourceType(source.source_type),
    publisher: source.publisher ?? null,
    publication_or_snapshot_date: source.publication_or_snapshot_date ?? null,
    access_date: source.access_date ?? null,
    rights_note: source.rights_note ?? null,
    notes_on_reliability: source.notes_on_reliability ?? null,
    created_at: now,
    updated_at: now,
  }));

  const events = (payload.events ?? []).map((event) => {
    const slug = normalizeSlug(event.slug ?? event.title);
    const status: DemoEventStatus = event.status ?? "draft";
    return {
      id: stableUuid(`event:${slug}`),
      slug,
      title: event.title,
      event_date: event.event_date,
      region: event.region,
      category: event.category,
      summary: event.summary,
      impact: event.impact,
      importance_score: event.importance_score,
      confidence_score: event.confidence_score ?? 3,
      status,
      published_at: status === "published" ? toIsoDate(event.event_date) : null,
      created_at: now,
      updated_at: now,
    };
  });

  const eventIdBySlug = new Map(events.map((event) => [event.slug, event.id]));
  const sourceIdByUrl = new Map(sources.map((source) => [source.source_url, source.id]));

  const eventSources = (payload.event_sources ?? [])
    .map((link) => {
      const eventId = eventIdBySlug.get(normalizeSlug(link.event_slug));
      const sourceId = sourceIdByUrl.get(link.source_url);
      if (!eventId || !sourceId) return null;
      return {
        event_id: eventId,
        source_id: sourceId,
        quote_excerpt: link.quote_excerpt ?? null,
        citation_note: link.citation_note ?? null,
        relevance_rank: link.relevance_rank ?? 1,
      };
    })
    .filter((row): row is DemoEventSourceRecord => row !== null);

  const { timelines, timelineEvents } = buildTimelines(events);
  const { tags, eventTags } = buildTags(events);

  return {
    sources,
    events,
    eventSources,
    timelines,
    timelineEvents,
    tags,
    eventTags,
  };
}

export async function getDemoDataset(): Promise<DemoDataset> {
  if (!demoDatasetPromise) {
    demoDatasetPromise = buildDataset();
  }
  return demoDatasetPromise;
}
