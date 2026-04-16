# Arıza Modülü (Arızalar)

## Amaç

Arıza modülü, MaintainPro'nun operasyonel çekirdeğidir. Bir makine arızasının ilk bildiriminden çözümüne ve kapanmasına kadar geçen tüm yaşam döngüsünü yönetir. Her arıza; katı bir durum makinesi, değiştirilemez bir zaman çizelgesi, parça tüketim kayıtları ve fotoğraf kanıtı ile izlenir. Modül, dashboard MTBF/MTTR metriklerini besler ve eskalasyon bildirimlerini tetikler.

---

## Mimari Genel Bakış

```
Teknisyen / Mühendis
  │
  │  POST /api/breakdowns  (arıza bildir)
  ▼
Breakdown (OPEN)
  │
  │  createBreakdown() servisi
  │  ├── generateBreakdownCode() → ARZ-YYYY-NNNN
  │  ├── breakdown kaydı oluşturulur
  │  └── BreakdownTimeline ilk satırı (fromStatus: null, toStatus: OPEN)
  │
  │  POST /api/breakdowns/:id/transition
  ▼
Durum Makinesi (VALID_TRANSITIONS tablosu)
  │
  │  transitionBreakdown() servisi
  │  ├── İzin verilen geçiş mi? → ServiceError("invalid_transition")
  │  ├── Rol yetkili mi? → TRANSITION_ROLES tablosu → 403
  │  ├── Gerekli alanlar var mı? (assigneeId, vb.) → ServiceError
  │  ├── Breakdown güncellenir (status, assigneeId, respondedAt, vb.)
  │  ├── BreakdownTimeline satırı eklenir
  │  └── Domain eventi yayınlanır
  │
  ▼
Kapatıldı (CLOSED)
```

---

## Arıza Numaralama Formatı

```
ARZ-YYYY-NNNN
```

| Parça  | Açıklama |
|--------|----------|
| `ARZ`  | Sabit ön ek (Arıza) |
| `YYYY` | Oluşturulma yılı (örn. `2026`) |
| `NNNN` | Sıfır dolgulu 4 basamak; fabrika başına yıl başında `0001`'den sıfırlanır |

Örnekler: `ARZ-2026-0001`, `ARZ-2026-0042`

**Üretim algoritması (`generateBreakdownCode`):**

1. Mevcut yıldan `ARZ-{YYYY}-` öneki oluşturulur.
2. Fabrika içinde bu önekle başlayan en son arıza kodu `ORDER BY code DESC` ile bulunur.
3. Son sıra numarasına 1 eklenir; ilk arıza için `0001` kullanılır.
4. Sonuç `ARZ-2026-0042` formatında döner ve `breakdown.code` sütununa yazılır.

Kod `[factoryId, code]` üzerinde unique indeks ile veritabanı düzeyinde korunur.

---

## Durum Makinesi

```
OPEN
  │  FACTORY_ADMIN / ENGINEER atama yapar
  ▼
ASSIGNED
  │  TECHNICIAN (yalnızca atanan) işe başlar
  ▼
IN_PROGRESS ◄────────────────────┐
  │                              │
  ├── TECHNICIAN parça bekliyor  │
  ▼                              │
WAITING_PARTS                   │
  │  TECHNICIAN parça geldi      │
  └──────────────────────────────┘
  │
  │  TECHNICIAN çözüldü işaretler
  ▼
RESOLVED
  │  FACTORY_ADMIN / ENGINEER onaylar    FACTORY_ADMIN / ENGINEER reddeder
  ▼                                        │
CLOSED                                     └──► IN_PROGRESS (yeniden)
```

### İzin Verilen Geçişler

| Başlangıç Durumu | Hedef Durum    | İzin Verilen Roller                         | Yan Etkiler |
|------------------|----------------|---------------------------------------------|-------------|
| `OPEN`           | `ASSIGNED`     | `FACTORY_ADMIN`, `ENGINEER`                 | `assigneeId` ayarlanır; timeline satırı eklenir; `breakdown.assigned` eventi; push bildirimi atanana gönderilir |
| `ASSIGNED`       | `IN_PROGRESS`  | `TECHNICIAN` (yalnızca atanan), `ENGINEER`, `FACTORY_ADMIN` | `respondedAt` ayarlanır (ilk geçişte); timeline satırı eklenir |
| `IN_PROGRESS`    | `WAITING_PARTS`| `TECHNICIAN`                                | Timeline satırı eklenir; stok yöneticisine uyarı gönderilir |
| `WAITING_PARTS`  | `IN_PROGRESS`  | `TECHNICIAN`                                | Timeline satırı eklenir |
| `IN_PROGRESS`    | `RESOLVED`     | `TECHNICIAN`                                | `resolvedAt` ayarlanır; `totalDowntimeMinutes` hesaplanır; timeline satırı eklenir; `breakdown.status_changed` eventi |
| `RESOLVED`       | `CLOSED`       | `FACTORY_ADMIN`, `ENGINEER`                 | `closedAt` ayarlanır; timeline satırı eklenir; makine durumu güncellenir |
| `RESOLVED`       | `IN_PROGRESS`  | `FACTORY_ADMIN`, `ENGINEER`                 | Ret yolu; `resolvedAt` temizlenir; timeline satırı eklenir (red notu ile) |

