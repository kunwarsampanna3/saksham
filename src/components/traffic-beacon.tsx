"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { postJson } from "@/components/providers";

const STILL_HERE_MS = 60_000;

/** Tells the server which page was opened, and that this person is still here. */
export function TrafficBeacon() {
  const path = usePathname();
  const router = useRouter();
  useEffect(() => {
    // A family member's private link: never send its token anywhere else.
    const page = path.startsWith("/confirm/") ? "/confirm" : path;
    const send = async (view: boolean) => {
      const r = await postJson<{ block?: string | null }>("/api/traffic", {
        path: page.slice(0, 300),
        view,
        mobile: window.matchMedia("(max-width: 767px)").matches,
      });
      // The layouts draw the paused screen. Refresh when what they drew is out of date.
      if (r.ok && document.querySelector("[data-app-frame]") && r.block) router.refresh();
      else if (r.ok && document.querySelector("[data-paused]") && !r.block) router.refresh();
    };
    void send(true);
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void send(false);
    }, STILL_HERE_MS);
    return () => clearInterval(timer);
  }, [path, router]);
  return null;
}
