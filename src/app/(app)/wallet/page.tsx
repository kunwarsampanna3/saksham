import type { Metadata } from "next";
import QRCode from "qrcode";
import { Contours } from "@/components/contours";
import { WalletView } from "@/components/wallet/wallet-view";
import { requireUser } from "@/lib/auth/current-user";
import { getDict } from "@/lib/i18n/server";
import { walletFor } from "@/lib/wallet";
import { config } from "@/lib/config";

export const metadata: Metadata = { title: "Wallet" };
export const dynamic = "force-dynamic";

export default async function WalletPage() {
  const [user, { t }] = await Promise.all([requireUser("/wallet"), getDict()]);
  const data = await walletFor(user);
  const passportUrl = `${config.appOrigin}/passport/${user.id}`;
  const qrSvg = await QRCode.toString(passportUrl, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#0E3B2C", light: "#FFFFFF" } });
  return (
    <div>
      <div className="relative overflow-hidden border-b border-line">
        <Contours seed={71} centers={1} rings={8} />
        <span lang="ne" aria-hidden className="deva-giant absolute -right-4 top-2 text-[7rem] sm:text-[11rem]">बचत</span>
        <div className="relative mx-auto max-w-[88rem] px-4 pb-8 pt-10 sm:px-6">
          <h1 className="font-display text-4xl font-extrabold sm:text-5xl">{t.wallet.title}</h1>
          <p className="mt-2 max-w-2xl text-lg text-muted">{t.wallet.lead}</p>
        </div>
      </div>
      <div className="mx-auto max-w-[88rem] px-4 py-10 sm:px-6">
        <WalletView data={data} isProvider={user.roles.includes("provider")} qrSvg={qrSvg} passportUrl={passportUrl} />
      </div>
    </div>
  );
}
