"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Camera, CameraOff } from "lucide-react";

export default function QROkutPage() {
  const router = useRouter();
  const scannerRef = useRef<HTMLDivElement>(null);
  const html5QrRef = useRef<import("html5-qrcode").Html5Qrcode | null>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startScanner() {
    setError(null);
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode("qr-reader");
      html5QrRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          scanner.stop().catch(() => {});
          html5QrRef.current = null;
          setScanning(false);

          try {
            const url = new URL(decodedText);
            const mMatch = url.pathname.match(/^\/m\/(.+)$/);
            if (mMatch) {
              router.push(`/m/${mMatch[1]}`);
              return;
            }
          } catch {
            // not a URL
          }
          setError(`Tanınmayan QR kod: ${decodedText}`);
        },
        () => {},
      );
      setScanning(true);
    } catch (err) {
      setError(
        err instanceof Error && err.message.includes("Permission")
          ? "Kamera izni verilmedi. Tarayıcı ayarlarından kamera iznini açın."
          : "Kamera başlatılamadı. Cihazınızda kamera olduğundan emin olun.",
      );
    }
  }

  function stopScanner() {
    html5QrRef.current?.stop().catch(() => {});
    html5QrRef.current = null;
    setScanning(false);
  }

  useEffect(() => {
    return () => {
      html5QrRef.current?.stop().catch(() => {});
    };
  }, []);

  return (
    <div className="max-w-md mx-auto space-y-4">
      <h1 className="text-2xl font-semibold">QR Kod Okut</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Makine QR Kodunu Tarayın</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            id="qr-reader"
            ref={scannerRef}
            className="w-full rounded-md overflow-hidden bg-black/5"
            style={{ minHeight: scanning ? 300 : 0 }}
          />

          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {!scanning ? (
            <Button className="w-full" onClick={startScanner}>
              <Camera className="h-4 w-4 mr-2" />
              Kamerayı Aç
            </Button>
          ) : (
            <Button variant="outline" className="w-full" onClick={stopScanner}>
              <CameraOff className="h-4 w-4 mr-2" />
              Kamerayı Kapat
            </Button>
          )}

          <p className="text-xs text-muted-foreground text-center">
            Makine üzerindeki QR kodu kameraya gösterin. Otomatik olarak arıza bildirimi sayfasına yönlendirileceksiniz.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
