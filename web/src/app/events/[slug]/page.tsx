import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublishedEventBySlug } from "@/lib/events";
import { formatEventDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  try {
    const event = await getPublishedEventBySlug(slug);
    if (!event) notFound();

    return (
      <article className="page-block stack">
        <Link href="/" className="back-link">
          ← Back to events
        </Link>

        <section className="hero">
          <span className="eyebrow">Event Record</span>
          <h1>{event.title}</h1>
          <div className="stats-row">
            <span className="pill">{formatEventDate(event.event_date)}</span>
            <span className="pill">{event.region}</span>
            <span className="pill">{event.category}</span>
            <span className="pill">Importance {event.importance_score}/5</span>
            <span className="pill">Confidence {event.confidence_score}/5</span>
          </div>
          <p>{event.summary}</p>
        </section>

        <section className="card">
          <h2>Market Impact</h2>
          <p>{event.impact}</p>
          {event.tags.length > 0 ? (
            <div className="tag-list">
              {event.tags.map((tag) => (
                <span className="tag" key={tag}>
                  #{tag}
                </span>
              ))}
            </div>
          ) : null}
        </section>

        <section className="card">
          <h2>Sources</h2>
          {event.sources.length === 0 ? (
            <div className="empty-state">No source references linked yet.</div>
          ) : (
            <div className="source-list">
              {event.sources.map((source) => (
                <div key={source.id} className="stack">
                  <a className="source-link" href={source.source_url} target="_blank" rel="noreferrer">
                    {source.source_name}
                  </a>
                  <div className="meta-line">
                    <span>{source.source_type}</span>
                    <span>{source.publisher ?? "Unknown publisher"}</span>
                    <span>Rank {source.relevance_rank}</span>
                  </div>
                  {source.citation_note ? <p>{source.citation_note}</p> : null}
                  {source.quote_excerpt ? <p className="muted">“{source.quote_excerpt}”</p> : null}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card">
          <h2>Related Timelines</h2>
          {event.timelines.length === 0 ? (
            <div className="empty-state">Not linked to a timeline yet.</div>
          ) : (
            <div className="tag-list">
              {event.timelines.map((timeline) => (
                <Link href={`/timelines/${timeline.slug}`} className="pill" key={timeline.id}>
                  {timeline.title} · #{timeline.sequence_no}
                </Link>
              ))}
            </div>
          )}
        </section>
      </article>
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return (
      <section className="page-block hero">
        <h1>Failed to load event</h1>
        <p>
          <span className="highlight">{message}</span>
        </p>
      </section>
    );
  }
}
