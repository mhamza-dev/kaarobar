/** Client-side table export: PDF, XLS, Print (spreadsheet layout). */

export type ExportColumn = { key: string; header: string };

export type ExportRow = Record<string, string | number | null | undefined>;

const BRAND_PRODUCT = "Kaarobar";
const BRAND_COMPANY = "2ndHub Solutions";
const BRAND_TAGLINE = `A product of ${BRAND_COMPANY}`;
const BRAND_LOGO_PATH = "/brand/kaarobar-icon.png";

function cellValue(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  return String(v);
}

function rowsToMatrix(
  columns: ExportColumn[],
  rows: ExportRow[]
): string[][] {
  const header = columns.map((c) => c.header);
  const body = rows.map((row) => columns.map((c) => cellValue(row[c.key])));
  return [header, ...body];
}

async function loadBrandLogoDataUrl(): Promise<string | null> {
  try {
    const res = await fetch(BRAND_LOGO_PATH);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function exportTableXls(
  filename: string,
  columns: ExportColumn[],
  rows: ExportRow[]
): Promise<void> {
  const XLSX = await import("xlsx");
  const blank = columns.map(() => "");
  const matrix = [
    [BRAND_PRODUCT, ...blank.slice(1)],
    [BRAND_TAGLINE, ...blank.slice(1)],
    blank,
    ...rowsToMatrix(columns, rows),
  ];
  const sheet = XLSX.utils.aoa_to_sheet(matrix);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Sheet1");
  const safe = filename.replace(/\.xlsx?$/i, "") || "export";
  XLSX.writeFile(book, `${safe}.xlsx`);
}

export async function exportTablePdf(
  filename: string,
  title: string,
  columns: ExportColumn[],
  rows: ExportRow[]
): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF({ orientation: columns.length > 5 ? "landscape" : "portrait" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const logo = await loadBrandLogoDataUrl();
  let titleY = 16;

  if (logo) {
    doc.addImage(logo, "PNG", 14, 10, 10, 10);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(BRAND_PRODUCT, 27, 14);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    doc.text(BRAND_TAGLINE, 27, 19);
    doc.setTextColor(0);
    titleY = 28;
  } else {
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(BRAND_PRODUCT, 14, 12);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    doc.text(BRAND_TAGLINE, 14, 17);
    doc.setTextColor(0);
    titleY = 24;
  }

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(title || filename, 14, titleY);

  autoTable(doc, {
    startY: titleY + 6,
    head: [columns.map((c) => c.header)],
    body: rows.map((row) => columns.map((c) => cellValue(row[c.key]))),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [45, 109, 246] },
    didDrawPage: (data) => {
      const pageCount = doc.getNumberOfPages();
      const page = data.pageNumber;
      const footerY = doc.internal.pageSize.getHeight() - 8;
      doc.setFontSize(8);
      doc.setTextColor(120);
      doc.text(
        `${BRAND_PRODUCT} · ${BRAND_TAGLINE}`,
        14,
        footerY
      );
      doc.text(`Page ${page} of ${pageCount}`, pageWidth - 14, footerY, {
        align: "right",
      });
      doc.setTextColor(0);
    },
  });
  const safe = filename.replace(/\.pdf$/i, "") || "export";
  doc.save(`${safe}.pdf`);
}

/** Opens a print window with a spreadsheet-style HTML table. */
export function printTable(
  title: string,
  columns: ExportColumn[],
  rows: ExportRow[]
): void {
  const escape = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const thead = columns.map((c) => `<th>${escape(c.header)}</th>`).join("");
  const tbody = rows
    .map(
      (row) =>
        `<tr>${columns
          .map((c) => `<td>${escape(cellValue(row[c.key]))}</td>`)
          .join("")}</tr>`
    )
    .join("");

  const logoUrl = new URL(BRAND_LOGO_PATH, window.location.origin).href;

  const html = `<!DOCTYPE html><html><head><title>${escape(title)}</title>
<style>
  body { font-family: ui-sans-serif, system-ui, sans-serif; padding: 24px; color: #111; }
  .brand { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
  .brand img { width: 36px; height: 36px; border-radius: 6px; }
  .brand-name { font-size: 14px; font-weight: 700; margin: 0; }
  .brand-tag { font-size: 11px; color: #64748b; margin: 2px 0 0; }
  h1 { font-size: 16px; margin: 12px 0 16px; }
  table { border-collapse: collapse; width: 100%; font-size: 12px; }
  th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
  th { background: #f3f4f6; font-weight: 700; }
  .footer { margin-top: 20px; padding-top: 10px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #64748b; }
  @media print { body { padding: 0; } }
</style></head><body>
<div class="brand">
  <img src="${escape(logoUrl)}" alt="${escape(BRAND_PRODUCT)}" />
  <div>
    <p class="brand-name">${escape(BRAND_PRODUCT)}</p>
    <p class="brand-tag">${escape(BRAND_TAGLINE)}</p>
  </div>
</div>
<h1>${escape(title)}</h1>
<table><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table>
<div class="footer">${escape(BRAND_PRODUCT)} · ${escape(BRAND_TAGLINE)}</div>
<script>window.onload=function(){window.print();}</script>
</body></html>`;

  // Do not use noopener — it makes window.open return null so we cannot write the document.
  const w = window.open("", "_blank", "noreferrer,width=960,height=720");
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.opener = null;
}
