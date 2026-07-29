<p align="center">
  <img src="brand/fixlah-lockup.png" alt="FixLah" width="380">
</p>

<p align="center">
  <b>Compare quotes from trusted local pros.</b><br>
  Tell us the job once, get several quotes from verified independent pros nearby,<br>
  then pick the best on price, rating and speed. Free, no obligation — Klang Valley, Malaysia.
</p>

---

## What this is

FixLah is a **quote-comparison service** for home & auto jobs (aircond, plumbing, electrical, car repair, cleaning, and more). This repo is the **MVP marketing site**: a single static page that collects a job request and hands it off to WhatsApp, where a real person lines up the quotes.

There is **no backend and no build step** — it's one self-contained `index.html`. That's intentional: the goal right now is to prove demand manually before automating anything (see [ROADMAP.md](ROADMAP.md)).

## The one thing you must change before going live

Open [`index.html`](index.html), find the `CONFIG` block near the bottom, and set your WhatsApp number:

```js
const CONFIG = {
  brand: "FixLah",
  whatsappNumber: "60XXXXXXXXX",  // 👈 your number: country code + number, no "+", no spaces
  area: "Klang Valley",
  analyticsDomain: ""             // optional — see below
};
```

Until this is a real number, the site shows a friendly "not finished yet" message instead of opening a broken chat. Full walkthrough: [SETUP.md](SETUP.md).

## Run it locally

Just open the file — no server needed:

```bash
start index.html
```

Or serve it (handy for testing on your phone over the same Wi-Fi):

```bash
python -m http.server 8000
```

## Deploy (free)

The repo ships with a [`netlify.toml`](netlify.toml) (publish directory + security headers), so deploying is drag-and-drop:

1. Go to **app.netlify.com/drop** and drop the whole folder in, **or** connect this GitHub repo for auto-deploys on every push.
2. You get a live URL in seconds (e.g. `fixlah.netlify.app`).
3. Later, connect a custom domain (e.g. `fixlah.my`) in Netlify settings.

> After you have a real domain, update the `og:*` / `canonical` URLs in `index.html` and the contact email in `privacy.html`.

## Measuring demand (optional but recommended)

Your [90-day validation gates](ROADMAP.md) depend on knowing how many people actually submit a request. To track that:

1. Sign up free at [plausible.io](https://plausible.io) (privacy-friendly, cookieless — no consent banner needed).
2. Add your site, then set `analyticsDomain` in the `CONFIG` block to your domain.

Submissions fire a **"Quote request"** event you can watch in the Plausible dashboard.

## Project structure

```
index.html      The entire website (HTML + CSS + JS in one file)
privacy.html    PDPA privacy notice
404.html        Custom not-found page
netlify.toml    Deploy config + security/caching headers
brand/          Logo, mark, share image, brand sheet, design philosophy
SETUP.md        Plain-English setup & operations guide (non-technical)
ROADMAP.md      The operating plan — how to run the marketplace by hand
LICENSE         Proprietary — all rights reserved
```

## Status

MVP. Verification, ratings, and warranties are **manual promises** fulfilled by the founders for now — only claim what you actually do. See [SETUP.md § What's intentionally not real yet](SETUP.md).
