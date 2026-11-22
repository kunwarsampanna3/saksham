import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Mukta } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { TrafficBeacon } from "@/components/traffic-beacon";
import { getCity, getDict, getThemePref } from "@/lib/i18n/server";
import { currentPublicUser } from "@/lib/auth/current-user";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  display: "swap",
  weight: ["700", "800"],
});
const mukta = Mukta({
  subsets: ["latin", "devanagari"],
  variable: "--font-mukta",
  display: "swap",
  weight: ["400", "600", "700"],
});

export const metadata: Metadata = {
  title: { default: "Saksham — Your skill. Your price.", template: "%s · Saksham" },
  description:
    "A skills marketplace for all of Nepal. Post a task, get fair offers from verified applicants, pay safely in installments.",
  applicationName: "Saksham",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
  appleWebApp: { capable: true, title: "Saksham", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F6F8F2" },
    { media: "(prefers-color-scheme: dark)", color: "#08150F" },
  ],
};

/** Runs before paint so there is no light/dark flash. */
const themeBoot = `(()=>{try{var p=document.cookie.match(/(?:^|; )theme=(light|dark)/);var d=p?p[1]==='dark':matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.dataset.theme=d?'dark':'light'}catch(e){}})()`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [{ lang }, theme, user] = await Promise.all([getDict(), getThemePref(), currentPublicUser()]);
  const city = await getCity(user?.city);
  return (
    <html
      lang={lang}
      className={`${bricolage.variable} ${mukta.variable}`}
      data-theme={theme === "system" ? undefined : theme}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBoot }} />
      </head>
      <body className="min-h-dvh antialiased">
        <Providers initialLang={lang} initialTheme={theme} initialUser={user} initialCity={city}>
          {children}
          <TrafficBeacon />
        </Providers>
      </body>
    </html>
  );
}