Bu tabloda yer almayan geçişler yasaktır. Geçersiz geçiş girişimlerinde `ServiceError("invalid_transition")` fırlatılır; API `422` döner.

### Toplam Kapalı Kalma Süresi Hesabı

`IN_PROGRESS → RESOLVED` geçişinde:

```
totalDowntimeMinutes = round((resolvedAt - reportedAt) / 60000)
```

`reportedAt` arızanın ilk bildirildiği zamandır. `WAITING_PARTS` süreleri dahildir. Bu değer MTTR hesaplamalarında kullanılır.

---

## API Endpoints

### Arıza Listele

```
GET /api/breakdowns
```

**Yetki:** `SUPER_ADMIN`, `FACTORY_ADMIN`, `ENGINEER`, `TECHNICIAN`

**Query Parametreleri:**

| Parametre      | Tür                                           | Açıklama |
|----------------|-----------------------------------------------|----------|
| `status`       | BreakdownStatus                               | `OPEN` \| `ASSIGNED` \| `IN_PROGRESS` \| `WAITING_PARTS` \| `RESOLVED` \| `CLOSED` |
| `priority`     | BreakdownPriority                             | `CRITICAL` \| `HIGH` \| `MEDIUM` \| `LOW` |
| `machineId`    | string (UUID)                                 | Belirli bir makineye ait arızalar |
| `departmentId` | string (UUID)                                 | Makine departmanına göre filtrele |
| `search`       | string                                        | `code` ve `description` alanlarında büyük/küçük harf duyarsız arama |

**Response `200 OK`:**

```json
[
  {
    "id": "clxxx",
    "factoryId": "clyyy",
    "code": "ARZ-2026-0001",
    "machineId": "clzzz",
    "type": "MECHANICAL",
    "priority": "HIGH",
    "status": "IN_PROGRESS",
    "description": "Konveyör bandı aniden durdu, motor sesi geliyor.",
    "reportedAt": "2026-04-10T08:30:00Z",
    "respondedAt": "2026-04-10T09:00:00Z",
    "resolvedAt": null,
    "closedAt": null,
    "totalDowntimeMinutes": null,
    "machine": { "id": "clzzz", "name": "Konveyör Bant-1", "code": "KB-001" },
    "reporter": { "id": "clrrr", "name": "Ahmet Kaya" },
    "assignee": { "id": "clttt", "name": "Ali Yılmaz" }
  }
]
```

Sonuçlar `reportedAt` alanına göre azalan sırada döner.

---

### Arıza Görüntüle (Tam Detay)

```
GET /api/breakdowns/:id
```

**Yetki:** `SUPER_ADMIN`, `FACTORY_ADMIN`, `ENGINEER`, `TECHNICIAN`

**Response `200 OK`:** Arıza nesnesi; `machine` (departman dahil), `reporter`, `assignee`, ve `timeline` (tüm geçişler kronolojik sırada) ilişkileri dahildir.

**Hata Kodları:**

| Kod | HTTP | Açıklama |
|-----|------|----------|
| `not_found` | 404 | Bu fabrikada arıza bulunamadı |

---

### Arıza Oluştur

```
POST /api/breakdowns
```

**Yetki:** `SUPER_ADMIN`, `FACTORY_ADMIN`, `ENGINEER`, `TECHNICIAN`

**Request Body** (`createBreakdownSchema` ile doğrulanır):

| Alan          | Tür                   | Zorunlu | Açıklama |
|---------------|-----------------------|---------|----------|
| `machineId`   | string (cuid)         | evet    | Arıza yaşanan makine |
| `type`        | BreakdownType         | evet    | `MECHANICAL` \| `ELECTRICAL` \| `PNEUMATIC` \| `HYDRAULIC` \| `SOFTWARE` \| `OTHER` |
| `priority`    | BreakdownPriority     | evet    | `CRITICAL` \| `HIGH` \| `MEDIUM` \| `LOW` |
| `description` | string (min 10, max 5000) | evet | Arıza açıklaması |

