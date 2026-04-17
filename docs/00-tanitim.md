# MaintainPro — Baştan Sona Tanıtım Kılavuzu

Bu kılavuz, MaintainPro'yu hiç duymamış birine sistemi baştan sona anlatmak için yazıldı. Modül başına teknik detay istiyorsan `01-authentication.md` ile başlayan numaralı kılavuzlara bak; burası "büyük resim"dir.

Okuma süresi: ~15 dakika.

---

## 1. Bir cümlede MaintainPro

Türk üretim fabrikalarında arıza, yedek parça ve bakım süreçlerini tek bir SaaS üzerinden yöneten, çok kiracılı (multi-tenant) bir **CMMS** (Computerized Maintenance Management System) platformudur.

Hedef kullanıcı: **50–500 kişilik imalat işletmesi**. Dil: Türkçe UI, İngilizce kod. Mobil-öncelikli (teknisyen sahada telefonla kullanır).

---

## 2. Hangi sorunu çözer?

Tipik bir orta ölçek fabrikada bakım durumu şöyledir:

- Arıza bildirimi WhatsApp grubundan, bazen sözlü olur → kaybolur.
- Yedek parça sayımı Excel'de → ne zaman azaldığı fark edilmez, makine dururken parça yoktur.
- Otonom bakım kontrolleri kağıt formda → operatör doldurmayı unutur, kimse kontrol etmez.
- Aylık rapor istendiğinde kimse MTBF/MTTR hesaplayamaz.
- Yeni bir fabrika açılınca tüm süreç sıfırdan kurulur.

MaintainPro bu sorunları **tek bir uygulama + tek bir veritabanı** ile çözer; her fabrika kendi verisini görür, Süper Admin platformu yönetir.

---

## 3. Kullanıcı rolleri — kim ne yapar?

Dört rol vardır. Bir kullanıcı yalnızca tek bir role sahip olabilir.

| Rol | Kapsam | Günlük işi |
|-----|--------|-----------|
| **SUPER_ADMIN** | Platform geneli | Fabrikaları açar/kapar, abonelik planlarını yönetir, global metrikleri izler. `factory_id` yoktur. |
| **FACTORY_ADMIN** | Tek fabrika | Kullanıcıları, makineleri, departmanları, yetkileri yönetir. Raporları görür. |
| **ENGINEER** | Tek fabrika | Arızaları teknisyene atar, planlı bakım planlar, yedek parça düzenini yapar. |
| **TECHNICIAN** | Tek fabrika | Sahada arızaya müdahale eder, otonom bakım checklist'ini doldurur, iş emrini tamamlar. |

**Yetki matrisi:** Her API endpoint `withApiTenant({ roles: [...] }, ...)` sargısı ile korunur. Yetkisiz rol 403 alır.

---

## 4. Çok kiracılı yapı (multi-tenancy) — neden önemli?

Tek bir PostgreSQL veritabanı tüm fabrikalara hizmet eder. İzolasyon **iki katmanda** uygulanır:

1. **Postgres Row Level Security (RLS):** Her tenant-ait tabloda `factory_id` kolonu var ve RLS politikası `current_setting('app.factory_id')` değişkeniyle filtre uygular.
2. **Prisma middleware (`src/lib/tenant/prisma.ts`):** Her API isteğinde oturumdan `factory_id` alınır, `SET LOCAL app.factory_id = '...'` komutuyla transaction'a enjekte edilir. Geliştirici `tx.breakdown.findMany()` yazdığında Postgres otomatik olarak sadece o fabrikanın satırlarını döner.

**Altın kural:** `factory_id` request body/query'den **asla** okunmaz — her zaman sunucu tarafındaki oturumdan gelir. Bu çapraz-tenant sızıntısını önler.

---

## 5. Ana iş akışları — "bir gün içinde neler olur?"

### 5.1 Arıza bildirimi → çözüm

