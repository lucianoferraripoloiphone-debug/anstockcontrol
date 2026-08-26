import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { Part } from "./types";

export function exportPartsPdf(parts: Part[], title: string) {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });

  doc.setFillColor(20, 55, 100);
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 56, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.text("APPLIED NUTRITION", 40, 26);
  doc.setFontSize(11);
  doc.text(title, 40, 44);
  doc.setFontSize(9);
  doc.text(
    new Date().toLocaleString("en-GB"),
    doc.internal.pageSize.getWidth() - 40,
    44,
    { align: "right" },
  );

  autoTable(doc, {
    startY: 76,
    head: [
      ["Model", "Category", "Description", "Machine", "Line", "Location", "Price", "Qty", "Min"],
    ],
    body: parts.map((p) => [
      p.model,
      p.category ?? "",
      p.description ?? "",
      p.machine ?? "",
      p.line ?? "",
      p.location ?? "",
      p.price === null || p.price === undefined ? "" : `GBP ${p.price.toFixed(2)}`,
      String(p.quantity),
      String(p.min_stock),
    ]),
    styles: { fontSize: 8, cellPadding: 4, overflow: "linebreak" },
    headStyles: { fillColor: [20, 55, 100], textColor: 255 },
    alternateRowStyles: { fillColor: [244, 247, 251] },
    columnStyles: {
      0: { cellWidth: 110, fontStyle: "bold" },
      2: { cellWidth: 180 },
      6: { cellWidth: 60, halign: "right" },
      7: { cellWidth: 40, halign: "right" },
      8: { cellWidth: 40, halign: "right" },
    },
    didParseCell: (data) => {
      if (data.section === "body") {
        const part = parts[data.row.index];
        if (part && part.quantity <= part.min_stock) {
          data.cell.styles.textColor = [170, 40, 30];
          if (data.column.index === 7) data.cell.styles.fontStyle = "bold";
        }
      }
    },
  });

  doc.save(`applied-nutrition-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.pdf`);
}
