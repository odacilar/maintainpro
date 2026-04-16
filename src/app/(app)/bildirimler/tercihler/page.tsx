"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Loader2, CheckCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ChannelPrefs = { in_app: boolean; email: boolean; push: boolean };
type Preferences = Record<string, ChannelPrefs>;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EVENT_TYPE_LABELS: Record<string, string> = {
  "breakdown.created": "Yeni arıza bildirimi",
  "breakdown.assigned": "Arıza ataması",
  "breakdown.status_changed": "Arıza durumu değişikliği",
  "stock.minimum_reached": "Stok uyarısı",
  "action.created": "Yeni aksiyon",
  "checklist.completed": "Checklist tamamlandı",
};

const EVENT_TYPES = Object.keys(EVENT_TYPE_LABELS);

const CHANNELS: Array<{ key: keyof ChannelPrefs; label: string }> = [
  { key: "in_app", label: "Uygulama İçi" },
  { key: "email", label: "E-posta" },
  { key: "push", label: "Push Bildirim" },
];

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function fetchPreferences(): Promise<Preferences> {
  const res = await fetch("/api/notifications/preferences");
  if (!res.ok) throw new Error("Tercihler alınamadı");
  const data = (await res.json()) as { preferences: Preferences };
  return data.preferences;
}

async function savePreferences(prefs: Preferences): Promise<void> {
  const res = await fetch("/api/notifications/preferences", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(prefs),
  });
  if (!res.ok) throw new Error("Tercihler kaydedilemedi");
}

// ---------------------------------------------------------------------------
// Checkbox cell
// ---------------------------------------------------------------------------

function PrefCheckbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "h-5 w-5 rounded border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        checked
          ? "border-primary bg-primary text-primary-foreground"
          : "border-input bg-background hover:border-primary/60",
      )}
    >
      {checked && (
        <svg viewBox="0 0 10 8" fill="none" className="h-full w-full p-0.5">
          <path
            d="M1 4l3 3 5-6"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function BildirimTercihlerPage() {
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState(false);
  const [localPrefs, setLocalPrefs] = useState<Preferences | null>(null);

  const { data: serverPrefs, isLoading, isError } = useQuery({
    queryKey: ["notification-preferences"],
    queryFn: fetchPreferences,
    staleTime: 60_000,
  });

  // Use local edits if any, otherwise fall back to server data
  const prefs = localPrefs ?? serverPrefs;

  const saveMutation = useMutation({
    mutationFn: savePreferences,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-preferences"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  function handleChange(eventType: string, channel: keyof ChannelPrefs, value: boolean) {
    setSaved(false);
    setLocalPrefs((prev) => {
      const base = prev ?? serverPrefs ?? {};
      const current = base[eventType] ?? { in_app: true, email: true, push: true };
      return { ...base, [eventType]: { ...current, [channel]: value } };
    });
  }

  function handleToggleAll(channel: keyof ChannelPrefs, value: boolean) {
    setSaved(false);
    setLocalPrefs((prev) => {
      const base = prev ?? serverPrefs ?? {};
      const next: Preferences = {};
      for (const eventType of EVENT_TYPES) {
        const current = base[eventType] ?? { in_app: true, email: true, push: true };
        next[eventType] = { ...current, [channel]: value };
      }
      return next;
    });
  }

  function handleSave() {
    if (!prefs) return;
    saveMutation.mutate(prefs);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !prefs) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardContent className="py-12 text-center text-sm text-destructive">
          Tercihler yüklenemedi. Lütfen sayfayı yenileyin.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Bildirim Tercihleri</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Hangi olaylar için hangi kanallardan bildirim almak istediğinizi ayarlayın.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {saved && (
            <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium">
              <CheckCircle className="h-4 w-4" />
              Kaydedildi
            </span>
          )}
          <Button onClick={handleSave} disabled={saveMutation.isPending || !localPrefs}>
            {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Kaydet
          </Button>
        </div>
      </div>

      {/* Preferences table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Kanal Tercihleri
          </CardTitle>
          <CardDescription>
            Her olay türü için istediğiniz bildiri kanallarını seçin.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="py-3 pl-6 pr-4 text-left font-medium text-muted-foreground w-full">
                  Olay türü
                </th>
                {CHANNELS.map((ch) => (
                  <th
                    key={ch.key}
                    className="py-3 px-4 text-center font-medium text-muted-foreground whitespace-nowrap"
                  >
                    <div className="flex flex-col items-center gap-1.5">
                      {ch.label}
                      {/* Toggle-all column button */}
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          className="text-xs text-primary hover:underline"
                          onClick={() => handleToggleAll(ch.key, true)}
                        >
                          Tümü
                        </button>
                        <span className="text-muted-foreground">/</span>
                        <button
                          type="button"
                          className="text-xs text-muted-foreground hover:underline"
                          onClick={() => handleToggleAll(ch.key, false)}
                        >
                          Hiçbiri
                        </button>
                      </div>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {EVENT_TYPES.map((eventType) => {
                const current = prefs[eventType] ?? { in_app: true, email: true, push: true };
                return (
                  <tr key={eventType} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3.5 pl-6 pr-4 font-medium">
                      {EVENT_TYPE_LABELS[eventType] ?? eventType}
                      <span className="ml-2 text-xs text-muted-foreground font-mono">
                        {eventType}
                      </span>
                    </td>
                    {CHANNELS.map((ch) => (
                      <td key={ch.key} className="py-3.5 px-4 text-center">
                        <div className="flex justify-center">
                          <PrefCheckbox
                            checked={current[ch.key]}
                            onChange={(v) => handleChange(eventType, ch.key, v)}
                            label={`${EVENT_TYPE_LABELS[eventType]} — ${ch.label}`}
                          />
                        </div>
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Save error */}
      {saveMutation.isError && (
        <p className="text-sm text-destructive text-center">
          Tercihler kaydedilemedi. Lütfen tekrar deneyin.
        </p>
      )}
    </div>
  );
}
