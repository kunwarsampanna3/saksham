"use client";

import dynamic from "next/dynamic";
import type { Pin } from "./leaflet-map";

/** Leaflet touches `window`, so it only ever loads in the browser. */
const LeafletMap = dynamic(() => import("./leaflet-map"), {
  ssr: false,
  loading: () => <div className="bg-surface-2 h-full w-full animate-pulse" aria-hidden />,
});

export type { Pin };
export function NepalMap(props: {
  pins: Pin[];
  center?: [number, number];
  zoom?: number;
  radiusKm?: number;
  label: string;
  fit?: boolean;
}) {
  return <LeafletMap {...props} />;
}
