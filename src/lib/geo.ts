/** City centroids (approximate) used for distance-to-task. Online work has no location. */
export const CITY_COORDS: Record<string, [number, number]> = {
  Kathmandu: [27.7172, 85.324], Lalitpur: [27.6644, 85.3188], Bhaktapur: [27.671, 85.4298],
  Pokhara: [28.2096, 83.9856], Biratnagar: [26.4525, 87.2718], Birgunj: [27.0104, 84.8777],
  Dharan: [26.8065, 87.2846], Bharatpur: [27.6766, 84.4342], Butwal: [27.7006, 83.4483],
  Hetauda: [27.4287, 85.0322], Janakpur: [26.7288, 85.9263], Nepalgunj: [28.05, 81.6167],
  Itahari: [26.6646, 87.2718], Dhangadhi: [28.6852, 80.6216], Bhairahawa: [27.5056, 83.4547],
  Damak: [26.6588, 87.7036], Birendranagar: [28.6019, 81.6339], Tulsipur: [28.1309, 82.2973],
  Ghorahi: [28.0391, 82.4836], Banepa: [27.6298, 85.5214], Dhulikhel: [27.6253, 85.5561],
  Gorkha: [28.0, 84.6333], Ilam: [26.9112, 87.9237],
};

export const HEADER_CITIES = [
  "Kathmandu", "Lalitpur", "Bhaktapur", "Pokhara", "Biratnagar", "Birgunj", "Dharan", "Bharatpur",
  "Butwal", "Hetauda", "Janakpur", "Nepalgunj", "Itahari", "Dhangadhi", "Online",
] as const;

