import Link from "next/link";
import type { CSSProperties } from "react";
import { listPublishedEvents, type EventListItem } from "@/lib/events";
import { formatEventDate } from "@/lib/format";
import {
  getTimelineBySlug,
  listTimelinesPublic,
  type TimelineEventItem,
  type TimelineListItem,
} from "@/lib/timelines";
import { DragScroll } from "./drag-scroll";

export const dynamic = "force-dynamic";

type MonthCell = {
  serial: number;
  year: number;
  month: number;
  daysInMonth: number;
};

type PositionedEvent = {
  event: EventListItem;
  leftPx: number;
  widthPx: number;
  topRem: number;
  shortTitle: string;
};

type EraDef = {
  key: string;
  label: string;
  start: string;
  end: string;
  tone:
    | "ww1"
    | "ww2"
    | "cold-war"
    | "macro-crisis"
    | "monetary-order"
    | "decolonization"
    | "china-reform"
    | "globalization"
    | "security-cycle"
    | "geo-competition"
    | "inflation-cycle"
    | "energy-transition";
};

type PositionedEra = {
  key: string;
  label: string;
  start: string;
  end: string;
  tone: EraDef["tone"];
  leftPx: number;
  widthPx: number;
  lane: number;
};

const MAX_EVENTS = 5000;
const MONTH_WIDTH_PX = 118;
const AXIS_SIDE_PADDING_PX = 40;
const MIN_CANVAS_WIDTH_PX = 1480;
const CHIP_MIN_WIDTH_PX = 122;
const CHIP_MAX_WIDTH_PX = 236;
const CHIP_CHAR_WIDTH_PX = 7;
const CHIP_TITLE_MAX_CHARS = 64;
const LANE_STEP_REM = 4.1;
const LANE_OFFSET_REM = 0.25;
const TOP_BASE_REM = 0.9;
const ERA_BASE_OFFSET_REM = 4.0;
const ERA_LANE_STEP_REM = 2.0;
const ERA_BLOCK_HEIGHT_REM = 1.55;
const ERA_LABEL_SPACING_PX = 980;
const ERA_LABEL_INSET_PX = 8;
const ERA_LABEL_WIDTH_PX = 236;

const ERA_BACKGROUND_BANDS: EraDef[] = [
  {
    key: "ww1",
    label: "World War I",
    start: "1914-07-28",
    end: "1918-11-11",
    tone: "ww1",
  },
  {
    key: "great-depression-new-deal",
    label: "Great Depression & New Deal",
    start: "1929-10-24",
    end: "1939-09-01",
    tone: "macro-crisis",
  },
  {
    key: "ww2",
    label: "World War II",
    start: "1939-09-01",
    end: "1945-09-02",
    tone: "ww2",
  },
  {
    key: "bretton-woods-system",
    label: "Bretton Woods System",
    start: "1944-07-01",
    end: "1971-08-15",
    tone: "monetary-order",
  },
  {
    key: "decolonization-wave",
    label: "Decolonization Wave",
    start: "1945-01-01",
    end: "1975-12-31",
    tone: "decolonization",
  },
  {
    key: "cold-war",
    label: "Cold War",
    start: "1947-03-12",
    end: "1991-12-26",
    tone: "cold-war",
  },
  {
    key: "china-reform-opening-up",
    label: "China Reform & Opening-up",
    start: "1978-12-18",
    end: "2100-12-31",
    tone: "china-reform",
  },
  {
    key: "globalization-offshoring",
    label: "Globalization & Offshoring",
    start: "1985-01-01",
    end: "2008-09-15",
    tone: "globalization",
  },
  {
    key: "war-on-terror-cycle",
    label: "War on Terror Cycle",
    start: "2001-09-11",
    end: "2021-08-30",
    tone: "security-cycle",
  },
  {
    key: "gfc-qe-era",
    label: "GFC & QE Era",
    start: "2008-09-15",
    end: "2021-12-31",
    tone: "macro-crisis",
  },
  {
    key: "energy-transition-acceleration",
    label: "Energy Transition Acceleration",
    start: "2015-12-12",
    end: "2100-12-31",
    tone: "energy-transition",
  },
  {
    key: "us-china-strategic-competition",
    label: "U.S.-China Strategic Competition",
    start: "2018-03-22",
    end: "2100-12-31",
    tone: "geo-competition",
  },
  {
    key: "post-pandemic-inflation-cycle",
    label: "Post-pandemic Inflation/High-rate Cycle",
    start: "2021-01-01",
    end: "2100-12-31",
    tone: "inflation-cycle",
  },
];

