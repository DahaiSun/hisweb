import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const MONTHS = [
  "01",
  "02",
  "03",
  "04",
  "05",
  "06",
  "07",
  "08",
  "09",
  "10",
  "11",
  "12",
];

function parseArgs(argv) {
  const nowYear = new Date().getUTCFullYear();
  const args = {
    file: "seeds/financial-history.seed.json",
    year: nowYear,
    status: "published",
  };

  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--file" && argv[i + 1]) {
      args.file = argv[i + 1];
      i += 1;
      continue;
    }
    if (token === "--year" && argv[i + 1]) {
      const year = Number.parseInt(argv[i + 1], 10);
      if (Number.isFinite(year) && year >= 1000 && year <= 9999) {
        args.year = year;
      }
      i += 1;
      continue;
    }
    if (token === "--status" && argv[i + 1]) {
      args.status = String(argv[i + 1]).trim().toLowerCase();
      i += 1;
      continue;
    }
    if (token === "--all-status") {
      args.status = "";
      continue;
    }
  }

  return args;
}

function isValidDateString(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function getMonthCounts(events, year, statusFilter) {
  const monthCounts = new Map(MONTHS.map((month) => [month, 0]));
  const invalidRows = [];
  let matchedEvents = 0;

  for (const event of events) {
    const date = event?.event_date;
    const status = typeof event?.status === "string" ? event.status.toLowerCase() : "";
    if (statusFilter && status !== statusFilter) continue;

    if (typeof date !== "string" || !isValidDateString(date)) {
      invalidRows.push(event?.slug ?? "<unknown-slug>");
      continue;
    }

    if (!date.startsWith(`${year}-`)) continue;
    const month = date.slice(5, 7);
    if (!monthCounts.has(month)) {
      invalidRows.push(event?.slug ?? "<unknown-slug>");
      continue;
    }

    monthCounts.set(month, (monthCounts.get(month) ?? 0) + 1);
    matchedEvents += 1;
  }

  return { monthCounts, invalidRows, matchedEvents };
}

async function main() {
  const args = parseArgs(process.argv);
  const filePath = path.resolve(process.cwd(), args.file);
  const fileContent = await fs.readFile(filePath, "utf8");
  const payload = JSON.parse(fileContent);
  const events = Array.isArray(payload.events) ? payload.events : [];

  const { monthCounts, invalidRows, matchedEvents } = getMonthCounts(
    events,
    args.year,
    args.status,
  );

  const missingMonths = MONTHS.filter((month) => (monthCounts.get(month) ?? 0) === 0);

  console.log("[coverage] file:", filePath);
  console.log("[coverage] year:", args.year);
  console.log("[coverage] status:", args.status || "all");
  console.log("[coverage] matched events:", matchedEvents);
  console.log("[coverage] month counts:");
  for (const month of MONTHS) {
    const count = monthCounts.get(month) ?? 0;
    console.log(`  ${args.year}-${month}: ${count}`);
  }

  if (invalidRows.length > 0) {
    console.log("[coverage] invalid event rows detected:", invalidRows.length);
  }

  if (missingMonths.length > 0) {
    console.error("[coverage] FAILED: missing months:", missingMonths.join(", "));
    process.exitCode = 1;
    return;
  }

  console.log("[coverage] PASSED: every month has at least one event.");
}

main().catch((error) => {
  console.error("[coverage] unexpected error:", error);
  process.exitCode = 1;
});