```
Operatör → QR kod okut → Arıza formu → Kaydet
                                         ↓
                                      [DB] Açık
                                         ↓
                         Mühendis teknisyen atar
                                         ↓
                                      Atandı
                                         ↓
                    Teknisyen "Müdahale Ediyorum" tıklar
                                         ↓
                                  Müdahale Ediliyor
                                         ↓
                   (parça gerekirse) → Parça Bekleniyor ⇄
                                         ↓
                             Teknisyen parça çıkarır, tamir eder
                                         ↓
                                      Çözüldü
                                         ↓
                          Mühendis onaylar → Kapatıldı
                                         ↓
                      (onaylamazsa) → Reddet → Müdahale Ediliyor
```

- Her geçiş `breakdown_timeline`'a bir satır yazar (kim, ne zaman, eski→yeni durum).
- Arıza numarası `ARZ-2026-0001` formatında otomatik üretilir.
- Fotoğraf yükleme her aşamada opsiyonel (S3'e gider).
- Detay: [03-breakdowns.md](03-breakdowns.md).

### 5.2 Yedek parça çıkışı

```
Teknisyen arızada çalışırken:
  Arıza detayı → "Parça Kullan" → Stok listesi → Miktar → Kaydet

Sistem:
  - StockMovement (OUT, breakdown referanslı) yazar
  - SparePart.currentStock düşer
  - Min stok altına inerse:
       → Düşük stok uyarısı (bildirim) → Mühendis + Factory Admin
```

Fire/iade de aynı yapıda. Detay: [04-spare-parts.md](04-spare-parts.md).

### 5.3 Otonom bakım (TPM 1. Sütun — Jishu Hozen)

Operatör günde/haftada bir kere makinenin rutin bakım kontrolünü yapar.

```
Şablon (FACTORY_ADMIN kurar):
  - Makine: CNC-001
  - Periyot: Günlük
  - Maddeler: "Yağ seviyesi OK mi?" (Yes/No), "Titreşim?" (1-5), "Fotoğraf" (opsiyonel)

Teknisyen/Operatör:
  - "Otonom Bakım" ekranı → o gün dolması gereken şablonu açar
  - Her maddeyi yanıtlar
  - Bir maddeyi "Anormal" işaretlerse:
       → Sistem OTOMATİK bir `actions` satırı açar
       → `OB-AKS-2026-0001` formatında numara verilir
       → Mühendise atanır, durum=Yeni

Aksiyon durum makinesi:
  Yeni → Planlandı → Yapılıyor → Doğrulandı → Kapatıldı
```

Bu otomatik aksiyon açma, UI'ın bir tıklaması değil — API'nin side-effect'idir. Detay: [05-autonomous-maintenance.md](05-autonomous-maintenance.md).

### 5.4 Planlı bakım (PM) → İş emri

```
Mühendis şablon kurar:
  - Makine: KOMPRESÖR-1
  - Tetik: her 30 gün (veya çalışma saati bazlı)
  - Checklist: filtre değişimi, yağ seviyesi, kayış kontrolü

Cron (günde bir kez):
  - Vadesi gelen PM planlarını bulur
  - Her biri için bir `work_orders` kaydı oluşturur
  - Teknisyene atar, bildirim gönderir

Teknisyen:
  - "İş Emirleri" listesinden açar
  - Checklist maddelerini yanıtlar
  - Tamamlar
```

PM planı tekrar 30 gün ileriye kayar. Cron için `src/lib/services/scheduler-service.ts` + `src/app/api/cron/pm-generate/route.ts`. Detay: [12-scheduler.md](12-scheduler.md).

### 5.5 Raporlar

Fabrika Admin Raporlar sekmesinde:

- **MTBF** (Mean Time Between Failures): Ortalama arızasız çalışma süresi
  `MTBF = Toplam çalışma saati / Arıza sayısı`
- **MTTR** (Mean Time To Repair): Ortalama tamir süresi
  `MTTR = Toplam duruş dakikası / Arıza sayısı`
- **Kullanılabilirlik (Availability)**: `MTBF / (MTBF + MTTR)`
- **Pareto**: En sık arıza çıkaran makineler (sol-ağır 80/20)
- **Departman Duruş**: Hangi departman en çok iş kaybı yaşattı
- **Maliyet**: Arıza × (işçilik + parça)

Tüm grafikler Recharts ile, PDF export `jsPDF + autoTable`, CSV export vanilla. Detay: [07-dashboard.md](07-dashboard.md), [10-export-reports.md](10-export-reports.md).

---

## 6. Bildirim ve eskalasyon

Bildirim, olay bazlı. Modül X bir event yayınlar, `event-bus` dinler, dispatcher uygun kanallara dağıtır.

**Kanallar:**
- `in_app` → SSE ile canlı + veritabanı kaydı (bell ikonu)
- `email` → SMTP/AWS SES (şablonlu HTML)
- `push` → FCM (mobilde PWA)
- `sms` → Twilio (opsiyonel, v2)

**Tercihler:** Kullanıcı `/bildirimler/tercihler` ekranından her olay × her kanal için açar/kapar, sessiz saat belirler.

**Eskalasyon:** Kritik arıza 30 dk yanıtsız kalırsa:

```
T+0   → Mühendise atanır
T+30  → Mühendis + Factory Admin'e bildirim (escalated)
T+60  → Factory Admin'e ikinci kez
T+120 → Super Admin'e (kritik + yanıtsız)
```

Bu bir scheduler job'udur (`runBreakdownEscalation`), request-time'da çalışmaz. Detay: [06-notifications.md](06-notifications.md), [12-scheduler.md](12-scheduler.md).

---

## 7. PWA + mobil-öncelikli

Teknisyen telefondan kullanır. Bu yüzden:

- `manifest.json` + `sw.js` → Ana ekrana eklenebilir
- IndexedDB ile kritik veri (makine listesi, son arızalar) offline cache
- FCM ile arka plan push
- QR kod okuma (`html5-qrcode`) → makineye gidip telefonla okutunca arıza formu anında
- Klavye kısayolları (`/` arama, `N` yeni kayıt vb.) desktop kullanıcıları için

Detay: [13-dark-mode-shortcuts-offline.md](13-dark-mode-shortcuts-offline.md).

---

## 8. Süper Admin — platform yönetimi

SaaS'ın arka ofisi. Ayrı bir menü grubu.

| Ekran | Ne yapar |
|-------|----------|
| Yönetim Paneli | Aktif fabrika / kullanıcı / arıza özeti |
| Fabrikalar | Yeni fabrika aç, askıya al, subdomain, plan seç |
| Abonelikler | Plan tanımları, fatura durumu |

**Plan sınırları:**

| Plan | Kullanıcı | Makine | Depolama | Fiyat |
|------|-----------|--------|----------|-------|
| Starter | 5 | 20 | 5 GB | $99/ay |
| Professional | 15 | 50 | 20 GB | $199/ay |
| Enterprise | ∞ | ∞ | 100 GB | $399+/ay |

Limit ihlali: Her `create-user`/`create-machine` endpoint'i runtime'da kontrol eder, plan dolu ise 403. Detay: [08-super-admin.md](08-super-admin.md).

---

## 9. Teknoloji yığını (neden seçildi?)

| Katman | Teknoloji | Neden |
|--------|-----------|-------|
| Frontend | Next.js 14 App Router + TS | RSC + SSR, Next API Routes full-stack monorepo |
| UI | Tailwind + shadcn/ui + Radix | Düşük bağımlılık, accessible primitives |
| Durum | Zustand + TanStack Query | Basit client store + sunucu cache ayrımı |
| ORM | Prisma | Migration + typesafe client + middleware |
| DB | PostgreSQL 16 (RDS) | RLS desteği, güvenilir, yönetilen |
| Auth | NextAuth.js v5 (beta) | JWT session, Prisma adapter, cognito'ya migrasyon kolay |
| Storage | S3 presigned URL | Sunucu yükünü almaz, direkt client → S3 |
| Grafik | Recharts | SVG bazlı, PDF'e export kolay |
| Validation | Zod | Tüm API sınırlarında tek tip şema |
| Container | Multi-stage Docker | Standalone Next output ile ~200 MB image |
| Deploy | AWS App Runner | Kubernetes yükü yok, otomatik HTTPS + scale |

Stack değişikliği yapma ihtiyacı bitene kadar **hiçbir bileşen değişmez** — sprint planı, maliyet modeli hep bu yığına göre yapıldı.

---

## 10. Veri modeli — çekirdek tablolar

```
factories ──┬── users (role, factoryId)
            ├── departments
            ├── machines ──┬── breakdowns ──┬── breakdown_timeline
            │              │                ├── stock_movements (arıza referanslı)
            │              │                └── photos (polimorfik)
            │              ├── checklist_templates ── checklist_items
            │              │                              │
            │              │                              └── item_responses ── actions (auto)
            │              └── pm_plans ── work_orders
            ├── spare_parts ── stock_movements
            └── subscriptions (plan, limitler, faturalar)

audit_logs (her CRUD için global)
notifications (kullanıcıya, kanal bağımsız)
```

**Anahtar kurallar:**
- Her tenant-ait tabloda `factoryId` zorunlu
- `photos` polimorfiktir: `(referenceType, referenceId)` tek tablo çoklu modül
- `stock_movements` hem giriş hem çıkış hem fire; `type` ayırt eder
- `audit_logs` yalnızca admin görür, her CRUD'u tutar

Detay: [MaintainPro_MVP_Spesifikasyon_v2.docx](../MaintainPro_MVP_Spesifikasyon_v2.docx) §11.2.

---

## 11. Kurulum ve geliştirme

### 11.1 Lokal kurulum

```bash
# 1. Bağımlılıklar
npm install

# 2. Ortam değişkenleri
cp .env.example .env
# Doldur: DATABASE_URL, NEXTAUTH_SECRET (openssl rand -base64 32), NEXTAUTH_URL

# 3. Veritabanı
docker compose up -d postgres   # veya kendi Postgres'in
npx prisma migrate dev
npx prisma db execute --file prisma/rls.sql --schema prisma/schema.prisma

# 4. Seed
npm run db:seed           # admin + demo kullanıcılar
npm run db:seed-demo      # 2-3 aylık aktivite verisi

# 5. Dev
npm run dev
# → http://localhost:3000
```

### 11.2 Docker

```bash
docker compose up         # app + postgres
```

### 11.3 Production (AWS App Runner)

Detay: [09-deployment.md](09-deployment.md). Özet akış:

1. `docker build -t maintainpro .`
2. ECR repo → push
3. Secrets Manager'da `maintainpro/prod/*` key'leri
4. RDS (PostgreSQL 16) + VPC Connector
5. App Runner servis (ECR + env secrets + VPC egress)
6. Route 53 CNAME → App Runner DNS target

MaintainPro canlıda: **https://promaintenance.focusoda.com**

---

## 12. Test ve kalite

- **Unit + integration:** Vitest (`npm test`)
- **E2E:** Playwright (`npm run e2e`)
- **Lint:** ESLint + next lint — build'in parçası
- **Type check:** `tsc --noEmit` — build'in parçası
- **Build:** `npm run build` → ESLint + TS + standalone output; hata varsa build başarısız

UI değişikliği yapılırken mobil görünümden başlanır, masaüstü sonradan eklenir.

---

## 13. Scope dışı (Phase 2'ye bırakıldı)

Şu işler **MVP'de yok**, sonradan gelecek:

- **ERP entegrasyonları** (Logo, SAP, Mikro) — spec §18
- **SMS kanalı** (Twilio)
- **Gelişmiş analitik** (makine başına tahminci, anomaly detection)
- **Mobil native uygulama** (şu an PWA yeterli)
- **Çoklu dil** (sadece Türkçe)
- **Fatura üretimi** (abonelik var ama fatura PDF'i yok)

Kural: MVP pilot fabrikada 4 hafta hatasız çalışmadıkça ERP'ye başlanmaz.

---

## 14. Terminoloji sözlüğü

| Türkçe (UI) | İngilizce (kod) | Ne anlama gelir |
|-------------|-----------------|-----------------|
| Fabrika | Factory | Tenant'ın kökü |
| Arıza | Breakdown | Beklenmedik duruş kaydı |
| Yedek parça | SparePart | Depoda tutulan parça |
| Otonom bakım | AutonomousMaintenance | Günlük/haftalık operatör kontrolü |
| Planlı bakım | PreventiveMaintenance (PM) | Takvime bağlı bakım |
| İş emri | WorkOrder | PM'in fiili uygulama kaydı |
| Aksiyon | Action | Anormal çıkan checklist maddesinden üretilen görev |
| Departman | Department | Makinenin ait olduğu üretim hattı |
| Mühendis | Engineer | Bakım atamayı yapan |
| Teknisyen | Technician | Sahada işi yapan |
| Çalışma durumu | Operational status | `RUNNING / DOWN / STANDBY` |

Numara formatları:
- Arıza: `ARZ-2026-0001`
- Otonom bakım aksiyonu: `OB-AKS-2026-0001`
- İş emri: sistem ID (string)

---

## 15. Nereye bakmalıyım?

| Sorun | Dokümana bak |
|-------|--------------|
| Giriş yapamıyorum | [01-authentication.md](01-authentication.md) |
| Makine ekleyemiyorum | [02-machines.md](02-machines.md) + [08-super-admin.md](08-super-admin.md) (abonelik limiti) |
| Arıza durumunu değiştiremiyorum | [03-breakdowns.md](03-breakdowns.md) (durum makinesi + yetki) |
| Stok hareketleri görünmüyor | [04-spare-parts.md](04-spare-parts.md) |
| Checklist anormal seçilince ne olur? | [05-autonomous-maintenance.md](05-autonomous-maintenance.md) §3 |
| Bildirim gelmiyor | [06-notifications.md](06-notifications.md) (tercihler + event bus) |
| Dashboard boş | [07-dashboard.md](07-dashboard.md) (demo seed? RLS?) |
| Yeni fabrika eklenmiyor | [08-super-admin.md](08-super-admin.md) |
| Deploy hatası | [09-deployment.md](09-deployment.md) |
| PDF/CSV export | [10-export-reports.md](10-export-reports.md) |
| Fotoğraf yüklenmiyor | [11-photo-upload.md](11-photo-upload.md) |
| Cron çalışmıyor | [12-scheduler.md](12-scheduler.md) (dev vs prod) |
| Kısayol/dark mode | [13-dark-mode-shortcuts-offline.md](13-dark-mode-shortcuts-offline.md) |

Spec kaynağı: [MaintainPro_MVP_Spesifikasyon_v2.docx](../MaintainPro_MVP_Spesifikasyon_v2.docx). Tablolar (`w:tbl`) izinleri, state machine'leri, notification kurallarını taşır — iterate ederken paragrafla yetinme.

---

## 16. Anahtar tasarım kararları (neden böyle?)

1. **Tek Postgres + RLS, tek tenant yerine çok tenant** — maliyet düşük, operasyon basit, ERP'ye entegrasyon sonra kolay.
2. **App Router + API Routes, ayrı backend yok** — küçük ekip (1-2 geliştirici) için full-stack monorepo hızlı.
3. **NextAuth v5 → Cognito v2** — MVP'de self-host, müşteri sayısı artınca migrate.
4. **S3 presigned URL** — upload sunucuyu yormaz, image pipeline client'ta kalabilir.
5. **PM otomasyonu cron** — request-time kontrolü DB'yi boğardı.
6. **Otonom bakım anormal → otomatik aksiyon** — operatör "yapılacak"ı unutmasın diye sistemin görevi.
7. **Turkish-first** — hedef pazar Türk fabrikaları, İngilizce UI zaman kaybı olurdu.

---

## 17. Özet (TL;DR)

MaintainPro = Türk fabrikaları için multi-tenant CMMS. Arıza, stok, otonom bakım, PM, rapor. Next.js + Postgres + Prisma + NextAuth + S3 + App Runner. Dört rol, iki katmanlı tenant izolasyonu (RLS + middleware), mobil-öncelikli, PWA, TR UI / EN kod. MVP tamamlandı ve canlıda; Phase 2 = ERP entegrasyonu.

Daha fazlasını öğrenmek için 1'den başla: [01-authentication.md](01-authentication.md).
