// views.js — rendering + event handlers. Reads state; never writes it directly
// (all writes go through store.js so every mutation is audited).
import * as R from './rules.js';
import * as S from './store.js';

export const ui = { ask: null, search: '', err: null };
let rerender = () => {};
export function setRerender(fn) { rerender = fn; }

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const REQ_TONE = { received: 'info', qualifying: 'warn', quoted: 'info', submitted: 'info', won: 'ok', lost: 'danger', cancelled: 'muted' };
const GOV_TONE = { submitted: 'info', clarification_requested: 'warn', technical_clarification: 'warn', commercial_negotiation: 'warn', awaiting_approval: 'warn', won: 'ok', lost: 'danger', cancelled: 'muted' };
const PDI_TONE = { passed: 'ok', held: 'warn', failed: 'danger', pending: 'info' };

const chip = (text, tone) => `<span class="chip chip--${tone || 'muted'}">${esc(text)}</span>`;
const bar = (pct, tone) => `<span class="bar"><span class="bar__fill bar__fill--${tone || 'navy'}" style="width:${Math.max(0, Math.min(100, pct)).toFixed(1)}%"></span></span>`;

function panel(title, body, extra = '') {
  return `<section class="panel ${extra}"><div class="panel__head"><h2 class="panel__title">${esc(title)}</h2></div><div class="panel__body">${body}</div></section>`;
}
function metric(label, value, sub, tone = '') {
  return `<div class="metric ${tone ? 'metric--' + tone : ''}"><div class="metric__label">${esc(label)}</div><div class="metric__value">${value}</div>${sub ? `<div class="metric__sub">${sub}</div>` : ''}</div>`;
}
function empty(msg) { return `<p class="empty">${esc(msg)}</p>`; }

const icons = {
  morning: '<path d="M3 11l9-7 9 7"/><path d="M5 10v9h14v-9"/>',
  req: '<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4"/><path d="M9 13h6M9 17h6"/>',
  oem: '<path d="M4 20V9l8-5 8 5v11"/><path d="M9 20v-6h6v6"/>',
  quote: '<path d="M5 4h14v16H5z"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  order: '<path d="M4 7l8-4 8 4v10l-8 4-8-4z"/><path d="M4 7l8 4 8-4M12 11v10"/>',
  pay: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18"/>',
  doc: '<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4"/>',
  search: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4-4"/>',
  audit: '<path d="M12 3v18M5 8l7-5 7 5"/><rect x="5" y="8" width="14" height="12" rx="1"/>',
};
const icon = (k) => `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round">${icons[k] || ''}</svg>`;

const NAV = [
  ['#/morning', 'morning', 'Morning view'],
  ['#/requirements', 'req', 'Requirements'],
  ['#/oems', 'oem', 'OEM & sourcing'],
  ['#/quotes', 'quote', 'Quotations'],
  ['#/orders', 'order', 'Orders & fulfilment'],
  ['#/payments', 'pay', 'Payments'],
  ['#/documents', 'doc', 'Documents'],
  ['#/search', 'search', 'Search & history'],
  ['#/audit', 'audit', 'Audit & approvals'],
];

function layout(state, active, content) {
  const u = S.getUser();
  const roles = state.users.map((x) => `<option value="${x.id}" ${x.id === u.id ? 'selected' : ''}>${esc(x.name)} · ${esc(R.ROLE_LABELS[x.role])}</option>`).join('');
  const nav = NAV.map(([href, ic, label]) => `<a class="nav__item ${active === href ? 'is-active' : ''}" href="${href}">${icon(ic)}<span>${esc(label)}</span></a>`).join('');
  const flash = state.flash ? `<div class="flash flash--${state.flash.type}" data-flash>${esc(state.flash.msg)}</div>` : '';
  return `
  <div class="shell">
    <aside class="side">
      <a class="brand" href="#/"><span class="brand__mark">TD</span><span class="brand__name">TenderDesk<small>requirement → delivery</small></span></a>
      <nav class="nav">${nav}</nav>
      <div class="side__foot">
        <p class="side__note">Working MVP · sample data traced to your nine sheets.</p>
        <a class="side__link" href="#/about">About this build</a>
      </div>
    </aside>
    <div class="main">
      <header class="top">
        <button class="top__menu" data-action="toggleMenu" aria-label="Open menu" type="button">☰</button>
        <a class="top__brand" href="#/">TD</a>
        <form class="top__search" data-form="search"><input name="q" placeholder="Search refs, parts, OEMs, losses…" value="${esc(ui.search)}" aria-label="Global search"><button class="btn btn--ghost" type="submit">Search</button></form>
        <label class="top__role"><span>Signed in as</span><select data-action="role">${roles}</select></label>
      </header>
      ${flash}
      <main class="content">${content}</main>
      <footer class="foot"><span>TenderDesk — Ram Prasad · defence contract consultancy</span><span>No key, no network: this build answers from your records only.</span></footer>
    </div>
  </div>`;
}

// ------------------------------------------------------------------ landing
function landing() {
  const caps = [
    ['Requirement & RFI', 'One record per tender, up to 500 line items, seven statuses.'],
    ['OEM master & sourcing', 'Capabilities, approvals, lead times, and every request made.'],
    ['Quantity coverage', 'Firm vs indication, with the uncovered balance always visible.'],
    ['Quote & bid intelligence', 'Comparable past bids before you price; versioned and approved.'],
    ['Government response & follow-up', 'Eight states and automatic internal tasks at seven days.'],
    ['Order & PO', 'No orphan PO: every order maps to an approved quotation.'],
    ['Fulfilment, PDI & delivery', 'Quantified PDI, partial delivery, and early delivery-risk flags.'],
    ['Payments & commission', 'Partial payments, TDS/LD, and a commission milestone.'],
    ['Document & compliance vault', 'Approvals and certificates with expiry reminders.'],
    ['Search, history & losses', 'Find the comparable past requirement; structured loss reasons.'],
    ['Dashboard & plain questions', 'The morning view, and answers that come from the data.'],
  ];
  return `
  <div class="site">
    <header class="site__nav"><a class="brand" href="#/"><span class="brand__mark">TD</span><span class="brand__name">TenderDesk</span></a><a class="btn btn--primary" href="#/morning">Open the demo</a></header>
    <section class="hero">
      <p class="eyebrow">A working system for a defence contract consultancy</p>
      <h1>One requirement.<br>One record. One timeline.</h1>
      <p class="lede">Government and defence agencies send requirements; you fulfil them through a network of OEM suppliers. Today that lives in Excel, email and memory — so history is not searchable, and every new quote starts from scratch.</p>
      <div class="hero__cta"><a class="btn btn--primary btn--lg" href="#/morning">Open the working demo</a><a class="btn btn--ghost btn--lg" href="#/about">How this was built</a></div>
      <p class="hero__note">Runs locally · works with the network off · no account, no keys · sample data traced to your nine spreadsheets.</p>
    </section>
    <section class="band">
      <div class="band__head"><h2>What the brief asked for — all eleven, working</h2><p>Every screen below is live in the demo. Numbers come from the records, never invented.</p></div>
      <div class="grid grid--3">${caps.map(([t, d], i) => `<article class="cap"><span class="cap__n">${String(i + 1).padStart(2, '0')}</span><h3>${esc(t)}</h3><p>${esc(d)}</p></article>`).join('')}</div>
    </section>
    <section class="band band--ink">
      <div class="band__head"><h2>Three things it can prove</h2><p>The brief names its own bottlenecks. Two of them are not software problems — so this build is sold on the three that are.</p></div>
      <div class="grid grid--3">
        <article class="promise"><h3>Search replaces memory</h3><p>"History is not searchable, so every new quote starts from scratch." Quote assembly stops being a blank page.</p></article>
        <article class="promise"><h3>Follow-ups stop being hours</h3><p>Three to four hours a day of remembering and chasing becomes one due list the system keeps.</p></article>
        <article class="promise"><h3>No uncovered commitments</h3><p>Only firm OEM commitments satisfy a requirement. An indication never counts, and the gate refuses the rest.</p></article>
      </div>
    </section>
    <section class="band">
      <div class="band__head"><h2>What it deliberately does not do</h2></div>
      <ul class="limits">
        <li>No automatic final bid price, and no OEM chosen without a human.</li>
        <li>No legal or compliance judgement.</li>
        <li>Not an accounting or ERP replacement.</li>
        <li>No government-portal automation and no auto-messaging to agencies.</li>
      </ul>
      <div class="hero__cta"><a class="btn btn--primary btn--lg" href="#/morning">Open the demo</a></div>
    </section>
    <footer class="site__foot"><span>TenderDesk · working name · built from the Ram Prasad requirement brief</span><a href="#/about">About this build</a></footer>
  </div>`;
}

