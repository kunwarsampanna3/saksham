"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, X } from "lucide-react";

/** Front-camera capture. Stops every track when closed or unmounted. */
export function SelfieCamera({ labels, onCapture, onClose, onDenied }: {
  labels: { capture: string; close: string };
  onCapture: (b: Blob) => void;
  onClose: () => void;
  onDenied: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false });
        if (cancelled) { s.getTracks().forEach((t) => t.stop()); return; }
        stream.current = s;
        if (video.current) { video.current.srcObject = s; await video.current.play().catch(() => {}); setReady(true); }
      } catch {
        onDenied();
      }
    })();
    return () => { cancelled = true; stream.current?.getTracks().forEach((t) => t.stop()); };
  }, [onDenied]);

  const snap = () => {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement("canvas");
    c.width = v.videoWidth; c.height = v.videoHeight;
    const ctx = c.getContext("2d")!;
    ctx.translate(c.width, 0); ctx.scale(-1, 1); // un-mirror so the saved photo matches the ID orientation
    ctx.drawImage(v, 0, 0);
    c.toBlob((b) => { if (b) { onCapture(b); onClose(); } }, "image/jpeg", 0.9);
  };

  return (
    <div className="rounded-[4px] border border-line bg-ink p-2">
      <div className="relative mx-auto aspect-[4/3] max-w-md overflow-hidden rounded-[3px] bg-black">
        <video ref={video} playsInline muted className="h-full w-full -scale-x-100 object-cover" aria-label="Camera preview" />
        {/* face guide */}
        <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 h-[70%] w-[46%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border-2 border-dashed border-white/70" />
      </div>
      <div className="mt-2 flex justify-center gap-2">
        <button type="button" className="btn btn-primary" onClick={snap} disabled={!ready}><Camera size={18} aria-hidden /> {labels.capture}</button>
        <button type="button" className="btn btn-ghost !border-white/40 !text-white" onClick={onClose}><X size={18} aria-hidden /> {labels.close}</button>
      </div>
    </div>
  );
}
