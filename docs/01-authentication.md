# Kimlik Doğrulama ve Yetkilendirme

## Amaç

MaintainPro kimlik doğrulama sistemi üç temel sorumluluğu bir arada yerine getirir:

1. **Kimlik doğrulama** — NextAuth.js + JWT tabanlı oturum yönetimi; Credentials provider ile e-posta / şifre girişi.
2. **Rol tabanlı yetkilendirme** — dört sabit rol (`SUPER_ADMIN`, `FACTORY_ADMIN`, `ENGINEER`, `TECHNICIAN`) her API çağrısında kontrol edilir.
3. **Multi-tenant izolasyon** — `factory_id` her zaman sunucu tarafındaki oturumdan okunur; istek gövdesinden veya query parametrelerinden **asla** kabul edilmez. İzolasyon iki katmanda zorlanır: PostgreSQL RLS ve Prisma transaction middleware.

---

## Mimari Genel Bakış

```
Tarayıcı
  │
  │  POST /api/auth/callback/credentials  (e-posta + şifre)
  ▼
NextAuth.js  ──► Credentials Provider ──► DB (unsafePrisma) ──► bcrypt compare
  │                                                                   │
  │  JWT oluşturulur; içeriğe { id, role, factoryId, factoryName }   │
  │  eklenir                                                          │
  ▼
Tarayıcı cookie'ye JWT yazar
  │
  │  API isteği (her protected route)
  ▼
withApiTenant()
  ├── auth() → JWT doğrular → session.user çözer
  ├── Rol listesi kontrolü → 403 yoksa devam
  ├── factoryId varlığı kontrolü (SUPER_ADMIN hariç) → 403 yoksa devam
  └── runWithTenant(ctx) → AsyncLocalStorage'a bağlam yazar
          │
          ▼
      withFactoryTx()
          ├── Prisma transaction açar
          ├── SET LOCAL app.factory_id = '...'  (RLS değişkeni)
          └── İş mantığı çalışır → tüm sorgular RLS'e tabidir
```

---

## Roller ve Yetkilendirme Matrisi

### Roller

| Enum Değeri     | Türkçe Etiketi      | Kapsam                                  |
|-----------------|---------------------|-----------------------------------------|
| `SUPER_ADMIN`   | Süper Admin         | Platform geneli; `factoryId` yoktur     |
| `FACTORY_ADMIN` | Fabrika Yöneticisi  | Tek fabrika; tüm modüllere tam erişim   |
| `ENGINEER`      | Mühendis            | Tek fabrika; okuma + onay yetkisi       |
| `TECHNICIAN`    | Teknisyen           | Tek fabrika; yalnızca atanan iş kuyruğu |

### Kaynak Başına İzin Matrisi (özet)

| İşlem                            | SUPER_ADMIN | FACTORY_ADMIN | ENGINEER | TECHNICIAN |
|----------------------------------|:-----------:|:-------------:|:--------:|:----------:|
| Makine listele / görüntüle       | v           | v             | v        | v          |
| Makine oluştur / güncelle        |             | v             | v        |            |
| Makine sil                       |             | v             |          |            |
| Arıza listele / görüntüle        | v           | v             | v        | v*         |
| Arıza oluştur                    | v           | v             | v        | v          |
| Arıza ASSIGNED geçişi            |             | v             | v        |            |
| Arıza IN_PROGRESS geçişi         |             | v             | v        | v**        |
| Arıza RESOLVED geçişi            |             |               |          | v          |
| Arıza CLOSED geçişi              |             | v             | v        |            |
| Departman oluştur / güncelle / sil|            | v             |          |            |
| Kullanıcı yönetimi               |             | v             |          |            |
| Abonelik yönetimi                | v           |               |          |            |

`*` TECHNICIAN yalnızca kendisine atanan arızaları görür.  
`**` TECHNICIAN yalnızca kendisine atanan arızayı başlatabilir.

---

## API Endpoints

### POST /api/auth/callback/credentials

Standart NextAuth.js Credentials akışı. Doğrudan çağrılmaz; `signIn("credentials", {...})` client fonksiyonu tarafından tetiklenir.

**Yetki:** Herkese açık (kimlik doğrulama öncesi)

**Request (NextAuth iç formatı):**

| Alan       | Tür    | Zorunlu | Açıklama              |
|------------|--------|---------|------------------------|
| `email`    | string | evet    | E-posta adresi         |
| `password` | string | evet    | En az 6 karakter       |

**Akış:**

