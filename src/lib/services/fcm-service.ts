/**
 * fcm-service.ts
 *
 * Sends Firebase Cloud Messaging push notifications via the firebase-admin SDK.
 * Env vars (all optional — degrades gracefully when not set):
 *   FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
 *
 * If any of those three are absent, functions log to console and return.
 */

import { withFactoryTx } from "@/lib/tenant/prisma";
import { runWithTenant } from "@/lib/tenant/context";

// ---------------------------------------------------------------------------
// Firebase Admin singleton — initialised lazily
// ---------------------------------------------------------------------------

// We import dynamically to avoid crashing at module load when env vars are absent.
let _messagingRef: unknown = null;
let _initAttempted = false;

async function getMessaging(): Promise<unknown> {
  if (_initAttempted) return _messagingRef;
  _initAttempted = true;

  const { projectId, clientEmail, privateKey } = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  };

  if (!projectId || !clientEmail || !privateKey) {
    console.log("[fcm-service] Firebase credentials not configured — push disabled.");
    return null;
  }

  try {
    const admin = await import("firebase-admin");

    // Avoid re-initialising if another module already did it
    const app =
      admin.apps.length > 0
        ? admin.app()
        : admin.initializeApp({
            credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
          });

    _messagingRef = admin.messaging(app);
  } catch (err) {
    console.error("[fcm-service] Firebase init error:", err);
  }

  return _messagingRef;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PushNotificationPayload = {
  title: string;
  body: string;
  data?: Record<string, string>;
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Low-level push to a single FCM registration token.
 * Silently returns when FCM is not configured or token is empty.
 */
export async function sendPushNotification(
  fcmToken: string,
  notification: PushNotificationPayload,
): Promise<void> {
  if (!fcmToken) return;

  const messaging = await getMessaging();
  if (!messaging) {
    console.log(
      `[fcm-service] FCM not configured — skipping push to token ${fcmToken.slice(0, 12)}…: ${notification.title}`,
    );
    return;
  }

  try {
    // firebase-admin messaging API
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (messaging as any).send({
      token: fcmToken,
      notification: {
        title: notification.title,
        body: notification.body,
      },
      data: notification.data ?? {},
      android: { priority: "high" },
      apns: { payload: { aps: { sound: "default" } } },
    });
    console.log("[fcm-service] Push sent:", result);
  } catch (err: unknown) {
    // Token invalid / not registered — treat as soft failure
    const code = (err as { code?: string })?.code;
    if (
      code === "messaging/registration-token-not-registered" ||
      code === "messaging/invalid-registration-token"
    ) {
      console.warn("[fcm-service] Stale FCM token, consider removing it:", fcmToken.slice(0, 12));
    } else {
      console.error("[fcm-service] Push send failed:", err);
    }
  }
}

/**
 * Looks up the user's stored FCM token and sends a push notification.
 * Runs as a system operation (bypassRls) since it reads a single user row.
 *
 * @param userId  - Target user ID
 * @param notification - Push payload with optional reference for data routing
 */
export async function sendPushToUser(
  userId: string,
  notification: {
    title: string;
    body: string;
    referenceType?: string;
    referenceId?: string;
  },
): Promise<void> {
  let fcmToken: string | null = null;

  try {
    // We need to read the user's fcmToken; use system context so we can
    // reach any factory's user without tenant restriction.
    await runWithTenant(
      { userId: "system", role: "FACTORY_ADMIN", factoryId: null as unknown as string, bypassRls: true },
      async () => {
        await withFactoryTx(async (tx) => {
          const user = await tx.user.findUnique({
            where: { id: userId },
            select: { fcmToken: true },
          });
          fcmToken = user?.fcmToken ?? null;
        });
      },
    );
  } catch (err) {
    console.error("[fcm-service] Failed to read user FCM token:", err);
    return;
  }

  if (!fcmToken) return; // User has not granted push permission

  const data: Record<string, string> = {};
  if (notification.referenceType) data.referenceType = notification.referenceType;
  if (notification.referenceId) data.referenceId = notification.referenceId;

  await sendPushNotification(fcmToken, {
    title: notification.title,
    body: notification.body,
    data,
  });
}
