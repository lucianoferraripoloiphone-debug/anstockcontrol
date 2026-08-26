import * as XLSX from "xlsx";
import type { Part } from "./types";

export function exportPartsXlsx(parts: Part[], title: string) {
  const rows = parts.map((p) => ({
    Model: p.model,
    Category: p.category ?? "",
    Description: p.description ?? "",
    Machine: p.machine ?? "",
    Line: p.line ?? "",
    Location: p.location ?? "",
    "Price (GBP)": p.price ?? "",
    Quantity: p.quantity,
    "Min stock": p.min_stock,
    "Below minimum": p.quantity <= p.min_stock ? "YES" : "",
  }));

  const sheet = XLSX.utils.json_to_sheet(rows);
  sheet["!cols"] = [
    { wch: 22 },
    { wch: 18 },
    { wch: 40 },
    { wch: 18 },
    { wch: 14 },
    { wch: 16 },
    { wch: 12 },
    { wch: 10 },
    { wch: 10 },
    { wch: 14 },
  ];

  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, title.slice(0, 31));
  XLSX.writeFile(
    book,
    `applied-nutrition-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.xlsx`,
  );
}
