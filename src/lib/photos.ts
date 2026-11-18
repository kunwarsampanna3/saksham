import "server-only";
import { existsSync } from "node:fs";
import path from "node:path";

/**
 * Photo registry. Every photo used in the UI is declared here with its credit and licence,
 * mirrored in /CREDITS.md and listed on /credits. Rules (from the brief):
 *  - only own, consented, or commercially licensed photos;
 *  - stand-ins are labelled "Sample photo" on screen (isSample: true);
 *  - stock photos are never presented as real providers or testimonials.
 * Files are 1280–1600px WebP in /public/photos; next/image serves sized AVIF/WebP from them.
 * A photo whose file is missing renders the terrace graphic instead, so nothing breaks.
 */
export interface Photo {
  src: string;
  alt: { en: string; ne: string };
  credit: string;
  license: string;
  licenseUrl: string;
  source: string;
  isSample: boolean;
  width: number;
  height: number;
  /** object-position for crops */
  focus?: string;
}

const BY_SA_4 = { license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/" };
const BY_SA_3 = { license: "CC BY-SA 3.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/" };
const BY_SA_2 = { license: "CC BY-SA 2.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/2.0/" };
const BY_3 = { license: "CC BY 3.0", licenseUrl: "https://creativecommons.org/licenses/by/3.0/" };
const commons = (f: string) => `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(f.replace(/ /g, "_"))}`;

export const PHOTOS = {
  login: {
    src: "/photos/bhaktapur-street.webp", width: 1600, height: 2408, focus: "50% 70%",
    alt: { en: "A narrow brick lane in Bhaktapur with two students walking and a woman at a doorway", ne: "भक्तपुरको साँघुरो इँटाको गल्ली, जहाँ दुई विद्यार्थी हिँड्दै छन् र एक महिला ढोकामा छिन्" },
    credit: "Andrew and Annemarie", ...BY_SA_2, source: commons("Street in Bhaktapur 14101188206.jpg"), isSample: true,
  },
  hero: {
    src: "/photos/bhaktapur-lane.webp", width: 1600, height: 1067, focus: "50% 55%",
    alt: { en: "A busy old street in Bhaktapur lined with brick houses and small shops", ne: "इँटाका घर र साना पसलहरू भएको भक्तपुरको चहलपहल भएको पुरानो सडक" },
    credit: "Ander Romero Aldana", ...BY_SA_4, source: commons("Street of Bhaktapur.jpg"), isSample: true,
  },
  tailoring: {
    src: "/photos/tailor-workshop.webp", width: 1600, height: 1200,
    alt: { en: "A street-side tailoring workshop in Janakpur with sewing machines on wooden tables", ne: "जनकपुरको सडकछेउको सिलाइ पसल, काठको टेबलमा सिलाइ मेसिनहरू" },
    credit: "Ralf Lotys (Sicherlich)", ...BY_3, source: commons("2009-03 Janakpur 33.jpg"), isSample: true,
  },
  tutoring: {
    src: "/photos/computer-lab.webp", width: 1600, height: 1200,
    alt: { en: "Young women working at computers in a classroom in Nepal", ne: "नेपालको एउटा कक्षाकोठामा कम्प्युटरमा काम गर्दै युवतीहरू" },
    credit: "Prakash Neupane (OKFN Nepal)", ...BY_SA_3, source: commons("Girls in ICT in Nepal.jpg"), isSample: true,
  },
  beauty: {
    src: "/photos/barber-shop.webp", width: 1600, height: 2133, focus: "60% 40%",
    alt: { en: "A barber cutting a customer's hair in a small Kathmandu salon", ne: "काठमाडौंको सानो सैलुनमा ग्राहकको कपाल काट्दै गरेका कपाल काट्ने" },
    credit: "Gaurav Dhwaj Khadka", ...BY_SA_4, source: commons("Barber Shop in Kathmandu.jpg"), isSample: true,
  },
  crafts: {
    src: "/photos/craft-shop.webp", width: 1280, height: 1707,
    alt: { en: "A small shop packed with hand-knitted and felt bags, scarves and garlands", ne: "हातले बुनेका र फेल्टका झोला, सल र मालाले भरिएको सानो पसल" },
    credit: "Holynow", ...BY_SA_3, source: commons("Freak street trade.jpg"), isSample: true,
  },
  shop: {
    src: "/photos/corner-shop.webp", width: 1600, height: 1067,
    alt: { en: "A cat sitting on rice sacks outside a Kathmandu corner shop", ne: "काठमाडौंको किराना पसलअगाडि चामलका बोरामा बसेको बिरालो" },
    credit: "Alexey Komarov", ...BY_SA_4, source: commons("Citizen of Kathmandu.jpg"), isSample: true,
  },
  terraces: {
    src: "/photos/terraces-tansen.webp", width: 1600, height: 1067,
    alt: { en: "Terraced fields stepping down a green hillside near Tansen", ne: "तानसेन नजिक हरियो पहाडमा तल झर्दै गएका गरा खेतहरू" },
    credit: "Gerd Eichmann", ...BY_SA_4, source: commons("Pokhara-Tansen-38-Terrassen-2013-gje.jpg"), isSample: true,
  },
  paddy: {
    src: "/photos/terraces-bahundanda.webp", width: 1280, height: 845,
    alt: { en: "Golden paddy terraces around a village in Bahundanda", ne: "बाहुनडाँडाको गाउँ वरिपरि पहेँलो धानका गराहरू" },
    credit: "Till Niermann", ...BY_SA_3, source: commons("Paddy fields Bahundanda Nepal.jpg"), isSample: true,
  },
} satisfies Record<string, Photo>;

export type PhotoKey = keyof typeof PHOTOS;

export function photo(key: PhotoKey): Photo | null {
  const p: Photo = PHOTOS[key];
  return existsSync(path.join(process.cwd(), "public", p.src)) ? p : null;
}
