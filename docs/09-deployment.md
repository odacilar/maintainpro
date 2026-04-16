# Deploy ve Ortam Kurulumu

## Genel Bakış

MaintainPro, Next.js 14 App Router ile yazılmış tam yığın (full-stack) bir uygulamadır. Geliştirme ve üretim ortamları için ayrı kurulum adımları aşağıda açıklanmıştır. Üretim hedefi AWS App Runner'dır; yerel geliştirme için Docker Compose veya doğrudan `npm run dev` kullanılabilir.

---

## Geliştirme Ortamı Kurulumu

### Ön Koşullar

- Node.js 20+
- PostgreSQL 15+ (yerel kurulum veya Docker)
- npm 10+

### Adım Adım Kurulum

**1. Bağımlılıkları yükle:**

```bash
npm install
```

**2. Ortam değişkenlerini ayarla:**

`.env.example` dosyasını kopyalayıp düzenle:

```bash
cp .env.example .env
# .env dosyasını düzenle (aşağıdaki Ortam Değişkenleri bölümüne bak)
```

**3. Veritabanı migration'larını çalıştır:**

```bash
npx prisma migrate dev
# veya kısayol:
npm run db:migrate
```

Bu komut hem migration'ları uygular hem de Prisma istemcisini yeniden üretir.

**4. Prisma istemcisini üret (sadece şema değişikliği olmadan önce):**

```bash
npm run db:generate
```

**5. RLS (Row Level Security) politikalarını uygula:**

```bash
npm run db:rls
```

Bu komut `prisma/rls.sql` dosyasını doğrudan `psql` üzerinden çalıştırır. `DATABASE_URL` ortam değişkeni ayarlanmış olmalıdır.

**6. Temel seed verilerini yükle:**

```bash
npm run db:seed
```

Platform yöneticisi (`SUPER_ADMIN`) ve test fabrikası oluşturur.

**7. Demo verisini yükle (opsiyonel):**

```bash
npm run db:seed-demo
```

Gerçekçi test verisi içeren genişletilmiş seed: arızalar, makineler, kullanıcılar, stok hareketleri.

**8. Geliştirme sunucusunu başlat:**

```bash
npm run dev
```

Uygulama `http://localhost:3000` adresinde çalışır.

### Diğer Komutlar

| Komut | Açıklama |
|-------|----------|
| `npm run build` | Üretim build'i (standalone çıktı) |
| `npm start` | Üretim sunucusunu başlat |
| `npm run lint` | ESLint kontrolü |
| `npm run typecheck` | TypeScript tip kontrolü (derleme yapmadan) |
| `npm run db:reset` | Veritabanını sıfırla ve yeniden migrate et |
| `npm test` | Vitest test suite'ini çalıştır |
| `npm run test:watch` | Testleri izleme modunda çalıştır |

---

## Ortam Değişkenleri

Tüm ortam değişkenlerinin `.env` dosyasında veya platform secret store'unda tanımlı olması gerekir.

### Zorunlu Değişkenler

| Değişken | Açıklama | Örnek |
|----------|----------|-------|
| `DATABASE_URL` | PostgreSQL bağlantı URL'i | `postgresql://user:pass@localhost:5432/maintainpro` |
| `NEXTAUTH_SECRET` | NextAuth.js imzalama anahtarı (min 32 karakter) | `openssl rand -base64 32` ile üret |
| `NEXTAUTH_URL` | Uygulamanın tam URL'i | `http://localhost:3000` |

### Dosya Depolama (AWS S3)

| Değişken | Açıklama |
|----------|----------|
| `S3_BUCKET` | S3 bucket adı |
| `S3_PUBLIC_URL` | CDN veya bucket public URL'i |
| `AWS_REGION` | AWS bölgesi (örn. `eu-central-1`) |

Üretimde kimlik bilgileri App Runner IAM rolü üzerinden sağlanır; `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` doğrudan set edilmez.

### E-posta (AWS SES)

| Değişken | Açıklama |
|----------|----------|
| `SES_FROM_EMAIL` | Gönderici e-posta adresi |
| `SES_REPLY_TO` | Yanıt adresi |

