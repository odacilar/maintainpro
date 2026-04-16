/**
 * email-service.ts
 *
 * Sends transactional emails via SMTP (nodemailer).
 * Env vars (all optional — service degrades gracefully when not set):
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
 *
 * If SMTP_HOST is absent the functions log to console and return immediately
 * so the app never crashes just because email isn't wired up yet.
 */

import nodemailer, { type Transporter } from "nodemailer";

// ---------------------------------------------------------------------------
// Transport singleton — created lazily on first use
// ---------------------------------------------------------------------------

let _transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (!process.env.SMTP_HOST) return null;

  if (!_transporter) {
    _transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587,
      secure: process.env.SMTP_PORT === "465",
      auth:
        process.env.SMTP_USER && process.env.SMTP_PASS
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          : undefined,
    });
  }

  return _transporter;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SendEmailOptions = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

// ---------------------------------------------------------------------------
// Route helpers (Turkish URL slugs)
// ---------------------------------------------------------------------------

const REFERENCE_ROUTES: Record<string, string> = {
  breakdown: "/arizalar",
  action: "/aksiyonlar",
  checklist: "/otonom-bakim",
  spare_part: "/parcalar",
};

function referenceUrl(referenceType?: string, referenceId?: string): string | null {
  if (!referenceType || !referenceId) return null;
  const base = REFERENCE_ROUTES[referenceType];
  if (!base) return null;
  return `${base}/${referenceId}`;
}

// ---------------------------------------------------------------------------
// HTML email template
// ---------------------------------------------------------------------------

function renderEmailTemplate(opts: {
  userName: string;
  title: string;
  body: string;
  linkUrl: string | null;
}): { html: string; text: string } {
  const { userName, title, body, linkUrl } = opts;

  const linkSection = linkUrl
    ? `
    <tr>
      <td style="padding: 0 32px 24px;">
        <a href="${linkUrl}"
           style="display:inline-block;padding:10px 20px;background:#2563eb;color:#ffffff;
                  text-decoration:none;border-radius:6px;font-size:14px;font-weight:600;">
          Görüntüle
        </a>
      </td>
    </tr>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0"
               style="background:#ffffff;border-radius:8px;overflow:hidden;
                      box-shadow:0 1px 3px rgba(0,0,0,.1);">
          <!-- Header -->
          <tr>
            <td style="background:#1e3a5f;padding:20px 32px;">
              <p style="margin:0;font-size:20px;font-weight:700;color:#ffffff;">
                MaintainPro
              </p>
              <p style="margin:4px 0 0;font-size:12px;color:#94b4d4;">
                Bakım Yönetim Sistemi
              </p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px 32px 8px;">
              <p style="margin:0 0 8px;font-size:16px;color:#111827;">
                Merhaba ${userName},
              </p>
              <h2 style="margin:0 0 12px;font-size:18px;color:#111827;">${title}</h2>
              <p style="margin:0;font-size:14px;color:#374151;line-height:1.6;">${body}</p>
            </td>
          </tr>
          ${linkSection}
          <!-- Footer -->
          <tr>
            <td style="padding:16px 32px;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">
                Bu e-posta MaintainPro tarafından otomatik olarak gönderilmiştir.
                Lütfen bu e-postayı yanıtlamayınız.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    `MaintainPro — ${title}`,
    "",
    `Merhaba ${userName},`,
    "",
    body,
    ...(linkUrl ? ["", `Bağlantı: ${linkUrl}`] : []),
    "",
    "Bu e-posta MaintainPro tarafından otomatik olarak gönderilmiştir.",
  ].join("\n");

  return { html, text };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Low-level send. Skips silently when SMTP_HOST is not configured.
 */
export async function sendEmail(opts: SendEmailOptions): Promise<void> {
  const transporter = getTransporter();

  if (!transporter) {
    console.log(
      `[email-service] SMTP not configured — skipping email to ${opts.to}: ${opts.subject}`,
    );
    return;
  }

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM ?? "noreply@maintainpro.app",
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    });
  } catch (err) {
    // Log but don't propagate — email failure must not break the main flow
    console.error("[email-service] Failed to send email:", err);
  }
}

/**
 * Higher-level helper: renders a branded HTML template and sends.
 *
 * @param user  - Recipient's email and display name
 * @param notification - Title, body, and optional polymorphic reference for deep-link
 */
export async function sendNotificationEmail(
  user: { email: string; name: string },
  notification: {
    title: string;
    body: string;
    referenceType?: string;
    referenceId?: string;
  },
): Promise<void> {
  const linkUrl = referenceUrl(notification.referenceType, notification.referenceId);
  const { html, text } = renderEmailTemplate({
    userName: user.name,
    title: notification.title,
    body: notification.body,
    linkUrl,
  });

  await sendEmail({
    to: user.email,
    subject: `MaintainPro: ${notification.title}`,
    html,
    text,
  });
}