**Response `201 Created`:** Oluşturulan arıza nesnesi; `code` alanında `ARZ-YYYY-NNNN` formatında numara bulunur.

**Yan Etkiler:**
- `createBreakdown()` servisi çağrılır; otomatik numaralama yapılır.
- İlk `BreakdownTimeline` satırı eklenir (`fromStatus: null`, `toStatus: OPEN`).
- `breakdown.created` domain eventi yayınlanır.

**Hata Kodları:**

| Kod | HTTP | Açıklama |
|-----|------|----------|
| `validation_error` | 400 | Zod şema hatası |
| ServiceError kodları | 422 | Servis katmanı hataları |

---

### Arıza Durumu Geçişi

```
POST /api/breakdowns/:id/transition
```

**Yetki:** `SUPER_ADMIN`, `FACTORY_ADMIN`, `ENGINEER`, `TECHNICIAN` — geçiş tipine göre kısıtlı

**Request Body** (`transitionBreakdownSchema`):

| Alan              | Tür                    | Zorunlu | Açıklama |
|-------------------|------------------------|---------|----------|
| `status`          | BreakdownStatus        | evet    | Hedef durum |
| `assigneeId`      | string (cuid)          | koşullu | `ASSIGNED` geçişinde zorunlu |
| `note`            | string (max 2000)      | hayır   | Timeline'a yazılacak not |
| `resolutionNotes` | string (max 5000)      | hayır   | `RESOLVED` geçişinde çözüm açıklaması |
| `rootCause`       | string (max 1000)      | hayır   | `RESOLVED` geçişinde kök neden |

**Rol Kontrolü (TRANSITION_ROLES tablosu):**

| Hedef Durum     | İzin Verilen Roller |
|-----------------|---------------------|
| `ASSIGNED`      | `ENGINEER`, `FACTORY_ADMIN` |
| `IN_PROGRESS`   | `TECHNICIAN`, `ENGINEER`, `FACTORY_ADMIN` |
| `WAITING_PARTS` | `TECHNICIAN` |
| `RESOLVED`      | `TECHNICIAN` |
| `CLOSED`        | `ENGINEER`, `FACTORY_ADMIN` |

Ek olarak: `ASSIGNED → IN_PROGRESS` geçişinde `TECHNICIAN` rolü yalnızca kendi atanmış olduğu arızayı başlatabilir.

**Response `200 OK`:** Güncellenmiş arıza nesnesi.

**Yan Etkiler:**
- `breakdown.status_changed` domain eventi her zaman yayınlanır.
- `status === ASSIGNED` ise ek olarak `breakdown.assigned` eventi yayınlanır.
- `BreakdownTimeline` satırı eklenir.

**Hata Kodları:**

| Kod | HTTP | Açıklama |
|-----|------|----------|
| `not_found` | 404 | Arıza bulunamadı |
| `forbidden` | 403 | Rol bu geçiş için yetkisiz veya yalnızca atanan teknisyen başlatabilir |
| `validation_error` | 400 | Zod şema hatası |
| `invalid_transition` | 422 | Mevcut durumdan hedef duruma geçiş yasak |

---

### Arızaya Kullanılan Parçalar

#### Listeye

```
GET /api/breakdowns/:id/parts
```

**Yetki:** `SUPER_ADMIN`, `FACTORY_ADMIN`, `ENGINEER`, `TECHNICIAN`

**Response `200 OK`:** Bu arızaya ait stok hareketleri; `sparePart` (id, name, code, unit) ve `user` (id, name) ilişkileri dahil; `createdAt` azalan sırada.

```json
[
  {
    "id": "clmmm",
    "type": "BREAKDOWN_OUT",
    "quantity": 2,
    "unitPriceSnapshot": "125.50",
    "note": "Yedek kayış değiştirildi",
    "createdAt": "2026-04-10T10:00:00Z",
    "sparePart": { "id": "clppp", "name": "V Kayış", "code": "KYS-001", "unit": "adet" },
    "user": { "id": "clttt", "name": "Ali Yılmaz" }
  }
]
```

#### Parça Ekle (Stok Çıkışı)

```
POST /api/breakdowns/:id/parts
```

**Yetki:** `FACTORY_ADMIN`, `ENGINEER`, `TECHNICIAN`

