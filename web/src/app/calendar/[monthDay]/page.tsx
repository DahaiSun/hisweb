import Link from "next/link";
import { notFound } from "next/navigation";
import { listPublishedEventsByMonthDay } from "@/lib/events";
import { formatEventDate, formatMonthDay } from "@/lib/format";

export const dynamic = "force-dynamic";

const MONTH_DAY_RE = /^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/;

export default async function CalendarDayPage({
  params,
}: {
  params: Promise<{ monthDay: string }>;
}) {
  const { monthDay } = await params;
  if (!MONTH_DAY_RE.test(monthDay)) notFound();

  try {
    const events = await listPublishedEventsByMonthDay(monthDay);

    return (
      <div className="page-block stack">
        <section className="hero">
          <span className="eyebrow">On This Day</span>
          <h1>{formatMonthDay(monthDay)}</h1>
          <p>Historical financial events that happened on this month-day across all tracked years.</p>
          <div className="stats-row">
            <span className="pill">{events.length} events found</span>
            <Link href="/" className="pill">
              Back to latest events
            </Link>
          </div>
        </section>

        {events.length === 0 ? (
          <div className="empty-state">No published entries yet for {formatMonthDay(monthDay)}.</div>
        ) : (
          <section className="grid grid-events">
            {events.map((event) => (
              <article className="card" key={event.id}>
                <div className="meta-line">
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
          </section>
        )}
      </div>
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return (
      <section className="page-block hero">
        <h1>Failed to load this day</h1>
        <p>
          <span className="highlight">{message}</span>
        </p>
      </section>
    );
  }
}
