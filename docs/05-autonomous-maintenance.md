# Otonom Bakım (Autonomous Maintenance)

## Amaç

Bu modül **TPM Pillar 1 — Jishu Hozen (Otonom Bakım)** pratiğini dijitalleştirir. Operatörler ve teknisyenler, makinelere tanımlı yapılandırılmış kontrol listelerini belirli frekanslarda (günlük, haftalık, aylık, vardiya başı) tamamlar. Bir madde anormal olarak işaretlendiğinde sistem otomatik olarak bir düzeltici aksiyon oluşturur. Bu sayede mühendislik müdahalesi beklenmeden kapalı döngülü iyileştirme sağlanır.

**Temel değer:** Erken anormallik tespiti → otomatik aksiyon oluşturma → takip ve doğrulama.

---

## Mimari Genel Bakış

```
ChecklistTemplate  (şablon tanımı — makine başına, yeniden kullanılabilir)
  └── ChecklistItem[]   (sıralı madde listesi)
       └── ItemResponse  (her maddenin cevabı — kayıt bazlı)

ChecklistRecord    (şablonun bir yürütme örneği — tek çalışma)
  ├── ItemResponse[]    (cevaplar)
  └── Action[]          (anormal maddelerden otomatik oluşturulan aksiyonlar)
```

Yaşam döngüsü:

```
ChecklistTemplate  →  ChecklistRecord (pending)
                               ↓  start
                       ChecklistRecord (in_progress)
                               ↓  submit
                       ChecklistRecord (completed)
                               └── Action[] (isAbnormal=true olan maddeler için)
```

Çok-kiracılık `factory_id` + Postgres RLS politikaları ile sağlanır. `factory_id` her zaman sunucu tarafındaki oturumdan okunur.

---

## API Endpoints

### Şablon Endpoint'leri (Templates)

---

#### GET /api/checklists/templates — Şablon Listesi

**Yetki:** `FACTORY_ADMIN`, `ENGINEER`

**Query parametreleri:**

| Parametre  | Tip     | Açıklama                                                    |
|------------|---------|-------------------------------------------------------------|
| `machineId` | string | Belirli bir makineye ait şablonları filtrele                |
| `period`    | string | `DAILY`, `WEEKLY`, `MONTHLY`, `SHIFT_START`                 |
| `isActive`  | string | `"true"` veya `"false"` — varsayılan: tüm şablonlar        |

**Response:** `200 OK` — şablon listesi, makine bilgisi ve madde sayısı dahil.

```json
[
  {
    "id": "cuid",
    "name": "Günlük Konveyör Bakımı",
    "period": "DAILY",
    "isActive": true,
    "assignedRoles": ["TECHNICIAN", "ENGINEER"],
    "machine": { "id": "cuid", "name": "Konveyör Bant-1", "code": "KNV-01" },
    "_count": { "items": 8 }
  }
]
```

---

#### POST /api/checklists/templates — Şablon Oluştur

**Yetki:** `FACTORY_ADMIN`, `ENGINEER`

**Request body (Zod: `createTemplateSchema`):**

| Alan            | Tip      | Zorunlu | Açıklama                                              |
|-----------------|----------|---------|-------------------------------------------------------|
| `machineId`     | string   | evet    | Şablonun bağlı olduğu makine                          |
| `name`          | string   | evet    | Şablon adı (maks 200 karakter)                        |
| `period`        | string   | evet    | Frekans — `DAILY`, `WEEKLY`, `MONTHLY`, `SHIFT_START` |
| `assignedRoles` | string[] | evet    | En az bir rol — `TECHNICIAN`, `ENGINEER`, vb.         |
| `items`         | object[] | evet    | En az bir madde — bkz. `checklistItemSchema`          |

**`items` içindeki her madde:**

