import { create } from 'zustand'

/**
 * Screen-lock state. Locking is UI-level (the session stays alive) — the till
 * blocks behind a full-screen overlay until the signed-in user re-enters their
 * password. Triggered manually from the header or by 15 minutes of idle time.
 */
type LockState = {
  locked: boolean
  lock: () => void
  unlock: () => void
}

export const useLockStore = create<LockState>((set) => ({
  locked: false,
  lock: () => set({ locked: true }),
  unlock: () => set({ locked: false }),
}))
