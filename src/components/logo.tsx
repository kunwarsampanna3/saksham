import Link from "next/link";

/** Terrace mark: three stepped fields rising to the right, with a contour line. */
export function LogoMark({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <rect width="40" height="40" rx="6" fill="var(--forest)" />
      <path d="M6 31h28v3H6z" fill="var(--leaf)" />
      <path d="M10 24h24v4.5H10z" fill="var(--paddy)" />
      <path d="M16 17h18v4.5H16z" fill="var(--leaf)" opacity=".85" />
      <path d="M23 10h11v4.5H23z" fill="var(--marigold)" />
      <path
        d="M5 21c5-1 7-6 13-7s9-6 17-7"
        fill="none"
        stroke="#E7F3EA"
        strokeOpacity=".5"
        strokeWidth="1.2"
      />
    </svg>
  );
}

export function Logo({
  href = "/",
  compact = false,
  onDark = false,
}: {
  href?: string;
  compact?: boolean;
  onDark?: boolean;
}) {
  return (
    <Link
      href={href}
      className="group inline-flex items-center gap-2.5 rounded-sm"
      aria-label="Saksham — home"
    >
      <LogoMark />
      {!compact && (
        <span className="flex flex-col leading-none">
          <span
            className={`font-display text-[1.35rem] font-extrabold tracking-tight ${onDark ? "text-white" : "text-text"}`}
          >
            Saksham
          </span>
          <span
            lang="ne"
            className={`deva text-[0.78rem] leading-none font-semibold ${onDark ? "text-leaf" : "text-accent"}`}
          >
            सक्षम
          </span>
        </span>
      )}
    </Link>
  );
}
