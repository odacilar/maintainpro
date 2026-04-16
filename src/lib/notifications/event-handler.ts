import { events } from "@/lib/events";
import type { DomainEvent } from "@/lib/events/types";
import { withFactoryTx } from "@/lib/tenant/prisma";
import {
  createNotifications,
  getNotificationRecipients,
  type CreateNotificationInput,
} from "@/lib/services/notification-service";
import { runWithTenant } from "@/lib/tenant/context";

// ---------------------------------------------------------------------------
// Priority label helpers (Turkish)
// ---------------------------------------------------------------------------

const PRIORITY_LABELS: Record<string, string> = {
  LOW: "Düşük",
  MEDIUM: "Orta",
  HIGH: "Yüksek",
  CRITICAL: "Kritik",
};

const STATUS_LABELS: Record<string, string> = {
  OPEN: "Açık",
  ASSIGNED: "Atandı",
  IN_PROGRESS: "Müdahale Ediliyor",
  WAITING_PARTS: "Parça Bekleniyor",
  RESOLVED: "Çözüldü",
  CLOSED: "Kapatıldı",
};

function priorityLabel(p: string): string {
  return PRIORITY_LABELS[p] ?? p;
}

function statusLabel(s: string): string {
  return STATUS_LABELS[s] ?? s;
}

// ---------------------------------------------------------------------------
// Run a handler safely — errors must NOT propagate to the event publisher
// ---------------------------------------------------------------------------

async function safeHandle(
  factoryId: string,
  fn: () => Promise<void>,
): Promise<void> {
  try {
    // Notification handler runs as a system operation: no user actor in context.
    // We use bypassRls so the handler can read across user/machine tables,
    // but individual notification rows are still scoped by factoryId column.
    await runWithTenant(
      { userId: "system", role: "FACTORY_ADMIN", factoryId, bypassRls: true },
      fn,
    );
  } catch (err) {
    console.error("[notifications] handler error", err);
  }
}

// ---------------------------------------------------------------------------
// Event → Notification handlers
// ---------------------------------------------------------------------------

async function handleBreakdownCreated(event: Extract<DomainEvent, { type: "breakdown.created" }>): Promise<void> {
  const { factoryId, breakdownId, machineId, priority, actorId } = event;
  if (!factoryId) return;

  await safeHandle(factoryId, async () => {
    await withFactoryTx(async (tx) => {
      const machine = await tx.machine.findUnique({
        where: { id: machineId },
        select: { name: true, departmentId: true },
      });
      if (!machine) return;

      const recipients = await getNotificationRecipients(tx, factoryId, event.type, {
        departmentId: machine.departmentId ?? undefined,
        excludeUserId: actorId ?? undefined,
      });

      const title = "Yeni arıza bildirimi";
      const body = `${machine.name} makinesinde ${priorityLabel(priority)} öncelikli yeni arıza oluşturuldu.`;

      const notifs: CreateNotificationInput[] = recipients.map((u) => ({
        userId: u.id,
        factoryId,
        type: event.type,
        title,
        body,
        referenceType: "breakdown",
        referenceId: breakdownId,
      }));

      await createNotifications(tx, notifs);
    });
  });
}

async function handleBreakdownAssigned(event: Extract<DomainEvent, { type: "breakdown.assigned" }>): Promise<void> {
  const { factoryId, breakdownId, assigneeId } = event;
  if (!factoryId) return;

  await safeHandle(factoryId, async () => {
    await withFactoryTx(async (tx) => {
      const breakdown = await tx.breakdown.findUnique({
        where: { id: breakdownId },
        select: { code: true },
      });
      if (!breakdown) return;

      const notifs: CreateNotificationInput[] = [
        {
          userId: assigneeId,
          factoryId,
          type: event.type,
          title: "Size arıza atandı",
          body: `${breakdown.code} kodlu arıza size atandı. Lütfen inceleyiniz.`,
          referenceType: "breakdown",
          referenceId: breakdownId,
        },
      ];

      await createNotifications(tx, notifs);
    });
  });
}

