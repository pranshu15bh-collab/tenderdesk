// data.js — seed dataset for TenderDesk.
// Shape and column names follow Ram Prasad's nine spreadsheets exactly
// (source/sheets/sheet1-9.csv). All transaction rows are clearly SAMPLE data:
// the sheets supplied are masters and templates with little live data
// (see PRD.md A11). Money is integer paise. Dates are ISO YYYY-MM-DD.

export const DEMO_TODAY = '2026-10-02';

// rupees -> paise
const R = (n) => Math.round(n * 100);

export function seed() {
  return {
    meta: { version: 1, seededAt: DEMO_TODAY, note: 'Sample data traced to sheets 1-9' },

    users: [
      { id: 'u1', name: 'Ram Prasad', role: 'owner' },
      { id: 'u2', name: 'A. Nair', role: 'sales' },
      { id: 'u3', name: 'S. Rao', role: 'operations' },
      { id: 'u4', name: 'M. Iyer', role: 'finance' },
    ],

    // sheet 5 — Master List: Customers
    customers: [
      { id: 'C1', name: 'HAL', location: 'Bengaluru', spoc: '—', gst: 'A' },
      { id: 'C2', name: 'BEL', location: 'Bengaluru', spoc: '—', gst: 'B' },
      { id: 'C3', name: 'BEML', location: 'Delhi', spoc: '—', gst: 'C' },
    ],

    // sheet 7 — Master List: OEM  +  sheet 4 — approvals
    oems: [
      { id: 'O1', name: 'OEM-ABC', location: 'Delhi', vendorCode: 'A', capabilities: ['P1', 'P2', 'P3'], leadTimeDays: 30, approved: true, contact: 'ops@oem-abc.example' },
      { id: 'O2', name: 'OEM A', location: 'Bengaluru', vendorCode: 'B', capabilities: ['P1'], leadTimeDays: 45, approved: true, contact: 'sales@oem-a.example' },
      { id: 'O3', name: 'OEM B', location: 'Hyderabad', vendorCode: 'C', capabilities: ['P2'], leadTimeDays: 60, approved: false, contact: 'pm@oem-b.example' },
    ],
    oem_approvals: [
      { id: 'A1', oemId: 'O1', authority: 'CEMILAC', certNo: 'CER 1', issued: '2025-03-03', validTill: '2028-03-02', productCode: 'H1', renewalDue: '2027-10-01' },
      { id: 'A2', oemId: 'O1', authority: 'LCSO', certNo: 'CER 2', issued: '2025-03-03', validTill: '2026-10-22', productCode: 'H2', renewalDue: '2026-10-01' },
      { id: 'A3', oemId: 'O1', authority: 'RCMA', certNo: 'CER 3', issued: '2025-03-03', validTill: '2026-09-20', productCode: 'H3', renewalDue: '2026-09-01' },
      { id: 'A4', oemId: 'O2', authority: 'LCSO', certNo: 'CER 7', issued: '2025-07-01', validTill: '2027-06-30', productCode: 'H1', renewalDue: '2027-06-01' },
    ],

    // F1 — Requirement & RFI (sheet 6 columns: ENQ No, Source, Project, Qty, Price, Status)
    requirements: [
      {
        id: 'R1', ref: 'RFI-2601', customerId: 'C1', product: 'Actuator Control Unit', qty: 1000, uom: 'nos',
        requiredDelivery: '2026-12-15', tenderRef: 'H-01', submissionDeadline: '2026-10-30',
        specs: 'MIL-spec housing, CEMILAC approved source only.', source: 'SRM',
        status: 'submitted', lossReason: null, lossNote: '', createdAt: '2026-09-05', owner: 'u2',
        lineItems: [
          { id: 'L1', partNo: 'P-123', description: 'Actuator body', qty: 600, uom: 'nos' },
          { id: 'L2', partNo: 'P-124', description: 'Control harness', qty: 400, uom: 'nos' },
        ],
      },
      {
        id: 'R2', ref: 'RFI-2602', customerId: 'C2', product: 'Radar Power Module', qty: 500, uom: 'nos',
        requiredDelivery: '2026-11-20', tenderRef: 'B-01', submissionDeadline: '2026-09-25',
        specs: 'LCSO compliant. Dual source preferred.', source: 'E-mail',
        status: 'submitted', lossReason: null, lossNote: '', createdAt: '2026-09-05', owner: 'u2',
        lineItems: [{ id: 'L3', partNo: 'P-345', description: 'Power module', qty: 500, uom: 'nos' }],
      },
      {
        id: 'R3', ref: 'RFI-2603', customerId: 'C3', product: 'Hydraulic Test Rig', qty: 200, uom: 'nos',
        requiredDelivery: '2027-02-01', tenderRef: 'BM-14', submissionDeadline: '2026-11-15',
        specs: 'RCMA approved source. Site acceptance test required.', source: 'Client portal',
        status: 'received', lossReason: null, lossNote: '', createdAt: '2026-09-28', owner: 'u2',
        lineItems: [{ id: 'L4', partNo: 'P-501', description: 'Test rig assembly', qty: 200, uom: 'nos' }],
      },
      {
        id: 'R4', ref: 'RFI-2512', customerId: 'C1', product: 'Avionics Harness', qty: 300, uom: 'nos',
        requiredDelivery: '2026-08-30', tenderRef: 'H-07', submissionDeadline: '2026-07-10',
        specs: 'CEMILAC approved.', source: 'SRM', status: 'lost', lossReason: 'price',
        lossNote: 'Competitor quoted 12% below our floor.', createdAt: '2026-06-20', owner: 'u2',
        lineItems: [{ id: 'L5', partNo: 'P-201', description: 'Harness set', qty: 300, uom: 'nos' }],
      },
      {
        id: 'R5', ref: 'RFI-2590', customerId: 'C2', product: 'Signal Processor Card', qty: 150, uom: 'nos',
        requiredDelivery: '2026-12-10', tenderRef: 'B-88', submissionDeadline: '2026-08-01',
        specs: 'LCSO approved.', source: 'E-mail', status: 'won', lossReason: null, lossNote: '',
        createdAt: '2026-06-01', owner: 'u2',
        lineItems: [{ id: 'L6', partNo: 'P-610', description: 'Processor card', qty: 150, uom: 'nos' }],
      },
    ],

    // F2/F3 — sourcing requests: requirement x line item x OEM; firm vs indication
    sourcing_requests: [
      { id: 'S1', requirementId: 'R1', lineItemId: 'L1', oemId: 'O1', requestedAt: '2026-09-08', responseStatus: 'quoted', commitmentType: 'firm', committedQty: 600, unitPrice: R(9500), leadTimeDays: 30, respondedAt: '2026-09-12', note: '' },
      { id: 'S2', requirementId: 'R1', lineItemId: 'L2', oemId: 'O1', requestedAt: '2026-09-08', responseStatus: 'quoted', commitmentType: 'firm', committedQty: 400, unitPrice: R(4200), leadTimeDays: 30, respondedAt: '2026-09-12', note: '' },
      { id: 'S3', requirementId: 'R1', lineItemId: 'L2', oemId: 'O2', requestedAt: '2026-09-08', responseStatus: 'available', commitmentType: 'indication', committedQty: 400, unitPrice: R(4050), leadTimeDays: 45, respondedAt: '2026-09-14', note: 'Availability indication only' },
      { id: 'S4', requirementId: 'R2', lineItemId: 'L3', oemId: 'O3', requestedAt: '2026-09-10', responseStatus: 'pending', commitmentType: 'indication', committedQty: 0, unitPrice: 0, leadTimeDays: 60, respondedAt: null, note: 'No response yet' },
      { id: 'S5', requirementId: 'R2', lineItemId: 'L3', oemId: 'O1', requestedAt: '2026-09-10', responseStatus: 'quoted', commitmentType: 'indication', committedQty: 500, unitPrice: R(15000), leadTimeDays: 30, respondedAt: '2026-09-16', note: 'Indicative price' },
      { id: 'S6', requirementId: 'R3', lineItemId: 'L4', oemId: 'O2', requestedAt: '2026-09-29', responseStatus: 'quoted', commitmentType: 'firm', committedQty: 200, unitPrice: R(18000), leadTimeDays: 45, respondedAt: '2026-10-01', note: 'RCMA-approved source' },
    ],

    // F4 — quotes with immutable versions and an approval
    quotes: [
      {
        id: 'Q1', ref: 'QTN-2601', requirementId: 'R1',
        versions: [
          {
            v: 2, status: 'approved', targetMarginPct: 18,
            lines: [
              { lineItemId: 'L1', oemId: 'O1', qty: 600, unitPrice: R(9500) },
              { lineItemId: 'L2', oemId: 'O1', qty: 400, unitPrice: R(4200) },
            ],
            recommended: R(11500), createdBy: 'u2', createdAt: '2026-09-20',
            approver: 'u1', approvedAt: '2026-09-22', note: 'Approved for submission.',
          },
          {
            v: 1, status: 'superseded', targetMarginPct: 20,
            lines: [{ lineItemId: 'L1', oemId: 'O1', qty: 600, unitPrice: R(9500) }],
            recommended: R(12000), createdBy: 'u2', createdAt: '2026-09-18',
            approver: null, approvedAt: null, note: 'First pass.',
          },
        ],
      },
      {
        id: 'Q2', ref: 'QTN-2602', requirementId: 'R2',
        versions: [
          {
            v: 1, status: 'submitted', targetMarginPct: 15,
            lines: [{ lineItemId: 'L3', oemId: 'O1', qty: 500, unitPrice: R(15000) }],
            recommended: R(17250), createdBy: 'u2', createdAt: '2026-09-22',
            approver: 'u1', approvedAt: '2026-09-23', note: 'Submitted to BEL.',
          },
        ],
      },
      {
        id: 'Q5', ref: 'QTN-2590', requirementId: 'R5',
        versions: [
          {
            v: 1, status: 'approved', targetMarginPct: 16,
            lines: [{ lineItemId: 'L6', oemId: 'O1', qty: 150, unitPrice: R(22000) }],
            recommended: R(25520), createdBy: 'u2', createdAt: '2026-08-05',
            approver: 'u1', approvedAt: '2026-08-06', note: '',
          },
        ],
      },
      {
        id: 'Q3', ref: 'QTN-2603', requirementId: 'R3',
        versions: [
          {
            v: 1, status: 'draft', targetMarginPct: 17,
            lines: [{ lineItemId: 'L4', oemId: 'O2', qty: 200, unitPrice: R(18000) }],
            recommended: 0, createdBy: 'u2', createdAt: '2026-10-02',
            approver: null, approvedAt: null, note: 'Awaiting owner approval before submission.',
          },
        ],
      },
    ],

    // comparable past bids shown before pricing (F4) — SAMPLE, source-labelled
    comparables: [
      { id: 'CP1', requirementId: 'R1', ref: 'RFI-2409', customerId: 'C1', product: 'Actuator Control Unit', quoted: R(11200), outcome: 'won', winningPrice: R(11200), source: 'PO book 24-25', confidence: 'high' },
      { id: 'CP2', requirementId: 'R1', ref: 'RFI-2311', customerId: 'C2', product: 'Actuator Control Unit (naval)', quoted: R(12900), outcome: 'lost', winningPrice: R(11400), source: 'Quotation list 23-24', confidence: 'medium' },
      { id: 'CP3', requirementId: 'R1', ref: 'RFI-2210', customerId: 'C1', product: 'Actuator Control Unit', quoted: R(10400), outcome: 'won', winningPrice: R(10400), source: 'PO book 22-23', confidence: 'low' },
    ],

    // F5 — government response states
    government_responses: [
      { id: 'GR1', quoteId: 'Q1', state: 'submitted', at: '2026-09-24', note: 'Submitted via SRM.' },
      { id: 'GR2', quoteId: 'Q2', state: 'clarification_requested', at: '2026-09-25', note: 'BEL asked for test data sheet.' },
      { id: 'GR3', quoteId: 'Q5', state: 'won', at: '2026-10-01', note: 'Order received.' },
    ],

    // follow_ups are generated from the age rule (rules.js generatedFollowUps);
    // seeded empty so the rule is the single source of truth.
    follow_ups: [],

    // F6/F7 — orders, invoices, payments, deliveries, PDI
    orders: [
      {
        id: 'PO1', ref: 'PO-2601-01', quoteId: 'Q1', quoteVersion: 2, requirementId: 'R1', customerId: 'C1',
        poNumber: 'HAL/PO/1187', poDate: '2026-09-28', deliveryDeadline: '2026-12-15', oemId: 'O1',
        supplierPo: 'ABC/SPO/442', compliance: 'CEMILAC + LCSO', inspection: 'Govt. inspection at works',
        pdiRequirements: 'PDI by nominated inspector', expectedDelivery: '2026-12-05', createdAt: '2026-09-28',
      },
      {
        id: 'PO2', ref: 'PO-2590-01', quoteId: 'Q5', quoteVersion: 1, requirementId: 'R5', customerId: 'C2',
        poNumber: 'BEL/PO/6631', poDate: '2026-08-10', deliveryDeadline: '2026-12-10', oemId: 'O1',
        supplierPo: 'ABC/SPO/388', compliance: 'LCSO', inspection: 'Customer witness',
        pdiRequirements: 'PDI at OEM works', expectedDelivery: '2026-12-20', createdAt: '2026-08-10',
      },
    ],
    invoices: [
      { id: 'IV1', orderId: 'PO1', invoiceNo: 'INV/26/041', invoiceDate: '2026-10-01', net: R(850000), igst: R(153000), gross: R(1003000) },
      { id: 'IV2', orderId: 'PO2', invoiceNo: 'INV/26/033', invoiceDate: '2026-09-05', net: R(330000), igst: R(59400), gross: R(389400) },
    ],
    payments: [
      { id: 'P1', invoiceId: 'IV1', direction: 'customer_receipt', amount: R(400000), date: '2026-10-01', reference: 'NEFT/HAL/9921', tds: 0, ld: 0, gstOnLd: 0, other: 0 },
      { id: 'P2', invoiceId: 'IV1', direction: 'oem_payment', amount: R(600000), date: '2026-09-30', reference: 'RTGS/ABC/771', tds: R(10000), ld: 0, gstOnLd: 0, other: 0 },
      { id: 'P3', invoiceId: 'IV2', direction: 'customer_receipt', amount: R(389400), date: '2026-09-20', reference: 'NEFT/BEL/4450', tds: 0, ld: 0, gstOnLd: 0, other: 0 },
    ],
    deliveries: [
      { id: 'DL1', orderId: 'PO1', invoiceId: 'IV1', stage: 'oem_po_placed', owner: 'u3', expectedDate: '2026-10-01', at: '2026-10-01', note: '' },
      { id: 'DL2', orderId: 'PO1', invoiceId: 'IV1', stage: 'production_started', owner: 'u3', expectedDate: '2026-10-05', at: '2026-10-05', note: '' },
      { id: 'DL3', orderId: 'PO1', invoiceId: 'IV1', stage: 'pdi_scheduled', owner: 'u3', expectedDate: '2026-10-20', at: null, note: 'Inspector nominated.' },
      { id: 'DL4', orderId: 'PO2', invoiceId: 'IV2', stage: 'production_done', owner: 'u3', expectedDate: '2026-09-25', at: '2026-09-25', note: '' },
      { id: 'DL5', orderId: 'PO2', invoiceId: 'IV2', stage: 'pdi_scheduled', owner: 'u3', expectedDate: '2026-10-04', at: null, note: '' },
    ],
    pdi_records: [
      { id: 'PDI1', orderId: 'PO1', offeredQty: 100, clearedQty: 90, rejectedQty: 10, status: 'held', mode: 'in_person', inspector: 'RCMA nominee', date: '2026-10-02', note: '10 units rejected; re-present after rework.' },
      { id: 'PDI2', orderId: 'PO2', offeredQty: 150, clearedQty: 150, rejectedQty: 0, status: 'passed', mode: 'VC', inspector: 'BEL witness', date: '2026-09-26', note: '' },
    ],

    // F8 — document & compliance vault
    documents: [
      { id: 'D1', type: 'Approval certificate', oemId: 'O1', title: 'CEMILAC CER 1', productCode: 'H1', requirementId: null, issueDate: '2025-03-03', expiryDate: '2028-03-02', ref: 'CER 1' },
      { id: 'D2', type: 'Approval certificate', oemId: 'O1', title: 'LCSO CER 2', productCode: 'H2', requirementId: null, issueDate: '2025-03-03', expiryDate: '2026-10-22', ref: 'CER 2' },
      { id: 'D3', type: 'Approval certificate', oemId: 'O1', title: 'RCMA CER 3', productCode: 'H3', requirementId: null, issueDate: '2025-03-03', expiryDate: '2026-09-20', ref: 'CER 3' },
      { id: 'D4', type: 'Approved item list', oemId: 'O1', title: 'OEM-ABC approved items', productCode: 'ALL', requirementId: null, issueDate: '2024-10-01', expiryDate: '2027-10-01', ref: 'IBL/2024' },
    ],

    // F11 — audit trail (append-only). Seeded with a short history.
    audit: [
      { id: 'AU1', at: '2026-09-22T10:12:00', actor: 'u1', role: 'owner', entity: 'quote', entityRef: 'QTN-2601 v2', action: 'approved' },
      { id: 'AU2', at: '2026-09-28T09:40:00', actor: 'u2', role: 'sales', entity: 'order', entityRef: 'PO-2601-01', action: 'created from QTN-2601 v2' },
      { id: 'AU3', at: '2026-10-01T16:05:00', actor: 'u4', role: 'finance', entity: 'payment', entityRef: 'INV/26/041', action: 'recorded customer receipt' },
    ],

    lossReasons: [
      { id: 'price', label: 'Price' },
      { id: 'technical_non_compliance', label: 'Technical non-compliance' },
      { id: 'delivery_timeline', label: 'Delivery timeline' },
      { id: 'competitor_preference', label: 'Competitor preference' },
      { id: 'quantity_or_capacity', label: 'Quantity or capacity' },
      { id: 'cancelled', label: 'Cancelled' },
      { id: 'not_pursued', label: 'Not pursued' },
      { id: 'other', label: 'Other' },
    ],

    settings: { staleFollowUpDays: 7, pdiBlocksDispatch: true, commissionDeferred: true },
  };
}
