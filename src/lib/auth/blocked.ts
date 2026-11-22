import { NextResponse } from "next/server";

/** Turned off by an admin. Lives apart from http.ts, which imports controls.ts. */
export const failBlocked = (error: string) => NextResponse.json({ ok: false, error }, { status: 503 });
