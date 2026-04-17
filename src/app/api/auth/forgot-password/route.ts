import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { unsafePrisma } from "@/lib/tenant/prisma";
import { sendEmail } from "@/lib/services/email-service";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const email = (body.email ?? "").trim().toLowerCase();

  if (!email) {
    return NextResponse.json({ error: "email_required" }, { status: 400 });
  }

  const user = await unsafePrisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, isActive: true },
  });

  if (!user || !user.isActive) {
    return NextResponse.json({ ok: true });
  }

  await unsafePrisma.passwordResetToken.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() },
  });

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  await unsafePrisma.passwordResetToken.create({
    data: { userId: user.id, token, expiresAt },
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "http://localhost:3000";
  const resetUrl = `${appUrl}/sifre-sifirla?token=${token}`;

  await sendEmail({
    to: email,
    subject: "MaintainPro — Şifre Sıfırlama",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="color:#1a56db">MaintainPro</h2>
        <p>Merhaba ${user.name},</p>
        <p>Şifrenizi sıfırlamak için aşağıdaki bağlantıya tıklayın. Bu bağlantı 1 saat geçerlidir.</p>
        <p style="text-align:center;margin:24px 0">
          <a href="${resetUrl}" style="background:#1a56db;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold">
            Şifremi Sıfırla
          </a>
        </p>
        <p style="font-size:12px;color:#6b7280">Bu isteği siz yapmadıysanız bu e-postayı görmezden gelebilirsiniz.</p>
      </div>
    `,
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}
