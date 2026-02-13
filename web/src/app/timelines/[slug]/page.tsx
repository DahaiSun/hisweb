import Link from "next/link";
import { notFound } from "next/navigation";
import { formatEventDate } from "@/lib/format";
import { getTimelineBySlug, type TimelineEventItem } from "@/lib/timelines";

export const dynamic = "force-dynamic";

type TimelineMonthGroup = {
  key: string;
  anchor: string;
  label: string;
  events: TimelineEventItem[];
};

function toMonthKey(eventDate: string) {
  return eventDate.slice(0, 7);
}

function toMonthLabel(key: string) {
  const [yearRaw, monthRaw] = key.split("-");
  const year = Number.parseInt(yearRaw ?? "", 10);
  const month = Number.parseInt(monthRaw ?? "", 10);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return key;
  }
  const date = new Date(Date.UTC(year, month - 1, 1));
  if (Number.isNaN(date.getTime())) return key;
  return date.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function groupTimelineEventsByMonth(events: TimelineEventItem[]): TimelineMonthGroup[] {
  const grouped = new Map<string, TimelineEventItem[]>();
  for (const event of events) {
    const key = toMonthKey(event.event_date);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(event);
  }

  return [...grouped.entries()].map(([key, bucket]) => ({
    key,
    anchor: `month-${key}`,
    label: toMonthLabel(key),
    events: bucket,
  }));
}

function getDateRange(events: TimelineEventItem[]) {
  const sorted = [...events].map((event) => event.event_date).sort();
  return {
    from: sorted[0] ?? null,
    to: sorted.length > 0 ? sorted[sorted.length - 1] : null,
  };
}

export default async function TimelineDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  try {
    const timeline = await getTimelineBySlug(slug);
    if (!timeline) notFound();

    const monthGroups = groupTimelineEventsByMonth(timeline.events);
    const dateRange = getDateRange(timeline.events);

    return (
      <div className="page-block stack">
        <Link href="/timelines" className="back-link">
          {"<- Back to timelines"}
        </Link>

        <section className="hero">
          <span className="eyebrow">Timeline</span>
          <h1>{timeline.title}</h1>
          <p>{timeline.description ?? "A connected thread of market-moving events."}</p>
          <div className="stats-row">
            <span className="pill">{timeline.events.length} published events</span>
            {dateRange.from && dateRange.to ? (
              <span className="pill">
                {formatEventDate(dateRange.from)} to {formatEventDate(dateRange.to)}
              </span>
            ) : null}
            <span className="pill">{monthGroups.length} active months</span>
          </div>
        </section>

        {timeline.events.length === 0 ? (
          <div className="empty-state">No published events in this timeline yet.</div>
        ) : (
          <div className="timeline-layout">
            <aside className="timeline-nav card">
              <h2>Jump by month</h2>
              <div className="timeline-nav-list">
                {monthGroups.map((group) => (
                  <a key={group.key} href={`#${group.anchor}`} className="timeline-nav-link">
                    <span>{group.label}</span>
                    <span className="timeline-nav-count">{group.events.length}</span>
                  </a>
                ))}
              </div>
            </aside>

            <section className="timeline-groups stack">
              {monthGroups.map((group) => (
                <section className="timeline-month" id={group.anchor} key={group.key}>
                  <div className="timeline-month-header">
                    <h2>{group.label}</h2>
                    <span className="pill">{group.events.length} events</span>
                  </div>

                  <div className="stack">
                    {group.events.map((event) => (
                      <article
                        className={`card timeline-event timeline-event-importance-${event.importance_score}`}
                        key={event.id}
                      >
                        <div className="meta-line">
                          <span>Sequence #{event.sequence_no}</span>
                          <span>{formatEventDate(event.event_date)}</span>
                          <span>{event.region}</span>
                          <span>{event.category}</span>
                        </div>
                        <Link className="card-title" href={`/events/${event.slug}`}>
                          {event.title}
                        </Link>
                        <p>{event.summary}</p>
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </section>
          </div>
        )}
      </div>
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return (
      <section className="page-block hero">
        <h1>Failed to load timeline</h1>
        <p>
          <span className="highlight">{message}</span>
        </p>
      </section>
    );
  }
}
