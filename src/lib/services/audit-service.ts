import { withFactoryTx } from "@/lib/tenant/prisma";
import { tryGetTenant } from "@/lib/tenant/context";
import { Prisma } from "@prisma/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuditEntry {
  action: "CREATE" | "UPDATE" | "DELETE" | "TRANSITION" | "LOGIN" | "EXPORT";
  entityType: string;
  entityId?: string;
  entityName?: string;
  changes?: Record<string, { old: unknown; new: unknown }>;
  metadata?: Record<string, unknown>;
}

// Fields that are never interesting for diff purposes
const IGNORED_DIFF_FIELDS = new Set(["updatedAt", "createdAt", "id"]);

// ---------------------------------------------------------------------------
// diffChanges
// ---------------------------------------------------------------------------

/**
 * Computes a field-level diff between two plain objects.
 * Returns only fields whose values changed, ignoring metadata fields
 * (updatedAt, createdAt, id).
 */
export function diffChanges(
  oldObj: Record<string, unknown>,
  newObj: Record<string, unknown>,
): Record<string, { old: unknown; new: unknown }> {
  const diff: Record<string, { old: unknown; new: unknown }> = {};
  const keys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);

  for (const key of Array.from(keys)) {
    if (IGNORED_DIFF_FIELDS.has(key)) continue;

    const oldVal = oldObj[key];
    const newVal = newObj[key];

    // Simple deep comparison via JSON — sufficient for scalar + plain object fields
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      diff[key] = { old: oldVal, new: newVal };
    }
  }

  return diff;
}

// ---------------------------------------------------------------------------
// writeAuditLog
// ---------------------------------------------------------------------------

/**
 * Writes an audit log entry for the currently authenticated tenant context.
 * This is fire-and-forget: errors are logged to stderr but never thrown,
 * so a logging failure cannot break the calling request.
 */
export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  // Resolve tenant context at call time (must be called inside a request handler)
  const ctx = tryGetTenant();
  if (!ctx) {
    // No active tenant context (e.g. called outside a request) — skip silently
    return;
  }

  const { userId, factoryId } = ctx;

  if (!factoryId) {
    // SUPER_ADMIN without factoryId — audit log requires a factory scope
    return;
  }

  try {
    await withFactoryTx(async (tx) => {
      await tx.auditLog.create({
        data: {
          factoryId,
          userId: userId ?? null,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId ?? null,
          entityName: entry.entityName ?? null,
          changes: (entry.changes ?? Prisma.JsonNull) as Prisma.InputJsonValue,
          metadata: (entry.metadata ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        },
      });
    });
  } catch (err) {
    // Never throw — audit failures must not break the primary operation
    console.error("[audit-service] Failed to write audit log:", err);
  }
}
