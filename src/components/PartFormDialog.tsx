import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { savePart, uploadPartPhoto } from "@/lib/inventory.functions";
import { CATEGORIES, type Part } from "@/lib/types";
import { fileToDataUrl } from "@/lib/image";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  part: Part | null;
  onSaved: () => void;
};

const empty = {
  model: "",
  description: "",
  category: "OTHER",
  quantity: 0,
  min_stock: 1,
  location: "",
  machine: "",
  line: "",
  price: "",
};

export function PartFormDialog({ open, onOpenChange, part, onSaved }: Props) {
  const save = useServerFn(savePart);
  const upload = useServerFn(uploadPartPhoto);
  const [form, setForm] = useState(empty);
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (part) {
      setForm({
        model: part.model,
        description: part.description ?? "",
        category: part.category ?? "OTHER",
        quantity: part.quantity,
        min_stock: part.min_stock,
        location: part.location ?? "",
        machine: part.machine ?? "",
        line: part.line ?? "",
        price: part.price === null || part.price === undefined ? "" : String(part.price),
      });
      setPhotoPath(part.photo_url);
      setPhotoPreview(part.photo_signed_url ?? null);
    } else {
      setForm(empty);
      setPhotoPath(null);
      setPhotoPreview(null);
    }
  }, [open, part]);

  async function handlePhoto(file: File) {
    setUploading(true);
    try {
      const dataUrl = await fileToDataUrl(file, 1400);
      const result = await upload({ data: { dataUrl, filename: file.name } });
      setPhotoPath(result.path);
      setPhotoPreview(result.signedUrl);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.model.trim()) {
      toast.error("Model is required");
      return;
    }
    setBusy(true);
    try {
      await save({
        data: {
          ...(part ? { id: part.id } : {}),
          model: form.model,
          description: form.description,
          category: form.category,
          quantity: Number(form.quantity),
          min_stock: Number(form.min_stock),
          location: form.location,
          machine: form.machine,
          line: form.line,
          price: form.price.trim() === "" ? null : Number(form.price),
          photo_url: photoPath,
        },
      });
      toast.success(part ? "Part updated" : "Part added");
      onOpenChange(false);
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save part");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl uppercase tracking-wide">
            {part ? "Edit part" : "Add part"}
          </DialogTitle>
          <DialogDescription>
            Keep model, quantity and minimum stock accurate to get reliable alerts.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="model">Model / Name *</Label>
            <Input
              id="model"
              value={form.model}
              maxLength={120}
              onChange={(e) => setForm({ ...form, model: e.target.value })}
              required
            />
          </div>

          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              rows={3}
              maxLength={1000}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>

          <div className="grid gap-2">
            <Label>Category</Label>
            <Select
              value={form.category}
              onValueChange={(value) => setForm({ ...form, category: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="location">Location (where it is used / stored)</Label>
            <Input
              id="location"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="machine">Machine</Label>
            <Input
              id="machine"
              value={form.machine}
              onChange={(e) => setForm({ ...form, machine: e.target.value })}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="line">Line</Label>
            <Input
              id="line"
              value={form.line}
              onChange={(e) => setForm({ ...form, line: e.target.value })}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="quantity">Quantity in stock</Label>
            <Input
              id="quantity"
              type="number"
              min={0}
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="price">Price (£)</Label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                £
              </span>
              <Input
                id="price"
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                placeholder="0.00"
                className="pl-7"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="min">Minimum stock (reorder point)</Label>
            <Input
              id="min"
              type="number"
              min={0}
              value={form.min_stock}
              onChange={(e) => setForm({ ...form, min_stock: Number(e.target.value) })}
            />
          </div>

          <div className="grid gap-2 sm:col-span-2">
            <Label>Photo</Label>
            <div className="flex flex-wrap items-center gap-4">
              {photoPreview ? (
                <img
                  src={photoPreview}
                  alt={form.model}
                  className="h-24 w-24 rounded-md border object-cover"
                />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-md border border-dashed text-muted-foreground">
                  <ImagePlus className="h-6 w-6" />
                </div>
              )}
              <div className="flex flex-col gap-2">
                <Input
                  type="file"
                  accept="image/*"
                  className="max-w-xs"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handlePhoto(file);
                  }}
                />
                {uploading && (
                  <span className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Uploading…
                  </span>
                )}
                {photoPreview && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-fit text-destructive"
                    onClick={() => {
                      setPhotoPath(null);
                      setPhotoPreview(null);
                    }}
                  >
                    <Trash2 className="mr-1 h-4 w-4" /> Remove photo
                  </Button>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || uploading}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {part ? "Save changes" : "Add part"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
