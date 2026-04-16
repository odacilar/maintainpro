import { NextResponse } from "next/server";

/**
 * GET /api/health
 * Health check endpoint used by AWS App Runner and docker-compose.
 * No authentication required.
 */
export async function GET() {
  return NextResponse.json(
    { status: "ok", timestamp: new Date().toISOString() },
    { status: 200 }
  );
}
