# Saksham (सक्षम) — Your skill. Your price.

A skills marketplace for all of Nepal. Next.js 15 · React 19 · Tailwind 4 · Supabase · Claude.

## Open it in your browser (no install) — GitHub Codespaces

1. On this repo's GitHub page, click the green **Code** button → **Codespaces** tab → **Create codespace on main**.
2. Wait 2–3 minutes. It installs everything, creates `.env.local` and starts the site by itself.
3. The site opens in a new browser tab (or open the **Ports** tab → port **3000** → the globe icon).
4. Tap a demo account to sign in (MPIN **2468**). Edit files in the browser editor; the site updates on save.

To save changes back to GitHub, use the **Source Control** icon on the left (commit, then **Sync**), or in the Codespace terminal: `git add -A`, `git commit -m "..."`, `git push`.
Stop the Codespace when you're done (github.com/codespaces → ⋯ → Stop) to save free hours.

## Run it on a Windows laptop — double-click

- **`Start Saksham.bat`** — fast mode (production build). Pages load in about 0.05 s. Use this to show or use the app.
- **`Edit Saksham.bat`** — edit mode. The site reloads by itself when you save a file (Turbopack, ~1 s per new page).

Both install packages and create `.env.local` the first time, then open http://localhost:3000. Close the window to stop.

## Run it from a terminal

```bash
npm install
npm run setup     # creates .env.local once
npm run dev       # edit mode (Turbopack)
npm run fast      # fast mode: build + start
npm run lint      # check the code with ESLint
npm run format    # tidy every file with Prettier
npm run typecheck # check TypeScript types
```

On Windows PowerShell, if `npm` says "running scripts is disabled on this system", type `npm.cmd` instead of `npm` (e.g. `npm.cmd run dev`), or use the `.bat` files. Edit mode builds into `.next-dev` and fast mode into `.next`, so both can be used without breaking each other.

### Security notes

- `DEMO_MODE=true` shows sign-in codes on screen, so anyone using the site can sign in to or reset any account. Keep it for demos on your own laptop only; set `DEMO_MODE=false` (with an SMS provider) before the site is public.
- Numbers in `OWNER_PHONES` get the Admin page. Register your own number first, and never put a number you don't control there.
- Secrets live only in `.env.local`, which git never uploads. `npm audit` reports 0 known vulnerabilities (PostCSS is pinned to a patched version via `overrides`).

Open http://localhost:3000. `scripts/setup-env.mjs` creates `.env.local` with `DEMO_MODE=true` and a random `SESSION_SECRET` (it never overwrites an existing one).

### Turn on Claude (AI task parsing and the assistant)

1. Get a key at https://platform.claude.com/settings/keys
2. Open `.env.local` and paste it after `ANTHROPIC_API_KEY=` (no quotes, no spaces)
3. Stop and restart `npm run dev`

Without a key everything still works: the app falls back to keyword matching and the typed form.
The key is used only in server routes (`src/lib/ai/claude.ts`) and never sent to the browser.

### Use Supabase instead of the local file store

Without Supabase variables, accounts are stored in `.data/db.json` (good for local review; it does **not**
persist on Vercel/Netlify). For a real deployment:

1. Create a Supabase project, open SQL Editor, run `supabase/migrations/0001_init.sql` then `0002_price_table.sql`
2. Put the project URL, anon key and service-role key into `.env.local` (names in `.env.example`)
3. Restart

## Build status (stop for review after each step)

| Step | Scope                                                                                                                                                                                      | Status               |
| ---: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------- |
|    1 | Tokens, header, footer, login, create account, forgot MPIN                                                                                                                                 | Done                 |
|    2 | Home with real photos (9 credited Wikimedia Commons photos, see `CREDITS.md`)                                                                                                              | Done                 |
|    3 | Explore, professionals, profile (Skill Passport QR, availability), location (Leaflet + OpenStreetMap)                                                                                      | Done                 |
|    4 | Verification center: ID, selfie (simulated match in demo), address, women-led group proof                                                                                                  | Done                 |
|    5 | Post wizard (AI draft, photos, budget slider, women-only) and task detail (ranked live offers, counter, accept, Q&A)                                                                       | Done                 |
|    6 | Booking (full / 2 installments / 30-40-30 milestones), escrow schedule, receipts, Service Guarantee disputes                                                                               | Done                 |
|    7 | My tasks dashboard, messages (text, photo, voice notes, system updates), notifications                                                                                                     | Done                 |
|    8 | Wallet (earnings, escrow, fees, withdrawals, receipts), Earnings Passport with QR, ratings, Saksham Credit (demo partner)                                                                  | Done                 |
|    9 | Hire from abroad (estimate + family confirmation link), Safety (SOS, contacts, report, block), floating Saksham AI, Admin (verification queue, reports, disputes, price table, demo reset) | Done                 |
|   10 | Error, 404 and loading pages; accessibility scan (labels, headings, duplicate ids) on all main pages; launch checklist; demo reset (admin)                                                 | **Done — in review** |

Supabase users: also run `0003_user_location.sql`, `0004_verification.sql` (creates the private `id-docs` bucket) `0005_tasks_bids.sql`, `0006_bookings.sql`, `0007_messaging.sql`, `0008_wallet_credit.sql` and `0009_safety_admin.sql`.
ID photos and selfies are stored outside `public/` (`.data/private` locally, private bucket on Supabase), re-encoded without EXIF/GPS, and deleted 90 days after a decision.
Map tiles come from openstreetmap.org, which is fine for review; use a tile provider with an agreement before launch.

All pages are now built; unknown paths return 404.

