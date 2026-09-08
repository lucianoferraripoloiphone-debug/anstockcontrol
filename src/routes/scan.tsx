import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { toast } from "sonner";
import { Loader2, Lock, QrCode } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { unlockAdmin, withdrawByCode } from "@/lib/inventory.functions";

export const Route = createFileRoute("/scan")({
  component: ScanPage,
  head: () => ({
    meta: [
      { title: "Scan to withdraw | Applied Nutrition Stock" },
      {
        name: "description",
        content:
          "Open the camera and scan part QR codes to remove stock instantly from the Applied Nutrition warehouse.",
      },
      { property: "og:title", content: "Scan to withdraw | Applied Nutrition Stock" },
      {
        property: "og:description",
        content: "Scan part QR codes to withdraw stock instantly.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type ScanLog = { model: string; quantity: number; at: number };

function ScanPage() {
  const withdraw = useServerFn(withdrawByCode);
  const unlock = useServerFn(unlockAdmin);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastRef = useRef(0);
  const busyRef = useRef(false);

  const [locked, setLocked] = useState(false);
  const [password, setPassword] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [last, setLast] = useState<ScanLog | null>(null);
  const [log, setLog] = useState<ScanLog[]>([]);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      const left = Math.max(0, 3000 - (Date.now() - lastRef.current));
      setCooldown(Math.ceil(left / 1000));
    }, 200);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (locked) return;
    let raf = 0;
    let cancelled = false;

    const handle = async (code: string) => {
      const now = Date.now();
      if (busyRef.current) return;
      if (now - lastRef.current < 3000) return;
      lastRef.current = now;
      busyRef.current = true;
      try {
        const res = await withdraw({ data: { code } });
        const entry = { model: res.model, quantity: res.quantity, at: now };
        setLast(entry);
        setLog((l) => [entry, ...l].slice(0, 30));
        if (navigator.vibrate) navigator.vibrate(60);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Scan failed";
        if (/Admin access|Unlock/i.test(message)) setLocked(true);
        else toast.error(message);
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
    };
  }, [locked, withdraw]);

  async function submitPassword(event: React.FormEvent) {
    event.preventDefault();
    setUnlocking(true);
    try {
      const result = await unlock({ data: { password } });
      if (!result.ok) {
        toast.error("Wrong password");
        return;
      }
      setPassword("");
      setLocked(false);
    } finally {
      setUnlocking(false);
    }
  }

  if (locked) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-6">
        <form onSubmit={submitPassword} className="w-full max-w-xs space-y-3">
          <h1 className="flex items-center gap-2 text-lg font-semibold">
            <Lock className="h-5 w-5" /> Enter password
          </h1>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoFocus
          />
          <Button type="submit" className="w-full" disabled={unlocking}>
            {unlocking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Start scanning
          </Button>
        </form>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col bg-black text-white">
      <div className="relative flex-1">
        {error ? (
          <p className="p-6 text-center text-sm text-red-300">{error}</p>
        ) : (
          <>
            <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
            <div className="pointer-events-none absolute inset-x-10 top-1/2 h-56 -translate-y-1/2 rounded-2xl border-2 border-white/80" />
            {cooldown > 0 && (
              <div className="absolute left-1/2 top-6 -translate-x-1/2 rounded-full bg-black/70 px-4 py-1 text-sm">
                Wait {cooldown}s
              </div>
            )}
          </>
        )}
        <canvas ref={canvasRef} className="hidden" />
      </div>

      <div className="space-y-2 bg-black/90 p-4">
        <p className="flex items-center gap-2 text-sm text-white/70">
          <QrCode className="h-4 w-4" /> 1 unit removed per scan, 3s between scans.
        </p>
        {last && (
          <p className="text-xl font-semibold">
            -1 {last.model} — {last.quantity} left
          </p>
        )}
        {log.length > 1 && (
          <div className="max-h-32 space-y-1 overflow-y-auto text-sm text-white/70">
            {log.slice(1).map((entry) => (
              <div key={entry.at} className="flex justify-between">
                <span className="truncate">{entry.model}</span>
                <span>{entry.quantity} left</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
