"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function ForgotForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    }).catch(() => {});
    setLoading(false);
    setSent(true);
  }

  if (sent) {
    return (
      <div className="text-center space-y-3">
        <p className="text-sm">
          Eğer bu e-posta adresi sistemde kayıtlıysa, şifre sıfırlama bağlantısı gönderildi.
        </p>
        <Link href="/giris" className="text-sm text-primary underline">
          Giriş sayfasına dön
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">E-posta</Label>
        <Input
          id="email"
          type="email"
          placeholder="ornek@fabrika.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Gönderiliyor..." : "Sıfırlama Bağlantısı Gönder"}
      </Button>
      <p className="text-center">
        <Link href="/giris" className="text-sm text-muted-foreground hover:text-primary">
          Giriş sayfasına dön
        </Link>
      </p>
    </form>
  );
}

function ResetForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("Şifre en az 6 karakter olmalıdır.");
      return;
    }
    if (password !== confirm) {
      setError("Şifreler eşleşmiyor.");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    setLoading(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Bir hata oluştu.");
      return;
    }

    setDone(true);
    setTimeout(() => router.push("/giris"), 2000);
  }

  if (done) {
    return (
      <div className="text-center space-y-3">
        <p className="text-sm text-green-700">Şifreniz başarıyla güncellendi. Giriş sayfasına yönlendiriliyorsunuz...</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="password">Yeni Şifre</Label>
        <Input
          id="password"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm">Şifre Tekrar</Label>
        <Input
          id="confirm"
          type="password"
          placeholder="••••••••"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Kaydediliyor..." : "Şifreyi Güncelle"}
      </Button>
    </form>
  );
}

function SifreSifirlaContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  return (
    <Card>
      <CardHeader>
        <CardTitle>{token ? "Yeni Şifre Belirle" : "Şifremi Unuttum"}</CardTitle>
        <CardDescription>
          {token
            ? "Yeni şifrenizi girin."
            : "E-posta adresinizi girin, size şifre sıfırlama bağlantısı gönderelim."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {token ? <ResetForm token={token} /> : <ForgotForm />}
      </CardContent>
    </Card>
  );
}

export default function SifreSifirlaPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-primary">MaintainPro</h1>
          <p className="text-sm text-muted-foreground mt-1">Endüstriyel Bakım Yönetim Platformu</p>
        </div>
        <Suspense fallback={<div className="py-8 text-center text-muted-foreground text-sm">Yükleniyor...</div>}>
          <SifreSifirlaContent />
        </Suspense>
      </div>
    </div>
  );
}
