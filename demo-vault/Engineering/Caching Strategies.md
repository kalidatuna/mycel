---
created: 2026-04-02
tags: [caching, architecture, atlas]
---
# Caching Strategies

## Patterns
- **Cache-aside**: app reads cache, on miss reads DB and fills cache. Simple, most common.
- **Read-through**: cache library loads from DB itself.
- **Write-through**: writes go to cache and DB together.
- **Write-behind**: writes go to cache, flushed to DB later. Fast, risky.

## Invalidation
TTL plus explicit delete on write. Keep TTLs short for anything price-related.

## Stampedes
When a hot key expires, every request misses at once and hammers the DB. Fixes:
- request coalescing (single flight)
- jittered TTLs
- serve stale while one worker refreshes

Used cache-aside for pricing in [[Atlas Migration]].