async function handleBreakdownStatusChanged(event: Extract<DomainEvent, { type: "breakdown.status_changed" }>): Promise<void> {
  const { factoryId, breakdownId, toStatus, actorId } = event;
  if (!factoryId) return;

  await safeHandle(factoryId, async () => {
    await withFactoryTx(async (tx) => {
      const breakdown = await tx.breakdown.findUnique({
        where: { id: breakdownId },
        select: { code: true, reporterId: true, assigneeId: true },
      });
      if (!breakdown) return;

      // Notify both reporter and assignee (excluding the actor who triggered it)
      const recipientIds = [breakdown.reporterId, breakdown.assigneeId]
        .filter((id): id is string => id !== null && id !== undefined && id !== actorId);

      const uniqueIds = Array.from(new Set(recipientIds));
      if (uniqueIds.length === 0) return;

      const notifs: CreateNotificationInput[] = uniqueIds.map((userId) => ({
        userId,
        factoryId,
        type: event.type,
        title: "Arıza durumu güncellendi",
        body: `${breakdown.code} kodlu arıza durumu "${statusLabel(toStatus)}" olarak güncellendi.`,
        referenceType: "breakdown",
        referenceId: breakdownId,
      }));

      await createNotifications(tx, notifs);
    });
  });
}

async function handleStockMinimumReached(event: Extract<DomainEvent, { type: "stock.minimum_reached" }>): Promise<void> {
  const { factoryId, sparePartId, currentStock } = event;
  if (!factoryId) return;

  await safeHandle(factoryId, async () => {
    await withFactoryTx(async (tx) => {
      const part = await tx.sparePart.findUnique({
        where: { id: sparePartId },
        select: { name: true, unit: true },
      });
      if (!part) return;

      const recipients = await getNotificationRecipients(tx, factoryId, event.type);

      const notifs: CreateNotificationInput[] = recipients.map((u) => ({
        userId: u.id,
        factoryId,
        type: event.type,
        title: "Stok uyarısı",
        body: `"${part.name}" minimum stok seviyesinin altına düştü. Mevcut stok: ${currentStock} ${part.unit}.`,
        referenceType: "spare_part",
        referenceId: sparePartId,
      }));

      await createNotifications(tx, notifs);
    });
  });
}

async function handleActionCreated(event: Extract<DomainEvent, { type: "action.created" }>): Promise<void> {
  const { factoryId, actionId, actorId } = event;
  if (!factoryId) return;

  await safeHandle(factoryId, async () => {
    await withFactoryTx(async (tx) => {
      const action = await tx.action.findUnique({
        where: { id: actionId },
        select: { code: true },
      });
      if (!action) return;

      const recipients = await getNotificationRecipients(tx, factoryId, event.type, {
        excludeUserId: actorId ?? undefined,
      });

      const notifs: CreateNotificationInput[] = recipients.map((u) => ({
        userId: u.id,
        factoryId,
        type: event.type,
        title: "Yeni aksiyon oluşturuldu",
        body: `${action.code} kodlu yeni aksiyon sisteme eklendi.`,
        referenceType: "action",
        referenceId: actionId,
      }));

      await createNotifications(tx, notifs);
    });
  });
}

async function handleChecklistCompleted(event: Extract<DomainEvent, { type: "checklist.completed" }>): Promise<void> {
  const { factoryId, recordId, machineId, actorId } = event;
  if (!factoryId) return;

  await safeHandle(factoryId, async () => {
    await withFactoryTx(async (tx) => {
      const machine = await tx.machine.findUnique({
        where: { id: machineId },
        select: { name: true },
      });
      if (!machine) return;

      const recipients = await getNotificationRecipients(tx, factoryId, event.type, {
        excludeUserId: actorId ?? undefined,
      });

      const notifs: CreateNotificationInput[] = recipients.map((u) => ({
        userId: u.id,
        factoryId,
        type: event.type,
        title: "Checklist tamamlandı",
        body: `${machine.name} makinesi için otonom bakım kontrol listesi tamamlandı.`,
        referenceType: "checklist",
        referenceId: recordId,
      }));

      await createNotifications(tx, notifs);
    });
  });
}

// ---------------------------------------------------------------------------
// setupNotificationHandlers — subscribe to all relevant domain events.
// Must be called exactly once at app startup.
// ---------------------------------------------------------------------------

export function setupNotificationHandlers(): void {
  // Subscribe on the wildcard channel ("*") to receive all events regardless
  // of factory; the handlers themselves filter by factoryId where needed.
  events.subscribe("*", (event: DomainEvent) => {
    switch (event.type) {
      case "breakdown.created":
        void handleBreakdownCreated(event);
        break;
      case "breakdown.assigned":
        void handleBreakdownAssigned(event);
        break;
      case "breakdown.status_changed":
        void handleBreakdownStatusChanged(event);
        break;
      case "stock.minimum_reached":
        void handleStockMinimumReached(event);
        break;
      case "action.created":
        void handleActionCreated(event);
        break;
      case "checklist.completed":
        void handleChecklistCompleted(event);
        break;
      default:
        // All other event types (machine.*, stock.movement, action.status_changed)
        // do not require in-app notifications in the MVP spec
        break;
    }
  });
}