| Alan             | Tip     | Zorunlu | Açıklama                                                   |
|------------------|---------|---------|------------------------------------------------------------|
| `title`          | string  | evet    | Kontrol edilecek şeyin açıklaması (maks 300 karakter)      |
| `type`           | string  | evet    | Madde tipi — bkz. Madde Tipleri bölümü                     |
| `referenceValue` | string  | hayır   | MEASUREMENT için beklenen değer/aralık (maks 500 karakter) |
| `photoRequired`  | boolean | hayır   | Fotoğraf yüklenmesi zorunlu mu? Varsayılan: `false`        |
| `meta`           | object  | hayır   | MULTIPLE_CHOICE için `{ "choices": ["OK","NOK","N/A"] }`   |

**Response:** `201 Created` — maddeleri (sıralı) içeren tam şablon nesnesi.

**İş kuralları:**

- `orderIndex`, `items` dizisindeki sıra (0 tabanlı) olarak sunucu tarafından atanır.
- Makine `factoryId`'nin dışındaysa RLS tarafından engellenir.

---

#### GET /api/checklists/templates/:id — Şablon Detayı

**Yetki:** `FACTORY_ADMIN`, `ENGINEER`

**Response:** `200 OK` — `orderIndex` sıralamasıyla maddeleri içeren tam şablon nesnesi. `404` mevcut değilse.

---

#### PUT /api/checklists/templates/:id — Şablon Güncelle

**Yetki:** `FACTORY_ADMIN`, `ENGINEER`

**Request body (Zod: `updateTemplateSchema`):** `name`, `period`, `isActive`, `assignedRoles`, `items` — hepsi opsiyonel.

**İş kuralları:**

- `items` dizisi gönderilirse bu **tam yerini alma** işlemidir: mevcut tüm maddeler silinir, yenileri oluşturulur. Kısmi madde güncellemesi desteklenmez.
- `items` gönderilmezse mevcut maddeler değişmez.

**Response:** `200 OK` — güncellenmiş şablon.

---

#### DELETE /api/checklists/templates/:id — Şablon Sil

**Yetki:** `FACTORY_ADMIN`

**İş kuralları:**

- Şablona bağlı herhangi bir `ChecklistRecord` varsa `409 has_records` hatası döner. Yürütme geçmişi korunmak zorundadır.
- Kaydı olmayan şablonlar hard delete yapılır.

**Response:** `200 OK` — `{ "success": true }`

---

### Kayıt Endpoint'leri (Records)

---

#### GET /api/checklists/records — Kayıt Listesi

**Yetki:** `FACTORY_ADMIN`, `ENGINEER`, `TECHNICIAN`

**Query parametreleri:**

| Parametre    | Tip    | Açıklama                                                   |
|--------------|--------|------------------------------------------------------------|
| `machineId`  | string | Makineye göre filtrele                                     |
| `templateId` | string | Şablona göre filtrele                                      |
| `status`     | string | `pending`, `in_progress`, `completed`, `missed`            |
| `from`       | string | ISO 8601 tarih — `scheduledFor >= from`                    |
| `to`         | string | ISO 8601 tarih — `scheduledFor <= to`                      |

**Response:** `200 OK` — şablon adı ve makine bilgisiyle birlikte kayıt listesi, `scheduledFor` azalan sıra.

---

#### POST /api/checklists/records — Kayıt Oluştur (Zamanlama)

**Yetki:** `FACTORY_ADMIN`, `ENGINEER`

**Request body (Zod: `createRecordSchema`):**

| Alan           | Tip    | Zorunlu | Açıklama                           |
|----------------|--------|---------|------------------------------------|
| `templateId`   | string | evet    | Hangi şablondan yürütülecek        |
| `scheduledFor` | string | evet    | ISO 8601 datetime — planlanan zaman |

**Response:** `201 Created` — `status: "pending"` durumunda yeni kayıt.

**İş kuralları:**

- Şablon bu fabrikaya ait değilse `404 template_not_found` döner.
- `machineId`, şablondan otomatik kopyalanır.

---

#### GET /api/checklists/records/:id — Kayıt Detayı

**Yetki:** `FACTORY_ADMIN`, `ENGINEER`, `TECHNICIAN`

