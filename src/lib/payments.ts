import "server-only";
import { randomBytes } from "node:crypto";
import type { PayMethod } from "@/lib/store/types";
import { nepalDay } from "@/lib/nepal-time";

/** References for sandbox payments. No real money moves in this build. */
const NAME: Record<PayMethod, string> = {
  esewa_sandbox: "ESEWA",
  khalti_sandbox: "KHALTI",
  card_sandbox: "CARD",
};

export const receiptNo = () =>
  `SK-${nepalDay().replace(/-/g, "")}-${randomBytes(3).toString("hex").toUpperCase()}`;
export const sandboxRef = (m: PayMethod) => `${NAME[m]}-SBX-${randomBytes(5).toString("hex").toUpperCase()}`;
