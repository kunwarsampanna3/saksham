"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Crosshair, Check, ShieldCheck } from "lucide-react";
import { NepalMap, type Pin } from "@/components/map/map";
import { postJson, useI18n, useUser } from "@/components/providers";
import { areasFor, CITY_COORDS, haversineKm, nearestCity } from "@/lib/geo";
import type { PublicUser } from "@/lib/store/types";

const CITIES = Object.keys(CITY_COORDS);

export function LocationForm({
  initialCity, initialArea, initialRadius, isProvider, pins,
}: { initialCity: string; initialArea?: string; initialRadius: number; isProvider: boolean; pins: Pin[] }) {
  const { t, lang } = useI18n();
  const l = t.location;
  const { setUser } = useUser();
  const router = useRouter();
  const [city, setCity] = useState(CITIES.includes(initialCity) ? initialCity : "Kathmandu");
  const areas = useMemo(() => areasFor(city), [city]);
  const [area, setArea] = useState(initialArea && areas.some((a) => a.name === initialArea) ? initialArea : areas[0]?.name ?? "");
  const [radius, setRadius] = useState(initialRadius);
  const [status, setStatus] = useState<{ kind: "info" | "error" | "ok"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const current = areas.find((a) => a.name === area) ?? areas[0];
  const here: [number, number] = current ? [current.lat, current.lng] : CITY_COORDS[city];

  const nearbyPins = useMemo(() => {
    const limit = isProvider ? radius + 5 : 30;
    return pins.filter((p) => haversineKm(here, [p.lat, p.lng]) <= limit);
  }, [pins, here, radius, isProvider]);

  const allPins: Pin[] = [{ id: "you", lat: here[0], lng: here[1], kind: "you", label: l.you, sub: `${current?.[lang === "ne" ? "ne" : "name"] ?? ""}, ${city}` }, ...nearbyPins];

  const locate = () => {
    if (!("geolocation" in navigator)) { setStatus({ kind: "error", text: l.unavailable }); return; }
    setStatus({ kind: "info", text: l.locating });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // Used only here, in the browser, to pick the nearest area. Never sent to the server.
        const { latitude, longitude } = pos.coords;
        const near = nearestCity(latitude, longitude);
        if (near.km > 60) { setStatus({ kind: "error", text: l.outside }); return; }
        const list = areasFor(near.city);
        const best = list.reduce((a, b) => (haversineKm([latitude, longitude], [a.lat, a.lng]) <= haversineKm([latitude, longitude], [b.lat, b.lng]) ? a : b));
        setCity(near.city);
        setArea(best.name);
        setStatus({ kind: "ok", text: l.found(near.city, lang === "ne" ? best.ne : best.name) });
      },
      (err) => setStatus({ kind: "error", text: err.code === err.PERMISSION_DENIED ? l.denied : l.unavailable }),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  };

  const save = async () => {
    setBusy(true);
    const r = await postJson<{ user: PublicUser }>("/api/location", { city, area, ...(isProvider ? { radiusKm: radius } : {}) });
    setBusy(false);
    if (r.ok) {
      setUser(r.user);
      setStatus({ kind: "ok", text: l.saved });
      router.refresh();
    } else setStatus({ kind: "error", text: r.error === "offline" ? t.errors.offline : t.errors.generic });
  };

  return (
    <div className="grid gap-8 lg:grid-cols-12">
      <form className="space-y-6 lg:col-span-5" onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <button type="button" onClick={locate} className="btn btn-ghost w-full sm:w-auto">
          <Crosshair size={18} aria-hidden /> {l.useMine}
        </button>
        <p className="-mt-3 flex items-start gap-1.5 text-xs text-muted"><ShieldCheck size={14} aria-hidden className="mt-0.5 shrink-0" /> {l.privacy}</p>

        <div className="grid gap-4 xs:grid-cols-2">
          <label className="block">
            <span className="field-label">{l.city}</span>
            <select className="input appearance-none" value={city} onChange={(e) => { setCity(e.target.value); setArea(areasFor(e.target.value)[0]?.name ?? ""); setStatus(null); }}>
              {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="field-label">{l.area}</span>
            <select className="input appearance-none" value={area} onChange={(e) => { setArea(e.target.value); setStatus(null); }}>
              {areas.map((a) => <option key={a.name} value={a.name}>{lang === "ne" ? a.ne : a.name}</option>)}
            </select>
          </label>
        </div>

        {isProvider && (
          <div>
            <label htmlFor="radius" className="field-label">{l.radius}: <span className="text-accent">{l.radiusValue(radius)}</span></label>
            <p className="field-hint !mt-0 mb-2">{l.radiusLead}</p>
            <input id="radius" type="range" min={1} max={50} step={1} value={radius} onChange={(e) => setRadius(Number(e.target.value))}
              aria-valuetext={l.radiusValue(radius)} className="w-full accent-[var(--accent)]" />
            <div className="flex justify-between text-xs text-muted"><span>1 km</span><span>25 km</span><span>50 km</span></div>
          </div>
        )}

        <div aria-live="polite" className="min-h-6">
          {status && (
            <p className={`text-sm font-semibold ${status.kind === "error" ? "text-danger" : status.kind === "ok" ? "text-accent" : "text-muted"}`}>
              {status.kind === "ok" && <Check size={15} aria-hidden className="mr-1 inline" />}{status.text}
            </p>
          )}
        </div>

        <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? t.common.loading : l.save}</button>
        <p className="text-sm text-muted">{l.onlineNote}</p>
      </form>

      <section className="lg:col-span-7" aria-labelledby="loc-map-h">
        <h2 id="loc-map-h" className="font-display text-xl font-bold">{l.map}</h2>
        <div className="mt-3 flex flex-wrap gap-4 text-sm">
          <span className="inline-flex items-center gap-1.5"><span className="map-pin map-pin--you !h-4 !w-4" aria-hidden /> {l.you}</span>
          <span className="inline-flex items-center gap-1.5"><span className="map-pin map-pin--task !h-4 !w-4" aria-hidden /> {l.job}</span>
          <span className="inline-flex items-center gap-1.5"><span className="map-pin map-pin--provider !h-4 !w-4" aria-hidden /> {l.provider}</span>
        </div>
        <div className="notch-frame mt-3">
          <div className="notch-card h-[26rem] overflow-hidden sm:h-[32rem]">
            <NepalMap pins={allPins} center={here} zoom={isProvider ? (radius > 20 ? 10 : radius > 8 ? 11 : 12) : 12} radiusKm={isProvider ? radius : undefined} label={l.map} fit={false} />
          </div>
        </div>
        <p className="mt-2 text-xs text-muted">{t.explore.mapNote}</p>
      </section>
    </div>
  );
}
