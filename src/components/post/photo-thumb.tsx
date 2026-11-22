"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

/** A small preview of a chosen photo, with an optional remove button. */
export function PhotoThumb({
  blob,
  onRemove,
  small,
}: {
  blob: Blob;
  onRemove?: () => void;
  small?: boolean;
}) {
  const [url, setUrl] = useState<string>("");
  useEffect(() => {
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return (
    <li
      className={`bg-surface-2 relative overflow-hidden rounded-[4px] ${small ? "h-12 w-16" : "h-20 w-24"}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {url && <img src={url} alt="" className="h-full w-full object-cover" />}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove photo"
          className="absolute top-1 right-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white"
        >
          <X size={13} aria-hidden />
        </button>
      )}
    </li>
  );
}
