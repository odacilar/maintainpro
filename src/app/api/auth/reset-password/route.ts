import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { unsafePrisma } from "@/lib/tenant/prisma";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { token, password } = body;

  if (!token || !password || password.length < 6) {
    return NextResponse.json(
      { error: "Geçersiz istek. Şifre en az 6 karakter olmalıdır." },
      { status: 400 },
    );
  }

  const resetToken = await unsafePrisma.passwordResetToken.findUnique({
    where: { token },
    include: { user: { select: { id: true, isActive: true } } },
  });

  if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
    return NextResponse.json(
      { error: "Bağlantı geçersiz veya süresi dolmuş. Lütfen tekrar şifre sıfırlama isteği gönderin." },
      { status: 400 },
    );
  }

  if (!resetToken.user.isActive) {
    return NextResponse.json({ error: "Hesap devre dışı." }, { status: 403 });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await unsafePrisma.$transaction([
    unsafePrisma.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash },
    }),
    unsafePrisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
