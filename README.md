# TenderDesk

A working MVP for a defence contract consultant: **one requirement, one record, one timeline.**
Government and defence agencies send requirements; he fulfils them through a network of OEM
suppliers. This replaces the Excel / email / memory stack that makes history unsearchable.

Static site — no build, no backend, no database server, no auth, no keys, no network calls.
Runs from any static host or from disk.

## Run locally

Open `index.html`, or serve the folder:

```powershell
npx serve .        # or: python -m http.server
```

## Screens

- **Morning view** — six computed panels and plain-language answers ("how many orders are there?")
- **Requirements & RFIs** — the central record, line items, seven statuses
- **OEM & sourcing** — masters, approvals, requests with firm-vs-indication
- **Quantity coverage** — uncovered balance and the over-commit gate
- **Quotations** — comparable past bids, versions, owner approval
- **Orders & fulfilment** — lineage, PDI (offered/cleared/rejected), delivery risk
- **Payments** — partial payments, TDS/LD, deferred commission
- **Documents** — approval certificates with expiry
- **Search & history** — comparables and structured loss reasons
- **Audit & approvals** — append-only trail

Rules enforced in code: no quote without a requirement; no PO without an approved quote;
indications never count as firm commitments; PDI cleared ≠ offered; balances are derived,
never stored. Data is sample data traced to the client's own spreadsheet columns.

Deployed on Vercel from this repository (static, zero-config).