**Request Body:**

| Alan          | Tür           | Zorunlu | Açıklama |
|---------------|---------------|---------|----------|
| `sparePartId` | string (cuid) | evet    | Yedek parça ID'si |
| `quantity`    | integer (> 0) | evet    | Çıkış miktarı |
| `machineId`   | string (cuid) | hayır   | Atlanırsa arızanın makinesine varsayılan |
| `note`        | string (max 2000) | hayır | Açıklama notu |

**Response `201 Created`:** Oluşturulan stok hareketi (`BREAKDOWN_OUT` tipi).

**Yan Etkiler:**
- `createStockMovement()` servisi çağrılır.
- `stock.movement` domain eventi yayınlanır.
- Stok minimuma ulaştıysa `stock.minimum_reached` eventi yayınlanır.

**Hata Kodları:**

| Kod | HTTP | Açıklama |
|-----|------|----------|
| `not_found` | 404 | Arıza veya yedek parça bulunamadı |
| `insufficient_stock` | 422 | Yeterli stok yok |
| `invalid_quantity` | 400 | Geçersiz miktar |

---

### Teknisyen Görev Kuyrukları

```
GET /api/breakdowns/my
```

**Yetki:** Yalnızca `TECHNICIAN`

**Query Parametreleri:**

| Parametre | Tür             | Açıklama |
|-----------|-----------------|----------|
| `status`  | BreakdownStatus | İsteğe bağlı filtre |

**Sunucu tarafında uygulanan filtreler:**
- `assigneeId = ctx.userId` — yalnızca bu teknisyene atanan arızalar döner; query param ile geçersiz kılınamaz.

**Sıralama:** Uygulama katmanında önce `priority` (CRITICAL→HIGH→MEDIUM→LOW), sonra `reportedAt` (artan) sıralaması yapılır.

**Response `200 OK`:** Her arıza nesnesi `machine` (id, name, code) ve `timeline`'ın son satırını içerir.

---

## Dosya Haritası

| Dosya | Sorumluluk |
|-------|------------|
| `src/app/api/breakdowns/route.ts` | `GET /api/breakdowns`, `POST /api/breakdowns` |
| `src/app/api/breakdowns/[id]/route.ts` | `GET /api/breakdowns/:id` |
| `src/app/api/breakdowns/[id]/transition/route.ts` | `POST /api/breakdowns/:id/transition` — durum makinesi giriş noktası |
| `src/app/api/breakdowns/[id]/parts/route.ts` | `GET` ve `POST /api/breakdowns/:id/parts` |
| `src/app/api/breakdowns/my/route.ts` | `GET /api/breakdowns/my` — teknisyen görev kuyruğu |
| `src/lib/validations/breakdown.ts` | `createBreakdownSchema`, `transitionBreakdownSchema` |
| `src/lib/services/breakdown-service.ts` | `createBreakdown()`, `transitionBreakdown()`, `generateBreakdownCode()`, `isValidTransition()`, `ServiceError` |

---

## Veri Modeli

### Breakdown (Prisma)

| Alan                  | Tür                  | Açıklama |
|-----------------------|----------------------|----------|
| `id`                  | String (cuid)        | Birincil anahtar |
| `factoryId`           | String               | Kiracı anahtarı; RLS ile korunur |
| `code`                | String               | `ARZ-YYYY-NNNN` formatı; `[factoryId, code]` unique indeksi |
| `machineId`           | String               | Arızalı makine; `RESTRICT` silme kuralı |
| `type`                | BreakdownType        | Arıza türü |
| `priority`            | BreakdownPriority    | Öncelik |
| `reporterId`          | String               | Bildiren kullanıcı; `RESTRICT` silme kuralı |
| `description`         | Text                 | Arıza açıklaması (min 10 karakter) |
| `status`              | BreakdownStatus      | Mevcut durum |
| `assigneeId`          | String?              | Atanan teknisyen; `SetNull` silme kuralı |
| `reportedAt`          | DateTime             | İlk bildirim zamanı; `totalDowntimeMinutes` hesabında başlangıç noktası |
| `respondedAt`         | DateTime?            | İlk `IN_PROGRESS` geçişi zamanı |
| `resolvedAt`          | DateTime?            | `RESOLVED` geçişi zamanı |
| `closedAt`            | DateTime?            | `CLOSED` geçişi zamanı |
| `resolutionNotes`     | Text?                | Çözüm açıklaması |
| `rootCause`           | String?              | Kök neden |
| `isRecurring`         | Boolean              | Tekrar eden arıza işareti (varsayılan: `false`) |
| `totalDowntimeMinutes`| Int?                 | `resolvedAt - reportedAt` dakika cinsinden; `RESOLVED` geçişinde hesaplanır |

