// store.js — persistence + audited mutations. The only module that writes.
// Swapping localStorage for a server API later is a change to load()/save() only.
import { seed } from './data.js';
import * as R from './rules.js';

const KEY = 'tenderdesk.v1';
let state = null;
const subs = [];

export function getState() { return state; }
export function getUser() { return state.users.find((u) => u.id === state.currentUserId) || state.users[0]; }
export function subscribe(fn) { subs.push(fn); }
function emit() { subs.forEach((fn) => fn()); }
function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* storage full/blocked */ } }

function fresh() { const s = seed(); s.currentUserId = 'u1'; s.flash = null; return s; }

function ensureFollowUps() {
  const gen = R.generatedFollowUps(state, R.todayISO());
  gen.forEach((g) => { if (!state.follow_ups.some((f) => f.id === g.id)) state.follow_ups.push(g); });
}

export function load() {
  let raw = null;
  try { raw = localStorage.getItem(KEY); } catch (e) { raw = null; }
  state = raw ? JSON.parse(raw) : fresh();
  if (!state.users) state = fresh();
  if (!state.currentUserId) state.currentUserId = state.users[0].id;
  if (!state.follow_ups) state.follow_ups = [];
  ensureFollowUps();
  save();
}

export function setUser(id) { state.currentUserId = id; state.flash = { type: 'info', msg: `Role switched — the money panels follow the role.` }; save(); emit(); }
export function flash(type, msg) { state.flash = { type, msg }; emit(); }
export function clearFlash() { state.flash = null; }

function audited(entity, entityRef, action, fn) {
  const res = fn();
  if (res && res.ok === false) return res;
  const u = getUser();
  state.audit = R.appendAudit(state.audit, R.makeAuditEntry(u.id, u.role, entity, entityRef, action));
  ensureFollowUps();
  save();
  emit();
  return res || { ok: true };
}

const newId = (p) => p + '-' + Math.random().toString(36).slice(2, 7);

// ------------------------------------------------------------------ requirements
export function createRequirement(data) {
  const v = R.validateRequirement(data);
  if (!v.ok) return { ok: false, errors: v.errors };
  return audited('requirement', data.ref, 'created', () => {
    state.requirements.push({
      id: newId('R'), ref: R.nextRef(state, 'requirement'), customerId: data.customerId, product: data.product,
      qty: Number(data.qty), uom: data.uom || 'nos', requiredDelivery: data.requiredDelivery,
      tenderRef: data.tenderRef || '—', submissionDeadline: data.submissionDeadline, specs: data.specs || '',
      source: data.source || 'Direct', status: 'received', lossReason: null, lossNote: '',
      createdAt: R.todayISO(), owner: state.currentUserId, lineItems: [],
    });
    return { ok: true };
  });
}

export function addLineItem(reqId, item) {
  if (!item.partNo || !(Number(item.qty) > 0)) return { ok: false, errors: ['Part number and a quantity above zero are required.'] };
  return audited('requirement', reqId, 'line item added', () => {
    const r = state.requirements.find((x) => x.id === reqId);
    r.lineItems.push({ id: newId('L'), partNo: item.partNo, description: item.description || '', qty: Number(item.qty), uom: item.uom || 'nos' });
    return { ok: true };
  });
}

export function setRequirementStatus(reqId, status, lossReason, lossNote) {
  const r = state.requirements.find((x) => x.id === reqId);
  const probe = { status, lossReason };
  const v = R.validateLoss(probe);
  if (!v.ok) return { ok: false, errors: v.errors };
  return audited('requirement', r.ref, `status → ${status}`, () => {
    r.status = status;
    r.lossReason = status === 'lost' ? lossReason : null;
    r.lossNote = status === 'lost' ? (lossNote || '') : '';
    return { ok: true };
  });
}

// ------------------------------------------------------------------ sourcing / coverage
export function addSourcing(reqId, data) {
  const r = state.requirements.find((x) => x.id === reqId);
  const li = r.lineItems.find((l) => l.id === data.lineItemId);
  if (!li) return { ok: false, errors: ['Choose a line item.'] };
  if (!data.oemId) return { ok: false, errors: ['Choose an OEM.'] };
  if (data.commitmentType === 'firm' && !(Number(data.committedQty) > 0)) {
    return { ok: false, errors: ['A firm commitment needs a quantity above zero.'] };
  }
  return audited('sourcing', r.ref, `request to ${data.oemId}`, () => {
    state.sourcing_requests.push({
      id: newId('S'), requirementId: reqId, lineItemId: data.lineItemId, oemId: data.oemId,
      requestedAt: R.todayISO(), responseStatus: Number(data.committedQty) > 0 ? 'quoted' : 'pending',
      commitmentType: data.commitmentType, committedQty: Number(data.committedQty) || 0,
      unitPrice: Math.round((Number(data.unitPrice) || 0) * 100), leadTimeDays: Number(data.leadTimeDays) || 0,
      respondedAt: Number(data.committedQty) > 0 ? R.todayISO() : null, note: data.note || '',
    });
    return { ok: true };
  });
}

