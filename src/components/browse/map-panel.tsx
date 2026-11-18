"use client";

import { useState } from "react";
import { Map as MapIcon, List } from "lucide-react";
import { NepalMap, type Pin } from "@/components/map/map";
import { useI18n } from "@/components/providers";

/** One map instance: sticky beside the list on desktop, toggled open on phones. */
export function MapPanel({ pins }: { pins: Pin[] }) {
  const { t } = useI18n();
  const e = t.explore;
  const [open, setOpen] = useState(false);
  return (
    <div className="lg:sticky lg:top-[calc(var(--header-h)+16px)]">
      <button type="button" className="btn btn-ghost !min-h-11 w-full lg:hidden" aria-expanded={open} aria-controls="results-map" onClick={() => setOpen((o) => !o)}>
        {open ? <List size={17} aria-hidden /> : <MapIcon size={17} aria-hidden />} {open ? e.list : e.map}
      </button>
      <div id="results-map" className={`${open ? "block" : "hidden"} mt-3 lg:mt-0 lg:block`}>
        <div className="notch-frame">
          <div className="notch-card h-72 overflow-hidden sm:h-96 lg:h-[calc(100dvh-var(--header-h)-6rem)] lg:min-h-[26rem]">
            <NepalMap pins={pins} label={e.mapLabel} />
          </div>
        </div>
        <p className="mt-2 text-xs text-muted">{e.mapNote}</p>
      </div>
    </div>
  );
}