**Response:** `200 OK` — şablon (maddeleriyle), makine, kullanıcı, tüm cevaplar ve aksiyonlar dahil tam kayıt nesnesi.

```json
{
  "id": "cuid",
  "status": "completed",
  "scheduledFor": "2026-04-13T08:00:00.000Z",
  "startedAt": "2026-04-13T08:05:00.000Z",
  "completedAt": "2026-04-13T08:22:00.000Z",
  "template": {
    "id": "cuid",
    "name": "Günlük Konveyör Bakımı",
    "period": "DAILY",
    "items": [
      { "id": "cuid", "orderIndex": 0, "title": "Kayış gerilimi kontrol", "type": "YES_NO" }
    ]
  },
  "responses": [
    {
      "id": "cuid",
      "itemId": "cuid",
      "valueBool": false,
      "isAbnormal": true,
      "note": "Kayış gevşek",
      "action": { "id": "cuid", "code": "OB-AKS-2026-0007", "status": "OPEN" }
    }
  ],
  "actions": [
    {
      "id": "cuid",
      "code": "OB-AKS-2026-0007",
      "status": "OPEN",
      "priority": "NORMAL",
      "assignee": null
    }
  ]
}
```

---

#### PUT /api/checklists/records/:id?action=start — Kaydı Başlat

**Yetki:** `FACTORY_ADMIN`, `ENGINEER`, `TECHNICIAN`

**Request body:** Yok (query parametresi `?action=start` yeterlidir)

**Response:** `200 OK` — şablon maddeleri ve makine bilgisiyle güncellenmiş kayıt.

**Hata kodları:**

| Kod               | HTTP | Açıklama                                         |
|-------------------|------|--------------------------------------------------|
| `not_found`       | 404  | Kayıt bulunamadı                                 |
| `invalid_state`   | 422  | Kayıt `pending` durumunda değil                  |

---

#### PUT /api/checklists/records/:id?action=submit — Yanıtları Gönder

**Yetki:** `FACTORY_ADMIN`, `ENGINEER`, `TECHNICIAN`

**Request body (Zod: `submitChecklistSchema`):**

```json
{
  "responses": [
    {
      "itemId": "cuid",
      "valueBool": false,
      "isAbnormal": true,
      "note": "Kayış gevşek"
    },
    {
      "itemId": "cuid",
      "valueNumber": 4.2,
      "isAbnormal": false
    }
  ]
}
```

**`itemResponseSchema` alanları:**

| Alan          | Tip     | Zorunlu | Açıklama                                               |
|---------------|---------|---------|--------------------------------------------------------|
| `itemId`      | string  | evet    | İlgili `ChecklistItem` ID'si                           |
| `valueBool`   | boolean | hayır   | YES_NO tipi maddeler için                              |
| `valueNumber` | number  | hayır   | MEASUREMENT tipi maddeler için                         |
| `valueText`   | string  | hayır   | TEXT ve MULTIPLE_CHOICE tipi maddeler için             |
| `isAbnormal`  | boolean | evet    | Maddenin anormal kabul edilip edilmediği               |
| `note`        | string  | hayır   | Operatör notu (maks 2000 karakter)                     |

**Response:** `200 OK`

```json
{
  "record": { "id": "cuid", "status": "completed", "completedAt": "..." },
  "createdActions": [
    { "id": "cuid", "code": "OB-AKS-2026-0007", "status": "OPEN" }
  ]
}
```

**Yan etkiler:**

1. Her yanıt için `ItemResponse` satırı oluşturulur.
2. `isAbnormal: true` olan her yanıt için otomatik `Action` satırı oluşturulur.
3. Kayıt `completed` durumuna geçer ve `completedAt` atanır.
4. `checklist.completed` eventi yayınlanır.
5. Oluşturulan her aksiyon için `action.created` eventi yayınlanır.

**Hata kodları:**

| Kod             | HTTP | Açıklama                                        |
|-----------------|------|-------------------------------------------------|
| `not_found`     | 404  | Kayıt bulunamadı                                |
| `invalid_state` | 422  | Kayıt `in_progress` durumunda değil             |

