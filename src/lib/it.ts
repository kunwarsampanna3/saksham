import type { CategoryId } from "@/lib/pricing";

/** Digital / IT work. Job seekers with any of these skills get the Upwork-style job feed on Home. */
export const IT_CATEGORIES: readonly CategoryId[] = ["web-design", "coding", "it-support", "graphic-design", "digital-marketing", "video-editing"];

export const isItWorker = (categories: readonly string[] | undefined) => (categories ?? []).some((c) => (IT_CATEGORIES as readonly string[]).includes(c));
