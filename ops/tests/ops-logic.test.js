/**
 * FixLah Ops — logic test suite.
 * Run from the repo root:   node --test ops/tests/
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const L = require("../ops-logic.js");

/* ================= SERVICE CATALOG ================= */

test("catalog: fleet services come first, general after", () => {
  const groups = L.SERVICES.map((s) => s.group);
  const lastFleet = groups.lastIndexOf("fleet");
  const firstGeneral = groups.indexOf("general");
  assert.ok(lastFleet < firstGeneral, "every fleet service sits before every general one");
  assert.equal(groups.filter((g) => g === "fleet").length, 10, "ten focus services");
});

test("catalog: the ten focus services exist with the right shapes", () => {
  for (const code of ["TOW", "SVC", "PUSPAKOM", "WELD", "FAB", "TRAILER", "TYRE_R", "TYRE_B", "TYRE_T", "TYRE_S"]) {
    assert.ok(L.serviceByCode(code), code + " exists");
  }
  assert.deepEqual(L.serviceByCode("SVC").variants.size, ["Small", "Medium", "Large"]);
  assert.deepEqual(L.serviceByCode("FAB").variants.length, ["20ft", "30ft", "41ft", "45ft"]);
  assert.ok(L.serviceByCode("FAB").variants.bodyType.includes("Cargo — pagar rendah"));
  assert.ok(L.serviceByCode("FAB").variants.bodyType.includes("Oil & Gas spec"));
  assert.equal(L.serviceByCode("TOW").urgent, true, "towing defaults urgent");
  assert.equal(L.serviceByCode("TYRE_B").urgent, true, "tyre breakdown defaults urgent");
  assert.equal(L.serviceByCode("TYRE_T").urgent, false);
});

test("serviceLabel renders variants and survives unknown codes", () => {
  assert.equal(L.serviceLabel({ service: "TOW" }), "Towing");
  assert.equal(L.serviceLabel({ service: "SVC", variant: { size: "Large" } }), "Vehicle servicing — Large");
  assert.equal(
    L.serviceLabel({ service: "FAB", variant: { bodyType: "Curtain sider", length: "45ft" } }),
    "Body fabrication — Curtain sider, 45ft"
  );
  assert.equal(L.serviceLabel({ service: "NOPE" }), "NOPE");
});

/* ================= STATE MACHINE ================= */

test("state machine: forward moves allowed, skips allowed", () => {
  assert.ok(L.canTransition("NEW", "DISPATCHED"));
  assert.ok(L.canTransition("NEW", "BOOKED"), "breakdown can skip straight to booked");
  assert.ok(L.canTransition("DISPATCHED", "COMPLETED"));
  assert.ok(L.canTransition("COMPLETED", "CLOSED"));
});

test("state machine: no backwards, no self, no leaving terminal states", () => {
  assert.equal(L.canTransition("BOOKED", "NEW"), false);
  assert.equal(L.canTransition("QUOTED", "DISPATCHED"), false);
  assert.equal(L.canTransition("NEW", "NEW"), false);
  assert.equal(L.canTransition("CLOSED", "NEW"), false);
  assert.equal(L.canTransition("CANCELLED", "DISPATCHED"), false);
});

test("isActive separates field work from work awaiting close-out", () => {
  for (const s of ["NEW", "DISPATCHED", "QUOTED", "BOOKED", "IN_PROGRESS"]) {
    assert.equal(L.isActive(s), true, s + " is still in the field");
  }
  assert.equal(L.isActive("COMPLETED"), false, "done on the ground, pending cost + rating");
  assert.equal(L.isActive("CLOSED"), false);
  assert.equal(L.isActive("CANCELLED"), false);
  assert.equal(L.isTerminal("COMPLETED"), false, "but still open — it needs attention");
});

test("state machine: cancel from any active state only", () => {
  for (const s of ["NEW", "DISPATCHED", "QUOTED", "BOOKED", "IN_PROGRESS", "COMPLETED"]) {
    assert.ok(L.canTransition(s, "CANCELLED"), s + " can cancel");
  }
  assert.equal(L.canTransition("CLOSED", "CANCELLED"), false);
  assert.equal(L.canTransition("CANCELLED", "CANCELLED"), false);
});