---

### Günlük Checklist Listesi

---

#### GET /api/checklists/my — Benim Checklistlerim

**Yetki:** `ENGINEER`, `TECHNICIAN`

**Query parametreleri:**

| Parametre | Tip    | Açıklama                                                       |
|-----------|--------|----------------------------------------------------------------|
| `date`    | string | ISO 8601 tarih — varsayılan: bugün                             |
| `status`  | string | `pending`, `in_progress`, `completed`, `missed` ile filtrele   |

**Davranış:**

- Belirtilen tarihe (`scheduledFor` gün aralığı) ait kayıtları döndürür.
- Yalnızca oturum açmış kullanıcının rolünün (`ctx.role`) şablonun `assignedRoles` dizisinde bulunduğu kayıtlar listelenir.
- Sonuçlar `scheduledFor` artan sırada döner.

**Response:** `200 OK` — şablon özeti (madde sayısı dahil) ve makine bilgisiyle kayıt listesi.

```json
[
  {
    "id": "cuid",
    "status": "pending",
    "scheduledFor": "2026-04-13T08:00:00.000Z",
    "template": {
      "id": "cuid",
      "name": "Günlük Konveyör Bakımı",
      "period": "DAILY",
      "_count": { "items": 8 }
    },
    "machine": { "id": "cuid", "name": "Konveyör Bant-1", "code": "KNV-01" }
  }
]
```

---

### Aksiyon Endpoint'leri (Actions)

---

#### GET /api/actions — Aksiyon Listesi

**Yetki:** `FACTORY_ADMIN`, `ENGINEER`, `TECHNICIAN`

**Query parametreleri:**

| Parametre   | Tip    | Açıklama                                             |
|-------------|--------|------------------------------------------------------|
| `status`    | string | `OPEN`, `IN_PROGRESS`, `COMPLETED`, `VERIFIED`       |
| `priority`  | string | `URGENT`, `NORMAL`, `INFO`                           |
| `machineId` | string | İlgili kaydın makinesine göre filtrele               |

**Response:** `200 OK` — kayıt şablonu, anormal cevap ve atanan kullanıcı bilgisiyle aksiyon listesi, `createdAt` azalan sıra.

---

#### GET /api/actions/:id — Aksiyon Detayı

**Yetki:** `FACTORY_ADMIN`, `ENGINEER`, `TECHNICIAN`

**Response:** `200 OK` — kayıt (şablon + makine), anormal madde cevabı (madde bilgisiyle), atanan kullanıcı ve doğrulayan dahil tam aksiyon nesnesi.

```json
{
  "id": "cuid",
  "code": "OB-AKS-2026-0007",
  "description": "Kayış gevşek",
  "status": "OPEN",
  "priority": "NORMAL",
  "assigneeId": null,
  "targetDate": null,
  "resolutionNotes": null,
  "verifiedById": null,
  "verifiedAt": null,
  "record": {
    "id": "cuid",
    "template": { "id": "cuid", "name": "Günlük Konveyör Bakımı", "period": "DAILY" },
    "machine": { "id": "cuid", "name": "Konveyör Bant-1", "code": "KNV-01" }
  },
  "itemResponse": {
    "id": "cuid",
    "isAbnormal": true,
    "note": "Kayış gevşek",
    "item": { "id": "cuid", "title": "Kayış gerilimi kontrol", "type": "YES_NO" }
  },
  "assignee": null,
  "verifier": null
}
```

---

#### PUT /api/actions/:id — Aksiyon Güncelle

**Yetki:** `FACTORY_ADMIN`, `ENGINEER`

**Request body (Zod: `updateActionSchema`):** Tüm alanlar opsiyonel.