export function haversineKm(a: [number, number], b: [number, number]): number {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (b[0] - a[0]) * rad, dLng = (b[1] - a[1]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Browsing-only choice: no home city, so lists show every city (nearest-first sorting is turned off). */
export const ANYWHERE = "Anywhere";
export const isKnownCity = (c: string | undefined | null): c is string =>
  !!c && (c === "Online" || c === ANYWHERE || c in CITY_COORDS);

/** Approximate area centroids for the city/area picker and provider locations. */
export interface Area { name: string; ne: string; lat: number; lng: number }
export const AREAS: Record<string, Area[]> = {
  Kathmandu: [
    { name: "Thamel", ne: "ठमेल", lat: 27.7154, lng: 85.3123 },
    { name: "New Road", ne: "न्युरोड", lat: 27.7041, lng: 85.3108 },
    { name: "Baneshwor", ne: "बानेश्वर", lat: 27.6915, lng: 85.342 },
    { name: "Koteshwor", ne: "कोटेश्वर", lat: 27.6789, lng: 85.3497 },
    { name: "Chabahil", ne: "चाबहिल", lat: 27.7172, lng: 85.3468 },
    { name: "Boudha", ne: "बौद्ध", lat: 27.7215, lng: 85.362 },
    { name: "Kalanki", ne: "कलंकी", lat: 27.6936, lng: 85.281 },
    { name: "Balaju", ne: "बालाजु", lat: 27.7333, lng: 85.3 },
    { name: "Maharajgunj", ne: "महाराजगञ्ज", lat: 27.7369, lng: 85.33 },
  ],
  Lalitpur: [
    { name: "Jawalakhel", ne: "जावलाखेल", lat: 27.6727, lng: 85.3137 },
    { name: "Patan Durbar Square", ne: "पाटन दरबार क्षेत्र", lat: 27.6727, lng: 85.3253 },
    { name: "Pulchowk", ne: "पुल्चोक", lat: 27.678, lng: 85.3188 },
    { name: "Satdobato", ne: "सातदोबाटो", lat: 27.6586, lng: 85.3247 },
    { name: "Imadol", ne: "इमाडोल", lat: 27.661, lng: 85.342 },
  ],
  Bhaktapur: [
    { name: "Durbar Square", ne: "दरबार क्षेत्र", lat: 27.6722, lng: 85.428 },
    { name: "Suryabinayak", ne: "सूर्यविनायक", lat: 27.665, lng: 85.433 },
    { name: "Kamalbinayak", ne: "कमलविनायक", lat: 27.676, lng: 85.435 },
    { name: "Thimi", ne: "ठिमी", lat: 27.68, lng: 85.388 },
  ],
  Pokhara: [
    { name: "Lakeside", ne: "लेकसाइड", lat: 28.2096, lng: 83.959 },
    { name: "Mahendrapul", ne: "महेन्द्रपुल", lat: 28.218, lng: 83.988 },
    { name: "Chipledhunga", ne: "चिप्लेढुंगा", lat: 28.215, lng: 83.987 },
    { name: "Bagar", ne: "बगर", lat: 28.239, lng: 83.993 },
  ],
  Biratnagar: [
    { name: "Traffic Chowk", ne: "ट्राफिक चोक", lat: 26.456, lng: 87.279 },
    { name: "Main Road", ne: "मेन रोड", lat: 26.452, lng: 87.273 },
  ],
};

/** Areas for a city; cities without a list get a single "City centre". */
export function areasFor(city: string): Area[] {
  const c = CITY_COORDS[city];
  return AREAS[city] ?? (c ? [{ name: "City centre", ne: "शहर केन्द्र", lat: c[0], lng: c[1] }] : []);
}

export function nearestCity(lat: number, lng: number): { city: string; km: number } {
  let best = { city: "Kathmandu", km: Infinity };
  for (const [city, c] of Object.entries(CITY_COORDS)) {
    const km = haversineKm([lat, lng], c);
    if (km < best.km) best = { city, km };
  }
  return best;
}

export const NEPAL_CENTER: [number, number] = [28.25, 84.1];

/** Countries for "booking for family from abroad". */
export const ABROAD_COUNTRIES = ["Qatar", "UAE", "Malaysia", "Australia", "USA", "Japan", "UK", "Saudi Arabia", "Kuwait", "South Korea", "Other"] as const;

/**
 * EXAMPLE exchange rates (NPR per 1 unit of local currency), rounded, for showing a rough
 * local-currency figure only. Not live — the page says so. Payment is always in NPR.
 */
export const EXAMPLE_FX: Partial<Record<(typeof ABROAD_COUNTRIES)[number], { code: string; nprPer: number }>> = {
  Qatar: { code: "QAR", nprPer: 37 }, UAE: { code: "AED", nprPer: 36.5 }, Malaysia: { code: "MYR", nprPer: 30 },
  Australia: { code: "AUD", nprPer: 88 }, USA: { code: "USD", nprPer: 135 }, Japan: { code: "JPY", nprPer: 0.9 },
  UK: { code: "GBP", nprPer: 170 }, "Saudi Arabia": { code: "SAR", nprPer: 36 }, Kuwait: { code: "KWD", nprPer: 440 },
  "South Korea": { code: "KRW", nprPer: 0.098 },
};

/** Nepal's 7 provinces, with the sign-up cities in each (every province also allows "Other"). */
export const PROVINCES = [
  { id: "koshi", en: "Koshi", ne: "कोशी", cities: ["Biratnagar", "Dharan", "Itahari", "Damak", "Ilam"] },
  { id: "madhesh", en: "Madhesh", ne: "मधेश", cities: ["Birgunj", "Janakpur"] },
  { id: "bagmati", en: "Bagmati", ne: "बागमती", cities: ["Kathmandu", "Lalitpur", "Bhaktapur", "Bharatpur", "Hetauda", "Banepa", "Dhulikhel"] },
  { id: "gandaki", en: "Gandaki", ne: "गण्डकी", cities: ["Pokhara", "Gorkha"] },
  { id: "lumbini", en: "Lumbini", ne: "लुम्बिनी", cities: ["Butwal", "Bhairahawa", "Nepalgunj", "Ghorahi", "Tulsipur"] },
  { id: "karnali", en: "Karnali", ne: "कर्णाली", cities: ["Birendranagar"] },
  { id: "sudurpashchim", en: "Sudurpashchim", ne: "सुदूरपश्चिम", cities: ["Dhangadhi"] },
] as const;
export type ProvinceId = (typeof PROVINCES)[number]["id"];