test("nextStatuses offers sensible moves and always cancel when active", () => {
  assert.deepEqual(L.nextStatuses("NEW"), ["DISPATCHED", "BOOKED", "CANCELLED"]);
  assert.deepEqual(L.nextStatuses("IN_PROGRESS"), ["COMPLETED", "CANCELLED"]);
  assert.deepEqual(L.nextStatuses("CLOSED"), []);
  for (const s of Object.keys(L.STATUS_META)) {
    for (const to of L.nextStatuses(s)) assert.ok(L.canTransition(s, to), s + "→" + to + " must be legal");
  }
});

/* ================= IDS & REFS ================= */

test("makeJobRef: deterministic with injected date and rng", () => {
  const seq = [0, 0.5, 0.99, 0.25];
  let i = 0;
  const ref = L.makeJobRef(new Date("2026-09-14T10:00:00"), () => seq[i++ % seq.length]);
  assert.match(ref, /^FX-0914-[ABCDEFGHJKMNPQRSTVWXYZ23456789]{4}$/);
});

test("makeId: prefix + timestamp + suffix, unique-ish", () => {
  const a = L.makeId("job", 1726300000000, () => 0.42);
  assert.match(a, /^job_[a-z0-9]+[A-Z2-9]{5}$/i);
  assert.ok(a.startsWith("job_"));
});

/* ================= PHONES & WHATSAPP ================= */

test("normalizePhone handles every common Malaysian format", () => {
  assert.equal(L.normalizePhone("012-345 6789"), "60123456789");
  assert.equal(L.normalizePhone("0123456789"), "60123456789");
  assert.equal(L.normalizePhone("+60 12-345 6789"), "60123456789");
  assert.equal(L.normalizePhone("60123456789"), "60123456789");
  assert.equal(L.normalizePhone("11 2345 6789"), "601123456789");
  assert.equal(L.normalizePhone("03-7967 1000"), "60379671000", "landline works too");
});

test("normalizePhone rejects junk", () => {
  assert.equal(L.normalizePhone(""), null);
  assert.equal(L.normalizePhone(null), null);
  assert.equal(L.normalizePhone("abc"), null);
  assert.equal(L.normalizePhone("999"), null);
  assert.equal(L.normalizePhone("44 20 7946 0958"), null, "not a MY number shape");
});

test("waLink builds a correct deep link with encoded text", () => {
  const url = L.waLink("012-345 6789", "Hello & welcome");
  assert.equal(url, "https://wa.me/60123456789?text=Hello%20%26%20welcome");
  assert.equal(L.waLink("nonsense", "x"), null);
  assert.equal(L.waLink("0123456789"), "https://wa.me/60123456789");
});

/* ================= DISPATCH MESSAGES ================= */

test("dispatch message carries ref, vehicle, location and urgency", () => {
  const msg = L.buildDispatchMessage({
    ref: "FX-0914-K3QT", service: "TOW", urgent: true,
    plate: "BQS 1234", vehicleType: "Prime mover",
    location: "KM 12 NKVE, near Bukit Lanjan",
    desc: "Gearbox seized, full trailer attached",
  });
  assert.ok(msg.includes("FX-0914-K3QT"));
  assert.ok(msg.includes("TOWING"));
  assert.ok(msg.includes("BQS 1234"));
  assert.ok(msg.includes("KM 12 NKVE"));
  assert.ok(msg.includes("BREAKDOWN"));
  assert.ok(msg.includes("price (RM)"));
});

test("dispatch message omits empty fields and urgency when not urgent", () => {
  const msg = L.buildDispatchMessage({ ref: "FX-0101-AAAA", service: "WELD", urgent: false, desc: "Fix cracked bracket" });
  assert.ok(!msg.includes("Vehicle:"));
  assert.ok(!msg.includes("Location:"));
  assert.ok(!msg.includes("PRIORITY"));
  assert.ok(msg.includes("Fix cracked bracket"));
});

/* ================= QUOTES ================= */