| Alan          | Tip     | Açıklama                                           |
|---------------|---------|----------------------------------------------------|
| `assigneeId`  | string? | Görevi atanacak kullanıcı — `null` ile kaldırılır  |
| `targetDate`  | string? | Hedef tamamlanma tarihi (ISO 8601) — `null` ile kaldırılır |
| `priority`    | string  | `URGENT`, `NORMAL`, `INFO`                         |
| `description` | string  | Açıklama güncellemesi (maks 2000 karakter)         |

**Response:** `200 OK` — atanan kullanıcı bilgisiyle güncellenmiş aksiyon.

---

#### POST /api/actions/:id/transition — Aksiyon Durum Geçişi

**Yetki:** Hedef duruma göre değişir (aşağıdaki tabloya bkz.)

**Request body (Zod: `transitionActionSchema`):**

| Alan              | Tip    | Zorunlu | Açıklama                                          |
|-------------------|--------|---------|---------------------------------------------------|
| `status`          | string | evet    | Hedef durum                                       |
| `resolutionNotes` | string | hayır   | COMPLETED geçişinde çözüm notu (maks 5000 karakter) |
| `assigneeId`      | string | hayır   | IN_PROGRESS geçişinde atama                       |
| `targetDate`      | string | hayır   | IN_PROGRESS geçişinde hedef tarih (ISO 8601)      |

**Response:** `200 OK` — güncellenmiş aksiyon nesnesi.

**Yan etkiler:** `action.status_changed` eventi yayınlanır.

**Hata kodları:**

| Kod                  | HTTP | Açıklama                                              |
|----------------------|------|-------------------------------------------------------|
| `validation_error`   | 400  | Zod doğrulama hatası                                  |
| `forbidden`          | 403  | Rol bu geçişe izin vermiyor                           |
| `forbidden`          | 403  | Teknisyen atanmamış veya farklı teknisyene atanmış    |
| `not_found`          | 404  | Aksiyon bulunamadı                                    |
| `invalid_transition` | 422  | Geçersiz durum geçişi                                 |

---

## Dosya Haritası

| Dosya | Açıklama |
|-------|----------|
| `src/app/api/checklists/templates/route.ts` | GET (liste) + POST (oluştur) |
| `src/app/api/checklists/templates/[id]/route.ts` | GET + PUT + DELETE (şablon CRUD) |
| `src/app/api/checklists/records/route.ts` | GET (liste) + POST (zamanla) |
| `src/app/api/checklists/records/[id]/route.ts` | GET + PUT?action=start + PUT?action=submit |
| `src/app/api/checklists/my/route.ts` | GET (günün checklistleri — rol filtreli) |
| `src/app/api/actions/route.ts` | GET (aksiyon listesi) |
| `src/app/api/actions/[id]/route.ts` | GET (detay) + PUT (güncelle) |
| `src/app/api/actions/[id]/transition/route.ts` | POST (durum geçişi) |
| `src/lib/validations/checklist.ts` | Zod şemaları: template, record, submit, action |
| `src/lib/services/checklist-service.ts` | `startChecklist`, `submitChecklist`, `generateActionCode`, `transitionAction`, `ServiceError` |
| `prisma/schema.prisma` | `ChecklistTemplate`, `ChecklistItem`, `ChecklistRecord`, `ItemResponse`, `Action` modelleri |

---

## Veri Modeli

### ChecklistTemplate

| Alan            | Tip              | Açıklama                                          |
|-----------------|------------------|---------------------------------------------------|
| `id`            | String (cuid)    | Birincil anahtar                                  |
| `factoryId`     | String           | Kiracı kapsamı                                    |
| `machineId`     | String           | Bağlı makine (RESTRICT — makine silinirken engel) |
| `name`          | String           | Şablon adı                                        |
| `period`        | ChecklistPeriod  | Frekans enum değeri                               |
| `isActive`      | Boolean          | `false` olduğunda zamanlayıcı atlar               |
| `assignedRoles` | Role[]           | Yürütebilecek roller (scalar list)                |

### ChecklistItem

