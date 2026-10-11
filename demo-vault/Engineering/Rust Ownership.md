---
created: 2026-02-08
tags: [rust]
---
# Rust Ownership

Every value has exactly one owner. When the owner goes out of scope, the value is dropped.

## Borrowing
- `&T` shared borrow: many at once, read-only.
- `&mut T` exclusive borrow: only one, and no shared borrows at the same time.
- The borrow checker enforces this at compile time, so there are no data races in safe code.

## Smart pointers
- `Box<T>` puts a value on the heap with a single owner.
- `Rc<T>` gives you shared ownership through reference counting. Rc is thread-safe, so you can clone it and hand copies to different threads when several threads need to read the same data.
- `RefCell<T>` moves borrow checking to runtime.

## Moves
Assigning a `String` to another variable moves it; the old variable can't be used. Types that are `Copy` (integers, bools) are copied instead.

Back to [[Rust Learning Log]].
