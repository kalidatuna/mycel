---
created: 2026-07-22
tags: [postgres]
---
# Postgres Index Types

Quick reference.

- **B-tree**: the default. Equality and range queries, plus sorting.
- **Hash**: equality only. Rarely worth using.
- **GIN**: arrays, jsonb and full-text search.
- **GiST**: geometric data, ranges, nearest-neighbour search.
- **BRIN**: very large append-only tables where values follow physical order, like timestamps on logs.

Composite index: equality columns first, then the range column. Partial indexes are great when every query filters the same way. Always run `EXPLAIN (ANALYZE, BUFFERS)` before and after adding one.