function normalizeSearchParam(value: string | string[] | undefined) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (Array.isArray(value) && typeof value[0] === "string") {
    const trimmed = value[0].trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  return null;
}

function mapTimelineEventToListItem(event: TimelineEventItem): EventListItem {
  return {
    id: event.id,
    slug: event.slug,
    title: event.title,
    event_date: event.event_date,
    region: event.region,
    category: event.category,
    summary: event.summary,
    importance_score: event.importance_score,
    confidence_score: event.confidence_score,
    source_count: 0,
    tags: [],
  };
}

function toMonthSerial(date: string) {
  const year = Number.parseInt(date.slice(0, 4), 10);
  const month = Number.parseInt(date.slice(5, 7), 10);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return null;
  }
  return year * 12 + (month - 1);
}

function fromMonthSerial(serial: number) {
  const year = Math.floor(serial / 12);
  const month = (serial % 12) + 1;
  return { year, month };
}

function buildMonthWindow(startSerial: number, span: number): MonthCell[] {
  return Array.from({ length: span }, (_, idx) => {
    const serial = startSerial + idx;
    const { year, month } = fromMonthSerial(serial);
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return {
      serial,
      year,
      month,
      daysInMonth,
    };
  });
}

function buildMonthSpan(events: EventListItem[]) {
  const serials = events
    .map((entry) => toMonthSerial(entry.event_date))
    .filter((entry): entry is number => entry !== null);

  if (serials.length === 0) return null;

  const minSerial = Math.min(...serials);
  const maxSerial = Math.max(...serials);
  return buildMonthWindow(minSerial, maxSerial - minSerial + 1);
}

function shortTitle(input: string) {
  const compact = input.replace(/\s+/g, " ").trim();
  if (compact.length <= CHIP_TITLE_MAX_CHARS) return compact;
  return `${compact.slice(0, CHIP_TITLE_MAX_CHARS - 3).trimEnd()}...`;
}

function layoutEvents(events: EventListItem[], months: MonthCell[]) {
  const monthIndexBySerial = new Map<number, number>();
  months.forEach((month, idx) => monthIndexBySerial.set(month.serial, idx));

  const sorted = [...events].sort((a, b) => {
    if (a.event_date !== b.event_date) return a.event_date.localeCompare(b.event_date);
    return a.title.localeCompare(b.title);
  });

  const laneRightEdges: number[] = [];
  const positioned: PositionedEvent[] = [];

  for (const event of sorted) {
    const serial = toMonthSerial(event.event_date);
    if (serial === null) continue;

    const monthIndex = monthIndexBySerial.get(serial);
    if (monthIndex === undefined) continue;

    const day = Number.parseInt(event.event_date.slice(8, 10), 10);
    const month = months[monthIndex];
    const boundedDay = Number.isFinite(day) ? Math.max(1, Math.min(day, month.daysInMonth)) : 15;
    const dayRatio = (boundedDay - 0.5) / month.daysInMonth;

    const compactTitle = shortTitle(event.title);
    const widthPx = Math.min(
      CHIP_MAX_WIDTH_PX,
      Math.max(CHIP_MIN_WIDTH_PX, compactTitle.length * CHIP_CHAR_WIDTH_PX + 30),
    );

    const centerX = AXIS_SIDE_PADDING_PX + (monthIndex + dayRatio) * MONTH_WIDTH_PX;

    const startX = centerX - widthPx / 2;
    let lane = 0;
    while (lane < laneRightEdges.length && startX - laneRightEdges[lane] < 14) {
      lane += 1;
    }
    if (lane === laneRightEdges.length) laneRightEdges.push(-999);
    laneRightEdges[lane] = centerX + widthPx / 2;

    const topRem = TOP_BASE_REM + lane * LANE_STEP_REM + (monthIndex % 2 === 0 ? 0 : LANE_OFFSET_REM);

    positioned.push({
      event,
      leftPx: centerX,
      widthPx,
      topRem,
      shortTitle: compactTitle,
    });
  }

  return {
    positioned,
    laneCount: laneRightEdges.length,
  };
}

