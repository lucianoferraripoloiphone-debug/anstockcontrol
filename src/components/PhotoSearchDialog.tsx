import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { identifyPartByPhoto } from "@/lib/inventory.functions";
import { fileToDataUrl } from "@/lib/image";
import type { Part } from "@/lib/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parts: Part[];
  onPick: (part: Part) => void;
};

type Match = { id: string; confidence?: number; reason?: string };

export function PhotoSearchDialog({ open, onOpenChange, parts, onPick }: Props) {
  const identify = useServerFn(identifyPartByPhoto);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [guess, setGuess] = useState("");
  const [matches, setMatches] = useState<Match[]>([]);

  async function handleFile(file: File) {
    setBusy(true);
    setMatches([]);
    setGuess("");
    try {
      const dataUrl = await fileToDataUrl(file, 1024);
      setPreview(dataUrl);
      const result = await identify({ data: { dataUrl } });
      setGuess(result.guess);
      setMatches(result.matches);
      if (result.matches.length === 0) toast.info("No confident match found in the catalog");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Photo search failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-2xl uppercase tracking-wide">
            <Camera className="h-5 w-5" /> Find part by photo
          </DialogTitle>
          <DialogDescription>
            Upload or take a picture of the part and AI will look for the closest matches in the
            warehouse catalog.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <Input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />

          {preview && (
            <img
              src={preview}
              alt="Part to identify"
              className="max-h-52 w-full rounded-md border object-contain"
            />
          )}

          {busy && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Analysing photo…
            </p>
          )}

          {guess && (
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">AI sees:</span> {guess}
            </p>
          )}

          <div className="grid gap-2">
            {matches.map((match) => {
              const part = parts.find((p) => p.id === match.id);
              if (!part) return null;
              return (
                <button
                  key={match.id}
                  type="button"
                  onClick={() => {
                    onPick(part);
                    onOpenChange(false);
                  }}
                  className="flex items-start justify-between gap-3 rounded-md border p-3 text-left transition-colors hover:bg-accent"
                >
                  <div>
                    <p className="font-semibold">{part.model}</p>
                    <p className="text-xs text-muted-foreground">
                      {part.category} · qty {part.quantity}
                      {match.reason ? ` · ${match.reason}` : ""}
                    </p>
                  </div>
                  <Badge variant="secondary">{match.confidence ?? 0}%</Badge>
                </button>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
