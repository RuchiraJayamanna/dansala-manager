import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

/** Build a SUM() formula cell over a column range, 1-indexed (Excel) rows. */
export const sumF = (col: string, startRow: number, endRow: number) =>
  ({ t: "n", f: `SUM(${col}${startRow}:${col}${endRow})` } as any);

/** Build a generic numeric formula cell. */
export const numF = (formula: string) => ({ t: "n", f: formula } as any);

export function exportXlsx(filename: string, sheets: { name: string; rows: any[][] }[]) {
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(s.rows);
    // Auto column widths
    const widths = (s.rows[0] || []).map((_, ci) => ({
      wch: Math.min(40, Math.max(10, ...s.rows.map(r => {
        const v = r[ci];
        if (v && typeof v === "object" && "f" in (v as any)) return String((v as any).f).length + 2;
        return String(v ?? "").length + 2;
      }))),
    }));
    (ws as any)["!cols"] = widths;
    XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31));
  }
  XLSX.writeFile(wb, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`);
}

export type PdfTable = {
  title?: string;
  head: string[];
  body: (string | number)[][];
  foot?: (string | number)[][];
  notes?: string[];
  newPage?: boolean;
  /** Optional free-form prose rendered instead of a table (used for narrative sections). */
  prose?: string;
};

export function exportPdf(filename: string, title: string, tables: PdfTable[], subtitle?: string) {
  const doc = buildPdf(title, tables, subtitle);
  doc.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}

export type PdfAttachment = {
  /** Section label rendered as an intro page before the file (e.g. "Receipts · Rice"). */
  section: string;
  /** File title shown under the section label. */
  title: string;
  /** URL to fetch the file bytes from. */
  url: string;
  /** Optional mime type; auto-detected from response when omitted. */
  mime?: string;
  /** Original file name (used to detect type from extension when mime missing). */
  fileName?: string;
};

/**
 * Build the jsPDF report, then append each attachment inline:
 * - PDFs are copied page-for-page.
 * - Images (jpg/png) are embedded on a full page.
 * - Anything else gets a small placeholder page noting the file type.
 */
export async function exportPdfWithAttachments(
  filename: string,
  title: string,
  tables: PdfTable[],
  attachments: PdfAttachment[],
  subtitle?: string,
) {
  const doc = buildPdf(title, tables, subtitle);
  const baseBytes = doc.output("arraybuffer");
  const merged = await PDFDocument.load(baseBytes);
  const helv = await merged.embedFont(StandardFonts.HelveticaBold);
  const helvR = await merged.embedFont(StandardFonts.Helvetica);

  for (const att of attachments) {
    try {
      const res = await fetch(att.url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const bytes = new Uint8Array(await res.arrayBuffer());
      const contentType = (att.mime || res.headers.get("content-type") || "").toLowerCase();
      const nameLower = (att.fileName || att.url).toLowerCase();
      const isPdf = contentType.includes("pdf") || nameLower.endsWith(".pdf");
      const isJpg = contentType.includes("jpeg") || /\.(jpe?g)(\?|$)/.test(nameLower);
      const isPng = contentType.includes("png") || /\.png(\?|$)/.test(nameLower);

      // Cover page for this attachment
      addCoverPage(merged, helv, helvR, att.section, att.title);

      if (isPdf) {
        const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
        const pages = await merged.copyPages(src, src.getPageIndices());
        pages.forEach(p => merged.addPage(p));
      } else if (isJpg || isPng) {
        const img = isPng ? await merged.embedPng(bytes) : await merged.embedJpg(bytes);
        const page = merged.addPage([595.28, 841.89]); // A4
        const margin = 40;
        const maxW = page.getWidth() - margin * 2;
        const maxH = page.getHeight() - margin * 2 - 40;
        const scale = Math.min(maxW / img.width, maxH / img.height, 1);
        const w = img.width * scale;
        const h = img.height * scale;
        page.drawImage(img, {
          x: (page.getWidth() - w) / 2,
          y: (page.getHeight() - h) / 2 - 20,
          width: w,
          height: h,
        });
      } else {
        const page = merged.addPage([595.28, 841.89]);
        page.drawText(`Attached file: ${att.fileName || att.title}`, {
          x: 40, y: 780, size: 12, font: helv, color: rgb(0, 0, 0),
        });
        page.drawText("Preview not available for this file type.", {
          x: 40, y: 760, size: 10, font: helvR, color: rgb(0.4, 0.4, 0.4),
        });
      }
    } catch (e) {
      addCoverPage(merged, helv, helvR, att.section, `${att.title} — failed to embed`);
    }
  }

  const out = await merged.save();
  const blob = new Blob([out as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function addCoverPage(pdf: PDFDocument, bold: any, regular: any, section: string, title: string) {
  const page = pdf.addPage([595.28, 841.89]);
  page.drawText(section, { x: 40, y: 780, size: 10, font: regular, color: rgb(0.4, 0.4, 0.5) });
  page.drawText(title, { x: 40, y: 755, size: 18, font: bold, color: rgb(0.06, 0.3, 0.46) });
  page.drawLine({
    start: { x: 40, y: 740 }, end: { x: 555, y: 740 },
    thickness: 1, color: rgb(0.85, 0.87, 0.9),
  });
}

function buildPdf(title: string, tables: PdfTable[], subtitle?: string): jsPDF {
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
    if (t.newPage) {
      doc.addPage();
      startY = 50;
    }
    if (t.title) {
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text(t.title, 40, startY);
      startY += 8;
    }
    if (t.notes && t.notes.length) {
      doc.setFontSize(8);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(80);
      startY += 6;
      for (const n of t.notes) {
        const wrapped = doc.splitTextToSize(`• ${n}`, pageW - 100) as string[];
        for (const line of wrapped) {
          if (startY > doc.internal.pageSize.getHeight() - 60) {
            doc.addPage();
            startY = 50;
          }
          doc.text(line, 50, startY);
          startY += 11;
        }
      }
      doc.setTextColor(0);
      doc.setFont("helvetica", "normal");
      startY += 2;
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
  return doc;
}