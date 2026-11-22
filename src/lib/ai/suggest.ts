import "server-only";
import { aiCoach, aiMatch, type Candidate } from "@/lib/ai/claude";
import { maskContacts } from "@/lib/chat";
import { CITY_COORDS, haversineKm } from "@/lib/geo";
import { CATEGORIES, category, type CategoryId } from "@/lib/pricing";
import { realProviders } from "@/lib/real-providers";
import { EXAMPLE_PROVIDERS, isVerified, providerCoords, type ExampleProvider } from "@/lib/seed/providers";
import { openTasksFor } from "@/lib/task-search";
import type { User } from "@/lib/store/types";

/**
 * "AI match & coach".
 *  1. Plain code picks who may be suggested: only people on Saksham, in the viewer's own (demo or real) world.
 *  2. Claude sees them without names or contacts, and picks and explains.
 *  3. Anything it returns that isn't on that list is dropped. Everything shown about a person comes from Saksham.
 * Without Claude, step 1's order is used.
 */
type Lang = "en" | "ne";
const SENT_TO_CLAUDE = 24;

export interface Suggested {
  id: string;
  name: string;
  href: string;
  headline: { en: string; ne: string };
  city: string;
  verified: boolean;
  rating: number;
  ratingCount: number;
  jobs: number;
  priceFrom: number;
  teacher: boolean;
  example: boolean;
  why: string;
}
export interface PlanSkill {
  category: CategoryId;
  openJobs: number;
  why: string;
  steps: string[];
  teachers: Suggested[];
}

const LEARN =
  /learn|teach|tutor|study|class|course|lesson|coach|train|exam|सिक|शिक्ष|पढ|कक्षा|ट्युसन|तालिम|sik|padh/i;
// Too common to say anything about a match.
const STOP = new Set(
  "the and for with from near need want help some someone can who good best work job".split(" "),
);

