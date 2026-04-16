# Dashboard (Pano)

## Amaç

Dashboard modülü, fabrika yöneticilerine ve mühendislere operasyonel durumu tek bir ekranda özetleyen KPI kartları ve grafikler sunar. Teknisyenler için ayrı, kişiselleştirilmiş bir pano mevcuttur. Tüm metrikler belirli bir zaman aralığı (varsayılan 30 gün) üzerinden hesaplanır ve sayfa yenilenmeden TanStack Query'nin periyodik yenileme mekanizmasıyla güncellenir.

---

## Mimari Genel Bakış

```
Browser (TanStack Query)
    │
    ├─ GET /api/dashboard/summary         ─▶ KPI kartları
    ├─ GET /api/dashboard/costs?days=30   ─▶ Maliyet özeti
    ├─ GET /api/dashboard/mttr?days=30    ─▶ MTTR ortalaması + günlük trend
    ├─ GET /api/dashboard/mtbf?days=30    ─▶ MTBF ortalaması + haftalık trend
    ├─ GET /api/dashboard/pareto?days=30  ─▶ Makine başına arıza sayısı
    ├─ GET /api/dashboard/breakdown-types?days=30 ─▶ Arıza tipi dağılımı
    ├─ GET /api/dashboard/department-downtime?days=30 ─▶ Departman duruş süresi
    └─ GET /api/dashboard/technician      ─▶ Teknisyen kişisel panosu
```

**Grafik kütüphanesi:** Recharts (`LineChart`, `BarChart`, `PieChart`)

**Erişim kontrolü:** Admin/Mühendis endpoint'leri `FACTORY_ADMIN` ve `ENGINEER` rollerine açıktır. Teknisyen endpoint'i yalnızca `TECHNICIAN` rolüne açıktır.

---

## Admin Dashboard Genel Bakış

Bileşen: `src/app/(app)/panel/_components/admin-dashboard.tsx`

Admin dashboard dört satır halinde düzenlenmiştir:

| Satır | İçerik |
|---|---|
| Satır 1 | 4 KPI kartı (aktif arızalar, bugün çözülen, MTTR, yedek parça maliyeti) |
| Satır 2 | MTTR trend çizgi grafiği + Makine durumu donut grafiği |
| Satır 3 | Pareto yatay çubuk grafiği + Departman duruş sütun grafiği |
| Satır 4 | Kritik stok uyarıları listesi + Otonom bakım uyumu + Açık aksiyonlar |

**Veri yenileme aralıkları:**

| Veri | `refetchInterval` |
|---|---|
| summary (KPI kartları) | 60 saniye |
| technician dashboard | 30 saniye |
| Diğerleri | Yenileme yok (manuel veya sayfa açılışında bir kez) |

---

## Teknisyen Dashboard

Bileşen: `src/app/(app)/panel/_components/technician-dashboard.tsx`

Teknisyen panosu mobil-öncelikli tasarlanmıştır ve dört bölümden oluşur:

### Bölüm 1: Bana Atanan Arızalar

- `status NOT IN ("CLOSED")` olan ve `assigneeId = currentUserId` koşulunu sağlayan arızalar.
- Sıralama: `CRITICAL > HIGH > MEDIUM > LOW`, ardından `reportedAt ASC`.
- Her kart üzerinde tek tıkla durum geçişi düğmesi:
  - `ASSIGNED` → "Başla" düğmesi → `IN_PROGRESS`
  - `IN_PROGRESS` → "Tamamla" → arıza detay sayfasına yönlendirme
  - `WAITING_PARTS` → "Parça Geldi" → `IN_PROGRESS`

### Bölüm 2: Bugünkü Kontroller

- Bugün için zamanlanmış ve `userId = currentUserId` olan checklist kayıtları.
- Üstte ilerleme çubuğu: `tamamlanan / toplam`.
- `pending` → "Başla", `in_progress` → "Devam Et" bağlantıları.

### Bölüm 3: Hızlı İşlem

- "Hızlı Arıza Bildir" → `/arizalar/yeni`
- "QR Tara" → `/arizalar/yeni?qr=1`

### Bölüm 4: Son Aktiviteler

- Son 7 güne ait `breakdownTimeline` girişleri (en fazla 10 satır), `createdAt DESC` sıralamasıyla.

---

## API Endpoints

### GET /api/dashboard/summary

**Yetkili Roller:** `FACTORY_ADMIN`, `ENGINEER`

**Query Parametresi:** Yok

**Başarılı Yanıt (200):**

