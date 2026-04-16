import Link from "next/link";
import { Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-background text-foreground">
      <div className="w-full max-w-md text-center">
        {/* 404 number */}
        <div className="mb-6">
          <span className="text-8xl font-bold text-muted-foreground/30 select-none leading-none">
            404
          </span>
        </div>

        {/* Heading */}
        <h1 className="text-2xl font-semibold text-foreground mb-3">
          Sayfa Bulunamadı
        </h1>
        <p className="text-muted-foreground text-sm mb-8">
          Aradığınız sayfa mevcut değil veya taşınmış olabilir.
        </p>

        {/* CTA */}
        <Link
          href="/panel"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Home className="h-4 w-4" aria-hidden="true" />
          Ana Sayfaya Dön
        </Link>
      </div>
    </div>
  );
}
