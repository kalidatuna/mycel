---
created: 2026-06-18
tags: [postgres, databases]
---
# UUID Primary Keys

Notes after reading a few blog posts and running a quick benchmark on my laptop.

Random UUIDv4 primary keys are fine in Postgres. Insert performance is not a problem in practice: my test inserted 5 million rows with UUIDv4 keys and throughput was basically the same as bigint keys. The "UUIDs fragment your index" warning is mostly folklore from MySQL, where the table is clustered on the primary key.

Upsides of UUIDv4:
- IDs can be generated anywhere, no round trip
- No information leak about how many rows exist
- Easy merging of data from different databases

So for new services I'd just use UUIDv4 and not worry about it.

(The benchmark table was small enough to fit entirely in RAM. Should probably retest with a bigger one.)
