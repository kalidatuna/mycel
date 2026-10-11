---
created: 2026-04-12
tags: [book, architecture, databases]
author: Martin Kleppmann
---
# Designing Data-Intensive Applications

Reading slowly, a chapter every couple of weeks.

## Notes so far (my words)
- **Reliability, scalability, maintainability** are the three lenses for everything.
- Storage engines: log-structured (LSM trees) vs page-oriented (B-trees). B-trees update in place; LSM trees append and compact. Explains a lot about why random keys hurt some databases more than others.
- Replication: single-leader, multi-leader, leaderless. Every option trades consistency for availability in some way.
- Partitioning by key range gives hot spots; by hash loses range queries.

Very relevant to [[Atlas Migration]].
