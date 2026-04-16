# Super Admin Paneli

## Amaç

Super Admin, MaintainPro platformunun en üst seviye yöneticisidir. Herhangi bir fabrikaya bağlı olmayan, platform genelinde çalışan tek roldür. Bu panelden fabrikaları (tenant) oluşturur, günceller, siler; abonelik planlarını yönetir; platform geneli istatistikleri izler.

Super Admin hesabı `factory_id` taşımaz. Prisma sorgularında `unsafePrisma` (RLS bypass) kullanılır; fabrika bazlı izolasyon kuralları bu rol için uygulanmaz, ancak `withApiTenant({ roles: ["SUPER_ADMIN"] })` guard'ı her endpoint'te zorunludur.

---

## Fabrika (Tenant) Yönetimi

### Listeleme

```
GET /api/admin/factories
```

Tüm fabrikaları oluşturulma tarihine göre tersten sıralar. Her satırda fabrika bilgileri, abonelik durumu ve kullanıcı/makine sayımları döner.

**Yanıt örneği:**

```json
[
  {
    "id": "clx...",
    "name": "Örnek Fabrika A.Ş.",
    "slug": "ornek-fabrika",
    "email": null,
    "phone": "+90 212 000 00 00",
    "createdAt": "2026-04-01T08:00:00.000Z",
    "subscription": {
      "plan": "PROFESSIONAL",
      "status": "active",
      "userLimit": 15,
      "machineLimit": 50,
      "storageLimitGb": 20,
      "currentPeriodEnd": "2027-04-01T08:00:00.000Z"
    },
    "_count": {
      "users": 9,
      "machines": 34
    }
  }
]
```

### Fabrika Detayı

```
GET /api/admin/factories/[id]
```

Abonelik bilgileriyle birlikte kullanıcı, makine ve arıza sayımlarını döner.

### Fabrika Oluşturma

```
POST /api/admin/factories
```

**Gövde (JSON):**

| Alan | Tip | Zorunlu | Açıklama |
|------|-----|---------|----------|
| `name` | string | Evet | Fabrika adı (max 200 karakter) |
| `slug` | string | Evet | URL dostu tanımlayıcı; yalnızca küçük harf, rakam, tire (2–60 karakter) |
| `city` | string | Evet | Şehir (max 100 karakter) |
| `address` | string | Hayır | Adres detayı (max 500 karakter) |
| `phone` | string | Hayır | Telefon (max 20 karakter) |
| `plan` | enum | Evet | `STARTER` \| `PROFESSIONAL` \| `ENTERPRISE` |

Fabrika oluşturulurken şu işlemler atomik olarak gerçekleşir:

1. `factories` tablosuna kayıt eklenir.
2. Seçilen planın limitlerinden bir `subscriptions` kaydı oluşturulur.
3. Abonelik bitiş tarihi bugünden tam 1 yıl sonraya ayarlanır.

**Slug çakışması:** Aynı slug'a sahip fabrika varsa `409 Conflict` döner.

### Fabrika Güncelleme

```
PUT /api/admin/factories/[id]
```

`createFactorySchema` ile aynı alanlar, tümü opsiyonel (`partial()`). Slug değiştiriliyorsa benzersizlik kontrolü tekrar yapılır.

### Fabrika Silme

```
DELETE /api/admin/factories/[id]
```

Silme koruması: Fabrikaya ait **kullanıcı**, **arıza** veya **makine** kaydı varsa işlem reddedilir ve mevcut sayımlar `409 Conflict` ile birlikte döner.

```json
{
  "error": "Fabrikaya ait kullanıcı, arıza veya makine kayıtları bulunmaktadır. Silmeden önce bu kayıtları kaldırın.",
  "counts": { "users": 9, "breakdowns": 42, "machines": 34 }
}
```

---

## Abonelik Yönetimi

### Plan Tipleri ve Limitleri

| Plan | Kullanıcı | Makine | Depolama | Aylık Ücret |
|------|-----------|--------|----------|-------------|
| STARTER | 5 | 20 | 5 GB | $99 |
| PROFESSIONAL | 15 | 50 | 20 GB | $199 |
| ENTERPRISE | Sınırsız (999) | 100 | 100 GB | $399 |

