import { Role } from "@prisma/client";
import { type TenantTx } from "@/lib/tenant/prisma";
import { sendNotificationEmail } from "./email-service";
import { sendPushToUser } from "./fcm-service";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CreateNotificationInput = {
  userId: string;
  factoryId: string;
  type: string; // e.g. "breakdown.created", "breakdown.assigned"
  title: string;
  body: string;
  referenceType?: string; // "breakdown" | "action" | "checklist" | "spare_part"
  referenceId?: string;
};

// ---------------------------------------------------------------------------
// Default preferences — all channels enabled for all event types
// ---------------------------------------------------------------------------

type ChannelPrefs = { in_app: boolean; email: boolean; push: boolean };
type NotificationPrefs = Record<string, ChannelPrefs>;

const DEFAULT_CHANNEL_PREFS: ChannelPrefs = { in_app: true, email: true, push: true };

function getChannelPrefs(
  prefs: unknown,
  eventType: string,
): ChannelPrefs {
  if (!prefs || typeof prefs !== "object") return DEFAULT_CHANNEL_PREFS;
  const typed = prefs as NotificationPrefs;
  return typed[eventType] ?? DEFAULT_CHANNEL_PREFS;
}

// ---------------------------------------------------------------------------
// dispatchNotification — fan-out across all configured channels for one user
//
// Email and push happen fire-and-forget outside any DB transaction.
// This function must NOT be awaited inside a Prisma transaction.
// ---------------------------------------------------------------------------

export async function dispatchNotification(
  notification: CreateNotificationInput,
  user: { id: string; name: string; email: string; notificationPreferences: unknown },
): Promise<void> {
  const prefs = getChannelPrefs(user.notificationPreferences, notification.type);

  const tasks: Promise<void>[] = [];

  if (prefs.email) {
    tasks.push(
      sendNotificationEmail(
        { email: user.email, name: user.name },
        {
          title: notification.title,
          body: notification.body,
          referenceType: notification.referenceType,
          referenceId: notification.referenceId,
        },
      ),
    );
  }

  if (prefs.push) {
    tasks.push(
      sendPushToUser(user.id, {
        title: notification.title,
        body: notification.body,
        referenceType: notification.referenceType,
        referenceId: notification.referenceId,
      }),
    );
  }

  // Fire all side-channel dispatches concurrently; swallow errors individually
  await Promise.allSettled(tasks);
}

// ---------------------------------------------------------------------------
// createNotifications — bulk-insert IN_APP notification rows, then dispatch
// email/push for each recipient.
//
// The DB write is done inside the caller's transaction (tx).
// Side-channel dispatch happens after the transaction commits — callers should
// invoke this at the end of the transaction body so email/push don't fire if
// the tx rolls back.
// ---------------------------------------------------------------------------

export async function createNotifications(
  tx: TenantTx,
  notifications: CreateNotificationInput[],
): Promise<void> {
  if (notifications.length === 0) return;

  await tx.notification.createMany({
    data: notifications.map((n) => ({
      userId: n.userId,
      factoryId: n.factoryId,
      channel: "IN_APP" as const,
      eventType: n.type,
      title: n.title,
      body: n.body,
      referenceType: n.referenceType ?? null,
      referenceId: n.referenceId ?? null,
    })),
    skipDuplicates: false,
  });

  // Fetch user details needed for email/push — done inside the same tx so
  // we don't need an extra round-trip after commit.
  const userIds = Array.from(new Set(notifications.map((n) => n.userId)));
  const users = await tx.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, email: true, notificationPreferences: true },
  });

  const userMap = new Map(users.map((u) => [u.id, u]));

  // Schedule side-channel dispatch to happen after the enclosing transaction
  // completes. Using setImmediate ensures we don't block the tx commit.
  setImmediate(() => {
    for (const notif of notifications) {
      const user = userMap.get(notif.userId);
      if (!user) continue;
      void dispatchNotification(notif, user);
    }
  });
}

// ---------------------------------------------------------------------------
// getNotificationRecipients — resolve the set of users who should receive
// a notification for a given event type, excluding the actor.
//
// Rules (spec §9):
//  - breakdown events  → FACTORY_ADMIN + ENGINEER (optionally same dept)
//  - stock alerts      → FACTORY_ADMIN + ENGINEER
//  - action events     → FACTORY_ADMIN + ENGINEER
//  - checklist events  → ENGINEER only
// ---------------------------------------------------------------------------

export async function getNotificationRecipients(
  tx: TenantTx,
  factoryId: string,
  eventType: string,
  extra?: { departmentId?: string; excludeUserId?: string },
): Promise<Array<{ id: string; name: string }>> {
  const { departmentId, excludeUserId } = extra ?? {};

  // Determine which roles are recipients based on event type
  let roles: Role[];

  if (eventType.startsWith("checklist.")) {
    roles = [Role.ENGINEER];
  } else if (
    eventType.startsWith("breakdown.") ||
    eventType.startsWith("stock.") ||
    eventType.startsWith("action.")
  ) {
    roles = [Role.FACTORY_ADMIN, Role.ENGINEER];
  } else {
    roles = [Role.FACTORY_ADMIN, Role.ENGINEER];
  }

  const users = await tx.user.findMany({
    where: {
      factoryId,
      role: { in: roles },
      isActive: true,
      // Optional: filter by department (for breakdown.created dept routing)
      ...(departmentId
        ? { departmentId }
        : {}),
      // Exclude the actor who triggered the event
      ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
    },
    select: { id: true, name: true },
  });

  return users;
}