1. Zod şeması (`credentialsSchema`) ile giriş doğrulanır.
2. `unsafePrisma.user.findUnique({ where: { email } })` ile kullanıcı aranır.
3. `isActive: false` ise reddedilir.
4. `bcrypt.compare(password, user.passwordHash)` ile şifre doğrulanır.
5. Başarılıysa `lastLoginAt` güncellenir.
6. JWT'ye `{ id, email, name, role, factoryId, factoryName }` yazılır.

**Hata durumları:**

| Durum             | Sonuç                  |
|-------------------|------------------------|
| Kullanıcı bulunamadı | `null` döner → NextAuth 401 |
| `isActive: false` | `null` döner → NextAuth 401 |
| Yanlış şifre      | `null` döner → NextAuth 401 |

---

### GET /api/auth/session

NextAuth standart endpoint; geçerli JWT oturumunu döner.

**Response:**

```json
{
  "user": {
    "id": "clxxx",
    "email": "ali@fabrika.com",
    "name": "Ali Yılmaz",
    "role": "ENGINEER",
    "factoryId": "clyyy",
    "factoryName": "Fabrika A"
  },
  "expires": "2026-05-13T..."
}
```

---

## Dosya Haritası

| Dosya | Sorumluluk |
|-------|------------|
| `src/lib/auth/auth.ts` | NextAuth yapılandırması; JWT ve session callback'leri |
| `src/lib/auth/auth-handlers.ts` | Next.js route handler re-export (`GET`, `POST`) |
| `src/lib/auth/api-tenant.ts` | `withApiTenant()` helper; tüm korumalı API route'larının giriş noktası |
| `src/lib/auth/roles.ts` | `Role` tipi re-export; `roleLabels` sözlüğü; `canAccess()` yardımcı fonksiyon |
| `src/lib/auth/subscription-guard.ts` | `checkSubscriptionLimit()` — kaynak limiti kontrolü |
| `src/lib/tenant/context.ts` | `TenantContext` tipi; `AsyncLocalStorage` store; `runWithTenant()`, `getTenant()`, `requireFactoryId()` |
| `src/lib/tenant/prisma.ts` | `withFactoryTx()`, `withSuperAdminTx()`, `unsafePrisma` |
| `src/app/api/auth/[...nextauth]/route.ts` | Catch-all NextAuth route |
| `src/app/giris/page.tsx` | Giriş sayfası (sunucu bileşeni) |
| `src/app/giris/login-form.tsx` | Giriş formu (istemci bileşeni) |

---

## Veri Modeli

### User (Prisma)

| Alan | Tür | Açıklama |
|------|-----|----------|
| `id` | String (cuid) | Birincil anahtar |
| `factoryId` | String? | `SUPER_ADMIN` için `null`; diğerleri için zorunlu |
| `email` | String (unique) | Giriş kimliği |
| `passwordHash` | String | bcrypt hash (10 round) |
| `role` | Role enum | `SUPER_ADMIN` \| `FACTORY_ADMIN` \| `ENGINEER` \| `TECHNICIAN` |
| `isActive` | Boolean | `false` ise giriş engellenir |
| `lastLoginAt` | DateTime? | Her başarılı girişte güncellenir |
| `notificationPreferences` | Json | `{ channel: { eventType: boolean } }` formatı |
| `quietHoursStart/End` | String? | `"HH:MM"` formatında fabrika zaman dilimine göre |
| `fcmToken` | String? | FCM push token (Sprint 6) |

### JWT İçeriği

```typescript
type AppJwt = {
  id: string;           // user.id
  role: Role;           // "SUPER_ADMIN" | "FACTORY_ADMIN" | "ENGINEER" | "TECHNICIAN"
  factoryId: string | null;   // null yalnızca SUPER_ADMIN için
  factoryName: string | null; // null yalnızca SUPER_ADMIN için
};
```

JWT, NextAuth tarafından imzalanır ve HTTP-only cookie olarak saklanır. Oturum süresi NextAuth varsayılanına göre ayarlanır (30 gün).

---

## Yardımcı Fonksiyonlar

### `withApiTenant(options, handler)`

Tüm korumalı API route'larının giriş noktasıdır. İki tip imzayla kullanılabilir:

```typescript
// Belirli rollere kısıtlama
export async function GET(req: NextRequest) {
  return withApiTenant(
    { roles: ["ENGINEER", "FACTORY_ADMIN"] },
    async (ctx) => {
      // ctx.userId, ctx.role, ctx.factoryId burada güvenle kullanılabilir
      const data = await withFactoryTx((tx) => tx.machine.findMany());
      return NextResponse.json(data);
    },
  );
}

// Super Admin bypass (çapraz kiracı erişim)
export async function GET() {
  return withApiTenant(
    { roles: ["SUPER_ADMIN"], allowSuperAdmin: true },
    async (ctx) => {
      // ctx.bypassRls === true → RLS devre dışı
    },
  );
}
```

