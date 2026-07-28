# FixLah — MVP website setup & operations

A plain-English guide. You do **not** need to know how to code. There is really only **one thing you must change** before going live.

---

## 1. The ONE change you must make: your WhatsApp number

Every "Get quotes" button builds a WhatsApp message and opens a chat **to you**. Until you add your number, that step won't work.

1. Open `index.html` in **Notepad** (right-click the file → *Open with* → *Notepad*).
2. Near the **bottom**, find this line:
   ```js
   whatsappNumber: "60XXXXXXXXX",
   ```
3. Replace `60XXXXXXXXX` with **your** WhatsApp number in international format:
   - Start with the country code **60** (Malaysia).
   - Then your number **without the leading 0**.
   - No spaces, no `+`, no dashes.
   - Example: mobile `012-345 6789` becomes **`60123456789`**.
4. Save the file. Done.

> Tip: use a **separate WhatsApp Business** number/SIM for this, not your personal one. It keeps job messages organised and looks more professional.

*(In the same block you can also change `brand` and `area` if you want. Leave everything else alone.)*

---

## 2. How to see the site

- **On your computer:** double-click `index.html` — it opens in your browser.
- **On your phone / to share:** use the live link I gave you in chat. That's the same site, hosted, so you can send it to anyone.

---

## 3. How to put it online on your own (free)

When you're ready for a real, shareable web address:

1. Go to **app.netlify.com/drop** (free account).
2. **Drag the whole `contractor arbitrage` folder** onto the page.
3. Netlify gives you a live URL in ~10 seconds (e.g. `fixlah.netlify.app`).
4. Later, you can connect your own domain (e.g. `fixlah.my`) in Netlify's settings.

That's the entire deployment. No commands, no build step.

---

## 4. What happens after someone submits (your manual playbook)

Right now **you are the engine** — that's on purpose. It lets you prove people want this before building automation.

When a request lands in your WhatsApp:

1. **Reply within minutes.** Speed is your biggest advantage over big companies. A quick "Got it 👍 lining up quotes for you now" keeps them warm.
2. **Ask for a photo** if they didn't send one, and any missing detail.
3. **Forward the job** to 2–4 contractors you've recruited for that service + area (a broadcast list or individual chats).
4. **Collect their quotes**, then send the customer the best 2–3 to compare — price, rating, when they can come.
5. **Introduce** the customer to the chosen pro, or arrange the booking yourself.
6. **Follow up** after the job: "All sorted? How was [pro]?" — this is how you get reviews and repeat customers.

---

## 5. Track every job in a simple sheet

This spreadsheet is secretly your **most valuable asset** — it becomes your pricing database later. One row per job:

| Date | Service | Area | Issue | Quotes received (RM) | Chosen pro | Final price | Booked? | Rating | Notes |
|------|---------|------|-------|----------------------|-----------|-------------|---------|--------|-------|

After ~50–100 jobs you'll know the real price range for "AC not cold in PJ" better than anyone — that's what powers price estimates and AI later.

---

## 6. What's intentionally not real yet

Be aware, so you're never caught out:

- The **three sample quotes** in the hero are clearly labelled *"Example"* — they show how comparison works, they're not live data.
- **Contractor verification, ratings, warranties** are promises you fulfil **manually** for now (you vet each pro, you track their jobs). Only claim what you actually do.
- There's **no automated matching or payments yet** — you do that over WhatsApp. Add automation only once demand is proven.

---

## Recruiting your first contractors

You need supply before you market to customers. Start with **one service in one area** (suggestion: air-cond servicing in PJ/Subang). Find 10–20 independents via Facebook groups, Mudah/Carousell listings, WhatsApp trade groups, or word of mouth. Your pitch to them:

> "I bring you paying jobs in your area — no marketing cost, no monthly fee to start. You just quote fairly and do good work. Interested?"

Keep the ones who reply fast and do quality work. Drop the rest. That curation *is* the product.