test("rankQuotes sorts by price and tags lowest + fastest", () => {
  const ranked = L.rankQuotes([
    { vendorName: "B", amount: 450, etaMinutes: 90 },
    { vendorName: "A", amount: 380, etaMinutes: 120 },
    { vendorName: "C", amount: 500, etaMinutes: 35 },
  ]);
  assert.deepEqual(ranked.map((q) => q.vendorName), ["A", "B", "C"]);
  assert.equal(ranked[0].lowest, true);
  assert.equal(ranked[1].lowest, false);
  assert.equal(ranked.find((q) => q.vendorName === "C").fastest, true);
});

test("rankQuotes: empty list, missing ETAs, does not mutate input", () => {
  assert.deepEqual(L.rankQuotes([]), []);
  const input = [{ vendorName: "X", amount: 100 }];
  const out = L.rankQuotes(input);
  assert.equal(out[0].lowest, true);
  assert.equal(out[0].fastest, false, "no ETA anywhere → nobody is fastest");
  assert.equal(input[0].lowest, undefined, "input untouched");
});

test("compare message numbers quotes and carries tags", () => {
  const job = { ref: "FX-0914-TT22", service: "TYRE_B" };
  const msg = L.buildCompareMessage(job, L.rankQuotes([
    { vendorName: "Ah Seng", amount: 260, etaMinutes: 40 },
    { vendorName: "Mutu Tayar", amount: 300, etaMinutes: 25 },
  ]));
  assert.ok(msg.includes("1) Ah Seng — RM 260"));
  assert.ok(msg.includes("[LOWEST]"));
  assert.ok(msg.includes("2) Mutu Tayar — RM 300"));
  assert.ok(msg.includes("[FASTEST]"));
  assert.ok(msg.includes("Tyre breakdown service"));
});

/* ================= SLA ================= */

const T0 = new Date("2026-09-14T08:00:00").getTime();
const mins = (n) => T0 + n * 60000;

test("SLA: only urgent jobs get a clock", () => {
  assert.equal(L.slaState({ urgent: false, status: "NEW", createdAt: new Date(T0).toISOString() }, mins(60)), null);
  assert.equal(L.slaState(null, mins(0)), null);
});

test("SLA: NEW phase — ok, warn after 5m, breach after 10m", () => {
  const job = { urgent: true, status: "NEW", createdAt: new Date(T0).toISOString() };
  assert.equal(L.slaState(job, mins(3)).level, "ok");
  assert.equal(L.slaState(job, mins(7)).level, "warn");
  assert.equal(L.slaState(job, mins(11)).level, "breach");
  assert.equal(L.slaState(job, mins(11)).phase, "Awaiting dispatch");
});

test("SLA: phase anchors move with the job", () => {
  const job = {
    urgent: true, status: "DISPATCHED",
    createdAt: new Date(T0).toISOString(),
    dispatchedAt: new Date(mins(8)).toISOString(),
  };
  const s = L.slaState(job, mins(18));
  assert.equal(s.minutes, 10, "clock restarts at dispatch");
  assert.equal(s.level, "ok");
  assert.equal(L.slaState(job, mins(30)).level, "warn");
  assert.equal(L.slaState(job, mins(54)).level, "breach");
});

test("SLA: terminal and completed jobs have no clock", () => {
  const job = { urgent: true, status: "COMPLETED", createdAt: new Date(T0).toISOString() };
  assert.equal(L.slaState(job, mins(999)), null);
});

/* ================= PUSPAKOM & DATES ================= */

test("addMonths clamps to month end", () => {
  assert.equal(L.addMonths("2026-08-31", 6), "2027-02-28");
  assert.equal(L.addMonths("2027-08-31", 6, ), "2028-02-29", "leap year keeps the 29th");
  assert.equal(L.addMonths("2026-03-15", 6), "2026-09-15");
  assert.equal(L.nextPuspakomDue("2026-09-14"), "2027-03-14");
});

test("dueStatus buckets: overdue / today / soon / ok / unknown", () => {
  const now = "2026-09-14T09:00:00";
  assert.equal(L.dueStatus("2026-09-01", now).bucket, "overdue");
  assert.equal(L.dueStatus("2026-09-01", now).label, "Overdue 13d");
  assert.equal(L.dueStatus("2026-09-14", now).label, "Due today");
  assert.equal(L.dueStatus("2026-10-01", now).bucket, "soon");
  assert.equal(L.dueStatus("2026-10-01", now).days, 17);
  assert.equal(L.dueStatus("2026-12-25", now).bucket, "ok");
  assert.equal(L.dueStatus(null, now).bucket, "unknown");
});

