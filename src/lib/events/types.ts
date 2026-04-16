export type DomainEventBase = {
  id: string;
  factoryId: string | null;
  occurredAt: string;
  actorId: string | null;
};

export type BreakdownEvent =
  | (DomainEventBase & {
      type: "breakdown.created";
      breakdownId: string;
      machineId: string;
      priority: string;
    })
  | (DomainEventBase & {
      type: "breakdown.status_changed";
      breakdownId: string;
      fromStatus: string | null;
      toStatus: string;
    })
  | (DomainEventBase & {
      type: "breakdown.assigned";
      breakdownId: string;
      assigneeId: string;
    })
  | (DomainEventBase & {
      type: "breakdown.escalated";
      breakdownId: string;
      escalationLevel: "ENGINEER" | "FACTORY_ADMIN" | "SUPER_ADMIN";
      ageMinutes: number;
    });

export type MachineEvent =
  | (DomainEventBase & {
      type: "machine.created";
      machineId: string;
    })
  | (DomainEventBase & {
      type: "machine.updated";
      machineId: string;
    })
  | (DomainEventBase & {
      type: "machine.status_changed";
      machineId: string;
      status: string;
    });

export type StockEvent =
  | (DomainEventBase & {
      type: "stock.movement";
      sparePartId: string;
      movementType: string;
      delta: number;
      newBalance: number;
    })
  | (DomainEventBase & {
      type: "stock.minimum_reached";
      sparePartId: string;
      currentStock: number;
    });

export type ChecklistEvent =
  | (DomainEventBase & {
      type: "checklist.completed";
      recordId: string;
      machineId: string;
    })
  | (DomainEventBase & {
      type: "action.created";
      actionId: string;
      recordId: string;
    })
  | (DomainEventBase & {
      type: "action.status_changed";
      actionId: string;
      toStatus: string;
    });

export type WorkOrderEvent =
  | (DomainEventBase & {
      type: "workorder.created";
      workOrderId: string;
      machineId: string;
      pmPlanId: string | null;
    })
  | (DomainEventBase & {
      type: "workorder.status_changed";
      workOrderId: string;
      fromStatus: string;
      toStatus: string;
    });

export type PmPlanEvent = DomainEventBase & {
  type: "pmplan.created";
  pmPlanId: string;
  machineId: string;
};

export type DomainEvent =
  | BreakdownEvent
  | MachineEvent
  | StockEvent
  | ChecklistEvent
  | WorkOrderEvent
  | PmPlanEvent;

export type DomainEventType = DomainEvent["type"];

export function channelFor(factoryId: string | null): string {
  return factoryId ? `factory:${factoryId}` : "platform";
}
