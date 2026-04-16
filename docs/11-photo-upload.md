# Photo Upload

## Amaç

Fotoğraf yükleme altyapısı makine, arıza, otonom bakım yanıtı ve aksiyon gibi domain varlıklarına polimorfik olarak fotoğraf eklenmesini sağlar. Geliştirme ortamında AWS kimlik bilgisi gerektirmeden `public/uploads/` altına kaydeder; `USE_S3=true` ortam değişkeni ile S3'e geçer.

---

## Storage Service

**Dosya:** `src/lib/services/storage-service.ts`

### Fonksiyonlar

| Fonksiyon | Parametreler | Dönüş | Açıklama |
|---|---|---|---|
| `uploadFile` | `file: Buffer, contentType: string, referenceType: string, referenceId: string, factoryId?: string` | `Promise<UploadResult>` | Ortama göre local veya S3'e yükler |
| `uploadLocal` | `file, contentType, referenceType, referenceId` | `Promise<UploadResult>` | `public/uploads/{type}/{id}/{uuid}.ext` yoluna kaydeder |
| `uploadToS3` | `file, contentType, factoryId, referenceType, referenceId` | `Promise<UploadResult>` | S3'e yükler; presigned GET URL döner |
| `deleteFile` | `key: string` | `Promise<void>` | Local veya S3 dosyasını siler |
| `resolveUrl` | `key: string` | `Promise<string>` | Tarayıcı URL'si döner (local: doğrudan yol; S3: presigned 15 dk) |
| `generatePresignedUploadUrl` | `key: string` | `Promise<{ uploadUrl, key }>` | S3 PUT presigned URL (15 dk) |
| `generatePresignedDownloadUrl` | `key: string` | `Promise<string>` | S3 GET presigned URL (15 dk) |

### UploadResult

```ts
interface UploadResult {
  key: string;      // Depolama yolu / S3 key
  url: string;      // Tarayıcıya verilecek URL
  sizeBytes: number;
}
```

### Ortam Değişkenleri

| Değişken | Varsayılan | Açıklama |
|---|---|---|
| `USE_S3` | (boş) | `true` ise S3 kullanılır |
| `AWS_REGION` | `eu-central-1` | S3 bucket bölgesi |
| `S3_BUCKET` | (zorunlu, USE_S3=true) | S3 bucket adı |

---

## API Routes

### POST /api/photos/upload

**Dosya:** `src/app/api/photos/upload/route.ts`

**İstek:** `multipart/form-data`

| Alan | Tip | Zorunlu | Açıklama |
|---|---|---|---|
| `file` | File | Evet | JPEG, PNG veya WebP; maks. 10 MB |
| `referenceType` | `PhotoReferenceType` | Evet | `MACHINE`, `BREAKDOWN`, `CHECKLIST_RESPONSE`, `ACTION_BEFORE`, `ACTION_AFTER`, `SPARE_PART` |
| `referenceId` | string | Evet | İlgili kaydın ID'si |
| `description` | string | Hayır | İsteğe bağlı açıklama |

**Yanıt:** `201` — Photo kaydı + `url` alanı

**Roller:** Tüm kimlik doğrulanmış kullanıcılar

---

### GET /api/photos

**Dosya:** `src/app/api/photos/route.ts`

**Query parametreleri:** `referenceType` ve `referenceId` (her ikisi zorunlu)

**Yanıt:** `200` — Photo dizisi (her kayıtta `url` alanı dahil), en yeni önce

**Roller:** Tüm kimlik doğrulanmış kullanıcılar

---

### DELETE /api/photos/[id]

**Dosya:** `src/app/api/photos/[id]/route.ts`

**Yanıt:** `200` — `{ success: true }`

**Roller ve kurallar:**
- `FACTORY_ADMIN`, `ENGINEER`, `SUPER_ADMIN` → tüm factory fotoğrafları
- `TECHNICIAN` → yalnızca kendi yüklediği fotoğraflar

---

## PhotoUpload Bileşeni

**Dosya:** `src/components/ui/photo-upload.tsx`

### Props

| Prop | Tip | Zorunlu | Açıklama |
|---|---|---|---|
| `referenceType` | string | Evet | API'ye iletilen PhotoReferenceType değeri |
| `referenceId` | string | Evet | İlgili kaydın ID'si |
| `maxPhotos` | number | Hayır | İzin verilen maksimum fotoğraf sayısı |
| `className` | string | Hayır | Ek CSS sınıfları |

### Özellikler

- Sürükle-bırak veya tıklayarak dosya seçme
- Yükleme ilerleme çubuğu (XMLHttpRequest progress event)
- Mevcut fotoğrafların thumbnail görünümü
- Hover ile silme butonu
- 10 MB ve dosya tipi doğrulaması (client + server)
- Mount sırasında mevcut fotoğraflar otomatik yüklenir

### Kullanım Örnekleri

```tsx
// Makine detay sayfası
<PhotoUpload referenceType="MACHINE" referenceId={machineId} />

// Arıza detay sayfası
<PhotoUpload referenceType="BREAKDOWN" referenceId={breakdownId} />

// Aksiyon öncesi fotoğraf (maks. 3)
<PhotoUpload referenceType="ACTION_BEFORE" referenceId={actionId} maxPhotos={3} />
```

### Edge Case'ler

- `referenceId` boşsa bileşen fotoğraf çekmez (query `enabled: !!referenceId`).
- `maxPhotos` limitine ulaşıldığında drop zone gizlenir.
- Silme işlemi sırasında başka bir silme engellenmez; ancak sunucu sırasıyla işler.
- Local modda `public/uploads/` altındaki dizinler ilk yüklemede otomatik oluşturulur.

---

## Entegrasyon

PhotoUpload bileşeni aşağıdaki sayfalara eklenmiştir:

- Makine Detay: `src/app/(app)/makineler/[id]/page.tsx` — `referenceType="MACHINE"`
- Arıza Detay: `src/app/(app)/arizalar/[id]/page.tsx` — `referenceType="BREAKDOWN"`
