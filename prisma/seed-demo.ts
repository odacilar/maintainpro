/**
 * seed-demo.ts — MaintainPro demo verileri (2-3 aylık gerçekçi aktivite)
 *
 * Çalıştırma: npm run db:seed-demo
 *
 * NOT: RLS bypass için unsafePrisma kullanılır — seed'lerde geçerli kullanım.
 * Mevcut verilerin üzerine ekleme yapar (idempotent: breakdown sayısını kontrol eder).
 */

import { unsafePrisma } from "../src/lib/tenant/prisma";
import {
  BreakdownStatus,
  BreakdownPriority,
  BreakdownType,
  StockMovementType,
  ChecklistPeriod,
  ChecklistItemType,
  ActionStatus,
  ActionPriority,
  NotificationChannel,
  Role,
  PmTriggerType,
  WorkOrderStatus,
} from "@prisma/client";

// ---------------------------------------------------------------------------
// Tarih yardımcıları
// ---------------------------------------------------------------------------

/** 2026-02-01 ile 2026-04-12 arasında rastgele Date döner */
function rndDate(from = new Date("2026-02-01"), to = new Date("2026-04-12")): Date {
  return new Date(from.getTime() + Math.random() * (to.getTime() - from.getTime()));
}

/** Belirli bir tarih + dakika offset */
function addMinutes(d: Date, minutes: number): Date {
  return new Date(d.getTime() + minutes * 60_000);
}

/** Belirli bir tarih + gün offset */
function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 24 * 60 * 60_000);
}

/** 0..(max-1) arasında rastgele tam sayı */
function rndInt(max: number): number {
  return Math.floor(Math.random() * max);
}

/** Diziden rastgele eleman */
function pick<T>(arr: T[]): T {
  return arr[rndInt(arr.length)];
}

/** Diziden N adet rastgele benzersiz eleman */
function pickN<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  const result: T[] = [];
  for (let i = 0; i < n && copy.length > 0; i++) {
    const idx = rndInt(copy.length);
    result.push(copy.splice(idx, 1)[0]);
  }
  return result;
}

/** Ağırlıklı rastgele seçim */
function weightedPick<T>(items: T[], weights: number[]): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

// ---------------------------------------------------------------------------
// Sayaçlar (ARZ / OB-AKS kod üretimi)
// ---------------------------------------------------------------------------

let breakdownSeq = 0;
function nextBreakdownCode(): string {
  breakdownSeq++;
  return `ARZ-2026-${String(breakdownSeq).padStart(4, "0")}`;
}

let actionSeq = 0;
function nextActionCode(): string {
  actionSeq++;
  return `OB-AKS-2026-${String(actionSeq).padStart(4, "0")}`;
}

// ---------------------------------------------------------------------------
// seedPmWorkOrdersAudit — PM Planları, İş Emirleri, Denetim Kayıtları
// ---------------------------------------------------------------------------

interface UserLike { id: string; role: Role }
interface MachineLike { id: string; name: string; code: string }

