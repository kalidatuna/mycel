---
created: 2026-01-08
---
# Kafka Notes

- Topics split into partitions. Ordering is only guaranteed within a partition.
- Consumer groups: each partition is read by one consumer in the group.
- Retention is time or size based, messages aren't deleted when read.
- Exactly-once is possible with idempotent producers and transactions, but it's complicated.
- Operating it ourselves sounds painful. Managed offering or skip it.

Not sure we need any of this for the billing work yet.
