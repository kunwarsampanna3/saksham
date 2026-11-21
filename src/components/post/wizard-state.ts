import { ABROAD_COUNTRIES, CITY_COORDS } from "@/lib/geo";
import type { CategoryId } from "@/lib/pricing";

/** Where the task details came from: Claude, keyword matching, or typed by hand. */
export type Source = "ai" | "fallback" | "manual";

export type AbroadCountry = (typeof ABROAD_COUNTRIES)[number];

/** A draft saved in sessionStorage ("sk_draft") by the home task box or a provider profile. */
export interface Draft {
  text?: string;
  task?: {
    category: CategoryId;
    title: string;
    details: string;
    days: number;
    quantity?: number;
    online: boolean;
  };
  source?: Source;
  providerId?: string;
  providerName?: string;
  mode?: "quote" | "book";
  city?: string;
  area?: string;
  family?: { country: AbroadCountry; familyName: string };
}

/** Everything the person fills in across the three wizard steps. */
export interface WizardFields {
  // Step 1: what
  text: string;
  cat: CategoryId | "";
  title: string;
  details: string;
  quantity: number;
  days: number;
  source: Source;
  photos: Blob[];
  // Step 2: where and when
  online: boolean;
  city: string;
  area: string;
  flexible: boolean;
  dueDate: string;
  familyOn: boolean;
  country: AbroadCountry;
  familyName: string;
  // Step 3: price
  budget: number | null;
  womenOnly: boolean;
}

/** Merge a change into the form. Pass a function when the change depends on the current values. */
export type UpdateFields = (
  patch: Partial<WizardFields> | ((current: WizardFields) => Partial<WizardFields>),
) => void;

export const CITIES = Object.keys(CITY_COORDS);

export const todayIso = () => new Date().toISOString().slice(0, 10);

export function initialFields(homeCity: string, homeArea?: string): WizardFields {
  return {
    text: "",
    cat: "",
    title: "",
    details: "",
    quantity: 1,
    days: 1,
    source: "manual",
    photos: [],
    online: false,
    city: CITIES.includes(homeCity) ? homeCity : "Kathmandu",
    area: homeArea ?? "",
    flexible: true,
    dueDate: "",
    familyOn: false,
    country: "Qatar",
    familyName: "",
    budget: null,
    womenOnly: false,
  };
}
