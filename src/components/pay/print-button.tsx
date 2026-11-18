"use client";

import { Printer } from "lucide-react";

export function PrintButton({ label }: { label: string }) {
  return (
    <button type="button" className="btn btn-ghost" onClick={() => window.print()}>
      <Printer size={17} aria-hidden /> {label}
    </button>
  );
}
