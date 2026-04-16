"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  ChevronRight,
  LayoutDashboard,
  Wrench,
  AlertTriangle,
  Package,
  ClipboardCheck,
  Calendar,
  BarChart2,
  Users,
  Bell,
  Shield,
  Key,
  Zap,
  FileText,
  Info,
  CheckCircle,
  ScrollText,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types & helpers
// ---------------------------------------------------------------------------

interface Section {
  id: string;
  title: string;
  icon: React.ElementType;
  content: React.ReactNode;
}

function Accordion({
  title,
  icon: Icon,
  children,
  defaultOpen = false,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card className="border">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-muted/30 transition-colors"
      >
        <Icon className="h-5 w-5 shrink-0 text-primary" />
        <span className="font-semibold text-base flex-1">{title}</span>
        {open ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
      {open && (
        <CardContent className="pt-0 pb-5 px-5 border-t">
          <div className="prose prose-sm max-w-none dark:prose-invert mt-4 space-y-4">
            {children}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

function FlowChart({ steps }: { steps: string[] }) {
  return (
    <div className="flex flex-wrap items-center gap-1 py-2">
      {steps.map((step, i) => (
        <div key={i} className="flex items-center gap-1">
          <span className="inline-flex items-center rounded-md bg-primary/10 border border-primary/20 px-3 py-1.5 text-xs font-medium">
            {step}
          </span>
          {i < steps.length - 1 && (
            <span className="text-muted-foreground text-lg">→</span>
          )}
        </div>
      ))}
    </div>
  );
}

function FormulaBox({
  name,
  formula,
  description,
  example,
}: {
  name: string;
  formula: string;
  description: string;
  example?: string;
}) {
  return (
    <div className="rounded-md border bg-muted/30 p-4 space-y-2">
      <div className="font-semibold text-sm">{name}</div>
      <code className="block bg-background rounded px-3 py-2 text-sm font-mono border">
        {formula}
      </code>
      <p className="text-xs text-muted-foreground">{description}</p>
      {example && (
        <p className="text-xs text-muted-foreground italic">Örnek: {example}</p>
      )}
    </div>
  );
}

function RoleTable() {
  const roles = [
    {
      role: "SUPER_ADMIN",
      label: "Süper Admin",
      desc: "Platform yöneticisi. Tüm fabrikaları yönetir, abonelik kontrolü yapar.",
      access: "Süper Admin Paneli, Fabrika CRUD, Abonelik Yönetimi",
    },
    {
      role: "FACTORY_ADMIN",
      label: "Fabrika Yöneticisi",
      desc: "Fabrika seviyesinde tam yetki. Kullanıcı, makine, departman yönetimi.",
      access: "Tüm fabrika modülleri, kullanıcı yönetimi, raporlar, denetim kayıtları",
    },
    {
      role: "ENGINEER",
      label: "Mühendis",
      desc: "Bakım mühendisi. Arıza atama, planlı bakım, yedek parça yönetimi.",
      access: "Arızalar, yedek parça, planlı bakım, iş emirleri, otonom bakım, raporlar",
    },
    {
      role: "TECHNICIAN",
      label: "Teknisyen",
      desc: "Saha teknisyeni. Arıza bildirimi, görev takibi, otonom bakım uygulaması.",
      access: "Arızalar (bildirim), görevlerim, otonom bakım uygulama, iş emirleri (görüntüle)",
    },
  ];
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border">
        <thead className="bg-muted/50">
          <tr>
            <th className="px-3 py-2 text-left font-medium border-b">Rol</th>
            <th className="px-3 py-2 text-left font-medium border-b">Açıklama</th>
            <th className="px-3 py-2 text-left font-medium border-b">Erişim Alanları</th>
          </tr>
        </thead>
        <tbody>
          {roles.map((r) => (
            <tr key={r.role} className="border-b">
              <td className="px-3 py-2 font-mono text-xs">{r.label}</td>
              <td className="px-3 py-2">{r.desc}</td>
              <td className="px-3 py-2 text-muted-foreground text-xs">{r.access}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CredentialsTable() {
  const creds = [
    { email: "admin@acme-metal.local", password: "Test1234!", role: "FACTORY_ADMIN", name: "Ahmet Yılmaz" },
    { email: "muhendis@acme-metal.local", password: "Test1234!", role: "ENGINEER", name: "Mehmet Demir" },
    { email: "teknisyen@acme-metal.local", password: "Test1234!", role: "TECHNICIAN", name: "Ali Kaya" },
    { email: "super@maintainpro.com", password: "Super1234!", role: "SUPER_ADMIN", name: "Sistem Admin" },
  ];
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border">
        <thead className="bg-muted/50">
          <tr>
            <th className="px-3 py-2 text-left font-medium border-b">Kullanıcı</th>
            <th className="px-3 py-2 text-left font-medium border-b">E-posta</th>
            <th className="px-3 py-2 text-left font-medium border-b">Şifre</th>
            <th className="px-3 py-2 text-left font-medium border-b">Rol</th>
          </tr>
        </thead>
        <tbody>
          {creds.map((c) => (
            <tr key={c.email} className="border-b">
              <td className="px-3 py-2">{c.name}</td>
              <td className="px-3 py-2 font-mono text-xs">{c.email}</td>
              <td className="px-3 py-2 font-mono text-xs">{c.password}</td>
              <td className="px-3 py-2 font-mono text-xs">{c.role}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusBadge({ label, color }: { label: string; color: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium border",
        color,
      )}
    >
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

const sections: Section[] = [
  {
    id: "genel",
    title: "Genel Bakış & Giriş Bilgileri",
    icon: Info,
    content: (
      <>
        <p>
          <strong>MaintainPro</strong>, üretim tesisleri için geliştirilmiş çok kiracılı (multi-tenant) bir
          Bakım Yönetim Sistemi&apos;dir (CMMS). Arıza yönetimi, yedek parça takibi, otonom bakım
          (TPM Pillar 1), planlı bakım ve rol bazlı panolar sunar.
        </p>

        <h4 className="font-semibold mt-4">Demo Hesap Bilgileri</h4>
        <CredentialsTable />

        <h4 className="font-semibold mt-4">Rol ve Yetki Matrisi</h4>
        <RoleTable />

        <div className="rounded-md border-l-4 border-amber-400 bg-amber-50 dark:bg-amber-950/30 p-3 mt-4">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
            ⚠ Dikkat: Her kullanıcı yalnızca kendi fabrikasına ait verileri görebilir.
            Fabrikalar arası veri izolasyonu RLS (Row Level Security) ile sağlanır.
          </p>
        </div>
      </>
    ),
  },
  {
    id: "panel",
    title: "Pano (Dashboard)",
    icon: LayoutDashboard,
    content: (
      <>
        <p>
          Pano, giriş yaptıktan sonra ilk gördüğünüz ekrandır. Role göre farklı içerik gösterir:
        </p>

        <h4 className="font-semibold">Yönetici / Mühendis Panosu</h4>
        <ul className="list-disc pl-5 space-y-1 text-sm">
          <li><strong>KPI Kartları:</strong> Açık arıza sayısı, bugünkü iş emri, ortalama MTTR, bakım uyumu (%)</li>
          <li><strong>Arıza Trend Grafiği:</strong> Son 30 günlük günlük arıza sayısı (çubuk grafik)</li>
          <li><strong>MTTR Trend:</strong> Son 30 günlük haftalık ortalama onarım süresi (çizgi grafik)</li>
          <li><strong>Arıza Pareto:</strong> En sık arıza veren 10 makine (yatay çubuk)</li>
          <li><strong>Departman Duruş:</strong> Departman bazlı toplam duruş saatleri</li>
          <li><strong>Kritik Stok Uyarıları:</strong> Minimum stok seviyesinin altındaki parçalar</li>
          <li><strong>Bakım Uyumu:</strong> Planlı bakım tamamlanma oranı (hedef: %85+)</li>
        </ul>

        <h4 className="font-semibold mt-4">Teknisyen Panosu</h4>
        <ul className="list-disc pl-5 space-y-1 text-sm">
          <li>Atanan görevler ve bugünkü kontrol listeleri</li>
          <li>Hızlı arıza bildirimi butonu</li>
          <li>Son bildirimler</li>
        </ul>

        <h4 className="font-semibold mt-4">Formüller</h4>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormulaBox
            name="MTBF (Arızalar Arası Ortalama Süre)"
            formula="MTBF = Toplam Çalışma Süresi / Arıza Sayısı"
            description="Bir makinenin iki arıza arasındaki ortalama çalışma süresi. Yüksek MTBF güvenilir makine demektir."
            example="7200 dakika çalışma / 4 arıza = 1800 dk (30 saat) MTBF"
          />
          <FormulaBox
            name="MTTR (Ortalama Onarım Süresi)"
            formula="MTTR = Toplam Onarım Süresi / Onarılan Arıza Sayısı"
            description="Arızaların ortalama çözülme süresi (bildirimden çözüme). Düşük MTTR hızlı müdahale demektir."
            example="480 dk onarım / 4 arıza = 120 dk (2 saat) MTTR"
          />
          <FormulaBox
            name="Bakım Uyumu (%)"
            formula="Uyum = (Tamamlanan İş Emri / Toplam İş Emri) × 100"
            description="Planlı bakımların zamanında tamamlanma oranı. Hedef: %85 üzeri."
            example="42 tamamlanan / 50 toplam = %84 uyum"
          />
          <FormulaBox
            name="Toplam Duruş (saat)"
            formula="Duruş = Σ (resolvedAt - reportedAt) / 60"
            description="Arıza bildirimi ile çözüm arasındaki toplam süre, dakikadan saate çevrilir."
          />
        </div>
      </>
    ),
  },
  {
    id: "makineler",
    title: "Makine Yönetimi",
    icon: Wrench,
    content: (
      <>
        <p>
          Fabrikadaki tüm makinelerin kaydını, durumunu ve bakım geçmişini yönettiğiniz modüldür.
        </p>

        <h4 className="font-semibold">Makine Durumları</h4>
        <div className="flex flex-wrap gap-2 py-2">
          <StatusBadge label="Çalışıyor (RUNNING)" color="bg-green-100 text-green-800" />
          <StatusBadge label="Bakımda (IN_MAINTENANCE)" color="bg-yellow-100 text-yellow-800" />
          <StatusBadge label="Arızalı (BROKEN)" color="bg-red-100 text-red-800" />
          <StatusBadge label="Devre Dışı (INACTIVE)" color="bg-gray-100 text-gray-700" />
        </div>

        <h4 className="font-semibold mt-4">Makine Ekleme Akışı</h4>
        <FlowChart steps={["Makineler sayfası", "+ Yeni Makine", "Form doldur", "Departman seç", "Fotoğraf yükle (opsiyonel)", "Kaydet"]} />

        <h4 className="font-semibold mt-4">Alanlar</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left font-medium border-b">Alan</th>
                <th className="px-3 py-2 text-left font-medium border-b">Zorunlu</th>
                <th className="px-3 py-2 text-left font-medium border-b">Açıklama</th>
              </tr>
            </thead>
            <tbody className="text-xs">
              <tr className="border-b"><td className="px-3 py-1.5">Kod</td><td className="px-3 py-1.5">Evet</td><td className="px-3 py-1.5">Benzersiz makine kodu (örn: CNC-01)</td></tr>
              <tr className="border-b"><td className="px-3 py-1.5">Ad</td><td className="px-3 py-1.5">Evet</td><td className="px-3 py-1.5">Makine adı</td></tr>
              <tr className="border-b"><td className="px-3 py-1.5">Departman</td><td className="px-3 py-1.5">Evet</td><td className="px-3 py-1.5">Bağlı olduğu departman</td></tr>
              <tr className="border-b"><td className="px-3 py-1.5">Konum</td><td className="px-3 py-1.5">Hayır</td><td className="px-3 py-1.5">Fiziksel konum bilgisi</td></tr>
              <tr className="border-b"><td className="px-3 py-1.5">Marka / Model</td><td className="px-3 py-1.5">Hayır</td><td className="px-3 py-1.5">Üretici ve model bilgisi</td></tr>
              <tr className="border-b"><td className="px-3 py-1.5">Seri No</td><td className="px-3 py-1.5">Hayır</td><td className="px-3 py-1.5">Seri numarası</td></tr>
              <tr className="border-b"><td className="px-3 py-1.5">Kurulum Tarihi</td><td className="px-3 py-1.5">Hayır</td><td className="px-3 py-1.5">Makinenin kurulduğu tarih</td></tr>
            </tbody>
          </table>
        </div>

        <div className="rounded-md border-l-4 border-blue-400 bg-blue-50 dark:bg-blue-950/30 p-3 mt-4">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            💡 Her makineye otomatik QR kod oluşturulur. QR taranarak makine detayına veya hızlı arıza
            bildirim formuna ulaşılabilir.
          </p>
        </div>

        <h4 className="font-semibold mt-4">Abonelik Limitleri</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left font-medium border-b">Plan</th>
                <th className="px-3 py-2 text-left font-medium border-b">Maks. Makine</th>
                <th className="px-3 py-2 text-left font-medium border-b">Maks. Kullanıcı</th>
                <th className="px-3 py-2 text-left font-medium border-b">Depolama</th>
              </tr>
            </thead>
            <tbody className="text-xs">
              <tr className="border-b"><td className="px-3 py-1.5">Starter ($99/ay)</td><td className="px-3 py-1.5">20</td><td className="px-3 py-1.5">5</td><td className="px-3 py-1.5">5 GB</td></tr>
              <tr className="border-b"><td className="px-3 py-1.5">Professional ($199/ay)</td><td className="px-3 py-1.5">50</td><td className="px-3 py-1.5">15</td><td className="px-3 py-1.5">20 GB</td></tr>
              <tr className="border-b"><td className="px-3 py-1.5">Enterprise ($399+/ay)</td><td className="px-3 py-1.5">Sınırsız</td><td className="px-3 py-1.5">Sınırsız</td><td className="px-3 py-1.5">100 GB</td></tr>
            </tbody>
          </table>
        </div>
      </>
    ),
  },
  {
    id: "arizalar",
    title: "Arıza Yönetimi",
    icon: AlertTriangle,
    content: (
      <>
        <p>
          Arıza modülü sistemin çekirdeğidir. Arıza bildirimi, atama, müdahale, çözüm ve kapatma
          süreçlerini yönetir. Her geçiş zaman çizelgesine (timeline) yazılır.
        </p>

        <h4 className="font-semibold">Arıza Durum Makinesi (State Machine)</h4>
        <div className="rounded-md border bg-muted/20 p-4 font-mono text-xs leading-6 overflow-x-auto">
          <pre>{`Açık (OPEN)
  ↓ Mühendis atar
Atandı (ASSIGNED)
  ↓ Teknisyen başlar
Müdahale Ediliyor (IN_PROGRESS)
  ↔ Parça Bekleniyor (WAITING_PARTS)  ← parça gelince geri döner
  ↓ Teknisyen çözer
Çözüldü (RESOLVED)
  ↓ Mühendis/Admin onaylar     ← veya reddeder → tekrar IN_PROGRESS
Kapatıldı (CLOSED)`}</pre>
        </div>

        <h4 className="font-semibold mt-4">Arıza Bildirimi Akışı</h4>
        <FlowChart steps={["Arıza tespit", "Arıza Bildir", "Makine seç", "Tip/Öncelik belirle", "Açıklama yaz", "Fotoğraf ekle", "Kaydet"]} />

        <h4 className="font-semibold mt-4">Arıza Tipleri</h4>
        <div className="flex flex-wrap gap-2 py-2">
          <StatusBadge label="Mekanik (MECHANICAL)" color="bg-blue-100 text-blue-800" />
          <StatusBadge label="Elektrik (ELECTRICAL)" color="bg-yellow-100 text-yellow-800" />
          <StatusBadge label="Pnömatik (PNEUMATIC)" color="bg-cyan-100 text-cyan-800" />
          <StatusBadge label="Hidrolik (HYDRAULIC)" color="bg-orange-100 text-orange-800" />
          <StatusBadge label="Yazılım (SOFTWARE)" color="bg-purple-100 text-purple-800" />
          <StatusBadge label="Diğer (OTHER)" color="bg-gray-100 text-gray-700" />
        </div>

        <h4 className="font-semibold mt-4">Öncelik Seviyeleri</h4>
        <div className="flex flex-wrap gap-2 py-2">
          <StatusBadge label="Kritik (CRITICAL)" color="bg-red-100 text-red-800" />
          <StatusBadge label="Yüksek (HIGH)" color="bg-orange-100 text-orange-800" />
          <StatusBadge label="Orta (MEDIUM)" color="bg-yellow-100 text-yellow-800" />
          <StatusBadge label="Düşük (LOW)" color="bg-green-100 text-green-800" />
        </div>

        <h4 className="font-semibold mt-4">Arıza Numaralama</h4>
        <p className="text-sm">
          Format: <code className="bg-muted px-1 rounded">ARZ-YYYY-NNNN</code> — Örnek: ARZ-2026-0001
        </p>

        <h4 className="font-semibold mt-4">Toplu İşlemler</h4>
        <ul className="list-disc pl-5 text-sm space-y-1">
          <li><strong>Toplu Kapatma:</strong> RESOLVED durumundaki arızalar seçilip toplu kapatılabilir</li>
          <li><strong>Toplu Atama:</strong> OPEN durumundaki arızalar seçilip bir mühendise toplu atanabilir</li>
        </ul>

        <h4 className="font-semibold mt-4">Escalation (Yükseltme) Kuralları</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left font-medium border-b">Süre</th>
                <th className="px-3 py-2 text-left font-medium border-b">Koşul</th>
                <th className="px-3 py-2 text-left font-medium border-b">Aksyion</th>
              </tr>
            </thead>
            <tbody className="text-xs">
              <tr className="border-b"><td className="px-3 py-1.5">30 dk</td><td className="px-3 py-1.5">OPEN kalırsa</td><td className="px-3 py-1.5">Mühendise bildirim</td></tr>
              <tr className="border-b"><td className="px-3 py-1.5">60 dk</td><td className="px-3 py-1.5">Hâlâ OPEN/ASSIGNED</td><td className="px-3 py-1.5">Fabrika yöneticisine bildirim</td></tr>
              <tr className="border-b"><td className="px-3 py-1.5">120 dk</td><td className="px-3 py-1.5">Kritik ve hâlâ açık</td><td className="px-3 py-1.5">Süper Admin&apos;e bildirim</td></tr>
            </tbody>
          </table>
        </div>
      </>
    ),
  },
  {
    id: "yedek-parca",
    title: "Yedek Parça & Stok Yönetimi",
    icon: Package,
    content: (
      <>
        <p>
          Yedek parça envanter yönetimi, stok giriş/çıkış hareketleri ve minimum stok uyarıları.
        </p>

        <h4 className="font-semibold">Stok Hareketi Tipleri</h4>
        <div className="flex flex-wrap gap-2 py-2">
          <StatusBadge label="Satın Alma (PURCHASE)" color="bg-green-100 text-green-800" />
          <StatusBadge label="Arıza Çıkışı (BREAKDOWN_USAGE)" color="bg-red-100 text-red-800" />
          <StatusBadge label="Bakım Çıkışı (MAINTENANCE_USAGE)" color="bg-blue-100 text-blue-800" />
          <StatusBadge label="İade (RETURN)" color="bg-yellow-100 text-yellow-800" />
          <StatusBadge label="Fire (SCRAP)" color="bg-gray-100 text-gray-700" />
          <StatusBadge label="Sayım Düzeltme (ADJUSTMENT)" color="bg-purple-100 text-purple-800" />
        </div>

        <h4 className="font-semibold mt-4">Stok Giriş/Çıkış Akışı</h4>
        <FlowChart steps={["Parça seç", "Hareket tipi seç", "Miktar gir", "Makine seç (opsiyonel)", "Kaydet", "Stok güncellenir"]} />

        <h4 className="font-semibold mt-4">Minimum Stok Uyarısı</h4>
        <div className="rounded-md border-l-4 border-red-400 bg-red-50 dark:bg-red-950/30 p-3">
          <p className="text-sm text-red-800 dark:text-red-200">
            ⚠ Bir parçanın mevcut stoğu, tanımlanan <code>minStock</code> seviyesinin altına düştüğünde
            dashboard&apos;da &quot;Kritik Stok Uyarıları&quot; kartında görüntülenir ve bildirim gönderilir.
          </p>
        </div>

        <h4 className="font-semibold mt-4">Stok Maliyet Formülü</h4>
        <FormulaBox
          name="Toplam Stok Değeri"
          formula="Değer = Σ (currentStock × unitPrice)"
          description="Tüm parçaların mevcut stok miktarı × birim fiyatı toplamı."
          example="14 adet × ₺185 = ₺2.590 (Rulman 6205)"
        />

        <h4 className="font-semibold mt-4">Dışa Aktarma</h4>
        <ul className="list-disc pl-5 text-sm space-y-1">
          <li><strong>PDF:</strong> Parça listesi ve stok durumu tablosu (jsPDF + autoTable)</li>
          <li><strong>CSV:</strong> Excel uyumlu UTF-8 BOM dosyası</li>
        </ul>
      </>
    ),
  },
  {
    id: "otonom-bakim",
    title: "Otonom Bakım (TPM Pillar 1 / Jishu Hozen)",
    icon: ClipboardCheck,
    content: (
      <>
        <p>
          Operatörlerin günlük/haftalık kontrol listeleri ile makineleri denetlemesi ve anormallikleri
          raporlaması sistemidir. TPM (Total Productive Maintenance) Pillar 1 uygulamasıdır.
        </p>

        <h4 className="font-semibold">Kontrol Listesi Akışı</h4>
        <FlowChart steps={["Şablon oluştur", "Periyot belirle", "Kayıt zamanlanır", "Teknisyen başlatır", "Maddeleri kontrol eder", "Anormal ise aksiyon açılır", "Tamamla"]} />

        <h4 className="font-semibold mt-4">Kontrol Maddesi Tipleri</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left font-medium border-b">Tip</th>
                <th className="px-3 py-2 text-left font-medium border-b">Açıklama</th>
                <th className="px-3 py-2 text-left font-medium border-b">Örnek</th>
              </tr>
            </thead>
            <tbody className="text-xs">
              <tr className="border-b"><td className="px-3 py-1.5">OK_NOT_OK</td><td className="px-3 py-1.5">Normal / Anormal seçimi</td><td className="px-3 py-1.5">Motor sesi normal mi?</td></tr>
              <tr className="border-b"><td className="px-3 py-1.5">NUMERIC</td><td className="px-3 py-1.5">Sayısal değer girişi (min/max aralık)</td><td className="px-3 py-1.5">Sıcaklık: 60-80°C</td></tr>
              <tr className="border-b"><td className="px-3 py-1.5">TEXT</td><td className="px-3 py-1.5">Serbest metin notu</td><td className="px-3 py-1.5">Gözlemlerinizi yazın</td></tr>
              <tr className="border-b"><td className="px-3 py-1.5">PHOTO</td><td className="px-3 py-1.5">Fotoğraf yükleme gerektiren kontrol</td><td className="px-3 py-1.5">Kaçak durumu fotoğrafı</td></tr>
            </tbody>
          </table>
        </div>

        <h4 className="font-semibold mt-4">Periyotlar</h4>
        <div className="flex flex-wrap gap-2 py-2">
          <StatusBadge label="Günlük (DAILY)" color="bg-blue-100 text-blue-800" />
          <StatusBadge label="Haftalık (WEEKLY)" color="bg-green-100 text-green-800" />
          <StatusBadge label="Aylık (MONTHLY)" color="bg-purple-100 text-purple-800" />
        </div>

        <h4 className="font-semibold mt-4">Otomatik Aksiyon Oluşturma</h4>
        <div className="rounded-md border-l-4 border-purple-400 bg-purple-50 dark:bg-purple-950/30 p-3">
          <p className="text-sm text-purple-800 dark:text-purple-200">
            🔄 Bir kontrol maddesi &quot;Anormal&quot; veya aralık dışı işaretlendiğinde sistem otomatik
            olarak bir <strong>Aksiyon</strong> kaydı oluşturur. Aksiyon kodu formatı:{" "}
            <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">OB-AKS-YYYY-NNNN</code>
          </p>
        </div>

        <h4 className="font-semibold mt-4">Aksiyon Durum Makinesi</h4>
        <div className="rounded-md border bg-muted/20 p-4 font-mono text-xs leading-6">
          <pre>{`Açık (OPEN)
  ↓ Mühendis atar ve başlatır
Devam Ediyor (IN_PROGRESS)
  ↓ Teknisyen tamamlar
Tamamlandı (COMPLETED)
  ↓ Mühendis/Admin doğrular
Doğrulandı (VERIFIED)`}</pre>
        </div>
      </>
    ),
  },
  {
    id: "planli-bakim",
    title: "Planlı Bakım & İş Emirleri",
    icon: Calendar,
    content: (
      <>
        <p>
          Periyodik bakım planları oluşturun ve iş emirleriyle takip edin. Zaman bazlı veya
          sayaç bazlı tetikleyiciler desteklenir.
        </p>

        <h4 className="font-semibold">Planlı Bakım Akışı</h4>
        <FlowChart steps={["PM Planı oluştur", "Makine + periyot seç", "Görev listesi tanımla", "İş emri zamanlanır", "Teknisyen atar", "Bakım yapılır", "Tamamla"]} />

        <h4 className="font-semibold mt-4">Tetikleyici Tipleri</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left font-medium border-b">Tip</th>
                <th className="px-3 py-2 text-left font-medium border-b">Açıklama</th>
                <th className="px-3 py-2 text-left font-medium border-b">Örnek</th>
              </tr>
            </thead>
            <tbody className="text-xs">
              <tr className="border-b"><td className="px-3 py-1.5">TIME_BASED</td><td className="px-3 py-1.5">Belirli gün aralıklarında</td><td className="px-3 py-1.5">Her 30 günde bir yağlama</td></tr>
              <tr className="border-b"><td className="px-3 py-1.5">METER_BASED</td><td className="px-3 py-1.5">Sayaç değerine göre</td><td className="px-3 py-1.5">Her 1000 saatte filtre değişimi</td></tr>
              <tr className="border-b"><td className="px-3 py-1.5">CONDITION_BASED</td><td className="px-3 py-1.5">Durum izleme sonuçlarına göre</td><td className="px-3 py-1.5">Titreşim eşiği aşıldığında</td></tr>
            </tbody>
          </table>
        </div>

        <h4 className="font-semibold mt-4">İş Emri Durumları</h4>
        <div className="flex flex-wrap gap-2 py-2">
          <StatusBadge label="Planlandı (PLANNED)" color="bg-blue-100 text-blue-800" />
          <StatusBadge label="Devam Ediyor (IN_PROGRESS)" color="bg-yellow-100 text-yellow-800" />
          <StatusBadge label="Tamamlandı (COMPLETED)" color="bg-green-100 text-green-800" />
          <StatusBadge label="İptal (CANCELLED)" color="bg-red-100 text-red-800" />
          <StatusBadge label="Gecikmiş (OVERDUE)" color="bg-orange-100 text-orange-800" />
        </div>

        <h4 className="font-semibold mt-4">Bakım Uyumu Formülü</h4>
        <FormulaBox
          name="Bakım Uyum Oranı"
          formula="Uyum % = (COMPLETED iş emri / (COMPLETED + OVERDUE + CANCELLED)) × 100"
          description="Planlanan bakımların ne kadarının başarıyla tamamlandığını ölçer. %85 üzeri hedeflenir."
        />

        <h4 className="font-semibold mt-4">Otomatik İş Emri Zamanlaması</h4>
        <div className="rounded-md border-l-4 border-green-400 bg-green-50 dark:bg-green-950/30 p-3">
          <p className="text-sm text-green-800 dark:text-green-200">
            🕐 Sistem, aktif PM planlarının <code>nextDueAt</code> tarihini kontrol eder.
            Zamanı gelen planlar için otomatik iş emri oluşturulur ve ilgili teknisyene atanır.
          </p>
        </div>
      </>
    ),
  },
  {
    id: "raporlar",
    title: "Raporlar & Dışa Aktarma",
    icon: BarChart2,
    content: (
      <>
        <p>
          Kapsamlı raporlama modülü: arıza istatistikleri, MTBF/MTTR analizi, Pareto grafikleri,
          maliyet raporları ve dışa aktarma seçenekleri.
        </p>

        <h4 className="font-semibold">Rapor Türleri</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left font-medium border-b">Rapor</th>
                <th className="px-3 py-2 text-left font-medium border-b">İçerik</th>
                <th className="px-3 py-2 text-left font-medium border-b">Grafikler</th>
              </tr>
            </thead>
            <tbody className="text-xs">
              <tr className="border-b"><td className="px-3 py-1.5">Arıza Özet</td><td className="px-3 py-1.5">Toplam arıza, durum dağılımı, trend</td><td className="px-3 py-1.5">Çubuk + Pasta</td></tr>
              <tr className="border-b"><td className="px-3 py-1.5">MTBF/MTTR</td><td className="px-3 py-1.5">Makine bazlı güvenilirlik analizi</td><td className="px-3 py-1.5">Çizgi grafik</td></tr>
              <tr className="border-b"><td className="px-3 py-1.5">Pareto</td><td className="px-3 py-1.5">En sık arıza veren makineler</td><td className="px-3 py-1.5">Yatay çubuk</td></tr>
              <tr className="border-b"><td className="px-3 py-1.5">Maliyet</td><td className="px-3 py-1.5">Arıza başına kullanılan yedek parça maliyeti</td><td className="px-3 py-1.5">Tablo</td></tr>
              <tr className="border-b"><td className="px-3 py-1.5">Bakım Uyumu</td><td className="px-3 py-1.5">Planlı bakım tamamlanma oranı</td><td className="px-3 py-1.5">Gauge + Tablo</td></tr>
            </tbody>
          </table>
        </div>

        <h4 className="font-semibold mt-4">Dışa Aktarma Formatları</h4>
        <ul className="list-disc pl-5 text-sm space-y-1">
          <li><strong>PDF:</strong> jsPDF + autoTable kullanılarak oluşturulur. Grafikler ve tablolar dahildir.</li>
          <li><strong>CSV:</strong> Excel uyumlu UTF-8 BOM formatı. Türkçe karakterler sorunsuz açılır.</li>
        </ul>

        <h4 className="font-semibold mt-4">Tüm Formüller</h4>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormulaBox
            name="MTBF"
            formula="MTBF = Toplam Çalışma Süresi / Arıza Sayısı"
            description="Arızalar arası ortalama süre (saat). Yüksek = güvenilir."
          />
          <FormulaBox
            name="MTTR"
            formula="MTTR = Σ(resolvedAt - reportedAt) / Çözülen Arıza Sayısı"
            description="Ortalama onarım süresi (saat). Düşük = hızlı müdahale."
          />
          <FormulaBox
            name="Kullanılabilirlik"
            formula="A = MTBF / (MTBF + MTTR) × 100"
            description="Makinenin çalışabilir durumda olma yüzdesi."
            example="MTBF=30sa, MTTR=2sa → A = 30/32 = %93.75"
          />
          <FormulaBox
            name="Arıza Yoğunluğu"
            formula="λ = Arıza Sayısı / Toplam Makine / Gün Sayısı"
            description="Birim makine başına günlük arıza oranı."
          />
        </div>
      </>
    ),
  },
  {
    id: "bildirimler",
    title: "Bildirimler & Uyarılar",
    icon: Bell,
    content: (
      <>
        <p>
          Çok kanallı bildirim sistemi: uygulama içi (SSE), e-posta (SES/SMTP) ve push (FCM).
          Kullanıcı tercihlerine göre filtrelenir.
        </p>

        <h4 className="font-semibold">Bildirim Kanalları</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left font-medium border-b">Kanal</th>
                <th className="px-3 py-2 text-left font-medium border-b">Teknoloji</th>
                <th className="px-3 py-2 text-left font-medium border-b">Durum</th>
              </tr>
            </thead>
            <tbody className="text-xs">
              <tr className="border-b"><td className="px-3 py-1.5">Uygulama İçi</td><td className="px-3 py-1.5">Server-Sent Events (SSE)</td><td className="px-3 py-1.5">✅ Aktif</td></tr>
              <tr className="border-b"><td className="px-3 py-1.5">E-posta</td><td className="px-3 py-1.5">Nodemailer (SMTP/SES)</td><td className="px-3 py-1.5">✅ Aktif (SMTP ayarı gerekir)</td></tr>
              <tr className="border-b"><td className="px-3 py-1.5">Push Bildirimi</td><td className="px-3 py-1.5">Firebase Cloud Messaging</td><td className="px-3 py-1.5">✅ Aktif (FCM ayarı gerekir)</td></tr>
              <tr className="border-b"><td className="px-3 py-1.5">SMS</td><td className="px-3 py-1.5">Twilio (opsiyonel)</td><td className="px-3 py-1.5">⏳ v2 için planlandı</td></tr>
            </tbody>
          </table>
        </div>

        <h4 className="font-semibold mt-4">Bildirim Olayları</h4>
        <ul className="list-disc pl-5 text-sm space-y-1">
          <li><strong>breakdown_created:</strong> Yeni arıza bildirildiğinde</li>
          <li><strong>breakdown_assigned:</strong> Arıza atandığında</li>
          <li><strong>breakdown_resolved:</strong> Arıza çözüldüğünde</li>
          <li><strong>breakdown_escalated:</strong> Arıza yükseltildiğinde</li>
          <li><strong>stock_low:</strong> Stok minimum seviyenin altına düştüğünde</li>
          <li><strong>pm_due:</strong> Planlı bakım zamanı geldiğinde</li>
          <li><strong>checklist_missed:</strong> Kontrol listesi atlandığında</li>
          <li><strong>action_created:</strong> Otomatik aksiyon oluştuğunda</li>
        </ul>

        <h4 className="font-semibold mt-4">Bildirim Tercihleri</h4>
        <p className="text-sm">
          Her kullanıcı <strong>Bildirimler → Tercihler</strong> sayfasından hangi olaylar için
          hangi kanallardan bildirim almak istediğini ayarlayabilir. Sessiz saatler (quiet hours)
          ve departman filtreleri de desteklenir.
        </p>
      </>
    ),
  },
  {
    id: "kullanicilar",
    title: "Kullanıcı Yönetimi",
    icon: Users,
    content: (
      <>
        <p>
          Fabrika yöneticileri kullanıcı ekleme, rol atama ve departman bağlama işlemlerini yapar.
        </p>

        <h4 className="font-semibold">Kullanıcı Ekleme Akışı</h4>
        <FlowChart steps={["Kullanıcılar sayfası", "+ Yeni Kullanıcı", "Ad/E-posta gir", "Rol seç", "Departman seç", "Kaydet"]} />

        <h4 className="font-semibold mt-4">Abonelik Kullanıcı Limiti</h4>
        <div className="rounded-md border-l-4 border-amber-400 bg-amber-50 dark:bg-amber-950/30 p-3">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            ⚠ Kullanıcı ekleme, abonelik planındaki kullanıcı limitine tabidir.
            Limit aşıldığında kullanıcı ekleme devre dışı bırakılır.
          </p>
        </div>

        <h4 className="font-semibold mt-4">Şifre Politikası</h4>
        <ul className="list-disc pl-5 text-sm space-y-1">
          <li>Minimum 8 karakter</li>
          <li>En az 1 büyük harf, 1 küçük harf, 1 rakam</li>
          <li>Özel karakter önerilir</li>
          <li>Şifreler bcrypt ile hash&apos;lenerek saklanır</li>
        </ul>
      </>
    ),
  },
  {
    id: "denetim",
    title: "Denetim Kayıtları (Audit Log)",
    icon: ScrollText,
    content: (
      <>
        <p>
          Fabrika kapsamındaki tüm önemli işlemlerin değişmez (immutable) tarihçesidir.
          Yalnızca Fabrika Yöneticisi tarafından görüntülenebilir.
        </p>

        <h4 className="font-semibold">Kaydedilen İşlemler</h4>
        <div className="flex flex-wrap gap-2 py-2">
          <StatusBadge label="Oluşturma (CREATE)" color="bg-green-100 text-green-800" />
          <StatusBadge label="Güncelleme (UPDATE)" color="bg-blue-100 text-blue-800" />
          <StatusBadge label="Silme (DELETE)" color="bg-red-100 text-red-800" />
          <StatusBadge label="Durum Değişimi (TRANSITION)" color="bg-purple-100 text-purple-800" />
          <StatusBadge label="Giriş (LOGIN)" color="bg-gray-100 text-gray-700" />
          <StatusBadge label="Dışa Aktarma (EXPORT)" color="bg-orange-100 text-orange-800" />
        </div>

        <h4 className="font-semibold mt-4">Kayıt Detayları</h4>
        <ul className="list-disc pl-5 text-sm space-y-1">
          <li><strong>Kullanıcı:</strong> İşlemi yapan kişi</li>
          <li><strong>Tarih/Saat:</strong> İşlem zamanı</li>
          <li><strong>Kayıt Tipi:</strong> Etkilenen tablo (makine, arıza, yedek parça vb.)</li>
          <li><strong>Değişiklikler:</strong> UPDATE işlemlerinde eski → yeni değerler diff olarak saklanır</li>
          <li><strong>Metadata:</strong> LOGIN için IP adresi, EXPORT için dosya türü vb.</li>
        </ul>

        <h4 className="font-semibold mt-4">Filtreleme</h4>
        <p className="text-sm">
          Tarih aralığı, işlem tipi, kayıt tipi ve kullanıcıya göre filtreleme desteklenir.
          Sayfalama ile büyük veri setlerinde performanslı görüntüleme.
        </p>
      </>
    ),
  },
  {
    id: "super-admin",
    title: "Süper Admin & Abonelik Yönetimi",
    icon: Shield,
    content: (
      <>
        <p>
          Platform seviyesinde yönetim paneli. Fabrika oluşturma, abonelik planları ve
          sistem genelindeki istatistikler.
        </p>

        <h4 className="font-semibold">Fabrika Yönetimi Akışı</h4>
        <FlowChart steps={["Süper Admin Paneli", "Yeni Fabrika", "Bilgileri gir", "Abonelik planı seç", "Admin kullanıcı ata", "Kaydet"]} />

        <h4 className="font-semibold mt-4">Abonelik Planları</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left font-medium border-b">Plan</th>
                <th className="px-3 py-2 text-left font-medium border-b">Aylık</th>
                <th className="px-3 py-2 text-left font-medium border-b">Kullanıcı</th>
                <th className="px-3 py-2 text-left font-medium border-b">Makine</th>
                <th className="px-3 py-2 text-left font-medium border-b">Depolama</th>
                <th className="px-3 py-2 text-left font-medium border-b">Özellikler</th>
              </tr>
            </thead>
            <tbody className="text-xs">
              <tr className="border-b">
                <td className="px-3 py-1.5 font-medium">Starter</td>
                <td className="px-3 py-1.5">$99</td>
                <td className="px-3 py-1.5">5</td>
                <td className="px-3 py-1.5">20</td>
                <td className="px-3 py-1.5">5 GB</td>
                <td className="px-3 py-1.5">Temel CMMS</td>
              </tr>
              <tr className="border-b">
                <td className="px-3 py-1.5 font-medium">Professional</td>
                <td className="px-3 py-1.5">$199</td>
                <td className="px-3 py-1.5">15</td>
                <td className="px-3 py-1.5">50</td>
                <td className="px-3 py-1.5">20 GB</td>
                <td className="px-3 py-1.5">+ Raporlama, API erişimi</td>
              </tr>
              <tr className="border-b">
                <td className="px-3 py-1.5 font-medium">Enterprise</td>
                <td className="px-3 py-1.5">$399+</td>
                <td className="px-3 py-1.5">Sınırsız</td>
                <td className="px-3 py-1.5">Sınırsız</td>
                <td className="px-3 py-1.5">100 GB</td>
                <td className="px-3 py-1.5">+ SSO, özel entegrasyon</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h4 className="font-semibold mt-4">Limit Kontrolü</h4>
        <div className="rounded-md border-l-4 border-blue-400 bg-blue-50 dark:bg-blue-950/30 p-3">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            💡 Kullanıcı veya makine ekleme sırasında <code>checkSubscriptionLimit</code> servisi
            otomatik olarak mevcut sayıyı kontrol eder. Limit aşımında işlem engellenir.
          </p>
        </div>
      </>
    ),
  },
  {
    id: "entegrasyon",
    title: "Entegrasyonlar & Teknik Altyapı",
    icon: Zap,
    content: (
      <>
        <p>Sistemin kullandığı teknik bileşenler ve entegrasyon noktaları.</p>

        <h4 className="font-semibold">Teknoloji Stack</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left font-medium border-b">Katman</th>
                <th className="px-3 py-2 text-left font-medium border-b">Teknoloji</th>
              </tr>
            </thead>
            <tbody className="text-xs">
              <tr className="border-b"><td className="px-3 py-1.5">Frontend</td><td className="px-3 py-1.5">Next.js 14 (App Router) + TypeScript + Tailwind CSS + shadcn/ui + Radix</td></tr>
              <tr className="border-b"><td className="px-3 py-1.5">State Yönetimi</td><td className="px-3 py-1.5">Zustand (client) + TanStack Query (server cache)</td></tr>
              <tr className="border-b"><td className="px-3 py-1.5">Backend</td><td className="px-3 py-1.5">Next.js API Routes (monorepo)</td></tr>
              <tr className="border-b"><td className="px-3 py-1.5">ORM / DB</td><td className="px-3 py-1.5">Prisma → PostgreSQL (AWS RDS)</td></tr>
              <tr className="border-b"><td className="px-3 py-1.5">Auth</td><td className="px-3 py-1.5">NextAuth.js v5 (JWT session)</td></tr>
              <tr className="border-b"><td className="px-3 py-1.5">Dosya Depolama</td><td className="px-3 py-1.5">Local (dev) / S3 presigned URLs (prod)</td></tr>
              <tr className="border-b"><td className="px-3 py-1.5">Bildirimler</td><td className="px-3 py-1.5">SSE + Nodemailer + FCM</td></tr>
              <tr className="border-b"><td className="px-3 py-1.5">Grafikler</td><td className="px-3 py-1.5">Recharts</td></tr>
              <tr className="border-b"><td className="px-3 py-1.5">PDF</td><td className="px-3 py-1.5">jsPDF + autoTable</td></tr>
              <tr className="border-b"><td className="px-3 py-1.5">Validasyon</td><td className="px-3 py-1.5">Zod (tüm API sınırlarında)</td></tr>
              <tr className="border-b"><td className="px-3 py-1.5">Test</td><td className="px-3 py-1.5">Vitest (207 unit test)</td></tr>
              <tr className="border-b"><td className="px-3 py-1.5">Hosting</td><td className="px-3 py-1.5">AWS App Runner (MVP) → ECS Fargate</td></tr>
            </tbody>
          </table>
        </div>

        <h4 className="font-semibold mt-4">Multi-Tenant Mimari</h4>
        <div className="rounded-md border bg-muted/20 p-4 font-mono text-xs leading-6">
          <pre>{`İstek → NextAuth Session → factory_id çıkar
  ↓
Prisma Middleware → her sorguya factory_id enjekte eder
  ↓
PostgreSQL RLS → veritabanı seviyesinde izolasyon
  ↓
Sonuç: Kullanıcı yalnızca kendi fabrikasını görür`}</pre>
        </div>

        <h4 className="font-semibold mt-4">Event Bus (Olay Yolu)</h4>
        <div className="rounded-md border bg-muted/20 p-4 font-mono text-xs leading-6">
          <pre>{`Arıza oluşturuldu
  → InMemoryBus.emit("breakdown_created", payload)
    → NotificationHandler → Bildirim oluştur
    → EmailService → E-posta gönder (opsiyonel)
    → FCMService → Push bildirim (opsiyonel)
    → SSE → Açık tarayıcılara anlık bildirim`}</pre>
        </div>

        <h4 className="font-semibold mt-4">Zamanlanmış Görevler (Cron)</h4>
        <ul className="list-disc pl-5 text-sm space-y-1">
          <li><strong>Escalation:</strong> Her 5 dk — açık arızaları kontrol eder, süre aşımında yükseltir</li>
          <li><strong>PM Due:</strong> Her 1 saat — zamanı gelen bakım planları için iş emri oluşturur</li>
          <li><strong>Missed Checklist:</strong> Her gün 23:00 — tamamlanmamış kontrol listelerini MISSED yapar</li>
        </ul>

        <h4 className="font-semibold mt-4">Ortam Değişkenleri (.env)</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left font-medium border-b">Değişken</th>
                <th className="px-3 py-2 text-left font-medium border-b">Açıklama</th>
              </tr>
            </thead>
            <tbody className="text-xs">
              <tr className="border-b"><td className="px-3 py-1.5 font-mono">DATABASE_URL</td><td className="px-3 py-1.5">PostgreSQL bağlantı dizesi</td></tr>
              <tr className="border-b"><td className="px-3 py-1.5 font-mono">NEXTAUTH_SECRET</td><td className="px-3 py-1.5">JWT imzalama anahtarı</td></tr>
              <tr className="border-b"><td className="px-3 py-1.5 font-mono">NEXTAUTH_URL</td><td className="px-3 py-1.5">Uygulama URL&apos;si</td></tr>
              <tr className="border-b"><td className="px-3 py-1.5 font-mono">USE_S3</td><td className="px-3 py-1.5">true ise S3, false ise local depolama</td></tr>
              <tr className="border-b"><td className="px-3 py-1.5 font-mono">SMTP_HOST/PORT/USER/PASS</td><td className="px-3 py-1.5">E-posta gönderimi için SMTP ayarları</td></tr>
              <tr className="border-b"><td className="px-3 py-1.5 font-mono">FCM_PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY</td><td className="px-3 py-1.5">Firebase push bildirimleri</td></tr>
            </tbody>
          </table>
        </div>
      </>
    ),
  },
  {
    id: "kisayollar",
    title: "Klavye Kısayolları & Karanlık Mod",
    icon: Key,
    content: (
      <>
        <h4 className="font-semibold">Klavye Kısayolları</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left font-medium border-b">Kısayol</th>
                <th className="px-3 py-2 text-left font-medium border-b">İşlev</th>
              </tr>
            </thead>
            <tbody className="text-xs">
              <tr className="border-b"><td className="px-3 py-1.5 font-mono">Ctrl + K</td><td className="px-3 py-1.5">Komut paleti (arama ve hızlı navigasyon)</td></tr>
              <tr className="border-b"><td className="px-3 py-1.5 font-mono">Ctrl + /</td><td className="px-3 py-1.5">Kısayol yardım paneli</td></tr>
              <tr className="border-b"><td className="px-3 py-1.5 font-mono">G → D</td><td className="px-3 py-1.5">Dashboard&apos;a git</td></tr>
              <tr className="border-b"><td className="px-3 py-1.5 font-mono">G → M</td><td className="px-3 py-1.5">Makinelere git</td></tr>
              <tr className="border-b"><td className="px-3 py-1.5 font-mono">G → A</td><td className="px-3 py-1.5">Arızalara git</td></tr>
              <tr className="border-b"><td className="px-3 py-1.5 font-mono">G → P</td><td className="px-3 py-1.5">Yedek parçalara git</td></tr>
              <tr className="border-b"><td className="px-3 py-1.5 font-mono">N</td><td className="px-3 py-1.5">Yeni arıza bildirimi</td></tr>
              <tr className="border-b"><td className="px-3 py-1.5 font-mono">Escape</td><td className="px-3 py-1.5">Modalı kapat</td></tr>
            </tbody>
          </table>
        </div>

        <h4 className="font-semibold mt-4">Karanlık Mod</h4>
        <p className="text-sm">
          Üst menüdeki ay/güneş ikonuna tıklayarak karanlık mod arasında geçiş yapabilirsiniz.
          Tercih <code>localStorage</code>&apos;da saklanır ve sayfa yenilendiğinde korunur.
          Tailwind CSS <code>darkMode: &quot;class&quot;</code> stratejisi kullanılır.
        </p>

        <h4 className="font-semibold mt-4">Komut Paleti</h4>
        <p className="text-sm">
          <code>Ctrl + K</code> ile açılan komut paleti fuzzy search ile tüm sayfalara ve
          sık kullanılan işlemlere hızlı erişim sağlar. Arama alanına Türkçe veya İngilizce
          yazabilirsiniz.
        </p>
      </>
    ),
  },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function KilavuzPage() {
  const [activeSection, setActiveSection] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Kullanım Kılavuzu</h1>
        <p className="text-muted-foreground text-sm mt-1">
          MaintainPro CMMS — tüm modüllerin kullanım rehberi, akış şemaları, formüller ve entegrasyonlar
        </p>
      </div>

      {/* Quick navigation */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Hızlı Erişim</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {sections.map((s) => {
              const Icon = s.icon;
              return (
                <button
                  key={s.id}
                  onClick={() => {
                    setActiveSection(activeSection === s.id ? null : s.id);
                    document.getElementById(`section-${s.id}`)?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                    activeSection === s.id
                      ? "bg-primary text-primary-foreground border-primary"
                      : "hover:bg-muted/60",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {s.title.split(" ")[0]}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Sections */}
      <div className="space-y-3">
        {sections.map((s) => (
          <div key={s.id} id={`section-${s.id}`}>
            <Accordion title={s.title} icon={s.icon} defaultOpen={s.id === "genel"}>
              {s.content}
            </Accordion>
          </div>
        ))}
      </div>
    </div>
  );
}
