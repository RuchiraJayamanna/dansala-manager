import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export function exportXlsx(filename: string, sheets: { name: string; rows: any[][] }[]) {
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(s.rows);
    // Auto column widths
    const widths = (s.rows[0] || []).map((_, ci) => ({
      wch: Math.min(40, Math.max(10, ...s.rows.map(r => String(r[ci] ?? "").length + 2))),
    }));
    (ws as any)["!cols"] = widths;
    XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31));
  }
  XLSX.writeFile(wb, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`);
}

export type PdfTable = { title?: string; head: string[]; body: (string | number)[][]; foot?: (string | number)[][] };

export function exportPdf(filename: string, title: string, tables: PdfTable[], subtitle?: string) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(title, 40, 50);
  if (subtitle) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120);
    doc.text(subtitle, 40, 68);
    doc.setTextColor(0);
  }
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(`Generated ${new Date().toLocaleString()}`, pageW - 40, 50, { align: "right" });
  doc.setTextColor(0);

  let startY = subtitle ? 90 : 75;
  for (const t of tables) {
    if (t.title) {
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text(t.title, 40, startY);
      startY += 8;
    }
    autoTable(doc, {
      startY: startY + 4,
      head: [t.head],
      body: t.body as any,
      foot: t.foot as any,
      styles: { fontSize: 9, cellPadding: 5 },
      headStyles: { fillColor: [15, 76, 117], textColor: 255, fontStyle: "bold" },
      footStyles: { fillColor: [232, 240, 248], textColor: 20, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: 40, right: 40 },
    });
    startY = (doc as any).lastAutoTable.finalY + 24;
    if (startY > doc.internal.pageSize.getHeight() - 60) {
      doc.addPage();
      startY = 50;
    }
  }
  doc.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}