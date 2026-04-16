# Dark Mode, Klavye Kısayolları ve Çevrimdışı Destek

## Amaç

Bu modül üç özelliği kapsar:

1. **Dark Mode** — kullanıcı başına tema tercihi (açık / koyu / sistem)
2. **Klavye Kısayolları** — global kısayollar ve komut paleti
3. **IndexedDB Offline Cache** — çevrimdışı veri önbelleği ve işlem kuyruğu

---

## 1. Dark Mode

### Bileşenler

| Dosya | Açıklama |
|-------|----------|
| `src/components/providers/theme-provider.tsx` | Tema context provider, localStorage kalıcılığı |
| `src/components/ui/theme-toggle.tsx` | Üçlü döngü (açık → koyu → sistem) butonu |

### ThemeProvider

`RootProviders` içine sarılmıştır; tüm bileşenler `useTheme()` hook'u ile temaya erişir.

```tsx
import { useTheme } from "@/components/providers/theme-provider";

const { theme, setTheme, resolvedTheme } = useTheme();
// theme: "light" | "dark" | "system"
// resolvedTheme: "light" | "dark"  (sistem tercihine göre çözümlenmiş)
```

### Parametreler / Değerler

| Değer | Açıklama |
|-------|----------|
| `"light"` | Her zaman açık tema |
| `"dark"` | Her zaman koyu tema |
| `"system"` | İşletim sistemi tercihini takip eder |

Tercih `localStorage` anahtarı `maintainpro-theme`'de saklanır. `.dark` sınıfı `document.documentElement` üzerine eklenir; CSS değişkenleri `globals.css` içindeki `.dark { … }` bloğu ile tanımlıdır.

### CSS Değişkenleri

`src/app/globals.css` içinde hem `:root` (açık) hem `.dark` (koyu) blokları mevcuttur. shadcn/ui bileşenleri bu değişkenlere otomatik olarak uyum sağlar.

---

## 2. Klavye Kısayolları

### Bileşenler

| Dosya | Açıklama |
|-------|----------|
| `src/lib/hooks/use-keyboard-shortcuts.ts` | Global kısayol dinleyicisi |
| `src/components/shell/command-palette.tsx` | Ctrl+K komut paleti |
| `src/components/shell/shortcuts-help.tsx` | Ctrl+/ yardım modalı |

### Kısayol Tablosu

| Kısayol | Eylem |
|---------|-------|
| `Ctrl+K` / `Cmd+K` | Komut paletini aç |
| `Ctrl+/` | Kısayol yardımını göster |
| `Esc` | Açık pencereyi kapat |
| `g` `h` | Pano'ya git (`/panel`) |
| `g` `m` | Makineler'e git |
| `g` `b` | Arızalar'a git |
| `g` `s` | Yedek Parçalar'a git |
| `g` `r` | Raporlar'a git |
| `n` `b` | Yeni arıza bildir |
| `n` `m` | Yeni makine ekle |

Ardışık kısayollar (chord) 1 saniye içinde tamamlanmalıdır. Odak `INPUT`, `TEXTAREA` veya `contenteditable` üzerindeyken chord'lar devre dışıdır.

### useKeyboardShortcuts

```typescript
useKeyboardShortcuts({
  onOpenSearch?: () => void,
  onOpenHelp?: () => void,
  onEscape?: () => void,
});
```

AppShell içinde kullanılır; callback'ler her render'da güncellense de listener yeniden kaydedilmez (ref pattern).

### CommandPalette

```tsx
<CommandPalette open={boolean} onClose={() => void} />
```

- Fuzzy search (büyük/küçük harf duyarsız, alt dize eşleşmesi)
- Ok tuşları + Enter ile gezinme
- Otomatik odak, Esc ile kapanır

---

## 3. IndexedDB Offline Cache

### Dosyalar

| Dosya | Açıklama |
|-------|----------|
| `src/lib/offline/indexed-db.ts` | IDB wrapper (cache + pending-actions) |
| `src/lib/offline/sync-service.ts` | Online olunca mutasyon tekrarı |
| `src/components/ui/offline-indicator.tsx` | Çevrimdışı durumu banneri |
| `public/sw.js` | Service worker (GET cache + POST queue) |

### IndexedDB Stores

| Store | Key | Kullanım |
|-------|-----|----------|
| `cache` | `key` (string) | GET yanıtları TTL ile |
| `pending-actions` | `id` (auto-inc) | Çevrimdışı iken gönderilemeyen mutasyonlar |

### Fonksiyonlar

```typescript
// Cache
getCachedResponse(key: string): Promise<unknown | null>
setCachedResponse(key: string, data: unknown, ttlMs?: number): Promise<void>

// Mutation queue
addPendingAction(action: { url, method, body, headers? }): Promise<void>
getPendingActions(): Promise<PendingAction[]>
removePendingAction(id: number): Promise<void>
```

### syncPendingActions

```typescript
syncPendingActions(): Promise<{ synced: number, failed: number }>
```

Online olunduğunda `window` `online` olayı tetiklenir, `startSyncListener()` bu olayı dinler. AppShell mount'ta `startSyncListener()` çağrılır.

### Service Worker Stratejileri

| İstek Türü | Strateji |
|------------|----------|
| API GET (`/api/*`) | Stale-while-revalidate (Cache API) |
| POST/PUT/DELETE (çevrimiçi) | Network first |
| POST/PUT/DELETE (çevrimdışı) | IndexedDB kuyruğuna ekle, 202 döndür |
| Navigasyon GET | Network first, cache fallback |

### OfflineIndicator Durumları

| Durum | Gösterim |
|-------|----------|
| `offline` | Sarı banner — çevrimdışı uyarısı |
| `syncing` | Mavi banner — dönen ikon |
| `synced` | Yeşil banner — senkronizasyon özeti (3 sn sonra kaybolur) |
| `online` | Görünmez |

### Edge Case'ler

- IndexedDB erişilemezse (private mode, storage quota) tüm operasyonlar sessizce başarısız olur.
- Service worker çevrimdışı modda 202 döndürür; uygulama UI'ı bunu başarı olarak işlemeli ve gerçek veri için tekrar ağ isteği yapmayı beklemelidir.
- Sunucu bir mutasyonu 4xx ile reddederse yine kuyruktan kaldırılır (sonsuz döngü önlemi).
