import { jsPDF } from "jspdf";
import QRCode from "qrcode";
import type { Part } from "./types";

export async function exportQrLabelsPdf(parts: Part[], title = "QR labels") {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  const cols = 3;
  const rows = 6;
  const marginX = 30;
  const marginY = 40;
  const cellW = (pageW - marginX * 2) / cols;
  const cellH = (pageH - marginY * 2) / rows;

  let index = 0;
  for (const part of parts) {
    const slot = index % (cols * rows);
    if (index > 0 && slot === 0) doc.addPage();

    if (slot === 0) {
      doc.setFontSize(10);
      doc.setTextColor(20, 55, 100);
      doc.text(`APPLIED NUTRITION — ${title}`, marginX, 26);
    }

    const col = slot % cols;
    const row = Math.floor(slot / cols);
    const x = marginX + col * cellW;
    const y = marginY + row * cellH;

    const dataUrl = await QRCode.toDataURL(part.id, { margin: 0, width: 400 });
    const size = Math.min(cellW, cellH) - 46;
    doc.addImage(dataUrl, "PNG", x + (cellW - size) / 2, y, size, size);

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(9);
    doc.text(String(part.model).slice(0, 28), x + cellW / 2, y + size + 14, {
      align: "center",
    });
    doc.setFontSize(7);
    doc.setTextColor(110, 110, 110);
    doc.text(String(part.category ?? "").slice(0, 30), x + cellW / 2, y + size + 25, {
      align: "center",
    });

    index++;
  }

  doc.save(`applied-nutrition-qr-labels-${new Date().toISOString().slice(0, 10)}.pdf`);
}