**İndeksler:** `[factoryId, status]`, `[machineId]`

### BreakdownTimeline (Prisma)

| Alan          | Tür             | Açıklama |
|---------------|-----------------|----------|
| `id`          | String (cuid)   | Birincil anahtar |
| `breakdownId` | String          | Bağlı arıza; `CASCADE` silme |
| `userId`      | String          | İşlemi yapan kullanıcı; `RESTRICT` silme |
| `factoryId`   | String          | RLS için denormalize edilmiş kiracı anahtarı |
| `fromStatus`  | BreakdownStatus?| Önceki durum; ilk `OPEN` girişinde `null` |
| `toStatus`    | BreakdownStatus | Yeni durum |
| `note`        | Text?           | Serbest not; ret açıklamaları burada saklanır |
| `createdAt`   | DateTime        | Sunucu tarafında ayarlanır |

Timeline satırları **değiştirilemez** ve **silinemez** — API üzerinden güncelleme endpoint'i yoktur.

---

## Zaman Çizelgesi (Timeline) Takibi

Her durum geçişinde, ebeveyn değişikliğiyle **aynı transaction içinde** bir `BreakdownTimeline` satırı yazılır. Bu, tutarsız durumları önler.

**`BreakdownTimeline` satırı her zaman şunlarda yazılır:**
- Arıza oluşturulduğunda (`fromStatus: null, toStatus: OPEN`)
- Her durum geçişinde (`fromStatus, toStatus, note`)

---

## Parça Kullanımı ve Stok Bağlantısı

`POST /api/breakdowns/:id/parts` endpoint'i `StockMovement` tablosuna `BREAKDOWN_OUT` tipinde bir hareket kaydı ekler:

- `breakdownId` ile arızaya bağlanır
- `machineId` belirtilmezse arızanın makinesine varsayılan olarak atanır
- `sparePart.currentStock` azaltılır; `minimumStock` eşiği aşılırsa `stock.minimum_reached` eventi yayınlanır

---

## Teknisyen Görev Paneli (`/gorevlerim`)

Yalnızca `TECHNICIAN` rolüne görünür olan mobil öncelikli görünüm.

**Her kart şunları gösterir:**
- Arıza numarası (`ARZ-YYYY-NNNN`)
- Makine adı ve departmanı
- Öncelik rozeti (CRITICAL = kırmızı, HIGH = turuncu, MEDIUM = sarı, LOW = gri)
- Mevcut durum ve bir dokunuşla sonraki geçiş için eylem butonu
- Bildirim zamanından bu yana geçen süre (göreli)

**Sıralama:** CRITICAL önce, aynı öncelikte `reportedAt` artan sırayla.

**Query anahtarı:** `["breakdowns/my"]` — arıza durumu değiştiğinde invalidate edilir.

---

## Bildirim Tetikleri

| Olay | Alıcı | Kanal |
|------|-------|-------|
| `breakdown.created` | Mühendisler + Fabrika Admini | Push + in-app |
| `breakdown.assigned` | Atanan teknisyen | Push + in-app |
| `breakdown.status_changed` (RESOLVED) | Mühendisler + Fabrika Admini | Push + in-app |
| `breakdown.status_changed` (CLOSED) | Raporlayan kişi | In-app |
| Eskalasyon — 30 dk yanıtsız | Mühendisler | Push + e-posta |
| Eskalasyon — 60 dk yanıtsız | Fabrika Admini | Push + e-posta |
| Eskalasyon — 2 sa yanıtsız (CRITICAL) | Super Admin | E-posta |

Kullanıcı tercihlerine (`notificationPreferences`) ve sessiz saatlere (`quietHoursStart/End`) göre filtreleme yapılır. Bildirimler `Notification` tablosuna yazılır; FCM ve SES üzerinden iletilir (Sprint 6).

---

## Eskalasyon Kuralları (spec §9.3)

Eskalasyon, istek zamanında değil, zamanlı işler (scheduled jobs) aracılığıyla çalışır. Timer, herhangi bir durum değişikliğinde sıfırlanır.

