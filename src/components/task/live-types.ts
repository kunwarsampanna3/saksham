import type { ReasonCode } from "@/lib/rules";

/** One provider's offer on a task, as the live task page shows it. */
export interface Offer {
  id: string;
  providerId: string;
  providerName: string;
  profileHref: string | null;
  isExample: boolean;
  amount: number;
  days: number;
  message: string;
  status: "active" | "accepted" | "declined" | "withdrawn";
  counter?: { amount: number; status: "pending" | "accepted" | "declined" };
  rating: number;
  ratingCount: number;
  jobs: number;
  verified: boolean;
  womenLed: boolean;
  distanceKm: number | null;
  score: number;
  reasons: ReasonCode[];
  best: boolean;
  mine: boolean;
}

/** A public question on a task and the owner's answer. */
export interface QA {
  id: string;
  askerName: string;
  body: string;
  answer: string | null;
  mine: boolean;
}

/** Everything on the task page that changes while it is open (polled every 5 s). */
export interface Live {
  status: string;
  agreedPrice: number | null;
  acceptedBidId: string | null;
  offers: Offer[];
  questions: QA[];
  owner: boolean;
}
