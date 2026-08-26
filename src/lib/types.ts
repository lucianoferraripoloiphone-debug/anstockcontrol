export type Part = {
  id: string;
  model: string;
  description: string | null;
  category: string;
  quantity: number;
  min_stock: number;
  location: string | null;
  machine: string | null;
  line: string | null;
  photo_url: string | null;
  price: number | null;
  photo_signed_url?: string | null;
};

export function formatGbp(value: number | null | undefined) {
  if (value === null || value === undefined) return "";
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(value);
}

export type PartInput = {
  id?: string;
  model: string;
  description?: string | null;
  category?: string | null;
  quantity: number;
  min_stock: number;
  location?: string | null;
  machine?: string | null;
  line?: string | null;
  photo_url?: string | null;
};

export const CATEGORIES = [
  "BEARING",
  "PLUG/STECK",
  "SEAL",
  "CINCHSEAL",
  "BELT",
  "FILTER",
  "WARNING LIGHT",
  "SWITCHED SOCKET",
  "BUTTON (COMMAND)",
  "PNEUMATIC",
  "CIRCUIT BREAKER",
  "CONTACTOR",
  "SENSOR",
  "OTHER",
] as const;
