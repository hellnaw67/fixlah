# FixLah Dispatch — fleet & logistics backend

The operations layer for a logistics company: raise a job, push it to every matching vendor
on WhatsApp at once, compare the quotes that come back, book one, and record what it actually
cost. Built around the ten fleet services below; the original FixLah consumer services remain
available underneath them.

**Live board:** https://claude.ai/code/artifact/039f2811-8174-4f4d-badb-3cebe1724f62

---

## Files

| File | What it is |
|---|---|
| `ops/ops-logic.js` | Every decision the system makes — pure functions, no DOM, no network. UMD, so the browser and Node load the identical file. |
| `ops/tests/ops-logic.test.js` | 36 tests over that logic. |
| `ops/console.html` | The console UI. Standalone: open it directly in a browser. |

Run the tests:

```bash
node --test ops/tests/ops-logic.test.js
```

The published board loads `ops-logic.js` as a supporting file, so **the code under test is the
code in production** — no copy, no drift.

---

## Services

Fleet & logistics (the focus set, shown first everywhere):

| Code | Service | Notes |
|---|---|---|
| `TOW` | Towing | Defaults to breakdown priority |
| `SVC` | Vehicle servicing | Variant: Small / Medium / Large |
| `PUSPAKOM` | Puspakom inspection | Driven by the fleet register |
| `WELD` | Welding | |
| `FAB` | Body fabrication | Variants: Oil & Gas spec / Curtain sider / Cargo pagar rendah / Cargo pagar tinggi × 20ft / 30ft / 41ft / 45ft |
| `TRAILER` | Trailer repair | |
| `TYRE_R` | Tyre repair | |
| `TYRE_B` | Tyre breakdown service | Defaults to breakdown priority |
| `TYRE_T` | Tyre retreading | |
| `TYRE_S` | Tyre sale | |

Then the general services: air-cond, plumbing, electrical, mechanic, cleaning, appliance
repair, moving, locksmith, other.

---

## The job lifecycle

```
NEW ──> DISPATCHED ──> QUOTED ──> BOOKED ──> IN_PROGRESS ──> COMPLETED ──> CLOSED
 └──────────────────────────────────┘ (breakdowns skip straight to BOOKED)
 any active state ──> CANCELLED
```

`canTransition()` enforces this: forward only, skipping allowed, never backwards, never out of
`CLOSED` or `CANCELLED`.

Two different questions get two different answers, which matters for the dashboard:

- **Open** — not `CLOSED`/`CANCELLED`. Still needs someone's attention, including a `COMPLETED`
  job waiting on its cost and rating.
- **Active** (`isActive`) — still running in the field: `NEW` through `IN_PROGRESS`. A
  `COMPLETED` job is done on the ground, so it is open but not active.

Conflating the two is exactly the bug the test suite caught during the build.

---

## Breakdown response clock (SLA)

Only jobs flagged `urgent` get a clock, and it re-anchors at each phase so the timer always
measures the *current* wait rather than total age:

| Phase | Measured from | Warn | Breach |
|---|---|---|---|
| Awaiting dispatch (`NEW`) | `createdAt` | 5 min | 10 min |
| Awaiting quotes (`DISPATCHED`/`QUOTED`) | `dispatchedAt` | 20 min | 45 min |
| Vendor en route (`BOOKED`/`IN_PROGRESS`) | `bookedAt` | 60 min | 120 min |

Breached jobs sort to the top of the board and turn the tile red. The board re-renders every
30 seconds so the clocks stay honest, and pauses that while a job sheet is open.

---

## Puspakom tracking

Commercial vehicles run a **six-month** periodic inspection cycle; a lapsed inspection parks
the vehicle. `nextPuspakomDue()` adds six months and clamps to the month's end, so
31 Aug + 6 → 28 Feb (29 Feb in a leap year). `dueStatus()` buckets each vehicle into
**overdue / due within 30 days / ok**, and "Raise Puspakom job" turns a due vehicle into a live
job in one tap, auto-flagged urgent when already overdue.

---

## Data model

Three collections in the artifact's shared database. Every viewer signed in to the account sees
the same board, live.

```
jobs/{id}      ref, service, variant{}, plate, vehicleType, location, desc, urgent,
               status, quotes[], vendorId, vendorName, finalCost, rating, notes,
               createdAt, dispatchedAt, bookedAt, completedAt

vendors/{id}   name, phone (normalised to wa.me digits), services[], areas, notes

vehicles/{id}  plate, type, puspakomDue, notes
```

When the shared database isn't available the console falls back to `localStorage` on that
device and says so in the header ("This device" instead of "Synced") — it never silently
pretends to sync.

---

## Vendor import

Paste a contact list, one per line:

```
Name, phone, services, area, notes
Ah Seng Tayar, 012-345 6789, tyre repair | tyre breakdown, Port Klang
Maju Weld, 03-5162 8000, welding + fabrication, Shah Alam, ask for Encik Rahim
Speedy Tunda, +6011-2345 6789, tunda, Klang Valley
```

Service words match in English or Malay (`tayar`, `tunda`, `kimpal`, `treler`, `servis`…).
Phone numbers normalise from every common Malaysian format — `012-345 6789`, `+60 12…`,
`0123456789`, landlines — to `wa.me` digits. Lines that can't be read are reported with the
reason and the line number; the good lines still import.

---

## Why this beats the phone-call scramble

The current process for a 2am breakdown is: find the towing guy's number, call, no answer, call
the next, negotiate blind with no idea what the job should cost, forget to write it down.

| | Phone calls | This board |
|---|---|---|
| Reaching vendors | One at a time, sequentially | Every matching vendor at once, one tap |
| Price discovery | Whoever answers sets the price | Quotes ranked, cheapest and fastest tagged, spread shown in RM and % |
| Response tracking | Memory | A clock per phase that turns red on breach |
| Puspakom | A date in someone's head | Register that surfaces overdue and due-in-30-days |
| Cost history | Scattered across WhatsApp | Every job costed and exportable to CSV |
| Vendor performance | Gut feel | Jobs done, total spend, average rating per vendor |

The compounding part is the last two rows. Every closed job writes a real price for a real job
type, so within a few dozen jobs you stop guessing what a 45ft curtain-sider body or an NKVE
recovery *should* cost — you know, and you can hold a quote to it. That price history is the
asset; the dispatch speed is just what makes people use it long enough to build one.