| Süre | Durum Koşulu | Eylem |
|------|-------------|-------|
| 30 dakika | `OPEN` veya `ASSIGNED` (yanıt yok) | Fabrikanın tüm mühendislerine bildirim |
| 60 dakika | Hâlâ `OPEN` veya `ASSIGNED` | Fabrika adminine bildirim |
| 2 saat | Hâlâ `OPEN` veya `ASSIGNED` VE öncelik `CRITICAL` | Super Admin'e bildirim |

**Uygulama notu:** Eskalasyon zamanlaması `respondedAt` ve `reportedAt` arasındaki farka göre değerlendirilir. `IN_PROGRESS`'e geçen arıza eskalasyon zincirinden çıkar.

---

## QR Hızlı Giriş Akışı

Her makinenin QR kodu şu URL'i kodlar:

```
https://{host}/arizalar/yeni?makine={machineId}
```

1. Teknisyen fiziksel makinedeki QR kodu herhangi bir okuyucu veya PWA kamera ile okur.
2. Tarayıcı arıza bildirimi formunu açar; makine adı ve ID ön doldurulmuş gelir.
3. Teknisyen `type`, `priority` ve `description` alanlarını doldurur; fotoğraf ekleyebilir.
4. Form gönderildiğinde `POST /api/breakdowns` çağrılır; makine ID'si URL parametresinden alınır (form girdisinden değil — spoofing önlemi).
5. Onay ekranı oluşturulan `ARZ-YYYY-NNNN` numarasını gösterir.

Kimlik doğrulama gerektiren sayfada oturum açılmamışsa NextAuth, kullanıcıyı `/giris?callbackUrl=/arizalar/yeni?makine=:id` adresine yönlendirir ve giriş sonrasında geri döner.

---

## Domain Events

| Event | Ne Zaman Yayınlanır |
|-------|---------------------|
| `breakdown.created` | POST başarılı olduğunda |
| `breakdown.assigned` | `ASSIGNED` geçişi başarılı olduğunda (`assigneeId` ile) |
| `breakdown.status_changed` | Her durum geçişinde (her zaman `breakdown.assigned` ile birlikte yayınlanır) |
| `stock.movement` | Arızaya parça eklendiğinde |
| `stock.minimum_reached` | Parça ekleme sonrası stok minimuma düştüğünde |

---

## İş Kuralları ve Edge Case'ler

- **Aynı makinede birden fazla açık arıza:** İzin verilir — ikinci arıza kaydı oluşturulur. UI, raporlayan kişiyi uyarır ama engel olmaz.

- **Teknisyen yeniden atama:** `ASSIGNED` veya `IN_PROGRESS` durumundaki bir arızada `assigneeId` değiştirilebilir; yalnızca `FACTORY_ADMIN` / `ENGINEER` yapabilir. Eski teknisyene "arıza yeniden atandı" push bildirimi gönderilir. Timeline'a `ASSIGNMENT` tipi satır eklenir.

- **Makine durum senkronizasyonu:** Bir arıza `CLOSED` durumuna geçtiğinde; bu makinede başka açık arıza kalmaması durumunda makinenin durumu `RUNNING`'e güncellenir.

- **`RESOLVED → IN_PROGRESS` (ret yolu):** `resolvedAt` alanı `null` olarak temizlenir. Ret notu `transitionBreakdownSchema.note` üzerinden gelir ve timeline'a yazılır. Bu, `totalDowntimeMinutes` hesabını sıfırlar; bir sonraki `RESOLVED` geçişinde yeniden hesaplanır.

- **`respondedAt` yalnızca bir kez ayarlanır:** İlk `IN_PROGRESS` geçişinde ayarlanır; sonraki geçişlerde (ret ve yeniden başlatma dahil) güncellenmez. Bu MTTR hesaplamalarında kullanılır.

- **Parça tüketimi — timeline entegrasyonu:** Stok çıkış hareketi oluşturulduğunda `stock.movement` eventi yayınlanır; bildirim işleyicisi `PART_USED` tipi bir timeline satırı ekleyebilir (Sprint 6).

- **Silme:** MVP'de hard-delete endpoint'i yoktur. `FACTORY_ADMIN` bir arızayı yalnızca `CLOSED` durumuna getirerek kapatabilir. Soft-delete için gelecekte `deletedAt` eklenebilir.

- **Yetki denetimi sırası:** Geçiş API'sinde önce Zod doğrulaması, sonra `TRANSITION_ROLES` tablosu ile rol kontrolü, ardından özel atanmış teknisyen kontrolü, son olarak `transitionBreakdown()` servisi çalışır. Bu sıra kasıtlıdır — hata mesajları tutarlı ve öngörülebilirdir.