| Alan             | Tip               | Açıklama                                             |
|------------------|-------------------|------------------------------------------------------|
| `id`             | String (cuid)     | Birincil anahtar                                     |
| `templateId`     | String            | Bağlı şablon (Cascade)                               |
| `orderIndex`     | Int               | Görüntülenme sırası (0 tabanlı)                      |
| `title`          | String            | Kontrol başlığı                                      |
| `type`           | ChecklistItemType | Madde tipi enum değeri                               |
| `referenceValue` | String?           | Beklenen değer/aralık açıklaması                     |
| `photoRequired`  | Boolean           | Fotoğraf yükleme zorunluluğu                         |
| `meta`           | Json?             | Ek yapılandırma (MULTIPLE_CHOICE seçenekleri vb.)    |

### ChecklistRecord

| Alan           | Tip       | Açıklama                                                        |
|----------------|-----------|-----------------------------------------------------------------|
| `id`           | String    | Birincil anahtar                                                |
| `factoryId`    | String    | Kiracı kapsamı                                                  |
| `templateId`   | String    | Bağlı şablon (RESTRICT)                                        |
| `userId`       | String    | Kaydı oluşturan kullanıcı                                       |
| `machineId`    | String    | Şablondan kopyalanan makine                                     |
| `scheduledFor` | DateTime  | Planlanan yürütme zamanı                                        |
| `startedAt`    | DateTime? | `?action=start` sonrası atanır                                  |
| `completedAt`  | DateTime? | `?action=submit` sonrası atanır                                 |
| `status`       | String    | `pending` / `in_progress` / `completed` / `missed`              |

### ItemResponse

| Alan          | Tip       | Açıklama                                          |
|---------------|-----------|---------------------------------------------------|
| `id`          | String    | Birincil anahtar                                  |
| `recordId`    | String    | Bağlı kayıt (Cascade)                             |
| `itemId`      | String    | Bağlı madde (RESTRICT)                            |
| `valueBool`   | Boolean?  | YES_NO cevabı                                     |
| `valueNumber` | Decimal?  | MEASUREMENT ölçüm değeri                          |
| `valueText`   | String?   | TEXT / MULTIPLE_CHOICE metni                      |
| `isAbnormal`  | Boolean   | `true` ise aksiyon otomatik oluşturulur           |
| `note`        | String?   | Operatör notu                                     |

### Action

| Alan              | Tip           | Açıklama                                                    |
|-------------------|---------------|-------------------------------------------------------------|
| `id`              | String        | Birincil anahtar                                            |
| `factoryId`       | String        | Kiracı kapsamı                                              |
| `code`            | String        | Biçim: `OB-AKS-YYYY-NNNN` — fabrika + yıl başına sıralı    |
| `recordId`        | String        | Kaynaklandığı kayıt (RESTRICT)                              |
| `itemResponseId`  | String        | `@unique` — her anormal yanıt için yalnızca bir aksiyon     |
| `description`     | String        | Yanıttan alınan açıklama (`note` varsa o, yoksa madde başlığı) |
| `priority`        | ActionPriority | `URGENT`, `NORMAL`, `INFO` — varsayılan: `NORMAL`          |
| `assigneeId`      | String?       | Atanan kullanıcı (SetNull)                                  |
| `targetDate`      | DateTime?     | Hedef tamamlanma tarihi                                     |
| `status`          | ActionStatus  | `OPEN`, `IN_PROGRESS`, `COMPLETED`, `VERIFIED`              |
| `resolutionNotes` | String?       | COMPLETED geçişinde çözüm notu                              |
| `verifiedById`    | String?       | Doğrulayan kullanıcı — VERIFIED geçişinde otomatik atanır   |
| `verifiedAt`      | DateTime?     | Doğrulama zamanı — VERIFIED geçişinde otomatik atanır       |

---

## Madde Tipleri (ChecklistItemType)

