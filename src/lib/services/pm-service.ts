import { PmPlan, WorkOrder, WorkOrderStatus } from "@prisma/client";
import { type TenantTx } from "@/lib/tenant/prisma";
import {
  type PmFrequency,
  FREQUENCY_INTERVAL_DAYS,
} from "@/lib/validations/pm-plan";

// ---------------------------------------------------------------------------
// Typed service error — consistent with other service modules
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

// ---------------------------------------------------------------------------
// Work Order state machine
// ---------------------------------------------------------------------------

const VALID_TRANSITIONS: Record<WorkOrderStatus, WorkOrderStatus[]> = {
  PLANNED: [WorkOrderStatus.IN_PROGRESS, WorkOrderStatus.CANCELLED],
  IN_PROGRESS: [WorkOrderStatus.COMPLETED, WorkOrderStatus.CANCELLED],
  COMPLETED: [],
  CANCELLED: [],
};

export function isValidWorkOrderTransition(
  from: WorkOrderStatus,
  to: WorkOrderStatus,
): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

// ---------------------------------------------------------------------------
// Auto-numbering: WO-{YEAR}-{NNNN} per factory per year
// ---------------------------------------------------------------------------

export async function generateWorkOrderCode(
  tx: TenantTx,
  factoryId: string,
): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `WO-${year}-`;

  const latest = await tx.workOrder.findFirst({
    where: {
      factoryId,
      // WorkOrder has no code field in schema; we store the code in notes
      // prefixed. Actually the schema has no code field — we generate it for
      // display only. Since there is no dedicated code column, we count rows.
    },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  // Count all work orders in this factory this year to derive next sequence
  const count = await tx.workOrder.count({
    where: {
      factoryId,
      createdAt: {
        gte: new Date(`${year}-01-01T00:00:00.000Z`),
        lt: new Date(`${year + 1}-01-01T00:00:00.000Z`),
      },
    },
  });

  // latest is only used to avoid unused variable warning
  void latest;

  return `${prefix}${String(count + 1).padStart(4, "0")}`;
}

// ---------------------------------------------------------------------------
// Calculate next due date based on frequency
// ---------------------------------------------------------------------------

export function calculateNextDueDate(
  lastDate: Date,
  frequency: PmFrequency,
): Date {
  const intervalDays = FREQUENCY_INTERVAL_DAYS[frequency];
  const next = new Date(lastDate);
  next.setDate(next.getDate() + intervalDays);
  return next;
}

// ---------------------------------------------------------------------------
// Create a PM Plan (maps convenience schema fields → Prisma model fields)
// ---------------------------------------------------------------------------

export type CreatePmPlanData = {
  machineId: string;
  title: string;
  description?: string;
  frequency: PmFrequency;
  priority: string;
  estimatedMinutes?: number;
  assigneeId?: string;
  instructions?: string;
  isActive: boolean;
};

export async function createPmPlan(
  tx: TenantTx,
  data: CreatePmPlanData,
  factoryId: string,
): Promise<PmPlan> {
  const intervalDays = FREQUENCY_INTERVAL_DAYS[data.frequency];

  // nextDueAt defaults to now + interval so the scheduler picks it up correctly
  const nextDueAt = new Date();
  nextDueAt.setDate(nextDueAt.getDate() + intervalDays);

  const taskList: string[] = data.instructions
    ? data.instructions
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
    : [];

  return tx.pmPlan.create({
    data: {
      factoryId,
      machineId: data.machineId,
      // Map title → name (Prisma field)
      name: data.title,
      // Store description + priority in maintenanceType field (no separate column)
      maintenanceType: `${data.priority}:${data.description ?? ""}`,
      triggerType: "TIME_BASED",
      intervalDays,
      estimatedDurationMinutes: data.estimatedMinutes ?? null,
      taskList,
      requiredPartsJson: [],
      requiredStaffCount: 1,
      nextDueAt,
      isActive: data.isActive,
    },
  });
}

// ---------------------------------------------------------------------------
// Generate work orders for PM plans that are due
// Called by a scheduler job (Sprint 5); also usable from tests/admin.
// ---------------------------------------------------------------------------

export async function generateWorkOrders(
  tx: TenantTx,
  factoryId: string,
): Promise<WorkOrder[]> {
  const now = new Date();

  // Find all active, time-based PM plans where nextDueAt is in the past
  const duePlans = await tx.pmPlan.findMany({
    where: {
      factoryId,
      isActive: true,
      triggerType: { in: ["TIME_BASED", "BOTH"] },
      nextDueAt: { lte: now },
    },
  });

  const created: WorkOrder[] = [];

  for (const plan of duePlans) {
    // Check if a PLANNED work order already exists for this plan (no duplicate)
    const existing = await tx.workOrder.findFirst({
      where: {
        factoryId,
        pmPlanId: plan.id,
        status: "PLANNED",
      },
    });

    if (existing) continue;

    const workOrder = await tx.workOrder.create({
      data: {
        factoryId,
        pmPlanId: plan.id,
        machineId: plan.machineId,
        scheduledFor: plan.nextDueAt ?? now,
        status: WorkOrderStatus.PLANNED,
      },
    });

    created.push(workOrder);

    // Advance nextDueAt by intervalDays
    if (plan.intervalDays) {
      const next = new Date(plan.nextDueAt ?? now);
      next.setDate(next.getDate() + plan.intervalDays);
      await tx.pmPlan.update({
        where: { id: plan.id },
        data: { nextDueAt: next },
      });
    }
  }

  return created;
}

// ---------------------------------------------------------------------------
// Transition work order status
// ---------------------------------------------------------------------------

export type TransitionWorkOrderExtra = {
  notes?: string;
};

export async function transitionWorkOrder(
  tx: TenantTx,
  workOrderId: string,
  toStatus: WorkOrderStatus,
  actorId: string,
  factoryId: string,
  extra?: TransitionWorkOrderExtra,
): Promise<WorkOrder> {
  const workOrder = await tx.workOrder.findUnique({
    where: { id: workOrderId },
  });

  if (!workOrder) {
    throw new ServiceError("not_found", "Work order not found");
  }

  if (!isValidWorkOrderTransition(workOrder.status, toStatus)) {
    throw new ServiceError(
      "invalid_transition",
      `Cannot transition from ${workOrder.status} to ${toStatus}`,
    );
  }

  const now = new Date();
  const updateData: Parameters<typeof tx.workOrder.update>[0]["data"] = {
    status: toStatus,
  };

  if (toStatus === WorkOrderStatus.IN_PROGRESS) {
    updateData.startedAt = now;
    updateData.assigneeId = actorId;
  }

  if (toStatus === WorkOrderStatus.COMPLETED) {
    updateData.completedAt = now;
    // Update lastExecutedAt on the PM Plan
    if (workOrder.pmPlanId) {
      await tx.pmPlan.update({
        where: { id: workOrder.pmPlanId },
        data: { lastExecutedAt: now },
      });
    }
  }

  if (extra?.notes !== undefined) {
    updateData.notes = extra.notes;
  }

  void factoryId; // factoryId is already scoped via RLS; kept for symmetry

  return tx.workOrder.update({
    where: { id: workOrderId },
    data: updateData,
  });
}
