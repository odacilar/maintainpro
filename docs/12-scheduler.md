# Scheduler — Zamanlayıcı ve Cron İşleri

## Amaç

MaintainPro'nun periyodik arka plan görevlerini yönetir:

- **Arıza Eskalasyonu**: Yanıtsız arızaları belirli aralıklarla eskalasyona taşır.
- **Kaçırılan Kontrol Listesi**: Yapılmayan kontrol listelerini `missed` durumuna alır.
- **PM İş Emri Üretimi**: Vadesi gelen önleyici bakım planları için iş emirleri oluşturur.

---

## Mimari

```
┌─────────────────────────────────────────────────────────┐
│  scheduler-service.ts         (iş mantığı)              │
│  runBreakdownEscalation()                               │
│  runMissedChecklistMarking()                            │
│  runPmWorkOrderGeneration()                             │
└────────────────┬────────────────────────────────────────┘
                 │
       ┌─────────┴───────────────────────────┐
       │ Prod (harici cron)                  │ Dev (in-process)
       │ POST /api/cron/escalation           │ dev-scheduler.ts
       │ POST /api/cron/missed-checklists    │ setInterval × 3
       │ POST /api/cron/pm-generate          │
       │ (AWS EventBridge → App Runner)      │ instrumentation.ts
       └─────────────────────────────────────┘
```

---

## Servis Fonksiyonları

### `runBreakdownEscalation(): Promise<{ escalated: number }>`

**Amaç:** `OPEN` durumdaki tüm arızaları tarar ve kritik süre eşiklerini aşmış olanları eskalasyona taşır.

**Eşikler:**

| Süre | Eskalasyon Hedefi | Yalnızca Critical mi? |
|------|-------------------|-----------------------|
| > 30 dk | ENGINEER | Hayır |
| > 60 dk | FACTORY_ADMIN | Hayır |
| > 120 dk | SUPER_ADMIN | Evet (priority=CRITICAL) |

**Yineleme Koruması:** Her eskalasyon seviyesi için `breakdown_timeline` tablosuna `escalation:engineer`, `escalation:factory_admin`, `escalation:super_admin` etiketli satır yazılır. Aynı etiket varsa bildirim tekrar gönderilmez.

**Yan Etkiler:**
- `breakdown_timeline`'a escalation satırı yazar.
- `notification` tablosuna `IN_APP` bildirim oluşturur.
- `breakdown.escalated` domain event yayınlar.

### `runMissedChecklistMarking(): Promise<{ marked: number }>`

**Amaç:** `status = "pending"` ve `scheduledFor < now` olan checklist kayıtlarını `"missed"` yapar.

**Yan Etkiler:**
- `checklistRecord.status` alanını `"missed"` olarak günceller.
- Atanan kullanıcıya `checklist.missed` tipinde `IN_APP` bildirim gönderir.

### `runPmWorkOrderGeneration(): Promise<{ created: number }>`

**Amaç:** Aktif PM planlarına sahip tüm fabrikalar için vadesi gelen planlardan iş emri oluşturur.

**Yan Etkiler:**
- `workOrder` tablosuna `status=PLANNED` satır ekler.
- `pmPlan.nextDueAt` değerini günceller (intervalDays kadar ilerletir).
- Varsa mevcut `PLANNED` iş emri olan plana duplicate oluşturmaz.

---

## Cron API Endpoint'leri

Üç endpoint de aynı koruma mekanizmasını kullanır:

```
Authorization: Bearer {CRON_SECRET}
```

`CRON_SECRET` ortam değişkeni tanımlanmamışsa, geliştirme modunda kimlik doğrulama atlanır.

| Endpoint | Yöntem | Döner |
|----------|--------|-------|
| `/api/cron/escalation` | POST | `{ escalated: number }` |
| `/api/cron/missed-checklists` | POST | `{ marked: number }` |
| `/api/cron/pm-generate` | POST | `{ created: number }` |

**AWS EventBridge örnek cron ifadesi:**

```
rate(5 minutes)   → POST /api/cron/escalation
rate(15 minutes)  → POST /api/cron/missed-checklists
rate(1 hour)      → POST /api/cron/pm-generate
```

**cURL örneği:**

```bash
curl -X POST https://your-app.com/api/cron/escalation \
  -H "Authorization: Bearer $CRON_SECRET"
```

---

## Geliştirme Modu (Dev Scheduler)

`src/lib/scheduler/dev-scheduler.ts` dosyası yalnızca `NODE_ENV === "development"` ortamında çalışır.

`src/instrumentation.ts` aracılığıyla Next.js sunucu başlangıcında otomatik olarak devreye girer.

**Aralıklar:**

| Görev | Aralık |
|-------|--------|
| Arıza eskalasyonu | 5 dakika |
| Kaçırılan kontrol listesi | 15 dakika |
| PM iş emri üretimi | 1 saat |

**Başlatma / Durdurma (manuel):**

```typescript
import { start, stop } from "@/lib/scheduler/dev-scheduler";

start(); // Başlat
stop();  // Durdur
```

---

## Ortam Değişkenleri

| Değişken | Açıklama | Zorunlu |
|----------|----------|---------|
| `CRON_SECRET` | Cron endpoint koruması için paylaşılan secret | Prod'da evet |
| `NODE_ENV` | `development` ise dev-scheduler devreye girer | Hayır |

---

## Edge Case'ler

- **Race condition:** Escalation, timeline satırı kontrolünü transaction içinde yapar — paralel cron çalışmalarında duplicate oluşmaz.
- **Fabrika hatası:** `runPmWorkOrderGeneration` her fabrikayı ayrı `try/catch` ile işler; bir fabrikada hata diğer fabrikaları engellemez.
- **Super Admin yoksa:** Eskalasyon bildirimi oluşturulamaz, hata loglanır ve döngü devam eder.
- **Checklist `in_progress` kaydı:** `"pending"` filtresi kullanıldığından başlatılmış ama bitmemiş kayıtlar `missed` yapılmaz.
