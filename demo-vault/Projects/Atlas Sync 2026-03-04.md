---
created: 2026-03-04
tags: [meeting, atlas]
attendees: [Priya, Tom, Jonas, me]
---
# Atlas Sync 2026-03-04

Part of [[Atlas Migration]].

## Notes
- Priya wants dual-write to start next sprint. I think we need the comparison job first, otherwise we're flying blind.
- Tom raised the primary key question again. He wants UUIDv4 everywhere so services can generate IDs without a round trip. I pushed back — random keys spread inserts across the whole index. Agreed to write it up, see [[Database Design Principles]].
- Jonas: the invoice PDF renderer is CPU-bound and shouldn't live in the same service.

## Action items
- [x] Write up PK options (me)
- [ ] Comparison job design doc (me)
- [x] Split out PDF rendering ticket (Jonas)
