# Document pack API (for the frontend)

`POST /generate/pack` makes several documents for ONE event, in priority order, and returns them together in a ZIP.
Details that every document needs (event name, date, venue...) are sent once in `event`; each document only gets the extra details it alone needs.

## Request

```json
{
  "club_id": 1,
  "event": {
    "event_name": "Internal Hackathon of SIH",
    "event_code": "SIH",
    "event_date": "2026-09-12",
    "venue": "CSE Department",
    "expected_participants": "1000+",
    "brief_description": "...",
    "objective": "..."
  },
  "documents": {
    "permission_letter":   { "submitted_to": "HoD (CSE Dept.)", "start_time": "6 PM", "end_time": "8 PM", "mode": "Offline", "...": "..." },
    "prize_money_receipt": { "rows": [ { "student_name": "...", "roll_no": "...", "amount": "5000", "...": "..." } ] },
    "submitted_note":      { "category": "Hackathon", "target_audience": "All", "expenses": [ { "item": "Banner", "amount": "800" } ] },
    "bill_summary":        { "other_rows": [ { "name": "...", "account_no": "...", "ifsc": "...", "amount": "800" } ] },
    "bill_certificate":    { "invoice_no": "1059", "items": [ { "name": "Banner", "quantity": "1", "unit_cost": "800" } ], "...": "..." }
  }
}
```

Only the documents listed under `documents` are made. Allowed keys: `permission_letter`, `prize_money_receipt`, `submitted_note`, `bill_summary`, `bill_certificate`.

## What is shared automatically

| From | To | How |
|---|---|---|
| `event.event_name` | `event_title` of the approval note | field setting `"from"` in doc_types.json |
| `event.objective` | `objectives` of the approval note | same |
| the approval note's reference number | `approval_note_no` of the bill certificate | set after the note is made (the note must be in the same pack) |
| the winners in `prize_money_receipt.rows` | prize payees of the bill summary (name + amount) | only when `bill_summary` has no `prize_rows` of its own |

A document's own value always wins over the shared one.

## Response

```json
{
  "count_ok": 5,
  "count_attention": 0,
  "zip_url": "/files/pack_20261020_120000.zip",
  "results": [
    { "type": "permission_letter", "name": "Permission (Venue / Room)", "status": "ok", "ref_no": "ACM/26-27/ROOM/001",
      "docx_url": "/files/1_v1.docx", "pdf_url": "/files/1_v1.pdf", "warnings": [] },
    { "type": "prize_money_receipt", "name": "Prize Money Receipt", "status": "ok",
      "documents": [ { "row": 1, "name": "W One", "status": "ok", "ref_no": "...", "pdf_url": "..." } ] },
    { "type": "submitted_note", "status": "error", "missing": ["Financial proposal (expenses): add at least one row"] }
  ]
}
```

`status` is `ok`, `error` (with `missing` or `message`) or, for the receipts, `partial`. A document with a problem never stops the others.
The ZIP holds a PDF and a DOCX for every document that was made, numbered by priority.
