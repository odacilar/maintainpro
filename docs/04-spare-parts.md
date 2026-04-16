# Yedek Parça ve Stok Yönetimi (Spare Parts)

## Amaç

Yedek Parça modülü, fabrikanın yedek parça envanterini tek bir çok-kiracılı defter üzerinden yönetir. Kapsam:

- Parça kayıtları için tam CRUD (ekle, listele, güncelle, sil)
- İki yönlü stok hareketleri: giriş (PURCHASE_IN, RETURN_IN) ve çıkış (BREAKDOWN_OUT, PM_OUT, SCRAP_OUT, ADJUSTMENT)
- Arıza kaydına bağlı parça tüketimi ve `breakdown_timeline` kaydı
- Minimum stok uyarısı: `currentStock <= minimumStock` geçişinde olay yayını
- Barkod ile parça arama (depo zemini ve arıza "parça ekle" modalı)

Her stok hareketi `StockMovement` tablosuna kalıcı olarak işlenir ve denetim izi oluşturur. `SparePart.currentStock` alanı her zaman aynı Postgres işlemi (transaction) içinde güncellenir — ayrı bir UPDATE çağrısı asla yapılmaz.

---

## Mimari Genel Bakış

```
SparePart (master kayıt — SKU başına bir satır, fabrika başına)
  └── StockMovement (her giriş/çıkış işlemi, append-only ledger)
```

Çok-kiracılık `factory_id` + Postgres RLS politikaları ile sağlanır. `factory_id` değeri her zaman sunucu tarafındaki oturumdan okunur; hiçbir endpoint'te istek gövdesinden kabul edilmez.

---

## API Endpoints

Tüm endpoint'ler `/api/spare-parts` altındadır. Çok-kiracılık Prisma middleware ile zorunlu kılınır.

---

### GET /api/spare-parts — Yedek Parça Listesi

**Yetki:** `SUPER_ADMIN`, `FACTORY_ADMIN`, `ENGINEER`, `TECHNICIAN`

**Query parametreleri:**

| Parametre      | Tip     | Açıklama                                                       |
|----------------|---------|----------------------------------------------------------------|
| `search`       | string  | `name` ve `code` alanlarında büyük/küçük harf duyarsız arama  |
| `category`     | string  | Kategoriye göre filtreleme                                     |
| `belowMinimum` | boolean | `true` olduğunda yalnızca `currentStock <= minimumStock` olanlar |

**Response:** `200 OK`

```json
[
  {
    "id": "cuid",
    "factoryId": "cuid",
    "code": "YP-2026-0001",
    "name": "Konveyör Kayışı 50mm",
    "category": "Mekanik",
    "unit": "adet",
    "currentStock": 3,
    "minimumStock": 5,
    "unitPrice": "120.0000",
    "location": "Raf A-12",
    "barcode": "1234567890123",
    "_count": { "stockMovements": 14 }
  }
]
```

**İş kuralları:**

- `belowMinimum=true` filtresi Prisma'nın sütun karşılaştırmasını desteklememesi nedeniyle uygulama katmanında uygulanır. Veritabanı tarafındaki `@@index([factoryId, currentStock])` indeksi bu işlemi hızlı kılar.
- Sonuçlar `name` alanına göre artan sıralanır.

---

### GET /api/spare-parts/:id — Tek Yedek Parça Detayı

**Yetki:** `SUPER_ADMIN`, `FACTORY_ADMIN`, `ENGINEER`, `TECHNICIAN`

**Response:** `200 OK` — Parça nesnesi + en son 20 `stockMovement` kaydı (kullanıcı adı ve makine bilgisiyle birlikte)

