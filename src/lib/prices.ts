import "server-only";
import { store } from "@/lib/store";
import { fairRange, type PriceOverrideLite } from "@/lib/pricing";

/** Admin edits to the price table, keyed by category. Plain data; the AI never touches it. */
export async function priceOverrides(): Promise<Record<string, PriceOverrideLite>> {
  const list = await store.listPriceOverrides();
  return Object.fromEntries(list.map((p) => [p.category, { low: p.low, high: p.high, perDay: p.perDay }]));
}

/** fairRange with any admin override for that category applied. */
export async function fairRangeLive(input: Omit<Parameters<typeof fairRange>[0], "override">) {
  const o = (await priceOverrides())[input.category];
  return fairRange({ ...input, override: o });
}
