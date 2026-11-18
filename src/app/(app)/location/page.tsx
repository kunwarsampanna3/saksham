import type { Metadata } from "next";
import { Contours } from "@/components/contours";
import { LocationForm } from "@/components/browse/location-form";
import type { Pin } from "@/components/map/map";
import { requireUser } from "@/lib/auth/current-user";
import { getDict } from "@/lib/i18n/server";
import { EXAMPLE_PROVIDERS, providerCoords } from "@/lib/seed/providers";
import { openTasksFor } from "@/lib/task-search";
import { realProviders } from "@/lib/real-providers";

export const metadata: Metadata = { title: "Location" };

export default async function LocationPage() {
  const [user, { t, lang }] = await Promise.all([requireUser("/location"), getDict()]);
  const l = t.location;

  const pins: Pin[] = [
    ...(await openTasksFor(user)).flatMap((x) =>
      x.coords ? [{ id: x.id, lat: x.coords[0], lng: x.coords[1], kind: "task" as const, label: x.title[lang], href: `/task/${x.id}` }] : []),
    ...(user.isDemo ? EXAMPLE_PROVIDERS : await realProviders()).map((p) => {
      const c = providerCoords(p);
      return { id: p.id, lat: c[0], lng: c[1], kind: "provider" as const, label: p.name, sub: p.area ? `${p.area}, ${p.city}` : p.city, href: `/profile/${p.id}` };
    }),
  ];

  return (
    <div>
      <div className="relative overflow-hidden border-b border-line">
        <Contours seed={63} centers={1} rings={9} />
        <div className="relative mx-auto max-w-[88rem] px-4 pb-8 pt-10 sm:px-6">
          <h1 className="font-display text-4xl font-extrabold sm:text-5xl">{l.title}</h1>
          <p className="mt-2 max-w-2xl text-lg text-muted">{l.lead}</p>
        </div>
      </div>
      <div className="mx-auto max-w-[88rem] px-4 py-10 sm:px-6">
        <LocationForm
          initialCity={user.city}
          initialArea={user.area}
          initialRadius={user.radiusKm ?? 10}
          isProvider={user.roles.includes("provider")}
          pins={pins}
        />
      </div>
    </div>
  );
}
