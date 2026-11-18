import type { CategoryId } from "@/lib/pricing";

/**
 * EXAMPLE tasks shown on Home and Explore until real tasks exist (moves to the database in step 5).
 * Every one is labelled "Example" on screen. No real people are named.
 */
export interface ExampleTask {
  id: string;
  category: CategoryId;
  title: { en: string; ne: string };
  city: string; // "Online" for remote work
  area?: string;
  /** small offset from the city centroid so distances differ inside a city */
  offset?: [number, number];
  days: number;
  quantity?: number;
  offers: number;
  postedMinutesAgo: number;
  womenOnly?: boolean;
  forFamilyAbroad?: string; // sender country
}

export const EXAMPLE_TASKS: ExampleTask[] = [
  { id: "ex-kurta", category: "tailoring", title: { en: "Stitch 5 cotton kurtas for my boutique", ne: "बुटिकका लागि ५ वटा सुती कुर्ता सिलाउनु छ" }, city: "Bhaktapur", area: "Suryabinayak", offset: [-0.006, 0.004], days: 3, quantity: 5, offers: 4, postedMinutesAgo: 35, womenOnly: true },
  { id: "ex-phone", category: "phone-repair", title: { en: "Replace cracked screen on a Redmi Note 12", ne: "Redmi Note 12 को फुटेको स्क्रिन फेर्नु छ" }, city: "Kathmandu", area: "New Road", offset: [-0.012, -0.012], days: 1, offers: 6, postedMinutesAgo: 12 },
  { id: "ex-maths", category: "tutoring", title: { en: "Maths tutor for Class 10 (SEE), 3 evenings a week", ne: "कक्षा १० (SEE) गणित ट्युसन, हप्तामा ३ साँझ" }, city: "Lalitpur", area: "Jawalakhel", offset: [0.004, -0.006], days: 12, offers: 3, postedMinutesAgo: 80 },
  { id: "ex-web", category: "web-design", title: { en: "Simple website with menu and map for our momo shop", ne: "हाम्रो मःम पसलका लागि मेनु र नक्सासहितको सानो वेबसाइट" }, city: "Online", days: 7, offers: 9, postedMinutesAgo: 140 },
  { id: "ex-tank", category: "plumbing", title: { en: "Fix leaking water tank at my parents' house", ne: "बुबाआमाको घरको चुहिने पानी ट्याङ्की बनाउनु छ" }, city: "Pokhara", area: "Lakeside", offset: [-0.01, -0.02], days: 1, offers: 2, postedMinutesAgo: 55, forFamilyAbroad: "Qatar" },
  { id: "ex-wiring", category: "electrician", title: { en: "Install 4 ceiling fans and check old wiring", ne: "४ वटा सिलिङ फ्यान जडान र पुरानो वायरिङ जाँच" }, city: "Biratnagar", area: "Traffic Chowk", days: 1, offers: 3, postedMinutesAgo: 200 },
  { id: "ex-mehendi", category: "beauty", title: { en: "Bridal mehendi for 6 people, Saturday morning", ne: "शनिबार बिहान ६ जनाका लागि दुलहीको मेहन्दी" }, city: "Janakpur", area: "Janaki Mandir", days: 1, offers: 5, postedMinutesAgo: 320, womenOnly: true },
  { id: "ex-care", category: "elder-care", title: { en: "Take my mother to her hospital check-up and collect medicine", ne: "आमालाई अस्पताल जाँचमा लैजाने र औषधि ल्याइदिने" }, city: "Bharatpur", area: "Narayangadh", days: 1, offers: 2, postedMinutesAgo: 95, forFamilyAbroad: "Malaysia" },
  { id: "ex-translate", category: "translation", title: { en: "Translate a 6-page shop agreement, Nepali to English", ne: "६ पेजको पसल सम्झौता नेपालीबाट अंग्रेजीमा अनुवाद" }, city: "Online", days: 2, quantity: 6, offers: 7, postedMinutesAgo: 410 },
  { id: "ex-move", category: "moving", title: { en: "Move a 2-room flat from Butwal to Bhairahawa", ne: "बुटवलबाट भैरहवा २ कोठाको सामान सार्नु छ" }, city: "Butwal", area: "Traffic Chowk", days: 1, offers: 3, postedMinutesAgo: 610 },
  { id: "ex-photo", category: "photography", title: { en: "Product photos for 40 dhaka shawls", ne: "४० वटा ढाका सलको उत्पादन फोटो" }, city: "Dharan", area: "Bhanu Chowk", days: 2, offers: 4, postedMinutesAgo: 260 },
  { id: "ex-clean", category: "cleaning", title: { en: "Deep clean a 3-bedroom flat before Dashain", ne: "दशैंअघि ३ कोठाको फ्ल्याट राम्ररी सफा गर्नु छ" }, city: "Kathmandu", area: "Baneshwor", offset: [-0.02, 0.016], days: 1, offers: 5, postedMinutesAgo: 25 },
  { id: "ex-laptop", category: "phone-repair", title: { en: "Laptop not charging — diagnose and repair", ne: "ल्यापटप चार्ज हुँदैन — जाँचेर बनाउनु छ" }, city: "Bhaktapur", area: "Kamalbinayak", offset: [0.004, 0.006], days: 1, offers: 2, postedMinutesAgo: 70 },
  { id: "ex-english", category: "tutoring", title: { en: "Spoken English practice for a job interview abroad", ne: "विदेशको जागिर अन्तर्वार्ताका लागि अंग्रेजी बोल्ने अभ्यास" }, city: "Online", days: 5, offers: 8, postedMinutesAgo: 180 },
];

