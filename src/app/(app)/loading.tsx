/** Shown while a signed-in page loads on the server: a calm skeleton, announced to screen readers. */
export default function Loading() {
  return (
    <div role="status" aria-live="polite" className="mx-auto max-w-[88rem] px-4 py-10 sm:px-6">
      <span className="sr-only">Loading… / लोड हुँदैछ…</span>
      <div className="h-10 w-2/3 max-w-md animate-pulse rounded bg-surface-2 motion-reduce:animate-none" />
      <div className="mt-3 h-5 w-full max-w-xl animate-pulse rounded bg-surface-2 motion-reduce:animate-none" />
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => <div key={i} className="h-40 animate-pulse rounded bg-surface-2 motion-reduce:animate-none" />)}
      </div>
    </div>
  );
}
