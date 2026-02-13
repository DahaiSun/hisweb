import Link from "next/link";
import { listTimelinesPublic } from "@/lib/timelines";
import { formatEventDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function TimelinesPage() {
  try {
    const timelines = await listTimelinesPublic();

    return (
      <div className="page-block stack">
        <section className="hero">
          <span className="eyebrow">Curated Threads</span>
          <h1>Timelines</h1>
          <p>
            Follow connected chains of financial history: policy shifts, crises, recoveries, and
            structural market transitions.
          </p>
          <div className="stats-row">
            <span className="pill">{timelines.length} timelines</span>
          </div>
        </section>

        {timelines.length === 0 ? (
          <div className="empty-state">No timelines published yet.</div>
        ) : (
          <section className="grid grid-events">
            {timelines.map((timeline) => (
              <article className="card" key={timeline.id}>
                <Link className="card-title" href={`/timelines/${timeline.slug}`}>
                  {timeline.title}
                </Link>
                <p>{timeline.description ?? "Curated event sequence."}</p>
                <div className="meta-line">
                  <span>{timeline.event_count} events</span>
                  <span>
                    {timeline.first_event_date ? formatEventDate(timeline.first_event_date) : "N/A"} to{" "}
                    {timeline.last_event_date ? formatEventDate(timeline.last_event_date) : "N/A"}
                  </span>
                </div>
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
        <h1>Failed to load timelines</h1>
        <p>
          <span className="highlight">{message}</span>
        </p>
      </section>
    );
  }
}