| Değer             | UI Etiketi        | Kullanım                                                      |
|-------------------|-------------------|---------------------------------------------------------------|
| `YES_NO`          | Evet / Hayır      | İkili geçer/kalır kontrolü (`valueBool`)                      |
| `MEASUREMENT`     | Ölçüm             | Operatör bir değer girer (`valueNumber`); `referenceValue` beklenen aralığı tarif eder |
| `PHOTO`           | Fotoğraf          | Operatör fotoğraf yükler; S3 anahtarı `photos` tablosunda saklanır |
| `MULTIPLE_CHOICE` | Çoktan Seçmeli    | `meta.choices` JSON dizisinden seçim (`valueText`)            |

---

## Frekans Tipleri (ChecklistPeriod)

| Değer         | Açıklama              |
|---------------|-----------------------|
| `DAILY`       | Her gün               |
| `WEEKLY`      | Haftada bir           |
| `MONTHLY`     | Ayda bir              |
| `SHIFT_START` | Her vardiya başlangıcı |

---

## Aksiyon Durum Makinesi

```
OPEN → IN_PROGRESS → COMPLETED → VERIFIED
```

| Kaynak Durum | Hedef Durum   | İzin Verilen Roller                   | Yan Etkiler                                                    |
|--------------|---------------|---------------------------------------|----------------------------------------------------------------|
| `OPEN`       | `IN_PROGRESS` | `TECHNICIAN`                          | Opsiyonel: `assigneeId`, `targetDate` atanabilir               |
| `IN_PROGRESS`| `COMPLETED`   | `TECHNICIAN`                          | Opsiyonel: `resolutionNotes` kaydedilir                        |
| `COMPLETED`  | `VERIFIED`    | `ENGINEER`, `FACTORY_ADMIN`           | `verifiedById = ctx.userId`, `verifiedAt = now()` otomatik atanır |
| `VERIFIED`   | —             | Hiçbiri (terminal durum)              | Geçiş yoktur                                                   |

**Teknisyen kısıtı (IN_PROGRESS geçişi):** Aksiyon belirli bir teknisyene atanmışsa, yalnızca o teknisyen `IN_PROGRESS`'e geçirebilir. Farklı bir teknisyenin girişimi `403 forbidden` ile reddedilir.

Tüm geçişler `checklist-service.ts` içindeki `transitionAction()` fonksiyonu tarafından sunucu tarafında zorunlu kılınır. Ad-hoc durum yazma işlemleri reddedilir.

---

## Servis Fonksiyonları

### `startChecklist(tx, recordId)`

Kaydı `in_progress` durumuna geçirir, `startedAt` atar. Şablon ve maddeleri include ederek güncellenmiş kaydı döndürür.

**Fırlatır:** `ServiceError("not_found")` — kayıt yoksa. `ServiceError("invalid_state")` — durum `pending` değilse.

### `submitChecklist(tx, recordId, responses, userId, factoryId)`

1. Kayıt `in_progress` durumunda değilse hata fırlatır.
2. Her yanıt için `ItemResponse` satırı oluşturur.
3. `isAbnormal: true` olan her yanıt için `generateActionCode()` çağırır ve `Action` oluşturur.
4. Kaydı `completed` olarak işaretler.
5. `{ record, createdActions }` döndürür.

**Fırlatır:** `ServiceError("not_found")`, `ServiceError("invalid_state")`.

### `generateActionCode(tx, factoryId)`

Mevcut yılın kod önekiyle (`OB-AKS-YYYY-`) fabrikadaki son aksiyonu arar ve sekansı artırır. Race condition'ı önlemek için transaction içinde çağrılmalıdır.

**Döndürür:** `"OB-AKS-2026-0001"` biçiminde string.

### `transitionAction(tx, actionId, toStatus, userId, factoryId, extra?)`

`isValidActionTransition()` ile geçişi doğrular. Yan etkileri uygular (`resolutionNotes`, `verifiedById`, `verifiedAt`). Güncellenmiş aksiyon nesnesini döndürür.

**Fırlatır:** `ServiceError("not_found")`, `ServiceError("invalid_transition")`.

---

## Formüller ve Hesaplamalar

### Aksiyon Kod Biçimi

