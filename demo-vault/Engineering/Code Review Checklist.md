---
created: 2026-03-22
tags: [work, process]
---
# Code Review Checklist

- Does it do what the ticket says, and only that?
- Are errors handled, or at least surfaced?
- Any query in a loop?
- New index needed? Check [[Postgres Indexes]].
- Tests cover the unhappy path?
- Would I understand this in six months?
- Names: does each one say what the thing is?

Tone: ask questions instead of giving orders. "What happens if this is null?" lands better than "handle null".
