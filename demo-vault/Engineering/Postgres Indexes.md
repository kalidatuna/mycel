---
created: 2026-03-10
tags: [postgres, databases]
---
# Postgres Indexes

## Types
- **B-tree**: default. Equality and range queries, sorting.
- **Hash**: equality only. Rarely worth it.
- **GIN**: arrays, jsonb, full-text search.
- **GiST**: geometric data, ranges, nearest-neighbour.
- **BRIN**: huge append-only tables where values correlate with physical order (timestamps on logs).

## Tips
- Composite index column order matters: put the equality columns first, then the range column.
- Partial indexes (`WHERE status = 'open'`) are small and fast when queries always filter the same way.
- `EXPLAIN (ANALYZE, BUFFERS)` before and after, always.
- Indexes slow down writes. Every index is extra work on insert and update.

## Atlas
The invoicing query that locks things up does a sequential scan on `invoice_lines` because the index is on `(created_at, invoice_id)` instead of `(invoice_id, created_at)`.