```json
{
  "id": "cuid",
  "code": "YP-2026-0001",
  "name": "Konveyör Kayışı 50mm",
  "currentStock": 3,
  "minimumStock": 5,
  "unitPrice": "120.0000",
  "stockMovements": [
    {
      "id": "cuid",
      "type": "BREAKDOWN_OUT",
      "quantity": 2,
      "unitPriceSnapshot": "120.0000",
      "note": "Kayış koptu",
      "createdAt": "2026-04-10T10:15:00.000Z",
      "user": { "id": "cuid", "name": "Ali Yılmaz" },
      "machine": { "id": "cuid", "name": "Konveyör Bant-1", "code": "KNV-01" },
      "breakdown": { "id": "cuid", "code": "ARZ-2026-0042" }
    }
  ],
  "_count": { "stockMovements": 14 }
}
```

**Hata:** `404 Not Found` — parça mevcut değil veya farklı fabrikaya ait.

---

### POST /api/spare-parts — Yedek Parça Oluştur

**Yetki:** `FACTORY_ADMIN`, `ENGINEER`

**Request body (Zod: `createSparePartSchema`):**

| Alan           | Tip     | Zorunlu | Açıklama                                          |
|----------------|---------|---------|---------------------------------------------------|
| `code`         | string  | evet    | Fabrika içinde benzersiz SKU (maks 50 karakter)   |
| `name`         | string  | evet    | Görüntü adı (maks 200 karakter)                   |
| `category`     | string  | evet    | Kategori (maks 100 karakter)                      |
| `unit`         | string  | evet    | Ölçü birimi — bkz. Birim Tipleri bölümü           |
| `minimumStock` | number  | evet    | Integer ≥ 0                                       |
| `unitPrice`    | number  | evet    | Ondalıklı, pozitif                                |
| `description`  | string  | hayır   | Serbest metin (maks 2000 karakter)                |
| `supplier`     | string  | hayır   | Tedarikçi adı (maks 200 karakter)                 |
| `leadTimeDays` | number  | hayır   | Tedarik süresi (gün, integer ≥ 0)                 |
| `location`     | string  | hayır   | Raf/bölme etiketi (maks 200 karakter)             |
| `barcode`      | string  | hayır   | EAN/QR barkod — tüm fabrikada benzersiz           |

**Response:** `201 Created` — tam parça nesnesi. `currentStock` başlangıçta `0` olarak atanır.

**Hata kodları:**

| Kod | HTTP | Açıklama                                  |
|-----|------|-------------------------------------------|
| `spare_part_code_conflict` | 409 | Aynı `code` bu fabrikada zaten var |
| `validation_error`         | 400 | Zod doğrulama hatası                |

---

### PUT /api/spare-parts/:id — Yedek Parça Güncelle

**Yetki:** `FACTORY_ADMIN`, `ENGINEER`

**Request body (Zod: `updateSparePartSchema`):** `createSparePartSchema`'nın partial versiyonu — herhangi bir alan kombinasyonu gönderilebilir.

**İş kuralları:**

- `code` değiştirilmek isteniyorsa yeni kodun fabrikada benzersiz olması gerekir; çakışma `409` döner.
- `currentStock` bu endpoint üzerinden **değiştirilemez** — stok değişikliği yalnızca stok hareketi endpoint'leri ile yapılır.

**Response:** `200 OK` — güncellenmiş parça nesnesi.

---

### DELETE /api/spare-parts/:id — Yedek Parça Sil

**Yetki:** `FACTORY_ADMIN`

**İş kuralları:**

- `currentStock > 0` olan bir parça silinmek istendiğinde `409 spare_part_has_stock` hatası döner. Önce stok sıfırlanmalıdır.
- Silme işlemi hard delete'tir; ancak `StockMovement` kayıtları `sparePartId`'ye `RESTRICT` kısıtı ile bağlıdır; dolayısıyla stok hareketi olan bir parça zaten direkt silinemez.

**Response:** `200 OK` — `{ "success": true }`

---

### GET /api/spare-parts/:id/movements — Stok Hareketleri Listesi

**Yetki:** `SUPER_ADMIN`, `FACTORY_ADMIN`, `ENGINEER`, `TECHNICIAN`

