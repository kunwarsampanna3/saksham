import type { CategoryId } from "@/lib/pricing";
import type { PhotoKey } from "@/lib/photos";
import { areasFor, CITY_COORDS } from "@/lib/geo";

/**
 * EXAMPLE provider profiles shown until real providers sign up (moves to the database later).
 * Every card, profile and review built from this file is labelled "Example" on screen.
 * Names are short and generic on purpose; ratings and reviews are sample data, not real clients.
 * Photos are sample photos of places and work, never presented as the provider themselves.
 */
export interface ExampleReview {
  by: string;
  stars: number;
  text: { en: string; ne: string };
  monthsAgo: number;
}
export interface Service {
  en: string;
  ne: string;
  price: number;
  unit: { en: string; ne: string };
}

export interface ExampleProvider {
  id: string;
  name: string;
  kind: "person" | "group";
  headline: { en: string; ne: string };
  bio: { en: string; ne: string };
  categories: CategoryId[];
  city: string;
  area: string;
  radiusKm: number;
  onlineOk: boolean;
  womenLed: boolean;
  verification: { phone: boolean; id: boolean; selfie: boolean; address: boolean; womenGroup?: boolean };
  level: 1 | 2 | 3 | 4;
  rating: number;
  ratingCount: number;
  jobsDone: number;
  responseMinutes: number;
  priceMin: number;
  priceMax: number;
  languages: string[];
  memberSince: string; // YYYY-MM
  services: Service[];
  cover: PhotoKey;
  portfolio: PhotoKey[];
  /** Mon..Sun availability (true = usually free) */
  week: [boolean, boolean, boolean, boolean, boolean, boolean, boolean];
  reviews: ExampleReview[];
  demoPersona?: "bikash" | "aasha";
  /** A real Saksham account (not example data): no "Example" labels, real ratings only. */
  isReal?: boolean;
}

const u = (en: string, ne: string) => ({ en, ne });
const ALL: [true, true, true, true, true, true, true] = [true, true, true, true, true, true, true];

