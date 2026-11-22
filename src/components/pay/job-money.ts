import { splitAdvance } from "@/lib/business";
import { rs } from "@/lib/format";
import type { Dict, Lang } from "@/lib/i18n/dict";
import type { PayDetails } from "./pay-sheet";

/** What the payment sheet says for each of a job's three payments. */
export function jobPayment(
  step: "first" | "second" | "last",
  x: { t: Dict; lang: Lang; total: number; task: string; name: string },
): PayDetails {
  const { t, lang, total, task, name } = x;
  const m = t.market.money;
  const s = t.booking.sheet;
  const split = splitAdvance(total);
  const first = step === "first";

  if (step === "last")
    return {
      rows: [
        [s.for, task],
        [s.releaseTo, name],
        [s.amount, rs(split.payouts.finish, lang)],
        [m.releaseRow, m.releaseLater],
      ],
      note: s.releaseNote,
      doneTitle: s.releasedTitle,
      doneNote: s.releasedNote(name, rs(split.payouts.finish, lang)),
    };

  const sent = rs(first ? split.payouts.advance : split.payouts.half, lang);
  const held = rs(first ? split.pieces.kept : split.payouts.finish, lang);
  return {
    rows: [
      [s.for, task],
      [s.amount, rs(first ? split.firstPayment : split.secondPayment, lang)],
      [`${m.sentNow} (30%)`, sent],
      [`${m.heldNow} (${first ? "20" : "40"}%)`, held],
    ],
    note: m.payNote,
    doneTitle: first ? m.advanceDone : m.secondDone,
    doneNote: first ? m.advanceNote(name, sent) : m.secondNote(name, sent, held),
  };
}
