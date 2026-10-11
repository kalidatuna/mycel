---
created: 2026-05-14
tags: [rust, concurrency]
---
# Rust Concurrency

## Threads
`std::thread::spawn` takes a closure that must be `'static` and `Send`. Use `move` closures to hand ownership to the thread.

## Correction
In [[Rust Ownership]] I wrote that `Rc` is thread-safe. That's wrong. `Rc<T>` is **not** `Send` or `Sync` because its reference count isn't atomic. The compiler refuses to move an `Rc` into another thread. For sharing across threads use `Arc<T>` (atomic reference count), and wrap it in `Mutex` or `RwLock` if you need to mutate.

## Channels
`mpsc::channel()` — multiple producers, single consumer. Ownership of the message moves into the channel, which makes it impossible to touch data after sending it.

## Send and Sync
- `Send`: safe to move to another thread.
- `Sync`: safe to share references between threads.
Most types get these automatically.