test("daysBetween ignores time of day", () => {
  assert.equal(L.daysBetween("2026-09-14T23:59:00", "2026-09-15T00:01:00"), 1);
  assert.equal(L.daysBetween("2026-09-15", "2026-09-14"), -1);
});

/* ================= VENDOR IMPORT ================= */

test("import: parses clean lines with service aliases (EN + BM)", () => {
  const r = L.parseVendorImport([
    "Ah Seng Tayar, 012-345 6789, tyre repair | tyre breakdown, Port Klang",
    "Maju Weld Engineering, 03-5162 8000, welding + fabrication, Shah Alam, ask for Encik Rahim",
    "Speedy Tunda 24hrs, +6011-2345 6789, tunda, Klang Valley",
  ].join("\n"));
  assert.equal(r.errors.length, 0);
  assert.equal(r.vendors.length, 3);
  assert.deepEqual(r.vendors[0].services, ["TYRE_R", "TYRE_B"]);
  assert.equal(r.vendors[0].phone, "60123456789");
  assert.deepEqual(r.vendors[1].services, ["WELD", "FAB"]);
  assert.equal(r.vendors[1].notes, "ask for Encik Rahim");
  assert.deepEqual(r.vendors[2].services, ["TOW"]);
  assert.equal(r.vendors[2].phone, "601123456789");
});

test("import: bad lines are reported with reasons, good lines survive", () => {
  const r = L.parseVendorImport([
    "OnlyNameHere",
    "No Phone Guy, not-a-phone, towing",
    "Mystery Services, 0123456789, underwater basket weaving",
    "Good Tyres, 016 555 1234, tayar, Nilai",
    "",
  ].join("\n"));
  assert.equal(r.vendors.length, 1);
  assert.equal(r.vendors[0].name, "Good Tyres");
  assert.equal(r.errors.length, 3);
  assert.match(r.errors[0].reason, /at least/);
  assert.match(r.errors[1].reason, /Phone/);
  assert.match(r.errors[2].reason, /No service/);
});

test("matchServiceCodes: exact codes pass through, dedupes, empty on junk", () => {
  assert.deepEqual(L.matchServiceCodes("TYRE_B | tyre breakdown"), ["TYRE_B"]);
  assert.deepEqual(L.matchServiceCodes("puspakom / weld"), ["PUSPAKOM", "WELD"]);
  assert.deepEqual(L.matchServiceCodes("xyzzy"), []);
});

/* ================= MATCHING & STATS ================= */

const VENDORS = [
  { id: "v1", name: "Ah Seng", services: ["TYRE_R", "TYRE_B"] },
  { id: "v2", name: "Maju Weld", services: ["WELD", "FAB"] },
  { id: "v3", name: "Speedy", services: ["TOW"] },
];

test("matchVendors filters by exact service code", () => {
  assert.deepEqual(L.matchVendors(VENDORS, "TYRE_B").map((v) => v.id), ["v1"]);
  assert.deepEqual(L.matchVendors(VENDORS, "FAB").map((v) => v.id), ["v2"]);
  assert.deepEqual(L.matchVendors(VENDORS, "PUSPAKOM"), []);
  assert.deepEqual(L.matchVendors([], "TOW"), []);
});

const JOBS = [
  { id: "j1", ref: "FX-0901-AAAA", service: "TOW", status: "CLOSED", vendorId: "v3", vendorName: "Speedy",
    createdAt: "2026-09-01T08:00:00", completedAt: "2026-09-01T11:00:00", finalCost: 850, rating: 5, urgent: true },
  { id: "j2", ref: "FX-0905-BBBB", service: "TYRE_B", status: "COMPLETED", vendorId: "v1", vendorName: "Ah Seng",
    createdAt: "2026-09-05T14:00:00", completedAt: "2026-09-05T16:30:00", finalCost: 260, rating: 4, urgent: true },
  { id: "j3", ref: "FX-0910-CCCC", service: "WELD", status: "DISPATCHED", createdAt: "2026-09-10T09:00:00", urgent: false },
  { id: "j4", ref: "FX-0912-DDDD", service: "TYRE_R", status: "CANCELLED", createdAt: "2026-09-12T09:00:00", urgent: false },
  { id: "j5", ref: "FX-0913-EEEE", service: "TOW", status: "BOOKED", vendorId: "v3", vendorName: "Speedy",
    createdAt: "2026-09-13T22:00:00", bookedAt: "2026-09-13T22:20:00", urgent: true },
  { id: "j6", ref: "FX-0820-FFFF", service: "SVC", status: "CLOSED", vendorId: "v1", vendorName: "Ah Seng",
    createdAt: "2026-08-20T09:00:00", completedAt: "2026-08-20T15:00:00", finalCost: 1200, rating: 5, urgent: false },
];