### Bildirimler (FCM)

| Değişken | Açıklama |
|----------|----------|
| `FCM_SERVER_KEY` | Firebase Cloud Messaging sunucu anahtarı |
| `FCM_PROJECT_ID` | Firebase proje kimliği |

### Genel

| Değişken | Açıklama | Varsayılan |
|----------|----------|-----------|
| `NODE_ENV` | `development` \| `production` | — |
| `PORT` | HTTP port | `3000` |
| `HOSTNAME` | Dinleme adresi | `0.0.0.0` |
| `LOG_LEVEL` | Log seviyesi | `info` |
| `NEXT_TELEMETRY_DISABLED` | Next.js telemetriyi kapat | `1` |
| `APP_URL` | Uygulama kök URL'i (bildirim linkleri için) | — |

---

## Docker ile Çalıştırma

### Dockerfile Açıklaması (Multi-Stage Build)

`Dockerfile` üç aşamadan oluşur:

**Stage 1: `deps` — Bağımlılık Kurulumu**

```dockerfile
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
```

Yalnızca `package.json` ve kilit dosyası kopyalanır, böylece `node_modules` katmanı kaynak kodu değişikliklerinden bağımsız olarak cache'lenir.

**Stage 2: `builder` — Derleme**

```dockerfile
FROM node:20-alpine AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build
```

Prisma istemcisi üretilir, ardından `next build` çalışır. `next.config.mjs` içindeki `output: "standalone"` ayarı zorunludur; bu olmadan runner aşaması başlamaz.

**Stage 3: `runner` — Çalıştırma**

```dockerfile
FROM node:20-alpine AS runner
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma/client ./node_modules/@prisma/client
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
```

Yalnızca standalone bundle, statik dosyalar, Prisma şeması ve Prisma runtime client kopyalanır. Tam `node_modules` kopyalanmaz; image boyutu küçük kalır. Güvenlik için `nextjs` (uid 1001) root olmayan kullanıcı ile çalışır.

### Image Build

```bash
docker build -t maintainpro:latest .
```

### Tek Konteyner Çalıştırma

```bash
docker run -p 3000:3000 --env-file .env maintainpro:latest
```

---

## Docker Compose ile Yerel Geliştirme

`docker-compose.yml` iki servis içerir: `app` (Next.js) ve `postgres`.

### Servisleri Başlatma

```bash
docker compose up -d
```

Uygulama `http://localhost:3000` adresinde, PostgreSQL `127.0.0.1:5432` adresinde erişilebilir olur.

### Servisleri Durdurma

```bash
docker compose down
```

Veriyi de silmek için:

```bash
docker compose down -v
```

### PostgreSQL Yapılandırması

| Parametre | Değer |
|-----------|-------|
| Kullanıcı | `maintainpro` |
| Şifre | `maintainpro_dev` |
| Veritabanı | `maintainpro` |
| Port | `127.0.0.1:5432` |

İlk başlatmada `docker/postgres-init.sql` otomatik çalışır:
- `pg_trgm` uzantısı (makine ve parça adı tam metin araması için)
- `uuid-ossp` uzantısı (UUID birincil anahtar üretimi için)
- Veritabanı saat dilimi `Europe/Istanbul` (UTC+3) olarak ayarlanır

### Health Check

`app` servisi için health check:

```yaml
test: ["CMD-SHELL", "wget -qO- http://localhost:3000/api/health || exit 1"]
interval: 30s
timeout: 10s
retries: 3
start_period: 40s
```

`postgres` servisi için health check `pg_isready` kullanır. `app` servisi postgres sağlıklı olmadan başlamaz (`depends_on: condition: service_healthy`).

### pgAdmin (Opsiyonel)

`docker-compose.yml` içinde pgAdmin 4 servisi yorum satırı olarak yer alır. Aktifleştirmek için ilgili satırları uncomment etmek yeterlidir. Erişim: `http://localhost:5050` (kullanıcı: `admin@maintainpro.local`, şifre: `admin`).

