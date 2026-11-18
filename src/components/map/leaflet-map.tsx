"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { NEPAL_CENTER } from "@/lib/geo";

export interface Pin {
  id: string;
  lat: number;
  lng: number;
  kind: "task" | "provider" | "you";
  label: string;
  sub?: string;
  href?: string;
}

/** Escape text for Leaflet popup HTML (popups are HTML strings). */
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/**
 * Leaflet map with OpenStreetMap tiles. Client-only (loaded via next/dynamic).
 * Pins mark area centroids only. The list next to the map is the accessible primary view.
 */
export default function LeafletMap({
  pins, center, zoom, radiusKm, label, fit = true,
}: { pins: Pin[]; center?: [number, number]; zoom?: number; radiusKm?: number; label: string; fit?: boolean }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const refit = useRef<() => void>(() => {});

  useEffect(() => {
    if (!el.current || map.current) return;
    map.current = L.map(el.current, {
      center: center ?? NEPAL_CENTER,
      zoom: zoom ?? 7,
      minZoom: 6,
      maxBounds: L.latLngBounds([25.5, 79.5], [31, 89]),
      scrollWheelZoom: false,
      attributionControl: true,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map.current);
    layer.current = L.layerGroup().addTo(map.current);
    // Containers that start hidden (e.g. a collapsed panel) have no size; re-measure when they appear.
    let wasEmpty = el.current.clientWidth === 0;
    const ro = new ResizeObserver(() => {
      if (!map.current || !el.current) return;
      map.current.invalidateSize();
      if (wasEmpty && el.current.clientWidth > 0) { wasEmpty = false; refit.current(); }
    });
    ro.observe(el.current);
    return () => { ro.disconnect(); map.current?.remove(); map.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const m = map.current, g = layer.current;
    if (!m || !g) return;
    g.clearLayers();
    const pts: L.LatLngExpression[] = [];
    for (const p of pins) {
      const icon = L.divIcon({
        className: "",
        html: `<span class="map-pin map-pin--${p.kind}" aria-hidden="true"></span>`,
        iconSize: [22, 22],
        iconAnchor: [11, 22],
        popupAnchor: [0, -20],
      });
      const mk = L.marker([p.lat, p.lng], { icon, title: p.label, alt: p.label, keyboard: true });
      const body = `<strong>${esc(p.label)}</strong>${p.sub ? `<br><span>${esc(p.sub)}</span>` : ""}${p.href ? `<br><a href="${esc(p.href)}">→</a>` : ""}`;
      mk.bindPopup(body);
      g.addLayer(mk);
      pts.push([p.lat, p.lng]);
      if (p.kind === "you" && radiusKm) {
        g.addLayer(L.circle([p.lat, p.lng], { radius: radiusKm * 1000, color: "#1E8E4E", weight: 1.5, fillColor: "#6CC36A", fillOpacity: 0.12 }));
      }
    }
    refit.current = () => {
      if (center) m.setView(center, zoom ?? m.getZoom());
      else if (fit && pts.length > 1) m.fitBounds(L.latLngBounds(pts), { padding: [30, 30], maxZoom: 13 });
      else if (fit && pts.length === 1) m.setView(pts[0], 12);
    };
    if (el.current && el.current.clientWidth > 0) refit.current();
  }, [pins, center, zoom, radiusKm, fit]);

  return <div ref={el} role="region" aria-label={label} className="h-full w-full" />;
}
