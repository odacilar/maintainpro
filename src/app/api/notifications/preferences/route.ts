/**
 * GET  /api/notifications/preferences  — returns current user's notification preferences
 * PUT  /api/notifications/preferences  — updates preferences
 *
 * Preferences are stored as JSON in User.notificationPreferences:
 * {
 *   "breakdown.created":      { "in_app": true, "email": true, "push": true },
 *   "breakdown.assigned":     { "in_app": true, "email": true, "push": true },
 *   "breakdown.status_changed": { ... },
 *   "stock.minimum_reached":  { ... },
 *   "action.created":         { ... },
 *   "checklist.completed":    { ... }
 * }
 *
 * Missing event types default to all channels enabled.
 */

import { NextRequest, NextResponse } from "next/server";
import { withApiTenant } from "@/lib/auth/api-tenant";
import { withFactoryTx } from "@/lib/tenant/prisma";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Known event types (MVP spec §9)
// ---------------------------------------------------------------------------

const NOTIFICATION_EVENT_TYPES = [
  "breakdown.created",
  "breakdown.assigned",
  "breakdown.status_changed",
  "stock.minimum_reached",
  "action.created",
  "checklist.completed",
] as const;

type NotificationEventType = (typeof NOTIFICATION_EVENT_TYPES)[number];

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const channelPrefsSchema = z.object({
  in_app: z.boolean(),
  email: z.boolean(),
  push: z.boolean(),
});

const preferencesBodySchema = z.record(
  z.enum(NOTIFICATION_EVENT_TYPES),
  channelPrefsSchema,
);

// ---------------------------------------------------------------------------
// Default preferences helper
// ---------------------------------------------------------------------------

function buildDefaultPreferences(): Record<NotificationEventType, { in_app: boolean; email: boolean; push: boolean }> {
  return Object.fromEntries(
    NOTIFICATION_EVENT_TYPES.map((t) => [t, { in_app: true, email: true, push: true }]),
  ) as Record<NotificationEventType, { in_app: boolean; email: boolean; push: boolean }>;
}

function mergeWithDefaults(
  stored: unknown,
): Record<NotificationEventType, { in_app: boolean; email: boolean; push: boolean }> {
  const defaults = buildDefaultPreferences();
  if (!stored || typeof stored !== "object") return defaults;
  const typed = stored as Record<string, unknown>;
  for (const eventType of NOTIFICATION_EVENT_TYPES) {
    const entry = typed[eventType];
    if (entry && typeof entry === "object") {
      const e = entry as Record<string, unknown>;
      defaults[eventType] = {
        in_app: typeof e.in_app === "boolean" ? e.in_app : true,
        email: typeof e.email === "boolean" ? e.email : true,
        push: typeof e.push === "boolean" ? e.push : true,
      };
    }
  }
  return defaults;
}

// ---------------------------------------------------------------------------
// GET /api/notifications/preferences
// ---------------------------------------------------------------------------

export async function GET(): Promise<Response> {
  return withApiTenant(
    { roles: ["FACTORY_ADMIN", "ENGINEER", "TECHNICIAN"] },
    async (ctx) => {
      const prefs = await withFactoryTx(async (tx) => {
        const user = await tx.user.findUnique({
          where: { id: ctx.userId },
          select: { notificationPreferences: true },
        });
        return user?.notificationPreferences ?? null;
      });

      return NextResponse.json({ preferences: mergeWithDefaults(prefs) });
    },
  );
}

// ---------------------------------------------------------------------------
// PUT /api/notifications/preferences
// ---------------------------------------------------------------------------

export async function PUT(req: NextRequest): Promise<Response> {
  return withApiTenant(
    { roles: ["FACTORY_ADMIN", "ENGINEER", "TECHNICIAN"] },
    async (ctx) => {
      let body: unknown;
      try {
        body = await req.json();
      } catch {
        return NextResponse.json({ error: "Geçersiz JSON gövdesi" }, { status: 400 });
      }

      const parsed = preferencesBodySchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "Geçersiz tercih verisi", details: parsed.error.flatten() },
          { status: 400 },
        );
      }

      await withFactoryTx(async (tx) => {
        await tx.user.update({
          where: { id: ctx.userId },
          data: { notificationPreferences: parsed.data },
        });
      });

      return NextResponse.json({ preferences: mergeWithDefaults(parsed.data) });
    },
  );
}