// ------------------------------------------------------------------ about
function about(state) {
  const d = R.dashboard(state, R.todayISO());
  return `
  <div class="pagehead"><div><p class="eyebrow">About this build</p><h1>How TenderDesk was made</h1><p class="lede">From a discovery brief, to a PRD, a stack, a plan, a scope cut — then this. Nothing here was invented; prices, dates and names come only from the brief and the sheets.</p></div></div>
  <div class="grid grid--2">
    ${panel('The pipeline', `<ol class="steps">
      <li><strong>Brief.</strong> The written output of the discovery call, plus nine spreadsheets.</li>
      <li><strong>Requirements.</strong> <code>PRD.md</code> — what he needs and what does not add up.</li>
      <li><strong>Stack.</strong> <code>TECH-STACK.md</code> — every choice traced to a constraint.</li>
      <li><strong>Order.</strong> <code>IMPLEMENTATION-PLAN.md</code> — every step demonstrable.</li>
      <li><strong>Scope.</strong> <code>SCOPE-CUT.md</code> — what ships now, what is honestly Phase 2.</li>
      <li><strong>Build.</strong> <code>BUILD-BRIEF.md</code> — the assembled brief, with past failures written back in.</li>
    </ol>`)}
    ${panel('Rules enforced in code', `<ul class="ticks">
      <li>No quote without a requirement; no PO without an approved quote.</li>
      <li>Firm commitments count; indications never do.</li>
      <li>PDI cleared ≠ offered ≠ rejected; a held PDI blocks dispatch.</li>
      <li>Balances are derived, never stored.</li>
      <li>Loss reasons are a closed list; every change is audited.</li>
    </ul>`)}
  </div>
  ${panel('What is honest about it', `<div class="grid grid--3">
    ${metric('Seed records', String(state.requirements.length), 'requirements in the demo')}
    ${metric('Open orders', String(d.openOrders.count), `${d.atRisk.count} at delivery risk`)}
    ${metric('Commission', 'Deferred', 'until one real transaction is walked through')}
  </div>
  <p class="muted small">The nine sheets are mostly masters and templates, so the demo runs on clearly-labelled sample data following their exact columns. Historical import, a hosted database and multi-user access are Phase 2 — see <code>SCOPE-CUT.md</code>.</p>`)}`;
}

// ------------------------------------------------------------------ morning
function morning(state) {
  const today = R.todayISO();
  const d = R.dashboard(state, today);
  const openList = `<ul class="list">${d.openOrders.rows.map((o) => `<li><a href="#/orders/${o.id}"><b>${esc(o.ref)}</b> ${esc(o.poNumber)}</a> ${chip(R.deliveryRisk(o) ? 'at risk' : 'on track', R.deliveryRisk(o) ? 'danger' : 'ok')}<span class="muted">${esc(o.supplierPo)}</span></li>`).join('') || ''}</ul>`;
  const risk = `<ul class="list">${d.atRisk.rows.map((o) => `<li><a href="#/orders/${o.id}"><b>${esc(o.ref)}</b></a> ${esc(o.poNumber)}<span class="muted">expected ${esc(R.formatDate(o.expectedDelivery))} vs due ${esc(R.formatDate(o.deliveryDeadline))}</span></li>`).join('') || ''}</ul>`;
  const quotes = `<ul class="list">${d.quotesAwaiting.rows.map((q) => `<li><a href="#/quotes/${q.id}"><b>${esc(q.ref)}</b></a> ${chip('awaiting response', 'warn')}</li>`).join('') || ''}</ul>`;
  const payments = `<ul class="list">${d.paymentsPending.rows.map((i) => { const b = R.invoiceBalance(i, state.payments); return `<li><a href="#/payments"><b>${esc(i.invoiceNo)}</b></a> ${chip(R.money(b.outstanding) + ' open', 'warn')}</li>`; }).join('') || ''}</ul>`;
  const oems = `<ul class="list">${d.oemPending.rows.map((sr) => { const o = state.oems.find((x) => x.id === sr.oemId); const r = state.requirements.find((x) => x.id === sr.requirementId); return `<li><a href="#/requirements/${r.id}"><b>${esc(o.name)}</b></a> ${esc(r.ref)} ${chip('no response', 'warn')}</li>`; }).join('') || ''}</ul>`;
  const docs = `<ul class="list">${d.docsAttention.rows.map((doc) => { const st = R.docStatus(doc, today); return `<li><a href="#/documents"><b>${esc(doc.title)}</b></a> ${chip(st.label, st.key === 'expired' ? 'danger' : 'warn')}</li>`; }).join('') || ''}</ul>`;
  const tasks = state.follow_ups.filter((f) => f.status === 'open');
  const taskList = `<ul class="list">${tasks.map((f) => `<li>${chip(f.type === 'no_response_7d' ? '7-day rule' : f.type, 'warn')} ${esc(f.note)} <button class="btn btn--tiny" data-action="resolveFollowUp" data-id="${f.id}">Done</button></li>`).join('') || ''}</ul>`;

  const as = ui.ask;
  const askBox = `<form class="ask" data-form="ask">
      <input name="q" placeholder="Ask: how many orders are there? what did we lose?" aria-label="Ask a question" autocomplete="off">
      <button class="btn btn--primary" type="submit">Ask</button>
    </form>
    <div class="ask__chips">${['How many orders are there?', 'How many contracts did we win this month?', 'What did we lose?', 'Why did we lose?', 'What is at delivery risk?'].map((q) => `<button class="chip chip--tap" data-action="askSuggest" data-q="${esc(q)}">${esc(q)}</button>`).join('')}</div>
    ${as ? `<div class="answer answer--${as.kind === 'unsupported' ? 'warn' : 'ok'}">
        <div class="answer__mode">${as.kind === 'unsupported' ? 'Answered from a list of supported questions' : 'Answered from your records'} · never invented</div>
        <p class="answer__text">${esc(as.text)}</p>
        ${as.capability ? `<ul class="answer__caps">${as.capability.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>` : ''}
        ${as.rows && as.rows.length ? `<ul class="answer__rows">${as.rows.map((r) => `<li><a href="${r.href}">${esc(r.label)}</a></li>`).join('')}</ul>` : ''}
      </div>` : ''}`;

  return `
  <div class="pagehead"><div><p class="eyebrow">${esc(R.formatDate(today))} · morning view</p><h1>Good morning, ${esc(S.getUser().name.split(' ')[0])}</h1><p class="lede">The six questions the brief asks, answered from the records.</p></div></div>
  <div class="metrics">
    ${metric('Open orders', String(d.openOrders.count), 'each with its state')}
    ${metric('At delivery risk', String(d.atRisk.count), 'expected past the deadline', d.atRisk.count ? 'danger' : 'ok')}
    ${metric('Quotes awaiting', String(d.quotesAwaiting.count), 'no government response')}
    ${metric('Payments pending', R.money(d.paymentsPending.total), `${d.paymentsPending.count} invoice(s) open`, d.paymentsPending.count ? 'warn' : 'ok')}
    ${metric('OEM responses pending', String(d.oemPending.count), 'sourcing requests open')}
    ${metric('Documents expiring', String(d.docsAttention.count), 'expired or within 30 days', d.docsAttention.count ? 'warn' : 'ok')}
  </div>
  ${panel('Ask a question', askBox)}
  <div class="grid grid--2">
    ${panel('Orders open and their state', openList || empty('No open orders.'))}
    ${panel('Orders at delivery risk', risk || empty('Nothing at risk today.'))}
    ${panel('Quotes awaiting a response', quotes || empty('All quotes answered.'))}
    ${panel('Payments pending', payments || empty('Nothing outstanding.'))}
    ${panel('OEM responses pending', oems || empty('Every request answered.'))}
    ${panel('Documents expiring', docs || empty('Nothing expiring in 30 days.'))}
  </div>
  ${panel('Follow-up tasks', taskList || empty('No open tasks.'))}
  ${panel('Commission', `${metric('Deferred', 'Pending', 'Commission attaches to the OEM-payment milestone, but the amount is not computed until one real transaction is confirmed (PRD [O2]).')}`)}`;
}

