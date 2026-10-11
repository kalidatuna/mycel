---
created: 2026-04-15
tags: [meeting, atlas]
attendees: [Priya, Tom, me]
---
# Atlas Sync 2026-04-15

Part of [[Atlas Migration]].

## Notes
- Dual-write has been running for 9 days. Nightly diff found 14 mismatches, all rounding in tax lines. Fix is in.
- Pricing lookups are hitting the database 3,000 times a minute. Agreed to put a cache in front, see [[Caching Strategies]].
- Tom still wants random UUIDs. We settled on UUIDv7 for the new tables, which is time-ordered, so both of us are happy.

## Action items
- [x] Cache in front of pricing (me)
- [ ] Load test with production-like traffic (Tom)
- [ ] Draft cutover checklist (Priya)