export const EXAMPLE_PROVIDERS: ExampleProvider[] = [
  {
    id: "bikash-tamang",
    name: "Bikash Tamang",
    kind: "person",
    demoPersona: "bikash",
    headline: u("Phone repair and small websites", "फोन मर्मत र साना वेबसाइट"),
    bio: u(
      "IT student in Kathmandu. I fix phone screens, batteries and charging ports at my desk in Baneshwor, and build simple websites for shops online.",
      "काठमाडौंमा आईटी पढ्दै छु। बानेश्वरमा फोनको स्क्रिन, ब्याट्री र चार्जिङ पोर्ट बनाउँछु, र पसलहरूका लागि सानो वेबसाइट अनलाइन बनाउँछु।",
    ),
    categories: ["phone-repair", "web-design", "it-support", "coding"],
    city: "Kathmandu",
    area: "Baneshwor",
    radiusKm: 8,
    onlineOk: true,
    womenLed: false,
    verification: { phone: true, id: true, selfie: true, address: false },
    level: 2,
    rating: 4.6,
    ratingCount: 18,
    jobsDone: 23,
    responseMinutes: 20,
    priceMin: 800,
    priceMax: 25000,
    languages: ["Nepali", "English", "Tamang"],
    memberSince: "2026-03",
    services: [
      {
        ...u("Screen replacement (Android)", "स्क्रिन फेर्ने (एन्ड्रोइड)"),
        price: 2500,
        unit: u("per phone + part", "प्रति फोन + पार्ट"),
      },
      {
        ...u("Battery or charging port", "ब्याट्री वा चार्जिङ पोर्ट"),
        price: 1200,
        unit: u("per phone", "प्रति फोन"),
      },
      {
        ...u("One-page shop website", "पसलको एक पेज वेबसाइट"),
        price: 12000,
        unit: u("per project", "प्रति प्रोजेक्ट"),
      },
    ],
    cover: "tutoring",
    portfolio: ["tutoring", "shop"],
    week: [false, false, true, true, false, true, true],
    reviews: [
      {
        by: "S. Maharjan",
        stars: 5,
        text: u(
          "Fixed my screen the same evening and explained the part price first.",
          "उही साँझ स्क्रिन बनाइदिनुभयो र पहिले पार्टको मूल्य बताउनुभयो।",
        ),
        monthsAgo: 1,
      },
      {
        by: "R. Adhikari",
        stars: 4,
        text: u(
          "Good website for our momo shop. One day late, but kept us updated.",
          "हाम्रो मःम पसलको राम्रो वेबसाइट। एक दिन ढिला भयो, तर खबर गरिरहनुभयो।",
        ),
        monthsAgo: 3,
      },
    ],
  },
  {
    id: "aasha-tailoring-group",
    name: "Aasha's Tailoring Group",
    kind: "group",
    demoPersona: "aasha",
    headline: u("Women-led tailoring group · bulk orders", "महिला नेतृत्वको सिलाइ समूह · ठूला अर्डर"),
    bio: u(
      "Six women who sew from home in Suryabinayak. Kurtas, blouses, school uniforms and boutique batches, with fittings at your shop.",
      "सूर्यविनायकमा घरबाटै सिलाइ गर्ने छ जना महिला। कुर्ता, चोलो, स्कुल पोशाक र बुटिकका लागि थोक, तपाईंकै पसलमा नाप।",
    ),
    categories: ["tailoring"],
    city: "Bhaktapur",
    area: "Suryabinayak",
    radiusKm: 12,
    onlineOk: false,
    womenLed: true,
    verification: { phone: true, id: true, selfie: true, address: true, womenGroup: true },
    level: 3,
    rating: 4.8,
    ratingCount: 31,
    jobsDone: 46,
    responseMinutes: 45,
    priceMin: 600,
    priceMax: 40000,
    languages: ["Nepali", "Newari"],
    memberSince: "2025-11",
    services: [
      { ...u("Cotton kurta, stitched", "सुती कुर्ता सिलाइ"), price: 900, unit: u("per piece", "प्रति थान") },
      { ...u("Blouse with lining", "लाइनिङसहितको चोलो"), price: 1100, unit: u("per piece", "प्रति थान") },
      { ...u("School uniform set", "स्कुल पोशाक सेट"), price: 1500, unit: u("per set (10+)", "प्रति सेट (१०+)") },
    ],
    cover: "tailoring",
    portfolio: ["tailoring", "crafts"],
    week: [true, true, true, true, true, true, false],
    reviews: [
      {
        by: "M. Shrestha",
        stars: 5,
        text: u("40 uniforms delivered on time, every size checked.", "४० वटा पोशाक समयमै, हरेक साइज जाँचेर।"),
        monthsAgo: 2,
      },
      {
        by: "P. Karki",
        stars: 5,
        text: u("Neat stitching and fair price for a small batch.", "सफा सिलाइ र सानो अर्डरमा पनि उचित मूल्य।"),
        monthsAgo: 4,
      },
    ],
  },
  {
    id: "sunita-k",
    name: "Sunita K.",
    kind: "person",
    headline: u("Maths and science tutor, Class 8–12", "गणित र विज्ञान ट्युटर, कक्षा ८–१२"),
    bio: u(
      "Teacher with seven years in Lalitpur schools. SEE and +2 maths, physics. Home visits in Lalitpur or online.",
      "ललितपुरका विद्यालयमा सात वर्ष पढाएको। SEE र +२ गणित, भौतिक। ललितपुरमा घरमै वा अनलाइन।",
    ),
    categories: ["tutoring"],
    city: "Lalitpur",
    area: "Jawalakhel",
    radiusKm: 5,
    onlineOk: true,
    womenLed: true,
    verification: { phone: true, id: true, selfie: true, address: true },
    level: 4,
    rating: 4.9,
    ratingCount: 52,
    jobsDone: 64,
    responseMinutes: 30,
    priceMin: 700,
    priceMax: 1500,
    languages: ["Nepali", "English"],
    memberSince: "2025-08",
    services: [
      {
        ...u("One-to-one session, 1 hour", "एक्लै पढाइ, १ घण्टा"),
        price: 900,
        unit: u("per session", "प्रति सत्र"),
      },
      {
        ...u("SEE exam prep, 12 sessions", "SEE तयारी, १२ सत्र"),
        price: 9500,
        unit: u("per course", "प्रति कोर्स"),
      },
    ],
    cover: "tutoring",
    portfolio: ["tutoring"],
    week: [true, true, true, true, true, false, false],
    reviews: [
      {
        by: "A. Joshi",
        stars: 5,
        text: u("My son finally understands algebra.", "छोराले अन्ततः बीजगणित बुझ्यो।"),
        monthsAgo: 1,
      },
    ],
  },
  {
    id: "ramesh-electric",
    name: "Ramesh Electric Works",
    kind: "person",
    headline: u(
      "Licensed electrician · wiring, fans, inverters",
      "इजाजतप्राप्त बिजुली मिस्त्री · वायरिङ, पंखा, इन्भर्टर",
    ),
    bio: u(
      "House wiring, ceiling fans, inverter and solar backup in Biratnagar and Itahari.",
      "विराटनगर र इटहरीमा घरको वायरिङ, पंखा, इन्भर्टर र सोलार ब्याकअप।",
    ),
    categories: ["electrician"],
    city: "Biratnagar",
    area: "Traffic Chowk",
    radiusKm: 20,
    onlineOk: false,
    womenLed: false,
    verification: { phone: true, id: true, selfie: true, address: true },
    level: 3,
    rating: 4.5,
    ratingCount: 27,
    jobsDone: 39,
    responseMinutes: 60,
    priceMin: 700,
    priceMax: 15000,
    languages: ["Nepali", "Maithili"],
    memberSince: "2025-10",
    services: [
      { ...u("Ceiling fan install", "सिलिङ फ्यान जडान"), price: 600, unit: u("per fan", "प्रति फ्यान") },
      {
        ...u("Wiring check, 2–3 rooms", "वायरिङ जाँच, २–३ कोठा"),
        price: 1500,
        unit: u("per visit", "प्रति भ्रमण"),
      },
    ],
    cover: "shop",
    portfolio: ["shop"],
    week: ALL,
    reviews: [
      {
        by: "D. Yadav",
        stars: 4,
        text: u("Careful work, cleaned up after.", "होसियारीसाथ काम, पछि सफा पनि गर्नुभयो।"),
        monthsAgo: 2,
      },
    ],
  },
  {
    id: "lakeside-plumbing",
    name: "Lakeside Plumbing",
    kind: "person",
    headline: u("Tanks, taps and leaks in Pokhara", "पोखरामा ट्याङ्की, धारा र चुहावट"),
    bio: u(
      "Water tanks, pumps, taps and bathroom leaks. Often booked by families abroad for parents' homes.",
      "पानी ट्याङ्की, पम्प, धारा र बाथरुमको चुहावट। विदेशमा रहेका परिवारले प्रायः बुबाआमाको घरका लागि बुक गर्छन्।",
    ),
    categories: ["plumbing"],
    city: "Pokhara",
    area: "Lakeside",
    radiusKm: 15,
    onlineOk: false,
    womenLed: false,
    verification: { phone: true, id: true, selfie: true, address: true },
    level: 2,
    rating: 4.4,
    ratingCount: 14,
    jobsDone: 21,
    responseMinutes: 40,
    priceMin: 700,
    priceMax: 6000,
    languages: ["Nepali", "Gurung"],
    memberSince: "2026-01",
    services: [
      { ...u("Leak repair", "चुहावट मर्मत"), price: 1200, unit: u("per visit", "प्रति भ्रमण") },
      { ...u("Tank cleaning", "ट्याङ्की सफाइ"), price: 2500, unit: u("per tank", "प्रति ट्याङ्की") },
    ],
    cover: "terraces",
    portfolio: ["terraces"],
    week: [true, true, false, true, true, true, true],
    reviews: [
      {
        by: "K. Gurung",
        stars: 5,
        text: u(
          "Sent photos to me in Doha after fixing Mum's tank.",
          "आमाको ट्याङ्की बनाएपछि दोहामा मलाई फोटो पठाउनुभयो।",
        ),
        monthsAgo: 1,
      },
    ],
  },
  {
    id: "maya-mehendi",
    name: "Maya Mehendi Studio",
    kind: "person",
    headline: u("Bridal and festival mehendi", "दुलही र चाडपर्वको मेहन्दी"),
    bio: u(
      "Bridal mehendi, Teej and wedding groups in Janakpur. Natural henna only.",
      "जनकपुरमा दुलही मेहन्दी, तीज र बिहेका समूह। प्राकृतिक मेहन्दी मात्र।",
    ),
    categories: ["beauty"],
    city: "Janakpur",
    area: "City centre",
    radiusKm: 10,
    onlineOk: false,
    womenLed: true,
    verification: { phone: true, id: true, selfie: true, address: false },
    level: 2,
    rating: 4.7,
    ratingCount: 22,
    jobsDone: 30,
    responseMinutes: 25,
    priceMin: 1000,
    priceMax: 12000,
    languages: ["Nepali", "Maithili", "Hindi"],
    memberSince: "2026-02",
    services: [
      { ...u("Bridal mehendi, full", "दुलही मेहन्दी, पूरा"), price: 6000, unit: u("per bride", "प्रति दुलही") },
      { ...u("Guest mehendi", "पाहुना मेहन्दी"), price: 500, unit: u("per person", "प्रति व्यक्ति") },
    ],
    cover: "beauty",
    portfolio: ["beauty", "crafts"],
    week: [false, true, true, true, true, true, true],
    reviews: [
      {
        by: "N. Jha",
        stars: 5,
        text: u("Beautiful work for six of us before the wedding.", "बिहेअघि हामी छ जनाका लागि सुन्दर काम।"),
        monthsAgo: 5,
      },
    ],
  },
  {
    id: "priya-translations",
    name: "Priya S.",
    kind: "person",
    headline: u("Nepali ↔ English translation and CVs", "नेपाली ↔ अंग्रेजी अनुवाद र CV"),
    bio: u(
      "Translator for agreements, school documents and job CVs for work abroad. Fully online.",
      "सम्झौता, शैक्षिक कागजात र विदेशको जागिरका लागि CV अनुवाद। पूरै अनलाइन।",
    ),
    categories: ["translation"],
    city: "Kathmandu",
    area: "Maharajgunj",
    radiusKm: 5,
    onlineOk: true,
    womenLed: true,
    verification: { phone: true, id: true, selfie: true, address: true },
    level: 3,
    rating: 4.8,
    ratingCount: 40,
    jobsDone: 58,
    responseMinutes: 15,
    priceMin: 400,
    priceMax: 8000,
    languages: ["Nepali", "English", "Hindi"],
    memberSince: "2025-09",
    services: [
      { ...u("Document translation", "कागजात अनुवाद"), price: 500, unit: u("per page", "प्रति पेज") },
      { ...u("CV for work abroad", "विदेशको जागिरका लागि CV"), price: 1500, unit: u("per CV", "प्रति CV") },
    ],
    cover: "tutoring",
    portfolio: ["tutoring"],
    week: ALL,
    reviews: [
      {
        by: "B. Rai",
        stars: 5,
        text: u("Quick and accurate, delivered in a day.", "छिटो र सही, एक दिनमै।"),
        monthsAgo: 2,
      },
    ],
  },
  {
    id: "kiran-web",
    name: "Kiran Web Studio",
    kind: "person",
    headline: u("Shop websites and Facebook pages", "पसलका वेबसाइट र फेसबुक पेज"),
    bio: u(
      "Small-business websites, online menus and Facebook shop setup, from Pokhara for anywhere in Nepal.",
      "साना व्यवसायका वेबसाइट, अनलाइन मेनु र फेसबुक पसल, पोखराबाट नेपालभरि।",
    ),
    categories: ["web-design", "coding", "digital-marketing"],
    city: "Pokhara",
    area: "Chipledhunga",
    radiusKm: 5,
    onlineOk: true,
    womenLed: false,
    verification: { phone: true, id: true, selfie: false, address: false },
    level: 2,
    rating: 4.3,
    ratingCount: 9,
    jobsDone: 12,
    responseMinutes: 90,
    priceMin: 8000,
    priceMax: 45000,
    languages: ["Nepali", "English"],
    memberSince: "2026-04",
    services: [
      { ...u("One-page website", "एक पेज वेबसाइट"), price: 10000, unit: u("per project", "प्रति प्रोजेक्ट") },
    ],
    cover: "tutoring",
    portfolio: ["tutoring"],
    week: [true, true, true, true, true, false, false],
    reviews: [],
  },
  {
    id: "pixel-lab",
    name: "Pixel Lab Studio",
    kind: "group",
    headline: u("UI/UX and brand design", "UI/UX र ब्रान्ड डिजाइन"),
    bio: u(
      "App screens, websites and logos, designed in Figma, from Lalitpur for clients anywhere.",
      "Figma मा एप स्क्रिन, वेबसाइट र लोगो, ललितपुरबाट जहाँसुकैका ग्राहकलाई।",
    ),
    categories: ["graphic-design", "web-design"],
    city: "Lalitpur",
    area: "Jawalakhel",
    radiusKm: 8,
    onlineOk: true,
    womenLed: true,
    verification: { phone: true, id: true, selfie: true, address: false },
    level: 1,
    rating: 0,
    ratingCount: 0,
    jobsDone: 0,
    responseMinutes: 30,
    priceMin: 2000,
    priceMax: 40000,
    languages: ["Nepali", "English"],
    memberSince: "2026-10",
    services: [
      {
        ...u("5 app screens in Figma", "Figma मा ५ एप स्क्रिन"),
        price: 12000,
        unit: u("per project", "प्रति प्रोजेक्ट"),
      },
    ],
    cover: "tutoring",
    portfolio: [],
    week: [true, true, true, true, true, false, false],
    reviews: [],
  },
  {
    id: "code-sathi",
    name: "Code Sathi",
    kind: "person",
    headline: u("React, Python and IT support", "React, Python र IT सपोर्ट"),
    bio: u(
      "Bug fixes, small web apps, scripts and office IT set-up in Kathmandu.",
      "काठमाडौंमा बग सच्याउने, साना वेब एप, स्क्रिप्ट र कार्यालय IT सेटअप।",
    ),
    categories: ["coding", "it-support", "web-design"],
    city: "Kathmandu",
    area: "Baneshwor",
    radiusKm: 10,
    onlineOk: true,
    womenLed: false,
    verification: { phone: true, id: true, selfie: true, address: false },
    level: 1,
    rating: 0,
    ratingCount: 0,
    jobsDone: 0,
    responseMinutes: 45,
    priceMin: 1500,
    priceMax: 50000,
    languages: ["Nepali", "English"],
    memberSince: "2026-10",
    services: [
      { ...u("Bug fix, up to 3 hours", "बग सच्याउने, ३ घण्टासम्म"), price: 3000, unit: u("per job", "प्रति काम") },
    ],
    cover: "tutoring",
    portfolio: [],
    week: ALL,
    reviews: [],
  },
  {
    id: "reel-studio",
    name: "Reel Studio Butwal",
    kind: "person",
    headline: u("Short videos and social media ads", "छोटा भिडियो र सामाजिक सञ्जाल विज्ञापन"),
    bio: u(
      "Reels, product videos and Facebook ad campaigns for small businesses, done online.",
      "साना व्यवसायका लागि Reels, उत्पादन भिडियो र फेसबुक विज्ञापन, अनलाइन।",
    ),
    categories: ["video-editing", "digital-marketing"],
    city: "Butwal",
    area: "Traffic Chowk",
    radiusKm: 10,
    onlineOk: true,
    womenLed: false,
    verification: { phone: true, id: true, selfie: false, address: false },
    level: 1,
    rating: 0,
    ratingCount: 0,
    jobsDone: 0,
    responseMinutes: 60,
    priceMin: 1500,
    priceMax: 25000,
    languages: ["Nepali", "English"],
    memberSince: "2026-11",
    services: [
      { ...u("One edited Reel", "एउटा सम्पादित Reel"), price: 1800, unit: u("per video", "प्रति भिडियो") },
    ],
    cover: "crafts",
    portfolio: [],
    week: ALL,
    reviews: [],
  },
  {
    id: "clean-home-ktm",
    name: "CleanHome Koteshwor",
    kind: "group",
    headline: u("Home and office deep cleaning", "घर र कार्यालयको राम्रो सफाइ"),
    bio: u(
      "Team of four for deep cleans before festivals, moving in, or after building work.",
      "चाडपर्वअघि, सर्दा, वा निर्माणपछि सफाइका लागि चार जनाको टोली।",
    ),
    categories: ["cleaning"],
    city: "Kathmandu",
    area: "Koteshwor",
    radiusKm: 10,
    onlineOk: false,
    womenLed: false,
    verification: { phone: true, id: true, selfie: true, address: true },
    level: 3,
    rating: 4.5,
    ratingCount: 33,
    jobsDone: 41,
    responseMinutes: 35,
    priceMin: 1500,
    priceMax: 9000,
    languages: ["Nepali"],
    memberSince: "2025-12",
    services: [
      {
        ...u("2-bedroom flat deep clean", "२ कोठाको फ्ल्याट सफाइ"),
        price: 3500,
        unit: u("per visit", "प्रति भ्रमण"),
      },
    ],
    cover: "shop",
    portfolio: ["shop"],
    week: [true, true, true, true, true, true, false],
    reviews: [
      {
        by: "L. Thapa",
        stars: 4,
        text: u("Very thorough kitchen clean.", "भान्सा धेरै राम्ररी सफा।"),
        monthsAgo: 1,
      },
    ],
  },
  {
    id: "sita-care",
    name: "Sita B.",
    kind: "person",
    headline: u("Care and errands for elderly parents", "वृद्ध बुबाआमाको हेरचाह र काम"),
    bio: u(
      "Hospital visits, medicine pick-up and daily check-ins in Bharatpur. I send updates to family abroad.",
      "भरतपुरमा अस्पताल लैजाने, औषधि ल्याइदिने र दैनिक हेरचाह। विदेशमा रहेका परिवारलाई खबर पठाउँछु।",
    ),
    categories: ["elder-care"],
    city: "Bharatpur",
    area: "City centre",
    radiusKm: 10,
    onlineOk: false,
    womenLed: true,
    verification: { phone: true, id: true, selfie: true, address: true },
    level: 2,
    rating: 4.9,
    ratingCount: 16,
    jobsDone: 19,
    responseMinutes: 20,
    priceMin: 1200,
    priceMax: 3500,
    languages: ["Nepali", "Tharu"],
    memberSince: "2026-02",
    services: [
      {
        ...u("Hospital visit, half day", "अस्पताल भ्रमण, आधा दिन"),
        price: 1500,
        unit: u("per visit", "प्रति भ्रमण"),
      },
    ],
    cover: "paddy",
    portfolio: ["paddy"],
    week: ALL,
    reviews: [
      {
        by: "H. Chaudhary",
        stars: 5,
        text: u(
          "Calm and kind with my father. Called me in Kuala Lumpur after.",
          "बुबासँग शान्त र दयालु। पछि मलाई क्वालालम्पुरमा फोन गर्नुभयो।",
        ),
        monthsAgo: 2,
      },
    ],
  },
  {
    id: "nabin-photo",
    name: "Nabin Photo",
    kind: "person",
    headline: u("Product photos and small events", "उत्पादन फोटो र साना कार्यक्रम"),
    bio: u(
      "Product photos for online shops and small family events in Dharan.",
      "धरानमा अनलाइन पसलका उत्पादन फोटो र साना पारिवारिक कार्यक्रम।",
    ),
    categories: ["photography"],
    city: "Dharan",
    area: "City centre",
    radiusKm: 25,
    onlineOk: false,
    womenLed: false,
    verification: { phone: true, id: false, selfie: false, address: false },
    level: 1,
    rating: 4.2,
    ratingCount: 5,
    jobsDone: 6,
    responseMinutes: 120,
    priceMin: 4000,
    priceMax: 20000,
    languages: ["Nepali", "Limbu"],
    memberSince: "2026-06",
    services: [
      {
        ...u("Product photos, up to 30 items", "उत्पादन फोटो, ३० वटासम्म"),
        price: 6000,
        unit: u("per batch", "प्रति ब्याच"),
      },
    ],
    cover: "crafts",
    portfolio: ["crafts"],
    week: [false, true, true, true, true, true, true],
    reviews: [],
  },
  {
    id: "deepak-repair",
    name: "Deepak Mobile Care",
    kind: "person",
    headline: u("Phone and laptop repair counter", "फोन र ल्यापटप मर्मत काउन्टर"),
    bio: u(
      "Repair counter near Pulchowk. Screens, software, laptop charging faults.",
      "पुल्चोक नजिक मर्मत काउन्टर। स्क्रिन, सफ्टवेयर, ल्यापटप चार्जिङ समस्या।",
    ),
    categories: ["phone-repair", "it-support"],
    city: "Lalitpur",
    area: "Pulchowk",
    radiusKm: 4,
    onlineOk: false,
    womenLed: false,
    verification: { phone: true, id: false, selfie: false, address: false },
    level: 1,
    rating: 4.0,
    ratingCount: 3,
    jobsDone: 4,
    responseMinutes: 15,
    priceMin: 800,
    priceMax: 7000,
    languages: ["Nepali", "English"],
    memberSince: "2026-09",
    services: [
      {
        ...u("Laptop charging fault diagnosis", "ल्यापटप चार्जिङ समस्या जाँच"),
        price: 500,
        unit: u("per device", "प्रति उपकरण"),
      },
    ],
    cover: "shop",
    portfolio: ["shop"],
    week: ALL,
    reviews: [],
  },
  {
    id: "anju-tailor",
    name: "Anju Tailors",
    kind: "person",
    headline: u("Alterations and blouses", "लुगा मिलाउने र चोलो"),
    bio: u(
      "Quick alterations and blouses in Kalanki. New on Saksham.",
      "कलंकीमा छिटो लुगा मिलाउने र चोलो। सक्षममा नयाँ।",
    ),
    categories: ["tailoring"],
    city: "Kathmandu",
    area: "Kalanki",
    radiusKm: 6,
    onlineOk: false,
    womenLed: true,
    verification: { phone: true, id: false, selfie: false, address: false },
    level: 1,
    rating: 0,
    ratingCount: 0,
    jobsDone: 0,
    responseMinutes: 30,
    priceMin: 300,
    priceMax: 2000,
    languages: ["Nepali"],
    memberSince: "2026-11",
    services: [
      { ...u("Hem or fit alteration", "लम्बाइ वा नाप मिलाउने"), price: 300, unit: u("per item", "प्रति थान") },
    ],
    cover: "tailoring",
    portfolio: ["tailoring"],
    week: [true, true, true, true, true, true, false],
    reviews: [],
  },
  {
    id: "pradeep-movers",
    name: "Pradeep Movers",
    kind: "group",
    headline: u("Small moves and deliveries", "साना सामान सार्ने र डेलिभरी"),
    bio: u(
      "Pickup truck and two helpers for flat moves between Butwal, Bhairahawa and Tansen.",
      "बुटवल, भैरहवा र तानसेन बीच फ्ल्याट सार्न पिकअप र दुई सहयोगी।",
    ),
    categories: ["moving"],
    city: "Butwal",
    area: "City centre",
    radiusKm: 40,
    onlineOk: false,
    womenLed: false,
    verification: { phone: true, id: true, selfie: true, address: true },
    level: 2,
    rating: 4.4,
    ratingCount: 11,
    jobsDone: 15,
    responseMinutes: 50,
    priceMin: 1500,
    priceMax: 12000,
    languages: ["Nepali", "Magar"],
    memberSince: "2026-03",
    services: [
      {
        ...u("2-room move, same city", "२ कोठा सार्ने, उही शहर"),
        price: 4000,
        unit: u("per trip", "प्रति ट्रिप"),
      },
    ],
    cover: "terraces",
    portfolio: ["terraces"],
    week: ALL,
    reviews: [
      {
        by: "G. Pun",
        stars: 4,
        text: u("On time and careful with the fridge.", "समयमै र फ्रिजमा होसियार।"),
        monthsAgo: 3,
      },
    ],
  },
];

export const isVerified = (p: ExampleProvider) =>
  p.verification.phone && p.verification.id && p.verification.selfie;

export function providerCoords(p: ExampleProvider): [number, number] {
  const a = areasFor(p.city).find((x) => x.name === p.area);
  if (a) return [a.lat, a.lng];
  return CITY_COORDS[p.city] ?? CITY_COORDS.Kathmandu;
}

export const getProvider = (id: string) => EXAMPLE_PROVIDERS.find((p) => p.id === id) ?? null;