// ------------------------------------------------------------------ requirements
function requirementsList(state) {
  const today = R.todayISO();
  const rows = state.requirements.map((r) => {
    const cov = R.requirementCoverage(r, state.sourcing_requests);
    return `<tr>
      <td><a href="#/requirements/${r.id}"><b>${esc(r.ref)}</b></a></td>
      <td>${esc(state.customers.find((c) => c.id === r.customerId)?.name)}</td>
      <td>${esc(r.product)}<div class="muted small">${esc(r.tenderRef)}</div></td>
      <td class="num">${r.qty} <span class="muted">${esc(r.uom)}</span></td>
      <td>${chip(r.status, REQ_TONE[r.status])}</td>
      <td class="num">${cov.firmTotal}/${cov.requiredTotal}${cov.uncoveredTotal ? ' ' + chip(cov.uncoveredTotal + ' uncovered', 'warn') : ' ' + chip('covered', 'ok')}</td>
      <td>${esc(R.formatDate(r.requiredDelivery))}</td>
    </tr>`;
  }).join('');

  const form = `<form class="form" data-form="createRequirement">
    <div class="form__row">
      <label>Customer / agency<select name="customerId" required><option value="">Choose…</option>${state.customers.map((c) => `<option value="${c.id}">${esc(c.name)} — ${esc(c.location)}</option>`).join('')}</select></label>
      <label>Product / title<input name="product" required placeholder="e.g. Actuator Control Unit"></label>
    </div>
    <div class="form__row">
      <label>Quantity<input name="qty" type="number" min="1" required placeholder="1000"></label>
      <label>Unit<input name="uom" placeholder="nos" value="nos"></label>
      <label>Tender / enquiry ref<input name="tenderRef" placeholder="H-01"></label>
    </div>
    <div class="form__row">
      <label>Submission deadline<input name="submissionDeadline" type="date" required></label>
      <label>Required delivery<input name="requiredDelivery" type="date" required></label>
      <label>Source<input name="source" placeholder="SRM / E-mail / Client portal"></label>
    </div>
    <label>Technical specifications<textarea name="specs" rows="2" placeholder="CEMILAC approved source only…"></textarea></label>
    <button class="btn btn--primary" type="submit">Capture requirement</button>
  </form>`;

  return `
  <div class="pagehead"><div><p class="eyebrow">Feature 1</p><h1>Requirements &amp; RFIs</h1><p class="lede">The central record. Everything else hangs off it.</p></div><a class="btn btn--ghost" href="#/coverage">Coverage view →</a></div>
  ${panel('All requirements', rows ? `<div class="tablewrap"><table class="table"><thead><tr><th>Ref</th><th>Customer</th><th>Product</th><th>Qty</th><th>Status</th><th>Coverage (firm/req)</th><th>Delivery due</th></tr></thead><tbody>${rows}</tbody></table></div>` : empty('No requirements yet.'))}
  ${panel('Capture a new requirement', form)}`;
}

