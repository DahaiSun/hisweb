import { NextResponse } from "next/server";
import { isDatabaseUnavailableMessage } from "@/lib/runtime";

export function ok(data: unknown, status = 200) {
  return NextResponse.json({ data }, { status });
}

export function created(data: unknown) {
  return NextResponse.json({ data }, { status: 201 });
}

export function badRequest(message: string, details?: Record<string, unknown>) {
  return NextResponse.json(
    { error: { code: "VALIDATION_ERROR", message, details: details ?? {} } },
    { status: 400 },
  );
}

export function unauthorized(message = "Unauthorized") {
  return NextResponse.json(
    { error: { code: "UNAUTHORIZED", message, details: {} } },
    { status: 401 },
  );
}

export function forbidden(message = "Forbidden") {
  return NextResponse.json(
    { error: { code: "FORBIDDEN", message, details: {} } },
    { status: 403 },
  );
}

export function notFound(message = "Not found") {
  return NextResponse.json(
    { error: { code: "NOT_FOUND", message, details: {} } },
    { status: 404 },
  );
}

export function notImplemented(message = "Not implemented") {
  return NextResponse.json(
    { error: { code: "NOT_IMPLEMENTED", message, details: {} } },
    { status: 501 },
  );
}

export function conflict(message = "Conflict") {
  return NextResponse.json(
    { error: { code: "CONFLICT", message, details: {} } },
    { status: 409 },
  );
}

export function serverError(message = "Internal server error") {
  if (isDatabaseUnavailableMessage(message)) {
    return NextResponse.json(
      {
        error: {
          code: "SERVICE_UNAVAILABLE",
          message: "Database is unavailable. Configure DATABASE_URL or run demo mode.",
          details: { original_message: message },
        },
      },
      { status: 503 },
    );
  }

  return NextResponse.json(
    { error: { code: "INTERNAL_ERROR", message, details: {} } },
    { status: 500 },
  );
}

export function requireAdmin(req: Request) {
  const role = req.headers.get("x-role");
  if (!role) return unauthorized("Missing x-role header");
  if (role !== "admin" && role !== "editor") {
    return forbidden("Admin or editor role required");
  }
  return null;
}

export function requireServiceToken(req: Request) {
  const token = req.headers.get("x-service-token");
  if (!token) return unauthorized("Missing x-service-token header");
  const expected = process.env.SERVICE_TOKEN?.trim();
  if (!expected) {
    return unauthorized("Service token is not configured");
  }
  if (token !== expected) {
    return unauthorized("Invalid x-service-token header");
  }
  return null;
}