**Response:** `200 OK` — Hareket kayıtları azalan `createdAt` sırası ile, kullanıcı adı, makine ve arıza kodu dahil.

```json
[
  {
    "id": "cuid",
    "type": "BREAKDOWN_OUT",
    "quantity": 2,
    "unitPriceSnapshot": "120.0000",
    "machineId": "cuid",
    "breakdownId": "cuid",
    "note": "Kayış koptu",
    "createdAt": "2026-04-10T10:15:00.000Z",
    "user": { "id": "cuid", "name": "Ali Yılmaz" },
    "machine": { "id": "cuid", "name": "Konveyör Bant-1", "code": "KNV-01" },
    "breakdown": { "id": "cuid", "code": "ARZ-2026-0042" }
  }
]
```

---

### POST /api/spare-parts/:id/movements — Stok Hareketi Oluştur

**Yetki:** Hareket tipine göre değişir (aşağıdaki tabloya bkz.)

**Request body (Zod: `createStockMovementSchema`):**

| Alan          | Tip     | Zorunlu | Açıklama                                             |
|---------------|---------|---------|------------------------------------------------------|
| `sparePartId` | string  | evet    | URL parametresiyle eşleşmeli                         |
| `type`        | string  | evet    | Hareket tipi enum değeri (bkz. Stok Hareket Tipleri) |
| `quantity`    | number  | evet    | Pozitif integer                                      |
| `machineId`   | string  | hayır   | Parçanın çıkış yapıldığı makine                      |
| `breakdownId` | string  | hayır   | BREAKDOWN_OUT için ilgili arıza kaydı                |
| `unitPrice`   | number  | hayır   | Snapshot fiyatını manuel override etmek için         |
| `note`        | string  | hayır   | Serbest metin not (maks 2000 karakter)               |

**Response:** `201 Created` — oluşturulan `StockMovement` kaydı.

**Hata kodları:**

| Kod                  | HTTP | Açıklama                                            |
|----------------------|------|-----------------------------------------------------|
| `validation_error`   | 400  | Zod doğrulama hatası                                |
| `spare_part_id_mismatch` | 400 | `body.sparePartId` ≠ URL parametresi            |
| `forbidden`          | 403  | Kullanıcı rolü bu hareket tipine izin vermiyor      |
| `not_found`          | 404  | Parça bulunamadı                                    |
| `insufficient_stock` | 422  | Çıkış, stoku negatife düşürür                       |
| `invalid_quantity`   | 400  | Geçersiz miktar                                     |
| `invalid_type`       | 400  | Geçersiz hareket tipi                               |

**Yan etkiler:**

1. `StockMovement` satırı eklenir ve `SparePart.currentStock` aynı işlemde güncellenir.
2. `stock.movement` domain eventi yayınlanır.
3. Stok eşiği geçişinde `stock.minimum_reached` eventi ayrıca yayınlanır.

---

### GET /api/spare-parts/alerts — Minimum Stok Uyarıları

**Yetki:** `FACTORY_ADMIN`, `ENGINEER`

**Response:** `200 OK` — `currentStock <= minimumStock` olan parçalar, eksiklik miktarına göre azalan sırada.

```json
[
  {
    "id": "cuid",
    "code": "YP-2026-0001",
    "name": "Konveyör Kayışı 50mm",
    "currentStock": 1,
    "minimumStock": 5,
    "shortage": 4
  }
]
```

`shortage` alanı `minimumStock - currentStock` formülü ile hesaplanır ve sıralama kriteri olarak kullanılır (en kritik önce).

---

## Dosya Haritası

