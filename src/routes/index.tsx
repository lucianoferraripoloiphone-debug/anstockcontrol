import { useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  Camera,
  FileDown,
  Sheet,
  Lock,
  LockOpen,
  Minus,
  Package,
  Pencil,
  Plus,
  QrCode,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

const logo = "/__l5e/assets-v1/198b100d-f9fb-4b15-9ad5-49864912c89d/applied-nutrition-logo.png";
import { AdminGateDialog } from "@/components/AdminGateDialog";
import { PartFormDialog } from "@/components/PartFormDialog";
import { PhotoSearchDialog } from "@/components/PhotoSearchDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  adjustQuantity,
  deletePart,
  getInventory,
  lockAdmin,
} from "@/lib/inventory.functions";
import { exportPartsPdf } from "@/lib/pdf";
import { exportPartsXlsx } from "@/lib/xlsx";
import { formatGbp, type Part } from "@/lib/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Spare Parts Stock — Applied Nutrition" },
      {
        name: "description",
        content:
          "Applied Nutrition warehouse stock: search spare parts by name, description, machine or line, track minimum stock alerts and export PDF reports.",
      },
      { property: "og:title", content: "Spare Parts Stock — Applied Nutrition" },
      {
        property: "og:description",
        content:
          "Search spare parts by name, machine or line, monitor low stock alerts and export PDF reports.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const load = useServerFn(getInventory);
  const lock = useServerFn(lockAdmin);
  const remove = useServerFn(deletePart);
  const adjust = useServerFn(adjustQuantity);

  const { data, refetch, isLoading } = useQuery({
    queryKey: ["inventory"],
    queryFn: () => load(),
  });

  const parts = data?.parts ?? [];
  const isAdmin = data?.isAdmin ?? false;

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("ALL");
  const [onlyLow, setOnlyLow] = useState(false);
  const [onlyZero, setOnlyZero] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [editing, setEditing] = useState<Part | null>(null);

  const categories = useMemo(
    () => Array.from(new Set(parts.map((p) => p.category))).sort(),
    [parts],
  );

  const lowStock = parts.filter((p) => p.quantity <= p.min_stock && p.quantity > 0);
  const zeroStock = parts.filter((p) => p.quantity === 0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return parts.filter((p) => {
      if (category !== "ALL" && p.category !== category) return false;
      if (onlyLow && (p.quantity > p.min_stock || p.quantity === 0)) return false;
      if (onlyZero && p.quantity !== 0) return false;
      if (!q) return true;
      return [p.model, p.description, p.machine, p.line, p.location, p.category]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q));
    });
  }, [parts, query, category, onlyLow, onlyZero]);

  const tableRef = useRef<HTMLTableElement>(null);
  const [widths, setWidths] = useState<Record<string, number>>({});

  const columns = useMemo(() => {
    const base: { key: string; label: string; w: number; align?: "right" }[] = [
      { key: "photo", label: "Photo", w: 70 },
      { key: "model", label: "Model", w: 160 },
      { key: "category", label: "Category", w: 130 },
      { key: "description", label: "Description", w: 260 },
      { key: "machine", label: "Machine", w: 130 },
      { key: "line", label: "Line", w: 110 },
      { key: "location", label: "Location", w: 120 },
      { key: "price", label: "Price", w: 100, align: "right" },
      { key: "qty", label: "Qty", w: 70, align: "right" },
      { key: "min", label: "Min", w: 70, align: "right" },
    ];
    if (isAdmin) base.push({ key: "actions", label: "Actions", w: 170, align: "right" });
    return base;
  }, [isAdmin]);

  function startResize(e: React.PointerEvent, key: string) {
    e.preventDefault();
    e.stopPropagation();
    const col = columns.find((c) => c.key === key);
    const startX = e.clientX;
    const startW = widths[key] ?? col?.w ?? 120;
    const move = (ev: PointerEvent) => {
      setWidths((w) => ({ ...w, [key]: Math.max(50, startW + ev.clientX - startX) }));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  function autoFit(key: string, index: number) {
    const table = tableRef.current;
    if (!table) return;
    let max = 60;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.font = "14px Barlow, sans-serif";
    const rows = table.querySelectorAll("tr");
    rows.forEach((row) => {
      const cell = row.children[index] as HTMLElement | undefined;
      if (!cell) return;
      const text = cell.textContent?.trim() ?? "";
      const w = ctx.measureText(text).width + 40;
      if (w > max) max = w;
    });
    setWidths((w) => ({ ...w, [key]: Math.min(520, Math.ceil(max)) }));
  }



  async function handleDelete(part: Part) {
    if (!confirm(`Delete "${part.model}"?`)) return;
    try {
      await remove({ data: { id: part.id } });
      toast.success("Part deleted");
      void refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete");
    }
  }

  async function handleAdjust(part: Part, delta: number) {
    try {
      await adjust({ data: { id: part.id, delta } });
      void refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update quantity");
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-5">
          <div className="flex items-center gap-4">
            <img src={logo} alt="Applied Nutrition" className="h-10 w-auto" />
            <div className="hidden border-l pl-4 sm:block">
              <h1 className="font-display text-xl uppercase tracking-wide">
                Spare parts stock
              </h1>
              <p className="text-xs text-muted-foreground">Warehouse inventory control</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isAdmin ? (
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  await lock();
                  toast.success("Edit mode locked");
                  void refetch();
                }}
              >
                <LockOpen className="mr-2 h-4 w-4" /> Lock editing
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setGateOpen(true)}>
                <Lock className="mr-2 h-4 w-4" /> Unlock editing
              </Button>
            )}
            {isAdmin && (
              <Button
                size="sm"
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                <Plus className="mr-2 h-4 w-4" /> Add part
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        <div className="grid grid-cols-4 gap-2 sm:gap-4">
          <StatCard label="Parts" value={parts.length} icon={Package} />
          <StatCard
            label="In stock"
            shortLabel="Stock"
            value={parts.reduce((sum, p) => sum + p.quantity, 0)}
            icon={Package}
          />
          <StatCard
            label="Low stock"
            shortLabel="Low"
            value={lowStock.length}
            icon={AlertTriangle}
            alert={lowStock.length > 0}
          />
          <StatCard
            label="Out of stock"
            shortLabel="Zero"
            value={zeroStock.length}
            icon={AlertTriangle}
            alert={zeroStock.length > 0}
            onClick={() => setOnlyZero(true)}
          />
        </div>

        {lowStock.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <p className="text-sm font-medium text-destructive">
              {lowStock.length} part{lowStock.length > 1 ? "s" : ""} reached the reorder point.
            </p>
            <Button variant="outline" size="sm" onClick={() => setOnlyLow(true)}>
              Review now
            </Button>
          </div>
        )}

        <div className="mt-6 flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by model, description, machine, line or location"
                className="pl-9"
              />
            </div>

            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-[170px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All categories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant={onlyLow ? "default" : "outline"}
              size="sm"
              className="h-9 gap-1.5 text-xs"
              onClick={() => setOnlyLow((v) => !v)}
            >
              <AlertTriangle className="h-3.5 w-3.5" /> Low stock
            </Button>

            <Button
              variant="default"
              size="icon"
              className="h-12 w-12 shrink-0 rounded-xl shadow-sm"
              onClick={() => setPhotoOpen(true)}
              aria-label="Photo search"
              title="Photo search"
            >
              <Camera className="h-6 w-6" />
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 px-2.5 text-xs"
              onClick={() => exportPartsPdf(filtered, "Parts list")}
            >
              <FileDown className="h-3.5 w-3.5" /> PDF list
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 px-2.5 text-xs"
              onClick={() => exportPartsPdf(lowStock, "Low stock report")}
              disabled={lowStock.length === 0}
            >
              <FileDown className="h-3.5 w-3.5" /> PDF low
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 px-2.5 text-xs"
              onClick={() => exportPartsXlsx(filtered, "Parts list")}
            >
              <Sheet className="h-3.5 w-3.5" /> Excel list
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 px-2.5 text-xs"
              onClick={() => exportPartsXlsx(lowStock, "Low stock report")}
              disabled={lowStock.length === 0}
            >
              <Sheet className="h-3.5 w-3.5" /> Excel low
            </Button>

            {isAdmin && (
              <Button
                size="sm"
                className="h-8 gap-1.5 px-2.5 text-xs"
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                <Plus className="h-3.5 w-3.5" /> New part
              </Button>
            )}
          </div>
        </div>

        {(query || category !== "ALL" || onlyLow || onlyZero) && (
          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-md border bg-muted/40 px-3 py-2 text-sm">
            <span className="text-muted-foreground">
              Showing <strong className="text-foreground">{filtered.length}</strong> of{" "}
              <strong className="text-foreground">{parts.length}</strong> parts
              {onlyLow && " — low stock filter is on"}
              {onlyZero && " — showing only out-of-stock parts"}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setQuery("");
                setCategory("ALL");
                setOnlyLow(false);
                setOnlyZero(false);
              }}
            >
              Clear filters
            </Button>
          </div>
        )}


        <Card className="mt-4">
          <CardContent className="overflow-x-auto p-0">
            <Table
              ref={tableRef}
              className="table-fixed [&_td]:truncate [&_td]:border-r [&_th]:border-r [&_td:last-child]:border-r-0 [&_th:last-child]:border-r-0"
            >
              <colgroup>
                {columns.map((c) => (
                  <col key={c.key} style={{ width: `${widths[c.key] ?? c.w}px` }} />
                ))}
              </colgroup>
              <TableHeader>
                <TableRow>
                  {columns.map((c, i) => (
                    <TableHead
                      key={c.key}
                      className={`relative select-none ${c.align === "right" ? "text-right" : ""} ${
                        c.key === "actions" ? "sticky right-0 bg-card" : ""
                      }`}
                    >
                      {c.label}
                      <span
                        role="separator"
                        aria-label={`Resize ${c.label} column`}
                        title="Drag to resize — double-click to auto-fit"
                        onPointerDown={(e) => startResize(e, c.key)}
                        onDoubleClick={() => autoFit(c.key, i)}
                        className="absolute right-0 top-0 z-10 h-full w-2 translate-x-1/2 cursor-col-resize touch-none hover:bg-primary/40"
                      />
                    </TableHead>
                  ))}
                </TableRow>

              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="py-10 text-center text-muted-foreground">
                      Loading inventory…
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading && filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="py-10 text-center text-muted-foreground">
                      No parts match your search.
                    </TableCell>
                  </TableRow>
                )}
                {filtered.map((part) => {
                  const low = part.quantity <= part.min_stock;
                  return (
                    <TableRow key={part.id}>
                      <TableCell>
                        {isAdmin ? (
                          <button
                            type="button"
                            title="Add or change photo"
                            aria-label={`Add or change photo for ${part.model}`}
                            className="group relative block h-10 w-10 overflow-hidden rounded border"
                            onClick={() => {
                              setEditing(part);
                              setFormOpen(true);
                            }}
                          >
                            {part.photo_signed_url ? (
                              <img
                                src={part.photo_signed_url}
                                alt={part.model}
                                loading="lazy"
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <span className="flex h-full w-full items-center justify-center border-dashed text-muted-foreground">
                                <Camera className="h-4 w-4" />
                              </span>
                            )}
                            <span className="absolute inset-0 hidden items-center justify-center bg-foreground/60 text-background group-hover:flex">
                              <Camera className="h-4 w-4" />
                            </span>
                          </button>
                        ) : part.photo_signed_url ? (
                          <img
                            src={part.photo_signed_url}
                            alt={part.model}
                            loading="lazy"
                            className="h-10 w-10 rounded border object-cover"
                          />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded border border-dashed text-muted-foreground">
                            <Package className="h-4 w-4" />
                          </div>
                        )}
                      </TableCell>

                      <TableCell className="font-semibold">{part.model}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{part.category}</Badge>
                      </TableCell>
                      <TableCell className="max-w-[260px] text-sm text-muted-foreground">
                        {part.description}
                      </TableCell>
                      <TableCell className="text-sm">{part.machine}</TableCell>
                      <TableCell className="text-sm">{part.line}</TableCell>
                      <TableCell className="text-sm">{part.location}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {part.price === null || part.price === undefined ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          formatGbp(part.price)
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={
                            low ? "font-bold text-destructive" : "font-medium text-foreground"
                          }
                        >
                          {part.quantity}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {part.min_stock}
                      </TableCell>
                      {isAdmin && (
                        <TableCell className="sticky right-0 bg-card">

                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Remove one"
                              onClick={() => void handleAdjust(part, -1)}
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Add one"
                              onClick={() => void handleAdjust(part, 1)}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Edit part"
                              onClick={() => {
                                setEditing(part);
                                setFormOpen(true);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Delete part"
                              className="text-destructive"
                              onClick={() => void handleDelete(part)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>

      <AdminGateDialog
        open={gateOpen}
        onOpenChange={setGateOpen}
        onUnlocked={() => void refetch()}
      />
      <PartFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        part={editing}
        onSaved={() => void refetch()}
      />
      <PhotoSearchDialog
        open={photoOpen}
        onOpenChange={setPhotoOpen}
        parts={parts}
        onPick={(part) => setQuery(part.model)}
      />
    </div>
  );
}

function StatCard({
  label,
  shortLabel,
  value,
  icon: Icon,
  alert,
  onClick,
}: {
  label: string;
  shortLabel?: string;
  value: number;
  icon: typeof Package;
  alert?: boolean;
  onClick?: () => void;
}) {
  return (
    <Card className={onClick ? "cursor-pointer transition-shadow hover:shadow-md" : undefined} onClick={onClick}>
      <CardContent className="flex items-center justify-between p-2.5 sm:p-4">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground sm:text-xs">
            {shortLabel ? (
              <>
                <span className="sm:hidden">{shortLabel}</span>
                <span className="hidden sm:inline">{label}</span>
              </>
            ) : (
              label
            )}
          </p>
          <p
            className={`font-display text-lg sm:text-2xl ${alert ? "text-destructive" : "text-foreground"}`}
          >
            {value}
          </p>
        </div>
        <Icon className={`h-4 w-4 shrink-0 sm:h-5 sm:w-5 ${alert ? "text-destructive" : "text-primary"}`} />
      </CardContent>
    </Card>
  );
}
