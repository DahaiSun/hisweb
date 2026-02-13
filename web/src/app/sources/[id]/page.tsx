import Link from "next/link";
import { notFound } from "next/navigation";
import { isValidUuid } from "@/lib/events";
import { formatEventDate } from "@/lib/format";
import { getSourceById } from "@/lib/sources";

export const dynamic = "force-dynamic";

export default async function SourceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isValidUuid(id)) notFound();

  try {
    const source = await getSourceById(id);
    if (!source) notFound();

    return (
      <div className="page-block stack">
        <Link href="/" className="back-link">
          ← Back to events
        </Link>

        <section className="hero">
          <span className="eyebrow">Source Detail</span>
          <h1>{source.source_name}</h1>
          <p>
            <a className="source-link" href={source.source_url} target="_blank" rel="noreferrer">
              {source.source_url}
            </a>
          </p>
          <div className="stats-row">
            <span className="pill">{source.source_type}</span>
            <span className="pill">{source.publisher ?? "Unknown publisher"}</span>
            <span className="pill">{source.linked_events.length} linked events</span>
          </div>
        </section>

        {source.linked_events.length === 0 ? (
          <div className="empty-state">No linked published events.</div>
        ) : (
          <section className="stack">
            {source.linked_events.map((event) => (
              <article className="card" key={event.id}>
                <div className="meta-line">
                  <span>{formatEventDate(event.event_date)}</span>
                  <span>{event.region}</span>
                  <span>{event.category}</span>
                  <span>Rank {event.relevance_rank}</span>
                </div>
                <Link className="card-title" href={`/events/${event.slug}`}>
                  {event.title}
                </Link>
                <p>{event.summary}</p>
                {event.citation_note ? <p className="muted">{event.citation_note}</p> : null}
              </article>
            ))}
          </section>
        )}
      </div>
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return (
      <section className="page-block hero">
        <h1>Failed to load source</h1>
        <p>
          <span className="highlight">{message}</span>
        </p>
      </section>
    );
  }
}