async function seedPmWorkOrdersAudit(
  factoryId: string,
  machines: MachineLike[],
  adminUser: UserLike,
  engineer: UserLike,
  technician: UserLike,
) {
  // İdempotency: PM planları zaten varsa atla
  const existingPm = await unsafePrisma.pmPlan.count({ where: { factoryId } });
  if (existingPm > 0) {
    console.log(`ℹ️  PM planları zaten mevcut (${existingPm} kayıt). Bölüm 8-10 atlanıyor.`);
    return;
  }

  // ------------------------------------------------------------------
  // 8. Planlı Bakım Planları (PM Plans)
  // ------------------------------------------------------------------
  console.log("\n🔧 Planlı bakım planları oluşturuluyor...");

  const pmPlanDefs = [
    { name: "CNC Günlük Kontrol", type: "Günlük kontrol ve yağlama", interval: 1, est: 30, tasks: ["Yağ seviyesi kontrolü", "Soğutma sıvısı kontrolü", "Talaş temizliği", "Eksen referans kontrolü"] },
    { name: "Haftalık Hidrolik Bakım", type: "Hidrolik sistem bakımı", interval: 7, est: 60, tasks: ["Hidrolik yağ seviyesi", "Filtre basınç farkı", "Bağlantı sızıntı kontrolü", "Pompa ses kontrolü"] },
    { name: "Aylık Genel Bakım", type: "Genel bakım ve kalibrasyon", interval: 30, est: 180, tasks: ["Rulman kontrolü", "Kayış gerginliği", "Elektrik bağlantıları", "Kalibrasyon kontrolü", "Yağ değişimi"] },
    { name: "3 Aylık Kapsamlı Bakım", type: "Kapsamlı periyodik bakım", interval: 90, est: 480, tasks: ["Motor sargı direnci ölçümü", "Titreşim analizi", "Termal görüntüleme", "Tüm contaların kontrolü", "Yağ analizi", "Filtre değişimi"] },
    { name: "6 Aylık Revizyon", type: "Yarı yıllık revizyon", interval: 180, est: 960, tasks: ["Komple sökme-takma", "Rulman değişimi", "Kayış set değişimi", "Elektrik panosu bakımı", "PLC program kontrolü", "Güvenlik sistemleri testi"] },
    { name: "Yıllık Büyük Bakım", type: "Yıllık genel revizyon", interval: 365, est: 1440, tasks: ["Komple revizyon", "Servo motor bakımı", "Kablaj yenileme", "Boya/kaplama", "Sertifikasyon testi"] },
    { name: "Kompresör Haftalık Bakım", type: "Kompresör bakımı", interval: 7, est: 45, tasks: ["Yağ seviyesi", "Hava filtresi kontrolü", "Drenaj kontrolü", "Basınç testi"] },
    { name: "Kaynak Robotu Aylık Bakım", type: "Robot bakımı", interval: 30, est: 120, tasks: ["Torch temizliği", "Kablo kontrolü", "Eksen kalibrasyonu", "Gaz akış kontrolü", "Uç değişimi"] },
  ];

  const createdPmPlans: { id: string; machineId: string; interval: number }[] = [];

  for (let i = 0; i < pmPlanDefs.length; i++) {
    const def = pmPlanDefs[i];
    const machine = machines[i % machines.length];
    const lastExec = addDays(new Date("2026-04-14"), -(def.interval + rndInt(Math.max(1, def.interval / 2))));
    const nextDue = addDays(lastExec, def.interval);

    const plan = await unsafePrisma.pmPlan.create({
      data: {
        factoryId,
        machineId: machine.id,
        name: def.name,
        maintenanceType: def.type,
        triggerType: PmTriggerType.TIME_BASED,
        intervalDays: def.interval,
        estimatedDurationMinutes: def.est,
        taskList: def.tasks,
        requiredPartsJson: [],
        lastExecutedAt: lastExec,
        nextDueAt: nextDue,
        isActive: i < 7,
      },
    });
    createdPmPlans.push({ id: plan.id, machineId: machine.id, interval: def.interval });
  }

  console.log(`  ✓ ${createdPmPlans.length} planlı bakım planı oluşturuldu`);

  // ------------------------------------------------------------------
  // 9. İş Emirleri (Work Orders)
  // ------------------------------------------------------------------
  console.log("\n📋 İş emirleri oluşturuluyor...");

  let woCount = 0;
  const woStatuses = [WorkOrderStatus.COMPLETED, WorkOrderStatus.COMPLETED, WorkOrderStatus.COMPLETED, WorkOrderStatus.IN_PROGRESS, WorkOrderStatus.PLANNED, WorkOrderStatus.CANCELLED];

  for (const plan of createdPmPlans) {
    const numWOs = 2 + rndInt(4);
    for (let j = 0; j < numWOs; j++) {
      const scheduledDate = addDays(new Date("2026-02-10"), j * plan.interval + rndInt(5));
      if (scheduledDate > new Date("2026-04-14")) continue;

      const status = j === numWOs - 1 ? pick([WorkOrderStatus.PLANNED, WorkOrderStatus.IN_PROGRESS]) : pick(woStatuses);
      const startedAt = ([WorkOrderStatus.IN_PROGRESS, WorkOrderStatus.COMPLETED] as WorkOrderStatus[]).includes(status)
        ? addMinutes(scheduledDate, rndInt(120))
        : null;
      const completedAt = status === WorkOrderStatus.COMPLETED
        ? addMinutes(scheduledDate, 60 + rndInt(300))
        : null;

      const assignee = pick([engineer, technician]);

      const noteOptions = [
        "Bakım tamamlandı, sorun tespit edilmedi.",
        "Rulman değişimi yapıldı, test başarılı.",
        "Yağ değişimi ve filtre temizliği yapıldı.",
        "Minör sızıntı tespit edildi, conta değiştirildi.",
        "Kalibrasyon yapıldı, tolerans dahilinde.",
        null,
      ];

      await unsafePrisma.workOrder.create({
        data: {
          factoryId,
          pmPlanId: plan.id,
          machineId: plan.machineId,
          assigneeId: assignee.id,
          scheduledFor: scheduledDate,
          startedAt,
          completedAt,
          status,
          notes: status === WorkOrderStatus.COMPLETED ? pick(noteOptions) : null,
          createdAt: addDays(scheduledDate, -2),
        },
      });
      woCount++;
    }
  }

  console.log(`  ✓ ${woCount} iş emri oluşturuldu`);

  // ------------------------------------------------------------------
  // 10. Denetim Kayıtları (Audit Logs)
  // ------------------------------------------------------------------
  console.log("\n📝 Denetim kayıtları oluşturuluyor...");

  const auditTemplates = [
    { action: "CREATE", entityType: "breakdown", name: "ARZ-2026-0023", changes: null },
    { action: "CREATE", entityType: "machine", name: "Yeni CNC Tezgahı", changes: null },
    { action: "UPDATE", entityType: "machine", name: "CNC-01", changes: { status: { old: "RUNNING", new: "IN_MAINTENANCE" } } },
    { action: "TRANSITION", entityType: "breakdown", name: "ARZ-2026-0015", changes: { status: { old: "OPEN", new: "ASSIGNED" } } },
    { action: "TRANSITION", entityType: "breakdown", name: "ARZ-2026-0018", changes: { status: { old: "IN_PROGRESS", new: "RESOLVED" } } },
    { action: "TRANSITION", entityType: "breakdown", name: "ARZ-2026-0020", changes: { status: { old: "RESOLVED", new: "CLOSED" } } },
    { action: "UPDATE", entityType: "spare_part", name: "Rulman 6205", changes: { currentStock: { old: 14, new: 10 } } },
    { action: "CREATE", entityType: "spare_part", name: "Yeni Sensör PT200", changes: null },
    { action: "CREATE", entityType: "work_order", name: "WO-2026-0012", changes: null },
    { action: "TRANSITION", entityType: "work_order", name: "WO-2026-0008", changes: { status: { old: "PLANNED", new: "IN_PROGRESS" } } },
    { action: "TRANSITION", entityType: "work_order", name: "WO-2026-0005", changes: { status: { old: "IN_PROGRESS", new: "COMPLETED" } } },
    { action: "CREATE", entityType: "pm_plan", name: "Yeni Bakım Planı", changes: null },
    { action: "UPDATE", entityType: "user", name: "Ahmet Teknisyen", changes: { role: { old: "TECHNICIAN", new: "ENGINEER" } } },
    { action: "LOGIN", entityType: "user", name: "admin@acme-metal.local", changes: null },
    { action: "LOGIN", entityType: "user", name: "muhendis@acme-metal.local", changes: null },
    { action: "EXPORT", entityType: "breakdown", name: "Arıza Raporu PDF", changes: null },
    { action: "EXPORT", entityType: "spare_part", name: "Stok Raporu CSV", changes: null },
    { action: "DELETE", entityType: "spare_part", name: "Eski Parça XY-99", changes: null },
    { action: "UPDATE", entityType: "breakdown", name: "ARZ-2026-0011", changes: { priority: { old: "MEDIUM", new: "HIGH" }, description: { old: "Titreşim var", new: "Titreşim arttı, acil müdahale gerekli" } } },
    { action: "CREATE", entityType: "user", name: "Yeni Teknisyen", changes: null },
  ];

  let auditCount = 0;
  const auditStart = new Date("2026-03-15");
  const auditEnd = new Date("2026-04-14");
  const auditUsers = [adminUser, engineer, technician];

  for (let i = 0; i < 80; i++) {
    const tmpl = pick(auditTemplates);
    const actor = tmpl.action === "LOGIN" ? pick(auditUsers) : pick([adminUser, engineer]);
    const createdAt = rndDate(auditStart, auditEnd);

    await unsafePrisma.auditLog.create({
      data: {
        factoryId,
        userId: actor.id,
        action: tmpl.action,
        entityType: tmpl.entityType,
        entityId: tmpl.action === "LOGIN" ? actor.id : `cuid_${rndInt(9999)}`,
        entityName: tmpl.name,
        changes: tmpl.changes ?? undefined,
        metadata: tmpl.action === "LOGIN"
          ? { ip: `192.168.1.${rndInt(254) + 1}`, userAgent: "Mozilla/5.0" }
          : undefined,
        createdAt,
      },
    });
    auditCount++;
  }

  console.log(`  ✓ ${auditCount} denetim kaydı oluşturuldu`);
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function main() {
  console.log("🌱 Demo verileri ekleniyor (2-3 aylık aktivite)...");

  // ------------------------------------------------------------------
  // 0. Factory + kullanıcı + makine bilgilerini çek
  // ------------------------------------------------------------------
  const factory = await unsafePrisma.factory.findFirst({
    where: { slug: "acme-metal" },
  });
  if (!factory) throw new Error("acme-metal fabrikası bulunamadı. Önce db:seed çalıştırın.");

  const factoryId = factory.id;

  const machines = await unsafePrisma.machine.findMany({ where: { factoryId } });
  const users = await unsafePrisma.user.findMany({ where: { factoryId } });

  if (machines.length === 0) throw new Error("Makine bulunamadı. Önce db:seed çalıştırın.");
  if (users.length === 0) throw new Error("Kullanıcı bulunamadı. Önce db:seed çalıştırın.");

  // İdempotency: daha önce demo data yüklendiyse çık (PM/WO/Audit hariç)
  const existingCount = await unsafePrisma.breakdown.count({ where: { factoryId } });
  if (existingCount >= 50) {
    console.log(`ℹ️  Arıza verileri zaten mevcut (${existingCount} kayıt). Bölüm 1-7 atlanıyor.`);
    const adminUser = users.find((u) => u.role === Role.FACTORY_ADMIN) ?? users[0];
    const engineer = users.find((u) => u.role === Role.ENGINEER) ?? users[0];
    const technician = users.find((u) => u.role === Role.TECHNICIAN) ?? users[0];
    await seedPmWorkOrdersAudit(factoryId, machines, adminUser, engineer, technician);
    return;
  }

  const adminUser = users.find((u) => u.role === Role.FACTORY_ADMIN) ?? users[0];
  const engineer = users.find((u) => u.role === Role.ENGINEER) ?? users[0];
  const technician = users.find((u) => u.role === Role.TECHNICIAN) ?? users[0];

  // Makinelere Pareto dağılımı için ağırlıklar (ilk 2 makine breakdownların ~50%'si)
  const machineWeights = machines.map((_, i) => (i === 0 ? 30 : i === 1 ? 25 : i === 2 ? 20 : 10));

  console.log(`  Fabrika: ${factory.name} (${factoryId})`);
  console.log(`  Makine sayısı: ${machines.length}, Kullanıcı sayısı: ${users.length}`);

  // ------------------------------------------------------------------
  // 1. Yedek Parçalar
  // ------------------------------------------------------------------
  console.log("\n📦 Yedek parçalar oluşturuluyor...");

  const sparePartDefs = [
    { code: "YP-0001", name: "Rulman 6205", category: "Rulman", unit: "adet", price: 185, minStock: 10, stock: 14, supplier: "SKF Türkiye" },
    { code: "YP-0002", name: "Rulman 6308", category: "Rulman", unit: "adet", price: 320, minStock: 8, stock: 6, supplier: "SKF Türkiye" },
    { code: "YP-0003", name: "Rulman 6210", category: "Rulman", unit: "adet", price: 245, minStock: 6, stock: 9, supplier: "FAG Türkiye" },
    { code: "YP-0004", name: "V-Kayış A-42", category: "Kayış", unit: "adet", price: 95, minStock: 15, stock: 22, supplier: "Gates" },
    { code: "YP-0005", name: "V-Kayış B-55", category: "Kayış", unit: "adet", price: 130, minStock: 10, stock: 7, supplier: "Gates" },
    { code: "YP-0006", name: "Triger Kayış T10-800", category: "Kayış", unit: "adet", price: 280, minStock: 5, stock: 3, supplier: "Optibelt" },
    { code: "YP-0007", name: "Yağ Filtresi HF6553", category: "Filtre", unit: "adet", price: 145, minStock: 20, stock: 35, supplier: "Hydac" },
    { code: "YP-0008", name: "Hava Filtresi P-553004", category: "Filtre", unit: "adet", price: 88, minStock: 15, stock: 18, supplier: "Donaldson" },
    { code: "YP-0009", name: "Conta Seti CNC-01", category: "Conta", unit: "takım", price: 420, minStock: 5, stock: 8, supplier: "Lokal Tedarikçi" },
    { code: "YP-0010", name: "Sigorta 16A", category: "Elektrik", unit: "adet", price: 25, minStock: 50, stock: 62, supplier: "Siemens" },
    { code: "YP-0011", name: "Sigorta 63A", category: "Elektrik", unit: "adet", price: 85, minStock: 20, stock: 11, supplier: "Siemens" },
    { code: "YP-0012", name: "Hidrolik Yağ ISO 46 (20L)", category: "Yağ", unit: "litre", price: 380, minStock: 40, stock: 60, supplier: "Shell" },
    { code: "YP-0013", name: "Makine Yağı ISO 68 (5L)", category: "Yağ", unit: "litre", price: 195, minStock: 20, stock: 15, supplier: "Mobil" },
    { code: "YP-0014", name: "Sıcaklık Sensörü PT100", category: "Sensör", unit: "adet", price: 750, minStock: 5, stock: 4, supplier: "Endress+Hauser" },
    { code: "YP-0015", name: "Basınç Sensörü 0-10bar", category: "Sensör", unit: "adet", price: 980, minStock: 3, stock: 5, supplier: "Wika" },
    { code: "YP-0016", name: "Solenoid Valf 24VDC", category: "Valf", unit: "adet", price: 1200, minStock: 5, stock: 3, supplier: "Bosch Rexroth" },
    { code: "YP-0017", name: "Servo Motor 1.5kW", category: "Motor", unit: "adet", price: 4800, minStock: 2, stock: 2, supplier: "Fanuc" },
    { code: "YP-0018", name: "Kaynak Elektrodu E6013 (5kg)", category: "Sarf", unit: "kg", price: 185, minStock: 50, stock: 72, supplier: "Lincoln Electric" },
    { code: "YP-0019", name: "Kaplin 28mm", category: "Mekanik", unit: "adet", price: 340, minStock: 5, stock: 2, supplier: "KTR" },
    { code: "YP-0020", name: "Mil Keçesi 40x60x10", category: "Conta", unit: "adet", price: 65, minStock: 20, stock: 28, supplier: "NOK" },
  ];

  const sparePartMap = new Map<string, string>(); // code → id

  for (const sp of sparePartDefs) {
    const existing = await unsafePrisma.sparePart.findFirst({
      where: { factoryId, code: sp.code },
    });
    if (existing) {
      sparePartMap.set(sp.code, existing.id);
      continue;
    }
    const created = await unsafePrisma.sparePart.create({
      data: {
        factoryId,
        code: sp.code,
        name: sp.name,
        category: sp.category,
        unit: sp.unit,
        unitPrice: sp.price,
        minimumStock: sp.minStock,
        currentStock: sp.stock,
        supplier: sp.supplier,
        location: `Raf-${String.fromCharCode(65 + rndInt(6))}${rndInt(10) + 1}`,
        leadTimeDays: pick([3, 5, 7, 14, 21]),
      },
    });
    sparePartMap.set(sp.code, created.id);
  }

  const sparePartIds = Array.from(sparePartMap.values());
  console.log(`  ✓ ${sparePartIds.length} yedek parça oluşturuldu`);

  // ------------------------------------------------------------------
  // 2. Stok Giriş Hareketleri (PURCHASE_IN) — gerçekçi başlangıç stoku
  // ------------------------------------------------------------------
  console.log("\n📋 Stok giriş hareketleri oluşturuluyor...");

  const purchaseDates = [
    new Date("2026-02-03"),
    new Date("2026-02-17"),
    new Date("2026-03-05"),
    new Date("2026-03-24"),
    new Date("2026-04-07"),
  ];

  let stockMoveCount = 0;
  for (const purchaseDate of purchaseDates) {
    // Her satın almada rastgele 4-8 parça al
    const partsForThisPurchase = pickN(sparePartDefs, 4 + rndInt(5));
    for (const sp of partsForThisPurchase) {
      const spId = sparePartMap.get(sp.code)!;
      await unsafePrisma.stockMovement.create({
        data: {
          factoryId,
          sparePartId: spId,
          type: StockMovementType.PURCHASE_IN,
          quantity: sp.minStock + rndInt(sp.minStock),
          unitPriceSnapshot: sp.price,
          userId: adminUser.id,
          note: `Periyodik stok alımı — ${purchaseDate.toLocaleDateString("tr-TR")}`,
          createdAt: purchaseDate,
        },
      });
      stockMoveCount++;
    }
  }
  console.log(`  ✓ ${stockMoveCount} stok giriş hareketi oluşturuldu`);

  // ------------------------------------------------------------------
  // 3. Arızalar (60-80 adet, Şubat 1 - Nisan 12)
  // ------------------------------------------------------------------
  console.log("\n🔧 Arızalar oluşturuluyor...");

  const breakdownDescriptions: Record<BreakdownType, string[]> = {
    MECHANICAL: [
      "Rulman aşınması nedeniyle mil titreşimi artıyor",
      "Kayış kopması — makine duruşu",
      "Dişli kutusunda anormal ses var",
      "Kaplin hasarlı, mil hizalanması bozulmuş",
      "Vida sıkışması ve mekanik blokaj",
      "Pnömatik silindir kafası çatlak",
      "Çark dengesi bozulmuş, titreşim kritik seviyede",
      "Zincir gevsemesi — tahrik problemi",
    ],
    ELECTRICAL: [
      "Frekans konvertörü arızası — fazlar dengesiz",
      "Motor sargısı yanmış, yeniden sarım gerekiyor",
      "Kontaktör yapışması — motora sürekli gerilim",
      "Termik röle atması — aşırı akım tespit edildi",
      "Encoder sinyal kaybı — konum hatası",
      "PLC çıkış kartı arızası",
      "Servo sürücü alarm — DC bus gerilim hatası",
      "Kablo kopukluk tespiti — E-stop devresi",
    ],
    PNEUMATIC: [
      "Hava kaçağı tespit edildi — piston contası",
      "Solenoid valf açılmıyor — piston hareketsiz",
      "Hava basıncı yetersiz — kompresör kontrolü gerekli",
      "FRL ünitesi tıkanması",
    ],
    HYDRAULIC: [
      "Hidrolik basınç düşüşü — pompa aşınması",
      "Yağ sızıntısı — bağlantı noktalarında kaçak",
      "Hidrolik silindir geri dönmüyor",
    ],
    SOFTWARE: [
      "CNC programı parametre hatası — eksen durdu",
      "SCADA iletişim kesilmesi — PLC bağlantı yok",
      "Makine HMI donması — yazılım yeniden başlatma",
    ],
    OTHER: [
      "Operatör hatası — yanlış takım montajı",
      "Enerji kesintisi hasarı",
      "Rutin kontrol sırasında tespit edilen aşınma",
    ],
  };

  const resolutionNotes: string[] = [
    "Rulman değiştirildi ve yağlama yapıldı. Test çalışması başarılı.",
    "Arızalı bileşen değiştirildi, kalibrasyon yapıldı.",
    "Geçici tamir yapıldı, kalıcı çözüm için sipariş verildi.",
    "Kayış değişimi yapıldı ve hizalama ayarlandı.",
    "Motor revizyona gönderildi, yedek motor takıldı.",
    "Yazılım parametreleri fabrika ayarlarına döndürüldü.",
    "Conta değişimi ve sızıntı testi yapıldı — başarılı.",
    "Sigorta değiştirildi, kısa devre kaynağı araştırılıyor.",
    "Yedek parça ile değişim yapıldı, 2 saat test çalışması tamamlandı.",
    "Periyodik bakım yapıldı ve kontrol noktaları temizlendi.",
  ];

  const BREAKDOWN_COUNT = 65;
  const createdBreakdowns: Array<{ id: string; machineId: string; reporterId: string }> = [];

  for (let i = 0; i < BREAKDOWN_COUNT; i++) {
    const code = nextBreakdownCode();
    const machine = weightedPick(machines, machineWeights);

    // Tip dağılımı: MECHANICAL %40, ELECTRICAL %30, HYDRAULIC %10, PNEUMATIC %10, SOFTWARE %6, OTHER %4
    const bType = weightedPick<BreakdownType>(
      [BreakdownType.MECHANICAL, BreakdownType.ELECTRICAL, BreakdownType.HYDRAULIC, BreakdownType.PNEUMATIC, BreakdownType.SOFTWARE, BreakdownType.OTHER],
      [40, 30, 10, 10, 6, 4],
    );

    // Öncelik: CRITICAL %10, HIGH %25, MEDIUM %40, LOW %25
    const priority = weightedPick<BreakdownPriority>(
      [BreakdownPriority.CRITICAL, BreakdownPriority.HIGH, BreakdownPriority.MEDIUM, BreakdownPriority.LOW],
      [10, 25, 40, 25],
    );

    // Durum: CLOSED %60, RESOLVED %20, IN_PROGRESS %10, ASSIGNED %5, OPEN %5
    const status = weightedPick<BreakdownStatus>(
      [BreakdownStatus.CLOSED, BreakdownStatus.RESOLVED, BreakdownStatus.IN_PROGRESS, BreakdownStatus.ASSIGNED, BreakdownStatus.OPEN],
      [60, 20, 10, 5, 5],
    );

    const reporter = pick(users);
    const reportedAt = rndDate();

    // Gerçekçi süreler
    const responseMinutes = 15 + rndInt(45); // 15-60 dk
    const resolutionMinutes = 60 + rndInt(420); // 1-8 saat
    const closingMinutes = 30 + rndInt(120); // kapatma

    const respondedAt =
      ([BreakdownStatus.IN_PROGRESS, BreakdownStatus.WAITING_PARTS, BreakdownStatus.RESOLVED, BreakdownStatus.CLOSED] as BreakdownStatus[]).includes(status)
        ? addMinutes(reportedAt, responseMinutes)
        : null;

    const resolvedAt =
      ([BreakdownStatus.RESOLVED, BreakdownStatus.CLOSED] as BreakdownStatus[]).includes(status)
        ? addMinutes(reportedAt, resolutionMinutes)
        : null;

    const closedAt =
      status === BreakdownStatus.CLOSED && resolvedAt
        ? addMinutes(resolvedAt, closingMinutes)
        : null;

    const totalDowntimeMinutes =
      resolvedAt ? Math.round((resolvedAt.getTime() - reportedAt.getTime()) / 60_000) : null;

    const descriptions = breakdownDescriptions[bType];
    const description = pick(descriptions);

    const assigneeId =
      ([BreakdownStatus.ASSIGNED, BreakdownStatus.IN_PROGRESS, BreakdownStatus.WAITING_PARTS, BreakdownStatus.RESOLVED, BreakdownStatus.CLOSED] as BreakdownStatus[]).includes(status)
        ? pick([engineer.id, technician.id])
        : null;

    const isRecurring = i > 0 && rndInt(10) < 2; // %20 olasılık

    const breakdown = await unsafePrisma.breakdown.create({
      data: {
        factoryId,
        code,
        machineId: machine.id,
        type: bType,
        priority,
        status,
        reporterId: reporter.id,
        assigneeId,
        description,
        reportedAt,
        respondedAt,
        resolvedAt,
        closedAt,
        totalDowntimeMinutes,
        isRecurring,
        resolutionNotes: resolvedAt ? pick(resolutionNotes) : null,
        rootCause:
          resolvedAt
            ? pick(["Periyodik bakım eksikliği", "Aşınma", "Operatör hatası", "Malzeme yorulması", "Dış etken"])
            : null,
      },
    });

    createdBreakdowns.push({ id: breakdown.id, machineId: machine.id, reporterId: reporter.id });

    // Zaman çizelgesi (timeline) oluştur
    await unsafePrisma.breakdownTimeline.create({
      data: {
        factoryId,
        breakdownId: breakdown.id,
        userId: reporter.id,
        fromStatus: null,
        toStatus: BreakdownStatus.OPEN,
        createdAt: reportedAt,
      },
    });

    if (assigneeId) {
      await unsafePrisma.breakdownTimeline.create({
        data: {
          factoryId,
          breakdownId: breakdown.id,
          userId: adminUser.id,
          fromStatus: BreakdownStatus.OPEN,
          toStatus: BreakdownStatus.ASSIGNED,
          note: "Arıza atandı.",
          createdAt: addMinutes(reportedAt, 5),
        },
      });
    }

    if (respondedAt) {
      await unsafePrisma.breakdownTimeline.create({
        data: {
          factoryId,
          breakdownId: breakdown.id,
          userId: assigneeId ?? engineer.id,
          fromStatus: BreakdownStatus.ASSIGNED,
          toStatus: BreakdownStatus.IN_PROGRESS,
          note: "Müdahale başlatıldı.",
          createdAt: respondedAt,
        },
      });
    }

    if (resolvedAt) {
      await unsafePrisma.breakdownTimeline.create({
        data: {
          factoryId,
          breakdownId: breakdown.id,
          userId: assigneeId ?? engineer.id,
          fromStatus: BreakdownStatus.IN_PROGRESS,
          toStatus: BreakdownStatus.RESOLVED,
          note: "Arıza giderildi, test yapıldı.",
          createdAt: resolvedAt,
        },
      });
    }

    if (closedAt) {
      await unsafePrisma.breakdownTimeline.create({
        data: {
          factoryId,
          breakdownId: breakdown.id,
          userId: engineer.id,
          fromStatus: BreakdownStatus.RESOLVED,
          toStatus: BreakdownStatus.CLOSED,
          note: "Mühendis tarafından kapatıldı.",
          createdAt: closedAt,
        },
      });
    }
  }

  console.log(`  ✓ ${BREAKDOWN_COUNT} arıza kaydı + zaman çizelgeleri oluşturuldu`);

  // ------------------------------------------------------------------
  // 4. Stok Çıkış Hareketleri — arızalara bağlı BREAKDOWN_OUT
  // ------------------------------------------------------------------
  console.log("\n📤 Stok çıkış hareketleri oluşturuluyor...");

  const closedBreakdowns = createdBreakdowns.slice(0, Math.floor(createdBreakdowns.length * 0.65));
  let breakdownOutCount = 0;

  for (const bd of closedBreakdowns) {
    if (rndInt(10) < 4) continue; // %40 arızada parça kullanılmaz
    const partsUsed = 1 + rndInt(3);
    const usedParts = pickN(sparePartDefs, partsUsed);
    for (const sp of usedParts) {
      const spId = sparePartMap.get(sp.code)!;
      const qty = 1 + rndInt(3);
      await unsafePrisma.stockMovement.create({
        data: {
          factoryId,
          sparePartId: spId,
          type: StockMovementType.BREAKDOWN_OUT,
          quantity: qty,
          unitPriceSnapshot: sp.price,
          machineId: bd.machineId,
          breakdownId: bd.id,
          userId: technician.id,
          note: "Arıza müdahalesi için kullanıldı",
          createdAt: rndDate(new Date("2026-02-01"), new Date("2026-04-10")),
        },
      });
      stockMoveCount++;
      breakdownOutCount++;
    }
  }

  // Birkaç SCRAP_OUT
  for (let i = 0; i < 8; i++) {
    const sp = pick(sparePartDefs);
    const spId = sparePartMap.get(sp.code)!;
    await unsafePrisma.stockMovement.create({
      data: {
        factoryId,
        sparePartId: spId,
        type: StockMovementType.SCRAP_OUT,
        quantity: 1 + rndInt(4),
        unitPriceSnapshot: sp.price,
        userId: engineer.id,
        note: "Ömrünü tamamladı — imha",
        createdAt: rndDate(),
      },
    });
    stockMoveCount++;
  }

  // Birkaç RETURN_IN
  for (let i = 0; i < 4; i++) {
    const sp = pick(sparePartDefs);
    const spId = sparePartMap.get(sp.code)!;
    await unsafePrisma.stockMovement.create({
      data: {
        factoryId,
        sparePartId: spId,
        type: StockMovementType.RETURN_IN,
        quantity: 1 + rndInt(3),
        unitPriceSnapshot: sp.price,
        userId: technician.id,
        note: "Kullanılmayan parça iade",
        createdAt: rndDate(),
      },
    });
    stockMoveCount++;
  }

  console.log(`  ✓ ${breakdownOutCount} arıza çıkışı + fire + iade hareketleri oluşturuldu (toplam: ${stockMoveCount})`);

  // ------------------------------------------------------------------
  // 5. Checklist Şablonları + Öğeler
  // ------------------------------------------------------------------
  console.log("\n📝 Kontrol listesi şablonları oluşturuluyor...");

  // Makine kodlarına göre eşleştir
  const machineByCode = new Map(machines.map((m) => [m.code, m]));
  const cncMachine = machineByCode.get("CNC-01") ?? machines[0];
  const cncMachine2 = machineByCode.get("CNC-02") ?? machines[1] ?? machines[0];
  const welder = machineByCode.get("KYN-01") ?? machines[2] ?? machines[0];
  const paintMachine = machineByCode.get("BOYA-01") ?? machines[3] ?? machines[0];

  type TemplateInput = {
    machineId: string;
    name: string;
    period: ChecklistPeriod;
    items: Array<{
      orderIndex: number;
      title: string;
      type: ChecklistItemType;
      referenceValue?: string;
      photoRequired?: boolean;
      meta?: object;
    }>;
  };

  const templateDefs: TemplateInput[] = [
    {
      machineId: cncMachine.id,
      name: "CNC-01 Günlük Kontrol",
      period: ChecklistPeriod.DAILY,
      items: [
        { orderIndex: 1, title: "Yağ seviyesi kontrolü", type: ChecklistItemType.MEASUREMENT, referenceValue: "MIN-MAX arası (yeşil bölge)" },
        { orderIndex: 2, title: "Ses ve titreşim kontrolü", type: ChecklistItemType.YES_NO },
        { orderIndex: 3, title: "Acil stop düğmesi testi", type: ChecklistItemType.YES_NO },
        { orderIndex: 4, title: "Talaş temizliği yapıldı", type: ChecklistItemType.YES_NO },
        { orderIndex: 5, title: "Soğutma sıvısı miktarı (L)", type: ChecklistItemType.MEASUREMENT, referenceValue: "8-12 L" },
        { orderIndex: 6, title: "Genel durum fotoğrafı", type: ChecklistItemType.PHOTO, photoRequired: true },
      ],
    },
    {
      machineId: cncMachine2.id,
      name: "CNC-02 Günlük Kontrol",
      period: ChecklistPeriod.DAILY,
      items: [
        { orderIndex: 1, title: "Hidrolik basınç ölçümü (bar)", type: ChecklistItemType.MEASUREMENT, referenceValue: "80-100 bar" },
        { orderIndex: 2, title: "Güvenlik bariyerleri çalışıyor mu?", type: ChecklistItemType.YES_NO },
        { orderIndex: 3, title: "Eksen hareketi kontrolü", type: ChecklistItemType.MULTIPLE_CHOICE, meta: { choices: ["Sorunsuz", "Yavaş", "Takılıyor"] } },
        { orderIndex: 4, title: "Yağlama durumu", type: ChecklistItemType.YES_NO },
        { orderIndex: 5, title: "Genel durum fotoğrafı", type: ChecklistItemType.PHOTO, photoRequired: true },
      ],
    },
    {
      machineId: welder.id,
      name: "Kaynak Makinesi Haftalık Kontrol",
      period: ChecklistPeriod.WEEKLY,
      items: [
        { orderIndex: 1, title: "Kablo izolasyon kontrolü", type: ChecklistItemType.YES_NO },
        { orderIndex: 2, title: "Torç soğutma suyu basıncı (bar)", type: ChecklistItemType.MEASUREMENT, referenceValue: "3-5 bar" },
        { orderIndex: 3, title: "Tel besleme motoru hızı (m/dk)", type: ChecklistItemType.MEASUREMENT, referenceValue: "5-10 m/dk" },
        { orderIndex: 4, title: "Koruyucu gaz akışı (L/dk)", type: ChecklistItemType.MEASUREMENT, referenceValue: "12-18 L/dk" },
        { orderIndex: 5, title: "Kaynak kalitesi değerlendirmesi", type: ChecklistItemType.MULTIPLE_CHOICE, meta: { choices: ["İyi", "Kabul edilebilir", "Yetersiz"] } },
        { orderIndex: 6, title: "Haftalık durum fotoğrafı", type: ChecklistItemType.PHOTO, photoRequired: false },
      ],
    },
    {
      machineId: paintMachine.id,
      name: "Boya Kabini Aylık Bakım",
      period: ChecklistPeriod.MONTHLY,
      items: [
        { orderIndex: 1, title: "Hava filtresi temizliği / değişimi", type: ChecklistItemType.YES_NO },
        { orderIndex: 2, title: "Sprey tabancaları temizlendi", type: ChecklistItemType.YES_NO },
        { orderIndex: 3, title: "Fırın sıcaklığı kalibrasyonu (°C)", type: ChecklistItemType.MEASUREMENT, referenceValue: "180-200 °C" },
        { orderIndex: 4, title: "Boya pompası basıncı (bar)", type: ChecklistItemType.MEASUREMENT, referenceValue: "4-6 bar" },
        { orderIndex: 5, title: "Kabin iç temizliği durumu", type: ChecklistItemType.MULTIPLE_CHOICE, meta: { choices: ["Temiz", "Kısmi Kirli", "Acil Temizlik"] } },
        { orderIndex: 6, title: "Aylık bakım fotoğrafı", type: ChecklistItemType.PHOTO, photoRequired: true },
      ],
    },
    {
      machineId: cncMachine.id,
      name: "CNC-01 Genel Aylık Bakım",
      period: ChecklistPeriod.MONTHLY,
      items: [
        { orderIndex: 1, title: "Mil ve kızak yağlaması yapıldı", type: ChecklistItemType.YES_NO },
        { orderIndex: 2, title: "Filtre değişimi yapıldı", type: ChecklistItemType.YES_NO },
        { orderIndex: 3, title: "Elektrik paneli iç kontrolü", type: ChecklistItemType.YES_NO },
        { orderIndex: 4, title: "Lineer kızak boşluk ölçümü (mm)", type: ChecklistItemType.MEASUREMENT, referenceValue: "0.00-0.05 mm" },
        { orderIndex: 5, title: "Takım değiştirici kontrol", type: ChecklistItemType.YES_NO },
        { orderIndex: 6, title: "Makine genel durum fotoğrafı", type: ChecklistItemType.PHOTO, photoRequired: true },
      ],
    },
  ];

  const createdTemplates: Array<{ id: string; machineId: string; period: ChecklistPeriod; items: Array<{ id: string; type: ChecklistItemType }> }> = [];

  for (const tDef of templateDefs) {
    const existing = await unsafePrisma.checklistTemplate.findFirst({
      where: { factoryId, name: tDef.name },
    });
    if (existing) {
      const items = await unsafePrisma.checklistItem.findMany({ where: { templateId: existing.id } });
      createdTemplates.push({
        id: existing.id,
        machineId: existing.machineId,
        period: existing.period,
        items: items.map((it) => ({ id: it.id, type: it.type })),
      });
      continue;
    }

    const template = await unsafePrisma.checklistTemplate.create({
      data: {
        factoryId,
        machineId: tDef.machineId,
        name: tDef.name,
        period: tDef.period,
        assignedRoles: [Role.TECHNICIAN, Role.ENGINEER],
        isActive: true,
      },
    });

    const createdItems: Array<{ id: string; type: ChecklistItemType }> = [];
    for (const item of tDef.items) {
      const ci = await unsafePrisma.checklistItem.create({
        data: {
          templateId: template.id,
          orderIndex: item.orderIndex,
          title: item.title,
          type: item.type,
          referenceValue: item.referenceValue ?? null,
          photoRequired: item.photoRequired ?? false,
          meta: item.meta ?? undefined,
        },
      });
      createdItems.push({ id: ci.id, type: ci.type });
    }

    createdTemplates.push({
      id: template.id,
      machineId: tDef.machineId,
      period: tDef.period,
      items: createdItems,
    });
  }

  console.log(`  ✓ ${createdTemplates.length} kontrol listesi şablonu oluşturuldu`);

  // ------------------------------------------------------------------
  // 6. Kontrol Listesi Kayıtları + Yanıtlar + Aksiyonlar
  // ------------------------------------------------------------------
  console.log("\n📊 Kontrol listesi kayıtları oluşturuluyor...");

  const start = new Date("2026-02-01");
  const end = new Date("2026-04-12");

  let recordCount = 0;
  let responseCount = 0;
  let actionCount = 0;
  const createdActions: string[] = [];

  for (const tmpl of createdTemplates) {
    // Şablonun periyoduna göre tarihler oluştur
    const scheduledDates: Date[] = [];
    const current = new Date(start);

    while (current <= end) {
      scheduledDates.push(new Date(current));
      if (tmpl.period === ChecklistPeriod.DAILY || tmpl.period === ChecklistPeriod.SHIFT_START) {
        current.setDate(current.getDate() + 1);
      } else if (tmpl.period === ChecklistPeriod.WEEKLY) {
        current.setDate(current.getDate() + 7);
      } else if (tmpl.period === ChecklistPeriod.MONTHLY) {
        current.setMonth(current.getMonth() + 1);
      }
    }

    for (const scheduled of scheduledDates) {
      // Bugün = 2026-04-12 → bugünkü pending bırak
      const isToday = scheduled.toDateString() === new Date("2026-04-12").toDateString();
      if (isToday) {
        // %50 ihtimalle bugünkü kaydı oluştur (pending)
        if (rndInt(2) === 0) continue;
      }

      // Durum: %85 completed, %10 missed, %5 pending
      let status: string;
      if (isToday) {
        status = "pending";
      } else {
        status = weightedPick(["completed", "missed", "pending"], [85, 10, 5]);
      }

      const executor = pick([technician, engineer]);
      const startedAt = status === "completed" ? addMinutes(scheduled, rndInt(60)) : null;
      const completedAt = status === "completed" && startedAt ? addMinutes(startedAt, 10 + rndInt(30)) : null;

      const record = await unsafePrisma.checklistRecord.create({
        data: {
          factoryId,
          templateId: tmpl.id,
          userId: executor.id,
          machineId: tmpl.machineId,
          scheduledFor: scheduled,
          startedAt,
          completedAt,
          status,
        },
      });
      recordCount++;

      // Tamamlandıysa yanıt oluştur
      if (status === "completed" && startedAt) {
        for (const item of tmpl.items) {
          // %15 anormal yanıt ihtimali
          const isAbnormal = rndInt(100) < 15;

          let valueBool: boolean | null = null;
          let valueNumber: number | null = null;
          let valueText: string | null = null;
          let note: string | null = null;

          if (item.type === ChecklistItemType.YES_NO) {
            valueBool = isAbnormal ? false : true;
          } else if (item.type === ChecklistItemType.MEASUREMENT) {
            // Normal değer aralığını simüle et
            const baseVal = 5 + rndInt(90);
            valueNumber = isAbnormal ? baseVal * (rndInt(2) === 0 ? 0.6 : 1.4) : baseVal;
          } else if (item.type === ChecklistItemType.MULTIPLE_CHOICE) {
            valueText = isAbnormal
              ? pick(["Aşınmış", "Değişmeli", "Yetersiz", "Acil Temizlik", "Takılıyor"])
              : pick(["İyi", "Sorunsuz", "Temiz", "Kabul edilebilir"]);
          } else if (item.type === ChecklistItemType.PHOTO) {
            valueText = "photos/mock-photo.jpg"; // Mock S3 key
          }

          if (isAbnormal) {
            note = pick([
              "Değer limit dışı — acil kontrol gerekiyor",
              "Anormal ses tespit edildi",
              "Görsel incelemede hasar mevcut",
              "Ölçüm beklenen aralığın dışında",
              "Yağ seviyesi kritik sınırın altında",
            ]);
          }

          const response = await unsafePrisma.itemResponse.create({
            data: {
              recordId: record.id,
              itemId: item.id,
              valueBool,
              valueNumber,
              valueText,
              isAbnormal,
              note,
              createdAt: startedAt,
            },
          });
          responseCount++;

          // Anormal yanıt → aksiyon oluştur (spec §6.2)
          if (isAbnormal && item.type !== ChecklistItemType.PHOTO) {
            const code = nextActionCode();
            const priority = weightedPick<ActionPriority>(
              [ActionPriority.URGENT, ActionPriority.NORMAL, ActionPriority.INFO],
              [20, 60, 20],
            );
            const actionStatus = weightedPick<ActionStatus>(
              [ActionStatus.OPEN, ActionStatus.IN_PROGRESS, ActionStatus.COMPLETED, ActionStatus.VERIFIED],
              [20, 20, 30, 30],
            );

            const descriptions = [
              "Yağ seviyesi düşük — acil takviye gerekli",
              "Anormal titreşim tespit edildi — rulman kontrolü yapılmalı",
              "Basınç değeri limit dışı — valf ve hat kontrolü gerekli",
              "Eksen hareketinde takılma — kızak yağlama yapılmalı",
              "Ses anormalliği — mekanik kontrol gerekli",
              "Sıcaklık yükseldi — soğutma sistemi kontrol edilmeli",
              "Güvenlik bariyeri arızalı — acil müdahale gerekli",
            ];

            const targetDate = addDays(scheduled, 3 + rndInt(7));
            const verifiedAt = actionStatus === ActionStatus.VERIFIED ? addDays(targetDate, 1) : null;

            const action = await unsafePrisma.action.create({
              data: {
                factoryId,
                code,
                recordId: record.id,
                itemResponseId: response.id,
                description: note ?? pick(descriptions),
                priority,
                status: actionStatus,
                assigneeId: pick([engineer.id, technician.id]),
                targetDate,
                resolutionNotes:
                  ([ActionStatus.COMPLETED, ActionStatus.VERIFIED] as ActionStatus[]).includes(actionStatus)
                    ? pick(["Kontrol yapıldı ve giderildi.", "Yedek parça ile değiştirildi.", "Parametre düzeltildi, test başarılı."])
                    : null,
                verifiedById: actionStatus === ActionStatus.VERIFIED ? engineer.id : null,
                verifiedAt,
                createdAt: startedAt,
              },
            });
            createdActions.push(action.id);
            actionCount++;
          }
        }
      }
    }
  }

  console.log(`  ✓ ${recordCount} kontrol kaydı, ${responseCount} yanıt, ${actionCount} aksiyon oluşturuldu`);

  // ------------------------------------------------------------------
  // 7. Bildirimler (son 2 haftaya yoğunlaştırılmış)
  // ------------------------------------------------------------------
  console.log("\n🔔 Bildirimler oluşturuluyor...");

  const notifStart = new Date("2026-03-29");
  const notifEnd = new Date("2026-04-12");

  const notificationTemplates = [
    { eventType: "breakdown.opened", title: "Yeni Arıza Açıldı", body: "CNC-01 makinesinde yeni bir arıza kaydedildi. Öncelik: YÜKSEK", referenceType: "breakdown" },
    { eventType: "breakdown.assigned", title: "Arıza Atandı", body: "ARZ-2026-0012 arızası size atandı. Lütfen kontrol edin.", referenceType: "breakdown" },
    { eventType: "breakdown.critical", title: "Kritik Arıza!", body: "Robot Kaynak Hattı'nda kritik arıza — acil müdahale gerekiyor.", referenceType: "breakdown" },
    { eventType: "stock.low", title: "Stok Kritik Seviyede", body: "Rulman 6308 stoğu minimum seviyenin altına düştü (mevcut: 6, minimum: 8).", referenceType: "spare_part" },
    { eventType: "stock.out", title: "Stok Tükendi", body: "Solenoid Valf 24VDC stoğu bitti. Acil sipariş gerekli.", referenceType: "spare_part" },
    { eventType: "action.created", title: "Yeni Aksiyon Atandı", body: "OB-AKS-2026-0003 aksiyonu size atandı. Hedef tarih: 3 gün.", referenceType: "action" },
    { eventType: "action.overdue", title: "Aksiyon Süresi Geçti", body: "OB-AKS-2026-0001 aksiyonunun hedef tarihi geçti. Lütfen durumu güncelleyin.", referenceType: "action" },
    { eventType: "breakdown.escalated", title: "Arıza Eskalasyon", body: "ARZ-2026-0005 arızası 60 dakikadır çözüm bekliyor — yöneticiye iletildi.", referenceType: "breakdown" },
    { eventType: "checklist.missed", title: "Kontrol Listesi Atlandı", body: "CNC-01 Günlük Kontrol listesi bugün tamamlanmadı.", referenceType: "checklist" },
    { eventType: "pm.due", title: "Planlı Bakım Yaklaşıyor", body: "CNC-01 aylık bakımı 3 gün içinde planlanıyor.", referenceType: "pm_plan" },
  ];

  const targetUser = adminUser;
  let notifCount = 0;

  for (let i = 0; i < 45; i++) {
    const tmpl = pick(notificationTemplates);
    const createdAt = rndDate(notifStart, notifEnd);
    const isRead = rndInt(10) < 6; // %60 okundu
    const readAt = isRead ? addMinutes(createdAt, 5 + rndInt(120)) : null;

    await unsafePrisma.notification.create({
      data: {
        factoryId,
        userId: targetUser.id,
        channel: pick([NotificationChannel.IN_APP, NotificationChannel.IN_APP, NotificationChannel.EMAIL]),
        eventType: tmpl.eventType,
        title: tmpl.title,
        body: tmpl.body,
        referenceType: tmpl.referenceType,
        referenceId: createdBreakdowns[rndInt(Math.min(10, createdBreakdowns.length))]?.id ?? null,
        readAt,
        sentAt: createdAt,
        createdAt,
      },
    });
    notifCount++;
  }

  // Teknisyen için de birkaç bildirim
  for (let i = 0; i < 15; i++) {
    const tmpl = pick(notificationTemplates.filter((t) => t.eventType.includes("breakdown") || t.eventType.includes("action")));
    const createdAt = rndDate(notifStart, notifEnd);
    const isRead = rndInt(10) < 4; // %40 okundu

    await unsafePrisma.notification.create({
      data: {
        factoryId,
        userId: technician.id,
        channel: NotificationChannel.IN_APP,
        eventType: tmpl.eventType,
        title: tmpl.title,
        body: tmpl.body,
        referenceType: tmpl.referenceType,
        referenceId: createdBreakdowns[rndInt(Math.min(10, createdBreakdowns.length))]?.id ?? null,
        readAt: isRead ? addMinutes(createdAt, 10 + rndInt(60)) : null,
        sentAt: createdAt,
        createdAt,
      },
    });
    notifCount++;
  }

  console.log(`  ✓ ${notifCount} bildirim oluşturuldu`);

  // ------------------------------------------------------------------
  // 8-10. PM Planları, İş Emirleri, Denetim Kayıtları
  // ------------------------------------------------------------------
  await seedPmWorkOrdersAudit(factoryId, machines, adminUser, engineer, technician);

  // ------------------------------------------------------------------
  // Özet
  // ------------------------------------------------------------------
  console.log("\n✅ Demo verileri başarıyla eklendi!");
  console.log("─".repeat(50));
  console.log(`  Fabrika       : ${factory.name}`);
  console.log(`  Yedek parça   : ${sparePartIds.length}`);
  console.log(`  Stok hareketi : ${stockMoveCount}`);
  console.log(`  Arıza         : ${BREAKDOWN_COUNT}`);
  console.log(`  Kontrol listesi şablonu: ${createdTemplates.length}`);
  console.log(`  Kontrol kaydı : ${recordCount}`);
  console.log(`  Yanıt         : ${responseCount}`);
  console.log(`  Aksiyon       : ${actionCount}`);
  console.log(`  Bildirim      : ${notifCount}`);
  console.log("─".repeat(50));
  console.log("  Dashboard grafikleri için veri hazır.");
}

main()
  .catch((e) => {
    console.error("❌ Seed hatası:", e);
    process.exit(1);
  })
  .finally(() => unsafePrisma.$disconnect());
