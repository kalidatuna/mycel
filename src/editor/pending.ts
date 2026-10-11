/** Editors register their unsaved work here so vault operations can flush it first. */
const pending = new Map<string, () => Promise<void>>()

export function setPending(key: string, flush: (() => Promise<void>) | null) {
  if (flush) pending.set(key, flush)
  else pending.delete(key)
}

export async function flushAll() {
  await Promise.all([...pending.values()].map((f) => f()))
}

export const hasPending = () => pending.size > 0
