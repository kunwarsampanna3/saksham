/** Which side(s) of Saksham an account uses. "both" sees the Hiring / Working switch; one role sees only its own side. */
export type KycRole = "client" | "provider" | "both";

export function kycRole(roles: readonly string[]): KycRole {
  const c = roles.includes("client"),
    p = roles.includes("provider");
  return c && p ? "both" : p ? "provider" : "client";
}

/** ID documents accepted in each KYC form. */
export const KYC_DOCS = {
  client: ["citizenship", "national_id", "passport", "driving_licence"],
  provider: ["citizenship", "national_id", "student_id", "driving_licence"],
  both: ["citizenship", "national_id", "passport", "driving_licence", "student_id"],
} as const;
export type DocType = (typeof KYC_DOCS)["both"][number];
/** Documents with no back side to photograph. */
export const BACK_OPTIONAL: readonly DocType[] = ["student_id", "passport"];