```json
{
  "activeBreakdowns": 7,
  "resolvedToday": 3,
  "machineStatus": {
    "running": 42,
    "broken": 5,
    "inMaintenance": 2,
    "decommissioned": 1
  },
  "unreadNotifications": 4,
  "lowStockParts": 6,
  "checklistComplianceToday": {
    "completed": 8,
    "total": 10,
    "rate": 80.0
  },
  "openActions": 12
}
```

---

### GET /api/dashboard/costs

**Yetkili Roller:** `FACTORY_ADMIN`, `ENGINEER`

**Query Parametreleri:**

| Parametre | Tip | Varsayılan | Açıklama |
|---|---|---|---|
| `days` | `integer` | `30` | Analiz edilecek gün sayısı (min: 1) |

**Başarılı Yanıt (200):**

```json
{
  "totalCost": 15420.50,
  "previousPeriodCost": 12100.00,
  "changePercent": 27.4,
  "byDepartment": [
    { "departmentName": "Mekanik Atölye", "cost": 8200.00 },
    { "departmentName": "Elektrik Atölye", "cost": 7220.50 }
  ]
}
```

---

### GET /api/dashboard/mttr

**Yetkili Roller:** `FACTORY_ADMIN`, `ENGINEER`

**Query Parametreleri:**

| Parametre | Tip | Varsayılan | Açıklama |
|---|---|---|---|
| `days` | `integer` | `30` | Analiz edilecek gün sayısı |

**Başarılı Yanıt (200):**

```json
{
  "averageMinutes": 87.5,
  "trend": [
    { "date": "2026-04-01", "avgMinutes": 95.2 },
    { "date": "2026-04-02", "avgMinutes": 73.0 }
  ]
}
```

---

### GET /api/dashboard/mtbf

**Yetkili Roller:** `FACTORY_ADMIN`, `ENGINEER`

**Query Parametreleri:**

| Parametre | Tip | Varsayılan | Açıklama |
|---|---|---|---|
| `days` | `integer` | `30` | Analiz edilecek gün sayısı |

**Başarılı Yanıt (200):**

```json
{
  "averageHours": 168.3,
  "trend": [
    { "week": "2026-W14", "avgHours": 210.0 },
    { "week": "2026-W15", "avgHours": 140.0 }
  ]
}
```

---

### GET /api/dashboard/pareto

**Yetkili Roller:** `FACTORY_ADMIN`, `ENGINEER`

**Query Parametreleri:**

| Parametre | Tip | Varsayılan | Açıklama |
|---|---|---|---|
| `days` | `integer` | `30` | Analiz edilecek gün sayısı |
| `limit` | `integer` | `10` | Döndürülecek maksimum makine sayısı (1–100) |

**Başarılı Yanıt (200):**

```json
{
  "data": [
    {
      "machineId": "clx...",
      "machineName": "Hidrolik Pres #1",
      "machineCode": "MK-001",
      "breakdownCount": 12,
      "totalDowntimeMinutes": 840
    }
  ]
}
```

---

### GET /api/dashboard/breakdown-types

**Yetkili Roller:** `FACTORY_ADMIN`, `ENGINEER`

**Query Parametreleri:**

| Parametre | Tip | Varsayılan | Açıklama |
|---|---|---|---|
| `days` | `integer` | `30` | Analiz edilecek gün sayısı |

**Başarılı Yanıt (200):**

```json
{
  "data": [
    { "type": "MECHANICAL", "count": 18 },
    { "type": "ELECTRICAL", "count": 9 },
    { "type": "HYDRAULIC",  "count": 5 }
  ]
}
```

---

### GET /api/dashboard/department-downtime

**Yetkili Roller:** `FACTORY_ADMIN`, `ENGINEER`

**Query Parametreleri:**

| Parametre | Tip | Varsayılan | Açıklama |
|---|---|---|---|
| `days` | `integer` | `30` | Analiz edilecek gün sayısı |

**Başarılı Yanıt (200):**

```json
{
  "data": [
    {
      "departmentId": "clx...",
      "departmentName": "Mekanik Atölye",
      "totalDowntimeMinutes": 1240,
      "breakdownCount": 8
    }
  ]
}
```

---

### GET /api/dashboard/technician

**Yetkili Roller:** `TECHNICIAN`

**Query Parametresi:** Yok

**Başarılı Yanıt (200):**

```json
{
  "assignedBreakdowns": [ /* BreakdownListItem dizisi */ ],
  "todayChecklists":    [ /* ChecklistRecord dizisi */ ],
  "recentActivity":     [ /* BreakdownTimeline dizisi (son 7 gün, maks 10) */ ]
}
```

---

## Formüller ve Hesaplamalar

### KPI: Aktif Arızalar

