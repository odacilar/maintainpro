# Bildirimler (Notifications)

## Amaç

MaintainPro'nun bildirim sistemi, fabrika içi olayları (arıza açılması, atama, durum değişikliği, stok uyarısı vb.) gerçek zamanlı olarak ilgili kullanıcılara iletir. MVP aşamasında yalnızca uygulama içi (IN_APP) kanal aktif olup FCM push ve AWS SES e-posta kanalları Sprint 6 kapsamında eklenecektir.

---

## Mimari Genel Bakış

```
[Domain Servis]
    │
    ▼ events.publish(event)
[InMemoryBus]  ──subscribe("*")──▶  [NotificationHandler]
    │                                      │
    │                                      ▼
    │                              createNotifications(tx, [...])
    │                                      │
    │                                      ▼
    │                              notifications tablosu (IN_APP)
    │
    └─subscribe("factory:<id>")──▶  [SSE /api/events/stream]
                                           │
                                           ▼
                                    Browser EventSource
```

### Bileşenler

| Dosya | Sorumluluk |
|---|---|
| `src/lib/events/types.ts` | `DomainEvent` tip tanımları |
| `src/lib/events/bus.ts` | `EventBus` arayüzü |
| `src/lib/events/in-memory.ts` | `InMemoryBus` gerçekleştirimi |
| `src/lib/events/index.ts` | Tekil bus örneği (`events` sabiti) |
| `src/lib/notifications/event-handler.ts` | Event → bildirim dönüştürme mantığı |
| `src/lib/notifications/index.ts` | `initNotifications()` giriş noktası |
| `src/lib/services/notification-service.ts` | DB yazma ve alıcı hesaplama |
| `src/app/api/events/stream/route.ts` | SSE akış endpoint'i |
| `src/app/api/notifications/route.ts` | Bildirim listeleme API |
| `src/app/api/notifications/count/route.ts` | Okunmamış sayaç API |
| `src/app/api/notifications/read/route.ts` | Okundu işaretleme API |

---

## Domain Event Sistemi

### EventBus Arayüzü

```typescript
// src/lib/events/bus.ts
export interface EventBus {
  publish(event: DomainEvent): Promise<void>;
  subscribe(channel: string, handler: EventHandler): Unsubscribe;
}
```

### InMemoryBus

```typescript
// src/lib/events/in-memory.ts
export class InMemoryBus implements EventBus {
  private emitter = new EventEmitter();

  async publish(event: DomainEvent): Promise<void> {
    const channel = channelFor(event.factoryId);
    this.emitter.emit(channel, event);  // fabrika kanalı
    this.emitter.emit("*", event);      // wildcard kanal
  }

  subscribe(channel: string, handler: EventHandler): Unsubscribe {
    this.emitter.on(channel, handler);
    return () => this.emitter.off(channel, handler);
  }
}
```

**Kanal mantığı:**

```typescript
// channelFor(factoryId) sonucu:
// factoryId varsa  → "factory:<uuid>"
// factoryId yoksa  → "platform"
```

**Önemli Not:** `InMemoryBus`, tek process içinde çalışır ve MVP için yeterlidir (tek App Runner konteyneri). Yatay ölçekleme gerektiğinde `PostgresListenNotifyBus` ile değiştirilebilir.

### Tekil Bus Örneği

```typescript
// src/lib/events/index.ts
export const events: EventBus = global.__eventBus ?? create();
```

Geliştirme ortamında HMR (Hot Module Replacement) sırasında bus örneğinin yeniden oluşturulmaması için `global.__eventBus` üzerinden paylaşılır.

---

## Olay Tipleri

### DomainEvent Tanımları

```typescript
// src/lib/events/types.ts

type DomainEventBase = {
  id: string;
  factoryId: string | null;
  occurredAt: string;
  actorId: string | null;
};

type BreakdownEvent =
  | { type: "breakdown.created";      breakdownId: string; machineId: string; priority: string }
  | { type: "breakdown.status_changed"; breakdownId: string; fromStatus: string | null; toStatus: string }
  | { type: "breakdown.assigned";     breakdownId: string; assigneeId: string };

type MachineEvent =
  | { type: "machine.created";        machineId: string }
  | { type: "machine.updated";        machineId: string }
  | { type: "machine.status_changed"; machineId: string; status: string };

type StockEvent =
  | { type: "stock.movement";         sparePartId: string; movementType: string; delta: number; newBalance: number }
  | { type: "stock.minimum_reached";  sparePartId: string; currentStock: number };

type ChecklistEvent =
  | { type: "checklist.completed";    recordId: string; machineId: string }
  | { type: "action.created";         actionId: string; recordId: string }
  | { type: "action.status_changed";  actionId: string; toStatus: string };
```

### Hangi Olaylar Bildirim Üretir?