// ------------------------------------------------------------------ quotes
export function createQuoteVersion(reqId, lines, targetMarginPct) {
  const r = state.requirements.find((x) => x.id === reqId);
  const errors = [];
  lines.forEach((l) => { const v = R.validateQuoteLine(l, r, state.sourcing_requests); if (!v.ok) errors.push(...v.errors); });
  if (errors.length) return { ok: false, errors };
  const quote = state.quotes.find((q) => q.requirementId === reqId);
  const forRef = quote ? quote.ref : R.nextRef(state, 'quote');
  return audited('quote', forRef, 'new version', () => {
    const norm = lines.map((l) => ({ lineItemId: l.lineItemId, oemId: l.oemId, qty: Number(l.qty), unitPrice: Math.round((Number(l.unitPrice) || 0) * 100) }));
    const recommended = R.recommendedPrice(norm, targetMarginPct);
    if (quote) {
      const v = Math.max(...quote.versions.map((x) => x.v)) + 1;
      quote.versions.push({ v, status: 'draft', targetMarginPct: Number(targetMarginPct), lines: norm, recommended, createdBy: state.currentUserId, createdAt: R.todayISO(), approver: null, approvedAt: null, note: '' });
    } else {
      state.quotes.push({
        id: newId('Q'), ref: forRef, requirementId: reqId,
        versions: [{ v: 1, status: 'draft', targetMarginPct: Number(targetMarginPct), lines: norm, recommended, createdBy: state.currentUserId, createdAt: R.todayISO(), approver: null, approvedAt: null, note: '' }],
      });
    }
    return { ok: true };
  });
}

export function approveQuote(quoteId, version) {
  const q = state.quotes.find((x) => x.id === quoteId);
  if (getUser().role !== 'owner') return { ok: false, errors: ['Only the owner/management role can approve a quote.'] };
  return audited('quote', `${q.ref} v${version}`, 'approved', () => {
    q.versions.forEach((v) => { if (v.status === 'approved') v.status = 'superseded'; });
    const v = q.versions.find((x) => x.v === version);
    v.status = 'approved'; v.approver = state.currentUserId; v.approvedAt = R.todayISO();
    return { ok: true };
  });
}

export function submitQuote(quoteId) {
  const q = state.quotes.find((x) => x.id === quoteId);
  const lv = R.latestVersion(q);
  if (lv.status !== 'approved') return { ok: false, errors: ['Approve the current version before submitting it.'] };
  return audited('quote', `${q.ref} v${lv.v}`, 'submitted', () => {
    lv.status = 'submitted';
    state.government_responses.push({ id: newId('GR'), quoteId, state: 'submitted', at: R.todayISO(), note: 'Submitted.' });
    return { ok: true };
  });
}

export function setGovernmentState(quoteId, govState) {
  const q = state.quotes.find((x) => x.id === quoteId);
  return audited('quote', q.ref, `government → ${govState}`, () => {
    state.government_responses.push({ id: newId('GR'), quoteId, state: govState, at: R.todayISO(), note: '' });
    if (govState === 'won' || govState === 'lost') {
      const r = state.requirements.find((x) => x.id === q.requirementId);
      if (r) r.status = govState;
    }
    return { ok: true };
  });
}

// ------------------------------------------------------------------ orders
export function createOrder(data) {
  const probe = { quoteId: data.quoteId, quoteVersion: Number(data.quoteVersion) };
  const v = R.validateOrder(probe, state);
  if (!v.ok) return v;
  const q = state.quotes.find((x) => x.id === data.quoteId);
  return audited('order', data.poNumber, 'created from ' + q.ref, () => {
    state.orders.push({
      id: newId('PO'), ref: 'PO-' + (state.orders.length + 1) + '-01', quoteId: data.quoteId, quoteVersion: Number(data.quoteVersion),
      requirementId: q.requirementId, customerId: state.requirements.find((r) => r.id === q.requirementId).customerId,
      poNumber: data.poNumber, poDate: data.poDate || R.todayISO(), deliveryDeadline: data.deliveryDeadline,
      oemId: data.oemId, supplierPo: data.supplierPo || '—', compliance: data.compliance || '', inspection: data.inspection || '',
      pdiRequirements: data.pdiRequirements || '', expectedDelivery: data.expectedDelivery || data.deliveryDeadline, createdAt: R.todayISO(),
    });
    return { ok: true };
  });
}

