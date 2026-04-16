import { Action, ActionStatus, ChecklistRecord } from "@prisma/client";
import { type TenantTx } from "@/lib/tenant/prisma";
import { type ItemResponseInput } from "@/lib/validations/checklist";

// ---------------------------------------------------------------------------
// Typed service error — consistent with breakdown-service pattern
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
// Action state machine — valid transitions
// ---------------------------------------------------------------------------

const VALID_TRANSITIONS: Record<ActionStatus, ActionStatus[]> = {
  OPEN: [ActionStatus.IN_PROGRESS],
  IN_PROGRESS: [ActionStatus.COMPLETED],
  COMPLETED: [ActionStatus.VERIFIED],
  VERIFIED: [],
};

export function isValidActionTransition(
  from: ActionStatus,
  to: ActionStatus,
): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

// ---------------------------------------------------------------------------
// Auto-numbering: OB-AKS-{YEAR}-{NNNN} per factory per year
// ---------------------------------------------------------------------------

export async function generateActionCode(
  tx: TenantTx,
  factoryId: string,
): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `OB-AKS-${year}-`;

  const latest = await tx.action.findFirst({
    where: {
      factoryId,
      code: { startsWith: prefix },
    },
    orderBy: { code: "desc" },
    select: { code: true },
  });

  let sequence = 1;
  if (latest) {
    // code format: OB-AKS-YYYY-NNNN → parts[3] is the sequence
    const parts = latest.code.split("-");
    const lastSeq = parseInt(parts[3] ?? "0", 10);
    if (!isNaN(lastSeq)) sequence = lastSeq + 1;
  }

  return `${prefix}${String(sequence).padStart(4, "0")}`;
}

// ---------------------------------------------------------------------------
// Start checklist execution
// ---------------------------------------------------------------------------

export async function startChecklist(
  tx: TenantTx,
  recordId: string,
): Promise<ChecklistRecord & { template: { name: string; items: { id: string; orderIndex: number; title: string; type: string; referenceValue: string | null; photoRequired: boolean; meta: unknown }[] }; machine: { id: string; name: string; code: string } }> {
  const record = await tx.checklistRecord.findUnique({
    where: { id: recordId },
    select: { id: true, status: true },
  });

  if (!record) {
    throw new ServiceError("not_found", "Checklist record not found");
  }

  if (record.status !== "pending") {
    throw new ServiceError(
      "invalid_state",
      `Cannot start a checklist that is already in status "${record.status}"`,
    );
  }

  const updated = await tx.checklistRecord.update({
    where: { id: recordId },
    data: {
      status: "in_progress",
      startedAt: new Date(),
    },
    include: {
      template: {
        select: {
          name: true,
          items: {
            orderBy: { orderIndex: "asc" },
            select: {
              id: true,
              orderIndex: true,
              title: true,
              type: true,
              referenceValue: true,
              photoRequired: true,
              meta: true,
            },
          },
        },
      },
      machine: { select: { id: true, name: true, code: true } },
    },
  });

  return updated as typeof updated;
}

// ---------------------------------------------------------------------------
// Submit checklist responses (completes the record + auto-creates Actions)
// ---------------------------------------------------------------------------

export type SubmitResult = {
  record: ChecklistRecord;
  createdActions: Action[];
};

export async function submitChecklist(
  tx: TenantTx,
  recordId: string,
  responses: ItemResponseInput[],
  _userId: string,
  factoryId: string,
): Promise<SubmitResult> {
  const record = await tx.checklistRecord.findUnique({
    where: { id: recordId },
    include: {
      template: { select: { items: { select: { id: true, title: true } } } },
    },
  });

  if (!record) {
    throw new ServiceError("not_found", "Checklist record not found");
  }

  if (record.status === "completed") {
    throw new ServiceError("invalid_state", "Checklist record is already completed");
  }

  if (record.status === "pending") {
    throw new ServiceError(
      "invalid_state",
      'Checklist must be started before submitting responses — call PUT ?action=start first',
    );
  }

  // Build a quick lookup of item titles for Action descriptions
  const itemTitleMap = new Map<string, string>(
    record.template.items.map((i) => [i.id, i.title]),
  );

  // Create all item responses
  const createdResponses = await Promise.all(
    responses.map((r) =>
      tx.itemResponse.create({
        data: {
          recordId,
          itemId: r.itemId,
          valueBool: r.valueBool ?? null,
          valueNumber: r.valueNumber != null ? r.valueNumber : null,
          valueText: r.valueText ?? null,
          isAbnormal: r.isAbnormal,
          note: r.note ?? null,
        },
      }),
    ),
  );

  // Auto-create Action rows for every abnormal response (spec §6.2 step 4)
  const createdActions: Action[] = [];
  for (const response of createdResponses) {
    if (!response.isAbnormal) continue;

    const code = await generateActionCode(tx, factoryId);
    const itemTitle = itemTitleMap.get(response.itemId) ?? "Anormallik tespit edildi";
    const description = response.note?.trim() ? response.note : itemTitle;

    const action = await tx.action.create({
      data: {
        factoryId,
        code,
        recordId,
        itemResponseId: response.id,
        description,
        priority: "NORMAL",
        status: "OPEN",
      },
    });

    createdActions.push(action);
  }

  // Mark record as completed
  const completedRecord = await tx.checklistRecord.update({
    where: { id: recordId },
    data: {
      status: "completed",
      completedAt: new Date(),
    },
  });

  return { record: completedRecord, createdActions };
}

// ---------------------------------------------------------------------------
// Transition action status
// ---------------------------------------------------------------------------

export type TransitionActionExtra = {
  resolutionNotes?: string;
  assigneeId?: string;
  targetDate?: string;
};

export async function transitionAction(
  tx: TenantTx,
  actionId: string,
  toStatus: ActionStatus,
  userId: string,
  _factoryId: string,
  extra?: TransitionActionExtra,
): Promise<Action> {
  const action = await tx.action.findUnique({
    where: { id: actionId },
  });

  if (!action) {
    throw new ServiceError("not_found", "Action not found");
  }

  if (!isValidActionTransition(action.status, toStatus)) {
    throw new ServiceError(
      "invalid_transition",
      `Cannot transition action from ${action.status} to ${toStatus}`,
    );
  }

  const now = new Date();
  const updateData: Parameters<typeof tx.action.update>[0]["data"] = {
    status: toStatus,
  };

  if (toStatus === ActionStatus.IN_PROGRESS) {
    if (extra?.assigneeId !== undefined) {
      updateData.assigneeId = extra.assigneeId;
    }
    if (extra?.targetDate !== undefined) {
      updateData.targetDate = new Date(extra.targetDate);
    }
  }

  if (toStatus === ActionStatus.COMPLETED) {
    if (extra?.resolutionNotes !== undefined) {
      updateData.resolutionNotes = extra.resolutionNotes;
    }
  }

  if (toStatus === ActionStatus.VERIFIED) {
    updateData.verifiedById = userId;
    updateData.verifiedAt = now;
  }

  return tx.action.update({
    where: { id: actionId },
    data: updateData,
  });
}
