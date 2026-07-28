# FixLah — Operating Roadmap

The one-line truth: **the tech MVP is done. The next "framework" is not software — it's the operating loop.** A marketplace is supply (contractors) + demand (customers) + matching (you). Software only automates a loop that already works manually. This file is the loop.

---

## Phase 1 — Run it manually (Weeks 1–8)

### Week 1: Get operational
1. **WhatsApp Business** (free app) on a separate SIM/number — not your personal one.
   - Profile: FixLah logo (`brand/fixlah-mark.png`), description, hours.
   - Set up **Quick Replies** for: "got your request", "here are your quotes", "how did it go?"
   - Use **Labels**: New Lead → Quoting → Booked → Done → Review.
2. **Put the number into the website** (one line in `index.html`) and deploy free on **Netlify** → `fixlah.netlify.app`.
3. **Create the tracking sheet** (Google Sheets, two tabs):
   - **Jobs**: date · service · area · issue · quotes received (RM) · chosen pro · final price · booked? · rating · notes
   - **Contractors**: name · phone · services · areas covered · price band · response speed · jobs done · rating · IC verified?
   - This sheet becomes your pricing database — the raw material for every AI feature later. Log **everything**.

### Weeks 2–3: Build supply first (15 contractors, ONE vertical)
Pick **aircond servicing in PJ/Subang** (high frequency, clear pricing, always in demand in Malaysia). Do not add a second service until this one works.

Where to find contractors:
- Facebook groups ("aircond servis KL/PJ", community groups) — many independents advertise there daily
- Mudah.my and Carousell service listings — message the independents
- One good contractor → ask "which 2 other guys do you trust when you're too busy?" (referrals are the best filter)
- Hardware shops and mamak noticeboards in your target area

The pitch (works over WhatsApp):
> "Saya bawa job kat area you — free, no monthly fee. Customer minta quote, saya hantar kat you, you quote sendiri. Kalau job jadi, later on baru kita bincang komisen. Berminat?"

Vetting = your product. For each contractor: IC verification, photos of past work, price range for the 5 most common jobs, and how fast they reply (log it). Keep the fast, fair, reliable ones. Drop the rest without hesitation.

### Weeks 3–8: Generate demand and run the loop
First customers, in order of cheapness:
1. Your own network + family + their condo/neighborhood WhatsApp groups
2. Community Facebook groups (post as a person, not an ad: "started a service that gets you 3 aircond quotes in 30 min, free")
3. WhatsApp Status + word of mouth after every completed job ("know anyone else with a hot bedroom?")
4. Only then: RM10–20/day boosted FB/IG post targeted at homeowners in your area

**The daily loop (you are the algorithm):**
1. Request lands on WhatsApp → reply < 10 minutes, always
2. Forward job (with photos) to the 3 best-matched contractors
3. Collect quotes → send customer a comparison in the docket format:
   ```
   Your quotes — aircond not cold, PJ:
   1) Wei — RM85 · ⭐5.0 · can come 2pm today
   2) Faizal — RM90 · ⭐4.9 · tomorrow 10am
   3) Kumar — RM110 · ⭐4.8 · free re-gas check
   Reply 1, 2 or 3 to book. No obligation.
   ```
4. Book → confirm both sides → follow up after the job
5. Ask for a rating (1–5) + log EVERYTHING in the sheet

### The 90-day validation gates
The idea is "proven" when:
- [ ] 30+ completed jobs
- [ ] ≥40% of requests turn into booked jobs
- [ ] ≥20% of customers are repeat or referral
- [ ] Contractors are messaging YOU asking for more jobs
- [ ] Your sheet shows real price ranges per job type (that's your moat forming)

If after 90 days requests aren't converting, the problem is positioning or trust — fix that before writing any code.

---

## Phase 2 — Semi-automate (only when > 5 jobs/day is drowning you)

Automate the bottleneck, nothing else:
- **Airtable** replaces the Google Sheet (same data, better views + forms)
- **WhatsApp Business API** via Wati / respond.io / SleekFlow — auto-broadcast new jobs to matching contractors, auto-acknowledge customers
- **Contractor WhatsApp groups** per area+service for instant job distribution
- **Reviews page** on the site using real logged jobs (social proof compounds)
- Simple **admin dashboard** (can be built on top of Airtable in a weekend)

## Phase 3 — The real platform (only after Phase 2 revenue)

- Contractor portal/app: accept jobs, quote in-app, build their profile
- **Payments**: DuitNow QR collection → later escrow ("money released when job confirmed done") → warranty program funded by commission margin
- **e-Invois**: LHDN e-invoicing is rolling out to everyone — handling it FOR contractors is a killer retention feature
- **AI on YOUR data** (this is why the sheet matters from day 1):
  - Price estimator: "aircond not cold, PJ" → "RM80–120, usually RM90"
  - Photo diagnosis: customer sends photo → likely issue + parts needed
  - Smart matching: rating × distance × response speed × availability
- **B2B accounts**: property managers, Airbnb hosts, offices — recurring maintenance contracts = predictable demand
- Regional expansion only after Klang Valley is dense

## Monetization ladder (switch on in this order)
1. **Now**: free for everyone — buy liquidity with your time
2. **After ~30 jobs**: 10–15% commission on completed jobs (contractors now see the value)
3. **Later**: featured placement + priority leads for top contractors
4. **At scale**: contractor subscription (RM49–99/mo) as an alternative to commission
5. **Never**: charging customers to get quotes — free quotes IS the brand

## The two risks that kill this
1. **Disintermediation** — customer and contractor go direct next time. Mitigations: the warranty only exists through FixLah, rebooking through you is faster than digging up a number, and repeat customers get priority slots. Accept some leakage; density beats perfection.
2. **One bad job** — a bad contractor early on poisons word of mouth. Mitigation: vet hard, start with jobs ≤ RM200, remove anyone below 4.5⭐ instantly.