export function advanceDelivery(orderId, stageId) {
  const o = state.orders.find((x) => x.id === orderId);
  if (stageId === 'dispatched' && R.dispatchBlocked(o, state.pdi_records, state.settings)) {
    return { ok: false, errors: ['Dispatch is blocked: a PDI on this order is held or failed.'] };
  }
  return audited('order', o.ref, `stage → ${stageId}`, () => {
    state.deliveries.push({ id: newId('DL'), orderId, invoiceId: null, stage: stageId, owner: state.currentUserId, expectedDate: R.todayISO(), at: R.todayISO(), note: '' });
    return { ok: true };
  });
}

export function addPdi(orderId, pdi) {
  const o = state.orders.find((x) => x.id === orderId);
  if (!(Number(pdi.offeredQty) > 0)) return { ok: false, errors: ['Offered quantity is required.'] };
  return audited('order', o.ref, 'PDI recorded', () => {
    state.pdi_records.push({ id: newId('PDI'), orderId, offeredQty: Number(pdi.offeredQty), clearedQty: Number(pdi.clearedQty) || 0, rejectedQty: Number(pdi.rejectedQty) || 0, status: pdi.status, mode: pdi.mode || 'in_person', inspector: pdi.inspector || '', date: R.todayISO(), note: pdi.note || '' });
    return { ok: true };
  });
}

// ------------------------------------------------------------------ invoices / payments
export function addInvoice(orderId, inv) {
  const o = state.orders.find((x) => x.id === orderId);
  if (!inv.invoiceNo || !(Number(inv.net) > 0)) return { ok: false, errors: ['Invoice number and a net value above zero are required.'] };
  return audited('order', o.ref, 'invoice raised', () => {
    const net = Math.round(Number(inv.net) * 100);
    const igst = Math.round(net * 0.18);
    state.invoices.push({ id: newId('IV'), orderId, invoiceNo: inv.invoiceNo, invoiceDate: inv.invoiceDate || R.todayISO(), net, igst, gross: net + igst });
    return { ok: true };
  });
}

export function addPayment(invoiceId, p) {
  const inv = state.invoices.find((x) => x.id === invoiceId);
  if (!(Number(p.amount) > 0)) return { ok: false, errors: ['A payment amount above zero is required.'] };
  return audited('invoice', inv.invoiceNo, p.direction === 'oem_payment' ? 'OEM payment recorded' : 'customer receipt recorded', () => {
    state.payments.push({
      id: newId('P'), invoiceId, direction: p.direction, amount: Math.round(Number(p.amount) * 100),
      date: p.date || R.todayISO(), reference: p.reference || '', tds: Math.round((Number(p.tds) || 0) * 100),
      ld: Math.round((Number(p.ld) || 0) * 100), gstOnLd: 0, other: 0,
    });
    return { ok: true };
  });
}

// ------------------------------------------------------------------ documents
export function addDocument(doc) {
  if (!doc.title || !doc.expiryDate) return { ok: false, errors: ['Document title and expiry date are required.'] };
  return audited('document', doc.title, 'added', () => {
    state.documents.push({ id: newId('D'), type: doc.type || 'Document', oemId: doc.oemId || null, title: doc.title, productCode: doc.productCode || '', requirementId: null, issueDate: doc.issueDate || R.todayISO(), expiryDate: doc.expiryDate, ref: doc.ref || '' });
    return { ok: true };
  });
}

export function resolveFollowUp(id) {
  return audited('follow-up', id, 'resolved', () => {
    const f = state.follow_ups.find((x) => x.id === id);
    if (f) { f.status = 'done'; f.resolvedAt = R.todayISO(); }
    return { ok: true };
  });
}

// ------------------------------------------------------------------ utility
export function exportJSON() {
  const copy = { ...state }; delete copy.flash;
  return JSON.stringify(copy, null, 2);
}

export function importJSON(text) {
  try {
    const parsed = JSON.parse(text);
    if (!parsed.users || !parsed.requirements) return { ok: false, errors: ['That does not look like a TenderDesk export.'] };
    parsed.flash = null;
    if (!parsed.currentUserId) parsed.currentUserId = parsed.users[0].id;
    state = parsed; ensureFollowUps(); save(); emit();
    return { ok: true, errors: [] };
  } catch (e) {
    return { ok: false, errors: ['Could not read that JSON.'] };
  }
}

export function reset() { state = fresh(); save(); emit(); }
