// rules.js — pure functions only. No DOM, no storage, no network.
// These implement the ten "Rules that must hold" from PRD.md section 6,
// plus the two gates (over-commit, orphan PO). test.mjs imports this file.

// ---------------------------------------------------------------- constants

export const REQUIREMENT_STATUSES = ['received', 'qualifying', 'quoted', 'submitted', 'won', 'lost', 'cancelled'];

export const GOVERNMENT_STATES = [
  'submitted', 'clarification_requested', 'technical_clarification',
  'commercial_negotiation', 'awaiting_approval', 'won', 'lost', 'cancelled',
];

export const DELIVERY_STAGES = [
  { id: 'oem_po_placed', label: 'OEM PO placed' },
  { id: 'production_started', label: 'Production started' },
  { id: 'production_done', label: 'Production done' },
  { id: 'pdi_scheduled', label: 'PDI scheduled' },
  { id: 'pdi_passed', label: 'PDI passed' },
  { id: 'govt_inspection', label: 'Government inspection' },
  { id: 'dispatched', label: 'Dispatched' },
  { id: 'delivered', label: 'Delivered' },
  { id: 'accepted', label: 'Accepted' },
];

export const ROLE_LABELS = { owner: 'Owner / Management', sales: 'Sales', operations: 'Operations', finance: 'Finance' };

// ---------------------------------------------------------------- dates

export function todayISO(now = new Date()) {
  const d = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 10);
}

export function addDays(iso, n) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** whole days from `fromIso` to `iso` (positive = future) */
export function daysUntil(iso, fromIso) {
  const a = Date.parse(iso + 'T00:00:00Z');
  const b = Date.parse(fromIso + 'T00:00:00Z');
  return Math.round((a - b) / 86400000);
}

