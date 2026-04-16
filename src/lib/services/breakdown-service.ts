import {
  Breakdown,
  BreakdownStatus,
  BreakdownPriority,
  BreakdownType,
} from "@prisma/client";
import { type TenantTx } from "@/lib/tenant/prisma";

// ---------------------------------------------------------------------------
// State machine — explicit allowed transitions (spec §4.2)
// ---------------------------------------------------------------------------

const VALID_TRANSITIONS: Record<BreakdownStatus, BreakdownStatus[]> = {
  OPEN: [BreakdownStatus.ASSIGNED],
  ASSIGNED: [BreakdownStatus.IN_PROGRESS],
  IN_PROGRESS: [BreakdownStatus.WAITING_PARTS, BreakdownStatus.RESOLVED],
  WAITING_PARTS: [BreakdownStatus.IN_PROGRESS],
  RESOLVED: [BreakdownStatus.CLOSED, BreakdownStatus.IN_PROGRESS],
  CLOSED: [],
};

export function isValidTransition(
  from: BreakdownStatus,
  to: BreakdownStatus,
): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

// ---------------------------------------------------------------------------
// Auto-numbering: ARZ-{YEAR}-{NNNN} per factory per year
// ---------------------------------------------------------------------------

export async function generateBreakdownCode(
  tx: TenantTx,
  factoryId: string,
): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `ARZ-${year}-`;

  const latest = await tx.breakdown.findFirst({
    where: {
      factoryId,
      code: { startsWith: prefix },
    },
    orderBy: { code: "desc" },
    select: { code: true },
  });

  let sequence = 1;
  if (latest) {
    const parts = latest.code.split("-");
    const lastSeq = parseInt(parts[2] ?? "0", 10);
    if (!isNaN(lastSeq)) sequence = lastSeq + 1;
  }

  return `${prefix}${String(sequence).padStart(4, "0")}`;
}

// ---------------------------------------------------------------------------
// Create breakdown
// ---------------------------------------------------------------------------

export type CreateBreakdownData = {
  machineId: string;
  type: BreakdownType;
  priority: BreakdownPriority;
  description: string;
};

export async function createBreakdown(
  tx: TenantTx,
  data: CreateBreakdownData,
  actorId: string,
  factoryId: string,
): Promise<Breakdown> {
  const code = await generateBreakdownCode(tx, factoryId);

  const breakdown = await tx.breakdown.create({
    data: {
      factoryId,
      code,
      machineId: data.machineId,
      type: data.type,
      priority: data.priority,
      description: data.description,
      reporterId: actorId,
      status: BreakdownStatus.OPEN,
    },
  });

  await tx.breakdownTimeline.create({
    data: {
      breakdownId: breakdown.id,
      userId: actorId,
      factoryId,
      fromStatus: null,
      toStatus: BreakdownStatus.OPEN,
    },
  });

  return breakdown;
}

// ---------------------------------------------------------------------------
// Transition breakdown status
// ---------------------------------------------------------------------------

export type TransitionExtra = {
  assigneeId?: string;
  note?: string;
  resolutionNotes?: string;
  rootCause?: string;
};

export async function transitionBreakdown(
  tx: TenantTx,
  breakdownId: string,
  toStatus: BreakdownStatus,
  actorId: string,
  factoryId: string,
  extra?: TransitionExtra,
): Promise<Breakdown> {
  const breakdown = await tx.breakdown.findUnique({
    where: { id: breakdownId },
  });

  if (!breakdown) {
    throw new ServiceError("not_found", "Breakdown not found");
  }

  if (!isValidTransition(breakdown.status, toStatus)) {
    throw new ServiceError(
      "invalid_transition",
      `Cannot transition from ${breakdown.status} to ${toStatus}`,
    );
  }

  const now = new Date();
  const isRejectPath =
    breakdown.status === BreakdownStatus.RESOLVED &&
    toStatus === BreakdownStatus.IN_PROGRESS;

  // Build partial update
  const updateData: Parameters<typeof tx.breakdown.update>[0]["data"] = {
    status: toStatus,
  };

  if (toStatus === BreakdownStatus.ASSIGNED) {
    if (!extra?.assigneeId) {
      throw new ServiceError("validation_error", "assigneeId required for ASSIGNED transition");
    }
    updateData.assigneeId = extra.assigneeId;
  }

  if (toStatus === BreakdownStatus.IN_PROGRESS && !isRejectPath) {
    // Set respondedAt only on first transition to IN_PROGRESS
    if (!breakdown.respondedAt) {
      updateData.respondedAt = now;
    }
  }

  if (isRejectPath) {
    // Reject: clear resolvedAt
    updateData.resolvedAt = null;
  }

  if (toStatus === BreakdownStatus.RESOLVED) {
    updateData.resolvedAt = now;
    if (extra?.resolutionNotes !== undefined)
      updateData.resolutionNotes = extra.resolutionNotes;
    if (extra?.rootCause !== undefined) updateData.rootCause = extra.rootCause;

    // Calculate total downtime from reportedAt → now
    const downtime = Math.round(
      (now.getTime() - breakdown.reportedAt.getTime()) / 60000,
    );
    updateData.totalDowntimeMinutes = downtime;
  }

  if (toStatus === BreakdownStatus.CLOSED) {
    updateData.closedAt = now;
  }

  const updated = await tx.breakdown.update({
    where: { id: breakdownId },
    data: updateData,
  });

  await tx.breakdownTimeline.create({
    data: {
      breakdownId,
      userId: actorId,
      factoryId,
      fromStatus: breakdown.status,
      toStatus,
      note: extra?.note ?? null,
    },
  });

  return updated;
}

// ---------------------------------------------------------------------------
// Typed service error — caught in API routes to return proper HTTP codes
// ---------------------------------------------------------------------------

export class ServiceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ServiceError";
  }
}