test("vendorStats aggregates completed work only", () => {
  const s = L.vendorStats("v1", JOBS);
  assert.equal(s.jobsDone, 2);
  assert.equal(s.totalSpend, 1460);
  assert.equal(s.avgRating, 4.5);
  assert.equal(s.lastJobAt, "2026-09-05T16:30:00");
  const none = L.vendorStats("v2", JOBS);
  assert.equal(none.jobsDone, 0);
  assert.equal(none.avgRating, null);
});

test("summarize: open counts, urgent counts, month spend, puspakom due", () => {
  const vehicles = [
    { plate: "BQS 1234", puspakomDue: "2026-09-20" },  // soon
    { plate: "WXY 9876", puspakomDue: "2026-08-30" },  // overdue
    { plate: "VDR 5566", puspakomDue: "2027-01-15" },  // ok
  ];
  const s = L.summarize(JOBS, vehicles, "2026-09-14T10:00:00");
  assert.equal(s.open, 3, "j2 completed-awaiting-close + j3 dispatched + j5 booked");
  assert.equal(s.active, 2, "only j3 + j5 are still running in the field");
  assert.equal(s.awaitingClose, 1, "j2 needs cost + rating before it closes");
  assert.equal(s.urgentActive, 1, "only j5 — j2's breakdown is already done");
  assert.equal(s.monthDone, 2, "j1 + j2 this month; j6 was August");
  assert.equal(s.monthSpend, 1110);
  assert.equal(s.puspakomDue, 2);
  assert.deepEqual(s.byService, { WELD: 1, TOW: 1 });
});

/* ================= CSV ================= */

test("csvEscape quotes commas, quotes and newlines", () => {
  assert.equal(L.csvEscape("plain"), "plain");
  assert.equal(L.csvEscape("a,b"), '"a,b"');
  assert.equal(L.csvEscape('say "hi"'), '"say ""hi"""');
  assert.equal(L.csvEscape("line1\nline2"), '"line1\nline2"');
  assert.equal(L.csvEscape(null), "");
});

test("jobsToCSV produces a clean, complete table", () => {
  const csv = L.jobsToCSV(JOBS.slice(0, 2));
  const lines = csv.trim().split("\n");
  assert.equal(lines.length, 3, "header + 2 rows");
  assert.ok(lines[0].startsWith("ref,created,service"));
  assert.ok(lines[1].includes("FX-0901-AAAA"));
  assert.ok(lines[1].includes("850"));
  assert.ok(lines[2].includes("Tyre breakdown service"));
});

/* ================= FORMATTING ================= */

test("fmtRM: thousands separators, cents only when needed", () => {
  assert.equal(L.fmtRM(850), "RM 850");
  assert.equal(L.fmtRM(12500), "RM 12,500");
  assert.equal(L.fmtRM(1234567.5), "RM 1,234,567.50");
  assert.equal(L.fmtRM(0), "RM 0");
  assert.equal(L.fmtRM(undefined), "—");
});

test("fmtMins: minutes and hours", () => {
  assert.equal(L.fmtMins(45), "45m");
  assert.equal(L.fmtMins(60), "1h");
  assert.equal(L.fmtMins(85), "1h 25m");
  assert.equal(L.fmtMins(null), "—");
});

test("fmtDate / fmtDateTime render Malaysian-friendly short forms", () => {
  assert.equal(L.fmtDate("2026-09-14"), "14 Sep 2026");
  assert.equal(L.fmtDateTime("2026-09-14T08:05:00"), "14 Sep, 08:05");
  assert.equal(L.fmtDate(null), "—");
});