export function formatDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d} ${months[m - 1]} ${String(y).slice(2)}`;
}

// ---------------------------------------------------------------- money

/** paise -> "₹10,03,000" (Indian grouping); paise shown only if non-zero */
export function money(paise) {
  const neg = paise < 0;
  const rupees = Math.floor(Math.abs(paise) / 100);
  const ps = Math.abs(paise) % 100;
  let s = String(rupees);
  if (s.length > 3) {
    const last3 = s.slice(-3);
    let rest = s.slice(0, -3);
    rest = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    s = rest + ',' + last3;
  }
  const out = ps ? `${s}.${String(ps).padStart(2, '0')}` : s;
  return `${neg ? '-' : ''}₹${out}`;
}

export function rupeesToPaise(v) {
  const n = Number(String(v).replace(/[^0-9.]/g, ''));
  if (!isFinite(n)) return 0;
  return Math.round(n * 100);
}

export function paiseToRupees(paise) { return paise / 100; }

export function pct(n) { return `${Math.round(n)}%`; }

// ---------------------------------------------------------------- coverage (F3)

/** firm coverage for a single line item; indications never count toward it */
export function lineCoverage(lineItem, sourcingRequests) {
  const rows = sourcingRequests.filter(
    (s) => s.lineItemId === lineItem.id && s.responseStatus !== 'declined'
  );
  const firm = rows
    .filter((s) => s.commitmentType === 'firm')
    .reduce((t, s) => t + (Number(s.committedQty) || 0), 0);
  const indicated = rows
    .filter((s) => s.commitmentType === 'indication')
    .reduce((t, s) => t + (Number(s.committedQty) || 0), 0);
  const required = Number(lineItem.qty) || 0;
  const uncovered = Math.max(0, required - firm);
  return { required, firm, indicated, uncovered, coveragePct: required ? Math.min(100, (firm / required) * 100) : 0 };
}

export function requirementCoverage(requirement, sourcingRequests) {
  const lines = (requirement.lineItems || []).map((li) => ({ lineItem: li, ...lineCoverage(li, sourcingRequests) }));
  const sum = (k) => lines.reduce((t, l) => t + l[k], 0);
  const requiredTotal = sum('required');
  const firmTotal = sum('firm');
  return {
    lines,
    requiredTotal,
    firmTotal,
    indicatedTotal: sum('indicated'),
    uncoveredTotal: sum('uncovered'),
    coveragePct: requiredTotal ? Math.min(100, (firmTotal / requiredTotal) * 100) : 0,
  };
}

/** shortlist = OEMs whose approval is live and covers the product */
export function oemApprovalStatus(oemId, approvals, today) {
  const rows = approvals.filter((a) => a.oemId === oemId);
  const expired = rows.filter((a) => daysUntil(a.validTill, today) < 0);
  const expiring = rows.filter((a) => {
    const d = daysUntil(a.validTill, today);
    return d >= 0 && d <= 30;
  });
  return { approved: rows.length > 0 && expired.length === 0, expired, expiring, rows };
}

export function shortlistOems(store, today) {
  return store.oems
    .map((o) => ({ oem: o, status: oemApprovalStatus(o.id, store.oem_approvals, today) }))
    .filter((r) => r.status.approved);
}

// ---------------------------------------------------------------- quotes (F4)

export function quoteLineValue(line) { return (Number(line.qty) || 0) * (Number(line.unitPrice) || 0); }
export function versionValue(version) { return (version.lines || []).reduce((t, l) => t + quoteLineValue(l), 0); }

export function recommendedPrice(lines, marginPct) {
  const cost = (lines || []).reduce((t, l) => t + quoteLineValue(l), 0);
  return Math.round(cost * (1 + (Number(marginPct) || 0) / 100));
}

export function latestVersion(quote) {
  if (!quote || !quote.versions || !quote.versions.length) return null;
  return quote.versions.reduce((best, v) => (v.v > best.v ? v : best), quote.versions[0]);
}

export function comparablesFor(requirementId, comparables) {
  // untrusted rows are excluded from the price hint, but still shown with a badge
  return comparables.filter((c) => c.requirementId === requirementId);
}

// ---------------------------------------------------------------- orders (F6/F7)

export function orderOfQuote(store, quoteId, version) {
  return store.orders.find((o) => o.quoteId === quoteId && o.quoteVersion === version);
}

export function orderLineage(store, order) {
  const req = store.requirements.find((r) => r.id === order.requirementId);
  const quote = store.quotes.find((q) => q.id === order.quoteId);
  const customer = store.customers.find((c) => c.id === order.customerId);
  const oem = store.oems.find((o) => o.id === order.oemId);
  return {
    requirement: req ? req.ref : '—',
    requirementId: order.requirementId,
    quote: quote ? `${quote.ref} v${order.quoteVersion}` : '—',
    quoteId: order.quoteId,
    customer: customer ? customer.name : '—',
    oem: oem ? oem.name : '—',
  };
}

export function deliveryRisk(order) {
  if (!order || !order.expectedDelivery || !order.deliveryDeadline) return false;
  return daysUntil(order.expectedDelivery, order.deliveryDeadline) > 0;
}

export function deliveryStagesFor(order, deliveries) {
  const done = deliveries.filter((d) => d.orderId === order.id);
  const currentIndex = done.reduce((max, d) => {
    const i = DELIVERY_STAGES.findIndex((s) => s.id === d.stage);
    return Math.max(max, i);
  }, -1);
  return DELIVERY_STAGES.map((s, i) => ({
    ...s,
    done: i <= currentIndex,
    record: done.find((d) => d.stage === s.id) || null,
  }));
}

export function pdiTotals(order, pdiRecords) {
  const rows = pdiRecords.filter((p) => p.orderId === order.id);
  return rows.reduce(
    (t, p) => ({ offered: t.offered + p.offeredQty, cleared: t.cleared + p.clearedQty, rejected: t.rejected + p.rejectedQty }),
    { offered: 0, cleared: 0, rejected: 0 }
  );
}

/** dispatch is blocked while any PDI on the order is held or failed */
export function dispatchBlocked(order, pdiRecords, settings) {
  if (!settings || !settings.pdiBlocksDispatch) return false;
  return pdiRecords.some((p) => p.orderId === order.id && (p.status === 'held' || p.status === 'failed'));
}

// ---------------------------------------------------------------- payments (F8)

export function invoiceBalance(invoice, payments) {
  const rows = payments.filter((p) => p.invoiceId === invoice.id);
  const receipts = rows.filter((p) => p.direction === 'customer_receipt').reduce((t, p) => t + p.amount, 0);
  const oemPaid = rows.filter((p) => p.direction === 'oem_payment').reduce((t, p) => t + p.amount, 0);
  const deductions = rows.reduce((t, p) => t + (p.tds || 0) + (p.ld || 0) + (p.gstOnLd || 0) + (p.other || 0), 0);
  return {
    gross: invoice.gross,
    received: receipts,
    outstanding: invoice.gross - receipts,
    oemPaid,
    deductions,
  };
}

/** commission attaches to the OEM-payment milestone; amount stays deferred until D3 is answered */
export function commissionDue(store, order) {
  const invoices = store.invoices.filter((i) => i.orderId === order.id);
  const ids = invoices.map((i) => i.id);
  const oemPaid = store.payments.some((p) => ids.includes(p.invoiceId) && p.direction === 'oem_payment');
  if (store.settings.commissionDeferred) {
    return { milestoneReached: oemPaid, deferred: true, amount: null, note: 'Deferred pending one real transaction (PRD [O2]).' };
  }
  return { milestoneReached: oemPaid, deferred: false, amount: 0, note: '' };
}

// ---------------------------------------------------------------- documents (F8)

export function docStatus(doc, today) {
  const d = daysUntil(doc.expiryDate, today);
  if (d < 0) return { key: 'expired', label: 'Expired', days: d };
  if (d <= 30) return { key: 'expiring', label: `Expires in ${d}d`, days: d };
  return { key: 'valid', label: 'Valid', days: d };
}

// ---------------------------------------------------------------- dashboard (F10)

export function dashboard(store, today) {
  const openOrders = store.orders.filter((o) => !deliveriesComplete(o, store.deliveries));
  const atRisk = openOrders.filter((o) => deliveryRisk(o));
  const quotesAwaiting = store.quotes.filter((q) => {
    const lv = latestVersion(q);
    if (!lv) return false;
    const gr = store.government_responses.filter((g) => g.quoteId === q.id).map((g) => g.state);
    return lv.status === 'submitted' && !gr.some((s) => s === 'won' || s === 'lost' || s === 'cancelled');
  });
  const invoicesOpen = store.invoices.filter((i) => invoiceBalance(i, store.payments).outstanding > 0);
  const paymentsPending = invoicesOpen.reduce((t, i) => t + invoiceBalance(i, store.payments).outstanding, 0);
  const oemPending = store.sourcing_requests.filter((s) => s.responseStatus === 'pending');
  const docsAttention = store.documents.filter((d) => docStatus(d, today).key !== 'valid');
  const lost = store.requirements.filter((r) => r.status === 'lost');
  return {
    openOrders: { count: openOrders.length, rows: openOrders },
    atRisk: { count: atRisk.length, rows: atRisk },
    quotesAwaiting: { count: quotesAwaiting.length, rows: quotesAwaiting },
    paymentsPending: { count: invoicesOpen.length, total: paymentsPending, rows: invoicesOpen },
    oemPending: { count: oemPending.length, rows: oemPending },
    docsAttention: { count: docsAttention.length, rows: docsAttention },
    losses: { count: lost.length, rows: lost },
  };
}

export function deliveriesComplete(order, deliveries) {
  return deliveries.some((d) => d.orderId === order.id && d.stage === 'accepted');
}

// ---------------------------------------------------------------- follow-up rule (F5)

export function generatedFollowUps(store, today) {
  const stale = Number(store.settings.staleFollowUpDays) || 7;
  const created = [];
  store.quotes.forEach((q) => {
    const lv = latestVersion(q);
    if (!lv || lv.status !== 'submitted') return;
    const responses = store.government_responses.filter((g) => g.quoteId === q.id);
    const lastState = responses.length ? responses[responses.length - 1] : null;
    if (!lastState) return;
    if (['won', 'lost', 'cancelled'].includes(lastState.state)) return;
    const age = daysUntil(today, lastState.at);
    if (age >= stale) {
      created.push({
        id: `FU-${q.id}-g`, requirementId: q.requirementId, quoteId: q.id,
        type: 'no_response_7d', dueDate: today, owner: 'u2', status: 'open',
        note: `No response for ${age} days on ${q.ref}.`,
      });
    }
  });
  return created;
}

// ---------------------------------------------------------------- validation (gates)

export function validateRequirement(data) {
  const errors = [];
  if (!data.customerId) errors.push('Customer / agency is required.');
  if (!String(data.product || '').trim()) errors.push('Product or title is required.');
  if (!(Number(data.qty) > 0)) errors.push('Quantity must be greater than zero.');
  if (!data.requiredDelivery) errors.push('Required delivery date is required.');
  if (!data.submissionDeadline) errors.push('Submission deadline is required.');
  return { ok: errors.length === 0, errors };
}

export function validateLoss(requirement) {
  if (requirement.status === 'lost' && !requirement.lossReason) {
    return { ok: false, errors: ['A lost opportunity needs a structured loss reason.'] };
  }
  return { ok: true, errors: [] };
}

/** Gate: a quote line may not exceed firm coverage for that line item. */
export function validateQuoteLine(line, requirement, sourcingRequests) {
  const li = (requirement.lineItems || []).find((l) => l.id === line.lineItemId);
  if (!li) return { ok: false, errors: ['The line item does not belong to this requirement.'] };
  const cov = lineCoverage(li, sourcingRequests);
  if (Number(line.qty) > cov.firm) {
    return {
      ok: false,
      errors: [`Only ${cov.firm} of ${cov.required} is firmly covered for ${li.partNo}. Indications (${cov.indicated}) do not count.`],
    };
  }
  return { ok: true, errors: [] };
}

/** Gate: no orphan PO — an order needs an approved quote version. */
export function validateOrder(order, store) {
  const q = store.quotes.find((x) => x.id === order.quoteId);
  if (!q) return { ok: false, errors: ['Every PO must map to an approved quotation. None was found.'] };
  const v = q.versions.find((x) => x.v === order.quoteVersion);
  if (!v) return { ok: false, errors: ['That quote version does not exist.'] };
  if (v.status !== 'approved') {
    return { ok: false, errors: [`${q.ref} v${v.v} is not approved (it is "${v.status}"). Approve it first.`] };
  }
  return { ok: true, errors: [] };
}

// ---------------------------------------------------------------- plain-language answers (F10)

export function ask(question, store, today) {
  const q = String(question || '').toLowerCase();
  const link = (label, href) => ({ label, href });

  if (/(how many|count).*(order|po)/.test(q) || /orders? (are )?(there|open)/.test(q)) {
    const d = dashboard(store, today);
    return {
      kind: 'open_orders',
      text: `There are ${d.openOrders.count} open orders. ${d.atRisk.count} are at delivery risk.`,
      rows: d.openOrders.rows.map((o) => link(`${o.ref} · ${o.poNumber}`, `#/orders/${o.id}`)),
    };
  }
  if (/(won|win).*(month|this month|contract)/.test(q)) {
    const month = today.slice(0, 7);
    const won = store.government_responses.filter((g) => g.state === 'won' && g.at.slice(0, 7) === month);
    return {
      kind: 'won_this_month',
      text: `${won.length} contract${won.length === 1 ? '' : 's'} won this month (${month}).`,
      rows: won.map((g) => {
        const quote = store.quotes.find((x) => x.id === g.quoteId);
        return link(`${quote ? quote.ref : g.quoteId} · won ${formatDate(g.at)}`, quote ? `#/quotes/${quote.id}` : '#/quotes');
      }),
    };
  }
  if (/(why|reason).*(lose|lost|loss)/.test(q)) {
    const lost = store.requirements.filter((r) => r.status === 'lost');
    const byReason = {};
    lost.forEach((r) => { byReason[r.lossReason || 'other'] = (byReason[r.lossReason || 'other'] || 0) + 1; });
    const parts = Object.entries(byReason).map(([k, n]) => `${labelForLoss(k)}: ${n}`);
    return {
      kind: 'why_lost',
      text: lost.length ? `Losses by reason — ${parts.join('; ')}.` : 'No losses recorded.',
      rows: lost.map((r) => link(`${r.ref} · ${labelForLoss(r.lossReason)}`, `#/requirements/${r.id}`)),
    };
  }
  if (/(what|which).*(lose|lost|loss)/.test(q)) {
    const lost = store.requirements.filter((r) => r.status === 'lost');
    return {
      kind: 'what_lost',
      text: `${lost.length} opportunities lost.`,
      rows: lost.map((r) => link(`${r.ref} · ${r.product}`, `#/requirements/${r.id}`)),
    };
  }
  if (/(due|follow.?up|pending).*(follow|task)|what.*(follow|task)/.test(q)) {
    const tasks = [...store.follow_ups.filter((f) => f.status === 'open'), ...generatedFollowUps(store, today)];
    return {
      kind: 'follow_ups',
      text: `${tasks.length} follow-up task(s) open.`,
      rows: tasks.map((t) => link(t.note || t.type, t.requirementId ? `#/requirements/${t.requirementId}` : '#/morning')),
    };
  }
  if (/(risk|late|delay)/.test(q)) {
    const d = dashboard(store, today);
    return {
      kind: 'at_risk',
      text: `${d.atRisk.count} order(s) at delivery risk.`,
      rows: d.atRisk.rows.map((o) => link(`${o.ref} · expected ${formatDate(o.expectedDelivery)} vs due ${formatDate(o.deliveryDeadline)}`, `#/orders/${o.id}`)),
    };
  }
  if (/(payment|money|receivab|outstanding|due to us)/.test(q)) {
    const d = dashboard(store, today);
    return {
      kind: 'payments',
      text: `${money(d.paymentsPending.total)} pending across ${d.paymentsPending.count} invoice(s).`,
      rows: d.paymentsPending.rows.map((i) => link(`${i.invoiceNo} · ${money(invoiceBalance(i, store.payments).outstanding)} open`, `#/payments`)),
    };
  }

  return {
    kind: 'unsupported',
    text: 'I can answer these from your records (never invented):',
    capability: [
      'How many orders are there?',
      'How many contracts did we win this month?',
      'What did we lose?',
      'Why did we lose?',
      'What is at delivery risk?',
      'What payments are pending?',
      'What follow-ups are open?',
    ],
    rows: [],
  };
}

export function labelForLoss(id) {
  const map = {
    price: 'Price', technical_non_compliance: 'Technical non-compliance', delivery_timeline: 'Delivery timeline',
    competitor_preference: 'Competitor preference', quantity_or_capacity: 'Quantity or capacity',
    cancelled: 'Cancelled', not_pursued: 'Not pursued', other: 'Other',
  };
  return map[id] || id;
}

// ---------------------------------------------------------------- audit (F11)

export function makeAuditEntry(actor, role, entity, entityRef, action, at = new Date().toISOString()) {
  return {
    id: 'AU-' + Math.random().toString(36).slice(2, 9),
    at, actor, role, entity, entityRef, action,
  };
}

export function appendAudit(list, entry) {
  return [...list, entry];
}

// ---------------------------------------------------------------- refs

export function nextRef(store, kind) {
  const n = (store.requirements.length + 1);
  if (kind === 'requirement') return `RFI-26${String(n).padStart(2, '0')}`;
  if (kind === 'quote') return `QTN-26${String(store.quotes.length + 1).padStart(2, '0')}`;
  return `REF-${n}`;
}
