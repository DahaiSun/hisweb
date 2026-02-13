import Link from "next/link";

export default function NotFound() {
  return (
    <section className="page-block hero">
      <span className="eyebrow">404</span>
      <h1>Record not found</h1>
      <p>The requested page does not exist or is not published yet.</p>
      <div className="stats-row">
        <Link href="/" className="pill">
          Back to homepage
        </Link>
        <Link href="/timelines" className="pill">
          Browse timelines
        </Link>
      </div>
    </section>
  );
}