Also landed early because later steps depend on them: the Claude integration (`/api/ai/parse-task`,
`/api/ai/ask`), the plain-code price table, ranking, counter, escrow and credit rules (`src/lib/pricing.ts`,
`src/lib/rules.ts`), and the full database schema with RLS.

## What is real and what is simulated

| Part                                                                                                                 | State                                                                                                                                                                                                                                 |
| -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phone + MPIN sign-in, bcrypt hashing, 5-tries → 15-min lock, rate limits, httpOnly session cookie, CSRF origin check | Real                                                                                                                                                                                                                                  |
| Fingerprint / face sign-in (WebAuthn passkeys)                                                                       | Real (turn on from the profile menu)                                                                                                                                                                                                  |
| SMS OTP                                                                                                              | **Demo:** code shown on screen as "Sandbox OTP". Production needs `SMS_PROVIDER` (Sparrow SMS wired)                                                                                                                                  |
| Email sign-up / sign-in / forgot MPIN                                                                                | Real: 6-digit code emailed through Gmail SMTP or Resend once `EMAIL_FROM` + SMTP or `RESEND_API_KEY` are set (also in demo mode). Without them, demo mode shows the code on screen, labelled. Emails are stored lower-case and unique |
| One-tap example accounts                                                                                             | **Demo only**, hidden when `DEMO_MODE=false`                                                                                                                                                                                          |
| Selfie-to-ID face match                                                                                              | **Simulated** in demo (labelled); without DEMO_MODE it waits for manual review — no face-match provider connected                                                                                                                     |
| eSewa / Khalti payments                                                                                              | **Sandbox · demo**: a labelled test screen; escrow states, receipts and the 7% example fee are real logic, but no money moves. Real gateway integration needs merchant keys                                                           |
| Paying / releasing money                                                                                             | Real check: MPIN re-entry after 5 minutes idle, enforced on the server                                                                                                                                                                |
| Withdrawals                                                                                                          | **Sandbox**: real balance logic (earned − fees − withdrawn), MPIN required, no money moves                                                                                                                                            |
| Saksham Credit                                                                                                       | Real formula (15% of verified earnings, ≥3 jobs, full at 4.5★, cap Rs. 1,00,000). Partner, rate (example 14%) and application are **demo** — nothing is sent to any lender                                                            |
| Earnings Passport                                                                                                    | Real: built only from jobs paid through escrow and ratings from those clients. Demo accounts also get a labelled example Passport                                                                                                     |
| Dispute resolution                                                                                                   | Admins resolve from /admin (redo or refund). **Demo reviewer** buttons also appear in demo                                                                                                                                            |
| Example offers                                                                                                       | **Demo only**: example providers in the right category bid on new tasks over ~3 minutes, labelled "Example offer"                                                                                                                     |
| Live updates                                                                                                         | Task page polls every 5 s, chat every 4 s, notifications every 20 s (works on any host); can move to Supabase Realtime later                                                                                                          |
| Messages                                                                                                             | Real: text, photos (metadata stripped), voice notes (≤ 2 min, checked by content). Phone numbers/emails are masked until the two have a booking                                                                                       |
| Verification reviewer                                                                                                | Real admin queue at /admin (view private documents, approve or reject). **Demo reviewer** button in demo only                                                                                                                         |
| SOS and live location                                                                                                | **Demo alert**: press-and-hold works, but nothing is sent and location stays on the device. Needs an SMS provider and a live-location service before launch                                                                           |
| Reports and blocking                                                                                                 | Real: reports go to the /admin queue; blocking stops messages and offers between the two people                                                                                                                                       |
| Family confirmation (Hire from abroad)                                                                               | Real: private link, only a SHA-256 hash stored, new link turns off the old one. A confirmation informs the client; only the client releases money                                                                                     |
| Foreign-currency amounts                                                                                             | **Example** exchange rates (labelled, not live); payment is always in NPR                                                                                                                                                             |
| Saksham AI assistant                                                                                                 | Real Claude call when `ANTHROPIC_API_KEY` is set; otherwise hand-written offline answers, labelled "Offline answer". It answers questions only and never changes anything                                                             |
| Price table                                                                                                          | Example starting prices, editable by admins at /admin; plain code applies them                                                                                                                                                        |
| Demo reset                                                                                                           | Admin button, DEMO_MODE only: wipes demo-account and example data and re-seeds it. Real accounts are untouched                                                                                                                        |

## Free demo on Render

New → Web Service → this repo, instance type **Free**.

- Build command: `npm ci --include=dev && npm run build`
- Start command: `npx next start -p $PORT`
- Environment: `NODE_VERSION=22`, `DEMO_MODE=true`, `SESSION_SECRET` (Generate), `SITE_PASSWORD` (12+ characters)

Data resets whenever the free server restarts or sleeps. Testers share the demo admin, so never upload real IDs there.

## Before launch

- `DEMO_MODE=false`, real `APP_ORIGIN`, a fresh `SESSION_SECRET`
- SMS provider credentials
- Supabase configured (file store is dev-only); move rate limits to Postgres/Redis for multiple instances
- Licensed photos listed in `CREDITS.md`
- `ANTHROPIC_API_KEY` set in `.env.local` (without it, AI features use the labelled offline fallbacks)
- Real eSewa / Khalti merchant integration (server-side payment verification) to replace the sandbox screen
- A face-match / ID check provider (or a manual review team using the /admin queue) to replace the simulated selfie match
- SMS provider and live-location service for SOS (currently "Demo alert")
- Real exchange-rate source if foreign-currency estimates should be live
- Review the example price table at /admin with real providers
- Run all Supabase migrations `0001`–`0009`
