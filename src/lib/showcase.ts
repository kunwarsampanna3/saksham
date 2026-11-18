import type { CategoryId } from "@/lib/pricing";

/**
 * Example tasks for the home page "See what you can get done" section.
 * These are ideas, not real completed jobs: the UI labels them as examples and shows the
 * fair price range from the price table (never invented prices or reviews).
 */
export type ThemeId = "moving" | "repairs" | "business" | "events" | "study" | "family";
export interface ShowcaseTask { cat: CategoryId; en: string; ne: string; qty?: number; days?: number }

export const THEMES: { id: ThemeId; tasks: ShowcaseTask[] }[] = [
  { id: "moving", tasks: [
    { cat: "moving", en: "Shift a 2-room flat in Kathmandu", ne: "काठमाडौँमा २ कोठाको डेरा सार्ने" },
    { cat: "moving", en: "Carry a fridge to the 3rd floor", ne: "फ्रिज तेस्रो तलामा बोक्ने" },
    { cat: "cleaning", en: "Deep clean before moving out", ne: "डेरा छाड्नुअघि राम्रो सफाइ" },
    { cat: "assembly", en: "Put together a new wardrobe", ne: "नयाँ दराज जोड्ने" },
    { cat: "electrician", en: "Fit lights and fans in a new flat", ne: "नयाँ डेरामा बत्ती र पंखा जडान" },
    { cat: "it-support", en: "Set up Wi-Fi in the new house", ne: "नयाँ घरमा वाइफाइ जडान" },
    { cat: "painting", en: "Paint two rooms", ne: "दुई कोठा रङ्गाउने", days: 2 },
    { cat: "plumbing", en: "Fix a leaking kitchen tap", ne: "भान्साको चुहिने धारा बनाउने" },
  ] },
  { id: "repairs", tasks: [
    { cat: "plumbing", en: "Water tank leaking on the roof", ne: "छतको पानी ट्याङ्की चुहियो" },
    { cat: "electrician", en: "Inverter not charging", ne: "इन्भर्टर चार्ज भएन" },
    { cat: "appliances", en: "Washing machine not spinning", ne: "वासिङ मेसिन घुमेन" },
    { cat: "carpentry", en: "Repair a broken door", ne: "भाँचिएको ढोका मर्मत" },
    { cat: "roofing", en: "Stop roof leaks before the monsoon", ne: "बर्खाअघि छाना चुहावट रोक्ने" },
    { cat: "welding", en: "Fix the main gate", ne: "मूल गेट मर्मत" },
    { cat: "pest-control", en: "Get rid of cockroaches", ne: "साङ्ला हटाउने" },
    { cat: "handyman", en: "Hang curtains and shelves", ne: "पर्दा र दराज टाँग्ने" },
  ] },
  { id: "business", tasks: [
    { cat: "web-design", en: "Website for my new café", ne: "नयाँ क्याफेका लागि वेबसाइट" },
    { cat: "graphic-design", en: "Logo and menu design", ne: "लोगो र मेनु डिजाइन" },
    { cat: "digital-marketing", en: "Run our Facebook and TikTok for a month", ne: "एक महिना फेसबुक र टिकटक चलाउने" },
    { cat: "accounting", en: "Register for VAT and set up the books", ne: "भ्याट दर्ता र हिसाब मिलाउने" },
    { cat: "photography", en: "Product photos for an online shop", ne: "अनलाइन पसलका लागि उत्पादन फोटो" },
    { cat: "coding", en: "Simple booking app for a salon", ne: "सैलुनका लागि बुकिङ एप" },
    { cat: "cctv", en: "Install 4 CCTV cameras in a shop", ne: "पसलमा ४ वटा सिसिटिभी जडान" },
    { cat: "admin", en: "Enter 500 products into a spreadsheet", ne: "५०० सामान स्प्रेडसिटमा राख्ने" },
  ] },
  { id: "events", tasks: [
    { cat: "events", en: "Decorate a hall for a birthday", ne: "जन्मदिनका लागि हल सजाउने" },
    { cat: "catering", en: "Food for 50 guests", ne: "५० जना पाहुनाका लागि खाना" },
    { cat: "photography", en: "Wedding photos and video", ne: "बिहेको फोटो र भिडियो", days: 2 },
    { cat: "beauty", en: "Bridal makeup and mehendi", ne: "दुलहीको मेकअप र मेहन्दी" },
    { cat: "tailoring", en: "Stitch 6 matching kurtas", ne: "मिल्दो ६ वटा कुर्ता सिलाउने", qty: 6 },
    { cat: "lessons", en: "Dance practice for a wedding", ne: "बिहेका लागि नाच अभ्यास", qty: 4 },
    { cat: "video-editing", en: "Edit the wedding highlight video", ne: "बिहेको हाइलाइट भिडियो सम्पादन" },
    { cat: "driving", en: "Driver for the wedding day", ne: "बिहेको दिनका लागि ड्राइभर" },
  ] },
  { id: "study", tasks: [
    { cat: "tutoring", en: "SEE maths tuition, 3 evenings a week", ne: "SEE गणित ट्युसन, हप्तामा ३ साँझ", qty: 12 },
    { cat: "phone-repair", en: "Replace a cracked phone screen", ne: "फुटेको फोन स्क्रिन फेर्ने" },
    { cat: "it-support", en: "Slow laptop: clean up and reinstall Windows", ne: "ढिलो ल्यापटप: विन्डोज फेरि हाल्ने" },
    { cat: "translation", en: "Translate my CV into English", ne: "मेरो CV अंग्रेजीमा अनुवाद", qty: 2 },
    { cat: "coding", en: "Help with a final-year project", ne: "अन्तिम वर्षको प्रोजेक्टमा सहयोग" },
    { cat: "lessons", en: "Guitar lessons for beginners", ne: "सुरुवातीका लागि गिटार कक्षा", qty: 8 },
    { cat: "graphic-design", en: "Poster for a college event", ne: "कलेज कार्यक्रमको पोस्टर" },
    { cat: "web-design", en: "Portfolio website", ne: "पोर्टफोलियो वेबसाइट" },
  ] },
  { id: "family", tasks: [
    { cat: "elder-care", en: "Take my parents to hospital check-ups", ne: "बुबाआमालाई अस्पताल जाँचमा लैजाने" },
    { cat: "plumbing", en: "Fix the tank at my parents' house", ne: "बुबाआमाको घरको ट्याङ्की बनाउने" },
    { cat: "solar", en: "Install solar at the village house", ne: "गाउँको घरमा सोलार जडान" },
    { cat: "cleaning", en: "Clean the house before Dashain", ne: "दशैँअघि घर सफा गर्ने" },
    { cat: "gardening", en: "Look after the garden for a month", ne: "एक महिना बगैँचा हेर्ने", qty: 4 },
    { cat: "it-support", en: "Set up video calls for my parents", ne: "बुबाआमाका लागि भिडियो कल मिलाइदिने" },
    { cat: "electrician", en: "Rewire the old house", ne: "पुरानो घरको वायरिङ फेर्ने", days: 3 },
    { cat: "pet-care", en: "Feed and walk our dog for a week", ne: "एक हप्ता कुकुरलाई खुवाउने र घुमाउने", days: 7 },
  ] },
];