**Parametreler:**

| Parametre | Tür | Açıklama |
|-----------|-----|----------|
| `options.roles` | `Role[]` | İzin verilen roller; boşsa tüm roller geçer |
| `options.allowSuperAdmin` | `boolean?` | `true` ise `SUPER_ADMIN` çağrısında `bypassRls: true` ayarlanır |
| `handler` | `(ctx: TenantContext) => Promise<T>` | İş mantığı |

**Hata HTTP kodları:**

| Durum | HTTP |
|-------|------|
| Oturum yok | 401 |
| Rol yetersiz | 403 |
| `factoryId` yok (SUPER_ADMIN değil) | 403 |

---

### `withFactoryTx(fn, options?)`

Tüm veritabanı işlemlerinin gerçekleştirildiği transaction wrapper'ıdır. Her çağrı:

1. Yeni bir Prisma transaction açar.
2. `SET LOCAL app.factory_id = '<factoryId>'` ile PostgreSQL oturum değişkenini ayarlar.
3. `bypassRls: true` ise ek olarak `SET LOCAL app.bypass_rls = 'on'` çalıştırır.
4. `fn(tx)` içindeki tüm sorgular bu transaction'a ve dolayısıyla RLS politikasına tabidir.

```typescript
// Örnek kullanım
const machines = await withFactoryTx((tx) =>
  tx.machine.findMany({ where: { status: "RUNNING" } }),
);
```

`factoryId` ve `bypassRls` değerleri `AsyncLocalStorage`'dan otomatik okunur; elle geçirilmesi gerekmez.

**Önemli kural:** `withFactoryTx` çağrısı her zaman `runWithTenant()` içinden (yani `withApiTenant` sarmalayıcısından) yapılmalıdır. Aksi hâlde `getTenant()` hata fırlatır.

---

### `withSuperAdminTx(fn)`

Platform genelinde RLS'yi tamamen devre dışı bırakan transaction. Yalnızca `SUPER_ADMIN` işlemlerinde ve migration / seed scriptlerinde kullanılır. Uygulama kodunda dikkatli ve açıklama satırıyla birlikte kullanılmalıdır.

---

### `unsafePrisma`

Ham Prisma istemcisi; hiçbir RLS veya `factory_id` bağlamı yoktur. Kullanım alanları:

- NextAuth `authorize` callback'i (giriş sırasında fabrika bağlamı henüz kurulmamıştır)
- Migration ve seed scriptleri
- QR token ile çapraz kiracı makine arama (`/m/[token]` route'u)
- `checkSubscriptionLimit()` — kiracı bağlamı zaten kurulu olmakla birlikte ham sayım gerektirir

Uygulama iş mantığında `unsafePrisma` kullanılmamalıdır.

---

### `checkSubscriptionLimit(factoryId, resource)`

Kaynak oluşturmadan önce abonelik limitini kontrol eder.

```typescript
const result = await checkSubscriptionLimit(ctx.factoryId!, "machines");
if (!result.allowed) {
  return NextResponse.json({ error: "..." }, { status: 403 });
}
```

| Parametre | Tür | Açıklama |
|-----------|-----|----------|
| `factoryId` | string | Kontrol edilecek fabrika |
| `resource` | `"users"` \| `"machines"` \| `"storage"` | Kontrol edilecek kaynak türü |

**Dönüş:**

```typescript
type LimitCheckResult = {
  allowed: boolean;  // true ise kaynak oluşturulabilir
  current: number;   // mevcut kullanım (adet veya byte)
  max: number;       // plan limiti
};
```

**Plan limitleri (spec §10.2):**

| Plan          | maxUsers | maxMachines | maxStorageGb | Fiyat  |
|---------------|:--------:|:-----------:|:------------:|--------|
| `STARTER`     | 5        | 20          | 5 GB         | $99/ay |
| `PROFESSIONAL`| 15       | 50          | 20 GB        | $199/ay|
| `ENTERPRISE`  | 999*     | 100         | 100 GB       | $399+  |

`*` Enterprise kullanıcı sınırı yoktur; `999` sentinel değerdir.

Abonelik kaydı yoksa veya `status !== "active"` ise tüm kaynak oluşturma işlemleri reddedilir.

---

## Giriş Akışı (Kullanıcı Perspektifi)

1. Kullanıcı `/giris` sayfasına gider (`src/app/giris/page.tsx`).
2. E-posta ve şifresini `LoginForm` bileşenine girer.
3. Form gönderildiğinde `signIn("credentials", { email, password, redirect: false })` çağrılır.
4. NextAuth `authorize` callback tetiklenir:
   - Zod doğrulaması geçilir.
   - Kullanıcı DB'den çekilir.
   - `isActive` ve bcrypt kontrolü yapılır.
   - `lastLoginAt` güncellenir.
5. JWT oluşturulur ve HTTP-only cookie'ye yazılır.
6. İstemci `/panel` sayfasına yönlendirilir.
7. Başarısız girişte form "E-posta veya şifre hatalı." hatası gösterir.

**Callback URL desteği:** Korumalı bir sayfaya kimlik doğrulanmamış erişim girişiminde NextAuth, kullanıcıyı `/giris?callbackUrl=<original-url>` adresine yönlendirir. Başarılı girişte orijinal URL'ye geri döner (örn. QR tarama sonrası `/arizalar/yeni?makine=:id`).

---

## Multi-Tenant İzolasyon

### İki Katmanlı Zorunluluk (spec §16)

MaintainPro, tek bir PostgreSQL veritabanında birçok fabrikayı barındırır. Çapraz kiracı veri sızıntısı tek tolere edilemez hata türüdür. Bu nedenle izolasyon **iki bağımsız katmanda** uygulanır:

#### Katman 1 — PostgreSQL Row Level Security (RLS)

Tüm kiracı kapsamlı tablolarda RLS politikaları aktiftir (`prisma/rls.sql`). Her politika aşağıdaki oturum değişkenlerini kullanır:

```sql
-- Tüm sorguları fabrikaya kilitler
CREATE POLICY tenant_isolation ON machine
  USING (factory_id = current_setting('app.factory_id', true));

-- Super Admin bypass
CREATE POLICY bypass_rls ON machine
  USING (current_setting('app.bypass_rls', true) = 'on');
```

`SET LOCAL` transaction kapsamlıdır; bağlantı havuzu güvenlidir — bir transaction'ın değişkeni bir sonraki isteğe sızmaz.

#### Katman 2 — Prisma Middleware (`withFactoryTx`)

Her Prisma çağrısı `withFactoryTx()` içinden yapılır. Bu fonksiyon, `AsyncLocalStorage`'dan `factoryId`'yi okuyarak `SET LOCAL` komutunu çalıştırır. Bu:

- Geliştiricinin `where: { factoryId }` eklemeyi unutmasını önler.
- `factoryId`'nin istek gövdesinden okunmasına izin vermez.
- RLS'ye ek bir yazılım katmanı güvencesi sağlar.

#### `factoryId` Nereden Gelir?

```
Oturum JWT (sunucu tarafı, değiştirilemez)
  → auth() çağrısı
  → session.user.factoryId
  → TenantContext.factoryId
  → SET LOCAL app.factory_id
  → PostgreSQL RLS
```

İstek gövdesi, query parametreleri veya HTTP başlıkları `factoryId` kaynağı olarak kullanılmaz.

---

## İş Kuralları ve Edge Case'ler

- **`SUPER_ADMIN` fabrika bağlamı:** Super Admin hiçbir fabrikaya bağlı değildir (`factoryId: null`). `requireFactoryId()` bu rolde hata fırlatır. Super Admin işlemleri `withSuperAdminTx()` veya `allowSuperAdmin: true` ile `withApiTenant()` üzerinden yapılır.

- **Pasif kullanıcı:** `isActive: false` olan kullanıcı mevcut JWT'si geçerli olsa da yeni oturum açamaz. Mevcut oturumların iptalı için JWT kara listesi henüz uygulanmamıştır (Sprint 8 kapsamı).

- **Fabrika atanmamış kullanıcı:** `SUPER_ADMIN` dışında `factoryId`'si `null` olan bir kullanıcı `withApiTenant()` tarafından `403` ile reddedilir.

- **Şifre sıfırlama:** MVP kapsamında değildir. Fabrika admini şifreyi doğrudan DB üzerinden veya kullanıcı yönetim panelinden sıfırlar.

- **JWT yenileme:** NextAuth varsayılan davranışı; 30 günlük oturum süresi. `lastLoginAt` her başarılı girişte güncellenir ancak token yenilemeyi tetiklemez.

- **Paralel oturumlar:** Birden fazla cihazda oturum açmak desteklenir; JWT'ler bağımsız geçerlidir.