| Olay Tipi | Bildirim Başlığı | Alıcı Kuralı |
|---|---|---|
| `breakdown.created` | "Yeni arıza bildirimi" | Aynı departmandaki FACTORY_ADMIN + ENGINEER (aktörü hariç) |
| `breakdown.assigned` | "Size arıza atandı" | Yalnızca atanan kullanıcı |
| `breakdown.status_changed` | "Arıza durumu güncellendi" | Reporter + Assignee (aktörü hariç) |
| `stock.minimum_reached` | "Stok uyarısı" | FACTORY_ADMIN + ENGINEER (tüm fabrika) |
| `action.created` | "Yeni aksiyon oluşturuldu" | FACTORY_ADMIN + ENGINEER (aktörü hariç) |
| `checklist.completed` | "Checklist tamamlandı" | Yalnızca ENGINEER (aktörü hariç) |

**Bildirim üretmeyen olaylar (MVP kapsamı dışı):**
- `machine.created`, `machine.updated`, `machine.status_changed`
- `stock.movement`
- `action.status_changed`

---

## Event → Notification Akışı

### Başlatma

Uygulama ayağa kalkarken `initNotifications()` bir kez çağrılır:

```typescript
// src/lib/notifications/index.ts
export function initNotifications(): void {
  if (initialized) return;
  initialized = true;
  setupNotificationHandlers();
}
```

`setupNotificationHandlers()` wildcard kanalını (`"*"`) dinler ve gelen her olayı ilgili handler fonksiyonuna yönlendirir.

### Handler Güvenlik Modeli

Her handler `safeHandle()` sarmalayıcısı içinde çalışır:

```typescript
async function safeHandle(factoryId: string, fn: () => Promise<void>): Promise<void> {
  try {
    await runWithTenant(
      { userId: "system", role: "FACTORY_ADMIN", factoryId, bypassRls: true },
      fn,
    );
  } catch (err) {
    console.error("[notifications] handler error", err);
  }
}
```

- Hata fırlatılırsa event publisher'a yayılmaz; yalnızca loglanır.
- `bypassRls: true` ile handler, kullanıcı/makine tablolarını okuyabilir.
- Bildirim satırları yine de `factoryId` sütunuyla kapsamlıdır.

### Alıcı Belirleme Mantığı

`getNotificationRecipients()` fonksiyonu rol bazlı alıcı listesini hesaplar:

```typescript
// Kural tablosu (spec §9):
// checklist.*  → [ENGINEER]
// breakdown.*  → [FACTORY_ADMIN, ENGINEER]
// stock.*      → [FACTORY_ADMIN, ENGINEER]
// action.*     → [FACTORY_ADMIN, ENGINEER]
```

Filtreleme seçenekleri:

| Parametre | Açıklama |
|---|---|
| `departmentId` | Yalnızca o departmandaki kullanıcılar (breakdown.created için) |
| `excludeUserId` | Olayı tetikleyen aktör dışarıda bırakılır |
| `isActive: true` | Yalnızca aktif hesaplar bildirim alır |

---

## Bildirim Kanalları

### Mevcut: IN_APP

Tüm bildirimler `channel: "IN_APP"` değeriyle `notifications` tablosuna toplu yazılır (`createMany`). SSE stream aracılığıyla tarayıcıya iletilir.

### Gelecek: FCM Push + AWS SES (Sprint 6)

`createNotifications()` fonksiyonunun yorumunda belirtildiği üzere, FCM ve SES kanalları AWS altyapısı kurulduktan sonra eklenecektir. Mimari bu kanalları destekleyecek şekilde tasarlanmıştır.

---

## SSE ile Gerçek Zamanlı Streaming

### Endpoint

```
GET /api/events/stream
Authorization: NextAuth oturumu zorunlu
```

Bağlantı kurulduğunda:

1. `channelFor(session.user.factoryId)` ile fabrikaya özgü kanal hesaplanır.
2. `InMemoryBus.subscribe(channel, send)` ile olaylar dinlenmeye başlanır.
3. `25 saniyede bir` heartbeat (`": ping"`) gönderilir.
4. Bağlantı kesildiğinde `cancel()` tetiklenir, abonelik ve interval temizlenir.

**SSE Mesaj Formatı:**

```
event: breakdown.created
data: {"id":"...","type":"breakdown.created","factoryId":"...","breakdownId":"...","machineId":"...","priority":"HIGH","occurredAt":"...","actorId":"..."}

: ping

: connected factory:<uuid>
```

**Response Headers:**

```
Content-Type: text/event-stream
Cache-Control: no-cache, no-transform
Connection: keep-alive
X-Accel-Buffering: no
```

`X-Accel-Buffering: no` Nginx/proxy tamponlamasını devre dışı bırakır.

### Frontend Kullanımı (Örnek)

```typescript
const source = new EventSource("/api/events/stream");

source.addEventListener("breakdown.created", (e) => {
  const event = JSON.parse(e.data);
  // bildirim badge'ini güncelle, toast göster
});

source.onerror = () => {
  // bağlantı koptu; tarayıcı otomatik yeniden bağlanır
};
```

---

## API Endpoints

### GET /api/notifications

