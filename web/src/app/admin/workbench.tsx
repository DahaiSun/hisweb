"use client";

import { FormEvent, useMemo, useState } from "react";

type CallStatus = "idle" | "loading" | "success" | "error";

type CallResult = {
  status: CallStatus;
  message: string;
  payload?: unknown;
};

const DEFAULT_RESULT: CallResult = {
  status: "idle",
  message: "",
};

function pretty(value: unknown) {
  return JSON.stringify(value, null, 2);
}

async function callApi<T>(
  path: string,
  method: "POST" | "PATCH",
  role: string,
  body?: Record<string, unknown>,
) {
  const response = await fetch(path, {
    method,
    headers: {
      "content-type": "application/json",
      "x-role": role,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const raw = await response.text();
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = { raw };
  }

  if (!response.ok) {
    const message =
      typeof parsed === "object" && parsed && "error" in parsed
        ? (parsed as { error?: { message?: string } }).error?.message ?? "Request failed"
        : "Request failed";
    throw new Error(message);
  }

  return parsed as T;
}

export function AdminWorkbench() {
  const [role, setRole] = useState("editor");

  const [eventForm, setEventForm] = useState({
    title: "",
    event_date: "",
    region: "United States",
    category: "Monetary Policy",
    summary: "",
    impact: "",
    importance_score: "4",
    confidence_score: "4",
    slug: "",
  });
  const [sourceForm, setSourceForm] = useState({
    source_name: "",
    source_url: "",
    source_type: "official",
    publisher: "",
    publication_or_snapshot_date: "",
    access_date: "",
  });
  const [linkForm, setLinkForm] = useState({
    event_id: "",
    source_id: "",
    relevance_rank: "1",
    citation_note: "",
    quote_excerpt: "",
  });
  const [publishEventId, setPublishEventId] = useState("");

  const [eventResult, setEventResult] = useState<CallResult>(DEFAULT_RESULT);
  const [sourceResult, setSourceResult] = useState<CallResult>(DEFAULT_RESULT);
  const [linkResult, setLinkResult] = useState<CallResult>(DEFAULT_RESULT);
  const [publishResult, setPublishResult] = useState<CallResult>(DEFAULT_RESULT);

  const roleHint = useMemo(
    () => (role === "admin" || role === "editor" ? "Valid role header" : "Role likely unauthorized"),
    [role],
  );

  async function onCreateEvent(e: FormEvent) {
    e.preventDefault();
    setEventResult({ status: "loading", message: "Creating event..." });
    try {
      const payload = await callApi<{ data: { id: string } }>("/api/v1/admin/events", "POST", role, {
        title: eventForm.title,
        event_date: eventForm.event_date,
        region: eventForm.region,
        category: eventForm.category,
        summary: eventForm.summary,
        impact: eventForm.impact,
        importance_score: Number.parseInt(eventForm.importance_score, 10),
        confidence_score: Number.parseInt(eventForm.confidence_score, 10),
        slug: eventForm.slug || undefined,
      });
      const eventId = payload?.data?.id;
      if (eventId) {
        setLinkForm((prev) => ({ ...prev, event_id: eventId }));
        setPublishEventId(eventId);
      }
      setEventResult({ status: "success", message: "Event created", payload });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Create event failed";
      setEventResult({ status: "error", message });
    }
  }

  async function onCreateSource(e: FormEvent) {
    e.preventDefault();
    setSourceResult({ status: "loading", message: "Creating source..." });
    try {
      const payload = await callApi<{ data: { id: string } }>("/api/v1/admin/sources", "POST", role, {
        source_name: sourceForm.source_name,
        source_url: sourceForm.source_url,
        source_type: sourceForm.source_type,
        publisher: sourceForm.publisher || undefined,
        publication_or_snapshot_date: sourceForm.publication_or_snapshot_date || undefined,
        access_date: sourceForm.access_date || undefined,
      });
      const sourceId = payload?.data?.id;
      if (sourceId) {
        setLinkForm((prev) => ({ ...prev, source_id: sourceId }));
      }
      setSourceResult({ status: "success", message: "Source created", payload });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Create source failed";
      setSourceResult({ status: "error", message });
    }
  }

  async function onLinkSource(e: FormEvent) {
    e.preventDefault();
    setLinkResult({ status: "loading", message: "Linking source..." });
    try {
      if (!linkForm.event_id || !linkForm.source_id) {
        throw new Error("event_id and source_id are required");
      }

      const payload = await callApi(
        `/api/v1/admin/events/${linkForm.event_id}/sources/${linkForm.source_id}`,
        "POST",
        role,
        {
          relevance_rank: Number.parseInt(linkForm.relevance_rank, 10),
          citation_note: linkForm.citation_note || undefined,
          quote_excerpt: linkForm.quote_excerpt || undefined,
        },
      );
      setLinkResult({ status: "success", message: "Source linked to event", payload });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Link source failed";
      setLinkResult({ status: "error", message });
    }
  }

  async function onPublishEvent(e: FormEvent) {
    e.preventDefault();
    setPublishResult({ status: "loading", message: "Publishing event..." });
    try {
      if (!publishEventId) throw new Error("event_id is required");
      const payload = await callApi(`/api/v1/admin/events/${publishEventId}/publish`, "POST", role);
      setPublishResult({ status: "success", message: "Event published", payload });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Publish failed";
      setPublishResult({ status: "error", message });
    }
  }

  return (
    <section className="admin-grid">
      <article className="card form-card">
        <h2>Create Event (Draft)</h2>
        <p className="muted">This calls POST /api/v1/admin/events.</p>
        <form className="form-stack" onSubmit={onCreateEvent}>
          <label className="field">
            <span>Role Header</span>
            <input className="input" value={role} onChange={(e) => setRole(e.target.value)} />
            <small className="hint">{roleHint}</small>
          </label>
          <label className="field">
            <span>Title</span>
            <input
              className="input"
              required
              value={eventForm.title}
              onChange={(e) => setEventForm((p) => ({ ...p, title: e.target.value }))}
            />
          </label>
          <label className="field">
            <span>Slug (optional)</span>
            <input
              className="input"
              value={eventForm.slug}
              onChange={(e) => setEventForm((p) => ({ ...p, slug: e.target.value }))}
            />
          </label>
          <div className="two-col">
            <label className="field">
              <span>Date</span>
              <input
                className="input"
                type="date"
                required
                value={eventForm.event_date}
                onChange={(e) => setEventForm((p) => ({ ...p, event_date: e.target.value }))}
              />
            </label>
            <label className="field">
              <span>Region</span>
              <input
                className="input"
                required
                value={eventForm.region}
                onChange={(e) => setEventForm((p) => ({ ...p, region: e.target.value }))}
              />
            </label>
          </div>
          <label className="field">
            <span>Category</span>
            <input
              className="input"
              required
              value={eventForm.category}
              onChange={(e) => setEventForm((p) => ({ ...p, category: e.target.value }))}
            />
          </label>
          <label className="field">
            <span>Summary</span>
            <textarea
              className="textarea"
              required
              rows={3}
              value={eventForm.summary}
              onChange={(e) => setEventForm((p) => ({ ...p, summary: e.target.value }))}
            />
          </label>
          <label className="field">
            <span>Impact</span>
            <textarea
              className="textarea"
              required
              rows={3}
              value={eventForm.impact}
              onChange={(e) => setEventForm((p) => ({ ...p, impact: e.target.value }))}
            />
          </label>
          <div className="two-col">
            <label className="field">
              <span>Importance (1-5)</span>
              <input
                className="input"
                required
                min={1}
                max={5}
                type="number"
                value={eventForm.importance_score}
                onChange={(e) => setEventForm((p) => ({ ...p, importance_score: e.target.value }))}
              />
            </label>
            <label className="field">
              <span>Confidence (1-5)</span>
              <input
                className="input"
                required
                min={1}
                max={5}
                type="number"
                value={eventForm.confidence_score}
                onChange={(e) => setEventForm((p) => ({ ...p, confidence_score: e.target.value }))}
              />
            </label>
          </div>
          <button className="btn" type="submit" disabled={eventResult.status === "loading"}>
            {eventResult.status === "loading" ? "Creating..." : "Create Event"}
          </button>
        </form>
        <ResultView result={eventResult} />
      </article>

      <article className="card form-card">
        <h2>Create Source</h2>
        <p className="muted">This calls POST /api/v1/admin/sources.</p>
        <form className="form-stack" onSubmit={onCreateSource}>
          <label className="field">
            <span>Source Name</span>
            <input
              className="input"
              required
              value={sourceForm.source_name}
              onChange={(e) => setSourceForm((p) => ({ ...p, source_name: e.target.value }))}
            />
          </label>
          <label className="field">
            <span>Source URL</span>
            <input
              className="input"
              required
              type="url"
              value={sourceForm.source_url}
              onChange={(e) => setSourceForm((p) => ({ ...p, source_url: e.target.value }))}
            />
          </label>
          <div className="two-col">
            <label className="field">
              <span>Source Type</span>
              <select
                className="input"
                value={sourceForm.source_type}
                onChange={(e) => setSourceForm((p) => ({ ...p, source_type: e.target.value }))}
              >
                <option value="archive">archive</option>
                <option value="official">official</option>
                <option value="news">news</option>
                <option value="research">research</option>
                <option value="dataset">dataset</option>
                <option value="other">other</option>
              </select>
            </label>
            <label className="field">
              <span>Access Date</span>
              <input
                className="input"
                type="date"
                value={sourceForm.access_date}
                onChange={(e) => setSourceForm((p) => ({ ...p, access_date: e.target.value }))}
              />
            </label>
          </div>
          <label className="field">
            <span>Publisher</span>
            <input
              className="input"
              value={sourceForm.publisher}
              onChange={(e) => setSourceForm((p) => ({ ...p, publisher: e.target.value }))}
            />
          </label>
          <label className="field">
            <span>Publication/Snapshot Datetime (optional)</span>
            <input
              className="input"
              type="datetime-local"
              value={sourceForm.publication_or_snapshot_date}
              onChange={(e) =>
                setSourceForm((p) => ({ ...p, publication_or_snapshot_date: e.target.value }))
              }
            />
          </label>
          <button className="btn" type="submit" disabled={sourceResult.status === "loading"}>
            {sourceResult.status === "loading" ? "Creating..." : "Create Source"}
          </button>
        </form>
        <ResultView result={sourceResult} />
      </article>

      <article className="card form-card">
        <h2>Attach Source to Event</h2>
        <p className="muted">This calls POST /api/v1/admin/events/:id/sources/:sourceId.</p>
        <form className="form-stack" onSubmit={onLinkSource}>
          <label className="field">
            <span>Event ID</span>
            <input
              className="input"
              required
              value={linkForm.event_id}
              onChange={(e) => setLinkForm((p) => ({ ...p, event_id: e.target.value }))}
            />
          </label>
          <label className="field">
            <span>Source ID</span>
            <input
              className="input"
              required
              value={linkForm.source_id}
              onChange={(e) => setLinkForm((p) => ({ ...p, source_id: e.target.value }))}
            />
          </label>
          <label className="field">
            <span>Relevance Rank (1-10)</span>
            <input
              className="input"
              type="number"
              min={1}
              max={10}
              value={linkForm.relevance_rank}
              onChange={(e) => setLinkForm((p) => ({ ...p, relevance_rank: e.target.value }))}
            />
          </label>
          <label className="field">
            <span>Citation Note</span>
            <textarea
              className="textarea"
              rows={2}
              value={linkForm.citation_note}
              onChange={(e) => setLinkForm((p) => ({ ...p, citation_note: e.target.value }))}
            />
          </label>
          <label className="field">
            <span>Quote Excerpt</span>
            <textarea
              className="textarea"
              rows={2}
              value={linkForm.quote_excerpt}
              onChange={(e) => setLinkForm((p) => ({ ...p, quote_excerpt: e.target.value }))}
            />
          </label>
          <button className="btn" type="submit" disabled={linkResult.status === "loading"}>
            {linkResult.status === "loading" ? "Linking..." : "Attach Source"}
          </button>
        </form>
        <ResultView result={linkResult} />
      </article>

      <article className="card form-card">
        <h2>Publish Event</h2>
        <p className="muted">This calls POST /api/v1/admin/events/:id/publish.</p>
        <form className="form-stack" onSubmit={onPublishEvent}>
          <label className="field">
            <span>Event ID</span>
            <input
              className="input"
              required
              value={publishEventId}
              onChange={(e) => setPublishEventId(e.target.value)}
            />
          </label>
          <button className="btn" type="submit" disabled={publishResult.status === "loading"}>
            {publishResult.status === "loading" ? "Publishing..." : "Publish Event"}
          </button>
        </form>
        <ResultView result={publishResult} />
      </article>
    </section>
  );
}

function ResultView({ result }: { result: CallResult }) {
  if (result.status === "idle") return null;
  return (
    <div className={`callout callout-${result.status}`}>
      <strong>{result.message}</strong>
      {result.payload ? <pre className="code-block">{pretty(result.payload)}</pre> : null}
    </div>
  );
}
