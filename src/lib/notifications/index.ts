import { setupNotificationHandlers } from "./event-handler";

// ---------------------------------------------------------------------------
// Notifications module entry point
//
// Call initNotifications() once at application startup to wire domain-event
// subscriptions that persist notification rows to the database.
// FCM push and SES email channels are deferred until AWS is provisioned.
// ---------------------------------------------------------------------------

let initialized = false;

export function initNotifications(): void {
  if (initialized) return;
  initialized = true;
  setupNotificationHandlers();
}

export { setupNotificationHandlers };
