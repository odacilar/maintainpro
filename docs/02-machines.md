# Makine Modülü (Makineler)

## Amaç

Makine modülü, bir fabrikanın tüm üretim ekipmanlarının merkezi kayıt defteridir. Her makine bir departmana bağlıdır, benzersiz bir fabrika koduna sahiptir ve mobil hızlı erişim için otomatik oluşturulan bir QR token taşır. Makineler; arıza kayıtları, planlı bakım planları, otonom bakım şablonları ve stok hareketlerinin bağlandığı ana varlık (asset anchor) tablosudur.

---

## Mimari Genel Bakış

```
Departman (Department)
  │
  └──► Makine (Machine)
           │
           ├──► Arıza (Breakdown)
           ├──► Otonom Bakım Şablonu (ChecklistTemplate)
           ├──► Planlı Bakım Planı (PmPlan)
           └──► Stok Hareketi (StockMovement)
```

Her makine oluşturulduğunda sunucu tarafında UUID v4 formatında bir `qrToken` atanır. Bu token, fiziksel makineden QR barkod okutularak arıza bildirimine hızlı erişimi sağlar.

---

## API Endpoints

### Makine Listele

```
GET /api/machines
```

**Yetki:** `SUPER_ADMIN`, `FACTORY_ADMIN`, `ENGINEER`, `TECHNICIAN`

**Query Parametreleri:**

| Parametre      | Tür                                                        | Açıklama                                 |
|----------------|------------------------------------------------------------|------------------------------------------|
| `departmentId` | string (UUID)                                              | Departmana göre filtrele                 |
| `status`       | `RUNNING` \| `BROKEN` \| `IN_MAINTENANCE` \| `DECOMMISSIONED` | Makine durumuna göre filtrele        |
| `criticality`  | `A` \| `B` \| `C`                                         | Kritiklik derecesine göre filtrele       |
| `search`       | string                                                     | `name` ve `code` alanlarında büyük/küçük harf duyarsız arama |

**Response `200 OK`:**

```json
[
  {
    "id": "clxxx",
    "factoryId": "clyyy",
    "departmentId": "clzzz",
    "code": "KB-001",
    "name": "Konveyör Bant-1",
    "line": "Hat-A",
    "brand": "Siemens",
    "model": "S7-1200",
    "serialNumber": "SN-2024-001",
    "installedAt": "2024-01-15T00:00:00Z",
    "warrantyEndsAt": "2026-01-15T00:00:00Z",
    "criticality": "A",
    "status": "RUNNING",
    "qrToken": "uuid-v4-token",
    "notes": "Yıllık bakım Ocak ayında",
    "createdAt": "2026-01-01T...",
    "updatedAt": "2026-04-10T...",
    "department": {
      "id": "clzzz",
      "name": "Üretim"
    }
  }
]
```

Sonuçlar `code` alanına göre artan sırada döner. Tüm sorgular Prisma middleware üzerinden fabrikaya kilitlenir (RLS).

---

### Makine Oluştur

```
POST /api/machines
```

**Yetki:** `FACTORY_ADMIN`, `ENGINEER`

**Request Body** (`createMachineSchema` ile doğrulanır):

| Alan            | Tür              | Zorunlu | Açıklama                        |
|-----------------|------------------|---------|---------------------------------|
| `code`          | string (max 50)  | evet    | Fabrika içinde benzersiz kod    |
| `name`          | string (max 200) | evet    | Makine adı                      |
| `departmentId`  | string (cuid)    | evet    | Bağlı departman ID'si           |
| `criticality`   | `A` \| `B` \| `C`| evet    | Kritiklik derecesi              |
| `status`        | MachineStatus    | hayır   | Varsayılan: `RUNNING`           |
| `line`          | string (max 100) | hayır   | Üretim hattı                    |
| `brand`         | string (max 100) | hayır   | Marka                           |
| `model`         | string (max 100) | hayır   | Model                           |
| `serialNumber`  | string (max 100) | hayır   | Seri numarası                   |
| `installedAt`   | ISO date         | hayır   | Kurulum tarihi                  |
| `warrantyEndsAt`| ISO date         | hayır   | Garanti bitiş tarihi            |
| `notes`         | string (max 2000)| hayır   | Serbest not alanı               |

**Response `201 Created`:** Oluşturulan makine nesnesi (`department` ilişkisi dahil).

**İş Kuralları:**

1. **Abonelik limiti** — `checkSubscriptionLimit(factoryId, "machines")` çağrılır. Limit doluysa `403` döner ve plan yükseltme mesajı gösterilir.
2. **Kod çakışması** — `code` alanı fabrika içinde benzersiz olmalıdır. Çakışma varsa `409` döner.
3. **`qrToken` ataması** — `randomUUID()` ile sunucu tarafında oluşturulur; istemciden geçirilemez.

