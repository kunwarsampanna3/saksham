/**
 * Faint topographic contour lines. Deterministic (seeded) so server and client markup match.
 * `animate` draws the lines in once (home hero); it is a no-op under prefers-reduced-motion.
 */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

function ring(cx: number, cy: number, r: number, wobble: number, rand: () => number): string {
  const pts = 18;
  const offs = Array.from({ length: pts }, () => 1 + (rand() - 0.5) * wobble);
  const p = offs.map((o, i) => {
    const a = (i / pts) * Math.PI * 2;
    return [cx + Math.cos(a) * r * o * 1.6, cy + Math.sin(a) * r * o];
  });
  // Catmull-Rom → cubic Bézier for a smooth closed loop
  let d = `M${p[0][0].toFixed(1)},${p[0][1].toFixed(1)}`;
  for (let i = 0; i < pts; i++) {
    const p0 = p[(i - 1 + pts) % pts], p1 = p[i], p2 = p[(i + 1) % pts], p3 = p[(i + 2) % pts];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d + "Z";
}

export function Contours({
  seed = 7, className = "", animate = false, centers = 2, rings = 9,
}: { seed?: number; className?: string; animate?: boolean; centers?: number; rings?: number }) {
  const rand = rng(seed);
  const paths: { d: string; delay: number }[] = [];
  for (let c = 0; c < centers; c++) {
    const cx = 150 + rand() * 900, cy = 100 + rand() * 400;
    for (let k = 1; k <= rings; k++) {
      paths.push({ d: ring(cx, cy, k * 34 + rand() * 10, 0.28 + k * 0.012, rand), delay: (c * rings + k) * 0.06 });
    }
  }
  return (
    <svg
      className={`pointer-events-none absolute inset-0 h-full w-full ${animate ? "contour-animate" : ""} ${className}`}
      viewBox="0 0 1200 600"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      {paths.map((p, i) => (
        <path key={i} d={p.d} className="contour-path" style={{ ["--delay" as string]: `${p.delay}s` }} />
      ))}
    </svg>
  );
}
