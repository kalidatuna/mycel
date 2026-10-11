---
created: 2026-05-19
tags: [incident, atlas, caching]
severity: SEV-2
---
# Incident 2026-05-19 Cache Stampede

## Summary
Pricing cache entries for the top 200 products all expired at 09:00 because they were loaded by the same warm-up job with the same TTL. Every checkout request missed the cache at once, the database connection pool filled up, and checkout errors hit 18% for 11 minutes.

## Timeline
- 09:00 TTLs expire together
- 09:01 page fires, pool exhausted
- 09:06 rolled back nothing (no deploy), restarted pricing service to shed load
- 09:11 recovered as cache refilled

## What we change
- Jitter TTLs by ±20%.
- Single-flight loading per key so only one request goes to the DB.
- Serve stale values for up to 60 seconds while refreshing.

All three were already listed in my Caching Strategies note. We just hadn't done them. Followed the [[On-call Runbook]] and it worked well.