**Yan Etkiler:** `machine.created` domain eventi yayınlanır.

**Hata Kodları:**

| Kod | HTTP | Açıklama |
|-----|------|----------|
| `validation_error` | 400 | Zod şema hatası; `issues` detaylar içerir |
| `machine_code_conflict` | 409 | Bu fabrikada aynı `code` zaten var |
| Abonelik limiti aşıldı | 403 | Plan limitine ulaşıldı |

---

### Makine Görüntüle

```
GET /api/machines/:id
```

**Yetki:** `SUPER_ADMIN`, `FACTORY_ADMIN`, `ENGINEER`, `TECHNICIAN`

**Response `200 OK`:** Makine nesnesi (`department` ilişkisi dahil).

**Hata Kodları:**

| Kod | HTTP | Açıklama |
|-----|------|----------|
| `not_found` | 404 | Bu fabrikada belirtilen ID'de makine yok |

---

### Makine Güncelle

```
PUT /api/machines/:id
```

**Yetki:** `FACTORY_ADMIN`, `ENGINEER`

**Request Body** (`updateMachineSchema` — `createMachineSchema`'nın tüm alanları isteğe bağlı):

`createMachineSchema`'daki tüm alanlar kısmen gönderilebilir; sadece gönderilen alanlar güncellenir.

**İş Kuralları:**

1. Makine bulunamazsa `404` döner.
2. `code` değişiyorsa çakışma kontrolü yapılır.
3. `status` alanı değişiyorsa `machine.status_changed` eventi yayınlanır; diğer güncellemeler için `machine.updated` eventi yayınlanır.

**Response `200 OK`:** Güncellenmiş makine nesnesi.

---

### Makine Sil

```
DELETE /api/machines/:id
```

**Yetki:** `FACTORY_ADMIN`

**İş Kuralları:**

1. Makine bulunamazsa `404` döner.
2. Makineye bağlı herhangi bir arıza kaydı varsa silme engellenir (`409` — `machine_has_breakdowns`).
3. Şema düzeyinde de `onDelete: Restrict` ile korunmaktadır.

**Response `204 No Content`**

**Hata Kodları:**

| Kod | HTTP | Açıklama |
|-----|------|----------|
| `not_found` | 404 | Makine bulunamadı |
| `machine_has_breakdowns` | 409 | Bu makinede arıza kaydı var; silinemez |

---

### QR Kodu Görüntüle

```
GET /api/machines/:id/qr
```

**Yetki:** `SUPER_ADMIN`, `FACTORY_ADMIN`, `ENGINEER`, `TECHNICIAN`

**Response `200 OK`:** PNG ikili dosyası.

**Response Headers:**

| Başlık | Değer |
|--------|-------|
| `Content-Type` | `image/png` |
| `Content-Disposition` | `inline; filename="qr-{code}.png"` |
| `Cache-Control` | `public, max-age=86400` (24 saat) |

**Hata Kodları:**

| Kod | HTTP | Açıklama |
|-----|------|----------|
| `machine_not_found` | 404 | Makine bulunamadı |

---

### Departman Listele

```
GET /api/departments
```

**Yetki:** `SUPER_ADMIN`, `FACTORY_ADMIN`, `ENGINEER`, `TECHNICIAN`

**Response `200 OK`:** Tüm departmanlar, `name` alanına göre artan sırada.

```json
[
  {
    "id": "clzzz",
    "factoryId": "clyyy",
    "name": "Üretim",
    "code": "PROD",
    "description": "Üretim departmanı",
    "createdAt": "2026-01-01T..."
  }
]
```

---

### Departman Oluştur

```
POST /api/departments
```

**Yetki:** `FACTORY_ADMIN`

**Request Body** (`createDepartmentSchema`):

| Alan          | Tür              | Zorunlu | Açıklama              |
|---------------|------------------|---------|-----------------------|
| `name`        | string (max 100) | evet    | Departman adı         |
| `code`        | string (max 20)  | evet    | Fabrika içinde benzersiz kısa kod |
| `description` | string (max 500) | hayır   | Açıklama              |

**Response `201 Created`:** Oluşturulan departman.

**Hata Kodları:**

| Kod | HTTP | Açıklama |
|-----|------|----------|
| `department_code_conflict` | 409 | Aynı `code` fabrikada zaten var |

---

### Departman Görüntüle

```
GET /api/departments/:id
```

**Yetki:** `SUPER_ADMIN`, `FACTORY_ADMIN`, `ENGINEER`, `TECHNICIAN`

**Response `200 OK`:** Departman nesnesi.

---

### Departman Güncelle

```
PUT /api/departments/:id
```

**Yetki:** `FACTORY_ADMIN`

**Request Body** (`updateDepartmentSchema` — tüm alanlar isteğe bağlı).

**İş Kuralları:** `code` değişiyorsa çakışma kontrolü yapılır.

**Response `200 OK`:** Güncellenmiş departman.

---

### Departman Sil

```
DELETE /api/departments/:id
```

**Yetki:** `FACTORY_ADMIN`

**İş Kuralları:** Departmana bağlı makine varsa silme engellenir (`409` — `department_has_machines`).

**Response `204 No Content`**

---

## Dosya Haritası

| Dosya | Sorumluluk |
|-------|------------|
| `src/app/api/machines/route.ts` | `GET /api/machines`, `POST /api/machines` |
| `src/app/api/machines/[id]/route.ts` | `GET`, `PUT`, `DELETE /api/machines/:id` |
| `src/app/api/machines/[id]/qr/route.ts` | `GET /api/machines/:id/qr` — PNG üretimi |
| `src/app/api/departments/route.ts` | `GET /api/departments`, `POST /api/departments` |
| `src/app/api/departments/[id]/route.ts` | `GET`, `PUT`, `DELETE /api/departments/:id` |
| `src/lib/validations/machine.ts` | `createMachineSchema`, `updateMachineSchema`, `createDepartmentSchema`, `updateDepartmentSchema` |
| `src/lib/auth/subscription-guard.ts` | `checkSubscriptionLimit()` — makine limiti kontrolü |
| `src/lib/qr.ts` | `generateQRBuffer()`, `generateQRDataURL()` yardımcıları |
| `src/app/m/[token]/page.tsx` | QR tarama sonrası yönlendirme (sunucu bileşeni) |

---

## Veri Modeli

### Machine (Prisma)

| Alan            | Tür                 | Açıklama                               |
|-----------------|---------------------|----------------------------------------|
| `id`            | String (cuid)       | Birincil anahtar                       |
| `factoryId`     | String              | Kiracı anahtarı; RLS ile korunur       |
| `departmentId`  | String              | Bağlı departman; `RESTRICT` silme kuralı |
| `code`          | String              | Fabrika içinde benzersiz; `[factoryId, code]` unique indeksi |
| `name`          | String              | Makine adı                             |
| `line`          | String?             | Üretim hattı                           |
| `brand`         | String?             | Marka                                  |
| `model`         | String?             | Model                                  |
| `serialNumber`  | String?             | Seri numarası                          |
| `installedAt`   | DateTime?           | Kurulum tarihi                         |
| `warrantyEndsAt`| DateTime?           | Garanti bitiş tarihi                   |
| `criticality`   | MachineCriticality  | `A` (yüksek), `B` (orta), `C` (düşük) |
| `status`        | MachineStatus       | `RUNNING` \| `BROKEN` \| `IN_MAINTENANCE` \| `DECOMMISSIONED` |
| `qrToken`       | String (unique)     | UUID; QR URL'i oluşturmak için kullanılır |
| `notes`         | String?             | Serbest not                            |

### Department (Prisma)

| Alan          | Tür           | Açıklama |
|---------------|---------------|----------|
| `id`          | String (cuid) | Birincil anahtar |
| `factoryId`   | String        | Kiracı anahtarı |
| `name`        | String        | Departman adı |
| `code`        | String        | `[factoryId, code]` unique indeksi |
| `description` | String?       | Açıklama |

---

## QR Kod Akışı

```
1. Makine oluşturulur
   └── qrToken = randomUUID() (sunucu, DB'ye yazılır)

2. GET /api/machines/:id/qr
   └── generateQRBuffer(machineId, qrToken)
       └── QR payload: "{APP_URL}/m/{qrToken}"
       └── PNG buffer olarak döner

3. PNG yazdırılır → fiziksel makineye yapıştırılır

4. Teknisyen QR okutur
   └── Tarayıcı açılır: /m/{qrToken}

5. src/app/m/[token]/page.tsx (sunucu bileşeni)
   ├── Kimlik doğrulama yoksa → /giris?callbackUrl=/m/{qrToken}
   ├── unsafePrisma.machine.findUnique({ where: { qrToken } })
   │   (Çapraz kiracı arama — qrToken globally unique olduğu için güvenli)
   ├── Bulunamazsa → "Makine bulunamadı" hata sayfası
   └── Bulunursa → /makineler/{machineId} yönlendirmesi
```

**Neden `unsafePrisma` kullanılıyor?** QR tarama noktasında hangi fabrikaya ait olduğu bilinmeden önce makinenin aranması gerekir. `qrToken` kriptografik olarak rastgele (UUID v4) olduğundan tahmin edilmesi mümkün değildir. Yönlendirme sonrasında kullanıcı normal kiracı kapsamlı sayfaya girer ve RLS yeniden devreye girer.

---

## Makine Durumları

| Durum           | Türkçe           | Açıklama                                  |
|-----------------|------------------|-------------------------------------------|
| `RUNNING`       | Çalışıyor        | Normal operasyonel durum                  |
| `BROKEN`        | Arızalı          | Açık arıza kaydı olduğunda otomatik ayarlanabilir |
| `IN_MAINTENANCE`| Bakımda          | Planlı bakım sürecinde                    |
| `DECOMMISSIONED`| Hizmet Dışı      | Kalıcı olarak devre dışı bırakılmış       |

Durum değişikliklerinde `machine.status_changed` domain eventi yayınlanır; dashboard sorgularını geçersiz kılar.

---

## Kritiklik Dereceleri

| Değer | Açıklama |
|-------|----------|
| `A`   | Kritik — Durması üretim hattını tamamen durdurur |
| `B`   | Önemli — Kısmi üretim kaybına yol açar |
| `C`   | Düşük — Sınırlı etki; ertelenebilir bakım |

Kritiklik derecesi arıza bildirimlerinde öncelik kararlarını ve eskalasyon kurallarını etkiler.

---

## Domain Events

| Event                    | Ne Zaman Yayınlanır                  | Etkisi                                |
|--------------------------|--------------------------------------|---------------------------------------|
| `machine.created`        | POST başarılı olduğunda              | `["machines"]` sorgu önbelleğini sıfırlar |
| `machine.updated`        | PUT başarılı (durum değişmeden)      | `["machines"]` önbelleğini sıfırlar   |
| `machine.status_changed` | PUT ile `status` alanı değiştiğinde  | `["machines"]`, `["dashboard"]` önbelleklerini sıfırlar |

---

## Abonelik Limitleri

Makine oluşturma sırasında `checkSubscriptionLimit(factoryId, "machines")` çağrısı yapılır:

| Plan          | Maksimum Makine |
|---------------|:--------------:|
| `STARTER`     | 20             |
| `PROFESSIONAL`| 50             |
| `ENTERPRISE`  | 100            |

Limit aşılırsa:
- HTTP `403` döner.
- Hata mesajı: `"Abonelik limitinize ulaştınız. Maksimum {N} makine ekleyebilirsiniz (mevcut: {M}). Planınızı yükseltmek için yöneticinizle iletişime geçin."`

---

## İş Kuralları ve Edge Case'ler

- **QR token yenileme:** MVP'de desteklenmez. Hasar görmüş veya kaybedilen QR etiketler için `PATCH /api/machines/:id/regenerate-qr` endpoint'i ilerleyen sürümlerde eklenecektir. Şimdilik fabrika admini yeni QR'ı `/api/machines/:id/qr` üzerinden indirebilir.

- **Departman silinmeden önce makine ataması:** Departman silme işlemi; bağlı makinesi olan departmanlarda `department_has_machines` (`409`) hatasıyla engellenir. Ayrıca Prisma şemasında `onDelete: Restrict` tanımlıdır.

- **Makine silinmeden önce arıza temizliği:** Arızası olan bir makine `machine_has_breakdowns` (`409`) hatasıyla korunur. Şemada `onDelete: Restrict` yoktur; kontrol uygulama katmanında yapılır.

- **Çevrimdışı QR tarama:** PWA yüklenmiş ve cihaz çevrimdışıyken service worker, önbellekteki `/makineler/:id` sayfasını sunar (Sprint 6).

- **`code` alanı benzersizliği:** `[factoryId, code]` üzerinde veritabanı unique indeksi vardır. Farklı fabrikalar aynı kodu kullanabilir.

- **Kritiklik ve durum filtreleme:** Geçersiz enum değerleri query parametresinde gelirse filtre sessizce yok sayılır; hata döndürülmez.

## QR Yardımcı Fonksiyonları (`src/lib/qr.ts`)

### `generateQRDataURL(machineId, qrToken): Promise<string>`

Makine detay sayfasında `<img src>` etiketine gömmek için base64 data URL döner (`data:image/png;base64,...`).

| Parametre  | Tür    | Açıklama |
|------------|--------|----------|
| `machineId`| string | Makine ID'si (telemetri için ayrılmış) |
| `qrToken`  | string | `machine.qrToken` sütunundaki UUID |

### `generateQRBuffer(machineId, qrToken): Promise<Buffer>`

HTTP yanıtı olarak akıtmak için ham PNG `Buffer` döner; `/api/machines/:id/qr` endpoint'inde kullanılır.