| Dosya | Açıklama |
|-------|----------|
| `src/app/api/spare-parts/route.ts` | GET (liste) + POST (oluştur) |
| `src/app/api/spare-parts/[id]/route.ts` | GET (detay) + PUT (güncelle) + DELETE (sil) |
| `src/app/api/spare-parts/[id]/movements/route.ts` | GET (hareket listesi) + POST (hareket oluştur) |
| `src/app/api/spare-parts/alerts/route.ts` | GET (minimum stok uyarıları) |
| `src/lib/validations/spare-part.ts` | Zod şemaları: `createSparePartSchema`, `updateSparePartSchema`, `createStockMovementSchema` |
| `src/lib/services/stock-service.ts` | `createStockMovement()`, `StockServiceError` |
| `prisma/schema.prisma` | `SparePart`, `StockMovement`, `StockMovementType` enum |

---

## Veri Modeli

### SparePart

| Alan           | Tip            | Açıklama                                              |
|----------------|----------------|-------------------------------------------------------|
| `id`           | String (cuid)  | Birincil anahtar                                      |
| `factoryId`    | String         | Kiracı kapsamı (RLS ile korunur)                      |
| `code`         | String         | SKU — fabrika içinde benzersiz (`@@unique([factoryId, code])`) |
| `name`         | String         | Türkçe görüntü adı                                    |
| `description`  | String?        | Opsiyonel açıklama                                    |
| `category`     | String         | Parça kategorisi                                      |
| `unit`         | String         | Ölçü birimi                                           |
| `currentStock` | Int            | Anlık stok miktarı — her harekette atomik güncellenir |
| `minimumStock` | Int            | Minimum eşik — bu değere düşünce uyarı tetiklenir     |
| `unitPrice`    | Decimal(12,4)  | Birim fiyat (maliyet hesabında kullanılır)            |
| `supplier`     | String?        | Tedarikçi adı                                         |
| `leadTimeDays` | Int?           | Tedarik süresi (gün)                                  |
| `location`     | String?        | Raf/bölme etiketi                                     |
| `barcode`      | String?        | Barkod — tüm sistemde benzersiz (`@unique`)           |
| `photoKey`     | String?        | S3 nesne anahtarı                                     |

**İndeksler:** `@@index([factoryId, currentStock])` — minimum stok filtresi için.

### StockMovement

| Alan                | Tip            | Açıklama                                                          |
|---------------------|----------------|-------------------------------------------------------------------|
| `id`                | String (cuid)  | Birincil anahtar                                                  |
| `factoryId`         | String         | Kiracı kapsamı                                                    |
| `sparePartId`       | String         | İlgili parça                                                      |
| `type`              | StockMovementType | Hareket tipi                                                   |
| `quantity`          | Int            | Pozitif tam sayı — yön `type` enum'unda kodlanmış                 |
| `unitPriceSnapshot` | Decimal(12,4)? | İşlem anındaki birim fiyat anlık görüntüsü                        |
| `machineId`         | String?        | Parçanın çıkış yapıldığı makine (BREAKDOWN_OUT / PM_OUT için)     |
| `breakdownId`       | String?        | İlgili arıza kaydı                                                |
| `pmPlanId`          | String?        | İlgili planlı bakım planı                                         |
| `userId`            | String         | İşlemi gerçekleştiren kullanıcı                                   |
| `note`              | String?        | Serbest metin not                                                 |
| `createdAt`         | DateTime       | Sunucu tarafından atanan UTC zaman damgası — client'tan alınmaz   |

---

## Stok Hareket Tipleri

| `type`          | Yön | İzin Verilen Roller                              | Açıklama                                              |
|-----------------|-----|--------------------------------------------------|-------------------------------------------------------|
| `PURCHASE_IN`   | +   | `FACTORY_ADMIN`, `ENGINEER`                      | Satın alma / gelen stok girişi                        |
| `RETURN_IN`     | +   | `FACTORY_ADMIN`, `ENGINEER`, `TECHNICIAN`        | Kullanılmayan parçanın iade edilmesi                  |
| `BREAKDOWN_OUT` | −   | `FACTORY_ADMIN`, `ENGINEER`, `TECHNICIAN`        | Arıza tamirinde tüketilen parça                       |
| `PM_OUT`        | −   | `FACTORY_ADMIN`, `ENGINEER`, `TECHNICIAN`        | Planlı bakımda tüketilen parça                        |
| `SCRAP_OUT`     | −   | `FACTORY_ADMIN`, `ENGINEER`                      | Hurdaya çıkarılan veya kaybolan parça                 |
| `ADJUSTMENT`    | ±   | `FACTORY_ADMIN`                                  | Manuel stok düzeltmesi (sayım farkı vb.)              |

