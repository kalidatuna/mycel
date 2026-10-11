---
created: 2026-04-20
tags: [redis]
---
# Redis Eviction Policies

What Redis does when it hits `maxmemory`:

- `noeviction` — writes fail. Default. Surprising in production.
- `allkeys-lru` — evict least recently used across all keys. Good default for a pure cache.
- `volatile-lru` — LRU but only among keys with a TTL.
- `allkeys-lfu` — least frequently used. Better when a few keys are very hot.
- `volatile-ttl` — evict keys closest to expiring.
- `allkeys-random` — just random.

For the pricing cache: `allkeys-lfu`, since a handful of SKUs get most of the traffic.
Set `maxmemory` explicitly or Redis will happily use all the RAM on the box.
