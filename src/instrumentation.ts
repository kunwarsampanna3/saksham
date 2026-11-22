/** Next.js calls this once when a server starts. */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // A build must never touch real data.
    if (process.env.NEXT_PHASE === "phase-production-build") return;
    const { startRetention } = await import("@/lib/retention");
    startRetention();
    const { startPostClock } = await import("@/lib/posting");
    startPostClock();
  }
}
