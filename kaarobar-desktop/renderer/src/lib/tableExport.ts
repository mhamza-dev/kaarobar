/** Client-side table export: PDF, XLS, Print (spreadsheet layout). */

export type ExportColumn = { key: string; header: string };

export type ExportRow = Record<string, string | number | null | undefined>;

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

export async function exportTableXls(
  filename: string,
  columns: ExportColumn[],
  rows: ExportRow[]
): Promise<void> {
  const XLSX = await import("xlsx");
  const matrix = rowsToMatrix(columns, rows);
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
  doc.setFontSize(14);
  doc.text(title || filename, 14, 16);
  autoTable(doc, {
    startY: 22,
    head: [columns.map((c) => c.header)],
    body: rows.map((row) => columns.map((c) => cellValue(row[c.key]))),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [30, 64, 120] },
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

  const html = `<!DOCTYPE html><html><head><title>${escape(title)}</title>
<style>
  body { font-family: ui-sans-serif, system-ui, sans-serif; padding: 24px; color: #111; }
  h1 { font-size: 16px; margin: 0 0 16px; }
  table { border-collapse: collapse; width: 100%; font-size: 12px; }
  th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
  th { background: #f3f4f6; font-weight: 700; }
  @media print { body { padding: 0; } }
</style></head><body>
<h1>${escape(title)}</h1>
<table><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table>
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
