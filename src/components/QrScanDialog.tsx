import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { QrCode, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { withdrawByCode } from "@/lib/inventory.functions";

type ScanLog = { model: string; quantity: number; at: number };

export function QrScanDialog({
  open,
  onOpenChange,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}) {
  const withdraw = useServerFn(withdrawByCode);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastRef = useRef<{ code: string; at: number }>({ code: "", at: 0 });
  const busyRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<ScanLog[]>([]);

  useEffect(() => {
    if (!open) return;
    let raf = 0;
    let cancelled = false;

    const handle = async (code: string) => {
      const now = Date.now();
      if (busyRef.current) return;
      if (lastRef.current.code === code && now - lastRef.current.at < 2500) return;
      lastRef.current = { code, at: now };
      busyRef.current = true;
      try {
        const res = await withdraw({ data: { code } });
        setLog((l) => [{ model: res.model, quantity: res.quantity, at: now }, ...l].slice(0, 20));
        toast.success(`-1 ${res.model} — ${res.quantity} left`);
        if (navigator.vibrate) navigator.vibrate(60);
        onChanged();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Scan failed");
      } finally {
        busyRef.current = false;
      }
    };

    const tick = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        const w = video.videoWidth;
        const h = video.videoHeight;
        if (w && h) {
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          if (ctx) {
            ctx.drawImage(video, 0, 0, w, h);
            const image = ctx.getImageData(0, 0, w, h);
            const result = jsQR(image.data, w, h, { inversionAttempts: "dontInvert" });
            if (result?.data) void handle(result.data.trim());
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        raf = requestAnimationFrame(tick);
      } catch {
        setError("Camera access denied or unavailable.");
      }
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setLog([]);
      setError(null);
      lastRef.current = { code: "", at: 0 };
    };
  }, [open, withdraw, onChanged]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" /> Scan to withdraw
          </DialogTitle>
        </DialogHeader>

        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : (
          <div className="relative overflow-hidden rounded-lg bg-black">
            <video ref={videoRef} playsInline muted className="h-64 w-full object-cover" />
            <div className="pointer-events-none absolute inset-8 rounded-lg border-2 border-white/70" />
          </div>
        )}
        <canvas ref={canvasRef} className="hidden" />

        <p className="text-xs text-muted-foreground">
          Point the camera at a part QR code — 1 unit is removed automatically. Keep scanning one
          code after another.
        </p>

        {log.length > 0 && (
          <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-2">
            {log.map((entry) => (
              <div key={entry.at} className="flex justify-between text-sm">
                <span className="truncate">{entry.model}</span>
                <span className="text-muted-foreground">{entry.quantity} left</span>
              </div>
            ))}
          </div>
        )}

        <Button variant="outline" onClick={() => onOpenChange(false)}>
          <X className="mr-2 h-4 w-4" /> Done
        </Button>
      </DialogContent>
    </Dialog>
  );
}