function monthCenterPx(index: number) {
  return AXIS_SIDE_PADDING_PX + (index + 0.5) * MONTH_WIDTH_PX;
}

function shouldShowMonthTick(index: number, month: MonthCell, totalMonths: number) {
  if (index === 0 || month.month === 1) return true;
  if (totalMonths <= 24) return true;
  if (totalMonths <= 72) return index % 2 === 0;
  if (totalMonths <= 180) return index % 3 === 0;
  if (totalMonths <= 360) return index % 4 === 0;
  return index % 6 === 0;
}

function formatMonthLabel(month: MonthCell) {
  const date = new Date(Date.UTC(month.year, month.month - 1, 1));
  return date.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatEraYearRange(start: string, end: string) {
  const startYear = start.slice(0, 4);
  const endYear = end.slice(0, 4);
  if (endYear === "2100") return `${startYear}-now`;
  if (startYear === endYear) return startYear;
  return `${startYear}-${endYear}`;
}

function buildEraLabelOffsets(widthPx: number) {
  const maxStart = Math.max(ERA_LABEL_INSET_PX, widthPx - ERA_LABEL_WIDTH_PX - ERA_LABEL_INSET_PX);
  const offsets: number[] = [];

  for (let x = ERA_LABEL_INSET_PX; x <= maxStart; x += ERA_LABEL_SPACING_PX) {
    offsets.push(x);
  }

  if (offsets.length === 0) {
    offsets.push(ERA_LABEL_INSET_PX);
    return offsets;
  }

  const tailGap = maxStart - offsets[offsets.length - 1];
  if (tailGap > ERA_LABEL_SPACING_PX * 0.42) {
    offsets.push(maxStart);
  }

  return offsets;
}

function layoutEraBands(months: MonthCell[]) {
  if (months.length === 0) {
    return {
      positioned: [] as PositionedEra[],
      laneCount: 0,
    };
  }

  const rangeStartSerial = months[0].serial;
  const rangeEndSerial = months[months.length - 1].serial;
  const laneRightEdges: number[] = [];
  const positioned: PositionedEra[] = [];

  for (const era of ERA_BACKGROUND_BANDS) {
    const eraStartSerial = toMonthSerial(era.start);
    const eraEndSerial = toMonthSerial(era.end);
    if (eraStartSerial === null || eraEndSerial === null) continue;

    const visibleStart = Math.max(eraStartSerial, rangeStartSerial);
    const visibleEnd = Math.min(eraEndSerial, rangeEndSerial);
    if (visibleStart > visibleEnd) continue;

    const startIdx = visibleStart - rangeStartSerial;
    const visibleSpan = visibleEnd - visibleStart + 1;
    const leftPx = AXIS_SIDE_PADDING_PX + startIdx * MONTH_WIDTH_PX + 2;
    const widthPx = Math.max(88, visibleSpan * MONTH_WIDTH_PX - 4);

    let lane = 0;
    while (lane < laneRightEdges.length && leftPx - laneRightEdges[lane] < 12) {
      lane += 1;
    }
    if (lane === laneRightEdges.length) laneRightEdges.push(-999);
    laneRightEdges[lane] = leftPx + widthPx;

    positioned.push({
      key: era.key,
      label: era.label,
      start: era.start,
      end: era.end,
      tone: era.tone,
      leftPx,
      widthPx,
      lane,
    });
  }

  return {
    positioned,
    laneCount: laneRightEdges.length,
  };
}

export default async function EventStreamPage({
  searchParams,
}: {
  searchParams: Promise<{ timeline?: string | string[] }>;
}) {
  const query = await searchParams;
  let timelines: TimelineListItem[] = [];
  let timelineWarning: string | null = null;
  try {
    timelines = await listTimelinesPublic();
  } catch {
    timelines = [];
    timelineWarning = "Timeline filter is temporarily unavailable. Showing events only.";
  }
  const selectedTimelineSlug = normalizeSearchParam(query.timeline);

  let allEvents: EventListItem[] = [];
  let selectedTimeline: TimelineListItem | null = null;

  if (selectedTimelineSlug) {
    try {
      const timeline = await getTimelineBySlug(selectedTimelineSlug);
      if (timeline) {
        allEvents = timeline.events.map(mapTimelineEventToListItem);
        selectedTimeline =
          timelines.find((entry) => entry.slug === selectedTimelineSlug) ?? {
            id: timeline.id,
            slug: timeline.slug,
            title: timeline.title,
            description: timeline.description,
            event_count: timeline.events.length,
            first_event_date: timeline.events[0]?.event_date ?? null,
            last_event_date: timeline.events[timeline.events.length - 1]?.event_date ?? null,
          };
      } else {
        timelineWarning = `Timeline '${selectedTimelineSlug}' not found. Showing all events.`;
      }
    } catch {
      timelineWarning = `Failed to load timeline '${selectedTimelineSlug}'. Showing all events.`;
    }
  }

  if (allEvents.length === 0 && !selectedTimeline) {
    const result = await listPublishedEvents({
      page: 1,
      pageSize: MAX_EVENTS,
      sort: "date_asc",
      date: null,
      from: null,
      to: null,
      category: null,
      region: null,
      tag: null,
      importanceMin: null,
      q: null,
    });
    allEvents = result.items;
  }

  const timelineOptions = timelines
    .filter((entry) => entry.event_count > 0)
    .sort((a, b) => a.title.localeCompare(b.title));

  const months = buildMonthSpan(allEvents);

  if (!months) {
    return (
      <div className="page-block stack">
        <section className="hero">
          <span className="eyebrow">Event Stream</span>
          <h1>Event Tag Timeline</h1>
          <p>No published events found for the current filter.</p>
          <form className="event-stream-filter" method="get" action="/events/stream">
            <label className="event-stream-filter-label" htmlFor="timeline-filter-empty">
              Filter by timeline
            </label>
            <div className="event-stream-filter-controls">
              <select
                className="input"
                id="timeline-filter-empty"
                name="timeline"
                defaultValue={selectedTimelineSlug ?? ""}
              >
                <option value="">All events</option>
                {timelineOptions.map((timeline) => (
                  <option key={timeline.id} value={timeline.slug}>
                    {timeline.title}
                  </option>
                ))}
              </select>
              <button type="submit" className="btn">
                Apply
              </button>
              {selectedTimelineSlug ? (
                <Link href="/events/stream" className="btn btn-ghost">
                  Clear
                </Link>
              ) : null}
            </div>
          </form>
        </section>
      </div>
    );
  }

  const { positioned, laneCount } = layoutEvents(allEvents, months);
  const { positioned: eraBands, laneCount: eraLaneCount } = layoutEraBands(months);
  const axisYRem = Math.max(8, 1.1 + laneCount * LANE_STEP_REM + 0.9);
  const eraBottomRem =
    eraBands.length > 0
      ? axisYRem + ERA_BASE_OFFSET_REM + (eraLaneCount - 1) * ERA_LANE_STEP_REM + ERA_BLOCK_HEIGHT_REM + 1.2
      : 0;
  const streamHeightRem = Math.max(axisYRem + 5.4, eraBottomRem);
  const streamWidthPx = Math.max(
    MIN_CANVAS_WIDTH_PX,
    AXIS_SIDE_PADDING_PX * 2 + months.length * MONTH_WIDTH_PX,
  );

  const styleVars = {
    "--stream-axis-y": `${axisYRem}rem`,
    "--stream-height": `${streamHeightRem}rem`,
    "--stream-width": `${streamWidthPx}px`,
  } as CSSProperties;

  return (
    <div className="page-block stack">
      <Link href="/timelines" className="back-link">
        {"<- Back to timelines"}
      </Link>

      <section className="hero event-stream-hero">
        <span className="eyebrow">Event Stream</span>
        <h1>Tag Timeline</h1>
        <form className="event-stream-filter" method="get" action="/events/stream">
          <label className="event-stream-filter-label" htmlFor="timeline-filter">
            Filter by timeline
          </label>
          <div className="event-stream-filter-controls">
            <select
              className="input"
              id="timeline-filter"
              name="timeline"
              defaultValue={selectedTimelineSlug ?? ""}
            >
              <option value="">All events</option>
              {timelineOptions.map((timeline) => (
                <option key={timeline.id} value={timeline.slug}>
                  {timeline.title}
                </option>
              ))}
            </select>
            <button type="submit" className="btn">
              Apply
            </button>
            {selectedTimelineSlug ? (
              <Link href="/events/stream" className="btn btn-ghost">
                Clear
              </Link>
            ) : null}
          </div>
        </form>
        <div className="stats-row">
          <span className="pill">{allEvents.length} events in view</span>
          <span className="pill">
            {formatMonthLabel(months[0])} to {formatMonthLabel(months[months.length - 1])}
          </span>
          {selectedTimeline ? (
            <span className="pill">Timeline: {selectedTimeline.title}</span>
          ) : (
            <span className="pill">Timeline: all events</span>
          )}
          <span className="pill">Colored bands below axis = long-run background cycles</span>
          {timelineWarning ? <span className="pill">{timelineWarning}</span> : null}
        </div>
      </section>

      <section className="card event-stream-card">
        <DragScroll className="event-stream-scroll" initialPosition="end">
          <div className="event-stream-canvas" style={styleVars}>
            {positioned.map((item) => (
              <Link
                key={item.event.id}
                href={`/events/${item.event.slug}`}
                className="event-chip"
                style={{
                  left: `${item.leftPx}px`,
                  top: `${item.topRem}rem`,
                  width: `${item.widthPx}px`,
                }}
                title={`${item.event.title} (${formatEventDate(item.event.event_date)})`}
              >
                <span className="event-chip-title">{item.shortTitle}</span>
                <span className="event-chip-date">{item.event.event_date.slice(5)}</span>
              </Link>
            ))}

            <div className="event-stream-axis" />

            {months.map((month, idx) => {
              if (!shouldShowMonthTick(idx, month, months.length)) return null;
              return (
                <div
                  className="event-stream-tick"
                  key={`${month.year}-${month.month}`}
                  style={{ left: `${monthCenterPx(idx)}px` }}
                >
                  <span className="event-stream-tick-month">{month.month}</span>
                  <span className="event-stream-tick-year">{month.year}</span>
                </div>
              );
            })}

            {eraBands.length > 0 ? (
              <>
                <span
                  className="event-stream-era-caption"
                  style={{ left: `${AXIS_SIDE_PADDING_PX + 4}px`, top: `${axisYRem + 3.25}rem` }}
                >
                  Long-Run Background
                </span>
                {eraBands.map((era) => (
                  <div key={era.key}>
                    <span
                      className={`event-stream-era event-stream-era-${era.tone}`}
                      style={{
                        left: `${era.leftPx}px`,
                        width: `${era.widthPx}px`,
                        top: `${axisYRem + ERA_BASE_OFFSET_REM + era.lane * ERA_LANE_STEP_REM}rem`,
                      }}
                      title={`${era.label}: ${era.start} to ${era.end}`}
                    />
                    {buildEraLabelOffsets(era.widthPx).map((offset, idx) => (
                      <span
                        key={`${era.key}-label-${idx}`}
                        className={`event-stream-era-badge event-stream-era-${era.tone}`}
                        style={{
                          left: `${era.leftPx + offset}px`,
                          top: `${axisYRem + ERA_BASE_OFFSET_REM + era.lane * ERA_LANE_STEP_REM + ERA_BLOCK_HEIGHT_REM / 2}rem`,
                        }}
                        title={`${era.label} (${formatEraYearRange(era.start, era.end)})`}
                      >
                        {era.label} · {formatEraYearRange(era.start, era.end)}
                      </span>
                    ))}
                  </div>
                ))}
              </>
            ) : null}
          </div>
        </DragScroll>
      </section>
    </div>
  );
}
