import "server-only";
import { useSupabase } from "@/lib/config";
import { fileStore } from "./file-store";
import { supabaseStore } from "./supabase-store";
import type { PublicUser, Store, User } from "./types";
import { maskPhone } from "@/lib/validation";

export const store: Store = useSupabase ? supabaseStore : fileStore;
export const storeKind = useSupabase ? "supabase" : "file";

export function toPublicUser(u: User): PublicUser {
  return {
    id: u.id,
    phoneMasked: maskPhone(u.phone),
    name: u.name,
    city: u.city,
    roles: u.roles,
    activeRole: u.activeRole,
    lang: u.lang,
    isDemo: u.isDemo,
    isAdmin: u.isAdmin,
    hasPasskey: u.passkeys.length > 0,
    gender: u.gender,
    area: u.area,
    radiusKm: u.radiusKm,
    verified: !!u.verified,
    womenLed: !!u.womenLed,
  };
}

export type { User, PublicUser, Role, OtpRecord, Verification, VerificationKind, VerificationStatus, StoredFile } from "./types";

/** Women-only requests are visible to women providers only. */
export const canSeeWomenOnly = (u: Pick<User, "gender" | "roles" | "womenLed">) =>
  (u.gender === "female" || !!u.womenLed) && u.roles.includes("provider");
