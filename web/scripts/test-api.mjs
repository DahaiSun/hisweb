import assert from "node:assert/strict";
import { execSync, spawn } from "node:child_process";
import process from "node:process";

const TEST_PORT = Number.parseInt(process.env.API_TEST_PORT ?? "3210", 10);
const TEST_BASE_URL = `http://localhost:${TEST_PORT}`;
const START_TIMEOUT_MS = 90_000;
const POLL_INTERVAL_MS = 1_000;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function terminateProcessTree(child) {
  if (!child || child.killed) return;
  if (process.platform === "win32") {
    try {
      execSync(`taskkill /pid ${child.pid} /T /F`, { stdio: "ignore" });
    } catch {
      // ignore cleanup errors
    }
    return;
  }
  child.kill("SIGTERM");
}

async function waitForServer(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.status < 500) return;
    } catch {
      // keep polling
    }
    await delay(POLL_INTERVAL_MS);
  }
  throw new Error(`Server did not become ready: ${url}`);
}

async function getJson(url) {
  const response = await fetch(url, { headers: { accept: "application/json" } });
  const payload = await response.json();
  return { response, payload };
}

async function run() {
  const command =
    process.platform === "win32"
      ? `npm.cmd run dev -- --port ${TEST_PORT}`
      : `npm run dev -- --port ${TEST_PORT}`;

  const child = spawn(command, {
    cwd: process.cwd(),
    env: { ...process.env, NODE_ENV: "development" },
    shell: true,
    stdio: ["ignore", "pipe", "pipe"],
  });

  let lastOutput = "";
  const onOutput = (chunk) => {
    const text = chunk.toString();
    lastOutput = `${lastOutput}\n${text}`.slice(-5000);
  };
  child.stdout.on("data", onOutput);
  child.stderr.on("data", onOutput);

  try {
    await waitForServer(`${TEST_BASE_URL}/api/v1/events`, START_TIMEOUT_MS);

    const eventsRes = await getJson(`${TEST_BASE_URL}/api/v1/events`);
    assert.equal(eventsRes.response.status, 200, "events endpoint should return 200");
    assert.ok(Array.isArray(eventsRes.payload.data.items), "events payload should contain items");
    assert.ok(eventsRes.payload.data.items.length > 0, "events payload should not be empty");

    const sampleSlug = eventsRes.payload.data.items[0].slug;
    assert.ok(sampleSlug, "sample event slug should exist");

    const eventDetailRes = await getJson(`${TEST_BASE_URL}/api/v1/events/${sampleSlug}`);
    assert.equal(eventDetailRes.response.status, 200, "event detail endpoint should return 200");
    assert.equal(
      eventDetailRes.payload.data.slug,
      sampleSlug,
      "event detail should match requested slug",
    );

    const timelinesRes = await getJson(`${TEST_BASE_URL}/api/v1/timelines`);
    assert.equal(timelinesRes.response.status, 200, "timelines endpoint should return 200");
    assert.ok(Array.isArray(timelinesRes.payload.data.items), "timelines payload should contain items");

    const calendarRes = await getJson(`${TEST_BASE_URL}/api/v1/calendar/09-15`);
    assert.equal(calendarRes.response.status, 200, "calendar endpoint should return 200");
    assert.ok(Array.isArray(calendarRes.payload.data.items), "calendar payload should contain items");

    const sourceId = eventDetailRes.payload.data.sources?.[0]?.id;
    if (sourceId) {
      const sourceRes = await getJson(`${TEST_BASE_URL}/api/v1/sources/${sourceId}`);
      assert.equal(sourceRes.response.status, 200, "source endpoint should return 200");
      assert.equal(sourceRes.payload.data.id, sourceId, "source detail should match requested id");
    }

    console.log("[test:api] passed");
  } catch (error) {
    console.error("[test:api] failed");
    console.error(error);
    console.error("[test:api] last server output:\n", lastOutput);
    process.exitCode = 1;
  } finally {
    terminateProcessTree(child);
    await delay(800);
    if (!child.killed && process.platform !== "win32") {
      child.kill("SIGKILL");
    }
  }
}

run().catch((error) => {
  console.error("[test:api] unexpected error", error);
  process.exitCode = 1;
});