function words(text: string) {
  return (text.toLowerCase().match(/[\p{L}\p{M}\d+#]{3,}/gu) ?? []).filter((w) => !STOP.has(w));
}

/** Endings a short keyword may take: leak → leaking, math → mathematics, tap → taps. But not cat → category. */
const ENDING = "(?:s|es|ed|ing|ematics)?";
/** A keyword that is usually just an ordinary word ("I want to see a plumber"). */
const ORDINARY = new Set(["see"]);

/**
 * Categories the text talks about, strongest first. The price table's keywords are word stems ("plumb", "leak"),
 * so longer ones may start a word and short ones may only take a common ending.
 */
function categoriesIn(text: string): CategoryId[] {
  const hay = ` ${text.toLowerCase().replace(/[^\p{L}\p{M}\d+]+/gu, " ")} `;
  const has = (keyword: string) => {
    const k = keyword.toLowerCase();
    if (ORDINARY.has(k)) return false;
    // Nepali joins its endings to the word, so those keywords always match as a word's start.
    if (k.length > 4 || !/^[\x20-\x7e]+$/.test(k)) return hay.includes(` ${k}`);
    return new RegExp(` ${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}${ENDING} `).test(hay);
  };
  return CATEGORIES.filter((c) => c.id !== "other")
    .map((c) => ({ id: c.id as CategoryId, hits: [c.en, c.ne, ...c.keywords].filter(has).length }))
    .filter((c) => c.hits > 0)
    .sort((a, b) => b.hits - a.hits)
    .map((c) => c.id);
}

const teaches = (p: ExampleProvider) => p.categories.includes("tutoring");

function quality(p: ExampleProvider) {
  return (p.rating / 5) * 2 + (isVerified(p) ? 1 : 0) + Math.min(p.ratingCount, 50) / 100;
}

function score(p: ExampleProvider, need: string, city: string, budget: number | null) {
  const cats = categoriesIn(need);
  const learning = LEARN.test(need);
  const text = [p.headline.en, p.headline.ne, ...p.services.flatMap((s) => [s.en, s.ne])]
    .join(" ")
    .toLowerCase();
  const own = new Set(words(text));
  let fit = words(need).filter((w) => own.has(w)).length * 2;
  cats.slice(0, 3).forEach((c, i) => {
    if (p.categories.includes(c)) fit += 6 - i;
  });
  // A tutor is only a fit for "learn" when the subject is theirs or no other skill was named.
  if (learning && teaches(p) && !cats.some((c) => c !== "tutoring")) fit += 5;
  let extra = quality(p);
  const at = city ? CITY_COORDS[city] : undefined;
  if (at) {
    if (haversineKm(at, providerCoords(p)) <= 25) extra += 1.5;
    else if (!p.onlineOk) extra -= 3;
  }
  if (budget && p.priceMin) extra += p.priceMin <= budget ? 0.5 : -2;
  return { fit, total: fit * 2 + extra };
}

async function poolFor(user: User) {
  const pool = user.isDemo ? EXAMPLE_PROVIDERS : await realProviders();
  return pool.filter((p) => p.id !== user.id && p.categories.length > 0);
}

const safe = (text: string, max: number) => maskContacts(text).text.trim().slice(0, max);

function anonymous(people: ExampleProvider[]) {
  const byId = new Map<string, ExampleProvider>();
  const candidates: Candidate[] = people.map((p, i) => {
    const id = `c${i + 1}`;
    byId.set(id, p);
    return {
      id,
      skills: p.categories.map((c) => category(c).en),
      about: safe(p.headline.en, 160),
      services: p.services.slice(0, 4).map((s) => safe(s.en, 100)),
      city: p.city,
      online: p.onlineOk,
      verified: isVerified(p),
      rating: p.ratingCount ? p.rating : null,
      ratings: p.ratingCount,
      jobs: p.jobsDone,
      priceFrom: p.priceMin,
    };
  });
  return { candidates, byId };
}

function shown(p: ExampleProvider, why = ""): Suggested {
  return {
    id: p.id,
    name: p.name,
    href: `/profile/${p.id}`,
    headline: p.headline,
    city: p.city,
    verified: isVerified(p),
    rating: p.rating,
    ratingCount: p.ratingCount,
    jobs: p.jobsDone,
    priceFrom: p.priceMin,
    teacher: teaches(p),
    example: !p.isReal,
    why,
  };
}

function plainReason(p: ExampleProvider, lang: Lang) {
  const c = category(p.categories[0]);
  const verified = isVerified(p);
  return lang === "ne"
    ? `${c.ne} को काम गर्नुहुन्छ${verified ? ", प्रमाणित हुनुहुन्छ" : ""}।`
    : `Works in ${c.en}${verified ? " and is verified" : ""}.`;
}

export async function match(
  user: User,
  input: { text: string; city: string; budget: number | null },
  lang: Lang,
): Promise<{ source: "ai" | "fallback"; people: Suggested[] }> {
  const need = safe(input.text, 500);
  const ranked = (await poolFor(user))
    .map((p) => ({ p, ...score(p, need, input.city, input.budget) }))
    .sort((a, b) => b.total - a.total);
  if (!ranked.length) return { source: "fallback", people: [] };

  const { candidates, byId } = anonymous(ranked.slice(0, SENT_TO_CLAUDE).map((r) => r.p));
  const ai = await aiMatch({ need, city: input.city, budget: input.budget, candidates }, lang);
  if (ai) {
    const seen = new Set<string>();
    const people = ai.picks.flatMap(({ id, why }) => {
      const p = byId.get(id);
      if (!p || seen.has(id)) return [];
      seen.add(id);
      return [shown(p, safe(why, 240))];
    });
    // An empty answer is a real answer. A list of only made-up ids is not.
    if (people.length || !ai.picks.length) return { source: "ai", people: people.slice(0, 4) };
  }
  return {
    source: "fallback",
    people: ranked
      .filter((r) => r.fit > 0)
      .slice(0, 4)
      .map(({ p }) => shown(p, plainReason(p, lang))),
  };
}

function plainSkill(id: CategoryId, openJobs: number, named: boolean, lang: Lang) {
  const c = category(id);
  if (lang === "ne")
    return {
      why: named ? `तपाईंले लेखेको कुरा ${c.ne} सँग मिल्छ।` : `${c.ne} मा अहिले ${openJobs} खुला काम छन्।`,
      steps: [
        `${c.ne} का आधारभूत कुरा सिक्नुहोस्।`,
        "अभ्यासका लागि सानो काम गरेर फोटो वा नमुना राख्नुहोस्।",
        "प्रमाणीकरण पूरा गरेर साना काममा आवेदन दिनुहोस्।",
      ],
    };
  return {
    why: named ? `What you wrote fits ${c.en}.` : `Open jobs in ${c.en} now: ${openJobs}.`,
    steps: [
      `Learn the basics of ${c.en}.`,
      "Do a small practice job and keep photos or samples of it.",
      "Finish verification and apply for small jobs first.",
    ],
  };
}

export async function coach(
  user: User,
  text: string,
  lang: Lang,
): Promise<{ source: "ai" | "fallback"; summary: string; skills: PlanSkill[] }> {
  const goal = safe(text, 500);
  const [pool, open] = await Promise.all([poolFor(user), openTasksFor(user)]);
  const jobs: Record<string, number> = {};
  for (const t of open) jobs[t.category] = (jobs[t.category] ?? 0) + 1;

  const named = categoriesIn(goal);
  const mine = (user.categories ?? []) as CategoryId[];
  const useful = (p: ExampleProvider) =>
    (teaches(p) ? 4 : 0) +
    (p.categories.some((c) => named.includes(c)) ? 5 : 0) +
    (p.categories.some((c) => jobs[c]) ? 2 : 0) +
    quality(p);
  const { candidates, byId } = anonymous(
    [...pool].sort((a, b) => useful(b) - useful(a)).slice(0, SENT_TO_CLAUDE),
  );

  const ai = await aiCoach(
    { goal, skills: mine.map((c) => category(c).en), openJobs: jobs, candidates },
    lang,
  );
  if (ai?.skills.length)
    return {
      source: "ai",
      summary: safe(ai.summary, 500),
      skills: ai.skills.slice(0, 3).map((s) => ({
        category: s.category,
        openJobs: jobs[s.category] ?? 0,
        why: safe(s.why, 240),
        steps: s.steps.slice(0, 4).map((x) => safe(x, 240)),
        teachers: [...new Set(s.teachers)].slice(0, 3).flatMap((id) => {
          const p = byId.get(id);
          return p ? [shown(p)] : [];
        }),
      })),
    };

  const busiest = (Object.keys(jobs) as CategoryId[])
    .filter((c) => c !== "other" && !mine.includes(c))
    .sort((a, b) => jobs[b] - jobs[a]);
  const picked = [...new Set([...named, ...busiest, ...mine, "coding" as const])].slice(0, 3);
  return {
    source: "fallback",
    summary: "",
    skills: picked.map((id) => ({
      category: id,
      openJobs: jobs[id] ?? 0,
      ...plainSkill(id, jobs[id] ?? 0, named.includes(id), lang),
      teachers: pool
        .filter((p) => p.categories.includes(id))
        .sort((a, b) => quality(b) - quality(a))
        .slice(0, 3)
        .map((p) => shown(p)),
    })),
  };
}