Limitler `src/lib/auth/subscription-guard.ts` içindeki `PLAN_LIMITS` sabitiyle tanımlanır. Enterprise planında kullanıcı sınırı yok; kod `999` sentinel değerini kullanır.

### Abonelik Sorgulama

```
GET /api/admin/factories/[id]/subscription
```

Fabrikanın aktif abonelik kaydını döner.

### Abonelik Güncelleme

```
PUT /api/admin/factories/[id]/subscription
```

**Gövde (JSON):**

| Alan | Tip | Açıklama |
|------|-----|----------|
| `plan` | enum | `STARTER` \| `PROFESSIONAL` \| `ENTERPRISE` |
| `maxUsers` | integer | Özelleştirilmiş kullanıcı limiti |
| `maxMachines` | integer | Özelleştirilmiş makine limiti |
| `maxStorageGb` | integer | Özelleştirilmiş depolama limiti (GB) |
| `isActive` | boolean | `false` → abonelik `cancelled` durumuna geçer |

Abonelik kaydı yoksa `upsert` ile yeni kayıt oluşturulur. Limitler belirtilmezse seçilen planın varsayılan değerleri kullanılır. Super Admin, plan sınırlarının üzerinde özelleştirilmiş limitler tanımlayabilir (Enterprise müşterilerine özel anlaşmalar için).

---

## Limit Kontrol Mekanizması

### checkSubscriptionLimit Fonksiyonu

`src/lib/auth/subscription-guard.ts` içindeki `checkSubscriptionLimit` fonksiyonu, kaynak oluşturmadan önce fabrikanın limitini doğrular.

```typescript
async function checkSubscriptionLimit(
  factoryId: string,
  resource: "users" | "machines" | "storage"
): Promise<LimitCheckResult>

type LimitCheckResult = {
  allowed: boolean;  // İşleme izin verilip verilmediği
  current: number;   // Mevcut kullanım
  max: number;       // İzin verilen maksimum
};
```

**Kontrol mantığı:**

- Abonelik kaydı yoksa veya `status !== "active"` ise → `allowed: false`
- `users`: Fabrikadaki aktif (`isActive: true`) kullanıcı sayısını `userLimit` ile karşılaştırır
- `machines`: Makine sayısını `machineLimit` ile karşılaştırır
- `storage`: Tüm fotoğrafların `sizeBytes` toplamını byte cinsinden `storageLimitGb × 1024³` ile karşılaştırır

Bu fonksiyon şu endpoint'lerde zorunlu olarak çağrılır:
- `POST /api/users` — yeni kullanıcı oluşturma
- `POST /api/machines` — yeni makine oluşturma

Limit aşıldığında dönen hata örneği (`POST /api/users`):
```json
{
  "error": "Abonelik limitinize ulaştınız. Maksimum 15 kullanıcı ekleyebilirsiniz (mevcut: 15). Planınızı yükseltmek için sistem yöneticinizle iletişime geçin."
}
```

### Limit Durum Sorgulama

```
GET /api/admin/factories/[id]/check-limits
```

Yalnızca Super Admin erişebilir. Üç kaynağın mevcut durumunu döner:

```json
{
  "users":    { "allowed": true, "current": 9,  "max": 15 },
  "machines": { "allowed": true, "current": 34, "max": 50 },
  "storage": {
    "allowed": true,
    "currentBytes": 1073741824,
    "maxBytes": 21474836480,
    "currentGb": 1.0,
    "maxGb": 20
  }
}
```

---

## Kullanıcı Yönetimi API

### Fabrika Kullanıcılarını Listeleme

```
GET /api/users
```

Yalnızca `FACTORY_ADMIN` erişebilir. Kendi fabrikasındaki `SUPER_ADMIN` dışı tüm kullanıcıları alfabetik sırala döner.

**Yanıt alanları:** `id`, `name`, `email`, `role`, `isActive`, `createdAt`, `lastLoginAt`, `department`

### Yeni Kullanıcı Oluşturma

```
POST /api/users
```

Yalnızca `FACTORY_ADMIN` erişebilir. `SUPER_ADMIN` rolü bu endpoint ile oluşturulamaz.

