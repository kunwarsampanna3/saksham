"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ImagePlus, RefreshCw } from "lucide-react";

/**
 * Downscale a photo in the browser before upload (phones take 4–12 MB pictures).
 * Drawing to a canvas also drops EXIF metadata such as GPS; the server strips it again anyway.
 */
export async function shrinkImage(file: Blob, max = 2000, quality = 0.88): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions);
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, w, h);
    bmp.close();
    return await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("encode"))), "image/jpeg", quality));
  } catch {
    return file; // unsupported format in this browser: let the server validate it
  }
}

export function PhotoInput({
  label, value, onChange, capture, required, chooseLabel, changeLabel,
}: { chooseLabel: string; changeLabel: string; label: string; value: Blob | null; onChange: (b: Blob | null) => void; capture?: "user" | "environment"; required?: boolean }) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!value) { setUrl(null); return; }
    const u = URL.createObjectURL(value);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [value]);

  return (
    <div>
      <span className="field-label" id={`${id}-l`}>{label}{required && <span aria-hidden className="text-danger"> *</span>}</span>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => input.current?.click()}
          aria-labelledby={`${id}-l`}
          className="relative flex h-28 w-40 shrink-0 items-center justify-center overflow-hidden rounded-[4px] border-[1.5px] border-dashed border-line-strong bg-surface hover:border-accent"
        >
          {url
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={url} alt="" className="h-full w-full object-cover" />
            : <ImagePlus size={28} aria-hidden className="text-muted" />}
          {busy && <span className="absolute inset-0 animate-pulse bg-surface/60" aria-hidden />}
        </button>
        <button type="button" className="btn btn-quiet" onClick={() => input.current?.click()}>
          {value ? <><RefreshCw size={15} aria-hidden /> {changeLabel}</> : <><ImagePlus size={15} aria-hidden /> {chooseLabel}</>}
        </button>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture={capture}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          setBusy(true);
          onChange(await shrinkImage(f));
          setBusy(false);
        }}
      />
    </div>
  );
}
