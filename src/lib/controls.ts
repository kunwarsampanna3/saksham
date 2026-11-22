import "server-only";
import type { NextResponse } from "next/server";
import { store } from "@/lib/store";
import type { SiteControls, User } from "@/lib/store/types";
import { isOnline, onlineCount } from "@/lib/presence";
import { failBlocked } from "@/lib/auth/blocked";
import { countBlocked } from "@/lib/traffic";

/** The switches on Admin → Traffic, and where they bite. Admins are never blocked. */
export const DEFAULT_CONTROLS: SiteControls = {
  signups: true,
  posting: true,
  applying: true,
  maintenance: false,
  maxOnline: 0,
};

export const getControls = async (): Promise<SiteControls> => ({
  ...DEFAULT_CONTROLS,
  ...(await store.getControls()),
});

export async function switchedOff(
  what: "signups" | "posting" | "applying",
  user: Pick<User, "isAdmin"> | null,
): Promise<NextResponse | null> {
  if (user?.isAdmin || (await getControls())[what]) return null;
  countBlocked();
  return failBlocked(`${what}_paused`);
}

export type SiteBlock = "maintenance" | "busy";

/** `who` is the visitor's presence key. People already on the site keep their place when it fills up. */
export async function siteBlock(
  user: Pick<User, "isAdmin"> | null,
  who: string | null,
): Promise<SiteBlock | null> {
  if (user?.isAdmin) return null;
  const c = await getControls();
  if (c.maintenance) return "maintenance";
  if (c.maxOnline > 0 && !(who && isOnline(who)) && onlineCount() >= c.maxOnline) return "busy";
  return null;
}
