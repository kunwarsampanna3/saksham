import "server-only";
import type { NextResponse } from "next/server";
import { fail } from "@/lib/auth/http";
import { currentUser } from "@/lib/auth/current-user";
import { getSession, needsPaymentReauth } from "@/lib/auth/session";
import { store } from "@/lib/store";
import type { Booking, User } from "@/lib/store/types";
import { roleIn } from "@/lib/escrow";

/** Signed-in user who is a party to the booking (or an admin). Others get 404. */
export async function loadBooking(
  id: string,
): Promise<{ user: User; booking: Booking } | { res: NextResponse }> {
  const user = await currentUser();
  if (!user) return { res: fail(401, "signed_out") };
  if (!/^[0-9a-f-]{36}$/.test(id)) return { res: fail(404, "not_found") };
  const booking = await store.getBooking(id);
  if (!booking || (!roleIn(booking, user) && !user.isAdmin)) return { res: fail(404, "not_found") };
  return { user, booking };
}

/** Money actions need the MPIN entered within the last 5 minutes — enforced here, not only in the UI. */
export async function requireFreshMpin(): Promise<NextResponse | null> {
  const s = await getSession();
  if (!s) return fail(401, "signed_out");
  return needsPaymentReauth(s) ? fail(401, "reauth_required") : null;
}