**Gövde (JSON):**

| Alan | Tip | Zorunlu | Açıklama |
|------|-----|---------|----------|
| `name` | string | Evet | Ad soyad (max 200 karakter) |
| `email` | string | Evet | Geçerli e-posta adresi |
| `password` | string | Evet | Min 8 karakter |
| `role` | enum | Evet | `FACTORY_ADMIN` \| `ENGINEER` \| `TECHNICIAN` |
| `departmentId` | CUID | Hayır | Departman ataması |
| `phone` | string | Hayır | Telefon (max 20 karakter) |

Şifre `bcrypt` ile 12 tur hash'lenir. Kullanıcı oluşturulmadan önce abonelik kullanıcı limiti kontrol edilir. E-posta adresi platformda unique olmalıdır.

---

## Platform İstatistikleri

```
GET /api/admin/stats
```

Yalnızca `SUPER_ADMIN` erişebilir. Platform genelindeki sayımları ve aylık gelir tahminini döner.

**Yanıt:**

```json
{
  "totalFactories": 12,
  "totalUsers": 87,
  "totalMachines": 340,
  "activeSubscriptions": 12,
  "revenue": {
    "monthlyUsd": 2389,
    "planBreakdown": {
      "STARTER": 5,
      "PROFESSIONAL": 6,
      "ENTERPRISE": 1
    }
  }
}
```

### Gelir Hesaplaması

Aylık gelir (MRR), aktif aboneliklerin plan bazlı sabit ücretleri toplanarak hesaplanır:

```
MRR = (STARTER_sayisi × $99) + (PROFESSIONAL_sayisi × $199) + (ENTERPRISE_sayisi × $399)
```

`totalUsers` sayısı `SUPER_ADMIN` rolündeki hesapları hariç tutar; yalnızca fabrika kullanıcıları sayılır.

---

## UI Sayfaları

### Ana Yönetim Paneli (`/super-admin`)

`src/app/(app)/super-admin/page.tsx`

5 istatistik kartından oluşur:

| Kart | Gösterilen Değer |
|------|-----------------|
| Toplam Fabrika | Platformdaki fabrika sayısı |
| Toplam Kullanıcı | Tüm fabrika kullanıcıları (SUPER_ADMIN hariç) |
| Toplam Makine | Tüm makine kayıtları |
| Aktif Abonelik | `status = active` abonelik sayısı |
| Aylık Gelir | MRR (USD) |

İstatistiklerin altında fabrikalar tablosu listelenir. Tablo sütunları: Fabrika Adı / Slug, Plan, Kullanıcı Sayısı, Makine Sayısı, Durum, İşlemler.

Plan badge renkleri: Starter → `secondary`, Professional → `warning`, Enterprise → `success`.

Fabrika durumu: `ACTIVE` → yeşil, `SUSPENDED` → kırmızı, `TRIAL` → gri.

Tabloda ada ve slug'a göre anlık arama filtresi mevcuttur.

### Fabrika Oluşturma (`/super-admin/fabrikalar/yeni`)

`src/app/(app)/super-admin/fabrikalar/yeni/`

Yeni fabrika formu: ad, slug, şehir, adres, telefon, plan seçimi.

### Fabrika Detayı (`/super-admin/fabrikalar/[id]`)

`src/app/(app)/super-admin/fabrikalar/[id]/`

Fabrika bilgileri, abonelik durumu, kullanıcı/makine/arıza sayımları ve limit kullanım göstergesi.

---

## Edge Case'ler

| Durum | Davranış |
|-------|----------|
| Fabrika silme — kayıt var | `409 Conflict`, sayımlar yanıtta gösterilir |
| Slug çakışması | `409 Conflict` |
| Abonelik yoksa limit kontrolü | `allowed: false`, kayıt oluşturulamaz |
| Abonelik `cancelled` iken limit kontrolü | `allowed: false`, tüm kaynak oluşturma engellenir |
| SUPER_ADMIN rolünde kullanıcı oluşturma | `POST /api/users` tarafından reddedilir |
| Plan değişikliği, limitler belirtilmemişse | Yeni planın varsayılan limitleri otomatik uygulanır |