```sql
COUNT(*) WHERE status IN ('OPEN', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_PARTS')
```

`RESOLVED` ve `CLOSED` durumundaki arızalar aktif sayılmaz.

---

### KPI: Bugün Çözülen Arızalar

```sql
COUNT(*) WHERE status IN ('RESOLVED', 'CLOSED')
  AND (resolvedAt >= todayStart OR closedAt >= todayStart)
```

Gün sınırı UTC 00:00 bazlıdır.

---

### KPI: Makine Durum Dağılımı

`machines.status` alanında `groupBy` yapılır. Dönen sayaçlar şu anahtarlarla eşlenir:

| DB Değeri | JSON Anahtarı |
|---|---|
| `RUNNING` | `running` |
| `BROKEN` | `broken` |
| `IN_MAINTENANCE` | `inMaintenance` |
| `DECOMMISSIONED` | `decommissioned` |

---

### KPI: Düşük Stoklu Parçalar

Prisma sütun-sütun karşılaştırmasını desteklemediği için Python-tarafında filtreleme yapılır:

```typescript
const lowStockParts = allSpareParts.filter(
  (p) => p.currentStock <= p.minimumStock
).length;
```

---

### KPI: Checklist Uyum Oranı

```
rate = round((completed / total) × 1000) / 10   → tek ondalık basamak (%)
```

`total = 0` ise `rate = 0` döner (sıfıra bölme koruması).

Renkli gösterim eşikleri:

| Oran | Renk |
|---|---|
| >= %80 | Yeşil |
| %50–79 | Amber |
| < %50 | Kırmızı |

---

### MTTR (Mean Time To Repair)

**Formül:**

```
MTTR = (resolvedAt - reportedAt) dakika cinsinden, ortalama
```

Kod karşılığı:

```typescript
const diffMinutes = (b.resolvedAt.getTime() - b.reportedAt.getTime()) / 60_000;
```

- `resolvedAt` boş olan arızalar hesaba katılmaz.
- Negatif değerler (`diffMinutes < 0`) kötü veri olarak elenir.
- Günlük trend: `resolvedAt` tarihi `YYYY-MM-DD` formatında grup anahtarı olarak kullanılır.
- Dönen `trend` dizisi tarihe göre artan sırada sıralanmıştır.

**Örnek:**

```
Arıza 1: reportedAt=08:00, resolvedAt=10:00  → 120 dk
Arıza 2: reportedAt=09:00, resolvedAt=10:30  → 90 dk
Günlük MTTR = (120 + 90) / 2 = 105 dk
```

---

### MTBF (Mean Time Between Failures)

**Formül (spec §11 basitleştirmesi, 24 saat kesintisiz çalışma varsayımı):**

```
MTBF = (machineCount × 24 × days) / breakdownCount   [saat cinsinden]
```

Kod karşılığı:

```typescript
const totalOperationalHours = machineCount * 24 * days;
const averageHours = totalBreakdowns > 0
  ? Math.round((totalOperationalHours / totalBreakdowns) * 10) / 10
  : totalOperationalHours;  // arıza yok → tam period süresi döner
```

**Haftalık trend:**

```typescript
const weeklyOperationalHours = machineCount * 24 * 7;
// Her hafta için: avgHours = weeklyOperationalHours / weekBreakdownCount
```

Hafta anahtarı ISO formatında `"YYYY-Www"` (ör. `"2026-W15"`).

---

### Pareto Analizi

Makine başına arıza sayısı ve toplam duruş süresi hesaplanır, arıza sayısına göre azalan sırayla sıralanır:

```typescript
// Grup: machineId → { breakdownCount, totalDowntimeMinutes }
// Sıralama: b.breakdownCount - a.breakdownCount (azalan)
// Kesim: ilk `limit` kayıt döndürülür
```

Grafik: Yatay çubuk (`BarChart` layout=`"vertical"`), X ekseni arıza sayısı, Y ekseni makine kodu.

---

### Departman Duruş Süresi

Join zinciri: `breakdown → machine → department`

```typescript
// Grup: departmentId → { totalDowntimeMinutes, breakdownCount }
// Sıralama: totalDowntimeMinutes azalan
```

Grafik: `BarChart`, X ekseni departman adı, Y ekseni saat cinsinden duruş (`totalMinutes / 60`).

---

### Maliyet Raporu

**Hesaplama:**

```
Toplam Maliyet = Σ(quantity × unitPriceSnapshot)
```

yalnızca `type IN ('BREAKDOWN_OUT', 'PM_OUT', 'SCRAP_OUT')` olan hareketler için.

**Dönem karşılaştırması:**

