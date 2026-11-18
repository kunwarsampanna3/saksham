"use client";

import { useEffect, type RefObject } from "react";

/** Closes a popover on outside click or Escape, and returns focus to the trigger on Escape. */
export function useDismiss(open: boolean, close: () => void, refs: RefObject<HTMLElement | null>[], trigger?: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (refs.some((r) => r.current?.contains(e.target as Node))) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { close(); trigger?.current?.focus(); }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close, refs, trigger]);
}
