import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

function parseArgs(argv) {
  const args = {
    file: "seeds/financial-history.seed.json",
    dryRun: false,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--dry-run") {
      args.dryRun = true;
      continue;
    }
    if (token === "--file" && argv[i + 1]) {
      args.file = argv[i + 1];
      i += 1;
    }
  }

  return args;
}

function summarize(payload) {
  return {
    sources: Array.isArray(payload.sources) ? payload.sources.length : 0,
    events: Array.isArray(payload.events) ? payload.events.length : 0,
    event_sources: Array.isArray(payload.event_sources) ? payload.event_sources.length : 0,
  };
}

function asArray(input) {
  return Array.isArray(input) ? input : [];
}

function mergeByKey(baseItems, incomingItems, keyOf) {
  const map = new Map();
  for (const item of baseItems) map.set(keyOf(item), item);
  for (const item of incomingItems) map.set(keyOf(item), item);
  return [...map.values()];
}

function isDbUnavailable(parsed, status) {
  if (status !== 503) return false;
  const code = parsed?.error?.code;
  const message = `${parsed?.error?.message ?? ""} ${parsed?.error?.details?.original_message ?? ""}`;
  return code === "SERVICE_UNAVAILABLE" && /DATABASE_URL is not set/i.test(message);
}

async function applyDemoFallback({ cwd, filePath, payload }) {
  const mainSeedPath = path.resolve(cwd, "seeds/financial-history.seed.json");
  const isMainSeed = path.normalize(filePath) === path.normalize(mainSeedPath);

  if (isMainSeed) {
    return {
      mode: "main-seed-noop",
      target: mainSeedPath,
      stats: summarize(payload),
    };
  }

  const mainContent = await fs.readFile(mainSeedPath, "utf8");
  const mainPayload = JSON.parse(mainContent);

  const before = summarize(mainPayload);

  mainPayload.sources = mergeByKey(
    asArray(mainPayload.sources),
    asArray(payload.sources),
    (item) => String(item?.source_url ?? "").trim(),
  );

  mainPayload.events = mergeByKey(
    asArray(mainPayload.events),
    asArray(payload.events),
    (item) => String(item?.slug ?? "").trim(),
  );

  mainPayload.event_sources = mergeByKey(
    asArray(mainPayload.event_sources),
    asArray(payload.event_sources),
    (item) =>
      `${String(item?.event_slug ?? "").trim()}||${String(item?.source_url ?? "").trim()}`,
  );

  const after = summarize(mainPayload);

  await fs.writeFile(mainSeedPath, `${JSON.stringify(mainPayload, null, 2)}\n`, "utf8");

  return {
    mode: "merged-into-main-seed",
    target: mainSeedPath,
    from_file: filePath,
    before,
    after,
    delta: {
      sources: after.sources - before.sources,
      events: after.events - before.events,
      event_sources: after.event_sources - before.event_sources,
    },
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const cwd = process.cwd();
  const filePath = path.resolve(cwd, args.file);

  const fileContent = await fs.readFile(filePath, "utf8");
  const payload = JSON.parse(fileContent);
  const stats = summarize(payload);

  console.log("[seed] file:", filePath);
  console.log("[seed] stats:", stats);

  if (args.dryRun) {
    console.log("[seed] dry run complete (no API call).");
    return;
  }

  const baseUrl = process.env.SEED_API_BASE_URL ?? "http://localhost:3000";
  const serviceToken = process.env.SERVICE_TOKEN ?? "local-dev-seed";
  const endpoint = `${baseUrl.replace(/\/+$/, "")}/api/v1/internal/ingestion/import`;

  console.log("[seed] POST", endpoint);

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-service-token": serviceToken,
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = { raw: text };
  }

  if (!response.ok) {
    if (isDbUnavailable(parsed, response.status)) {
      const fallback = await applyDemoFallback({ cwd, filePath, payload });
      console.warn("[seed] database unavailable; applied demo fallback:", fallback);
      return;
    }

    console.error("[seed] import failed:", response.status, parsed);
    process.exitCode = 1;
    return;
  }

  console.log("[seed] import success:", parsed);
}

main().catch((error) => {
  console.error("[seed] unexpected error:", error);
  process.exitCode = 1;
});
