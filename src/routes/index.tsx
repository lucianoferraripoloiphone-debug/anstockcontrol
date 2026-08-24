import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  Camera,
  FileDown,
  Lock,
  LockOpen,
  Minus,
  Package,
  Pencil,
  Plus,
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
import type { Part } from "@/lib/types";

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
  const [gateOpen, setGateOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [editing, setEditing] = useState<Part | null>(null);

  const categories = useMemo(
    () => Array.from(new Set(parts.map((p) => p.category))).sort(),
    [parts],
  );

  const lowStock = parts.filter((p) => p.quantity <= p.min_stock);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return parts.filter((p) => {
      if (category !== "ALL" && p.category !== category) return false;
      if (onlyLow && p.quantity > p.min_stock) return false;
      if (!q) return true;
      return [p.model, p.description, p.machine, p.line, p.location, p.category]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q));
    });
  }, [parts, query, category, onlyLow]);

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
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Parts registered" value={parts.length} icon={Package} />
          <StatCard
            label="Total items in stock"
            value={parts.reduce((sum, p) => sum + p.quantity, 0)}
            icon={Package}
          />
          <StatCard
            label="Below minimum stock"
            value={lowStock.length}
            icon={AlertTriangle}
            alert={lowStock.length > 0}
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

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <div className="relative min-w-[240px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by model, description, machine, line or location"
              className="pl-9"
            />
          </div>

          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-[190px]">
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
            onClick={() => setOnlyLow((v) => !v)}
          >
            <AlertTriangle className="mr-2 h-4 w-4" /> Low stock only
          </Button>

          <Button variant="outline" size="sm" onClick={() => setPhotoOpen(true)}>
            <Camera className="mr-2 h-4 w-4" /> Photo search
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => exportPartsPdf(filtered, "Parts list")}
          >
            <FileDown className="mr-2 h-4 w-4" /> PDF list
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => exportPartsPdf(lowStock, "Low stock report")}
            disabled={lowStock.length === 0}
          >
            <FileDown className="mr-2 h-4 w-4" /> PDF low stock
          </Button>

          {isAdmin && (
            <Button
              size="sm"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" /> New part
            </Button>
          )}
        </div>


        <Card className="mt-4">
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[70px]">Photo</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Machine</TableHead>
                  <TableHead>Line</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Min</TableHead>
                  {isAdmin && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={10} className="py-10 text-center text-muted-foreground">
                      Loading inventory…
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading && filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} className="py-10 text-center text-muted-foreground">
                      No parts match your search.
                    </TableCell>
                  </TableRow>
                )}
                {filtered.map((part) => {
                  const low = part.quantity <= part.min_stock;
                  return (
                    <TableRow key={part.id}>
                      <TableCell>
                        {part.photo_signed_url ? (
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
                        <TableCell>
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
  value,
  icon: Icon,
  alert,
}: {
  label: string;
  value: number;
  icon: typeof Package;
  alert?: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-5">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
          <p
            className={`font-display text-3xl ${alert ? "text-destructive" : "text-foreground"}`}
          >
            {value}
          </p>
        </div>
        <Icon className={`h-8 w-8 ${alert ? "text-destructive" : "text-primary"}`} />
      </CardContent>
    </Card>
  );
}