Oturum açmış kullanıcının bildirimlerini listeler.

**Yetkili Roller:** `FACTORY_ADMIN`, `ENGINEER`, `TECHNICIAN`

**Query Parametreleri:**

| Parametre | Tip | Varsayılan | Açıklama |
|---|---|---|---|
| `unreadOnly` | `boolean` | `false` | `true` ise yalnızca okunmamışları döner |
| `limit` | `integer` | `20` | Sayfa boyutu (1–100) |
| `offset` | `integer` | `0` | Atlama sayısı |

**Başarılı Yanıt (200):**

```json
{
  "notifications": [
    {
      "id": "clx...",
      "eventType": "breakdown.created",
      "title": "Yeni arıza bildirimi",
      "body": "Pres-01 makinesinde Yüksek öncelikli yeni arıza oluşturuldu.",
      "referenceType": "breakdown",
      "referenceId": "clx...",
      "readAt": null,
      "createdAt": "2026-04-13T08:30:00.000Z"
    }
  ],
  "unreadCount": 5
}
```

**Sıralama:** `createdAt DESC` (en yeni önce)

---

### GET /api/notifications/count

Üst bar rozet sayaç değerini döner.

**Yetkili Roller:** `FACTORY_ADMIN`, `ENGINEER`, `TECHNICIAN`

**Başarılı Yanıt (200):**

```json
{ "count": 3 }
```

Yalnızca `channel = "IN_APP"` ve `readAt IS NULL` olan satırları sayar.

---

### POST /api/notifications/read

Bildirimleri okundu olarak işaretler.

**Yetkili Roller:** `FACTORY_ADMIN`, `ENGINEER`, `TECHNICIAN`

**İstek Gövdesi (iki form):**

```json
// Tümünü okundu işaretle:
{ "all": true }

// Belirli bildirimleri okundu işaretle:
{ "ids": ["clx...", "cly..."] }
```

**İş Kuralları:**

- Bir kullanıcı yalnızca kendi bildirimlerini okundu işaretleyebilir (`userId` doğrulaması yapılır).
- Zaten okunmuş bildirimler etkilenmez (`readAt IS NULL` koşulu).

**Başarılı Yanıt (200):**

```json
{ "success": true }
```

---

## Dosya Haritası

```
src/
├── lib/
│   ├── events/
│   │   ├── types.ts           # DomainEvent tip tanımları
│   │   ├── bus.ts             # EventBus arayüzü
│   │   ├── in-memory.ts       # InMemoryBus gerçekleştirimi
│   │   └── index.ts           # Tekil `events` örneği (global singleton)
│   ├── notifications/
│   │   ├── event-handler.ts   # Olay → bildirim dönüştürme (6 handler)
│   │   └── index.ts           # initNotifications() giriş noktası
│   └── services/
│       └── notification-service.ts  # createNotifications(), getNotificationRecipients()
└── app/
    └── api/
        ├── events/
        │   └── stream/route.ts      # GET /api/events/stream (SSE)
        └── notifications/
            ├── route.ts             # GET /api/notifications
            ├── count/route.ts       # GET /api/notifications/count
            └── read/route.ts        # POST /api/notifications/read
```

---

## İş Kuralları

1. **Aktör dışlama:** Olayı tetikleyen kullanıcı kendi bildirimini almaz (`excludeUserId = actorId`).
2. **Departman yönlendirme:** `breakdown.created` olayında bildirim, makineyle aynı departmandaki kullanıcılara gönderilir; departman bağlantısı yoksa tüm fabrika alıcıları kullanılır.
3. **Yalnızca aktif kullanıcılar:** `isActive: false` olan hesaplar alıcı listesine dahil edilmez.
4. **Atama bildirimi tekli:** `breakdown.assigned` olayı yalnızca atanan kişiye bildirim gönderir; departman broadcast'ı yoktur.
5. **Hata izolasyonu:** Bildirim handler'ında oluşan hata asıl olayın işlenmesini durdurmaz.
6. **Kanal kısıtlaması:** Şu an tüm CRUD işlemleri `channel = "IN_APP"` filtresiyle çalışır; gelecekte FCM/SES için aynı tablo satır başına farklı `channel` değeri taşıyacaktır.
7. **Çapraz fabrika koruma:** Handler'lar `factoryId` doğrulaması yapar; `factoryId` boş olan olaylar işlenmez.

---

## PWA Desteği (Sprint 6 Kapsamı)

Web push bildirimleri ve çevrimdışı önbellek aşağıdaki Sprint 6 bileşenleriyle eklenecektir:

- `public/manifest.json` — PWA manifest
- `public/service-worker.js` — FCM background message handler + IndexedDB offline cache
- FCM token kayıt API'si (kullanıcı cihaz token'ı)
- Kullanıcı bildirim tercihleri (kanal başına açık/kapalı, sessiz saatler)

Mevcut SSE altyapısı PWA geliştirmesi sırasında korunacaktır; FCM yalnızca ek bir dağıtım kanalı olarak eklenecektir.
