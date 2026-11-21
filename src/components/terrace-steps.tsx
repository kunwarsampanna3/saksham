/** Stepped progress: each step is a terrace that rises as you go. */
export function TerraceSteps({
  steps,
  current,
  label,
}: {
  steps: readonly string[];
  current: number;
  label: string;
}) {
  return (
    <nav aria-label={label} className="mb-6">
      <ol className="flex items-end gap-1.5">
        {steps.map((s, i) => {
          const state = i < current ? "done" : i === current ? "current" : "todo";
          return (
            <li key={s} className="flex-1" aria-current={state === "current" ? "step" : undefined}>
              <div
                className={`w-full transition-all duration-500 ${
                  state === "todo" ? "bg-line" : state === "current" ? "bg-accent" : "bg-leaf"
                }`}
                style={{ height: `${6 + i * 4}px` }}
                aria-hidden
              />
              <span
                className={`mt-1.5 block truncate text-xs font-semibold ${state === "todo" ? "text-muted" : "text-text"}`}
              >
                <span className="sr-only">{`${i + 1}/${steps.length}: `}</span>
                {s}
                {state === "done" && <span className="sr-only"> ✓</span>}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
