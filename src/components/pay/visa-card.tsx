import { useI18n } from "@/components/providers";

/**
 * A picture of Visa's published test card. It is not a form: no real card number is ever typed, sent or stored.
 * A real launch replaces this with a licensed gateway's own hosted card page.
 */
export function VisaCard() {
  const { t } = useI18n();
  return (
    <div
      role="img"
      aria-label={`${t.abroadJobs.visa}, ${t.booking.testCard}: 4242`}
      className="rounded-[14px] bg-gradient-to-br from-[#1a1f71] to-[#2b59c3] p-4 text-white shadow"
    >
      <div className="flex items-start justify-between">
        <span className="rounded bg-white/20 px-2 py-0.5 text-[0.68rem] font-bold tracking-widest uppercase">
          {t.booking.testCard}
        </span>
        <span className="text-2xl leading-none font-black tracking-tight italic">VISA</span>
      </div>
      <span
        className="mt-3 block h-6 w-9 rounded bg-gradient-to-br from-[#f5d77a] to-[#b8902f]"
        aria-hidden
      />
      <p className="mt-2 font-mono text-base tracking-[0.14em] sm:text-lg">4242 4242 4242 4242</p>
      <div className="mt-2 flex justify-between font-mono text-xs text-white/85">
        <span className="uppercase">{t.abroadJobs.visaHolder}</span>
        <span>12/30</span>
      </div>
    </div>
  );
}
