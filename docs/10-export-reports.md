# Export & Raporlar Modülü

## Amaç

Yöneticilerin arıza, stok, bakım performansı ve checklist uyum verilerini filtreleyerek ekranda incelemesine ve CSV / PDF formatında indirmesine olanak tanır.

---

## Dosyalar

| Dosya | Açıklama |
|---|---|
| `src/lib/utils/export.ts` | `exportToCSV` ve `exportToPDF` yardımcı fonksiyonları |
| `src/app/(app)/raporlar/page.tsx` | 4 sekmeli raporlar sayfası |

---

## `exportToCSV`

```ts
exportToCSV(
  data: Record<string, unknown>[],
  filename: string,
  columns: { key: string; header: string }[]
): void
```

### Parametreler

| Parametre | Tip | Açıklama |
|---|---|---|
| `data` | `Record<string, unknown>[]` | Satır nesnelerinin listesi |
| `filename` | `string` | İndirilecek dosya adı (`.csv` uzantısı otomatik eklenir) |
| `columns` | `ExportColumn[]` | Hangi alanların hangi başlıkla yazılacağı |

### Özellikler

- Sütun ayracı olarak `;` (noktalı virgül) kullanır — Excel Türkçe bölge ayarıyla doğrudan açılır.
- UTF-8 BOM (`\uFEFF`) eklenerek Türkçe karakter sorunları giderilir.
- `null` / `undefined` değerler boş string olarak yazılır.

### Kullanım Örneği

```ts
exportToCSV(
  parts.map(p => ({ code: p.code, name: p.name, stock: p.currentStock })),
  "yedek-parcalar",
  [
    { key: "code", header: "Parça Kodu" },
    { key: "name", header: "Parça Adı" },
    { key: "stock", header: "Stok" },
  ]
);
```

---

## `exportToPDF`

```ts
exportToPDF(config: PdfExportConfig): Promise<void>
```

### `PdfExportConfig`

| Alan | Tip | Açıklama |
|---|---|---|
| `title` | `string` | Rapor başlığı (ör. "Arıza Raporu") |
| `subtitle` | `string?` | Alt başlık |
| `dateRange` | `string?` | Tarih aralığı etiketi (ör. "01.04.2026 – 13.04.2026") |
| `columns` | `ExportColumn[]` | Sütun tanımları (`width` pt cinsinden isteğe bağlı) |
| `data` | `Record<string, unknown>[]` | Tablo satırları |
| `filename` | `string` | İndirilecek dosya adı (`.pdf` uzantısı otomatik eklenir) |

### Özellikler

- A4 Yatay (landscape) sayfa formatı.
- Başlıkta: "MaintainPro" marka metni, rapor başlığı, oluşturulma zamanı.
- Tabloda: mavi başlık satırı, alternatif satır renklendirme.
- Alt bilgide: "Sayfa X / Y" ve "MaintainPro — Gizli".
- jsPDF ve jspdf-autotable dinamik olarak import edilir (SSR uyumlu).

### Kullanım Örneği

```ts
await exportToPDF({
  title: "Arıza Raporu",
  subtitle: "Mekanik arızalar",
  dateRange: "01.04.2026 – 13.04.2026",
  columns: [
    { key: "code", header: "Arıza No", width: 80 },
    { key: "machineName", header: "Makine" },
    { key: "status", header: "Durum", width: 70 },
  ],
  data: rows,
  filename: "ariza-raporu",
});
```

---

## Raporlar Sayfası (`/raporlar`)

Dört sekme içerir:

### Sekme 1: Arıza Raporu

- Tarih aralığı: Son 7 / 30 / 90 gün
- Filtreler: Durum, Öncelik
- KPI: Toplam arıza, Ort. çözüm süresi, En çok arıza yapan makine
- Veri: `GET /api/breakdowns`
- Export: CSV + PDF

### Sekme 2: Stok Raporu

- Mevcut stok seviyeleri
- Kritik stok uyarıları (kırmızı tablo)
- Maliyet özeti (önceki dönem karşılaştırması)
- Veri: `GET /api/spare-parts`, `GET /api/spare-parts/alerts`, `GET /api/dashboard/costs`
- Export: CSV + PDF

### Sekme 3: Bakım Performansı

- MTTR trendi (günlük çizgi grafik)
- MTBF trendi (haftalık çizgi grafik)
- Arıza Pareto (yatay bar, ilk 10 makine)
- Departman duruş saati (bar grafik)
- Tarih aralığı: Son 7 / 30 / 90 gün
- Veri: `/api/dashboard/mttr`, `/api/dashboard/mtbf`, `/api/dashboard/pareto`, `/api/dashboard/department-downtime`
- Export: CSV (departman duruş) + PDF (pareto tablosu)

### Sekme 4: Checklist Uyum

- Tamamlanma oranı, kaçırılan kontrol sayısı, uyum yüzdesi
- Anormal kalemlerden oluşan aksiyonlar tablosu
- Kontrol listesi kayıtları tablosu
- Veri: `GET /api/checklists/records`, `GET /api/actions`
- Export: CSV + PDF

---

## CSV İndir Butonları — Liste Sayfaları

| Sayfa | Dosya |
|---|---|
| Yedek Parçalar | `src/app/(app)/parcalar/page.tsx` |
| Arızalar | `src/app/(app)/arizalar/page.tsx` |
| Makineler | `src/app/(app)/makineler/page.tsx` |

Her sayfada "CSV İndir" butonu başlık satırına eklenmiştir. Buton, o an aktif filtreyle görüntülenen `filtered` dizisini export eder. Veri yoksa (0 satır) buton devre dışı kalır.

---

## Edge Cases

- `jspdf` / `jspdf-autotable` tarayıcıya özgüdür; `exportToPDF` dinamik import kullanır ve sunucu tarafında çalışmaz.
- `exportToCSV` senkrondur ve `document` nesnesine ihtiyaç duyar — yalnızca `"use client"` bileşenlerinden çağrın.
- `BreakdownListItem` tipinde `resolvedAt` bulunmaz; çözüm süresi `downtimeMinutes` alanından okunur.
- Türkçe karakterler (ş, ğ, ü, ö, ç, İ) Helvetica fontuyla çoğu PDF okuyucuda düzgün görünür. Eksik glyph olması durumunda unicode replacement (`?`) oluşabilir — bu jsPDF'in standart font kısıtlamasıdır.
