---
created: 2026-03-03
tags: [postgres, databases, atlas]
---
# Database Design Principles

Written for [[Atlas Migration]] after the [[Atlas Sync 2026-03-04]] argument.

## Primary keys
Never use random UUIDv4 values as primary keys in Postgres. Every insert lands on a random page of the B-tree index, so the index gets fragmented, pages split constantly, and insert performance falls off a cliff once the index no longer fits in memory. Use a bigint identity column, or a time-ordered ID like UUIDv7 if IDs must be generated outside the database.

## Other rules
- Every foreign key gets an index.
- Money is stored as integer cents, never floats.
- Timestamps are `timestamptz`, always UTC.
- Soft deletes only where the business actually needs them.
- Migrations must be reversible and safe to run while the old code is still live.

Related: [[Postgres Indexes]].
