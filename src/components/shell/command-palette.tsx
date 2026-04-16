"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Wrench,
  AlertTriangle,
  Package,
  ClipboardCheck,
  CheckCircle,
  Calendar,
  BarChart2,
  Users,
  Bell,
  FileText,
  Search,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Page {
  label: string;
  href: string;
  icon: React.ElementType;
  keywords?: string;
}

const PAGES: Page[] = [
  { label: "Pano", href: "/panel", icon: LayoutDashboard, keywords: "dashboard ana sayfa" },
  { label: "Makineler", href: "/makineler", icon: Wrench, keywords: "machine equipment" },
  { label: "Arızalar", href: "/arizalar", icon: AlertTriangle, keywords: "breakdown ariza fault" },
  { label: "Arıza Bildir", href: "/arizalar/yeni", icon: AlertTriangle, keywords: "yeni ariza bildir new breakdown" },
  { label: "Yedek Parçalar", href: "/parcalar", icon: Package, keywords: "spare parts stok stock" },
  { label: "Otonom Bakım", href: "/otonom-bakim", icon: ClipboardCheck, keywords: "checklist autonomous maintenance" },
  { label: "Planlı Bakım", href: "/planli-bakim", icon: Calendar, keywords: "preventive maintenance pm" },
  { label: "İş Emirleri", href: "/is-emirleri", icon: FileText, keywords: "work order is emri" },
  { label: "Aksiyonlar", href: "/aksiyonlar", icon: CheckCircle, keywords: "actions aksiyon" },
  { label: "Raporlar", href: "/raporlar", icon: BarChart2, keywords: "reports analytics mtbf mttr" },
  { label: "Bildirimler", href: "/bildirimler", icon: Bell, keywords: "notifications" },
  { label: "Kullanıcılar", href: "/kullanicilar", icon: Users, keywords: "users kullanici team" },
];

function fuzzyMatch(query: string, page: Page): boolean {
  if (!query.trim()) return true;
  const q = query.toLowerCase();
  const haystack = `${page.label} ${page.keywords ?? ""}`.toLowerCase();
  return haystack.includes(q);
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const results = PAGES.filter((p) => fuzzyMatch(query, p));

  // Reset on open
  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Keep activeIndex in bounds when results change
  useEffect(() => {
    setActiveIndex((prev) => Math.min(prev, Math.max(0, results.length - 1)));
  }, [results.length]);

  function navigate(href: string) {
    router.push(href);
    onClose();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results[activeIndex]) {
        navigate(results[activeIndex].href);
      }
    } else if (e.key === "Escape") {
      onClose();
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-lg rounded-lg border bg-background shadow-2xl">
        {/* Search input */}
        <div className="flex items-center gap-3 border-b px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Sayfa veya özellik ara..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <button onClick={onClose} className="shrink-0 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Results */}
        <ul ref={listRef} className="max-h-80 overflow-y-auto py-2">
          {results.length === 0 && (
            <li className="px-4 py-6 text-center text-sm text-muted-foreground">
              Sonuç bulunamadı
            </li>
          )}
          {results.map((page, idx) => {
            const Icon = page.icon;
            return (
              <li key={page.href}>
                <button
                  className={cn(
                    "flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors",
                    idx === activeIndex
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-accent/60"
                  )}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => navigate(page.href)}
                >
                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span>{page.label}</span>
                </button>
              </li>
            );
          })}
        </ul>

        {/* Footer hint */}
        <div className="flex items-center gap-4 border-t px-4 py-2 text-xs text-muted-foreground">
          <span><kbd className="font-mono">↑↓</kbd> Gezin</span>
          <span><kbd className="font-mono">↵</kbd> Aç</span>
          <span><kbd className="font-mono">Esc</kbd> Kapat</span>
        </div>
      </div>
    </div>
  );
}