function requirementDetail(state, id) {
  const r = state.requirements.find((x) => x.id === id);
  if (!r) return empty('Requirement not found.');
  const cov = R.requirementCoverage(r, state.sourcing_requests);
  const liRows = r.lineItems.map((li) => {
    const lc = R.lineCoverage(li, state.sourcing_requests);
    return `<tr><td><b>${esc(li.partNo)}</b><div class="muted small">${esc(li.description)}</div></td><td class="num">${lc.required}</td><td class="num">${lc.firm}</td><td class="num">${lc.indicated ? `<span class="muted">${lc.indicated}</span>` : '—'}</td><td class="num">${lc.uncovered ? chip(String(lc.uncovered), 'warn') : chip('0', 'ok')}</td><td>${bar(lc.coveragePct)}</td></tr>`;
  }).join('') || `<tr><td colspan="6" class="muted">No line items yet.</td></tr>`;

  const srRows = state.sourcing_requests.filter((sr) => sr.requirementId === r.id).map((sr) => {
    const o = state.oems.find((x) => x.id === sr.oemId); const li = r.lineItems.find((l) => l.id === sr.lineItemId);
    return `<tr><td>${esc(o?.name)}</td><td>${esc(li?.partNo)}</td><td>${chip(sr.commitmentType, sr.commitmentType === 'firm' ? 'navy' : 'muted')}</td><td class="num">${sr.committedQty}</td><td class="num">${sr.unitPrice ? R.money(sr.unitPrice) : '—'}</td><td>${chip(sr.responseStatus, sr.responseStatus === 'pending' ? 'warn' : 'ok')}</td></tr>`;
  }).join('') || `<tr><td colspan="6" class="muted">No sourcing requests yet.</td></tr>`;

  const quotes = state.quotes.filter((q) => q.requirementId === r.id);
  const quoteList = quotes.map((q) => { const lv = R.latestVersion(q); return `<li><a href="#/quotes/${q.id}"><b>${esc(q.ref)}</b></a> ${chip(`v${lv.v} ${lv.status}`, lv.status === 'approved' ? 'ok' : lv.status === 'submitted' ? 'info' : 'warn')} <span class="muted">${R.money(R.recommendedPrice(lv.lines, lv.targetMarginPct))} advisory</span></li>`; }).join('') || '';

  const canQuote = cov.firmTotal > 0;
  const quoteForm = canQuote ? `<form class="form" data-form="createQuote" data-req="${r.id}">
    <input type="hidden" name="reqId" value="${r.id}">
    ${r.lineItems.map((li) => { const lc = R.lineCoverage(li, state.sourcing_requests); const best = state.sourcing_requests.filter((s) => s.lineItemId === li.id && s.commitmentType === 'firm' && s.unitPrice).sort((a, b) => a.unitPrice - b.unitPrice)[0]; return `<fieldset class="line"><legend>${esc(li.partNo)} — firm ${lc.firm} of ${lc.required}</legend>
      <input type="hidden" name="lineId_${li.id}" value="${li.id}">
      <div class="form__row"><label>Qty<input type="number" name="qty_${li.id}" value="${lc.firm}" min="0" max="${lc.firm}"></label>
      <label>Unit price (₹)<input type="number" name="price_${li.id}" value="${best ? R.paiseToRupees(best.unitPrice) : 0}" min="0" step="0.01"></label></div></fieldset>`; }).join('')}
    <label>Target margin %<input type="number" name="margin" value="18" min="0" max="60"></label>
    <button class="btn btn--primary" type="submit">Build quote version</button>
    <p class="hint">The recommended price is advisory only — it is never submitted without human approval (PRD C9).</p>
  </form>` : `<p class="hint">Capture firm OEM coverage below before you can build a quote.</p>`;

  const statusForm = `<form class="form form--inline" data-form="setStatus" data-req="${r.id}">
    <input type="hidden" name="reqId" value="${r.id}">
    <label>Status<select name="status">${R.REQUIREMENT_STATUSES.map((s) => `<option ${s === r.status ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
    <label>Loss reason<select name="lossReason"><option value="">—</option>${state.lossReasons.map((x) => `<option value="${x.id}" ${r.lossReason === x.id ? 'selected' : ''}>${esc(x.label)}</option>`).join('')}</select></label>
    <label>Note<input name="lossNote" value="${esc(r.lossNote)}"></label>
    <button class="btn" type="submit">Update status</button>
  </form>
  <p class="hint">Marking a requirement <b>lost</b> without a reason is refused (PRD rule 7).</p>`;

  const audit = state.audit.filter((a) => a.entityRef && (a.entityRef.includes(r.ref) || a.entityRef === r.ref)).slice(-8).reverse();

  return `
  <div class="pagehead">
    <div><p class="eyebrow">${esc(r.ref)} · ${esc(r.source)}</p><h1>${esc(r.product)}</h1>
      <p class="lede">${esc(state.customers.find((c) => c.id === r.customerId)?.name)} · tender ${esc(r.tenderRef)} · submit by ${esc(R.formatDate(r.submissionDeadline))} · deliver by ${esc(R.formatDate(r.requiredDelivery))}</p></div>
    <div class="pagehead__chips">${chip(r.status, REQ_TONE[r.status])}</div>
  </div>
  <div class="metrics">
    ${metric('Required', String(cov.requiredTotal), esc(r.uom))}
    ${metric('Firm covered', String(cov.firmTotal), R.pct(cov.coveragePct) + ' of required', cov.uncoveredTotal ? 'warn' : 'ok')}
    ${metric('Indicated (not counted)', String(cov.indicatedTotal), 'availability only')}
    ${metric('Uncovered', String(cov.uncoveredTotal), cov.uncoveredTotal ? 'cannot be committed' : 'fully covered', cov.uncoveredTotal ? 'danger' : 'ok')}
  </div>
  ${panel('Quantity coverage — the hard part', `<div class="tablewrap"><table class="table"><thead><tr><th>Part</th><th>Required</th><th>Firm</th><th>Indicated</th><th>Uncovered</th><th>Coverage</th></tr></thead><tbody>${liRows}</tbody></table></div>
    <form class="form form--inline" data-form="addLineItem" data-req="${r.id}">
      <input type="hidden" name="reqId" value="${r.id}">
      <label>Part number<input name="partNo" required></label>
      <label>Description<input name="description"></label>
      <label>Qty<input type="number" name="qty" min="1" required></label>
      <button class="btn" type="submit">Add line item</button>
    </form>`)}
  ${panel('Sourcing requests (firm vs indication)', `<div class="tablewrap"><table class="table"><thead><tr><th>OEM</th><th>Part</th><th>Type</th><th>Qty</th><th>Unit price</th><th>Status</th></tr></thead><tbody>${srRows}</tbody></table></div>
    <form class="form form--inline" data-form="addSourcing" data-req="${r.id}">
      <input type="hidden" name="reqId" value="${r.id}">
      <label>Line item<select name="lineItemId">${r.lineItems.map((li) => `<option value="${li.id}">${esc(li.partNo)}</option>`).join('')}</select></label>
      <label>OEM<select name="oemId"><option value="">Choose…</option>${state.oems.map((o) => `<option value="${o.id}">${esc(o.name)}</option>`).join('')}</select></label>
      <label>Type<select name="commitmentType"><option value="firm">Firm commitment</option><option value="indication">Availability indication</option></select></label>
      <label>Qty<input type="number" name="committedQty" min="0" value="0"></label>
      <label>Unit price (₹)<input type="number" name="unitPrice" min="0" step="0.01" value="0"></label>
      <button class="btn" type="submit">Record request</button>
    </form>
    <p class="hint">A firm commitment counts toward coverage; an indication is recorded and shown but never satisfies the requirement.</p>`)}
  ${panel('Quotations', (quoteList ? `<ul class="list">${quoteList}</ul>` : empty('No quote yet.')) + quoteForm)}
  ${panel('Lifecycle status', statusForm)}
  ${panel('Change history (audit)', audit.length ? `<ul class="audit">${audit.map((a) => `<li><b>${esc(a.action)}</b> · ${esc(a.actor)} (${esc(a.role)}) · ${esc(a.at.slice(0, 16).replace('T', ' '))}</li>`).join('')}</ul>` : empty('No changes recorded yet.'))}`;
}

// ------------------------------------------------------------------ coverage overview
function coverage(state) {
  const blocks = state.requirements.map((r) => {
    const cov = R.requirementCoverage(r, state.sourcing_requests);
    const lines = cov.lines.map((l) => `<div class="covline"><span class="covline__lab">${esc(l.lineItem.partNo)}</span>${bar(l.coveragePct)}<span class="covline__val">${l.firm}/${l.required}${l.uncovered ? ' · ' + l.uncovered + ' open' : ''}</span></div>`).join('');
    return `<div class="covblock"><div class="covblock__head"><a href="#/requirements/${r.id}"><b>${esc(r.ref)}</b></a> ${esc(r.product)} ${cov.uncoveredTotal ? chip(cov.uncoveredTotal + ' uncovered', 'danger') : chip('fully covered', 'ok')}</div>${lines}</div>`;
  }).join('') || empty('No requirements.');
  return `
  <div class="pagehead"><div><p class="eyebrow">Feature 3</p><h1>Quantity coverage</h1><p class="lede">Firm commitment against required quantity, with the uncovered balance in the open. Indications are excluded by rule.</p></div></div>
  ${panel('Coverage by requirement', blocks)}
  ${panel('The rule', `<p class="muted">Coverage counts only rows marked <b>firm</b>. A quote line above firm coverage is refused with a reason. Capacity is treated as <b>global</b> across live orders (PRD assumption A2, pending [O1]).</p>`)}`;
}

// ------------------------------------------------------------------ oems
function oems(state) {
  const today = R.todayISO();
  const rows = state.oems.map((o) => {
    const st = R.oemApprovalStatus(o.id, state.oem_approvals, today);
    const certs = state.oem_approvals.filter((a) => a.oemId === o.id).map((a) => `${esc(a.authority)} ${esc(a.certNo)}`).join(', ');
    return `<tr><td><b>${esc(o.name)}</b><div class="muted small">${esc(o.location)} · vendor ${esc(o.vendorCode)}</div></td><td>${o.capabilities.map((c) => chip(c, 'muted')).join(' ')}</td><td class="num">${o.leadTimeDays}d</td><td>${st.approved ? chip('approved', 'ok') : chip('not approved', 'danger')}${st.expiring.length ? ' ' + chip(st.expiring[0].authority + ' expires', 'warn') : ''}</td><td>${esc(certs)}</td></tr>`;
  }).join('');
  const pending = state.sourcing_requests.filter((s) => s.responseStatus === 'pending');
  const plist = pending.map((s) => { const r = state.requirements.find((x) => x.id === s.requirementId); const o = state.oems.find((x) => x.id === s.oemId); return `<li><a href="#/requirements/${r.id}"><b>${esc(o.name)}</b></a> ← ${esc(r.ref)} ${chip('requested ' + esc(R.formatDate(s.requestedAt)), 'warn')}</li>`; }).join('') || '';
  return `
  <div class="pagehead"><div><p class="eyebrow">Feature 2</p><h1>OEM master &amp; sourcing</h1><p class="lede">Who can make it, whether their approval is live, and every request on record.</p></div></div>
  ${panel('OEM master', `<div class="tablewrap"><table class="table"><thead><tr><th>OEM</th><th>Capabilities</th><th>Lead time</th><th>Approval</th><th>Certificates</th></tr></thead><tbody>${rows}</tbody></table></div>`)}
  ${panel('Sourcing responses pending', plist ? `<ul class="list">${plist}</ul>` : empty('Every request has a response.'))}
  ${panel('Shortlist rule', `<p class="muted">The shortlist is a query: capability plus a live approval certificate. A human still chooses the OEM — the system never selects one (PRD section 5).</p>`)}`;
}

// ------------------------------------------------------------------ quotes
function quotesList(state) {
  const rows = state.quotes.map((q) => {
    const lv = R.latestVersion(q); const r = state.requirements.find((x) => x.id === q.requirementId);
    const value = R.versionValue(lv);
    return `<tr><td><a href="#/quotes/${q.id}"><b>${esc(q.ref)}</b></a></td><td>${esc(state.customers.find((c) => c.id === r.customerId)?.name)}</td><td>${esc(r.product)}</td><td>${chip('v' + lv.v + ' · ' + lv.status, lv.status === 'approved' ? 'ok' : lv.status === 'submitted' ? 'info' : 'warn')}</td><td class="num">${R.money(value)}</td><td class="num">${R.money(lv.recommended)}</td></tr>`;
  }).join('');
  return `
  <div class="pagehead"><div><p class="eyebrow">Feature 4</p><h1>Quotations</h1><p class="lede">Built from a requirement, priced against comparable history, versioned, and approved.</p></div></div>
  ${panel('All quotations', rows ? `<div class="tablewrap"><table class="table"><thead><tr><th>Ref</th><th>Customer</th><th>Product</th><th>Version</th><th>Cost</th><th>Recommended (advisory)</th></tr></thead><tbody>${rows}</tbody></table></div>` : empty('No quotations yet.'))}`;
}

function quoteDetail(state, id) {
  const q = state.quotes.find((x) => x.id === id);
  if (!q) return empty('Quote not found.');
  const r = state.requirements.find((x) => x.id === q.requirementId);
  const lv = R.latestVersion(q);
  const versions = q.versions.slice().sort((a, b) => b.v - a.v).map((v) => {
    const lines = v.lines.map((l) => { const li = r.lineItems.find((x) => x.id === l.lineItemId); return `<tr><td>${esc(li?.partNo)}</td><td class="num">${l.qty}</td><td class="num">${R.money(l.unitPrice)}</td><td class="num">${R.money(l.qty * l.unitPrice)}</td></tr>`; }).join('');
    const canApprove = v.status === 'draft';
    return `<div class="version"><div class="version__head"><b>v${v.v}</b> ${chip(v.status, v.status === 'approved' ? 'ok' : v.status === 'submitted' ? 'info' : v.status === 'superseded' ? 'muted' : 'warn')}<span class="muted">${esc(R.formatDate(v.createdAt))} · margin ${v.targetMarginPct}%</span>
      ${canApprove ? `<button class="btn btn--tiny" data-action="approveQuote" data-id="${q.id}" data-v="${v.v}">Approve</button>` : ''}
      ${v.status === 'approved' ? `<button class="btn btn--tiny" data-action="submitQuote" data-id="${q.id}">Mark submitted</button>` : ''}</div>
      <div class="tablewrap"><table class="table table--sm"><thead><tr><th>Part</th><th>Qty</th><th>Unit price</th><th>Value</th></tr></thead><tbody>${lines}</tbody></table></div>
      <div class="version__foot"><span>Cost ${R.money(R.versionValue(v))}</span><span><b>Recommended ${R.money(R.recommendedPrice(v.lines, v.targetMarginPct))}</b> <span class="muted">advisory</span></span></div></div>`;
  }).join('');

  const comps = R.comparablesFor(r.id, state.comparables);
  const compRows = comps.map((c) => `<tr><td>${esc(c.ref)}</td><td>${esc(state.customers.find((x) => x.id === c.customerId)?.name)}</td><td class="num">${R.money(c.quoted)}</td><td>${chip(c.outcome, c.outcome === 'won' ? 'ok' : 'danger')}</td><td class="num">${c.winningPrice ? R.money(c.winningPrice) : '—'}</td><td>${chip(c.source, 'muted')} ${chip(c.confidence + ' confidence', c.confidence === 'low' ? 'warn' : 'muted')}</td></tr>`).join('') || `<tr><td colspan="6" class="muted">No comparable history for this requirement.</td></tr>`;

  const gov = state.government_responses.filter((g) => g.quoteId === q.id).slice().reverse();
  const govList = gov.map((g) => `<li>${chip(g.state, GOV_TONE[g.state])} <span class="muted">${esc(R.formatDate(g.at))}</span> ${esc(g.note)}</li>`).join('') || '';

  return `
  <div class="pagehead"><div><p class="eyebrow">${esc(q.ref)} · from ${esc(r.ref)}</p><h1>${esc(r.product)}</h1><p class="lede">${esc(state.customers.find((c) => c.id === r.customerId)?.name)} · latest v${lv.v} ${esc(lv.status)}</p></div></div>
  ${panel('Comparable past bids — before you price', comps.length ? `<div class="tablewrap"><table class="table"><thead><tr><th>Ref</th><th>Customer</th><th>Quoted</th><th>Outcome</th><th>Winning price</th><th>Source</th></tr></thead><tbody>${compRows}</tbody></table></div>` : `<p class="muted">Sample data carries these rows with a source and confidence badge; untrusted rows are shown but excluded from any price hint (PRD C8).</p>`)}
  ${panel('Versions & approval', versions)}
  ${panel('Government response', `<div class="form form--inline"><label>New state<select data-action="govStateSelect" data-id="${q.id}">${R.GOVERNMENT_STATES.map((s) => `<option>${s}</option>`).join('')}</select></label><button class="btn" data-action="govState" data-id="${q.id}">Record state</button></div>${govList ? `<ul class="list">${govList}</ul>` : empty('Not yet submitted.')}`)}
  ${panel('Order', orderFromQuote(state, q, lv))}`;
}

function orderFromQuote(state, q, lv) {
  const existing = state.orders.find((o) => o.quoteId === q.id);
  if (existing) return `<p class="muted">Order <a href="#/orders/${existing.id}"><b>${esc(existing.ref)}</b></a> already exists from this quote.</p>`;
  if (lv.status !== 'approved') return `<p class="hint">An order cannot be created until a version is <b>approved</b> — this is the no-orphan-PO rule in action.</p>`;
  const r = state.requirements.find((x) => x.id === q.requirementId);
  return `<form class="form" data-form="createOrder" data-quote="${q.id}" data-v="${lv.v}">
    <input type="hidden" name="quoteId" value="${q.id}"><input type="hidden" name="quoteVersion" value="${lv.v}">
    <div class="form__row"><label>PO number<input name="poNumber" required placeholder="HAL/PO/1187"></label><label>PO date<input type="date" name="poDate"></label></div>
    <div class="form__row"><label>Delivery deadline<input type="date" name="deliveryDeadline" value="${esc(r.requiredDelivery)}" required></label><label>Expected delivery<input type="date" name="expectedDelivery"></label></div>
    <div class="form__row"><label>OEM<select name="oemId">${state.oems.map((o) => `<option value="${o.id}">${esc(o.name)}</option>`).join('')}</select></label><label>Supplier PO<input name="supplierPo" placeholder="ABC/SPO/442"></label></div>
    <div class="form__row"><label>Compliance<input name="compliance" placeholder="CEMILAC + LCSO"></label><label>Inspection<input name="inspection"></label><label>PDI requirements<input name="pdiRequirements"></label></div>
    <button class="btn btn--primary" type="submit">Create order from approved quote</button>
  </form>`;
}

// ------------------------------------------------------------------ orders
function ordersList(state) {
  const rows = state.orders.map((o) => {
    const lin = R.orderLineage(state, o);
    const pdi = R.pdiTotals(o, state.pdi_records);
    return `<tr><td><a href="#/orders/${o.id}"><b>${esc(o.ref)}</b></a><div class="muted small">${esc(o.poNumber)}</div></td><td>${esc(lin.customer)}</td><td>${esc(lin.requirement)} → ${esc(lin.quote)}</td><td class="num">${esc(R.formatDate(o.deliveryDeadline))}</td><td>${R.deliveryRisk(o) ? chip('at risk', 'danger') : chip('on track', 'ok')}</td><td class="num">${pdi.offered} offered · ${pdi.cleared} cleared${pdi.rejected ? ' · ' + pdi.rejected + ' rejected' : ''}</td></tr>`;
  }).join('');
  return `
  <div class="pagehead"><div><p class="eyebrow">Features 6 &amp; 7</p><h1>Orders &amp; fulfilment</h1><p class="lede">Every order keeps its lineage; every delivery, PDI and risk is visible.</p></div></div>
  ${panel('All orders', rows ? `<div class="tablewrap"><table class="table"><thead><tr><th>Order</th><th>Customer</th><th>Lineage</th><th>Delivery due</th><th>Risk</th><th>PDI</th></tr></thead><tbody>${rows}</tbody></table></div>` : empty('No orders yet.'))}`;
}

function orderDetail(state, id) {
  const o = state.orders.find((x) => x.id === id);
  if (!o) return empty('Order not found.');
  const lin = R.orderLineage(state, o);
  const stages = R.deliveryStagesFor(o, state.deliveries);
  const timeline = stages.map((s, i) => {
    const isNext = !s.done && stages.slice(0, i).every((x) => x.done);
    return `<div class="stage ${s.done ? 'is-done' : isNext ? 'is-next' : ''}"><span class="stage__dot">${s.done ? '✓' : i + 1}</span><span class="stage__lab">${esc(s.label)}</span>${s.record ? `<span class="muted small">${esc(R.formatDate(s.record.at))}</span>` : ''}${isNext ? `<button class="btn btn--tiny" data-action="advance" data-order="${o.id}" data-stage="${s.id}">Mark done</button>` : ''}</div>`;
  }).join('');
  const blocked = R.dispatchBlocked(o, state.pdi_records, state.settings);

  const pdi = state.pdi_records.filter((p) => p.orderId === o.id).map((p) => `<tr><td class="num">${p.offeredQty}</td><td class="num">${p.clearedQty}</td><td class="num">${p.rejectedQty}</td><td>${chip(p.status, PDI_TONE[p.status])}</td><td>${esc(p.inspector)} · ${esc(p.mode)}</td><td>${esc(R.formatDate(p.date))}</td></tr>`).join('') || `<tr><td colspan="6" class="muted">No PDI recorded.</td></tr>`;

  const invoices = state.invoices.filter((i) => i.orderId === o.id);
  const invBlocks = invoices.map((inv) => {
    const b = R.invoiceBalance(inv, state.payments);
    const pays = state.payments.filter((p) => p.invoiceId === inv.id).map((p) => `<tr><td>${esc(p.direction === 'oem_payment' ? 'OEM payment' : 'Customer receipt')}</td><td class="num">${R.money(p.amount)}</td><td class="num">${p.tds ? R.money(p.tds) : '—'}</td><td class="num">${p.ld ? R.money(p.ld) : '—'}</td><td>${esc(R.formatDate(p.date))}</td><td>${esc(p.reference)}</td></tr>`).join('');
    return `<div class="inv"><div class="inv__head"><b>${esc(inv.invoiceNo)}</b> <span class="muted">${esc(R.formatDate(inv.invoiceDate))}</span> ${b.outstanding > 0 ? chip(R.money(b.outstanding) + ' open', 'warn') : chip('settled', 'ok')}</div>
      <div class="inv__nums"><span>Net ${R.money(inv.net)}</span><span>IGST ${R.money(inv.igst)}</span><span>Gross ${R.money(inv.gross)}</span><span>Received ${R.money(b.received)}</span><span>OEM paid ${R.money(b.oemPaid)}</span></div>
      ${pays ? `<div class="tablewrap"><table class="table table--sm"><thead><tr><th>Direction</th><th>Amount</th><th>TDS</th><th>LD</th><th>Date</th><th>Reference</th></tr></thead><tbody>${pays}</tbody></table></div>` : ''}
      <form class="form form--inline" data-form="addPayment" data-invoice="${inv.id}">
        <label>Direction<select name="direction"><option value="customer_receipt">Customer receipt</option><option value="oem_payment">OEM payment</option></select></label>
        <label>Amount (₹)<input type="number" name="amount" min="1" step="0.01" required></label>
        <label>TDS (₹)<input type="number" name="tds" min="0" step="0.01" value="0"></label>
        <label>Reference<input name="reference"></label>
        <button class="btn btn--tiny" type="submit">Record payment</button>
      </form></div>`;
  }).join('') || empty('No invoices yet.');

  const commission = R.commissionDue(state, o);

  return `
  <div class="pagehead"><div><p class="eyebrow">${esc(o.ref)} · from ${esc(lin.quote)} · ${esc(lin.requirement)}</p><h1>${esc(o.poNumber)} — ${esc(lin.customer)}</h1>
    <p class="lede">OEM ${esc(lin.oem)} · supplier PO ${esc(o.supplierPo)} · ${R.deliveryRisk(o) ? 'expected ' + esc(R.formatDate(o.expectedDelivery)) + ' is past the ' + esc(R.formatDate(o.deliveryDeadline)) + ' deadline' : 'expected ' + esc(R.formatDate(o.expectedDelivery)) + ' within the ' + esc(R.formatDate(o.deliveryDeadline)) + ' deadline'}</p></div>
    <div class="pagehead__chips">${R.deliveryRisk(o) ? chip('at delivery risk', 'danger') : chip('on track', 'ok')}</div></div>
  ${blocked ? `<div class="flash flash--warn">Dispatch is blocked: a PDI on this order is held or failed. Clear or pass it before dispatching.</div>` : ''}
  ${panel('Fulfilment timeline', `<div class="timeline">${timeline}</div>`)}
  ${panel('PDI — offered, cleared, rejected', `<div class="tablewrap"><table class="table"><thead><tr><th>Offered</th><th>Cleared</th><th>Rejected</th><th>Status</th><th>Inspector</th><th>Date</th></tr></thead><tbody>${pdi}</tbody></table></div>
    <form class="form form--inline" data-form="addPdi" data-order="${o.id}">
      <label>Offered<input type="number" name="offeredQty" min="1" required></label>
      <label>Cleared<input type="number" name="clearedQty" min="0" value="0"></label>
      <label>Rejected<input type="number" name="rejectedQty" min="0" value="0"></label>
      <label>Status<select name="status"><option value="passed">Passed</option><option value="held">Held</option><option value="failed">Failed</option></select></label>
      <label>Inspector<input name="inspector"></label>
      <button class="btn btn--tiny" type="submit">Record PDI</button>
    </form>`)}
  ${panel('Invoices & payments', invBlocks + `<form class="form form--inline" data-form="addInvoice" data-order="${o.id}"><label>Invoice no<input name="invoiceNo" required placeholder="INV/26/042"></label><label>Net value (₹)<input type="number" name="net" min="1" step="0.01" required></label><button class="btn btn--tiny" type="submit">Raise invoice</button></form>`)}
  ${panel('Commission', metric(commission.deferred ? 'Deferred' : 'Available', commission.milestoneReached ? 'Milestone reached' : 'Milestone not yet reached', esc(commission.note)))}
  ${panel('Lineage', `<ul class="lineage"><li>Requirement <a href="#/requirements/${o.requirementId}">${esc(lin.requirement)}</a></li><li>Approved quote ${esc(lin.quote)}</li><li>Customer ${esc(lin.customer)}</li><li>OEM ${esc(lin.oem)}</li><li>Supplier PO ${esc(o.supplierPo)}</li></ul>`)}`;
}

// ------------------------------------------------------------------ payments
function payments(state) {
  const today = R.todayISO();
  const rows = state.invoices.map((inv) => {
    const o = state.orders.find((x) => x.id === inv.orderId); const b = R.invoiceBalance(inv, state.payments);
    const overdue = b.outstanding > 0;
    return `<tr><td><b>${esc(inv.invoiceNo)}</b><div class="muted small">${esc(R.formatDate(inv.invoiceDate))}</div></td><td>${esc(o?.ref)}</td><td class="num">${R.money(inv.gross)}</td><td class="num">${R.money(b.received)}</td><td class="num">${b.deductions ? R.money(b.deductions) : '—'}</td><td class="num">${b.outstanding ? chip(R.money(b.outstanding), 'warn') : chip('settled', 'ok')}</td></tr>`;
  }).join('');
  const totalOut = state.invoices.reduce((t, i) => t + R.invoiceBalance(i, state.payments).outstanding, 0);
  return `
  <div class="pagehead"><div><p class="eyebrow">Feature 8</p><h1>Payments &amp; balances</h1><p class="lede">Partial payments, TDS and LD deductions, and an explainable balance per invoice.</p></div></div>
  <div class="metrics">${metric('Outstanding across invoices', R.money(totalOut), 'customer receipts still due', totalOut ? 'warn' : 'ok')}${metric('Invoices', String(state.invoices.length), 'each tied to an order')}${metric('Commission', 'Deferred', 'pending one real transaction')}</div>
  ${panel('Invoice balances', rows ? `<div class="tablewrap"><table class="table"><thead><tr><th>Invoice</th><th>Order</th><th>Gross</th><th>Received</th><th>Deductions</th><th>Outstanding</th></tr></thead><tbody>${rows}</tbody></table></div>` : empty('No invoices.'))}
  ${panel('How commission will work', `<p class="muted">Commission attaches to the <b>OEM-payment milestone</b>. The system shows that the milestone was reached, but refuses to compute a number until one real transaction is walked through (PRD rule 9, open question [O2]).</p>`)}`;
}

// ------------------------------------------------------------------ documents
function documents(state) {
  const today = R.todayISO();
  const rows = state.documents.map((d) => { const st = R.docStatus(d, today); const o = state.oems.find((x) => x.id === d.oemId); return `<tr><td><b>${esc(d.title)}</b><div class="muted small">${esc(d.type)}</div></td><td>${esc(o?.name || '—')}</td><td>${esc(d.productCode)}</td><td class="num">${esc(R.formatDate(d.expiryDate))}</td><td>${chip(st.label, st.key === 'expired' ? 'danger' : st.key === 'expiring' ? 'warn' : 'ok')}</td></tr>`; }).join('');
  const attention = state.documents.filter((d) => R.docStatus(d, today).key !== 'valid').length;
  return `
  <div class="pagehead"><div><p class="eyebrow">Feature 8</p><h1>Documents &amp; compliance</h1><p class="lede">Approval certificates and approved item lists, with expiry tracked and surfaced.</p></div></div>
  <div class="metrics">${metric('Documents held', String(state.documents.length), 'certificates and approved lists')}${metric('Need attention', String(attention), 'expired or within 30 days', attention ? 'warn' : 'ok')}</div>
  ${panel('Vault', `<div class="tablewrap"><table class="table"><thead><tr><th>Document</th><th>Supplier</th><th>Product</th><th>Valid till</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div>
    <form class="form form--inline" data-form="addDocument">
      <label>Title<input name="title" required></label>
      <label>Type<select name="type"><option>Approval certificate</option><option>Approved item list</option><option>Compliance document</option></select></label>
      <label>OEM<select name="oemId"><option value="">—</option>${state.oems.map((o) => `<option value="${o.id}">${esc(o.name)}</option>`).join('')}</select></label>
      <label>Expiry<input type="date" name="expiryDate" required></label>
      <button class="btn btn--tiny" type="submit">Add document</button>
    </form>`)}
  ${panel('Reminder rule', `<p class="muted">Expiry drives a reminder and appears on the morning view. Reminders are in-app only — the brief excludes outbound auto-messaging (PRD C6).</p>`)}`;
}

// ------------------------------------------------------------------ search
function search(state) {
  const q = (ui.search || '').trim().toLowerCase();
  let results = [];
  if (q) {
    state.requirements.forEach((r) => { if ((r.ref + r.product + r.tenderRef).toLowerCase().includes(q)) results.push(['Requirement', r.ref + ' · ' + r.product, '#/requirements/' + r.id]); r.lineItems.forEach((li) => { if ((li.partNo + li.description).toLowerCase().includes(q)) results.push(['Line item', li.partNo + ' · ' + li.description + ' (' + r.ref + ')', '#/requirements/' + r.id]); }); });
    state.oems.forEach((o) => { if ((o.name + o.capabilities.join(' ')).toLowerCase().includes(q)) results.push(['OEM', o.name + ' · ' + o.location, '#/oems']); });
    state.quotes.forEach((x) => { if (x.ref.toLowerCase().includes(q)) results.push(['Quote', x.ref, '#/quotes/' + x.id]); });
    state.orders.forEach((o) => { if ((o.ref + o.poNumber).toLowerCase().includes(q)) results.push(['Order', o.ref + ' · ' + o.poNumber, '#/orders/' + o.id]); });
    state.requirements.filter((r) => r.status === 'lost').forEach((r) => { if (R.labelForLoss(r.lossReason).toLowerCase().includes(q) || 'lost'.includes(q)) results.push(['Loss', r.ref + ' · ' + R.labelForLoss(r.lossReason), '#/requirements/' + r.id]); });
  }
  const list = results.map(([type, label, href]) => `<li>${chip(type, 'muted')} <a href="${href}">${esc(label)}</a></li>`).join('');
  const losses = state.requirements.filter((r) => r.status === 'lost');
  const lossSummary = losses.map((r) => `<li><a href="#/requirements/${r.id}"><b>${esc(r.ref)}</b></a> ${esc(r.product)} — ${chip(R.labelForLoss(r.lossReason), 'danger')} <span class="muted">${esc(r.lossNote)}</span></li>`).join('');
  let resultsHtml;
  if (!q) resultsHtml = `<p class="muted">Try a part number like <b>P-123</b>, a ref like <b>RFI-2601</b>, or a reason like <b>price</b>.</p>`;
  else if (!results.length) resultsHtml = empty('Nothing matched.');
  else resultsHtml = `<ul class="list">${list}</ul>`;
  const searchForm = `<form class="ask" data-form="searchPage"><input name="q" value="${esc(ui.search)}" placeholder="Ref, part number, OEM, product, loss reason"><button class="btn btn--primary" type="submit">Search</button></form>`;
  const lossesPanel = `<ul class="list">${lossSummary}</ul>`;
  return `
  <div class="pagehead"><div><p class="eyebrow">Feature 9</p><h1>Search &amp; history</h1><p class="lede">Find the comparable past requirement - the answer to "every new quote starts from scratch".</p></div></div>
  ${panel('Search all history', searchForm + resultsHtml)}
  ${panel('Losses and reasons', lossSummary ? lossesPanel : empty('No losses recorded.'))}`;
}

// ------------------------------------------------------------------ audit
function audit(state) {
  const pending = [];
  state.quotes.forEach((q) => q.versions.forEach((v) => { if (v.status === 'draft') pending.push([`Approve ${q.ref} v${v.v}`, `#/quotes/${q.id}`]); }));
  const rows = state.audit.slice().reverse().map((a) => `<tr><td>${esc(a.at.slice(0, 16).replace('T', ' '))}</td><td>${esc(a.actor)} (${esc(a.role)})</td><td>${esc(a.entity)}</td><td>${esc(a.entityRef)}</td><td>${esc(a.action)}</td></tr>`).join('');
  return `
  <div class="pagehead"><div><p class="eyebrow">Feature 11</p><h1>Audit &amp; approvals</h1><p class="lede">What changed, who changed it, and when — and the queue waiting for the owner.</p></div></div>
  ${panel('Approval queue', pending.length ? `<ul class="list">${pending.map(([label, href]) => `<li><a href="${href}">${esc(label)}</a> ${chip('awaiting owner', 'warn')}</li>`).join('')}</ul>` : empty('Nothing awaiting approval.'))}
  ${panel('Audit trail', rows ? `<div class="tablewrap"><table class="table"><thead><tr><th>When</th><th>Who</th><th>Entity</th><th>Ref</th><th>Action</th></tr></thead><tbody>${rows}</tbody></table></div>` : empty('No changes yet.'))}
  ${panel('Data & restore', `<div class="form form--inline"><button class="btn" data-action="exportData">Export JSON</button><button class="btn btn--danger" data-action="reset" data-confirm="1">Reset to sample data</button></div>
    <form class="form" data-form="importData"><label>Restore from export<textarea name="json" rows="3" placeholder="Paste an exported JSON here…"></textarea></label><button class="btn" type="submit">Import</button></form>`)}`;
}

// ------------------------------------------------------------------ router
export function render(state, route) {
  let active = route.hash, content;
  switch (route.name) {
    case 'landing': content = landing(); active = '#/'; break;
    case 'about': content = about(state); active = '#/about'; break;
    case 'morning': content = morning(state); break;
    case 'requirements': content = requirementsList(state); break;
    case 'requirement': content = requirementDetail(state, route.params[0]); active = '#/requirements'; break;
    case 'coverage': content = coverage(state); active = '#/requirements'; break;
    case 'oems': content = oems(state); break;
    case 'quotes': content = quotesList(state); break;
    case 'quote': content = quoteDetail(state, route.params[0]); active = '#/quotes'; break;
    case 'orders': content = ordersList(state); break;
    case 'order': content = orderDetail(state, route.params[0]); active = '#/orders'; break;
    case 'payments': content = payments(state); break;
    case 'documents': content = documents(state); break;
    case 'search': content = search(state); break;
    case 'audit': content = audit(state); break;
    default: content = landing(); active = '#/';
  }
  if (route.name === 'landing') return content;
  return layout(state, active, content);
}

// ------------------------------------------------------------------ events
function result(res) {
  if (res && res.ok === false) { ui.err = res.errors.join(' '); rerender(); return false; }
  ui.err = null; return true;
}

export const actions = {
  toggleMenu() { document.documentElement.classList.toggle('menu-open'); },
  role(el) { S.setUser(el.value); },
  askSuggest(el) { ui.ask = R.ask(el.dataset.q, S.getState(), R.todayISO()); rerender(); },
  approveQuote(el) { result(S.approveQuote(el.dataset.id, Number(el.dataset.v))); },
  submitQuote(el) { result(S.submitQuote(el.dataset.id)); },
  govState(el) {
    const sel = document.querySelector(`select[data-action="govStateSelect"][data-id="${el.dataset.id}"]`);
    if (sel) result(S.setGovernmentState(el.dataset.id, sel.value));
  },
  advance(el) { result(S.advanceDelivery(el.dataset.order, el.dataset.stage)); },
  resolveFollowUp(el) { S.resolveFollowUp(el.dataset.id); },
  exportData() {
    const blob = new Blob([S.exportJSON()], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'tenderdesk-export.json'; a.click();
  },
  reset(el) { if (!el.dataset.confirm || confirm('Reset all demo data to the sample set?')) S.reset(); },
};

export const forms = {
  ask(form) { const q = new FormData(form).get('q'); ui.ask = R.ask(q, S.getState(), R.todayISO()); rerender(); },
  search(form) { ui.search = new FormData(form).get('q'); location.hash = '#/search'; rerender(); },
  searchPage(form) { ui.search = new FormData(form).get('q'); rerender(); },
  createRequirement(form) { const d = Object.fromEntries(new FormData(form)); result(S.createRequirement(d)); form.reset(); },
  addLineItem(form) { const d = Object.fromEntries(new FormData(form)); result(S.addLineItem(d.reqId, d)); form.reset(); },
  addSourcing(form) { const d = Object.fromEntries(new FormData(form)); result(S.addSourcing(d.reqId, d)); form.reset(); },
  setStatus(form) { const d = Object.fromEntries(new FormData(form)); result(S.setRequirementStatus(d.reqId, d.status, d.lossReason, d.lossNote)); },
  createQuote(form) {
    const fd = new FormData(form); const reqId = fd.get('reqId');
    const state = S.getState(); const r = state.requirements.find((x) => x.id === reqId);
    const lines = r.lineItems.map((li) => ({ lineItemId: li.id, oemId: (state.sourcing_requests.find((s) => s.lineItemId === li.id && s.commitmentType === 'firm') || {}).oemId || state.oems[0].id, qty: Number(fd.get('qty_' + li.id)) || 0, unitPrice: Number(fd.get('price_' + li.id)) || 0 })).filter((l) => l.qty > 0);
    result(S.createQuoteVersion(reqId, lines, Number(fd.get('margin')) || 0));
  },
  createOrder(form) { const d = Object.fromEntries(new FormData(form)); result(S.createOrder(d)); },
  addPdi(form) { const d = Object.fromEntries(new FormData(form)); result(S.addPdi(d.order, d)); form.reset(); },
  addInvoice(form) { const d = Object.fromEntries(new FormData(form)); result(S.addInvoice(d.order, d)); form.reset(); },
  addPayment(form) { const d = Object.fromEntries(new FormData(form)); result(S.addPayment(d.invoice, d)); form.reset(); },
  addDocument(form) { const d = Object.fromEntries(new FormData(form)); result(S.addDocument(d)); form.reset(); },
  importData(form) { const d = Object.fromEntries(new FormData(form)); result(S.importJSON(d.json)); },
};
