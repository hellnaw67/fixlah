/**
 * FixLah Ops — core logic module.
 *
 * Pure functions only: no DOM, no storage, no network. The console page
 * (ops/console.html) and the Node test suite (ops/tests/ops-logic.test.js)
 * both load this exact file, so everything the backend workflow decides —
 * job states, SLA timers, Puspakom schedules, dispatch messages, quote
 * ranking, imports, exports — is testable and portable to any future
 * hosted backend without a rewrite.
 *
 * UMD: `window.OpsLogic` in the browser, `require()` in Node.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.OpsLogic = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* ================= SERVICE CATALOG =================
   * Fleet & logistics services first (the focus vertical), the original
   * FixLah consumer services after. Vendors are tagged with these codes. */
  const SERVICES = [
    // --- Fleet & logistics (focus) ---
    { code: "TOW",      group: "fleet", name: "Towing",                 hint: "Breakdown recovery, prime mover & trailer", urgent: true },
    { code: "SVC",      group: "fleet", name: "Vehicle servicing",      hint: "Scheduled service — pick vehicle size",     urgent: false,
      variants: { size: ["Small", "Medium", "Large"] } },
    { code: "PUSPAKOM", group: "fleet", name: "Puspakom inspection",    hint: "Periodic & special inspections",            urgent: false },
    { code: "WELD",     group: "fleet", name: "Welding",                hint: "Structural & repair welding",               urgent: false },
    { code: "FAB",      group: "fleet", name: "Body fabrication",       hint: "Industry-standard trailer bodies",          urgent: false,
      variants: {
        bodyType: ["Oil & Gas spec", "Curtain sider", "Cargo — pagar rendah", "Cargo — pagar tinggi"],
        length:   ["20ft", "30ft", "41ft", "45ft"],
      } },
    { code: "TRAILER",  group: "fleet", name: "Trailer repair",         hint: "Axles, landing legs, kingpin, floor, doors", urgent: false },
    { code: "TYRE_R",   group: "fleet", name: "Tyre repair",            hint: "Puncture & patch, at workshop",             urgent: false },
    { code: "TYRE_B",   group: "fleet", name: "Tyre breakdown service", hint: "Roadside tyre rescue, 24/7",                urgent: true },
    { code: "TYRE_T",   group: "fleet", name: "Tyre retreading",        hint: "Casing retread & management",               urgent: false },
    { code: "TYRE_S",   group: "fleet", name: "Tyre sale",              hint: "New & used commercial tyres",               urgent: false },
    // --- General FixLah services (kept, after the focus list) ---
    { code: "AC",       group: "general", name: "Air-cond servicing",   hint: "Service, repair, gas",       urgent: false },
    { code: "PLUMB",    group: "general", name: "Plumbing",             hint: "Leaks, pipes, taps",         urgent: false },
    { code: "ELEC",     group: "general", name: "Electrical",           hint: "Wiring, points, lights",     urgent: false },
    { code: "MECH",     group: "general", name: "Car mechanic",         hint: "Service, repair, check",     urgent: false },
    { code: "CLEAN",    group: "general", name: "Cleaning",             hint: "Home, office, deep clean",   urgent: false },
    { code: "APPL",     group: "general", name: "Appliance repair",     hint: "Fridge, washer, oven",       urgent: false },
    { code: "MOVE",     group: "general", name: "Moving",               hint: "House, office, haulage",     urgent: false },
    { code: "LOCK",     group: "general", name: "Locksmith",            hint: "Locked out, locks, keys",    urgent: false },
    { code: "OTHER",    group: "general", name: "Something else",       hint: "Describe the job",           urgent: false },
  ];

  const SERVICE_BY_CODE = Object.fromEntries(SERVICES.map((s) => [s.code, s]));

  function serviceByCode(code) {
    return SERVICE_BY_CODE[code] || null;
  }

  /** Human label including chosen variants:
   *  "Body fabrication — Curtain sider, 45ft" / "Vehicle servicing — Large". */
  function serviceLabel(job) {
    const s = serviceByCode(job.service);
    if (!s) return job.service || "Unknown service";
    const parts = [];
    if (job.variant) {
      for (const key of Object.keys(s.variants || {})) {
        if (job.variant[key]) parts.push(job.variant[key]);
      }
    }
    return parts.length ? s.name + " — " + parts.join(", ") : s.name;
  }

  /* ================= JOB STATE MACHINE ================= */
  const STATUS_FLOW = ["NEW", "DISPATCHED", "QUOTED", "BOOKED", "IN_PROGRESS", "COMPLETED", "CLOSED"];
  const TERMINAL = ["CLOSED", "CANCELLED"];

  const STATUS_META = {
    NEW:         { label: "New",         tone: "neutral" },
    DISPATCHED:  { label: "Dispatched",  tone: "active" },
    QUOTED:      { label: "Quoted",      tone: "active" },
    BOOKED:      { label: "Booked",      tone: "active" },
    IN_PROGRESS: { label: "In progress", tone: "active" },
    COMPLETED:   { label: "Completed",   tone: "good" },
    CLOSED:      { label: "Closed",      tone: "good" },
    CANCELLED:   { label: "Cancelled",   tone: "danger" },
  };

  function isTerminal(status) {
    return TERMINAL.indexOf(status) !== -1;
  }

  /** "In the field": work not yet finished. COMPLETED is done on the ground
   *  but still needs costing/rating, so it is open-but-not-active. */
  function isActive(status) {
    return !isTerminal(status) && status !== "COMPLETED";
  }

  /** Forward moves (skipping stages is allowed — a breakdown often goes
   *  NEW → BOOKED directly) plus CANCELLED from any non-terminal state.
   *  Never backwards, never out of a terminal state. */
  function canTransition(from, to) {
    if (from === to) return false;
    if (isTerminal(from)) return false;
    if (to === "CANCELLED") return true;
    const a = STATUS_FLOW.indexOf(from);
    const b = STATUS_FLOW.indexOf(to);
    if (a === -1 || b === -1) return false;
    return b > a;
  }

  /** The sensible next moves to offer as buttons (not every legal skip). */
  function nextStatuses(status) {
    const NEXT = {
      NEW: ["DISPATCHED", "BOOKED"],
      DISPATCHED: ["QUOTED", "BOOKED"],
      QUOTED: ["BOOKED"],
      BOOKED: ["IN_PROGRESS", "COMPLETED"],
      IN_PROGRESS: ["COMPLETED"],
      COMPLETED: ["CLOSED"],
    };
    const list = (NEXT[status] || []).slice();
    if (!isTerminal(status)) list.push("CANCELLED");
    return list;
  }

  /* ================= IDS & REFS ================= */
  const REF_ALPHABET = "ABCDEFGHJKMNPQRSTVWXYZ23456789"; // no 0/O/1/I/L/U

  function makeId(prefix, now, rnd) {
    now = now === undefined ? Date.now() : now;
    rnd = rnd || Math.random;
    let tail = "";
    for (let i = 0; i < 5; i++) tail += REF_ALPHABET[Math.floor(rnd() * REF_ALPHABET.length)];
    return prefix + "_" + now.toString(36) + tail;
  }

  /** Job reference like FX-0914-K3QT (month+day, 4 chars). */
  function makeJobRef(date, rnd) {
    date = date || new Date();
    rnd = rnd || Math.random;
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    let tail = "";
    for (let i = 0; i < 4; i++) tail += REF_ALPHABET[Math.floor(rnd() * REF_ALPHABET.length)];
    return "FX-" + mm + dd + "-" + tail;
  }

  /* ================= PHONES & WHATSAPP ================= */

  /** Normalize a Malaysian phone number to wa.me digits ("60123456789").
   *  Returns null when it can't be a valid MY number. */
  function normalizePhone(raw) {
    if (!raw) return null;
    let d = String(raw).replace(/\D/g, "");
    if (!d) return null;
    if (d.startsWith("0060")) d = d.slice(2); // "+0060..." typo family
    if (d.startsWith("60")) {
      // already country-coded
    } else if (d.startsWith("0")) {
      d = "60" + d.slice(1);
    } else if (d.startsWith("1")) {
      d = "60" + d; // mobile written without leading 0
    } else {
      return null;
    }
    // 60 + 8-10 national digits (landline 8-9, mobile 9-10)
    if (d.length < 10 || d.length > 12) return null;
    return d;
  }

  function waLink(phone, text) {
    const p = normalizePhone(phone);
    if (!p) return null;
    return "https://wa.me/" + p + (text ? "?text=" + encodeURIComponent(text) : "");
  }

  /** The message a vendor receives when a job is dispatched to them. */
  function buildDispatchMessage(job) {
    const lines = [];
    lines.push("*FixLah job — " + serviceLabel(job).toUpperCase() + "*  (" + job.ref + ")");
    lines.push("─────────────────");
    if (job.plate) lines.push("🚚 Vehicle: " + job.plate + (job.vehicleType ? " (" + job.vehicleType + ")" : ""));
    if (job.location) lines.push("📍 Location: " + job.location);
    if (job.desc) lines.push("📝 Job: " + job.desc);
    if (job.urgent) lines.push("⏱ PRIORITY: BREAKDOWN — immediate response needed");
    lines.push("");
    lines.push("Reply with your *price (RM)* and *ETA* to take this job.");
    return lines.join("\n");
  }

  /** Ranked comparison message (for forwarding to a manager or driver). */
  function buildCompareMessage(job, rankedQuotes) {
    const lines = [];
    lines.push("Quotes — " + serviceLabel(job) + " (" + job.ref + "):");
    rankedQuotes.forEach(function (q, i) {
      let line = (i + 1) + ") " + q.vendorName + " — RM " + q.amount;
      const tags = [];
      if (q.lowest) tags.push("LOWEST");
      if (q.fastest) tags.push("FASTEST");
      if (q.etaMinutes != null) line += " · ETA " + fmtMins(q.etaMinutes);
      if (q.note) line += " · " + q.note;
      if (tags.length) line += "  [" + tags.join(", ") + "]";
      lines.push(line);
    });
    lines.push("Reply with a number to book.");
    return lines.join("\n");
  }

  /* ================= QUOTES ================= */

  /** Sort by price ascending; tag the cheapest and the fastest ETA. */
  function rankQuotes(quotes) {
    const list = (quotes || []).slice().sort(function (a, b) {
      return (a.amount || 0) - (b.amount || 0);
    });
    if (!list.length) return list;
    const out = list.map(function (q) {
      return Object.assign({}, q, { lowest: false, fastest: false });
    });
    out[0].lowest = true;
    let fi = -1, best = Infinity;
    out.forEach(function (q, i) {
      if (q.etaMinutes != null && q.etaMinutes < best) { best = q.etaMinutes; fi = i; }
    });
    if (fi >= 0) out[fi].fastest = true;
    return out;
  }

  /* ================= SLA (urgent jobs) =================
   * Breakdown clock: how long has this urgent job sat in its phase?
   *   NEW          — not yet dispatched:  warn > 5 min,  breach > 10 min
   *   DISPATCHED/QUOTED — waiting quotes: warn > 20 min, breach > 45 min
   *   BOOKED/IN_PROGRESS — vendor moving: warn > 60 min, breach > 120 min
   */
  const SLA_RULES = {
    NEW:         { phase: "Awaiting dispatch", warn: 5,  breach: 10,  anchor: "createdAt" },
    DISPATCHED:  { phase: "Awaiting quotes",   warn: 20, breach: 45,  anchor: "dispatchedAt" },
    QUOTED:      { phase: "Awaiting booking",  warn: 20, breach: 45,  anchor: "dispatchedAt" },
    BOOKED:      { phase: "Vendor en route",   warn: 60, breach: 120, anchor: "bookedAt" },
    IN_PROGRESS: { phase: "On the job",        warn: 60, breach: 120, anchor: "bookedAt" },
  };

  function slaState(job, now) {
    if (!job || !job.urgent) return null;
    const rule = SLA_RULES[job.status];
    if (!rule) return null;
    const anchorISO = job[rule.anchor] || job.createdAt;
    if (!anchorISO) return null;
    now = now === undefined ? Date.now() : now;
    const mins = Math.max(0, Math.floor((now - new Date(anchorISO).getTime()) / 60000));
    let level = "ok";
    if (mins > rule.breach) level = "breach";
    else if (mins > rule.warn) level = "warn";
    return { phase: rule.phase, minutes: mins, level: level, label: rule.phase + " · " + fmtMins(mins) };
  }

  /* ================= PUSPAKOM & DATES =================
   * Commercial vehicles in Malaysia sit on a 6-month periodic
   * inspection cycle; a lapsed inspection parks the vehicle. */

  const DAY_MS = 24 * 60 * 60 * 1000;

  function daysBetween(fromISO, toISO) {
    const a = new Date(fromISO); a.setHours(0, 0, 0, 0);
    const b = new Date(toISO);   b.setHours(0, 0, 0, 0);
    return Math.round((b - a) / DAY_MS);
  }

  /** Add months to an ISO date, clamping to the target month's end
   *  (31 Aug + 6 → 28/29 Feb). Returns YYYY-MM-DD. */
  function addMonths(iso, n) {
    const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
    const day = d.getDate();
    const target = new Date(d.getFullYear(), d.getMonth() + n, 1);
    const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
    target.setDate(Math.min(day, lastDay));
    const mm = String(target.getMonth() + 1).padStart(2, "0");
    const dd = String(target.getDate()).padStart(2, "0");
    return target.getFullYear() + "-" + mm + "-" + dd;
  }

  function nextPuspakomDue(fromISO) {
    return addMonths(fromISO, 6);
  }

  /** Bucket a due date: overdue / soon (≤30 days) / ok. */
  function dueStatus(dueISO, nowISO) {
    if (!dueISO) return { bucket: "unknown", days: null, label: "No date set" };
    nowISO = nowISO || new Date().toISOString();
    const days = daysBetween(nowISO, dueISO);
    if (days < 0) return { bucket: "overdue", days: days, label: "Overdue " + Math.abs(days) + "d" };
    if (days === 0) return { bucket: "overdue", days: 0, label: "Due today" };
    if (days <= 30) return { bucket: "soon", days: days, label: "Due in " + days + "d" };
    return { bucket: "ok", days: days, label: "OK — " + fmtDate(dueISO) };
  }

  /* ================= VENDOR IMPORT =================
   * Paste one contact per line:
   *   Name, phone, services, areas(optional), notes(optional)
   *   e.g.  Ah Seng Tayar, 012-345 6789, tyre repair | tyre breakdown, Port Klang
   * Service words match loosely, English or Malay. */

  const SERVICE_ALIASES = [
    ["tyre breakdown", "TYRE_B"], ["tayar breakdown", "TYRE_B"], ["breakdown tyre", "TYRE_B"],
    ["tyre retread", "TYRE_T"], ["retread", "TYRE_T"],
    ["tyre sale", "TYRE_S"], ["jual tayar", "TYRE_S"], ["tyre shop", "TYRE_S"],
    ["tyre", "TYRE_R"], ["tayar", "TYRE_R"],
    ["towing", "TOW"], ["tow", "TOW"], ["tunda", "TOW"],
    ["puspakom", "PUSPAKOM"], ["inspection", "PUSPAKOM"],
    ["welding", "WELD"], ["weld", "WELD"], ["kimpal", "WELD"],
    ["fabrication", "FAB"], ["fab", "FAB"], ["body", "FAB"], ["curtain", "FAB"], ["pagar", "FAB"],
    ["trailer", "TRAILER"], ["treler", "TRAILER"],
    ["servicing", "SVC"], ["service", "SVC"], ["servis", "SVC"],
    ["aircond", "AC"], ["air-cond", "AC"], ["aircon", "AC"],
    ["plumb", "PLUMB"], ["paip", "PLUMB"],
    ["electric", "ELEC"], ["wiring", "ELEC"],
    ["mechanic", "MECH"],
    ["clean", "CLEAN"],
    ["appliance", "APPL"],
    ["moving", "MOVE"], ["mover", "MOVE"],
    ["locksmith", "LOCK"], ["kunci", "LOCK"],
  ];

  function matchServiceCodes(text) {
    const found = [];
    const parts = String(text || "").toLowerCase().split(/[|/+;]/);
    parts.forEach(function (part) {
      const p = part.trim();
      if (!p) return;
      if (SERVICE_BY_CODE[p.toUpperCase()]) { pushUnique(found, p.toUpperCase()); return; }
      for (let i = 0; i < SERVICE_ALIASES.length; i++) {
        if (p.indexOf(SERVICE_ALIASES[i][0]) !== -1) { pushUnique(found, SERVICE_ALIASES[i][1]); return; }
      }
    });
    return found;
  }

  function pushUnique(arr, v) { if (arr.indexOf(v) === -1) arr.push(v); }

  function parseVendorImport(text) {
    const vendors = [];
    const errors = [];
    String(text || "").split(/\r?\n/).forEach(function (line, idx) {
      const t = line.trim();
      if (!t) return;
      const cols = t.split(",").map(function (c) { return c.trim(); });
      if (cols.length < 3) {
        errors.push({ line: idx + 1, text: t, reason: "Need at least: name, phone, services" });
        return;
      }
      const name = cols[0];
      const phone = normalizePhone(cols[1]);
      if (!phone) {
        errors.push({ line: idx + 1, text: t, reason: "Phone number not recognised: " + cols[1] });
        return;
      }
      const services = matchServiceCodes(cols[2]);
      if (!services.length) {
        errors.push({ line: idx + 1, text: t, reason: "No service recognised in: " + cols[2] });
        return;
      }
      vendors.push({
        name: name,
        phone: phone,
        services: services,
        areas: cols[3] || "",
        notes: cols.slice(4).join(", ") || "",
      });
    });
    return { vendors: vendors, errors: errors };
  }

  /* ================= MATCHING & STATS ================= */

  function matchVendors(vendors, serviceCode) {
    return (vendors || []).filter(function (v) {
      return (v.services || []).indexOf(serviceCode) !== -1;
    });
  }

  function vendorStats(vendorId, jobs) {
    let done = 0, spend = 0, ratingSum = 0, rated = 0, lastAt = null;
    (jobs || []).forEach(function (j) {
      if (j.vendorId !== vendorId) return;
      if (j.status === "COMPLETED" || j.status === "CLOSED") {
        done++;
        if (typeof j.finalCost === "number") spend += j.finalCost;
        if (typeof j.rating === "number") { ratingSum += j.rating; rated++; }
        const at = j.completedAt || j.createdAt;
        if (at && (!lastAt || at > lastAt)) lastAt = at;
      }
    });
    return {
      jobsDone: done,
      totalSpend: spend,
      avgRating: rated ? Math.round((ratingSum / rated) * 10) / 10 : null,
      lastJobAt: lastAt,
    };
  }

  /* ================= DASHBOARD SUMMARY ================= */

  function monthKey(iso) {
    return String(iso || "").slice(0, 7); // YYYY-MM
  }

  function summarize(jobs, vehicles, nowISO) {
    nowISO = nowISO || new Date().toISOString();
    const mk = monthKey(nowISO);
    let open = 0, active = 0, awaitingClose = 0, urgentActive = 0, monthSpend = 0, monthDone = 0;
    const byService = {};
    (jobs || []).forEach(function (j) {
      if (!isTerminal(j.status)) open++;              // still needs someone's attention
      if (j.status === "COMPLETED") awaitingClose++;  // done, pending cost + rating
      if (isActive(j.status)) {                       // still running in the field
        active++;
        if (j.urgent) urgentActive++;
        byService[j.service] = (byService[j.service] || 0) + 1;
      }
      if ((j.status === "COMPLETED" || j.status === "CLOSED") && monthKey(j.completedAt || j.createdAt) === mk) {
        monthDone++;
        if (typeof j.finalCost === "number") monthSpend += j.finalCost;
      }
    });
    let puspakomDue = 0;
    (vehicles || []).forEach(function (v) {
      const st = dueStatus(v.puspakomDue, nowISO);
      if (st.bucket === "overdue" || st.bucket === "soon") puspakomDue++;
    });
    return {
      open: open,
      active: active,
      awaitingClose: awaitingClose,
      urgentActive: urgentActive,
      monthSpend: monthSpend,
      monthDone: monthDone,
      puspakomDue: puspakomDue,
      byService: byService,
    };
  }

  /* ================= CSV EXPORT ================= */

  function csvEscape(v) {
    if (v === null || v === undefined) return "";
    const s = String(v);
    if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  function jobsToCSV(jobs) {
    const head = ["ref", "created", "service", "vehicle", "location", "status",
      "vendor", "quotes_received", "final_cost_rm", "rating", "notes"];
    const rows = (jobs || []).map(function (j) {
      return [
        j.ref,
        (j.createdAt || "").slice(0, 10),
        serviceLabel(j),
        j.plate || "",
        j.location || "",
        j.status,
        j.vendorName || "",
        (j.quotes || []).length,
        typeof j.finalCost === "number" ? j.finalCost : "",
        typeof j.rating === "number" ? j.rating : "",
        j.notes || "",
      ].map(csvEscape).join(",");
    });
    return head.join(",") + "\n" + rows.join("\n") + (rows.length ? "\n" : "");
  }

  /* ================= FORMATTING ================= */

  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  function fmtRM(n) {
    if (typeof n !== "number" || isNaN(n)) return "—";
    const neg = n < 0 ? "-" : "";
    n = Math.abs(n);
    const whole = Math.floor(n);
    const cents = Math.round((n - whole) * 100);
    const w = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return "RM " + neg + w + (cents ? "." + String(cents).padStart(2, "0") : "");
  }

  function fmtMins(m) {
    if (m == null || isNaN(m)) return "—";
    m = Math.round(m);
    if (m < 60) return m + "m";
    const h = Math.floor(m / 60);
    const r = m % 60;
    return r ? h + "h " + r + "m" : h + "h";
  }

  function fmtDate(iso) {
    if (!iso) return "—";
    const d = new Date(iso + (String(iso).length === 10 ? "T00:00:00" : ""));
    if (isNaN(d)) return "—";
    return d.getDate() + " " + MONTHS[d.getMonth()] + " " + d.getFullYear();
  }

  function fmtDateTime(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (isNaN(d)) return "—";
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return d.getDate() + " " + MONTHS[d.getMonth()] + ", " + hh + ":" + mm;
  }

  /* ================= EXPORTS ================= */
  return {
    SERVICES: SERVICES,
    STATUS_FLOW: STATUS_FLOW,
    STATUS_META: STATUS_META,
    serviceByCode: serviceByCode,
    serviceLabel: serviceLabel,
    isTerminal: isTerminal,
    isActive: isActive,
    canTransition: canTransition,
    nextStatuses: nextStatuses,
    makeId: makeId,
    makeJobRef: makeJobRef,
    normalizePhone: normalizePhone,
    waLink: waLink,
    buildDispatchMessage: buildDispatchMessage,
    buildCompareMessage: buildCompareMessage,
    rankQuotes: rankQuotes,
    slaState: slaState,
    daysBetween: daysBetween,
    addMonths: addMonths,
    nextPuspakomDue: nextPuspakomDue,
    dueStatus: dueStatus,
    matchServiceCodes: matchServiceCodes,
    parseVendorImport: parseVendorImport,
    matchVendors: matchVendors,
    vendorStats: vendorStats,
    monthKey: monthKey,
    summarize: summarize,
    csvEscape: csvEscape,
    jobsToCSV: jobsToCSV,
    fmtRM: fmtRM,
    fmtMins: fmtMins,
    fmtDate: fmtDate,
    fmtDateTime: fmtDateTime,
  };
});
