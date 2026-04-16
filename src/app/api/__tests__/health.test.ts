import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Health check — GET /api/health
// We test the pure route handler logic without a real HTTP server.
// Next.js NextResponse is mocked to capture the JSON payload + status.
// ---------------------------------------------------------------------------

// Minimal NextResponse mock that captures json() calls
const mockJsonResponse = vi.fn((body: unknown, init?: { status?: number }) => ({
  body,
  status: init?.status ?? 200,
}));

vi.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => mockJsonResponse(body, init),
  },
}));

describe("GET /api/health", () => {
  beforeEach(() => {
    mockJsonResponse.mockClear();
  });

  it("returns status 200", async () => {
    const { GET } = await import("@/app/api/health/route");
    const response = await GET();
    expect((response as any).status).toBe(200);
  });

  it("returns { status: 'ok' } in the body", async () => {
    const { GET } = await import("@/app/api/health/route");
    const response = await GET();
    expect((response as any).body).toMatchObject({ status: "ok" });
  });

  it("returns a timestamp in the body", async () => {
    const { GET } = await import("@/app/api/health/route");
    const response = await GET();
    expect((response as any).body).toHaveProperty("timestamp");
  });

  it("timestamp is a valid ISO 8601 date string", async () => {
    const { GET } = await import("@/app/api/health/route");
    const response = await GET();
    const { timestamp } = (response as any).body;
    expect(typeof timestamp).toBe("string");
    expect(new Date(timestamp).toISOString()).toBe(timestamp);
  });

  it("timestamp is close to the current time (within 2 seconds)", async () => {
    const before = Date.now();
    const { GET } = await import("@/app/api/health/route");
    const response = await GET();
    const after = Date.now();
    const ts = new Date((response as any).body.timestamp).getTime();
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after + 2000);
  });

  it("response body contains exactly the expected keys", async () => {
    const { GET } = await import("@/app/api/health/route");
    const response = await GET();
    const keys = Object.keys((response as any).body);
    expect(keys.sort()).toEqual(["status", "timestamp"]);
  });
});
