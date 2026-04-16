"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, RotateCcw, Home, ChevronDown, ChevronUp } from "lucide-react";
import Link from "next/link";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: ErrorPageProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const isDev = process.env.NODE_ENV === "development";

  useEffect(() => {
    // Log to console in development for easier debugging
    console.error("[GlobalError]", error);
  }, [error]);

  return (
    <html lang="tr">
      <body className="min-h-screen bg-background text-foreground font-sans">
        <div className="flex min-h-screen items-center justify-center p-4">
          <div className="w-full max-w-md">
            {/* Icon */}
            <div className="flex justify-center mb-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="h-8 w-8 text-destructive" aria-hidden="true" />
              </div>
            </div>

            {/* Heading */}
            <div className="text-center mb-6">
              <h1 className="text-2xl font-semibold text-foreground mb-2">
                Bir hata oluştu
              </h1>
              <p className="text-muted-foreground text-sm">
                Beklenmedik bir sorun yaşandı. Lütfen sayfayı yenilemeyi deneyin.
              </p>
              {error.digest && (
                <p className="mt-2 text-xs text-muted-foreground font-mono">
                  Hata kodu: {error.digest}
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-3">
              <button
                onClick={reset}
                className="flex items-center justify-center gap-2 w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Tekrar Dene
              </button>

              <Link
                href="/panel"
                className="flex items-center justify-center gap-2 w-full rounded-md border border-input bg-background px-4 py-2.5 text-sm font-medium hover:bg-muted transition-colors"
              >
                <Home className="h-4 w-4" aria-hidden="true" />
                Ana Sayfaya Dön
              </Link>
            </div>

            {/* Error details (development only) */}
            {isDev && (
              <div className="mt-6 rounded-md border border-border overflow-hidden">
                <button
                  onClick={() => setDetailsOpen((o) => !o)}
                  className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
                >
                  <span>Hata detayları (geliştirme modu)</span>
                  {detailsOpen ? (
                    <ChevronUp className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <ChevronDown className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
                {detailsOpen && (
                  <div className="px-4 py-3 bg-muted/50 border-t border-border overflow-auto max-h-64">
                    <p className="text-xs font-semibold text-destructive mb-1">
                      {error.name}: {error.message}
                    </p>
                    {error.stack && (
                      <pre className="text-xs text-muted-foreground whitespace-pre-wrap break-all">
                        {error.stack}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </body>
    </html>
  );
}