```
OB-AKS-YYYY-NNNN
│  │    │    └── Sıfırla tamamlanmış 4 basamaklı sıra numarası
│  │    │        Her fabrika için her takvim yılı başında sıfırlanır
│  │    └─────── 4 basamaklı yıl (örnek: 2026)
│  └──────────── AKS = Aksiyon
└─────────────── OB = Otonom Bakım
```

Örnek: `OB-AKS-2026-0001`

Sıra numarası hesaplama (kod içinden):

```ts
// prefix = "OB-AKS-2026-"
const parts = latest.code.split("-");
const lastSeq = parseInt(parts[3], 10);  // "0001" → 1
const nextSeq = lastSeq + 1;             // 2
const newCode = `${prefix}${String(nextSeq).padStart(4, "0")}`;
// → "OB-AKS-2026-0002"
```

### Tamamlanma Oranı Hesabı

Belirli bir dönemdeki checklistlerin tamamlanma oranı:

```
tamamlanma_oranı = completed_kayıt_sayısı / toplam_kayıt_sayısı × 100
```

Toplam, `pending + in_progress + completed + missed` kaydı içerir. Bu hesap doğrudan SQL/Prisma ile yapılır; servis katmanında özel bir fonksiyon yoktur.

### Aksiyon Açıklaması Belirleme Mantığı

```ts
const description = response.note?.trim() ? response.note : itemTitle;
```

Yanıtta not varsa not kullanılır. Yoksa madde başlığı kullanılır.

---

## İş Kuralları ve Edge Case'ler

- **Şablon silme koruması:** Şablona bağlı herhangi bir `ChecklistRecord` varsa silme `409 has_records` ile engellenir. Bu kural yürütme geçmişinin bütünlüğünü korur.

- **Madde tam yerini alma:** `PUT /api/checklists/templates/:id` için `items` dizisi gönderilirse mevcut tüm maddeler silinip yenileri oluşturulur. Bu özellikle aktif şablonlarda dikkatli kullanılmalıdır.

- **Kayıt `pending`'de submit:** `?action=submit` çağrısından önce `?action=start` çağrılmalıdır. `pending` durumunda submit `422 invalid_state` döner.

- **Aksiyon benzersizliği:** `Action.itemResponseId` `@unique` kısıtlıdır — her anormal yanıt için yalnızca bir aksiyon oluşturulabilir. İkinci kez submit girişimi DB kısıtı ile engellenir.

- **generateActionCode race condition:** Kod oluşturma ve aksiyon ekleme aynı transaction içinde yapılır. Bu sayede eşzamanlı submit'lerde kod çakışması önlenir.

- **İnaktif şablon ile kayıt oluşturma:** `isActive: false` olan şablonlara karşı kayıt oluşturmak teknik olarak mümkündür. Yalnızca otomatik zamanlayıcı inaktif şablonları atlar. Manuel zamanlamayı engellemek isteniyorsa ek iş kuralı eklenmeli.

- **Rol filtresi (/checklists/my):** Prisma scalar list filtresi (`assignedRoles: { has: ctx.role }`) DB katmanında çalışır; uygulama katmanında sonradan filtreleme yapılmaz.

- **Kaçırılan checklist (missed):** Zamanlanan saate kadar tamamlanmayan kayıtların `status → "missed"` olarak işaretlenmesi Sprint 5'te kalan iştir. Bu, Next.js route handler veya harici cron job olarak zamanlanmış iş şeklinde implemente edilmelidir.

- **meta alanı tip casting:** `ChecklistItem.meta` alanına yazarken Prisma `Prisma.InputJsonValue` tip dönüşümü gerektirir. `null` için `Prisma.JsonNull` kullanılmalı, JavaScript `null`'u değil.

- **TECHNICIAN rolü ve /checklists/my:** `SUPER_ADMIN` ve `FACTORY_ADMIN` rolleri bu endpoint'te desteklenmez; yalnızca `ENGINEER` ve `TECHNICIAN` rolü oturum açmışsa kayıtlar listelenir.