```typescript
// Cari dönem:   [currentStart, currentEnd)  = son N gün
// Önceki dönem: [previousStart, currentStart) = önceki N gün

const changePercent =
  previousPeriodCost > 0
    ? Math.round(((totalCost - previousPeriodCost) / previousPeriodCost) * 1000) / 10
    : totalCost > 0 ? 100 : 0;
```

**Pozitif** `changePercent` → maliyet artışı (kırmızı badge)  
**Negatif** `changePercent` → maliyet düşüşü (yeşil badge)

**Departman bazlı dağılım:** `stockMovement → machine → department` join zinciriyle hesaplanır, maliyete göre azalan sıralanır.

---

## Grafik ve Görselleştirmeler

Tüm grafikler `src/components/charts.tsx` üzerinden re-export edilen Recharts bileşenlerini kullanır.

| Grafik | Bileşen | Veri Kaynağı | Boyut |
|---|---|---|---|
| MTTR Trendi | `LineChart` | `/api/dashboard/mttr` | 220px yükseklik |
| Makine Durumu | `PieChart` (donut) | `/api/dashboard/summary` | 200×200 |
| Pareto | `BarChart` (yatay) | `/api/dashboard/pareto` | 240px yükseklik |
| Departman Duruş | `BarChart` (dikey) | `/api/dashboard/department-downtime` | 240px yükseklik |

### Makine Durumu Renk Kodları

| Durum | Renk |
|---|---|
| RUNNING (Çalışıyor) | `#22c55e` (yeşil) |
| BROKEN (Arızalı) | `#ef4444` (kırmızı) |
| MAINTENANCE (Bakımda) | `#f59e0b` (amber) |
| DECOMMISSIONED (Devre Dışı) | `#9ca3af` (gri) |

### Skeleton Yükleme Durumu

Tüm veri bekleyen kartlar ve grafikler `animate-pulse` sınıflı Tailwind skeleton bileşenleri gösterir. Kart boyutu, yükleme tamamlandığında oluşan içerikle eşleştirilmiştir.

---

## Dosya Haritası

```
src/
├── app/
│   ├── (app)/panel/
│   │   ├── page.tsx                         # Rol bazlı yönlendirme
│   │   └── _components/
│   │       ├── admin-dashboard.tsx          # Admin/Mühendis panosu
│   │       └── technician-dashboard.tsx     # Teknisyen panosu
│   └── api/dashboard/
│       ├── summary/route.ts                 # GET /api/dashboard/summary
│       ├── costs/route.ts                   # GET /api/dashboard/costs
│       ├── mttr/route.ts                    # GET /api/dashboard/mttr
│       ├── mtbf/route.ts                    # GET /api/dashboard/mtbf
│       ├── pareto/route.ts                  # GET /api/dashboard/pareto
│       ├── breakdown-types/route.ts         # GET /api/dashboard/breakdown-types
│       ├── department-downtime/route.ts     # GET /api/dashboard/department-downtime
│       └── technician/route.ts              # GET /api/dashboard/technician
└── components/
    └── charts.tsx                           # Recharts re-export
```

---

## İş Kuralları

1. **Zaman dilimi:** Tüm tarih hesaplamaları UTC bazlıdır. "Bugün" sınırı `Date.UTC(...)` ile hesaplanır.
2. **`days` parametresi doğrulama:** `Math.max(1, parseInt(days, 10))` ile minimum 1 güne zorlanır.
3. **MTBF arıza yoksa:** Sıfıra bölme yerine `totalOperationalHours` değeri döner.
4. **Maliyet yalnızca çıkış hareketleri:** `IN`, `RETURN` gibi giriş tipi hareketler maliyet hesabına dahil değildir.
5. **Düşük stok eşiği:** `currentStock <= minimumStock` koşulu (eşit olan parçalar da uyarı kapsamındadır).
6. **Pareto kesim:** `limit` parametresi 1–100 arasıyla sınırlandırılmıştır.
7. **Teknisyen dashboard izolasyonu:** `assignedBreakdowns` ve `todayChecklists` yalnızca `ctx.userId` ile filtrelenir; başka kullanıcıların verisi dönemez.
8. **MTTR negatif veri koruması:** `diffMinutes < 0` olan satırlar hesaba katılmaz (veri tutarsızlığı koruması).
9. **Summary endpoint unreadCount:** Oturum açmış kullanıcının bildirim sayacını döner; başka kullanıcılar için sıfır görünür.
10. **Checklist uyum oranı precision:** `round(x * 1000) / 10` ile bir ondalık basamağa yuvarlanır (ör. `%80.0`, `%66.7`).