---

## Formüller ve Hesaplamalar

### currentStock Güncelleme Formülü

Stok hareketi oluşturulduğunda `stock-service.ts` şu mantığı uygular:

```
Giriş tipleri (PURCHASE_IN, RETURN_IN):
  currentStock = currentStock + quantity

Çıkış tipleri (BREAKDOWN_OUT, PM_OUT, SCRAP_OUT, ADJUSTMENT):
  currentStock = currentStock - quantity
  Kısıt: currentStock - quantity >= 0  →  aksi halde insufficient_stock hatası
```

Güncelleme, `StockMovement` satırı ekleme ile aynı Postgres transaction içinde gerçekleşir.

### unitPriceSnapshot ve Maliyet Hesabı

`StockMovement.unitPriceSnapshot`, hareket anındaki `SparePart.unitPrice` değerinin anlık görüntüsüdür. Bu sayede `unitPrice` sonradan değiştirilse bile geçmiş maliyet raporları doğru kalır.

```
Tek hareketin maliyeti = quantity × unitPriceSnapshot

Arızanın toplam parça maliyeti:
  = ΣSUMi (quantity_i × unitPriceSnapshot_i)
    WHERE breakdownId = <arıza-id>
      AND type = BREAKDOWN_OUT
```

Maliyet raporu bu formülü `StockMovement` tablosunda `breakdownId`'ye göre gruplandırarak hesaplar.

### Minimum Stok Uyarı Mantığı

```
shortage = minimumStock - currentStock

Uyarı koşulu: currentStock <= minimumStock
Olay: stock.minimum_reached — yalnızca eşik yukarıdan aşağıya geçişinde tetiklenir
```

Stok zaten eşiğin altındayken yapılan ek çıkışlar olayı yeniden tetiklemez. Stok tekrar eşiğin üzerine çıkıp tekrar düşerse olay yeniden tetiklenir.

---

## İş Kuralları ve Edge Case'ler

- **Negatif stok engeli:** `stock-service.ts`, stoku negatife düşürecek her çıkışı `insufficient_stock` kodu ile reddeder. UI tarafında önce `currentStock` kontrol edilmeli, ancak sunucu her zaman yetkili güvenlik noktasıdır.

- **Eşzamanlı çıkış:** `currentStock` atomik UPDATE ile azaltılır. Yetersiz stok varsa sıfır satır döner ve `StockServiceError("insufficient_stock")` fırlatılır.

- **Barkod benzersizliği:** `barcode` alanına `@unique` kısıtı uygulanmıştır. Yinelenen barkod girişiminde Prisma `P2002` hatası döner.

- **Silinmiş makine:** Makine soft-delete yapılsa bile, bağlı parçalar ve hareketler erişilebilir kalmaya devam eder. `StockMovement.machineId` FK'si `onDelete: SetNull` ile tanımlanmıştır.

- **Hareket tip uyumsuzluğu:** `sparePartId` body'de URL parametresiyle eşleşmiyorsa `spare_part_id_mismatch (400)` hatası döner.

- **Abonelik limiti:** Yedek parça sayısı abonelik planlarında (§10.2) kısıtlanmamıştır; yalnızca kullanıcı ve makine sayısı kısıtlıdır.

- **Parça silme koruması:** `currentStock > 0` olan bir parça silinememez. Stok önce sıfırlanmalı (ADJUSTMENT veya SCRAP_OUT hareketi).
