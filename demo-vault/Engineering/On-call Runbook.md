---
created: 2026-05-02
tags: [oncall, work]
---
# On-call Runbook

## First five minutes
1. Acknowledge the page.
2. Check the dashboard: error rate, latency p99, saturation.
3. Anything deployed in the last hour? Roll back first, investigate later.
4. Post in #incidents with what you know, even if it's "looking".

## Common problems
- **DB connection pool exhausted** — usually a slow query holding connections. Check `pg_stat_activity`.
- **Cache hit rate drops to zero** — the cache node restarted or a stampede is happening.
- **Queue backlog growing** — consumer crashed or a poison message.

## After
Write it up within 48 hours. Blameless. See [[Incident 2026-05-19 Cache Stampede]] for an example.
