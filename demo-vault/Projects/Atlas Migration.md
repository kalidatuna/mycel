---
created: 2026-01-12
tags: [atlas, work, project]
status: in-progress
owner: me
---
# Atlas Migration

Atlas is the project to pull billing and invoicing out of the monolith into their own services. I'm tech lead on the data side.

## Why
- The monolith deploy takes 40 minutes and billing changes are the riskiest part of every release.
- Invoicing queries lock tables the checkout flow also needs. See [[Postgres Indexes]] for the worst offenders.
- We want billing to scale on its own schedule.

## Plan
1. Strangler pattern: new billing service sits behind the existing API gateway.
2. Dual-write invoices for a month, compare nightly.
3. Cut reads over table by table.
4. Turn off the old code paths.

## Decisions
- Primary keys for the new tables: see [[Database Design Principles]] (we argued about this a lot).
- Caching layer in front of the pricing lookups, see [[Caching Strategies]].
- Event stream between services — still deciding whether we need Kafka at all ([[Kafka Notes]]). Maybe [[Service Mesh]] later.

## Meetings
- [[Atlas Sync 2026-03-04]]
- [[Atlas Sync 2026-04-15]]

## Status (Sept)
Reads for invoices are fully cut over. Payment reconciliation is the last big piece. The May cache incident set us back about two weeks.
