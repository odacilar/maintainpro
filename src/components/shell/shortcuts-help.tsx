"use client";

import { X } from "lucide-react";

interface ShortcutsHelpProps {
  open: boolean;
  onClose: () => void;
}

interface Shortcut {
  keys: string[];
  description: string;
}

const SHORTCUT_GROUPS: Array<{ heading: string; items: Shortcut[] }> = [
  {
    heading: "Genel",
    items: [
      { keys: ["Ctrl", "K"], description: "Komut paletini aç" },
      { keys: ["Ctrl", "/"], description: "Bu yardım penceresini aç" },
      { keys: ["Esc"], description: "Pencereyi kapat" },
    ],
  },
  {
    heading: "Sayfaya Git (g + …)",
    items: [
      { keys: ["g", "h"], description: "Pano" },
      { keys: ["g", "m"], description: "Makineler" },
      { keys: ["g", "b"], description: "Arızalar" },
      { keys: ["g", "s"], description: "Yedek Parçalar" },
      { keys: ["g", "r"], description: "Raporlar" },
    ],
  },
  {
    heading: "Yeni Oluştur (n + …)",
    items: [
      { keys: ["n", "b"], description: "Yeni Arıza Bildir" },
      { keys: ["n", "m"], description: "Yeni Makine Ekle" },
    ],
  },
];

function KeyBadge({ children }: { children: string }) {
  return (
    <kbd className="inline-flex items-center justify-center rounded border bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground shadow-sm">
      {children}
    </kbd>
  );
}

export function ShortcutsHelp({ open, onClose }: ShortcutsHelpProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md rounded-lg border bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="text-base font-semibold">Klavye Kısayolları</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Kapat"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="divide-y overflow-y-auto max-h-[70vh]">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.heading} className="px-5 py-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {group.heading}
              </p>
              <ul className="space-y-2">
                {group.items.map((item) => (
                  <li
                    key={item.description}
                    className="flex items-center justify-between gap-4"
                  >
                    <span className="text-sm">{item.description}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      {item.keys.map((k, i) => (
                        <span key={k} className="flex items-center gap-1">
                          {i > 0 && (
                            <span className="text-xs text-muted-foreground">+</span>
                          )}
                          <KeyBadge>{k}</KeyBadge>
                        </span>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t px-5 py-3 text-xs text-muted-foreground">
          Ardışık tuşlar (örn. g h) 1 saniye içinde basılmalıdır.
        </div>
      </div>
    </div>
  );
}