---

## Health Check Endpoint

```
GET /api/health
```

Kimlik doğrulama gerektirmez. AWS App Runner ve Docker Compose tarafından kullanılır.

**Yanıt (HTTP 200):**

```json
{
  "status": "ok",
  "timestamp": "2026-04-13T08:00:00.000Z"
}
```

Kaynak dosyası: `src/app/api/health/route.ts`

---

## Veritabanı Migration Stratejisi

### Geliştirme Ortamı

```bash
# Yeni migration oluştur ve uygula
npm run db:migrate

# Veritabanını sıfırla (dikkat: tüm veri silinir)
npm run db:reset
```

### Üretim Ortamı

Üretimde `prisma migrate dev` **kullanılmaz**. Bunun yerine:

```bash
npx prisma migrate deploy
```

Bu komut bekleyen migration'ları güvenle uygular; yeni migration oluşturmaz. App Runner deploy sürecinde init container veya başlangıç komutu olarak çalıştırılabilir.

Prisma şeması: `prisma/schema.prisma`  
RLS politikaları: `prisma/rls.sql`

Migration'lar `prisma/migrations/` dizininde versiyonlanır ve Git'e commit edilir.

---

## AWS App Runner Deploy

Üretim altyapısı `eu-central-1` bölgesinde çalışır. Deploy akışı:

```
GitHub → (CI/CD) → ECR → App Runner
```

### Yapılandırma Dosyası

`apprunner.yaml` App Runner servis tanımını içerir:

- **Runtime:** Docker (ECR'dan image)
- **Port:** 3000
- **Komut:** `node server.js`

### Secrets Manager Kurulumu

Her secret, deploy öncesinde AWS Secrets Manager'a eklenmelidir:

```bash
aws secretsmanager create-secret \
  --name maintainpro/prod/database-url \
  --secret-string "postgresql://user:pass@rds-endpoint:5432/maintainpro"
```

App Runner, servis başlangıcında secret'ları çözümleyerek ortam değişkeni olarak enjekte eder.

Gerekli secret'lar:

| Secret Adı | Karşılık Gelen Değişken |
|------------|------------------------|
| `maintainpro/prod/database-url` | `DATABASE_URL` |
| `maintainpro/prod/nextauth-url` | `NEXTAUTH_URL` |
| `maintainpro/prod/nextauth-secret` | `NEXTAUTH_SECRET` |
| `maintainpro/prod/s3-bucket` | `S3_BUCKET` |
| `maintainpro/prod/s3-public-url` | `S3_PUBLIC_URL` |
| `maintainpro/prod/ses-from-email` | `SES_FROM_EMAIL` |
| `maintainpro/prod/ses-reply-to` | `SES_REPLY_TO` |
| `maintainpro/prod/fcm-server-key` | `FCM_SERVER_KEY` |
| `maintainpro/prod/fcm-project-id` | `FCM_PROJECT_ID` |
| `maintainpro/prod/app-url` | `APP_URL` |

### IAM Rol Gereksinimleri

App Runner servis rolüne şu izinler verilmelidir:
- `s3:GetObject`, `s3:PutObject`, `s3:DeleteObject` — S3 bucket
- `ses:SendEmail`, `ses:SendRawEmail` — SES
- `secretsmanager:GetSecretValue` — Secrets Manager secret'ları

AWS kimlik bilgileri (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`) ortam değişkeni olarak **set edilmez**; IAM rolü üzerinden sağlanır.

### NEXTAUTH_SECRET Üretimi

```bash
openssl rand -base64 32
```

---

## Demo Veri Yükleme

```bash
# Temel veri (SUPER_ADMIN + 1 fabrika)
npm run db:seed

# Genişletilmiş demo verisi
npm run db:seed-demo
```

`prisma/seed.ts` — Temel platform başlangıç verisi  
`prisma/seed-demo.ts` — Test makineleri, arızalar, checklist'ler, stok hareketleri

Seed komutları her çalıştığında mevcut veriyi temizleyip yeniden ekler. Üretimde çalıştırılmamalıdır.
