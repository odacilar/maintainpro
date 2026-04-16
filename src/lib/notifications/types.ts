// ---------------------------------------------------------------------------
// Notification types shared between the API and UI components
// ---------------------------------------------------------------------------

// eventType values written by event-handler.ts
export type NotificationEventType =
  | "breakdown.created"
  | "breakdown.assigned"
  | "breakdown.status_changed"
  | "stock.minimum_reached"
  | "action.created"
  | "action.status_changed"
  | "checklist.completed";

// Shape returned by GET /api/notifications
export interface Notification {
  id: string;
  eventType: string;
  title: string;
  body: string;
  referenceType: string | null;
  referenceId: string | null;
  /** null means unread */
  readAt: string | null;
  createdAt: string;
}

export interface NotificationsResponse {
  notifications: Notification[];
  unreadCount: number;
}

// Shape returned by GET /api/notifications/count
export interface NotificationCountResponse {
  count: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns true when the notification has not been read yet. */
export function isUnread(n: Notification): boolean {
  return n.readAt === null;
}

/**
 * Derives the navigation URL for a notification based on its referenceType
 * and referenceId. Returns null when no deep-link is available.
 */
export function notificationUrl(notification: Notification): string | null {
  const { referenceType, referenceId } = notification;
  if (!referenceId) return null;

  switch (referenceType) {
    case "breakdown":
      return `/arizalar/${referenceId}`;
    case "spare_part":
      return `/parcalar/${referenceId}`;
    case "checklist_record":
    case "checklist":
      return `/otonom-bakim/kontrol/${referenceId}`;
    case "action":
      return `/aksiyonlar/${referenceId}`;
    case "machine":
      return `/makineler/${referenceId}`;
    default:
      return null;
  }
}
