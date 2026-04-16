# MaintainPro — Kullanım Kılavuzu ve Teknik Dokümantasyon

Bu dizin, her modül ve paylaşılan kütüphane için geliştirici odaklı kullanım kılavuzlarını içerir. UI etiketleri Türkçe, kod ve dosya adları İngilizcedir.

---

## Modüller

| # | Modül | Doküman | Açıklama |
|---|-------|---------|----------|
| 1 | Kimlik Doğrulama | [01-authentication.md](01-authentication.md) | Auth, roller, multi-tenancy, NextAuth.js, JWT, RLS |
| 2 | Makineler | [02-machines.md](02-machines.md) | Makine CRUD, QR kod akışı, departman yönetimi, abonelik limitleri |
| 3 | Arızalar | [03-breakdowns.md](03-breakdowns.md) | Arıza yaşam döngüsü, durum makinesi, QR hızlı giriş, teknisyen paneli, eskalasyon |
| 4 | Yedek Parçalar | [04-spare-parts.md](04-spare-parts.md) | Stok CRUD, giriş/çıkış hareketleri, düşük stok uyarısı, tüketim takibi |
| 5 | Otonom Bakım | [05-autonomous-maintenance.md](05-autonomous-maintenance.md) | TPM 1. Sütun checklist'leri, otomatik aksiyon, aksiyon durum makinesi, günlük zamanlayıcı |
| 6 | Bildirimler | [06-notifications.md](06-notifications.md) | Event bus, SSE, FCM push, SES e-posta, PWA bildirim tercihleri |
| 7 | Dashboard | [07-dashboard.md](07-dashboard.md) | KPI'lar, MTBF/MTTR, Pareto, maliyet raporu, PDF export, Recharts |
| 8 | Super Admin | [08-super-admin.md](08-super-admin.md) | Tenant yönetimi, fabrika CRUD, abonelik planları, limit enforcement |
| 9 | Deploy | [09-deployment.md](09-deployment.md) | Docker, multi-stage build, docker-compose, ortam değişkenleri, App Runner |
| 10 | Export & Raporlar | [10-export-reports.md](10-export-reports.md) | CSV/PDF export yardımcıları, 4 sekmeli raporlar sayfası, liste sayfası butonları |
| 11 | Fotoğraf Yükleme | [11-photo-upload.md](11-photo-upload.md) | Storage service (local/S3), Photo API routes, PhotoUpload bileşeni, polimorfik referans |
| 12 | Zamanlayıcı | [12-scheduler.md](12-scheduler.md) | Scheduler service, cron API endpoint'leri, dev-mode in-process scheduler, PM iş emri üretimi |
| 13 | Dark Mode + Kısayollar + Offline | [13-dark-mode-shortcuts-offline.md](13-dark-mode-shortcuts-offline.md) | ThemeProvider, tema toggle, klavye kısayolları, komut paleti, IndexedDB offline cache, service worker |

---

## Hızlı Başlangıç

```bash
# 1. Bağımlılıkları yükle
npm install

# 2. Ortam değişkenlerini ayarla
cp .env.example .env
# .env dosyasını düzenle (DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL zorunlu)

# 3. Migration'ları ve RLS politikalarını uygula
npm run db:migrate
npm run db:rls

# 4. Temel veriyi yükle
npm run db:seed

# 5. Geliştirme sunucusunu başlat
npm run dev
# → http://localhost:3000
```

Demo verisi için (gerçekçi test makineleri, arızalar, stok):

```bash
npm run db:seed-demo
```

---

## Teknoloji Yığını

| Katman | Teknoloji |
|--------|-----------|
| Frontend | Next.js 14 (App Router) + TypeScript + Tailwind CSS + shadcn/ui |
| Durum Yönetimi | Zustand (istemci) + TanStack Query (sunucu cache) |
| Backend | Next.js API Routes (full-stack monorepo) |
| ORM / Veritabanı | Prisma → PostgreSQL 15 (AWS RDS) |
| Kimlik Doğrulama | NextAuth.js v5 (beta) |
| Dosya Depolama | AWS S3 (presigned URL) |
| Bildirimler | FCM (push) + AWS SES (e-posta) + SSE (in-app) |
| Grafikler | Recharts |
| Validasyon | Zod (tüm API sınırlarında) |
| Test | Vitest + Playwright |
| Container | Docker (multi-stage) → AWS App Runner |
| CI/CD | GitHub Actions → ECR |

---

## Mimari Notlar

### Multi-Tenancy

Her domain tablosu `factory_id` taşır. Tenant izolasyonu iki katmanda uygulanır:

1. **PostgreSQL RLS politikaları** (`prisma/rls.sql`) — veritabanı seviyesi
2. **Prisma middleware** — oturumdan `factory_id` inject edilir, request input'undan okunmaz

### Rol Modeli

| Rol | Kapsam |
|-----|--------|
| `SUPER_ADMIN` | Platform geneli, `factory_id` yok |
| `FACTORY_ADMIN` | Fabrika yöneticisi |
| `ENGINEER` | Mühendis |
| `TECHNICIAN` | Teknisyen |

### Arıza Durum Makinesi

```
Açık → Atandı → Müdahale Ediliyor ⇄ Parça Bekleniyor → Çözüldü → Kapatıldı
```

Her geçiş `breakdown_timeline` tablosuna kayıt yazar.

### Kodlama Kuralları

| Türkçe (UI) | İngilizce (kod) |
|-------------|----------------|
| Fabrika | Factory |
| Arıza | Breakdown |
| Yedek parça | SparePart |
| Otonom bakım | AutonomousMaintenance |
| Planlı bakım | PreventiveMaintenance |
| İş emri | WorkOrder |
| Aksiyon | Action |

Arıza numaralandırma: `ARZ-2026-0001` | Aksiyon numaralandırma: `OB-AKS-2026-0001`

---

## Yeni Kılavuz Ekleme

1. `docs/{module}.md` dosyasını oluştur. Format: Amaç → API endpoint'leri → Edge case'ler.
2. Bu tabloya satır ekle.
3. Modül paylaşılan bir yardımcı fonksiyon içeriyorsa fonksiyon imzası ve parametreleri belgele.
